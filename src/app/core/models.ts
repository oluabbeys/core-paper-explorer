/** Subset of the CORE v3 "Work" object that this app uses. All fields are optional
 *  because CORE records come from thousands of repositories and are often sparse. */
export interface CoreAuthor {
  name?: string;
}

export interface CoreLink {
  type?: string;
  url?: string;
}

export interface CoreDataProvider {
  id?: number;
  name?: string;
  url?: string;
}

export interface CoreWork {
  id: number | string;
  title?: string;
  abstract?: string | null;
  authors?: CoreAuthor[];
  yearPublished?: number | null;
  publishedDate?: string | null;
  doi?: string | null;
  downloadUrl?: string | null;
  documentType?: string | null;
  fieldOfStudy?: string | null;
  language?: { code?: string; name?: string } | null;
  publisher?: string | null;
  citationCount?: number | null;
  links?: CoreLink[];
  dataProviders?: CoreDataProvider[];
  journals?: { title?: string }[];
}

export interface CoreSearchResponse {
  totalHits: number;
  limit: number;
  offset: number;
  results: CoreWork[];
  scrollId?: string;
}

export interface SearchParams {
  query: string;
  limit: number;
  offset: number;
}
