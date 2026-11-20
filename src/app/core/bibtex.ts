import { CoreWork } from './models';
import { authorNames, cleanText, venueLabel, workYear } from './work-utils';

/** Escape characters that have special meaning in BibTeX/LaTeX. */
function esc(s: string): string {
  return s.replace(/\\/g, '\\textbackslash{}').replace(/([{}&%$#_])/g, '\\$1').replace(/~/g, '\\textasciitilde{}');
}

function ascii(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '');
}

/** "Doe" from "Jane Doe" or "Doe, Jane". */
function lastName(name: string): string {
  const n = name.trim();
  if (n.includes(',')) return n.split(',')[0].trim();
  const parts = n.split(/\s+/);
  return parts[parts.length - 1] ?? n;
}

/** Citation key like `doe2021drone`; de-duplicated with a/b/c suffixes. */
function citationKey(w: CoreWork, used: Set<string>): string {
  const author = ascii(lastName(authorNames(w)[0] ?? 'anon')).toLowerCase() || 'anon';
  const year = workYear(w) ?? 'nd';
  const firstWord =
    cleanText(w.title)
      .split(/\s+/)
      .map((t) => ascii(t).toLowerCase())
      .find((t) => t.length > 3 && !['with', 'from', 'that', 'this', 'into', 'over'].includes(t)) ?? 'paper';
  const base = `${author}${year}${firstWord}`;
  let key = base;
  for (let i = 0; used.has(key); i++) key = base + String.fromCharCode(97 + (i % 26)) + (i >= 26 ? i : '');
  used.add(key);
  return key;
}

function entryType(w: CoreWork): string {
  const t = (w.documentType ?? '').toLowerCase();
  if (t.includes('thesis')) return 'phdthesis';
  if (w.journals?.[0]?.title) return 'article';
  return 'misc';
}

export function toBibtex(works: readonly CoreWork[]): string {
  const used = new Set<string>();
  return works
    .map((w) => {
      const type = entryType(w);
      const fields: [string, string | number | null | undefined][] = [
        ['title', cleanText(w.title) || 'Untitled'],
        ['author', authorNames(w).join(' and ') || undefined],
        ['year', workYear(w)],
        [type === 'article' ? 'journal' : type === 'phdthesis' ? 'school' : 'publisher', venueLabel(w) || undefined],
        ['doi', w.doi?.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')],
        ['url', w.downloadUrl || `https://core.ac.uk/works/${w.id}`],
        ['note', `CORE ID ${w.id}`],
      ];
      const body = fields
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `  ${k} = {${k === 'url' || k === 'doi' ? String(v) : esc(String(v))}}`)
        .join(',\n');
      return `@${type}{${citationKey(w, used)},\n${body}\n}`;
    })
    .join('\n\n');
}
