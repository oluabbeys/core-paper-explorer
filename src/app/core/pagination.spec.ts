import { pageItems } from './pagination';

describe('pageItems', () => {
  it('lists every page when they fit', () => {
    expect(pageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(1, 0)).toEqual([]);
  });

  it('shows the first pages then the last near the start', () => {
    expect(pageItems(1, 1000)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 'gap', 1000]);
    expect(pageItems(6, 1000)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 'gap', 1000]);
  });

  it('centres the current page in the middle', () => {
    expect(pageItems(50, 1000)).toEqual([1, 'gap', 48, 49, 50, 51, 52, 'gap', 1000]);
    expect(pageItems(7, 1000)).toEqual([1, 'gap', 5, 6, 7, 8, 9, 'gap', 1000]);
  });

  it('shows the last pages near the end', () => {
    expect(pageItems(1000, 1000)).toEqual([1, 'gap', 993, 994, 995, 996, 997, 998, 999, 1000]);
    expect(pageItems(996, 1000)).toEqual([1, 'gap', 993, 994, 995, 996, 997, 998, 999, 1000]);
  });

  it('never repeats a page or exceeds the slot count', () => {
    for (const total of [11, 12, 15, 40]) {
      for (let p = 1; p <= total; p++) {
        const items = pageItems(p, total);
        const nums = items.filter((i) => i !== 'gap') as number[];
        expect(new Set(nums).size).toBe(nums.length);
        expect(nums).toContain(p);
        expect(items.length).toBeLessThanOrEqual(10);
        expect(nums).toEqual([...nums].sort((a, b) => a - b));
      }
    }
  });
});
