import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ChartDatum, ChartDimension, DIMENSIONS } from '../core/chart-data';
import { SearchStore } from '../core/search.store';
import { BarChart } from './bar-chart';

@Component({
  selector: 'app-chart-panel',
  imports: [BarChart, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chart-panel.html',
  styleUrl: './chart-panel.scss',
})
export class ChartPanel {
  protected readonly store = inject(SearchStore);
  protected readonly dimensions = DIMENSIONS;
  protected readonly showTable = signal(false);
  protected readonly sampleSize = 500;

  protected readonly dimensionLabel = computed(
    () => DIMENSIONS.find((d) => d.id === this.store.chartDimension())?.label ?? '',
  );
  protected readonly hasData = computed(() => this.store.chart().data.some((d) => d.value > 0));
  protected readonly canSample = computed(
    () => this.store.totalHits() > this.store.count() && !this.store.sampleLoading(),
  );

  protected setDimension(id: string): void {
    this.store.chartDimension.set(id as ChartDimension);
  }

  protected onSelect(d: ChartDatum): void {
    if (d.filter) this.store.addFilterClause(d.filter);
  }
}
