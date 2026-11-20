import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CORE_API_BASE } from './core-api.service';
import { CompareStore } from './compare.store';

describe('CompareStore', () => {
  let store: CompareStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: CORE_API_BASE, useValue: '/api' }],
    });
    store = TestBed.inject(CompareStore);
    store.years.set([2024, 2025]);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('fetches both topics one after another, then exact yearly counts', () => {
    store.compare('drone', 'robot');
    const first = http.expectOne((r) => r.params.get('q') === 'drone');
    expect(first.request.params.get('limit')).toBe('100');
    first.flush({ totalHits: 300, results: [{ id: 1, yearPublished: 2025 }] });
    http.expectOne((r) => r.params.get('q') === 'robot').flush({ totalHits: 100, results: [{ id: 2, yearPublished: 2024 }] });

    expect(store.loading()).toBe(false);
    expect(store.isExact()).toBe(false);
    expect(store.series()![0].values).toEqual([0, 100]); // % of sample
    expect(store.summary()).toContain('3.0×');

    store.loadExact();
    const counts: Record<string, number> = {
      '(drone) AND yearPublished:2024': 40,
      '(drone) AND yearPublished:2025': 60,
      '(robot) AND yearPublished:2024': 20,
      '(robot) AND yearPublished:2025': 10,
    };
    for (let i = 0; i < 4; i++) {
      const req = http.expectOne(() => true);
      req.flush({ totalHits: counts[req.request.params.get('q')!], results: [] });
    }
    expect(store.isExact()).toBe(true);
    expect(store.series()!.map((s) => s.values)).toEqual([
      [40, 60],
      [20, 10],
    ]);
    expect(store.exactDone()).toBe(4);
  });

  it('keeps partial exact counts when a request fails', () => {
    store.compare('a', 'b');
    http.expectOne(() => true).flush({ totalHits: 1, results: [] });
    http.expectOne(() => true).flush({ totalHits: 1, results: [] });
    store.loadExact();
    http.expectOne(() => true).flush({ totalHits: 5, results: [] });
    http.expectOne(() => true).flush('', { status: 429, statusText: 'Too Many Requests' });
    expect(store.exactError()).toContain('Stopped part-way');
    expect(store.topics()![0].exact[2024]).toBe(5);
    expect(store.isExact()).toBe(false);
  });
});
