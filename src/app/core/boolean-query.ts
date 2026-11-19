/**
 * A small boolean query language used for two things:
 *
 *  1. Validating the query typed into the main search bar *before* it is sent to CORE,
 *     so the user gets an instant, precise error (unbalanced brackets, dangling AND, …)
 *     instead of a generic HTTP 400.
 *  2. Filtering the papers already loaded in the browser ("Filter within results"),
 *     using the same syntax CORE uses.
 *
 * Grammar (operators must be UPPERCASE, as in CORE / Elasticsearch):
 *
 *   query   := or
 *   or      := and ( ("OR" | "||") and )*
 *   and     := not ( ("AND" | "&&")? not )*        // adjacent terms are an implicit AND
 *   not     := ("NOT" | "!" | "-") not | primary
 *   primary := "(" query ")" | field ":" "(" query ")" | term
 *   term    := [field (":" | ">" | ">=" | "<" | "<=")] (word | "quoted phrase")
 *
 * Words may end in `*` for a prefix match, e.g. `deliver*`.
 */

import { CoreWork } from './models';
import { authorNames, cleanText, venueLabel, workYear } from './work-utils';

// ---------------------------------------------------------------- AST

export type Comparator = ':' | '>' | '>=' | '<' | '<=';

export interface TermNode {
  kind: 'term';
  field: string | null;
  op: Comparator;
  value: string;
  phrase: boolean;
}
export interface NotNode {
  kind: 'not';
  child: QueryNode;
}
export interface BinaryNode {
  kind: 'and' | 'or';
  children: QueryNode[];
}
export type QueryNode = TermNode | NotNode | BinaryNode;

export class QuerySyntaxError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
    this.name = 'QuerySyntaxError';
  }
}

// ---------------------------------------------------------------- Tokenizer

type Token =
  | { type: 'lparen' | 'rparen' | 'and' | 'or' | 'not'; pos: number; text: string }
  | { type: 'term'; pos: number; text: string; field: string | null; op: Comparator; value: string; phrase: boolean };

const FIELD_RE = /^([A-Za-z_][\w.]*)(>=|<=|:|>|<)/;

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: ch === '(' ? 'lparen' : 'rparen', pos: i, text: ch });
      i++;
      continue;
    }
    if (input.startsWith('&&', i) || input.startsWith('||', i)) {
      tokens.push({ type: ch === '&' ? 'and' : 'or', pos: i, text: input.slice(i, i + 2) });
      i += 2;
      continue;
    }
    // Prefix negation: !term, -term (but not a lone "-" inside a word like "last-mile").
    if ((ch === '!' || ch === '-') && i + 1 < n && !/\s/.test(input[i + 1])) {
      tokens.push({ type: 'not', pos: i, text: ch });
      i++;
      continue;
    }

    const start = i;
    let field: string | null = null;
    let op: Comparator = ':';
    const fm = FIELD_RE.exec(input.slice(i));
    if (fm) {
      field = fm[1];
      op = fm[2] as Comparator;
      i += fm[0].length;
    }

    // Field followed directly by a group, e.g. authors:(smith OR jones)
    if (field && input[i] === '(') {
      tokens.push({ type: 'term', pos: start, text: input.slice(start, i), field, op, value: '', phrase: false });
      continue;
    }

    if (input[i] === '"') {
      const close = input.indexOf('"', i + 1);
      if (close === -1) throw new QuerySyntaxError('Unclosed quotation mark', i);
      const value = input.slice(i + 1, close).trim();
      if (!value) throw new QuerySyntaxError('Empty quoted phrase', i);
      i = close + 1;
      tokens.push({ type: 'term', pos: start, text: input.slice(start, i), field, op, value, phrase: true });
      continue;
    }

    while (i < n && !/[\s()"]/.test(input[i])) i++;
    const value = input.slice(field ? start + (fm as RegExpExecArray)[0].length : start, i);
    if (!value) {
      throw new QuerySyntaxError(field ? `Missing value after "${field}${op}"` : `Unexpected character "${input[i]}"`, i);
    }

    if (!field && (value === 'AND' || value === 'OR' || value === 'NOT')) {
      tokens.push({ type: value.toLowerCase() as 'and' | 'or' | 'not', pos: start, text: value });
    } else {
      tokens.push({ type: 'term', pos: start, text: input.slice(start, i), field, op, value, phrase: false });
    }
  }
  return tokens;
}

// ---------------------------------------------------------------- Parser

