import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';
import { CoreApiService, MAX_LIMIT } from './core-api.service';
import { evaluate, highlightTerms, tryParse, validateQuery } from './boolean-query';
import { CoreSearchResponse, CoreWork, SearchParams } from './models';

type Outcome = { ok: true; res: CoreSearchResponse; params: SearchParams } | { ok: false; error: string };

/** Signal-based state for the current search. */
@Injectable({ providedIn: 'root' })
export class SearchStore {
  private readonly api = inject(CoreApiService);
  private readonly requests$ = new Subject<SearchParams>();

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
  readonly visibleResults = computed(() => {
    const ast = this.filterAst();
    return ast ? this.results().filter((w) => evaluate(ast, w)) : this.results();
  });
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
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((outcome) => {
        this.loading.set(false);
        this.hasSearched.set(true);
        if (!outcome.ok) {
          this.error.set(outcome.error);
          return;
        }
        this.offset.set(outcome.params.offset);
        this.results.set(outcome.res.results);
        this.totalHits.set(outcome.res.totalHits);
      });
  }

  search(query = this.query()): void {
    const q = query.trim();
    if (!q) return;
    this.query.set(q);
    this.requests$.next({ query: q, limit: this.limit(), offset: 0 });
  }

  setLimit(value: number): void {
    const n = Math.min(Math.max(Math.trunc(Number(value)) || 1, 1), MAX_LIMIT);
    this.limit.set(n);
  }

  goToPage(page: number): void {
    const p = Math.min(Math.max(1, page), this.pageCount());
    if (!this.query()) return;
    this.requests$.next({ query: this.query(), limit: this.limit(), offset: (p - 1) * this.limit() });
  }
}
