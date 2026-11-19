import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SettingsService, apiKeyInterceptor } from './settings.service';

describe('SettingsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([apiKeyInterceptor])), provideHttpClientTesting()],
    });
  });

  it('keeps the six most recent unique searches, newest first', () => {
    const s = TestBed.inject(SettingsService);
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'b'].forEach((q) => s.remember(q));
    expect(s.recent()).toEqual(['b', 'g', 'f', 'e', 'd', 'c']);
  });

  it('adds a Bearer token to CORE requests only when a key is set', () => {
    const s = TestBed.inject(SettingsService);
    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);

    http.get('/v3/search/works').subscribe();
    expect(ctrl.expectOne('/v3/search/works').request.headers.has('Authorization')).toBe(false);

    s.apiKey.set('secret');
    http.get('/v3/search/works').subscribe();
    expect(ctrl.expectOne('/v3/search/works').request.headers.get('Authorization')).toBe('Bearer secret');

    http.get('/other').subscribe();
    expect(ctrl.expectOne('/other').request.headers.has('Authorization')).toBe(false);
    ctrl.verify();
  });
});
