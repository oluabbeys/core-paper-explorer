export type PageItem = number | 'gap';

/**
 * Page numbers to show in the pager, with 'gap' for the "…" between them.
 *
 *   near the start:  1 2 3 4 5 6 7 8 … 1000
 *   in the middle:   1 … 48 49 50 51 52 … 1000
 *   near the end:    1 … 993 994 995 996 997 998 999 1000
 *
 * Always at most `slots` items, so the pager width stays stable while paging.
 */
export function pageItems(current: number, total: number, slots = 10): PageItem[] {
  if (total <= 0) return [];
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (total <= slots) return range(1, total);

  const page = Math.min(Math.max(1, current), total);
  const edge = slots - 2; // pages shown next to a single gap (e.g. 8 when slots = 10)
  if (page <= edge - 2) return [...range(1, edge), 'gap', total];
  if (page >= total - edge + 3) return [1, 'gap', ...range(total - edge + 1, total)];

  const side = Math.floor((slots - 5) / 2); // pages either side of the current one
  return [1, 'gap', ...range(page - side, page + side), 'gap', total];
}
