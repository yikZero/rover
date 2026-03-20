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

`output: 'static'` (default). Most pages prerendered. Only API endpoints and the home page use `prerender = false`.

| Route | Rendering | Reason |
|-------|-----------|--------|
| `/` | SSR (`prerender = false`) | Shows latest digest, changes daily |
| `/digests` | Static | Shell page, list loaded client-side via `/api/digests` |
| `/digests/[date]` | SSR (`prerender = false`) | Dynamic dates from DB, cached via headers |
| `/en/...` | Mirrors above | English locale prefix |
| `GET /api/digests` | SSR | DB cursor pagination |
| `GET /api/digests/[date]` | SSR | DB lookup |
| `POST /api/search` | SSR | Gemini embedding + pgvector |
| `POST /api/revalidate` | SSR | Cache invalidation from pipeline |

An adapter is required for SSR routes. Use `@astrojs/vercel` (current deployment) or `@astrojs/cloudflare` (future option).

## File Structure

```
src/
├── pages/
│   ├── index.astro                      # Home (latest digest) — SSR
│   ├── digests/
│   │   ├── index.astro                  # Digest history — static shell
│   │   └── [date].astro                 # Single digest — SSR
│   ├── en/
│   │   ├── index.astro                  # English home
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
│   └── base.astro                       # Root layout (html, head, body, ClientRouter)
├── components/
│   ├── digest-card.astro                # Article card (pure HTML, no JS)
│   ├── digest-list.astro                # Infinite-scroll digest list (+ <script>)
│   ├── search-dialog.astro              # Cmd+K search dialog (+ <script>)
│   ├── score-badge.astro                # Score badge (pure HTML)
│   ├── locale-switcher.astro            # Language toggle (+ <script>)
│   └── skeleton.astro                   # Loading skeleton (pure CSS)
├── i18n/
│   ├── ui.ts                            # Translation strings { 'zh-CN': {...}, en: {...} }
│   └── utils.ts                         # getLocaleFromUrl(), useTranslations(), getLocalePath()
├── lib/
│   ├── db.ts                            # Drizzle client (import.meta.env.DATABASE_URL)
│   ├── schema.ts                        # Drizzle schema (unchanged)
│   ├── queries.ts                       # Data fetching (remove 'use cache', use plain async)
│   └── utils.ts                         # cn() utility
├── styles/
│   └── globals.css                      # Tailwind v4 + OKLch theme (from app/globals.css)
└── env.d.ts                             # Astro env type declarations
```

### Page Duplication for i18n

Astro's built-in i18n uses locale-prefixed directories. Default locale (zh-CN) pages live at root, English pages under `src/pages/en/`. To avoid code duplication, each page file is a thin wrapper importing a shared component:

```astro
---
// src/pages/index.astro (zh-CN)
import DigestPage from '../components/pages/home.astro'
---
<DigestPage locale="zh-CN" />
```

```astro
---
// src/pages/en/index.astro
import DigestPage from '../../components/pages/home.astro'
---
<DigestPage locale="en" />
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

Manual translation object replacing next-intl:

```ts
// src/i18n/ui.ts
export const ui = {
  'zh-CN': {
    'home.todaysDigest': '今天的摘要',
    'home.latestDigest': '最新摘要',
    'home.fetched': '共获取 {count} 篇文章',
    'home.selected': '精选 {count} 篇',
    'search.placeholder': '搜索文章...',
    // ... all keys from messages/zh-CN.json flattened
  },
  en: {
    'home.todaysDigest': "Today's Digest",
    'home.latestDigest': 'Latest Digest',
    // ... all keys from messages/en.json flattened
  }
} as const

export function useTranslations(locale: string) {
  return (key: string, params?: Record<string, string | number>) => {
    let text = ui[locale]?.[key] ?? ui['zh-CN'][key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v))
      }
    }
    return text
  }
}
```

### Locale Detection

```ts
// src/i18n/utils.ts
export function getLocaleFromUrl(url: URL): 'zh-CN' | 'en' {
  const segment = url.pathname.split('/')[1]
  return segment === 'en' ? 'en' : 'zh-CN'
}

