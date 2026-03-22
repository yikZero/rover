# Hybrid Search Design: Pagefind + Embedding

## Overview

Add client-side keyword search (Pagefind) alongside the existing Gemini embedding semantic search to create a hybrid search experience. Users see instant keyword matches first, with semantic recommendations appearing in parallel below.

## Goals

1. **Response speed** — Pagefind delivers instant client-side results (milliseconds)
2. **Search quality** — Keyword precision + semantic recall combined
3. **API cost reduction** — Many queries satisfied by Pagefind alone

## Architecture

```
User input (500ms debounce)
├── Pagefind (client-side, instant)
│   → "精确匹配" / "Exact matches" section
└── POST /api/search (server, parallel)
    → "相关推荐" / "Related" section
```

Both searches fire in parallel. Results are displayed in two distinct sections with URL-based deduplication.

## Changes

### 1. Pagefind Integration (`astro.config.mjs`)

Add a custom Astro integration that runs the Pagefind CLI in the `astro:build:done` hook:

```ts
// Custom integration in astro.config.mjs
{
  name: 'pagefind',
  hooks: {
    'astro:build:done': async () => {
      // Run: pagefind --site dist
    }
  }
}
```

This produces a `dist/pagefind/` directory with the search index, served as static assets by Nginx.

**Dependency**: Add `pagefind` as a dev dependency.

### 2. Index Markup

#### Controlling index scope (`digest-date.astro`)

Add `data-pagefind-body` to the article list wrapper in `digest-date.astro` (NOT on `digest-card.astro`). This ensures only `/digests/[date]` pages are indexed — the home page and `/digests` list page reuse `digest-card.astro` but won't be indexed.

```astro
<!-- digest-date.astro -->
<div class="mt-8 md:mt-16" data-pagefind-body>
  {digest.articles.map((article) => (
    <DigestCard article={article} locale={locale} />
  ))}
</div>
```

#### Locale handling

The site sets `<html lang="zh-CN">` or `<html lang="en">` per locale. Pagefind auto-detects the `lang` attribute and indexes accordingly. Each article is indexed twice (once per locale), but both versions are useful since they have different titles and summaries. At search time, filter results by the user's current locale using `data-pagefind-filter-locale`:

```astro
<!-- digest-date.astro, on the same wrapper -->
<div data-pagefind-body data-pagefind-filter-locale={locale}>
```

At query time: `pagefind.search(query, { filters: { locale: currentLocale } })`.

#### Article metadata (`digest-card.astro`)

Use separate hidden elements for metadata to avoid comma-parsing issues:

```astro
<article>
  <span data-pagefind-meta={`url:${article.url}`} class="hidden"></span>
  <span data-pagefind-meta={`title:${title}`} class="hidden"></span>
  <span data-pagefind-meta={`summary:${summary}`} class="hidden"></span>
  <!-- existing content unchanged -->
</article>
```

### 3. Search Dialog UI (`search-dialog.astro`)

Restructure the results area into two independent sections:

```html
<div id="search-results">
  <!-- Initial hint (shown by default) -->
  <p id="search-hint">...</p>

  <!-- Exact matches section (Pagefind) -->
  <div id="search-exact" class="hidden">
    <p class="section-label">精确匹配</p>
    <div id="search-exact-items"></div>
  </div>

  <!-- Related section (Embedding) -->
  <div id="search-related" class="hidden">
    <p class="section-label">相关推荐</p>
    <div id="search-related-items"></div>
    <div id="search-related-loading"><!-- skeleton --></div>
  </div>

  <!-- Empty state (both sections empty) -->
  <div id="search-no-results" class="hidden">...</div>
</div>
```

#### Search flow (JS logic):

1. User types → 500ms debounce
2. Fire Pagefind search and embedding fetch in parallel
3. Pagefind resolves near-instantly:
   - Has results → show exact matches section, collect external URLs into a `Set`
   - No results → hide exact matches section
4. Embedding resolves (few hundred ms):
   - Filter out URLs already in exact matches `Set`
   - Has remaining results → show related section
   - No results → hide related section
