import { CoreWork } from './models';
import { evaluate, highlightTerms, parseQuery, tokenize, validateQuery } from './boolean-query';
import { highlightSegments } from './highlight';

const work = (over: Partial<CoreWork>): CoreWork => ({ id: Math.random(), ...over });

const papers = {
  droneDelivery: work({
    title: 'Drone-based package delivery in urban areas',
    abstract: 'We study last-mile logistics using UAVs.',
    authors: [{ name: 'Ada Okafor' }],
    yearPublished: 2021,
    documentType: 'research',
  }),
  droneSurvey: work({
    title: 'Drone imagery for crop monitoring',
    abstract: 'Agricultural remote sensing.',
    authors: [{ name: 'José García' }],
    yearPublished: 2016,
    documentType: 'thesis',
  }),
  robots: work({ title: 'Warehouse robots and parcel delivery', yearPublished: 2019 }),
};
const all = Object.values(papers);
const run = (q: string) => all.filter((w) => evaluate(parseQuery(q), w));

describe('boolean query parser', () => {
  it('parses the brief example with nesting', () => {
    expect(parseQuery('(drone AND (package OR delivery))')).toEqual({
      kind: 'and',
      children: [
        { kind: 'term', field: null, op: ':', value: 'drone', phrase: false },
        {
          kind: 'or',
          children: [
            { kind: 'term', field: null, op: ':', value: 'package', phrase: false },
            { kind: 'term', field: null, op: ':', value: 'delivery', phrase: false },
          ],
        },
      ],
    });
  });

  it('treats adjacent terms as implicit AND and gives AND precedence over OR', () => {
    expect(parseQuery('a b OR c').kind).toBe('or');
    expect(parseQuery('a OR b c')).toMatchObject({ kind: 'or', children: [{ value: 'a' }, { kind: 'and' }] });
  });

  it('supports phrases, fields, comparators and field groups', () => {
    const toks = tokenize('title:"machine learning" yearPublished>=2020 -spam');
    expect(toks.map((t) => t.type)).toEqual(['term', 'term', 'not', 'term']);
    expect(parseQuery('authors:(smith OR jones)')).toMatchObject({
      kind: 'or',
      children: [{ field: 'authors', value: 'smith' }, { field: 'authors', value: 'jones' }],
    });
  });

  it.each([
    ['(drone AND delivery', 'Missing closing bracket'],
    ['drone AND', 'needs a search term'],
    ['OR drone', 'cannot start'],
    ['drone)', 'Unexpected closing bracket'],
    ['"unclosed phrase', 'Unclosed quotation'],
    ['()', 'Empty brackets'],
    ['title:', 'Missing value'],
  ])('rejects %s', (q, msg) => {
    const v = validateQuery(q);
    expect(v.valid).toBe(false);
    expect(v.error).toContain(msg);
  });

  it('warns about lowercase operators but still accepts the query', () => {
    const v = validateQuery('drone and delivery');
    expect(v.valid).toBe(true);
    expect(v.warnings[0]).toContain('UPPERCASE');
  });
});

describe('client-side evaluation', () => {
  it('matches the brief example', () => {
    expect(run('(drone AND (package OR delivery))')).toEqual([papers.droneDelivery]);
  });

  it('handles NOT, prefix wildcards and phrases', () => {
    expect(run('drone NOT crop')).toEqual([papers.droneDelivery]);
    expect(run('deliver*')).toEqual([papers.droneDelivery, papers.robots]);
    expect(run('"package delivery"')).toEqual([papers.droneDelivery]);
    expect(run('"delivery package"')).toEqual([]);
  });

  it('supports fields, year comparisons/ranges and accent-insensitive author search', () => {
    expect(run('author:garcia')).toEqual([papers.droneSurvey]);
    expect(run('year>2018')).toEqual([papers.droneDelivery, papers.robots]);
    expect(run('year:2015-2019')).toEqual([papers.droneSurvey, papers.robots]);
    expect(run('type:thesis')).toEqual([papers.droneSurvey]);
    expect(run('abstract:uavs')).toEqual([papers.droneDelivery]);
  });
});

describe('highlighting', () => {
  it('collects only positive text terms', () => {
    expect(highlightTerms(parseQuery('drone AND NOT crop AND year>2010 AND deliver*'))).toEqual(['drone', 'deliver*']);
  });

  it('splits text into segments on whole words', () => {
    const segs = highlightSegments('Drone delivery, drones and droned', ['drone', 'deliver*']);
    expect(segs.filter((s) => s.hit).map((s) => s.text)).toEqual(['Drone', 'delivery']);
  });
});
