import { TestBed } from '@angular/core/testing';
import { ReadingListService } from './reading-list.service';

describe('ReadingListService', () => {
  beforeEach(() => localStorage.clear());

  it('toggles papers, keeps newest first and strips bulky fields', () => {
    const list = TestBed.inject(ReadingListService);
    list.toggle({ id: 1, title: 'A', fullText: 'x'.repeat(1000) } as never);
    list.toggle({ id: 2, title: 'B' });
    expect(list.works().map((w) => w.id)).toEqual([2, 1]);
    expect('fullText' in list.works()[1]).toBe(false);
    expect(list.has(1)).toBe(true);
    list.toggle({ id: 1 });
    expect(list.has(1)).toBe(false);
    expect(list.count()).toBe(1);
  });

  it('persists to localStorage', () => {
    const list = TestBed.inject(ReadingListService);
    list.toggle({ id: 9, title: 'Saved' });
    TestBed.tick();
    expect(localStorage.getItem('cpe.readingList')).toContain('"Saved"');
  });
});
