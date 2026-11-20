import { CoreWork } from './models';
import { workYear } from './work-utils';

/** Pure helpers for the "Compare topics" view. */

export interface TopicData {
  query: string;
  /** Exact number of CORE papers matching the topic. */
  total: number;
  /** The most relevant papers (up to 100), used for the quick trend. */
  sample: CoreWork[];
  /** Exact paper count per year, filled in on demand. */
  exact: Record<number, number>;
}

export interface TopicSeries {
  query: string;
  values: number[];
  total: number;
  peakYear: number | null;
  /** % change between the second and first half of the window (null if no base). */
  growth: number | null;
}

/** The last `n` complete years, oldest first (the current year is still in progress). */
export function yearWindow(currentYear: number, n = 10): number[] {
  const end = currentYear - 1;
  return Array.from({ length: n }, (_, i) => end - n + 1 + i);
}

/** Share (%) of a topic's sample published in each year. */
export function sampleShares(works: readonly CoreWork[], years: readonly number[]): number[] {
  if (!works.length) return years.map(() => 0);
  const counts = new Map<number, number>();
  for (const w of works) {
    const y = workYear(w);
    if (y != null) counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  return years.map((y) => round1(((counts.get(y) ?? 0) / works.length) * 100));
}

export function hasAllExact(t: TopicData, years: readonly number[]): boolean {
  return years.every((y) => t.exact[y] != null);
}

export function growth(values: readonly number[]): number | null {
  const half = Math.floor(values.length / 2);
  const first = values.slice(0, half).reduce((a, b) => a + b, 0);
  const second = values.slice(values.length - half).reduce((a, b) => a + b, 0);
  if (!first) return null;
  return Math.round(((second - first) / first) * 100);
}

export function peakYear(values: readonly number[], years: readonly number[]): number | null {
  let best = -1;
  let year: number | null = null;
  values.forEach((v, i) => {
    if (v > best && v > 0) {
      best = v;
      year = years[i];
    }
  });
  return year;
}

export function buildSeries(t: TopicData, years: readonly number[], exact: boolean): TopicSeries {
  const values = exact ? years.map((y) => t.exact[y] ?? 0) : sampleShares(t.sample, years);
  return { query: t.query, values, total: t.total, peakYear: peakYear(values, years), growth: growth(values) };
}

/** One plain-English sentence summarising the comparison. */
export function verdict(a: TopicSeries, b: TopicSeries, years: readonly number[]): string {
  if (!a.total && !b.total) return 'Neither topic has matching papers in CORE.';
  const [big, small] = a.total >= b.total ? [a, b] : [b, a];
  const ratio = small.total ? big.total / small.total : Infinity;
  const size =
    ratio === Infinity
      ? `Only “${big.query}” has matching papers.`
      : ratio < 1.1
        ? `Both topics have a similar number of papers.`
        : `“${big.query}” has ${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× as many papers as “${small.query}”.`;

  const half = Math.floor(years.length / 2);
  const span = `${years[years.length - half]}–${String(years[years.length - 1]).slice(2)}`;
  if (a.growth == null || b.growth == null) return size;
  const [fast, slow] = a.growth >= b.growth ? [a, b] : [b, a];
  if (Math.abs(fast.growth! - slow.growth!) < 5) return `${size} Both grew at a similar pace in ${span}.`;
  return `${size} “${fast.query}” grew faster in ${span} (${signed(fast.growth!)} vs ${signed(slow.growth!)}).`;
}

export const signed = (n: number) => `${n > 0 ? '+' : ''}${n}%`;
const round1 = (n: number) => Math.round(n * 10) / 10;
