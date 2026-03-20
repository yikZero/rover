# Rover Frontend: Next.js → Astro 6 Migration Design

## Goal

Migrate the rover read-only frontend from Next.js 16 to Astro 6, achieving:
- Zero UI framework runtime (no React, no shadcn/ui)
- Minimal client-side JS (< 5KB)
- Pure Astro components + vanilla JS for interactivity
- Retain all features: digests, search, infinite scroll, i18n
- Tailwind CSS v4 preserved
- Same Drizzle ORM + PostgreSQL data layer

## Rendering Strategy

`output: 'server'` — all pages SSR by default. This is the correct choice because nearly every page queries the database at request time (latest digest, digest by date, paginated list). An adapter (`@astrojs/vercel`) is required.

| Route | Rendering | Reason |
|-------|-----------|--------|
| `/` | SSR | Shows latest digest, changes daily |
| `/digests` | SSR | Server-renders initial page of digest list for fast first paint |
| `/digests/[date]` | SSR | Dynamic dates from DB; immutable once created, cached via Cache-Control headers |
| `/en/...` | Mirrors above | English locale prefix |
| `GET /api/digests` | SSR | DB cursor pagination |
| `GET /api/digests/[date]` | SSR | DB lookup |
| `POST /api/search` | SSR | Gemini embedding + pgvector |
| `POST /api/revalidate` | SSR | Pipeline compatibility endpoint |

**Future optimization**: `/digests/[date]` pages are immutable after creation. These could later be converted to prerendered static pages via `getStaticPaths` querying all dates from DB, with a deploy hook trigger when new digests are added.

## Cache & Revalidation Strategy

Since all pages are SSR (querying DB on each request), they always show fresh data. No tag-based cache invalidation is needed.

**API endpoint caching**: responses carry `Cache-Control` headers for CDN-level caching:
- `GET /api/digests`: `s-maxage=3600` (1 hour)
- `GET /api/digests/[date]`: `s-maxage=86400` (1 day, content is immutable)

**`POST /api/revalidate`**: Retained for backward compatibility with the external pipeline. Accepts Bearer auth, returns `{revalidated: true}`. Since SSR pages always query fresh DB data, this endpoint is effectively a health-check acknowledgment. If CDN cache purging is ever needed, Vercel's `purgeCache()` API can be called here.

**Vercel cron**: The current `vercel.json` defines a cron at `path: "/api/cron/daily"`, but the endpoint does not exist in the codebase. Remove this cron config during migration.

## File Structure

```
src/
├── pages/
│   ├── index.astro                      # Home (latest digest) — SSR
│   ├── digests/
│   │   ├── index.astro                  # Digest history — SSR with initial data
│   │   └── [date].astro                 # Single digest — SSR
│   ├── en/
│   │   ├── index.astro                  # English home (thin wrapper)
│   │   ├── digests/
│   │   │   ├── index.astro              # English digest history
│   │   │   └── [date].astro             # English single digest
│   │   └── 404.astro                    # English 404
│   ├── api/
│   │   ├── digests/
│   │   │   ├── index.ts                 # GET /api/digests — pagination
│   │   │   └── [date].ts               # GET /api/digests/[date]
│   │   ├── search.ts                    # POST /api/search
│   │   └── revalidate.ts               # POST /api/revalidate
│   └── 404.astro                        # Default 404
├── layouts/
│   └── base.astro                       # Root layout (html, head, meta, body, ClientRouter)
├── components/
│   ├── pages/
│   │   ├── home.astro                   # Shared home page logic (receives locale prop)
│   │   ├── digests.astro                # Shared digest list page logic
│   │   └── digest-date.astro            # Shared single digest page logic
│   ├── digest-card.astro                # Article card (pure HTML, no JS)
│   ├── digest-list.astro                # Infinite-scroll container (+ <script>)
│   ├── search-dialog.astro              # Cmd+K search dialog (+ <script>)
│   ├── score-badge.astro                # Score badge (pure HTML)
│   ├── locale-switcher.astro            # Language toggle (plain <a> link)
│   ├── empty-state.astro                # Home empty state with 3D card
│   └── icons/                           # Inline SVG icon components
│       ├── chevron-right.astro
│       ├── external-link.astro
│       ├── search.astro
│       ├── rss.astro
│       └── play.astro
├── i18n/
│   ├── ui.ts                            # Translation strings { 'zh-CN': {...}, en: {...} }
│   └── utils.ts                         # getLocaleFromUrl(), useTranslations(), richText()
├── lib/
│   ├── db.ts                            # Drizzle client (import.meta.env.DATABASE_URL)
│   ├── schema.ts                        # Drizzle schema (unchanged)
│   ├── queries.ts                       # Data fetching (plain async, no Next.js cache)
│   └── utils.ts                         # cn() utility
├── styles/
│   └── globals.css                      # Tailwind v4 + OKLch theme (cleaned up)
└── env.d.ts                             # Astro env type declarations
```

