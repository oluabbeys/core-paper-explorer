import { TopicData, buildSeries, growth, hasAllExact, peakYear, sampleShares, verdict, yearWindow } from './compare';

const years = yearWindow(2026, 4); // 2022–2025

describe('compare helpers', () => {
  it('uses the last complete years', () => {
    expect(years).toEqual([2022, 2023, 2024, 2025]);
  });

  it('computes sample shares as a percentage of the whole sample', () => {
    const works = [2022, 2025, 2025, 2019].map((y, i) => ({ id: i, yearPublished: y }));
    expect(sampleShares(works, years)).toEqual([25, 0, 0, 50]);
    expect(sampleShares([], years)).toEqual([0, 0, 0, 0]);
  });

  it('computes growth between halves and the peak year', () => {
    expect(growth([10, 10, 15, 15])).toBe(50);
    expect(growth([0, 0, 5, 5])).toBeNull();
    expect(peakYear([1, 4, 4, 2], years)).toBe(2023);
    expect(peakYear([0, 0, 0, 0], years)).toBeNull();
  });

  it('builds exact series and writes a verdict', () => {
    const a: TopicData = { query: 'drone delivery', total: 3000, sample: [], exact: { 2022: 100, 2023: 100, 2024: 200, 2025: 200 } };
    const b: TopicData = { query: 'robot delivery', total: 1000, sample: [], exact: { 2022: 50, 2023: 50, 2024: 60, 2025: 60 } };
    expect(hasAllExact(a, years)).toBe(true);
    const sa = buildSeries(a, years, true);
    const sb = buildSeries(b, years, true);
    expect(sa.values).toEqual([100, 100, 200, 200]);
    expect(sa.growth).toBe(100);
    expect(verdict(sa, sb, years)).toBe(
      '“drone delivery” has 3.0× as many papers as “robot delivery”. “drone delivery” grew faster in 2024–25 (+100% vs +20%).',
    );
  });

  it('handles empty topics', () => {
    const empty: TopicData = { query: 'x', total: 0, sample: [], exact: {} };
    const s = buildSeries(empty, years, false);
    expect(verdict(s, { ...s, query: 'y' }, years)).toContain('Neither topic');
  });
});
