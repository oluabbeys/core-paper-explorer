import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { validateQuery } from '../core/boolean-query';
import { signed } from '../core/compare';
import { CompareStore } from '../core/compare.store';
import { LineChart, LineSeries } from './line-chart';

@Component({
  selector: 'app-compare-view',
  imports: [FormsModule, DecimalPipe, LineChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './compare-view.html',
  styleUrl: './compare-view.scss',
})
export class CompareView {
  protected readonly store = inject(CompareStore);
  /** Ask the shell to open the normal search view for a query. */
  readonly searchFor = output<string>();

  protected readonly a = this.store.draftA;
  protected readonly b = this.store.draftB;
  protected readonly showTable = signal(false);
  protected readonly signed = signed;

  protected readonly validA = computed(() => validateQuery(this.a()));
  protected readonly validB = computed(() => validateQuery(this.b()));
  protected readonly canCompare = computed(() => this.validA().valid && this.validB().valid && !this.store.loading());

  protected readonly examples: [string, string][] = [
    ['drone delivery', 'robot delivery'],
    ['solar energy', 'wind energy'],
    ['machine learning', 'deep learning'],
    ['malaria vaccine', 'malaria treatment'],
  ];

  protected readonly labels = computed(() => this.store.years().map(String));
  protected readonly chartSeries = computed<LineSeries[]>(() =>
    (this.store.series() ?? []).map((s) => ({ name: s.query, values: s.values })),
  );

  protected submit(): void {
    if (this.canCompare()) this.store.compare(this.a(), this.b());
  }

  protected useExample([x, y]: [string, string]): void {
    this.a.set(x);
    this.b.set(y);
    this.submit();
  }

  protected swap(): void {
    const x = this.a();
    this.a.set(this.b());
    this.b.set(x);
  }
}
