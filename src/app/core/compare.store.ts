import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, concatMap, finalize, from, map, takeUntil, toArray } from 'rxjs';
import { TopicData, buildSeries, hasAllExact, verdict, yearWindow } from './compare';
import { CoreApiService } from './core-api.service';

const SAMPLE_SIZE = 100;

/**
 * State for "Compare topics".
 *  - compare(): 2 requests — exact total + the 100 most relevant papers per topic,
 *    giving an instant (sample-based) trend.
 *  - loadExact(): one count request per topic per year for exact yearly numbers.
 *    Requests run one at a time to respect CORE's rate limits; partial results are kept.
 */
@Injectable({ providedIn: 'root' })
export class CompareStore {
  private readonly api = inject(CoreApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cancel$ = new Subject<void>();

  /** Text in the two topic boxes (kept here so the shell can prefill them). */
  readonly draftA = signal('');
  readonly draftB = signal('');

  readonly years = signal(yearWindow(new Date().getFullYear(), 10));
  readonly topics = signal<[TopicData, TopicData] | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly exactLoading = signal(false);
  readonly exactDone = signal(0);
  readonly exactError = signal<string | null>(null);
  readonly exactNeeded = computed(() => this.years().length * 2);

  /** True once exact yearly counts are available for both topics. */
  readonly isExact = computed(() => {
    const t = this.topics();
    return !!t && t.every((x) => hasAllExact(x, this.years()));
  });

  readonly series = computed(() => {
    const t = this.topics();
    if (!t) return null;
    return t.map((x) => buildSeries(x, this.years(), this.isExact())) as [ReturnType<typeof buildSeries>, ReturnType<typeof buildSeries>];
  });

  readonly summary = computed(() => {
    const s = this.series();
    return s ? verdict(s[0], s[1], this.years()) : '';
  });

  compare(a: string, b: string): void {
    const queries = [a.trim(), b.trim()];
    if (queries.some((q) => !q)) return;
    this.cancel$.next();
    this.loading.set(true);
    this.error.set(null);
    this.exactError.set(null);
    this.exactDone.set(0);

    from(queries)
      .pipe(
        concatMap((query) =>
          this.api
            .searchWorks({ query, limit: SAMPLE_SIZE, offset: 0 })
            .pipe(map((res): TopicData => ({ query, total: res.totalHits, sample: res.results, exact: {} }))),
        ),
        toArray(),
        takeUntil(this.cancel$),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ([x, y]) => this.topics.set([x, y]),
        error: (e: Error) => this.error.set(e.message),
      });
  }

  loadExact(): void {
    const topics = this.topics();
    if (!topics || this.exactLoading()) return;
    const jobs = topics.flatMap((t, i) =>
      this.years()
        .filter((y) => t.exact[y] == null)
        .map((y) => ({ i, y, query: `(${t.query}) AND yearPublished:${y}` })),
    );
    if (!jobs.length) return;

    this.exactLoading.set(true);
    this.exactError.set(null);
    from(jobs)
      .pipe(
        concatMap((job) => this.api.searchWorks({ query: job.query, limit: 1, offset: 0 }).pipe(map((res) => ({ ...job, n: res.totalHits })))),
        takeUntil(this.cancel$),
        finalize(() => this.exactLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ i, y, n }) => {
          this.topics.update((t) => {
            if (!t) return t;
            const copy = [...t] as [TopicData, TopicData];
            copy[i] = { ...copy[i], exact: { ...copy[i].exact, [y]: n } };
            return copy;
          });
          this.exactDone.update((d) => d + 1);
        },
        error: (e: Error) => this.exactError.set(`Stopped part-way: ${e.message}`),
      });
  }

  reset(): void {
    this.cancel$.next();
    this.topics.set(null);
    this.error.set(null);
    this.exactError.set(null);
    this.exactDone.set(0);
  }
}
