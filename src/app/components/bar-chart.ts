import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ChartDatum } from '../core/chart-data';

interface Bar {
  d: ChartDatum;
  x: number;
  y: number;
  w: number;
  h: number;
  path: string;
  showLabel: boolean;
}

/**
 * Dependency-free bar chart.
 *  - vertical: SVG columns on a continuous axis (years)
 *  - horizontal: HTML rows for categories (labels wrap and stay readable)
 * Every bar has a hover/focus tooltip and can be clicked (or Enter-ed) to filter.
 */
@Component({
  selector: 'app-bar-chart',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.scss',
})
export class BarChart {
  readonly data = input.required<ChartDatum[]>();
  readonly orientation = input<'vertical' | 'horizontal'>('vertical');
  readonly unit = input('papers');
  readonly ariaLabel = input('Bar chart');
  readonly select = output<ChartDatum>();

  protected readonly hovered = signal<Bar | null>(null);

  // Geometry for the vertical chart (SVG user units; the SVG scales to its container).
  protected readonly W = 360;
  protected readonly H = 210;
  protected readonly M = { top: 12, right: 6, bottom: 26, left: 30 };
  protected readonly plotW = this.W - this.M.left - this.M.right;
  protected readonly plotH = this.H - this.M.top - this.M.bottom;

  protected readonly max = computed(() => Math.max(1, ...this.data().map((d) => d.value)));

  /** 3–5 "nice" integer ticks. */
  protected readonly ticks = computed(() => {
    const max = this.max();
    const raw = max / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10);
    const top = Math.ceil(max / step) * step;
    const out: number[] = [];
    for (let v = 0; v <= top; v += step) out.push(v);
    return out;
  });
  protected readonly scaleMax = computed(() => this.ticks().at(-1) ?? this.max());

  protected readonly bars = computed<Bar[]>(() => {
    const data = this.data();
    const n = data.length || 1;
    const band = this.plotW / n;
    const gap = Math.max(2, band * 0.22);
    const w = Math.max(1, band - gap);
    const labelEvery = Math.ceil(n / 8);
    const yScale = (v: number) => (v / this.scaleMax()) * this.plotH;
    return data.map((d, i) => {
      const h = yScale(d.value);
      const x = this.M.left + i * band + gap / 2;
      const y = this.M.top + this.plotH - h;
      return { d, x, y, w, h, path: roundedTop(x, y, w, h, Math.min(4, w / 2)), showLabel: i % labelEvery === 0 };
    });
  });

  protected y(v: number): number {
    return this.M.top + this.plotH - (v / this.scaleMax()) * this.plotH;
  }

  protected pct(v: number): number {
    return (v / this.max()) * 100;
  }

  protected tooltipLeft(b: Bar): number {
    return ((b.x + b.w / 2) / this.W) * 100;
  }

  protected tooltipTop(b: Bar): number {
    return (b.y / this.H) * 100;
  }

  protected choose(d: ChartDatum): void {
    if (d.filter && d.value > 0) this.select.emit(d);
  }
}

/** Column with 4px rounded top corners anchored to a square baseline. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  const rr = Math.min(r, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}
