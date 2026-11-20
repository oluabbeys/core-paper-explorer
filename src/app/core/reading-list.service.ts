import { Injectable, computed, effect, signal } from '@angular/core';
import { CoreWork } from './models';
import { safeStorage } from './storage';

const KEY = 'cpe.readingList';

export interface SavedPaper {
  work: CoreWork;
  savedAt: string;
}

/**
 * Papers the user has starred, kept in localStorage so the list survives
 * reloads and new searches. Only the fields the UI and exports need are stored.
 */
@Injectable({ providedIn: 'root' })
export class ReadingListService {
  readonly items = signal<SavedPaper[]>(safeStorage.get<SavedPaper[]>(KEY, []).filter((p) => p?.work?.id != null));
  readonly count = computed(() => this.items().length);
  readonly works = computed(() => this.items().map((p) => p.work));
  private readonly ids = computed(() => new Set(this.items().map((p) => String(p.work.id))));

  constructor() {
    effect(() => safeStorage.set(KEY, this.items()));
  }

  has(id: CoreWork['id']): boolean {
    return this.ids().has(String(id));
  }

  toggle(work: CoreWork): void {
    if (this.has(work.id)) this.remove(work.id);
    else this.items.update((list) => [{ work: slim(work), savedAt: new Date().toISOString() }, ...list]);
  }

  remove(id: CoreWork['id']): void {
    this.items.update((list) => list.filter((p) => String(p.work.id) !== String(id)));
  }

  clear(): void {
    this.items.set([]);
  }
}

/** Drop bulky fields (full text, references…) before persisting. */
function slim(w: CoreWork): CoreWork {
  const { id, title, abstract, authors, yearPublished, publishedDate, doi, downloadUrl, documentType, language, publisher, citationCount, journals, dataProviders } = w;
  return {
    id,
    title,
    abstract,
    authors,
    yearPublished,
    publishedDate,
    doi,
    downloadUrl,
    documentType,
    language,
    publisher,
    citationCount,
    journals: journals?.slice(0, 1),
    dataProviders: dataProviders?.slice(0, 1).map(({ id: pid, name }) => ({ id: pid, name })),
  };
}