5. Both empty → show empty state
6. Embedding error/timeout → silently hide related section (user already has Pagefind results or empty state shows)

#### Visibility logic:

Replace current `showOnly(el)` helper with independent show/hide for each section, since exact matches and related sections can be visible simultaneously:

```ts
function setVisible(el: HTMLElement, visible: boolean) {
  el.classList.toggle('hidden', !visible)
}
// Show/hide each section independently based on its own results
```

#### Pagefind JS API initialization:

```ts
// Lazy-load Pagefind on first search
let pagefind: any = null
async function getPagefind() {
  if (!pagefind) {
    pagefind = await import('/pagefind/pagefind.js')
  }
  return pagefind
}
```

Note: Pagefind's `search()` works immediately after import — no init call needed.

#### Pagefind result mapping:

Pagefind results have a different structure from the embedding API. Map them to the same card format:

```ts
// Pagefind result shape: { url, meta, excerpt, sub_results }
// We need: { url, title, summary } for card rendering

const search = await pagefind.search(query, {
  filters: { locale: getLocale() }
})
// Limit to 10 results
const results = await Promise.all(
  search.results.slice(0, 10).map((r: any) => r.data())
)
// Map to card format
const items = results.map((r: any) => ({
  url: r.meta.url,      // external article URL from data-pagefind-meta
  title: r.meta.title,   // from data-pagefind-meta
  summary: r.meta.summary // from data-pagefind-meta
}))
```

#### Result card rendering:

Both sections use the same card markup:

```html
<a href="${url}" target="_blank" rel="noopener noreferrer"
   class="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent">
  <div class="font-medium">${title}</div>
  <div class="mt-0.5 line-clamp-1 text-muted-foreground text-xs">${summary}</div>
</a>
```

Refactor the existing `renderResults` into a shared `renderCards(items, container)` function that accepts `{ url, title, summary }[]`.

#### Section labels (i18n):

Add to `src/i18n/ui.ts`:
- `search.exactMatches`: "精确匹配" / "Exact matches"
- `search.related`: "相关推荐" / "Related"

### 4. Backend

**No changes.** `POST /api/search` remains as-is.

### 5. Build & Deploy

- `.gitignore`: No change needed — `dist/` is already ignored.
- CI (`deploy.yml`): No changes needed — `bun build` triggers the Astro integration which runs Pagefind automatically. The `dist/` directory already gets deployed.
- Nginx: Already serves `/_astro/` from `dist/`. Pagefind assets at `/pagefind/` need a similar static serving rule, or Nginx's existing config for `dist/` may already cover it.

## Files Changed

| File | Change |
|---|---|
| `package.json` | Add `pagefind` dev dependency |
| `astro.config.mjs` | Add Pagefind integration (build hook) |
| `src/components/pages/digest-date.astro` | Add `data-pagefind-body` and `data-pagefind-filter-locale` on article list wrapper |
| `src/components/digest-card.astro` | Add hidden `data-pagefind-meta` elements for url, title, summary |
| `src/components/search-dialog.astro` | Dual-section UI, Pagefind JS API, result mapping, dedup logic, replace `showOnly` with independent visibility |
| `src/i18n/ui.ts` | Add `search.exactMatches` and `search.related` strings |

## Files NOT Changed

- `src/pages/api/search.ts` — Embedding endpoint unchanged
- `src/lib/schema.ts` — No DB changes
- `src/lib/queries.ts` — No query changes
- `.gitignore` — `dist/` already ignored

## Edge Cases

- **Pagefind not loaded** (e.g. JS blocked, import fails): Falls back to embedding-only, same as current behavior
- **Embedding API failure**: Related section silently hidden, exact matches still work
- **Both fail**: Empty state shown
- **Dev mode**: Pagefind index only exists after build. In dev, Pagefind import will fail silently; search falls back to embedding-only
- **Pagefind results limit**: Capped at 10 results to match embedding search and avoid excessive list length
- **Chinese tokenization**: Pagefind has built-in CJK segmentation support. The `<html lang="zh-CN">` attribute enables it automatically for Chinese pages
