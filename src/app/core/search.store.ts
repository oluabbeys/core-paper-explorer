import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap, tap } from 'rxjs';
import { CoreApiService } from './core-api.service';
import { CoreSearchResponse, CoreWork, SearchParams } from './models';

type Outcome = { ok: true; res: CoreSearchResponse; params: SearchParams } | { ok: false; error: string };

/** Signal-based state for the current search. */
@Injectable({ providedIn: 'root' })
export class SearchStore {
  private readonly api = inject(CoreApiService);
  private readonly requests$ = new Subject<SearchParams>();

  readonly query = signal('');
  readonly limit = signal(10);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly results = signal<CoreWork[]>([]);
  readonly totalHits = signal(0);
  readonly hasSearched = signal(false);

  readonly count = computed(() => this.results().length);

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
}
