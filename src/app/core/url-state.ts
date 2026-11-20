import { Injectable, effect, inject } from '@angular/core';
import { CompareStore } from './compare.store';
import { SearchStore } from './search.store';
import { ViewState } from './view.state';

/**
 * Keeps the search in the address bar (?q=…&limit=…&page=…&filter=…) so any view
 * can be bookmarked or shared, and restores it on page load.
 */
@Injectable({ providedIn: 'root' })
export class UrlState {
  private readonly store = inject(SearchStore);
  private readonly compare = inject(CompareStore);
  private readonly ui = inject(ViewState);

  /** Returns the query restored from the URL (if any) after kicking off the search. */
  restore(): string {
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    const q = params.get('q')?.trim() ?? '';
    const limit = Number(params.get('limit'));
    const page = Math.max(1, Number(params.get('page')) || 1);
    if (limit) this.store.setLimit(limit);
    const filter = params.get('filter');
    if (filter) this.store.filter.set(filter);
    if (q) this.store.search(q, (page - 1) * this.store.limit());

    if (params.get('view') === 'compare') {
      this.ui.view.set('compare');
      const a = params.get('a')?.trim() ?? '';
      const b = params.get('b')?.trim() ?? '';
      this.compare.draftA.set(a);
      this.compare.draftB.set(b);
      if (a && b) this.compare.compare(a, b);
    }
    return q;
  }

  /** Mirror state → URL (replaceState: no history spam while typing a filter). */
  sync(): void {
    effect(() => {
      const params = new URLSearchParams();
      if (this.ui.view() === 'compare') {
        params.set('view', 'compare');
        const topics = this.compare.topics();
        if (topics) {
          params.set('a', topics[0].query);
          params.set('b', topics[1].query);
        }
      } else {
        if (!this.store.hasSearched() || !this.store.query()) return;
        params.set('q', this.store.query());
        params.set('limit', String(this.store.limit()));
        if (this.store.page() > 1) params.set('page', String(this.store.page()));
        if (this.store.filter().trim()) params.set('filter', this.store.filter().trim());
      }
      const next = `${location.pathname}?${params}`;
      if (next !== location.pathname + location.search) history.replaceState(null, '', next);
    });
  }
}