### Page Duplication for i18n

Astro's built-in i18n uses locale-prefixed directories. Default locale (zh-CN) pages live at root, English pages under `src/pages/en/`. To avoid code duplication, each page file is a thin wrapper importing a shared component:

```astro
---
// src/pages/index.astro (zh-CN)
import Home from '../components/pages/home.astro'
---
<Home locale="zh-CN" />
```

```astro
---
// src/pages/en/index.astro
import Home from '../../components/pages/home.astro'
---
<Home locale="en" />
```

Shared page components live in `src/components/pages/` and receive `locale` as a prop.

## i18n

### Configuration

```ts
// astro.config.mjs
i18n: {
  locales: ['zh-CN', 'en'],
  defaultLocale: 'zh-CN',
  routing: {
    prefixDefaultLocale: false  // zh-CN at /, en at /en/
  }
}
```

### Translations

Manual translation object replacing next-intl. Translations use `{param}` for interpolation and `<strong>...</strong>` for rich text markup.

```ts
// src/i18n/ui.ts
export const ui = {
  'zh-CN': {
    'home.todaysDigest': '今日<strong>精选</strong>',
    'home.latestDigest': '最新<strong>精选</strong>',
    'home.sources': '来源',
    'home.emptyState': '每日精选将在北京时间 10:00 自动生成',
    'home.notGenerated': '今日精选尚未生成',
    'home.fetched': '追踪 {count} 篇',
    'home.selected': '精选 {count} 篇',
    'home.history': '历史精选',
    'home.search': '搜索',
    'search.title': '搜索文章',
    'search.placeholder': '输入关键词搜索文章...',
    'search.noResults': '没有找到相关文章',
    'search.found': '找到 {count} 篇相关文章',
    'search.hint': '输入关键词开始搜索',
    'digests.digestHistory': '历史<strong>精选</strong>',
    'digests.selected': '精选 {count} 篇',
    'digests.loading': '加载中...',
    'digests.noMore': '没有更多了',
    'digestDate.digest': '<strong>精选</strong>',
    'digestDate.fetched': '追踪 {count} 篇',
    'digestDate.selected': '精选 {count} 篇',
    'card.read': '阅读',
    'error.title': '出了点问题',
    'error.retry': '重试',
    'notFound.title': '页面未找到',
    'footer.switchTo': '切换至 English',
  },
  en: {
    'home.todaysDigest': "Today's <strong>Digest</strong>",
    'home.latestDigest': 'Latest <strong>Digest</strong>',
    'home.sources': 'Sources',
    'home.emptyState': 'Daily digest auto-generated at 10:00 Beijing time',
    'home.notGenerated': "Today's digest not generated yet",
    'home.fetched': 'Tracked {count}',
    'home.selected': 'Curated {count}',
    'home.history': 'History',
    'home.search': 'Search',
    'search.title': 'Search Articles',
    'search.placeholder': 'Search articles...',
    'search.noResults': 'No matching articles found',
    'search.found': 'Found {count} articles',
    'search.hint': 'Type keywords to search',
    'digests.digestHistory': 'Digest <strong>History</strong>',
    'digests.selected': 'Selected {count}',
    'digests.loading': 'Loading...',
    'digests.noMore': 'No more digests',
    'digestDate.digest': '<strong>Digest</strong>',
    'digestDate.fetched': 'Tracked {count}',
    'digestDate.selected': 'Curated {count}',
    'card.read': 'Read',
    'error.title': 'Something went wrong',
    'error.retry': 'Try again',
    'notFound.title': 'Page not found',
    'footer.switchTo': 'Switch to 中文',
  },
} as const
```

