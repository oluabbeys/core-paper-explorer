import { ChangeDetectionStrategy, Component, output } from '@angular/core';

interface Example {
  q: string;
  note: string;
}

@Component({
  selector: 'app-syntax-help',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details>
      <summary>Search syntax</summary>
      <div class="grid">
        @for (e of examples; track e.q) {
          <button type="button" class="ex" (click)="use.emit(e.q)" [title]="'Use: ' + e.q">
            <code>{{ e.q }}</code>
            <span>{{ e.note }}</span>
          </button>
        }
      </div>
      <p class="hint">
        Operators must be UPPERCASE. Adjacent words are combined with AND. Click an example to use it.
        Full reference: <a href="https://api.core.ac.uk/docs/v3#section/How-to-search" target="_blank" rel="noopener">CORE "How to search"</a>.
      </p>
    </details>
  `,
  styles: `
    details { font-size: .85rem; color: var(--text-2); }
    summary { cursor: pointer; color: var(--accent); font-weight: 500; user-select: none; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: .4rem; margin-top: .6rem; }
    .ex { display: flex; flex-direction: column; align-items: flex-start; gap: .15rem; text-align: left; padding: .5rem .6rem;
      border: 1px solid var(--border); border-radius: 8px; background: var(--bg); cursor: pointer; }
    .ex:hover { border-color: var(--accent); }
    code { font-size: .8rem; color: var(--text); }
    .ex span { color: var(--muted); font-size: .75rem; }
    .hint { margin: .6rem 0 0; color: var(--muted); font-size: .78rem; }
    a { color: var(--accent); }
  `,
})
export class SyntaxHelp {
  readonly use = output<string>();

  protected readonly examples: Example[] = [
    { q: 'drone AND delivery', note: 'Both words must appear' },
    { q: 'drone OR uav', note: 'Either word' },
    { q: 'drone NOT military', note: 'Exclude a word (also -military)' },
    { q: '(drone AND (package OR delivery))', note: 'Group with brackets' },
    { q: '"last mile delivery"', note: 'Exact phrase' },
    { q: 'title:drone', note: 'Search one field (title, abstract, authors…)' },
    { q: 'authors:(smith OR jones)', note: 'Apply a field to a group' },
    { q: 'drone AND yearPublished>2020', note: 'Numeric comparison' },
  ];
}
