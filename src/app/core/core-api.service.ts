import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { CoreSearchResponse, CoreWork, SearchParams } from './models';

/** Base URL for the CORE v3 API (overridable in tests). */
export const CORE_API_BASE = new InjectionToken<string>('CORE_API_BASE', {
  factory: () => environment.apiBase,
});

/** CORE caps page size at 100 works per request. */
export const MAX_LIMIT = 100;

@Injectable({ providedIn: 'root' })
export class CoreApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(CORE_API_BASE);

  /** Simple in-memory cache so repeated queries don't burn the API rate limit. */
  private readonly cache = new Map<string, CoreSearchResponse>();

  searchWorks({ query, limit, offset }: SearchParams): Observable<CoreSearchResponse> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_LIMIT);
    const params = new HttpParams()
      .set('q', query.trim())
      .set('limit', safeLimit)
      .set('offset', Math.max(0, Math.trunc(offset) || 0));

    const key = params.toString();
    const cached = this.cache.get(key);
    if (cached) return of(cached);

    // Note the trailing slash: CORE redirects /search/works to /search/works/ on
    // its own domain, and that cross-origin redirect is blocked by CORS.
    return this.http.get<Partial<CoreSearchResponse>>(`${this.base}/search/works/`, { params }).pipe(
      map((res) => normalizeResponse(res, safeLimit, offset)),
      tap((res) => this.cache.set(key, res)),
      catchError((err: HttpErrorResponse) => {
        console.error('[CORE API]', err.status, err.message, err.error);
        return throwError(() => new Error(describeError(err)));
      }),
    );
  }
}

function normalizeResponse(res: Partial<CoreSearchResponse>, limit: number, offset: number): CoreSearchResponse {
  const results = (res?.results ?? []).filter((w): w is CoreWork => !!w && w.id != null);
  return {
    totalHits: res?.totalHits ?? results.length,
    limit: res?.limit ?? limit,
    offset: res?.offset ?? offset,
    results,
    scrollId: res?.scrollId,
  };
}

/** Turn HTTP failures into a message a person can act on. */
export function describeError(err: HttpErrorResponse): string {
  const apiMsg = typeof err.error === 'object' && err.error?.message ? ` (${err.error.message})` : '';
  switch (err.status) {
    case 0:
      return 'Could not reach the CORE API. Check your connection (and that the dev server is still running), then try again. If this started after adding an API key, paste the key again under ⚙ Settings.';
    case 400:
      return `CORE could not understand that query${apiMsg}. Check brackets, quotes and AND/OR/NOT operators.`;
    case 401:
    case 403:
      return `The CORE API rejected the request${apiMsg}. If you set an API key, check that it is valid.`;
    case 429: {
      const retry = retryTime(err.headers?.get('x-ratelimit-retry-after'));
      const when = retry ? ` until ${retry}` : ' for a few minutes';
      return `CORE's rate limit has been reached, so new searches are paused${when}. Add a free CORE API key under ⚙ Settings for a much higher limit (previous results are still cached).`;
    }
    default:
      return err.status >= 500
        ? `CORE is having trouble right now (HTTP ${err.status}). Please try again shortly.`
        : `Request failed (HTTP ${err.status})${apiMsg}.`;
  }
}

/** Format CORE's `X-RateLimit-Retry-After` timestamp as a local time, e.g. "4:09 PM". */
function retryTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // CORE sends e.g. 2026-11-20T03:09:06+0000; add the colon some parsers need.
  const d = new Date(raw.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