### Translation Utilities

```ts
// src/i18n/utils.ts
import { ui } from './ui'

type Locale = 'zh-CN' | 'en'

export function getLocaleFromUrl(url: URL): Locale {
  const segment = url.pathname.split('/')[1]
  return segment === 'en' ? 'en' : 'zh-CN'
}

export function getLocalePath(path: string, locale: Locale): string {
  // Strip existing /en prefix first, then add if needed
  const cleanPath = path.replace(/^\/en(\/|$)/, '/')
  return locale === 'zh-CN' ? cleanPath : `/en${cleanPath === '/' ? '' : cleanPath}`
}

export function useTranslations(locale: Locale) {
  return (key: string, params?: Record<string, string | number>) => {
    let text = ui[locale]?.[key as keyof (typeof ui)[typeof locale]] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v))
      }
    }
    return text
  }
}

/**
 * Returns HTML string with <strong> tags styled.
 * Use with Astro's set:html directive: <h2 set:html={richText(t('key'), 'class')} />
 */
export function richText(text: string, strongClass = 'font-semibold text-foreground'): string {
  return text.replace(/<strong>(.*?)<\/strong>/g, `<strong class="${strongClass}">$1</strong>`)
}
```

## Interactive Components

### 1. Search Dialog (Cmd+K)

Native `<dialog>` element + vanilla JS. Replaces shadcn Command + cmdk + React.

Behavior:
- `Cmd+K` / `Ctrl+K` opens modal dialog
- Debounced input (500ms) sends `POST /api/search` with `{query}`
- Results rendered as a list with title, summary, score
- Click opens article URL in new tab
- `Escape` or backdrop click closes
- AbortController cancels in-flight requests on new input

Implementation: All in `search-dialog.astro` with a `<script>` tag. HTML structure uses `<dialog>` with `<input>` and `<ul>` for results. JS handles keyboard shortcuts, debounce, fetch, and DOM updates.

**Locale awareness**: The script reads `document.documentElement.lang` to determine whether to display `titleZh`/`summaryZh` or `titleEn`/`summaryEn` from API results.

### 2. Infinite Scroll (Digest History)

`IntersectionObserver` + `fetch()` in a `<script>` tag. Replaces SWR `useSWRInfinite`.

Behavior:
- `/digests` page server-renders the first page of digests (no empty/loading first paint)
- Script reads `data-next-cursor` from the container to initialize cursor state
- Sentinel `<div>` at bottom triggers next page load on intersection
- Each page appends digest cards using a `<template>` element cloned for each card
- Stops when API returns `nextCursor: null`
- Shows loading skeleton during fetch

**Locale awareness**: The script reads `document.documentElement.lang` to select the correct title/summary fields when building DOM elements from API JSON.

Implementation: `digest-list.astro` contains:
1. Server-rendered initial digest cards (from SSR data)
2. A `<template>` element defining the card HTML structure
3. A `<script>` that manages cursor state, fetches JSON, clones template, and observes sentinel

### 3. Locale Switcher

Plain `<a>` link — no JS needed. With `<ClientRouter />`, navigation is smooth.

```astro
---
const locale = getLocaleFromUrl(Astro.url)
const targetLocale = locale === 'zh-CN' ? 'en' : 'zh-CN'
const cleanPath = Astro.url.pathname.replace(/^\/en(\/|$)/, '/')
const targetPath = getLocalePath(cleanPath, targetLocale)
const label = locale === 'zh-CN' ? 'English' : '中文'
---
<a href={targetPath}>{label}</a>
```