export function getLocalePath(path: string, locale: string): string {
  return locale === 'zh-CN' ? path : `/en${path}`
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

### 2. Infinite Scroll (Digest History)

`IntersectionObserver` + `fetch()` in a `<script>` tag. Replaces SWR `useSWRInfinite`.

Behavior:
- Page renders initial empty container
- Script fetches first page from `GET /api/digests`
- Sentinel `<div>` at bottom triggers next page load on intersection
- Each page appends digest cards to the container
- Stops when API returns `nextCursor: null`
- Shows loading skeleton during fetch

Implementation: `digest-list.astro` contains the container HTML and a `<script>` that manages cursor state, fetches JSON, creates DOM elements from a template, and observes the sentinel.

### 3. Locale Switcher

Simple `<a>` tag that navigates to the opposite locale path.

```astro
---
const locale = getLocaleFromUrl(Astro.url)
const targetLocale = locale === 'zh-CN' ? 'en' : 'zh-CN'
const targetPath = getLocalePath(Astro.url.pathname.replace(/^\/en/, ''), targetLocale)
const label = locale === 'zh-CN' ? 'English' : '中文'
---
<a href={targetPath}>{label}</a>
```

No JS needed — it's a regular navigation link. With `<ClientRouter />`, the transition will be smooth.

## Data Layer

### Drizzle ORM

`lib/schema.ts` — **unchanged**. Same 7 tables, same relations.

`lib/db.ts` — minor change:
```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const client = postgres(import.meta.env.DATABASE_URL)
export const db = drizzle(client)
```

`lib/queries.ts` — remove `'use cache'` directives, `cacheTag`, `cacheLife`. Convert to plain async functions. Caching handled by HTTP Cache-Control headers on API responses and Astro's static prerendering.

### API Endpoints

All endpoints at `src/pages/api/`, export named HTTP method handlers.

**GET /api/digests** (`src/pages/api/digests/index.ts`):
```ts
export const prerender = false
export async function GET({ request }) {
  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor') ?? undefined
  const data = await getDigestList(cursor)
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
    }
  })
}
```

**GET /api/digests/[date]** — same pattern with `params.date`.

**POST /api/search** — same logic, embed query with Gemini, search pgvector, return results.

**POST /api/revalidate** — Bearer auth check, but instead of `revalidateTag`, this is a no-op acknowledgment (static pages don't have runtime cache to invalidate). The pipeline can optionally trigger a Vercel redeploy via Deploy Hook for truly static pages.

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

`src/styles/globals.css` — migrated from `app/globals.css`:
- Same `@import "tailwindcss"` entry
- Same OKLch color variables for light/dark themes
- Same font stack (Inter + CJK system fonts)
- Same border radius and design tokens
- Remove any Next.js-specific utilities

### Icons

Replace `lucide-react` with static SVG inlined in Astro components. Astro compiles these to zero-JS HTML. For the few icons used (ChevronRight, ExternalLink, Search, Globe), inline the SVG paths directly.

## View Transitions

```astro
---
// src/layouts/base.astro
import { ClientRouter } from 'astro:transitions'
---
<html>
  <head>
    <ClientRouter />
  </head>
  <body>
    <slot />
  </body>
</html>
```

Provides smooth page-to-page transitions without full page reloads. Search dialog state persists across navigations via `transition:persist`.

## Dependencies

### Removed (Next.js / React ecosystem)
- `next`, `react`, `react-dom`, `next-intl`
- `@ai-sdk/google`, `ai` (use `@google/generative-ai` directly for embedding)
- `swr`, `cmdk`, `lucide-react`
- `class-variance-authority`, `tw-animate-css`
- `@tailwindcss/postcss` (use `@tailwindcss/vite` instead)
- All `shadcn/ui` components

### Retained
- `drizzle-orm`, `postgres`, `drizzle-kit` — unchanged
- `tailwindcss` — same version, different integration
- `clsx`, `tailwind-merge` — for `cn()` utility
- `@biomejs/biome` — unchanged
- `typescript` — unchanged

### Added
- `astro` — framework
- `@astrojs/vercel` — deployment adapter (or `@astrojs/cloudflare`)
- `@tailwindcss/vite` — Tailwind v4 Vite plugin
- `@google/generative-ai` — direct Gemini SDK for embeddings (replaces ai + @ai-sdk/google)

### Estimated production JS budget
- Tailwind: 0 (CSS only)
- Search dialog script: ~2KB
- Infinite scroll script: ~1.5KB
- Locale switcher: 0 (plain link)
- **Total: ~3.5KB** (vs ~60KB+ with React runtime)

## Deployment

### Vercel (recommended, current setup)
- Adapter: `@astrojs/vercel`
- Static pages served from CDN edge
- SSR pages/endpoints run as Vercel Serverless Functions
- `vercel.json` simplified or removed (Astro adapter handles config)

### Cloudflare Workers (future option)
- Adapter: `@astrojs/cloudflare`
- All routes run at edge, near-zero cold start
- Even lower memory footprint than Vercel

## Migration Checklist

1. Create `astro-migration` branch
2. Initialize Astro 6 project structure in-place
3. Migrate `globals.css` theme to `src/styles/globals.css`
4. Set up Drizzle (reuse `lib/schema.ts`, `lib/db.ts`)
5. Rewrite queries (remove Next.js cache directives)
6. Create base layout with `<ClientRouter />`
7. Implement i18n (translation object + locale utils)
8. Build page components (home, digests, digest/[date], 404)
9. Build interactive components (search dialog, infinite scroll, locale switcher)
10. Create API endpoints (digests, search, revalidate)
11. Configure Tailwind v4 via Vite plugin
12. Set up Vercel adapter
13. Update biome.json paths (app/ → src/)
14. Test all routes and features
15. Clean up removed files (app/, components/ui/, i18n/, messages/)
