import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CoreWork } from '../core/models';
import { authorsLabel, cleanText, documentTypeLabel, venueLabel, workLinks, workYear } from '../core/work-utils';

@Component({
  selector: 'app-paper-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card">
      <header>
        <h3 class="title">
          <a [href]="coreUrl()" target="_blank" rel="noopener">{{ title() }}</a>
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
        <p class="abstract" [class.open]="expanded()">{{ abstract() }}</p>
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
  protected readonly expanded = signal(false);

  protected readonly title = computed(() => cleanText(this.work().title) || 'Untitled');
  protected readonly authors = computed(() => authorsLabel(this.work()));
  protected readonly year = computed(() => workYear(this.work()));
  protected readonly venue = computed(() => venueLabel(this.work()));
  protected readonly abstract = computed(() => cleanText(this.work().abstract));
  protected readonly type = computed(() => documentTypeLabel(this.work()));
  protected readonly links = computed(() => workLinks(this.work()));
  protected readonly coreUrl = computed(() => `https://core.ac.uk/works/${this.work().id}`);
}
