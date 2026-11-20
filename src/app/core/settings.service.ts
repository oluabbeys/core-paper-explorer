import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { safeStorage } from './storage';

const KEY_API = 'cpe.apiKey';
const KEY_RECENT = 'cpe.recent';
const MAX_RECENT = 6;

/**
 * API keys copied from emails or web pages often carry invisible characters
 * (zero-width spaces, non-breaking spaces, line breaks). Browsers refuse to send
 * a header containing them, which surfaces as a network error, so keep only
 * printable ASCII.
 */
export function cleanApiKey(raw: string): string {
  return (raw ?? '').replace(/[^\x21-\x7E]/g, '');
}

/** User preferences persisted in localStorage: CORE API key and recent searches. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly apiKey = signal<string>(cleanApiKey(safeStorage.get(KEY_API, '')));
  readonly recent = signal<string[]>(safeStorage.get<string[]>(KEY_RECENT, []));

  constructor() {
    effect(() => {
      const k = cleanApiKey(this.apiKey());
      if (k) safeStorage.set(KEY_API, k);
      else safeStorage.remove(KEY_API);
    });
    effect(() => safeStorage.set(KEY_RECENT, this.recent()));
  }

  remember(query: string): void {
    const q = query.trim();
    if (!q) return;
    this.recent.update((list) => [q, ...list.filter((x) => x !== q)].slice(0, MAX_RECENT));
  }

  clearRecent(): void {
    this.recent.set([]);
  }
}

/** Adds `Authorization: Bearer <key>` to CORE requests when the user has saved an API key. */
export const apiKeyInterceptor: HttpInterceptorFn = (req, next) => {
  const key = cleanApiKey(inject(SettingsService).apiKey());
  const isCore = req.url.includes('/v3/');
  return key && isCore ? next(req.clone({ setHeaders: { Authorization: `Bearer ${key}` } })) : next(req);
};