`<ClientRouter />` handles this as a client-side navigation with view transition, not a full page reload.

## Error Handling

Astro does not have automatic `error.tsx` or `loading.tsx` boundaries. Strategy:

**SSR pages**: Wrap database queries in try/catch in the frontmatter. On error, render an inline error state with a retry link (navigating to the same URL).

```astro
---
let digest = null
let error = false
try {
  digest = await getLatestDigest()
} catch {
  error = true
}
---
{error ? (
  <div class="text-center py-20">
    <p class="text-muted-foreground">{t('error.title')}</p>
    <a href={Astro.url.pathname} class="mt-4 text-sm underline">{t('error.retry')}</a>
  </div>
) : (
  <!-- normal content -->
)}
```

**Loading states**: Not applicable for SSR (response streams after data is ready). For client-side infinite scroll, loading skeletons are shown inline via the script.

## Data Layer

### Drizzle ORM

`lib/schema.ts` — **unchanged**. Same 7 tables, same relations.

`lib/db.ts` — uses `import.meta.env.DATABASE_URL` in Astro context:
```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const client = postgres(import.meta.env.DATABASE_URL)
export const db = drizzle(client)
```

**Note**: `drizzle.config.ts` continues to use `process.env.DATABASE_URL` since it runs via drizzle-kit CLI (Node.js context, not Vite).

**Connection pooling**: The `postgres` library has built-in connection pooling. For Vercel serverless, ensure the `DATABASE_URL` points to Supabase's connection pooler (port 6543) rather than direct connection.

`lib/queries.ts` — remove `'use cache'` directives, `cacheTag`, `cacheLife` imports. Convert to plain async functions. The four functions are retained:
- `getLatestDigest()` — used by home page
- `getDigestByDate(date)` — used by `/digests/[date]`
- `getDigestList(cursor?)` — used by `/digests` page and `GET /api/digests`
- `getActiveFeeds()` — **remove** (not used; empty state has hardcoded source types)

### API Endpoints

All endpoints at `src/pages/api/`, export named HTTP method handlers.

**GET /api/digests** (`src/pages/api/digests/index.ts`):
```ts
import type { APIRoute } from 'astro'
import { getDigestList } from '../../../lib/queries'

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor') ?? undefined
  const data = await getDigestList(cursor)
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
```

**GET /api/digests/[date]** — same pattern with `params.date`.

**POST /api/search** — embed query with `@google/generative-ai` (direct SDK), search pgvector cosine distance, return top 10 results above 0.6 threshold.

**POST /api/revalidate** — Bearer auth check against `CRON_SECRET`. Returns `{revalidated: true, tag}` for pipeline compatibility. Effectively a health-check since SSR pages always query fresh data.

## Styling

### Tailwind CSS v4

Installed via `@tailwindcss/vite` plugin (not `@astrojs/tailwind` which is v3 only).

```ts
// astro.config.mjs
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  vite: { plugins: [tailwindcss()] }
})
```

### globals.css Cleanup

`src/styles/globals.css` — migrated from `app/globals.css` with these changes:
- **Remove** `@import "tw-animate-css"` (shadcn animation dependency)
- **Remove** `@import "shadcn/tailwind.css"` (shadcn base styles)
- **Remove** all `--sidebar-*` CSS variables (sidebar not used)
- **Remove** all `--color-sidebar-*` theme mappings
- **Remove** `--chart-*` variables and mappings (chart colors not used)
- **Keep** core theme: `--background`, `--foreground`, `--primary`, `--muted`, `--border`, etc.
- **Keep** OKLch color system, font stack, border radius tokens, dark mode

**Dark mode**: The current `.dark` class variant (`@custom-variant dark (&:is(.dark *))`) is retained. This follows system preference — no manual toggle exists in the current UI. If system-preference-only is desired, this could be simplified to `@media (prefers-color-scheme: dark)`, but keeping the class-based approach allows adding a toggle later.

### Icons

Replace `lucide-react` with inline SVG Astro components. Icons used in the project:
- `ChevronRight` — digest card link, history link
- `ExternalLink` — (if used in card)
- `Search` — search button
- `Rss` — empty state source list
- `Play` — empty state source list header

