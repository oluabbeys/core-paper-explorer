import { CoreWork } from './models';
import { authorNames, documentTypeLabel, venueLabel, workYear } from './work-utils';

export type ChartDimension = 'year' | 'type' | 'authors' | 'venue' | 'language';

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
  /** Filter expression that selects exactly this bar (null for "Other"). */
  filter: string | null;
}

export interface ChartSeries {
  dimension: ChartDimension;
  orientation: 'vertical' | 'horizontal';
  data: ChartDatum[];
  /** Papers that have no value for this dimension (e.g. no year). */
  missing: number;
  total: number;
}

export const DIMENSIONS: { id: ChartDimension; label: string }[] = [
  { id: 'year', label: 'Publication year' },
  { id: 'type', label: 'Document type' },
  { id: 'authors', label: 'Top authors' },
  { id: 'venue', label: 'Top journals / publishers' },
  { id: 'language', label: 'Language' },
];

const quote = (s: string) => `"${s.replace(/"/g, '')}"`;

export function aggregate(works: readonly CoreWork[], dimension: ChartDimension, topN = 8): ChartSeries {
  return dimension === 'year' ? byYear(works) : byCategory(works, dimension, topN);
}

/** Continuous year axis (gaps filled with zero); wide spans are bucketed into 5/10-year bins. */
function byYear(works: readonly CoreWork[]): ChartSeries {
  const years = works.map(workYear);
  const known = years.filter((y): y is number => y != null);
  const series: ChartSeries = { dimension: 'year', orientation: 'vertical', data: [], missing: years.length - known.length, total: works.length };
  if (!known.length) return series;

  const min = Math.min(...known);
  const max = Math.max(...known);
  const span = max - min + 1;
  const size = span <= 25 ? 1 : span <= 60 ? 5 : 10;
  const start = Math.floor(min / size) * size;

  const counts = new Map<number, number>();
  for (const y of known) {
    const b = Math.floor(y / size) * size;
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  for (let b = start; b <= max; b += size) {
    const end = b + size - 1;
    const label = size === 1 ? String(b) : size === 10 ? `${b}s` : `${b}–${String(end).slice(2)}`;
    series.data.push({
      key: String(b),
      label,
      value: counts.get(b) ?? 0,
      filter: size === 1 ? `year:${b}` : `year:${b}-${end}`,
    });
  }
  return series;
}

function byCategory(works: readonly CoreWork[], dimension: Exclude<ChartDimension, 'year'>, topN: number): ChartSeries {
  const counts = new Map<string, number>();
  let missing = 0;

  for (const w of works) {
    const values = categoryValues(w, dimension);
    if (!values.length) missing++;
    // De-duplicate within one paper so an author listed twice is counted once.
    for (const v of new Set(values)) counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = sorted.slice(0, topN);
  const data: ChartDatum[] = top.map(([label, value]) => ({ key: label, label, value, filter: filterFor(dimension, label) }));

  // Authors overlap across papers, so an "Other" bucket would be meaningless there.
  const rest = sorted.slice(topN);
  if (rest.length && dimension !== 'authors') {
    data.push({ key: '__other', label: `Other (${rest.length})`, value: rest.reduce((s, [, v]) => s + v, 0), filter: null });
  }
  return { dimension, orientation: 'horizontal', data, missing, total: works.length };
}

function categoryValues(w: CoreWork, dimension: Exclude<ChartDimension, 'year'>): string[] {
  switch (dimension) {
    case 'type':
      return [documentTypeLabel(w)];
    case 'authors':
      return authorNames(w);
    case 'venue': {
      const v = venueLabel(w);
      return v ? [v] : [];
    }
    case 'language': {
      const l = w.language?.name || w.language?.code;
      return l ? [l] : [];
    }
  }
}

function filterFor(dimension: Exclude<ChartDimension, 'year'>, label: string): string | null {
  switch (dimension) {
    case 'type':
      return label === 'Unspecified' ? null : `type:${quote(label)}`;
    case 'authors':
      return `author:${quote(label)}`;
    case 'venue':
      return `venue:${quote(label)}`;
    case 'language':
      return `language:${quote(label)}`;
  }
}
