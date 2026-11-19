import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MAX_LIMIT } from './core/core-api.service';
import { SearchStore } from './core/search.store';
import { PaperCard } from './components/paper-card';

@Component({
  selector: 'app-root',
  imports: [FormsModule, DecimalPipe, PaperCard],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(SearchStore);
  protected readonly maxLimit = MAX_LIMIT;
  protected readonly limitPresets = [10, 25, 50, 100];
  protected draft = '';

  protected submit(): void {
    this.store.search(this.draft);
  }

  protected onLimitChange(value: number): void {
    this.store.setLimit(value);
    if (this.store.hasSearched()) this.store.search();
  }

  protected example(q: string): void {
    this.draft = q;
    this.submit();
  }
}