Each is a simple `.astro` file exporting an inline `<svg>` element with Astro props for `class`.

## View Transitions

```astro
---
// src/layouts/base.astro
import { ClientRouter } from 'astro:transitions'
---
<html lang={locale}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Rover</title>
    <meta name="description" content="AI-curated daily tech article digest" />
    <ClientRouter />
  </head>
  <body class="bg-background text-foreground">
    <main class="mx-auto max-w-5xl px-6 py-12 md:py-16">
      <slot />
    </main>
  </body>
</html>
```

- Smooth page-to-page transitions without full reloads
- Search dialog persists across navigations via `transition:persist`
- `lang` attribute set dynamically from locale prop

## Dependencies

### Removed (Next.js / React ecosystem)
- `next`, `react`, `react-dom`
- `next-intl`
- `@ai-sdk/google`, `ai` (replaced by `@google/generative-ai`)
- `swr`, `cmdk`, `lucide-react`
- `class-variance-authority`, `tw-animate-css`
- `@tailwindcss/postcss` (replaced by `@tailwindcss/vite`)
- `@base-ui/react`
- `shadcn` (dev dependency)
- `@types/react`, `@types/react-dom`
- All `shadcn/ui` components in `components/ui/`

### Retained
- `drizzle-orm`, `postgres`, `drizzle-kit` — unchanged
- `tailwindcss` — same version, Vite plugin integration
- `clsx`, `tailwind-merge` — for `cn()` utility
- `@biomejs/biome` — unchanged
- `typescript` — unchanged
- `husky`, `lint-staged` — unchanged

### Added
- `astro` — framework
- `@astrojs/vercel` — deployment adapter
- `@tailwindcss/vite` — Tailwind v4 Vite plugin
- `@google/generative-ai` — direct Gemini SDK for embeddings (lighter than ai + @ai-sdk/google)

### Estimated production JS budget
- Tailwind: 0 (CSS only)
- Search dialog script: ~2KB
- Infinite scroll script: ~1.5KB
- Locale switcher: 0 (plain link)
- **Total: ~3.5KB** (vs ~60KB+ with React runtime)

## Deployment

### Vercel (current setup, keep for initial migration)
- Adapter: `@astrojs/vercel`
- SSR routes run as Vercel Serverless Functions
- `vercel.json`: remove the `crons` config (endpoint doesn't exist)

### Cloudflare Workers (future option)
- Adapter: `@astrojs/cloudflare`
- All routes run at edge, near-zero cold start
- Even lower memory footprint than Vercel

## Biome Configuration

Update `biome.json` includes from `["app/**", "lib/**", "components/**"]` to `["src/**"]` since all source code moves under `src/`.

## Migration Checklist

1. Create `astro-migration` branch
2. Initialize Astro 6 project in-place (astro.config.mjs, tsconfig, env.d.ts)
3. Configure Tailwind v4 via `@tailwindcss/vite`
4. Migrate and clean up `globals.css` → `src/styles/globals.css`
5. Move and adapt `lib/` (schema, db, queries, utils) to `src/lib/`
6. Create i18n system (ui.ts translations, utils.ts helpers)
7. Create base layout with `<ClientRouter />`, meta tags, global styles
8. Create inline SVG icon components in `src/components/icons/`
9. Build static components (digest-card, score-badge, empty-state, skeleton)
10. Build interactive components (search-dialog, digest-list with infinite scroll)
11. Build shared page components (home, digests, digest-date)
12. Create page files for both locales (thin wrappers)
13. Create API endpoints (digests, search, revalidate)
14. Create 404 pages
15. Set up `@astrojs/vercel` adapter
16. Update `biome.json` includes to `src/`
17. Update `package.json` scripts (dev → `astro dev`, build → `astro build`)
18. Remove old Next.js files (app/, components/ui/, i18n/, messages/, next.config.ts, etc.)
19. Remove `vercel.json` cron config
20. Test all routes and features
