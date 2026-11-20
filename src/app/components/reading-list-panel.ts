import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toBibtex } from '../core/bibtex';
import { downloadText, toCsv } from '../core/export';
import { CoreWork } from '../core/models';
import { ReadingListService } from '../core/reading-list.service';
import { authorsLabel, cleanText, workYear } from '../core/work-utils';

@Component({
  selector: 'app-reading-list-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="rl-title">
      <header>
        <h2 id="rl-title">★ Reading list <span class="count">{{ list.count() }}</span></h2>
        @if (list.count()) {
          <button type="button" class="link" (click)="open.set(!open())" [attr.aria-expanded]="open()">
            {{ open() ? 'Hide' : 'Show' }}
          </button>
        }
      </header>

      @if (!list.count()) {
        <p class="muted">Star (☆) papers to keep them here across searches and export them for your reference manager.</p>
      } @else {
        @if (open()) {
          <ul>
            @for (p of list.items(); track p.work.id) {
              <li>
                <div class="text">
                  <a [href]="'https://core.ac.uk/works/' + p.work.id" target="_blank" rel="noopener">{{ title(p.work) }}</a>
                  <span class="meta">{{ authors(p.work) }}@if (year(p.work)) { · {{ year(p.work) }} }</span>
                </div>
                <button type="button" class="remove" (click)="list.remove(p.work.id)" [attr.aria-label]="'Remove ' + title(p.work)">✕</button>
              </li>
            }
          </ul>
        }
        <div class="actions">
          <button type="button" (click)="exportBib()">⬇ BibTeX</button>
          <button type="button" (click)="copyBib()">{{ copied() ? 'Copied ✓' : 'Copy BibTeX' }}</button>
          <button type="button" (click)="exportCsv()">⬇ CSV</button>
          <button type="button" class="danger" (click)="clear()">Clear</button>
        </div>
      }
    </section>
  `,
  styles: `
    .panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem; display: flex; flex-direction: column; gap: .6rem; }
    header { display: flex; align-items: center; justify-content: space-between; }
    h2 { margin: 0; font-size: .95rem; display: flex; align-items: center; gap: .4rem; }
    .count { font-size: .72rem; background: var(--chip); color: var(--text-2); border-radius: 999px; padding: .05rem .5rem; }
    .muted { margin: 0; font-size: .8rem; color: var(--muted); line-height: 1.45; }
    .link { border: 0; background: none; color: var(--accent); cursor: pointer; font-size: .8rem; }
    ul { list-style: none; margin: 0; padding: 0; max-height: 260px; overflow: auto; display: flex; flex-direction: column; }
    li { display: flex; gap: .4rem; align-items: flex-start; padding: .45rem 0; border-bottom: 1px solid var(--border); }
    li:last-child { border-bottom: 0; }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .1rem; }
    .text a { color: var(--text); font-size: .82rem; text-decoration: none; line-height: 1.3; }
    .text a:hover { color: var(--accent); text-decoration: underline; }
    .meta { font-size: .72rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .remove { border: 0; background: none; color: var(--muted); cursor: pointer; font-size: .8rem; padding: .1rem .25rem; }
    .remove:hover { color: var(--danger); }
    .actions { display: flex; flex-wrap: wrap; gap: .35rem; }
    .actions button { font-size: .76rem; padding: .3rem .6rem; border-radius: 8px; border: 1px solid var(--border-strong); background: var(--bg); cursor: pointer; }
    .actions button:hover { border-color: var(--accent); color: var(--accent); }
    .actions .danger:hover { border-color: var(--danger); color: var(--danger); }
  `,
})
export class ReadingListPanel {
  protected readonly list = inject(ReadingListService);
  protected readonly open = signal(true);
  protected readonly copied = signal(false);

  protected title = (w: CoreWork) => cleanText(w.title) || 'Untitled';
  protected authors = authorsLabel;
  protected year = workYear;

  protected exportBib(): void {
    downloadText('reading-list.bib', toBibtex(this.list.works()), 'application/x-bibtex;charset=utf-8');
  }

  protected exportCsv(): void {
    downloadText('reading-list.csv', toCsv(this.list.works()));
  }

  protected async copyBib(): Promise<void> {
    try {
      await navigator.clipboard.writeText(toBibtex(this.list.works()));
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      this.exportBib();
    }
  }

  protected clear(): void {
    if (confirm(`Remove all ${this.list.count()} papers from your reading list?`)) this.list.clear();
  }
}
