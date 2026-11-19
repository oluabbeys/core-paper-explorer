import { Pipe, PipeTransform } from '@angular/core';

export interface Segment {
  text: string;
  hit: boolean;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Split text into plain/highlighted segments. Rendering segments (instead of
 * injecting <mark> via innerHTML) keeps the template XSS-safe.
 */
export function highlightSegments(text: string, terms: readonly string[]): Segment[] {
  if (!text) return [];
  const patterns = terms
    .map((t) => t.trim())
    .filter((t) => t.length > 1)
    .sort((a, b) => b.length - a.length)
    .map((t) => {
      const prefix = t.endsWith('*');
      const body = escapeRe(prefix ? t.slice(0, -1) : t).replace(/\s+/g, '\\s+');
      return prefix ? `${body}[\\p{L}\\p{N}]*` : body;
    });
  if (!patterns.length) return [{ text, hit: false }];

  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${patterns.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), hit: false });
    out.push({ text: m[0], hit: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out;
}

@Pipe({ name: 'highlight' })
export class HighlightPipe implements PipeTransform {
  transform(text: string | null | undefined, terms: readonly string[] = []): Segment[] {
    return highlightSegments(text ?? '', terms);
  }
}
