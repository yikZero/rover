# Hybrid Search (Pagefind + Embedding) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side keyword search (Pagefind) alongside existing Gemini embedding semantic search, displayed in two sections: instant exact matches on top, semantic recommendations below.

**Architecture:** Pagefind indexes digest article cards at build time. On search, Pagefind runs client-side (instant) and embedding API fires in parallel. Results render in two independent sections with URL-based dedup. Embedding failures degrade gracefully.

**Tech Stack:** Pagefind (client-side search), Astro integration hooks, existing Gemini embedding API + pgvector

**Spec:** `docs/superpowers/specs/2026-03-22-hybrid-search-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `package.json` | Modify | Add `pagefind` dev dependency |
| `astro.config.mjs` | Modify | Add Pagefind build integration |
| `src/components/pages/digest-date.astro` | Modify | Add `data-pagefind-body` + locale filter on article wrapper |
| `src/components/digest-card.astro` | Modify | Add hidden `data-pagefind-meta` elements |
| `src/i18n/ui.ts` | Modify | Add search section label strings |
| `src/components/search-dialog.astro` | Modify | Rewrite to dual-section UI with Pagefind + embedding |

---

### Task 1: Add Pagefind dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install pagefind**

```bash
cd /Users/yikzero/Code/rover && bun add -d pagefind
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/yikzero/Code/rover && bunx pagefind --version
```

Expected: prints a version number.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add pagefind dev dependency"
```

---

### Task 2: Add Pagefind build integration

**Files:**
- Modify: `astro.config.mjs:6-37`

- [ ] **Step 1: Add Pagefind integration to Astro config**

Add a custom integration that runs Pagefind CLI after Astro finishes building static pages. Insert into the `integrations` array:

```ts
// In astro.config.mjs, add import at top:
import { execSync } from 'node:child_process'

// Add to integrations array, after sitemap:
{
  name: 'pagefind',
  hooks: {
    'astro:build:done': () => {
      execSync('bunx pagefind --site dist', { stdio: 'inherit' })
    },
  },
},
```

The full integrations array becomes:

```ts
integrations: [
  sitemap({
    filter: (page) => !page.includes('/404'),
  }),
  {
    name: 'pagefind',
    hooks: {
      'astro:build:done': () => {
        execSync('bunx pagefind --site dist', { stdio: 'inherit' })
      },
    },
  },
],
```

- [ ] **Step 2: Verify build runs Pagefind**

```bash
cd /Users/yikzero/Code/rover && bun build
```

Expected: After Astro build output, Pagefind prints its indexing summary (e.g., "Running Pagefind... Indexed N pages"). A `dist/pagefind/` directory is created.

```bash
ls dist/pagefind/
```

Expected: Contains `pagefind.js`, `pagefind-ui.js`, index files, etc.

- [ ] **Step 3: Commit**

```bash
git add astro.config.mjs
git commit -m "feat: add Pagefind build integration"
```

---

### Task 3: Add Pagefind index markup to digest pages

**Files:**
- Modify: `src/components/pages/digest-date.astro:46`
- Modify: `src/components/digest-card.astro:17-49`

- [ ] **Step 1: Add `data-pagefind-body` and locale filter to digest-date.astro**

In `src/components/pages/digest-date.astro`, change line 46 from:

```astro
    <div class="mt-8 md:mt-16">
```

to:

```astro
    <div class="mt-8 md:mt-16" data-pagefind-body>
      <span data-pagefind-filter={`locale:${locale}`} class="hidden"></span>
```

Note: `data-pagefind-filter` requires either the `key:value` attribute format or a child element — the `data-pagefind-filter-name` suffix syntax is not valid. A hidden `<span>` inside the `data-pagefind-body` container is the correct approach.

This ensures only `/digests/[date]` pages are indexed (not home or list pages which also use `DigestCard`), and each page is tagged with its locale for filtering at search time.

- [ ] **Step 2: Add metadata elements to digest-card.astro**

In `src/components/digest-card.astro`, add three hidden metadata elements right after the opening `<article>` tag (after line 22). These store article data that Pagefind can retrieve at search time:

Change:

```astro
  <article class="group relative grid gap-4 py-5 md:grid-cols-[1fr_auto] md:gap-8">
    <div class="grid gap-3 md:grid-cols-[auto_1fr]">
```

to:

```astro
  <article class="group relative grid gap-4 py-5 md:grid-cols-[1fr_auto] md:gap-8">
    <span data-pagefind-meta={`url:${article.url}`} class="hidden"></span>
    <span data-pagefind-meta={`title:${title}`} class="hidden"></span>
    <span data-pagefind-meta={`summary:${summary}`} class="hidden"></span>
    <div class="grid gap-3 md:grid-cols-[auto_1fr]">
```

