import { DecimalPipe } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartPanel } from './components/chart-panel';
import { PaperCard } from './components/paper-card';
import { ReadingListPanel } from './components/reading-list-panel';
import { SettingsMenu } from './components/settings-menu';
import { SyntaxHelp } from './components/syntax-help';
import { validateQuery } from './core/boolean-query';
import { MAX_LIMIT } from './core/core-api.service';
import { pageItems } from './core/pagination';
import { downloadText, slugify, toCsv } from './core/export';
import { SearchStore, SortOrder } from './core/search.store';
import { SettingsService } from './core/settings.service';
import { UrlState } from './core/url-state';

@Component({
  selector: 'app-root',
  imports: [FormsModule, DecimalPipe, PaperCard, SyntaxHelp, ChartPanel, SettingsMenu, ReadingListPanel],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class App {
  protected readonly store = inject(SearchStore);
  protected readonly settings = inject(SettingsService);
  private readonly url = inject(UrlState);
  private readonly queryInput = viewChild<ElementRef<HTMLInputElement>>('queryInput');

  protected readonly maxLimit = MAX_LIMIT;
  protected readonly limitPresets = [10, 25, 50, 100];
  protected readonly sortOptions: { id: SortOrder; label: string }[] = [
    { id: 'relevance', label: 'Relevance' },
    { id: 'newest', label: 'Newest first' },
    { id: 'oldest', label: 'Oldest first' },
    { id: 'cited', label: 'Most cited' },
  ];

  protected readonly pages = computed(() => pageItems(this.store.page(), this.store.pageCount()));

  protected readonly draft = signal('');
  protected readonly validation = computed(() => validateQuery(this.draft()));
  /** Only nag about errors once the user has typed something. */
  protected readonly showError = computed(() => !!this.draft().trim() && !this.validation().valid);

  constructor() {
    this.draft.set(this.url.restore());
    this.url.sync();
  }

  protected submit(): void {
    if (!this.validation().valid) return;
    this.store.search(this.draft());
  }

  protected onLimitChange(value: number): void {
    this.store.setLimit(value);
    if (this.store.hasSearched()) this.store.search();
  }

  protected example(q: string): void {
    this.draft.set(q);
    this.submit();
  }

  protected goTo(page: number): void {
    if (page === this.store.page()) return;
    this.store.goToPage(page);
    document.querySelector('.results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Brand link: return to the start screen without a full page reload. */
  protected goHome(e: MouseEvent): void {
    // Let modified clicks (new tab/window) behave like a normal link.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    this.store.reset();
    this.draft.set('');
    history.pushState(null, '', location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected exportCsv(): void {
    downloadText(`core-${slugify(this.store.query())}.csv`, toCsv(this.store.visibleResults()));
  }

  /** Press "/" anywhere to jump to the search box. */
  protected onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (e.key === '/' && !typing) {
      e.preventDefault();
      this.queryInput()?.nativeElement.focus();
    }
  }
}