export function parseQuery(input: string): QueryNode {
  const tokens = tokenize(input);
  if (!tokens.length) throw new QuerySyntaxError('Query is empty', 0);
  let p = 0;
  const peek = () => tokens[p];
  const end = input.length;

  const describe = (t: Token | undefined) => (t ? `"${t.text}"` : 'end of query');

  function parseOr(): QueryNode {
    const children = [parseAnd()];
    while (peek()?.type === 'or') {
      const opTok = tokens[p++];
      if (!peek() || peek().type === 'rparen' || peek().type === 'or' || peek().type === 'and') {
        throw new QuerySyntaxError(`"${opTok.text}" needs a search term after it`, opTok.pos);
      }
      children.push(parseAnd());
    }
    return children.length === 1 ? children[0] : { kind: 'or', children };
  }

  function parseAnd(): QueryNode {
    const children = [parseNot()];
    for (;;) {
      const t = peek();
      if (!t || t.type === 'rparen' || t.type === 'or') break;
      if (t.type === 'and') {
        p++;
        const next = peek();
        if (!next || next.type === 'rparen' || next.type === 'or' || next.type === 'and') {
          throw new QuerySyntaxError(`"${t.text}" needs a search term after it`, t.pos);
        }
      }
      children.push(parseNot());
    }
    return children.length === 1 ? children[0] : { kind: 'and', children };
  }

  function parseNot(): QueryNode {
    const t = peek();
    if (t?.type === 'not') {
      p++;
      if (!peek() || peek().type === 'rparen' || peek().type === 'and' || peek().type === 'or') {
        throw new QuerySyntaxError(`"${t.text}" needs a search term after it`, t.pos);
      }
      return { kind: 'not', child: parseNot() };
    }
    return parsePrimary();
  }

  function parsePrimary(): QueryNode {
    const t = peek();
    if (!t) throw new QuerySyntaxError('Query ends unexpectedly', end);

    if (t.type === 'lparen') {
      p++;
      if (peek()?.type === 'rparen') throw new QuerySyntaxError('Empty brackets "()"', t.pos);
      const inner = parseOr();
      if (peek()?.type !== 'rparen') throw new QuerySyntaxError('Missing closing bracket ")"', t.pos);
      p++;
      return inner;
    }

    if (t.type === 'term') {
      p++;
      if (t.field && !t.value) {
        // field:( … ) — apply the field to every unfielded term in the group.
        const open = peek();
        if (open?.type !== 'lparen') throw new QuerySyntaxError(`Missing value after "${t.text}"`, t.pos);
        const group = parsePrimary();
        return applyField(group, t.field);
      }
      return { kind: 'term', field: t.field, op: t.op, value: t.value, phrase: t.phrase };
    }

    if (t.type === 'rparen') throw new QuerySyntaxError('Unexpected closing bracket ")"', t.pos);
    throw new QuerySyntaxError(`${describe(t)} cannot start a search term`, t.pos);
  }

  const ast = parseOr();
  if (p < tokens.length) {
    const t = tokens[p];
    throw new QuerySyntaxError(
      t.type === 'rparen' ? 'Unexpected closing bracket ")"' : `Unexpected ${describe(t)}`,
      t.pos,
    );
  }
  return ast;
}

function applyField(node: QueryNode, field: string): QueryNode {
  switch (node.kind) {
    case 'term':
      return node.field ? node : { ...node, field };
    case 'not':
      return { kind: 'not', child: applyField(node.child, field) };
    default:
      return { kind: node.kind, children: node.children.map((c) => applyField(c, field)) };
  }
}

// ---------------------------------------------------------------- Validation (main search bar)

export interface QueryValidation {
  valid: boolean;
  error?: string;
  position?: number;
  warnings: string[];
}

