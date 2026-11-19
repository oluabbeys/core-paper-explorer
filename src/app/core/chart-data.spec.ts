import { aggregate } from './chart-data';
import { CoreWork } from './models';

const w = (id: number, over: Partial<CoreWork>): CoreWork => ({ id, ...over });

describe('chart aggregation', () => {
  it('builds a continuous year axis with gaps filled and counts missing years', () => {
    const s = aggregate([w(1, { yearPublished: 2018 }), w(2, { yearPublished: 2020 }), w(3, { yearPublished: 2020 }), w(4, {})], 'year');
    expect(s.data.map((d) => [d.label, d.value])).toEqual([
      ['2018', 1],
      ['2019', 0],
      ['2020', 2],
    ]);
    expect(s.missing).toBe(1);
    expect(s.data[0].filter).toBe('year:2018');
  });

  it('falls back to publishedDate and buckets wide spans', () => {
    const s = aggregate([w(1, { publishedDate: '1955-02-01' }), w(2, { yearPublished: 2024 })], 'year');
    expect(s.data[0]).toMatchObject({ label: '1950s', value: 1, filter: 'year:1950-1959' });
    expect(s.data.at(-1)).toMatchObject({ label: '2020s', value: 1 });
  });

  it('ranks categories, folds the tail into Other and creates click filters', () => {
    const works = ['research', 'research', 'thesis', 'slides', null].map((t, i) => w(i, { documentType: t }));
    const s = aggregate(works, 'type', 2);
    expect(s.data.map((d) => [d.label, d.value])).toEqual([
      ['Research', 2],
      ['Slides', 1],
      ['Other (2)', 2],
    ]);
    expect(s.data[0].filter).toBe('type:"Research"');
    expect(s.data[2].filter).toBeNull();
  });

  it('counts each author once per paper and never adds Other for authors', () => {
    const works = [
      w(1, { authors: [{ name: 'A' }, { name: 'A' }, { name: 'B' }] }),
      w(2, { authors: [{ name: 'A' }, { name: 'C' }] }),
    ];
    const s = aggregate(works, 'authors', 2);
    expect(s.data.map((d) => [d.label, d.value])).toEqual([
      ['A', 2],
      ['B', 1],
    ]);
  });
});