- [ ] **Step 3: Verify indexing works**

```bash
cd /Users/yikzero/Code/rover && bun build
```

Expected: Pagefind output shows it indexed digest date pages. The count should match the number of locale x digest-date pages (not home or list pages).

- [ ] **Step 4: Commit**

```bash
git add src/components/pages/digest-date.astro src/components/digest-card.astro
git commit -m "feat: add Pagefind index markup to digest article cards"
```

---

### Task 4: Add i18n strings for search sections

**Files:**
- Modify: `src/i18n/ui.ts:1-80`

- [ ] **Step 1: Add search section label strings**

In `src/i18n/ui.ts`, add two new keys to each locale object.

In the `'zh-CN'` object, after `'search.hint'` (line 21):

```ts
    'search.exactMatches': '精确匹配',
    'search.related': '相关推荐',
```

In the `en` object, after `'search.hint'` (line 60):

```ts
    'search.exactMatches': 'Exact matches',
    'search.related': 'Related',
```

- [ ] **Step 2: Verify types**

```bash
cd /Users/yikzero/Code/rover && bun run check
```

Expected: No errors. The `TranslationKey` type auto-derives from the `ui` const, so new keys are available immediately.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/ui.ts
git commit -m "feat: add i18n strings for hybrid search sections"
```

---

### Task 5: Rewrite search dialog with dual-section UI

**Files:**
- Modify: `src/components/search-dialog.astro:1-163`

This is the main task. The full file is rewritten to support two result sections (Pagefind exact matches + embedding related recommendations).

- [ ] **Step 1: Update HTML template**

Replace the `<div id="search-results">` block (lines 24-43) with the dual-section structure:

```astro
  <div id="search-results" class="max-h-80 overflow-y-auto p-2">
    <p class="py-6 text-center text-muted-foreground text-sm" id="search-hint">
      {t('search.hint')}
    </p>
    <div class="hidden" id="search-exact">
      <p class="px-3 py-1.5 text-muted-foreground text-xs">{t('search.exactMatches')}</p>
      <div id="search-exact-items"></div>
    </div>
    <div class="hidden" id="search-related">
      <p class="px-3 py-1.5 text-muted-foreground text-xs">{t('search.related')}</p>
      <div id="search-related-items"></div>
      <div id="search-related-loading" class="hidden space-y-2 p-2">
        <div class="h-12 animate-pulse rounded-md bg-muted"></div>
        <div class="h-12 animate-pulse rounded-md bg-muted"></div>
      </div>
    </div>
    <div class="hidden" id="search-no-results">
      <div class="flex flex-col items-center py-8">
        <Icon name="search-x" class="size-8 text-muted-foreground/40" />
        <p class="mt-3 text-muted-foreground text-sm">{t('search.noResults')}</p>
      </div>
    </div>
  </div>
