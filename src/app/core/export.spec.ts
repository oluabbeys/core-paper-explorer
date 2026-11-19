import { slugify, toCsv } from './export';

describe('CSV export', () => {
  it('quotes cells, escapes quotes and guards against formula injection', () => {
    const csv = toCsv([{ id: 7, title: 'He said "hi"', authors: [{ name: '=cmd()' }, { name: 'B' }], yearPublished: 2020 }]);
    const [header, row] = csv.split('\r\n');
    expect(header.startsWith('"CORE ID","Title"')).toBe(true);
    expect(row).toContain('"He said ""hi"""');
    expect(row).toContain(`"'=cmd(); B"`);
    expect(row).toContain('"https://core.ac.uk/works/7"');
  });

  it('slugifies queries for file names', () => {
    expect(slugify('(drone AND (package OR delivery))')).toBe('drone-and-package-or-delivery');
  });
});
