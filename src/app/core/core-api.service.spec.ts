import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CORE_API_BASE, CoreApiService } from './core-api.service';

describe('CoreApiService', () => {
  let api: CoreApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: CORE_API_BASE, useValue: '/api' }],
    });
    api = TestBed.inject(CoreApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends q/limit/offset and normalises the response', () => {
    let total = -1;
    api.searchWorks({ query: ' (drone) ', limit: 25, offset: 0 }).subscribe((r) => (total = r.totalHits));
    const req = http.expectOne((r) => r.url === '/api/search/works');
    expect(req.request.params.get('q')).toBe('(drone)');
    expect(req.request.params.get('limit')).toBe('25');
    req.flush({ totalHits: 42, limit: 25, offset: 0, results: [{ id: 1, title: 'A' }, null] });
    expect(total).toBe(42);
  });

  it('clamps limit to the CORE maximum of 100', () => {
    api.searchWorks({ query: 'x', limit: 5000, offset: 0 }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/search/works');
    expect(req.request.params.get('limit')).toBe('100');
    req.flush({ totalHits: 0, results: [] });
  });

  it('serves repeated queries from cache', () => {
    api.searchWorks({ query: 'cache', limit: 10, offset: 0 }).subscribe();
    http.expectOne(() => true).flush({ totalHits: 1, results: [{ id: 1 }] });
    api.searchWorks({ query: 'cache', limit: 10, offset: 0 }).subscribe();
    http.expectNone(() => true);
  });

  it('maps 429 to a friendly rate-limit message', () => {
    let msg = '';
    api.searchWorks({ query: 'x', limit: 10, offset: 0 }).subscribe({ error: (e: Error) => (msg = e.message) });
    http.expectOne(() => true).flush({ message: 'Too many' }, { status: 429, statusText: 'Too Many Requests' });
    expect(msg).toContain('rate limit');
  });

  it('includes the reset time from X-RateLimit-Retry-After', () => {
    let msg = '';
    api.searchWorks({ query: 'y', limit: 10, offset: 0 }).subscribe({ error: (e: Error) => (msg = e.message) });
    http.expectOne(() => true).flush('', {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'X-RateLimit-Retry-After': '2026-11-20T03:09:06+0000' },
    });
    expect(msg).toMatch(/paused until \d{1,2}:\d{2}/);
  });
});