```

- [ ] **Step 2: Rewrite the `<script>` block**

Replace the entire `<script>` block (lines 46-163) with the new hybrid search logic:

```ts
<script>
  function getLocale(): string {
    return document.documentElement.lang || 'zh-CN'
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      const dialog = document.getElementById('search-dialog') as HTMLDialogElement | null
      const input = document.getElementById('search-input') as HTMLInputElement | null
      if (dialog && input) {
        dialog.showModal()
        input.focus()
      }
    }
  })

  // Lazy-load Pagefind
  let pagefind: any = null
  async function getPagefind(): Promise<any> {
    if (!pagefind) {
      try {
        pagefind = await import(/* @vite-ignore */ '/pagefind/pagefind.js')
      } catch {
        return null
      }
    }
    return pagefind
  }

  document.addEventListener('astro:page-load', () => {
    const dialog = document.getElementById('search-dialog') as HTMLDialogElement
    const input = document.getElementById('search-input') as HTMLInputElement
    const hint = document.getElementById('search-hint')!
    const noResults = document.getElementById('search-no-results')!
    const exactSection = document.getElementById('search-exact')!
    const exactItems = document.getElementById('search-exact-items')!
    const relatedSection = document.getElementById('search-related')!
    const relatedItems = document.getElementById('search-related-items')!
    const relatedLoading = document.getElementById('search-related-loading')!

    let debounceTimer: ReturnType<typeof setTimeout>
    let abortController: AbortController | null = null

    function hideAll() {
      for (const el of [hint, noResults, exactSection, relatedSection]) {
        el.classList.add('hidden')
      }
      relatedLoading.classList.add('hidden')
    }

    function showHint() {
      hideAll()
      hint.classList.remove('hidden')
    }

    function updateEmptyState() {
      const hasExact = !exactSection.classList.contains('hidden')
      const hasRelated = !relatedSection.classList.contains('hidden')
      const relatedStillLoading = !relatedLoading.classList.contains('hidden')
      if (!hasExact && !hasRelated && !relatedStillLoading) {
        noResults.classList.remove('hidden')
      }
    }

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close()
    })

    dialog.addEventListener('close', () => {
      input.value = ''
      abortController?.abort()
      abortController = null
      clearTimeout(debounceTimer)
      exactItems.innerHTML = ''
      relatedItems.innerHTML = ''
      showHint()
    })

    function escapeHtml(str: string): string {
      const el = document.createElement('span')
      el.textContent = str
      return el.innerHTML
    }

    function renderCards(items: Array<{ url: string; title: string; summary?: string }>): string {
      return items
        .map((item) => {
          const url = escapeHtml(item.url)
          const title = escapeHtml(item.title)
          return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent">
        <div class="font-medium">${title}</div>
        ${item.summary ? `<div class="mt-0.5 line-clamp-1 text-muted-foreground text-xs">${escapeHtml(item.summary)}</div>` : ''}
      </a>`
        })
        .join('')
    }

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer)
      const query = input.value.trim()

      if (!query) {
        exactItems.innerHTML = ''
        relatedItems.innerHTML = ''
        showHint()
        return
      }

      debounceTimer = setTimeout(() => performSearch(query), 500)
    })

    async function performSearch(query: string) {
      abortController?.abort()
      abortController = new AbortController()

      hideAll()
      relatedLoading.classList.remove('hidden')
      relatedSection.classList.remove('hidden')

      const exactUrls = new Set<string>()

      // Fire both searches in parallel
      const pagefindPromise = searchPagefind(query, exactUrls)
      const embeddingPromise = searchEmbedding(query, abortController.signal, exactUrls)

      await Promise.allSettled([pagefindPromise, embeddingPromise])

      updateEmptyState()
    }

    async function searchPagefind(query: string, exactUrls: Set<string>) {
      const pf = await getPagefind()
      if (!pf) return

      const locale = getLocale()
      const search = await pf.search(query, {
        filters: { locale: [locale] },
      })

      const results = await Promise.all(
        search.results.slice(0, 10).map((r: any) => r.data()),
      )

      const items = results
        .filter((r: any) => r.meta?.url && r.meta?.title)
        .map((r: any) => {
          exactUrls.add(r.meta.url)
          return {
            url: r.meta.url as string,
            title: r.meta.title as string,
            summary: (r.meta.summary ?? '') as string,
          }
        })

      if (items.length > 0) {
        exactItems.innerHTML = renderCards(items)
        exactSection.classList.remove('hidden')
      }
    }

    async function searchEmbedding(
      query: string,
      signal: AbortSignal,
      exactUrls: Set<string>,
    ) {
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal,
        })
        const data = await res.json()
        const isZh = getLocale() === 'zh-CN'

        const items = (data.results ?? [])
          .map((r: Record<string, unknown>) => ({
            url: r.url as string,
            title: (isZh ? r.titleZh : r.titleEn) as string,
            summary: ((isZh ? r.summaryZh : r.summaryEn) ?? '') as string,
          }))
          .filter((item: { url: string }) => !exactUrls.has(item.url))

        relatedLoading.classList.add('hidden')

        if (items.length > 0) {
          relatedItems.innerHTML = renderCards(items)
          relatedSection.classList.remove('hidden')
        } else {
          relatedSection.classList.add('hidden')
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          relatedLoading.classList.add('hidden')
          relatedSection.classList.add('hidden')
        }
      }
    }
  })
</script>
```

- [ ] **Step 3: Verify the full file compiles**

```bash
cd /Users/yikzero/Code/rover && bun run check
```

Expected: No type errors.

- [ ] **Step 4: Test locally with a build**

```bash
cd /Users/yikzero/Code/rover && bun build && bun preview
```

Open `http://localhost:47501`, press Cmd+K, type a search query. Verify:
- Exact matches section appears instantly with Pagefind results
- Related section shows skeleton loading, then embedding results
- Duplicate articles (same URL) only appear in exact matches, not in related
- If Pagefind finds nothing, exact matches section is hidden
- If embedding finds nothing (or fails), related section is hidden
- If both find nothing, empty state (search-x icon) appears

- [ ] **Step 5: Commit**

```bash
git add src/components/search-dialog.astro
git commit -m "feat: hybrid search with Pagefind exact matches and embedding recommendations"
```
