# CORE Paper Explorer

An Angular app for searching open-access research papers from the [CORE API v3](https://api.core.ac.uk/docs/v3). You can run boolean keyword searches, choose how many papers come back, filter what's loaded, and see how the matching papers break down in an interactive chart.

Built with **Angular 22** (standalone components, signals, zoneless change detection, the new control flow). The only runtime dependencies are Angular and RxJS. The chart is hand-written SVG, with no chart library.

---

## Quick start

**Prerequisites:** Node.js **22.22+** or **24.15+** (needed by Angular 22) and npm. If you use nvm, run `nvm use` (the repo has a `.nvmrc`).

```bash
git clone https://github.com/oluabbeys/core-paper-explorer.git
cd core-paper-explorer
npm install
npm start            # same as: ng serve
```

Open **http://localhost:4200** and try `(drone AND (package OR delivery))`.

During development, the dev server forwards `/v3/*` to `https://api.core.ac.uk` (see `proxy.conf.json`). This means the browser never makes a cross-origin call, so CORS is not a problem.

### Other commands

| Command | What it does |
| --- | --- |
| `npm test` | Runs the unit tests once (Vitest via `ng test`, 30 tests) |
| `npm run build` | Makes a production build in `dist/core-paper-explorer/browser` |
| `npm run watch` | Rebuilds in development mode whenever a file changes |

### Production build note

The production build calls `https://api.core.ac.uk/v3` directly (`src/environments/environment.ts`). If your host or the API blocks cross-origin requests, put the static build behind a reverse proxy that forwards `/v3` to `https://api.core.ac.uk`, and set `apiBase: '/v3'` in `environment.ts`.

### CORE API key (optional but recommended)

CORE works without a key, but anonymous requests are heavily rate-limited. To raise the limit, get a free key at <https://core.ac.uk/services/api> and paste it under **⚙ Settings** in the app. The key is kept only in your browser's localStorage and is sent as an `Authorization: Bearer …` header.

---

## Features

### Required by the brief

1. **Angular 20+ project.** It was created with Angular CLI 22.
2. **Retrieves CORE data** with `GET /v3/search/works?q=…&limit=…&offset=…`.
3. **Clean paper UI.** Each card shows the title, authors, year, venue, an abstract you can expand, chips for document type, citations and language, and links to the PDF, DOI and CORE page.
4. **Number of results field.** The "Papers per page" field (1–100, CORE's limit per request) has quick presets. Changing it runs the search again.
5. **Boolean keyword search bar.** It supports `AND`, `OR`, `NOT`, nested brackets, quoted phrases and CORE field queries such as `title:`, `authors:(…)` and `yearPublished>2020`. The query goes straight to CORE's search engine.
6. **Chart that aggregates the matching papers.** You can switch between publication year, document type, top authors, top journals/publishers and language. The chart stays blank until you run a query.

### Extra capabilities

1. **Live query validation.** A hand-written recursive-descent parser checks the query as you type. It points out errors like a missing `)`, a dangling `AND`, an unclosed quote or empty brackets *before* anything is sent to CORE, and it warns when operators are typed in lowercase (CORE would search them as words).
2. **"Filter within these papers".** A second search box runs the **same boolean syntax in the browser** over the papers already loaded. It ignores accents (`garcia` matches `García`) and also supports `deliver*` prefix wildcards, `author:`, `type:`, `venue:`, `language:` and year comparisons or ranges (`year>=2020`, `year:2015-2019`).
3. **Highlighting.** Search and filter terms are highlighted in titles and abstracts. Highlights are rendered as text segments, never `innerHTML`, so this is XSS-safe.
4. **Cross-filtering from the chart.** Clicking a bar adds a matching clause (e.g. `year:2021`, `author:"Jane Doe"`) to the filter. The results list and the chart update together.
5. **"Analyse up to 500 matches".** One page of results is a small sample, so the chart can fetch up to 500 matching papers. It requests them one after another, 100 at a time, to be gentle on rate limits. If a later page fails, it keeps the papers it already has.
6. **Accessible chart.** Bars show a tooltip on hover and keyboard focus, can be operated with the keyboard, and there is a "Show as table" view. The year axis is continuous: missing years appear as zero, and very wide spans are grouped into 5- or 10-year bins. Papers with no value for the chosen dimension are counted and reported.
7. **Shareable URLs.** `?q=…&limit=…&page=…&filter=…` stays in sync with the app and is restored on load, so you can bookmark or send any view.
8. **Pagination** with CORE offsets.
9. **Sorting** of loaded papers by relevance, newest, oldest or most cited.
10. **CSV export** of the papers currently shown (after filtering and sorting). Cells that would start a spreadsheet formula are made safe.
11. **Recent searches** saved locally and shown as one-click chips.
12. **Clickable syntax cheat-sheet** with examples.
13. **Better behaviour around the API:**
    - an in-memory response cache, so repeated queries don't use up the rate limit
    - `switchMap` cancels slower requests that have been replaced by a newer search
    - clear messages for 400 (bad query), 401/403 (bad key), 429 (rate limited) and 5xx errors
14. **Polish:** light and dark themes that follow the OS setting, loading skeletons, a responsive layout (the sidebar stacks on small screens), and **/** to focus the search box from anywhere.
15. **Unit tests** cover the parser and evaluator, highlighting, chart aggregation, the API service (params, clamping, caching, errors), settings and the auth interceptor, and CSV export.

---

## Search syntax

| Example | Meaning |
| --- | --- |
| `drone AND delivery` | both words |
| `drone OR uav` | either word |
| `drone NOT military` / `drone -military` | exclude a word |
| `(drone AND (package OR delivery))` | grouping |
| `"last mile delivery"` | exact phrase |
| `title:drone`, `authors:(smith OR jones)` | field search (sent to CORE) |
| `drone AND yearPublished>2020` | numeric comparison (sent to CORE) |
| `deliver*`, `year:2015-2019`, `type:thesis` | also understood by the in-results filter |

Operators must be **UPPERCASE**. Words next to each other are combined with AND. The full reference is CORE's [How to search](https://api.core.ac.uk/docs/v3#section/How-to-search).

---

## Project structure

```
src/app/
├── app.*                     # Shell: search panel, results list, layout
├── components/
│   ├── paper-card.*          # One paper
│   ├── chart-panel.*         # Chart controls, scope, table view
│   ├── bar-chart.*           # Dependency-free SVG/HTML bar chart
│   ├── syntax-help.ts        # Clickable query cheat-sheet
│   └── settings-menu.ts      # API key + recent-search management
└── core/
    ├── core-api.service.ts   # HTTP + caching + error mapping
    ├── search.store.ts       # Signal-based app state (search, filter, sort, chart)
    ├── boolean-query.ts      # Tokenizer, parser, validator, evaluator
    ├── chart-data.ts         # Aggregation for the chart
    ├── highlight.ts          # Highlight pipe
    ├── settings.service.ts   # localStorage prefs + auth interceptor
    ├── url-state.ts          # URL ⇄ state sync
    ├── export.ts             # CSV export
    └── work-utils.ts         # Cleaning/formatting of sparse CORE records
```

## Design notes

- **Where the chart data comes from.** The chart aggregates every loaded paper that matches the query and any active filter. CORE has no facet or aggregation endpoint in its public search API, so the chart works from the current page by default. "Analyse up to 500 matches" gives a much larger sample, and the panel always shows how many papers the chart is based on compared with the total number of matches.
- **Two levels of search.** The main bar searches CORE's whole index on the server. The filter refines what has already been loaded, instantly and without spending API calls. Both use the same syntax, so you only need to learn it once.
- **Commit history.** Each commit builds on the previous one and leaves the app in a working state: scaffold → API + basic search → cards, page size and pagination → boolean validation and filter → chart → extras → docs.
