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
      // Run: pagefind --site dist --root-selector [data-pagefind-body]
    }
  }
}
```

This produces a `dist/pagefind/` directory with the search index, served as static assets by Nginx.

**Dependency**: Add `pagefind` as a dev dependency.

### 2. Index Markup (`digest-card.astro`)

Add Pagefind attributes to the `<article>` element in `digest-card.astro`:

```astro
<article
  data-pagefind-body
  data-pagefind-meta={`url:${article.url}, title:${title}, summary:${summary}`}
>
```

This indexes each digest article's title and summary text, and stores the external URL, title, and summary as retrievable metadata.

**Scope**: Only digest article cards are indexed. All other page content is excluded (no `data-pagefind-body` attribute).

### 3. Search Dialog UI (`search-dialog.astro`)

Restructure the results area into two sections:

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

  <!-- Empty state (both empty) -->
  <div id="search-no-results" class="hidden">...</div>
</div>
```

#### Search flow (JS logic):

1. User types → 500ms debounce
2. Fire Pagefind search and embedding fetch in parallel
3. Pagefind resolves near-instantly:
   - Has results → show exact matches section, collect URLs into a `Set`
   - No results → hide exact matches section
4. Embedding resolves (few hundred ms):
   - Filter out URLs already in exact matches `Set`
   - Has remaining results → show related section
   - No results → hide related section
5. Both empty → show empty state
6. Embedding error/timeout → silently hide related section (user has Pagefind results)

#### Pagefind JS API initialization:

```ts
// Lazy-load Pagefind on first dialog open
let pagefind: any = null
async function getPagefind() {
  if (!pagefind) {
    pagefind = await import('/pagefind/pagefind.js')
    await pagefind.init()
  }
  return pagefind
}
```

#### Result card rendering:

Both sections use the same card markup (reuse existing `renderResults` with minor refactor):

```html
<a href="${url}" target="_blank" rel="noopener noreferrer"
   class="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent">
  <div class="font-medium">${title}</div>
  <div class="mt-0.5 line-clamp-1 text-muted-foreground text-xs">${summary}</div>
</a>
```

#### Section labels (i18n):

Add to `src/i18n/ui.ts`:
- `search.exactMatches`: "精确匹配" / "Exact matches"
- `search.related`: "相关推荐" / "Related"

### 4. Backend

**No changes.** `POST /api/search` remains as-is.

### 5. Build & Deploy

- `.gitignore`: Add `dist/pagefind/` (build artifact)
- CI (`deploy.yml`): No changes needed — `bun build` triggers the Astro integration which runs Pagefind automatically. The `dist/` directory already gets deployed.
- Nginx: Already serves `/_astro/` from `dist/`. Pagefind assets at `/pagefind/` will be served similarly from `dist/pagefind/`.

## Files Changed

| File | Change |
|---|---|
| `package.json` | Add `pagefind` dev dependency |
| `astro.config.mjs` | Add Pagefind integration (build hook) |
| `src/components/digest-card.astro` | Add `data-pagefind-body` and `data-pagefind-meta` attributes |
| `src/components/search-dialog.astro` | Dual-section UI, Pagefind JS API, dedup logic |
| `src/i18n/ui.ts` | Add `search.exactMatches` and `search.related` strings |
| `.gitignore` | Add `dist/pagefind/` |

## Files NOT Changed

- `src/pages/api/search.ts` — Embedding endpoint unchanged
- `src/lib/schema.ts` — No DB changes
- `src/lib/queries.ts` — No query changes

## Edge Cases

- **Pagefind not loaded** (e.g. JS blocked): Falls back to embedding-only, same as current behavior
- **Embedding API failure**: Related section silently hidden, exact matches still work
- **Both fail**: Empty state shown
- **Dev mode**: Pagefind index only exists after build. In dev, Pagefind import will fail silently; search falls back to embedding-only
