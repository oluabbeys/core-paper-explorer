import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SearchStore } from './core/search.store';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(SearchStore);
  protected draft = '';

  protected submit(): void {
    this.store.search(this.draft);
  }
}
