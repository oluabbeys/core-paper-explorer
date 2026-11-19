import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartPanel } from './components/chart-panel';
import { PaperCard } from './components/paper-card';
import { SyntaxHelp } from './components/syntax-help';
import { validateQuery } from './core/boolean-query';
import { MAX_LIMIT } from './core/core-api.service';
import { SearchStore } from './core/search.store';

@Component({
  selector: 'app-root',
  imports: [FormsModule, DecimalPipe, PaperCard, SyntaxHelp, ChartPanel],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(SearchStore);
  protected readonly maxLimit = MAX_LIMIT;
  protected readonly limitPresets = [10, 25, 50, 100];

  protected readonly draft = signal('');
  protected readonly validation = computed(() => validateQuery(this.draft()));
  /** Only nag about errors once the user has typed something. */
  protected readonly showError = computed(() => !!this.draft().trim() && !this.validation().valid);

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
}
