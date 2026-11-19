import { CoreWork } from './models';

/** Helpers that turn sparse CORE records into display-ready values. */

export function authorNames(w: CoreWork): string[] {
  return (w.authors ?? []).map((a) => (a?.name ?? '').trim()).filter(Boolean);
}

export function authorsLabel(w: CoreWork, max = 3): string {
  const names = authorNames(w);
  if (!names.length) return 'Unknown authors';
  return names.length > max ? `${names.slice(0, max).join(', ')} +${names.length - max} more` : names.join(', ');
}

export function workYear(w: CoreWork): number | null {
  if (w.yearPublished && w.yearPublished > 1000) return w.yearPublished;
  const m = w.publishedDate?.match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}

/** Abstracts often contain stray HTML/JATS tags and whitespace. */
export function cleanText(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function documentTypeLabel(w: CoreWork): string {
  const t = (w.documentType ?? '').trim();
  if (!t) return 'Unspecified';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function venueLabel(w: CoreWork): string {
  return (w.journals?.[0]?.title || w.publisher || w.dataProviders?.[0]?.name || '').trim();
}

export interface WorkLink {
  label: string;
  url: string;
}

export function workLinks(w: CoreWork): WorkLink[] {
  const links: WorkLink[] = [];
  if (w.downloadUrl) links.push({ label: 'PDF / full text', url: w.downloadUrl });
  if (w.doi) links.push({ label: 'DOI', url: `https://doi.org/${w.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}` });
  links.push({ label: 'View on CORE', url: `https://core.ac.uk/works/${w.id}` });
  return links;
}
