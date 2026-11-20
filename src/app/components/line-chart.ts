import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface LineSeries {
  name: string;
  values: number[];
}

interface Point {
  x: number;
  y: number;
  v: number;
}

/**
 * Dependency-free multi-series line chart (used by Compare topics).
 * Series are told apart by colour, line style (solid/dashed), a legend and
 * direct end labels, so identity never relies on colour alone. Hovering or
 * focusing a year shows a crosshair with every series' value.
 */
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './line-chart.html',
  styleUrl: './line-chart.scss',
})
export class LineChart {
  readonly labels = input.required<string[]>();
  readonly series = input.required<LineSeries[]>();
  readonly unit = input('');
  readonly ariaLabel = input('Line chart');

  protected readonly W = 900;
  protected readonly H = 300;
  protected readonly M = { top: 16, right: 140, bottom: 28, left: 48 };
  protected readonly plotW = this.W - this.M.left - this.M.right;
  protected readonly plotH = this.H - this.M.top - this.M.bottom;

  protected readonly hover = signal<number | null>(null);

  private readonly max = computed(() => Math.max(1, ...this.series().flatMap((s) => s.values)));

  protected readonly ticks = computed(() => {
    const max = this.max();
    const raw = max / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
    const top = Math.ceil(max / step) * step;
    const out: number[] = [];
    for (let v = 0; v <= top + step / 1000; v += step) out.push(+v.toFixed(6));
    return out;
  });
  private readonly top = computed(() => this.ticks().at(-1) ?? this.max());

  protected x(i: number): number {
    const n = this.labels().length;
    return this.M.left + (n <= 1 ? this.plotW / 2 : (i / (n - 1)) * this.plotW);
  }

  protected y(v: number): number {
    return this.M.top + this.plotH - (v / this.top()) * this.plotH;
  }

  protected readonly lines = computed(() =>
    this.series().map((s) => {
      const pts: Point[] = s.values.map((v, i) => ({ x: this.x(i), y: this.y(v), v }));
      return { name: s.name, pts, d: pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('') };
    }),
  );

  /** End-of-line labels, nudged apart so they never overlap. */
  protected readonly endLabels = computed(() => {
    const items = this.lines()
      .map((l, i) => ({ i, text: truncate(l.name, 16), y: l.pts.at(-1)?.y ?? 0 }))
      .sort((a, b) => a.y - b.y);
    for (let k = 1; k < items.length; k++) {
      if (items[k].y - items[k - 1].y < 14) items[k].y = items[k - 1].y + 14;
    }
    return items;
  });

  protected readonly band = computed(() => this.plotW / Math.max(1, this.labels().length - 1));

  protected fmt(v: number): string {
    return this.unit() === '%' ? `${v}%` : v.toLocaleString();
  }

  protected tooltipLeft(i: number): number {
    return (this.x(i) / this.W) * 100;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
