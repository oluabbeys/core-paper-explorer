import { CoreWork } from './models';
import { authorNames, cleanText, documentTypeLabel, venueLabel, workYear } from './work-utils';

const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  // Quote every cell; neutralise spreadsheet formula injection (=, +, -, @).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export function toCsv(works: readonly CoreWork[]): string {
  const header = ['CORE ID', 'Title', 'Authors', 'Year', 'Type', 'Venue', 'DOI', 'Citations', 'Download URL', 'CORE URL', 'Abstract'];
  const rows = works.map((w) => [
    w.id,
    cleanText(w.title),
    authorNames(w).join('; '),
    workYear(w) ?? '',
    documentTypeLabel(w),
    venueLabel(w),
    w.doi ?? '',
    w.citationCount ?? '',
    w.downloadUrl ?? '',
    `https://core.ac.uk/works/${w.id}`,
    cleanText(w.abstract),
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'results';
}
