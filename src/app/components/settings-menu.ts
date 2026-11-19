import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../core/settings.service';

@Component({
  selector: 'app-settings-menu',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="toggle" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-controls="settings-pop">
      ⚙ Settings
      @if (settings.apiKey()) {
        <span class="dot" title="API key set"></span>
      }
    </button>
    @if (open()) {
      <div id="settings-pop" class="pop" role="dialog" aria-label="Settings">
        <label for="apikey">CORE API key <span class="opt">(optional)</span></label>
        <input
          id="apikey"
          type="password"
          autocomplete="off"
          placeholder="Paste your key"
          [ngModel]="settings.apiKey()"
          (ngModelChange)="settings.apiKey.set($event)"
        />
        <p>
          Without a key CORE applies strict rate limits. Get a free key at
          <a href="https://core.ac.uk/services/api" target="_blank" rel="noopener">core.ac.uk/services/api</a>.
          It is stored only in this browser.
        </p>
        <div class="row">
          @if (settings.recent().length) {
            <button type="button" class="ghost" (click)="settings.clearRecent()">Clear recent searches</button>
          }
          <button type="button" class="ghost" (click)="open.set(false)">Close</button>
        </div>
      </div>
    }
  `,
  styles: `
    :host { position: relative; }
    .toggle { display: inline-flex; align-items: center; gap: .35rem; border: 1px solid var(--border); background: var(--bg); border-radius: 8px; padding: .4rem .7rem; cursor: pointer; font-size: .82rem; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #16a34a; }
    .pop { position: absolute; right: 0; top: calc(100% + .4rem); width: min(340px, 90vw); z-index: 10; background: var(--surface);
      border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 10px 30px rgba(0,0,0,.15); padding: 1rem;
      display: flex; flex-direction: column; gap: .5rem; font-size: .82rem; }
    label { font-weight: 600; }
    .opt { font-weight: 400; color: var(--muted); }
    input { padding: .45rem .6rem; border-radius: 8px; border: 1px solid var(--border-strong); background: var(--bg); }
    p { margin: 0; color: var(--muted); line-height: 1.45; }
    a { color: var(--accent); }
    .row { display: flex; justify-content: flex-end; gap: .4rem; }
    .ghost { border: 1px solid var(--border-strong); background: none; border-radius: 8px; padding: .3rem .6rem; cursor: pointer; font-size: .78rem; }
  `,
})
export class SettingsMenu {
  protected readonly settings = inject(SettingsService);
  protected readonly open = signal(false);
}
