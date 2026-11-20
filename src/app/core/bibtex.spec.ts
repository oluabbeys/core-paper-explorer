import { toBibtex } from './bibtex';

describe('BibTeX export', () => {
  it('builds typed entries with unique keys and escaped fields', () => {
    const out = toBibtex([
      { id: 1, title: 'Drone delivery & routing', authors: [{ name: 'José García' }, { name: 'Doe, Jane' }], yearPublished: 2021, journals: [{ title: 'Robotics 50%' }], doi: 'https://doi.org/10.1/x' },
      { id: 2, title: 'Drone delivery revisited', authors: [{ name: 'Ana García' }], yearPublished: 2021, documentType: 'thesis' },
      { id: 3 },
    ]);
    expect(out).toContain('@article{garcia2021drone,');
    expect(out).toContain('title = {Drone delivery \\& routing}');
    expect(out).toContain('author = {José García and Doe, Jane}');
    expect(out).toContain('journal = {Robotics 50\\%}');
    expect(out).toContain('doi = {10.1/x}');
    expect(out).toContain('@phdthesis{garcia2021dronea,');
    expect(out).toContain('@misc{anonndpaper,');
    expect(out).toContain('url = {https://core.ac.uk/works/3}');
  });
});
