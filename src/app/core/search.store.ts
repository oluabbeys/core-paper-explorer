import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, concatMap, from, of, reduce, switchMap, takeUntil, tap } from 'rxjs';
import { CoreApiService, MAX_LIMIT } from './core-api.service';
import { evaluate, highlightTerms, tryParse, validateQuery } from './boolean-query';
import { ChartDimension, aggregate } from './chart-data';
import { CoreSearchResponse, CoreWork, SearchParams } from './models';
import { SettingsService } from './settings.service';
import { workYear } from './work-utils';

export type SortOrder = 'relevance' | 'newest' | 'oldest' | 'cited';

const SORTERS: Record<Exclude<SortOrder, 'relevance'>, (a: CoreWork, b: CoreWork) => number> = {
  newest: (a, b) => (workYear(b) ?? -Infinity) - (workYear(a) ?? -Infinity),
  oldest: (a, b) => (workYear(a) ?? Infinity) - (workYear(b) ?? Infinity),
  cited: (a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0),
};

type Outcome = { ok: true; res: CoreSearchResponse; params: SearchParams } | { ok: false; error: string };

/** Signal-based state for the current search. */
@Injectable({ providedIn: 'root' })
export class SearchStore {
  private readonly api = inject(CoreApiService);
  private readonly requests$ = new Subject<SearchParams>();
  private readonly cancelSample$ = new Subject<void>();
  private readonly destroyRef = inject(DestroyRef);
  private readonly settings = inject(SettingsService);

  readonly query = signal('');
  readonly limit = signal(10);
  readonly offset = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly results = signal<CoreWork[]>([]);
  readonly totalHits = signal(0);
  readonly hasSearched = signal(false);

  readonly count = computed(() => this.results().length);

  /** Boolean filter applied client-side to the papers already loaded. */
  readonly filter = signal('');
  private readonly filterAst = computed(() => tryParse(this.filter()));
  readonly filterError = computed(() => {
    const f = this.filter().trim();
    if (!f) return null;
    const v = validateQuery(f);
    return v.valid ? null : v.error ?? 'Invalid filter';
  });
  readonly filterActive = computed(() => !!this.filterAst());
  readonly sortOrder = signal<SortOrder>('relevance');
  readonly visibleResults = computed(() => {
    const ast = this.filterAst();
    const list = ast ? this.results().filter((w) => evaluate(ast, w)) : [...this.results()];
    const order = this.sortOrder();
    return order === 'relevance' ? list : list.sort(SORTERS[order]);
  });
  // ------------------------------------------------------------- chart
  readonly chartDimension = signal<ChartDimension>('year');
  /** 'page' = papers on the current page; 'sample' = a larger sample fetched for the chart. */
  readonly chartSource = signal<'page' | 'sample'>('page');
  readonly sample = signal<CoreWork[]>([]);
  readonly sampleLoading = signal(false);
  readonly sampleError = signal<string | null>(null);

  /** Papers feeding the chart: every loaded paper that matches the query (and the local filter). */
  readonly chartWorks = computed(() => {
    const base = this.chartSource() === 'sample' && this.sample().length ? this.sample() : this.results();
    const ast = this.filterAst();
    return ast ? base.filter((w) => evaluate(ast, w)) : base;
  });
  readonly chart = computed(() => aggregate(this.chartWorks(), this.chartDimension()));

  /** Terms from both the API query and the local filter, used to highlight matches. */
  readonly highlight = computed(() => [
    ...new Set([...highlightTerms(tryParse(this.query())), ...highlightTerms(this.filterAst())]),
  ]);
  readonly page = computed(() => Math.floor(this.offset() / this.limit()) + 1);
  /** CORE only allows deep paging up to 10,000 results without a scroll id. */
  readonly pageCount = computed(() => Math.max(1, Math.ceil(Math.min(this.totalHits(), 10_000) / this.limit())));

  constructor() {
    this.requests$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        // switchMap cancels a slower in-flight request if the user searches again.
        switchMap((params) =>
          this.api.searchWorks(params).pipe(
            switchMap((res) => of<Outcome>({ ok: true, res, params })),
            catchError((e: Error) => of<Outcome>({ ok: false, error: e.message })),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((outcome) => {
        this.loading.set(false);
        this.hasSearched.set(true);
        if (!outcome.ok) {
          this.error.set(outcome.error);
          return;
        }
        if (outcome.params.offset === 0 || outcome.params.query !== this.lastQuery) this.resetSample();
        this.lastQuery = outcome.params.query;
        this.offset.set(outcome.params.offset);
        this.results.set(outcome.res.results);
        this.settings.remember(outcome.params.query);
        this.totalHits.set(outcome.res.totalHits);
      });
  }

  private lastQuery = '';

  search(query = this.query(), offset = 0): void {
    const q = query.trim();
    if (!q) return;
    this.query.set(q);
    this.requests$.next({ query: q, limit: this.limit(), offset: Math.max(0, offset) });
  }

  setLimit(value: number): void {
    const n = Math.min(Math.max(Math.trunc(Number(value)) || 1, 1), MAX_LIMIT);
    this.limit.set(n);
  }

  /**
   * Fetch up to `max` matching papers (in pages of 100) so the chart can
   * summarise far more than one page of results. Requests run sequentially to be
   * gentle on CORE's rate limits; partial results are kept if a later page fails.
   */
  loadSample(max = 500): void {
    const q = this.query();
    if (!q) return;
    this.cancelSample$.next();
    const total = Math.min(this.totalHits(), max);
    const offsets = Array.from({ length: Math.ceil(total / MAX_LIMIT) }, (_, i) => i * MAX_LIMIT);
    this.sampleLoading.set(true);
    this.sampleError.set(null);
    this.chartSource.set('sample');

    const seen = new Map<CoreWork['id'], CoreWork>();
    from(offsets)
      .pipe(
        concatMap((offset) => this.api.searchWorks({ query: q, limit: Math.min(MAX_LIMIT, total - offset), offset })),
        tap((res) => {
          res.results.forEach((w) => seen.set(w.id, w));
          this.sample.set([...seen.values()]);
        }),
        reduce(() => null, null),
        takeUntil(this.cancelSample$),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        complete: () => this.sampleLoading.set(false),
        error: (e: Error) => {
          this.sampleLoading.set(false);
          this.sampleError.set(seen.size ? `Stopped after ${seen.size} papers: ${e.message}` : e.message);
        },
      });
  }

  private resetSample(): void {
    this.cancelSample$.next();
    this.sample.set([]);
    this.sampleLoading.set(false);
    this.sampleError.set(null);
    this.chartSource.set('page');
  }

  /** Append a clause to the local filter (used when a chart bar is clicked). */
  addFilterClause(clause: string): void {
    const current = this.filter().trim();
    if (!current) return this.filter.set(clause);
    if (current.includes(clause)) return;
    this.filter.set(`(${current}) AND ${clause}`);
  }

  goToPage(page: number): void {
    const p = Math.min(Math.max(1, page), this.pageCount());
    if (!this.query()) return;
    this.requests$.next({ query: this.query(), limit: this.limit(), offset: (p - 1) * this.limit() });
  }
}
