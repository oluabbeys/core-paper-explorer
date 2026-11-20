import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { HighlightPipe } from '../core/highlight';
import { CoreWork } from '../core/models';
import { ReadingListService } from '../core/reading-list.service';
import { authorsLabel, cleanText, documentTypeLabel, venueLabel, workLinks, workYear } from '../core/work-utils';

@Component({
  selector: 'app-paper-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HighlightPipe],
  template: `
    <article class="card">
      <header>
        <button
          type="button"
          class="star"
          [class.on]="saved()"
          (click)="readingList.toggle(work())"
          [attr.aria-pressed]="saved()"
          [attr.aria-label]="saved() ? 'Remove from reading list' : 'Save to reading list'"
          [title]="saved() ? 'Remove from reading list' : 'Save to reading list'"
        >{{ saved() ? '★' : '☆' }}</button>
        <h3 class="title">
          <a [href]="coreUrl()" target="_blank" rel="noopener"
            >@for (s of title() | highlight: highlight(); track $index) {@if (s.hit) {<mark>{{ s.text }}</mark>} @else {<span>{{ s.text }}</span>}}</a
          >
        </h3>
        <p class="meta">
          <span class="authors">{{ authors() }}</span>
          @if (year()) {
            <span class="dot">·</span><span>{{ year() }}</span>
          }
          @if (venue()) {
            <span class="dot">·</span><span class="venue">{{ venue() }}</span>
          }
        </p>
      </header>

      @if (abstract()) {
        <p class="abstract" [class.open]="expanded()">@for (s of abstract() | highlight: highlight(); track $index) {@if (s.hit) {<mark>{{ s.text }}</mark>} @else {<span>{{ s.text }}</span>}}</p>
        @if (abstract().length > 320) {
          <button type="button" class="link-btn" (click)="expanded.set(!expanded())" [attr.aria-expanded]="expanded()">
            {{ expanded() ? 'Show less' : 'Show full abstract' }}
          </button>
        }
      } @else {
        <p class="abstract muted">No abstract available.</p>
      }

      <footer>
        <span class="chip">{{ type() }}</span>
        @if (work().citationCount) {
          <span class="chip">{{ work().citationCount }} citations</span>
        }
        @if (work().language?.name; as lang) {
          <span class="chip">{{ lang }}</span>
        }
        <span class="spacer"></span>
        @for (l of links(); track l.url) {
          <a class="action" [href]="l.url" target="_blank" rel="noopener">{{ l.label }}</a>
        }
      </footer>
    </article>
  `,
  styleUrl: './paper-card.scss',
})
export class PaperCard {
  readonly work = input.required<CoreWork>();
  readonly highlight = input<readonly string[]>([]);
  protected readonly expanded = signal(false);
  protected readonly readingList = inject(ReadingListService);
  protected readonly saved = computed(() => this.readingList.has(this.work().id));

  protected readonly title = computed(() => cleanText(this.work().title) || 'Untitled');
  protected readonly authors = computed(() => authorsLabel(this.work()));
  protected readonly year = computed(() => workYear(this.work()));
  protected readonly venue = computed(() => venueLabel(this.work()));
  protected readonly abstract = computed(() => cleanText(this.work().abstract));
  protected readonly type = computed(() => documentTypeLabel(this.work()));
  protected readonly links = computed(() => workLinks(this.work()));
  protected readonly coreUrl = computed(() => `https://core.ac.uk/works/${this.work().id}`);
}