export function validateQuery(input: string): QueryValidation {
  const warnings: string[] = [];
  if (!input.trim()) return { valid: false, error: 'Enter a search query', warnings };

  const lowerOps = input.match(/(?:^|[\s(])(and|or|not)(?=[\s(])/g);
  if (lowerOps) {
    const ops = [...new Set(lowerOps.map((m) => m.trim().replace('(', '')))];
    warnings.push(
      `Operators must be UPPERCASE — "${ops.join('", "')}" will be searched as ${ops.length > 1 ? 'words' : 'a word'}.`,
    );
  }
  try {
    parseQuery(input);
    return { valid: true, warnings };
  } catch (e) {
    if (e instanceof QuerySyntaxError) return { valid: false, error: e.message, position: e.position, warnings };
    throw e;
  }
}

// ---------------------------------------------------------------- Evaluation (client-side filter)

/** Field aliases accepted by the client-side filter → index key. */
const FIELD_ALIASES: Record<string, IndexKey> = {
  title: 'title',
  abstract: 'abstract',
  author: 'authors',
  authors: 'authors',
  publisher: 'venue',
  venue: 'venue',
  journal: 'venue',
  type: 'type',
  documenttype: 'type',
  lang: 'language',
  language: 'language',
  doi: 'doi',
  field: 'field',
  fieldofstudy: 'field',
};
const YEAR_FIELDS = new Set(['year', 'yearpublished']);

type IndexKey = 'title' | 'abstract' | 'authors' | 'venue' | 'type' | 'language' | 'doi' | 'field';
type WorkIndex = Record<IndexKey, string[]> & { year: number | null };

const indexCache = new WeakMap<CoreWork, WorkIndex>();

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function words(s: string | null | undefined): string[] {
  return normalize(cleanText(s)).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function indexWork(w: CoreWork): WorkIndex {
  let idx = indexCache.get(w);
  if (!idx) {
    idx = {
      title: words(w.title),
      abstract: words(w.abstract),
      authors: words(authorNames(w).join(' ')),
      venue: words(venueLabel(w)),
      type: words(w.documentType),
      language: words(`${w.language?.name ?? ''} ${w.language?.code ?? ''}`),
      doi: w.doi ? [normalize(w.doi)] : [],
      field: words(w.fieldOfStudy),
      year: workYear(w),
    };
    indexCache.set(w, idx);
  }
  return idx;
}

const DEFAULT_FIELDS: IndexKey[] = ['title', 'abstract', 'authors', 'venue'];

function matchWords(haystack: string[], term: TermNode): boolean {
  const needle = words(term.value.replace(/\*$/, ''));
  if (!needle.length) return false;
  if (term.phrase || needle.length > 1) {
    const hay = ` ${haystack.join(' ')} `;
    return hay.includes(` ${needle.join(' ')} `);
  }
  const [w] = needle;
  return term.value.endsWith('*') ? haystack.some((h) => h.startsWith(w)) : haystack.includes(w);
}

function compareYear(year: number | null, op: Comparator, raw: string): boolean {
  if (year == null) return false;
  const range = raw.match(/^(\d{4})\s*(?:-|\.\.|TO)\s*(\d{4})$/i);
  if (op === ':' && range) return year >= +range[1] && year <= +range[2];
  const v = Number(raw);
  if (!Number.isFinite(v)) return false;
  switch (op) {
    case '>':
      return year > v;
    case '>=':
      return year >= v;
    case '<':
      return year < v;
    case '<=':
      return year <= v;
    default:
      return year === v;
  }
}

function evalTerm(term: TermNode, idx: WorkIndex): boolean {
  if (term.field) {
    const f = term.field.toLowerCase();
    if (YEAR_FIELDS.has(f)) return compareYear(idx.year, term.op, term.value);
    const key = FIELD_ALIASES[f];
    if (!key) return false; // unknown field: nothing matches, like CORE
    if (key === 'doi') return idx.doi.some((d) => d.includes(normalize(term.value)));
    return matchWords(idx[key], term);
  }
  return DEFAULT_FIELDS.some((k) => matchWords(idx[k], term));
}

export function evaluate(node: QueryNode, work: CoreWork): boolean {
  const idx = indexWork(work);
  const walk = (n: QueryNode): boolean => {
    switch (n.kind) {
      case 'term':
        return evalTerm(n, idx);
      case 'not':
        return !walk(n.child);
      case 'and':
        return n.children.every(walk);
      case 'or':
        return n.children.some(walk);
    }
  };
  return walk(node);
}

/** Positive text terms (not under a NOT) that are worth highlighting in titles/abstracts. */
export function highlightTerms(node: QueryNode | null): string[] {
  if (!node) return [];
  const out = new Set<string>();
  const textFields = new Set([null, 'title', 'abstract', 'author', 'authors']);
  const walk = (n: QueryNode, negated: boolean) => {
    if (n.kind === 'term') {
      if (!negated && n.op === ':' && textFields.has(n.field?.toLowerCase() ?? null) && n.value.length > 1) {
        out.add(n.value);
      }
    } else if (n.kind === 'not') walk(n.child, !negated);
    else n.children.forEach((c) => walk(c, negated));
  };
  walk(node, false);
  return [...out];
}

/** Like {@link parseQuery} but returns null instead of throwing. */
export function tryParse(input: string): QueryNode | null {
  try {
    return input.trim() ? parseQuery(input) : null;
  } catch {
    return null;
  }
}
