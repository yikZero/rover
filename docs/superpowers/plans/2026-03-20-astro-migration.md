# Astro 6 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate rover frontend from Next.js 16 to Astro 6 with zero React runtime, retaining all features (digests, search, infinite scroll, i18n).

**Architecture:** Pure Astro 6 SSR (`output: 'server'`) with `@astrojs/vercel` adapter. All UI built with `.astro` components + vanilla `<script>` tags for interactivity. Drizzle ORM data layer unchanged. Tailwind CSS v4 via Vite plugin.

**Tech Stack:** Astro 6, Tailwind CSS v4, Drizzle ORM, PostgreSQL, `@google/generative-ai`, vanilla JS

**Spec:** `docs/superpowers/specs/2026-03-20-astro-migration-design.md`

---

### Task 1: Create migration branch and initialize Astro 6 project

**Files:**
- Create: `astro.config.mjs`
- Create: `src/env.d.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Create branch**

```bash
git checkout -b astro-migration
```

- [ ] **Step 2: Remove Next.js deps, install Astro deps**

```bash
bun remove next react react-dom next-intl @ai-sdk/google ai swr cmdk lucide-react class-variance-authority tw-animate-css @tailwindcss/postcss @base-ui/react shadcn @types/react @types/react-dom
bun add astro @astrojs/vercel @google/generative-ai
bun add -D @tailwindcss/vite
```

- [ ] **Step 3: Create `astro.config.mjs`**

```js
import tailwindcss from '@tailwindcss/vite'
import vercel from '@astrojs/vercel'
import { defineConfig } from 'astro/config'

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  i18n: {
    locales: ['zh-CN', 'en'],
    defaultLocale: 'zh-CN',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
```

- [ ] **Step 4: Create `src/env.d.ts`**

```ts
/// <reference types="astro/client" />
```

- [ ] **Step 5: Update `tsconfig.json`**

Replace contents with:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 6: Update `package.json` scripts**

Replace the `scripts` section:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "bunx @biomejs/biome check --write --unsafe .",
    "prepare": "husky",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize Astro 6 project structure"
```

---

### Task 2: Migrate styles and set up Tailwind CSS v4

**Files:**
- Create: `src/styles/globals.css`
- Create: `src/lib/utils.ts`

- [ ] **Step 1: Create `src/styles/globals.css`**

Cleaned-up version of `app/globals.css` — removes `tw-animate-css`, `shadcn/tailwind.css`, sidebar variables, and chart variables:

```css
@import "tailwindcss";

@theme inline {
  --font-sans:
    Inter, -apple-system, system-ui, "Segoe UI", "Noto Sans", sans-serif,
    BlinkMacSystemFont, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", Arial;
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 2: Create `src/lib/utils.ts`**

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css src/lib/utils.ts
git commit -m "feat: migrate Tailwind CSS v4 styles and cn() utility"
```

---

### Task 3: Set up i18n system

**Files:**
- Create: `src/i18n/ui.ts`
- Create: `src/i18n/utils.ts`

- [ ] **Step 1: Create `src/i18n/ui.ts`**

Flatten all translations from `messages/zh-CN.json` and `messages/en.json`:

```ts
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

export type Locale = keyof typeof ui
export type TranslationKey = keyof (typeof ui)['zh-CN']
```

- [ ] **Step 2: Create `src/i18n/utils.ts`**

```ts
import { ui } from './ui'
import type { Locale, TranslationKey } from './ui'

export type { Locale }

export function getLocaleFromUrl(url: URL): Locale {
  const segment = url.pathname.split('/')[1]
  return segment === 'en' ? 'en' : 'zh-CN'
}

export function getLocalePath(path: string, locale: Locale): string {
  const cleanPath = path.replace(/^\/en(\/|$)/, '/')
  if (locale === 'zh-CN') return cleanPath
  return `/en${cleanPath === '/' ? '' : cleanPath}`
}

export function useTranslations(locale: Locale) {
  return (key: TranslationKey, params?: Record<string, string | number>) => {
    let text: string = ui[locale]?.[key] ?? ui['zh-CN'][key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v))
      }
    }
    return text
  }
}

export function richText(
  text: string,
  strongClass = 'font-semibold text-foreground',
): string {
  return text.replace(
    /<strong>(.*?)<\/strong>/g,
    `<strong class="${strongClass}">$1</strong>`,
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/
git commit -m "feat: add i18n translation system"
```

---

### Task 4: Migrate data layer (Drizzle ORM + queries)

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/db.ts`
- Create: `src/lib/schema.ts` (copy from `lib/schema.ts`)
- Create: `src/lib/queries.ts` (adapted from `lib/queries.ts`)
- Modify: `drizzle.config.ts` (update schema path)

- [ ] **Step 1: Copy schema unchanged**

```bash
mkdir -p src/lib
cp lib/schema.ts src/lib/schema.ts
```

The schema file has no Next.js dependencies — it uses only `drizzle-orm` and `drizzle-orm/pg-core`. No changes needed.

- [ ] **Step 2: Create `src/lib/types.ts`**

Shared types used across components, pages, and API endpoints:

```ts
export interface DigestArticle {
  rank: number
  titleZh: string
  titleEn: string
  summaryZh: string
  summaryEn: string
  finalScore: string
  url: string
  feedTitle: string
}

export interface DigestWithArticles {
  date: string
  articles: DigestArticle[]
  stats: { fetched: number; scored: number; selected: number }
}
```

- [ ] **Step 3: Create `src/lib/db.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const connectionString = import.meta.env.DATABASE_URL ?? ''
const client = postgres(connectionString)

export const db = drizzle({ client })
```

Key change: `process.env` → `import.meta.env` for Vite/Astro context.

- [ ] **Step 4: Create `src/lib/queries.ts`**

Complete adapted version — removes all Next.js cache directives, removes `getActiveFeeds()`, updates `getDigestList()` to return `stats` sub-object matching the shape used by all consumers:

```ts
import { desc, eq, inArray, lt } from 'drizzle-orm'
import { db } from './db'
import { articles, dailyDigests, digestArticles, feeds } from './schema'
import type { DigestArticle, DigestWithArticles } from './types'

const digestArticleSelect = {
  rank: digestArticles.rank,
  titleZh: digestArticles.titleZh,
  titleEn: digestArticles.titleEn,
  summaryZh: digestArticles.summaryZh,
  summaryEn: digestArticles.summaryEn,
  finalScore: digestArticles.finalScore,
  url: articles.url,
  feedTitle: feeds.title,
}

function digestArticlesQuery(digestId: number) {
  return db
    .select(digestArticleSelect)
    .from(digestArticles)
    .innerJoin(articles, eq(digestArticles.articleId, articles.id))
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(eq(digestArticles.digestId, digestId))
    .orderBy(digestArticles.rank)
}

export async function getLatestDigest(): Promise<DigestWithArticles | null> {
  const [digest] = await db
    .select()
    .from(dailyDigests)
    .orderBy(desc(dailyDigests.date))
    .limit(1)

  if (!digest) return null

  const items = await digestArticlesQuery(digest.id)

  return {
    date: digest.date,
    articles: items as DigestArticle[],
    stats: {
      fetched: digest.totalFetched,
      scored: digest.totalScored,
      selected: digest.totalSelected,
    },
  }
}

export async function getDigestByDate(
  date: string,
): Promise<DigestWithArticles | null> {
  const [digest] = await db
    .select()
    .from(dailyDigests)
    .where(eq(dailyDigests.date, date))
    .limit(1)

  if (!digest) return null

  const items = await digestArticlesQuery(digest.id)

  return {
    date: digest.date,
    articles: items as DigestArticle[],
    stats: {
      fetched: digest.totalFetched,
      scored: digest.totalScored,
      selected: digest.totalSelected,
    },
  }
}

export async function getDigestList(cursor?: string): Promise<{
  digests: DigestWithArticles[]
  nextCursor: string | null
}> {
  const limit = 10
  const conditions = cursor ? lt(dailyDigests.date, cursor) : undefined

  const digests = await db
    .select()
    .from(dailyDigests)
    .where(conditions)
    .orderBy(desc(dailyDigests.date))
    .limit(limit + 1)

  const hasMore = digests.length > limit
  const results = hasMore ? digests.slice(0, limit) : digests
  const nextCursor = hasMore ? results[results.length - 1].date : null

  // Batch fetch all articles (fixes N+1: was 11 queries, now 2)
  const digestIds = results.map((d) => d.id)
  const allItems =
    digestIds.length > 0
      ? await db
          .select({
            ...digestArticleSelect,
            digestId: digestArticles.digestId,
          })
          .from(digestArticles)
          .innerJoin(articles, eq(digestArticles.articleId, articles.id))
          .innerJoin(feeds, eq(articles.feedId, feeds.id))
          .where(inArray(digestArticles.digestId, digestIds))
          .orderBy(digestArticles.digestId, digestArticles.rank)
      : []

  // Group by digestId
  const articlesByDigest = new Map<number, DigestArticle[]>()
  for (const item of allItems) {
    const { digestId, ...article } = item
    if (!articlesByDigest.has(digestId)) {
      articlesByDigest.set(digestId, [])
    }
    articlesByDigest.get(digestId)?.push(article as DigestArticle)
  }

  const digestsWithArticles: DigestWithArticles[] = results.map((digest) => ({
    date: digest.date,
    articles: articlesByDigest.get(digest.id) ?? [],
    stats: {
      fetched: digest.totalFetched,
      scored: digest.totalScored,
      selected: digest.totalSelected,
    },
  }))

  return { digests: digestsWithArticles, nextCursor }
}
```

- [ ] **Step 5: Update `drizzle.config.ts`**

Change schema path from `'./lib/schema.ts'` to `'./src/lib/schema.ts'`:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle',
  schema: './src/lib/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
})
```

Note: `drizzle.config.ts` keeps `process.env` since it runs via drizzle-kit CLI (Node.js context, not Vite).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ drizzle.config.ts
git commit -m "feat: migrate Drizzle ORM data layer to Astro"
```

---

### Task 5: Create base layout and icon components

**Files:**
- Create: `src/layouts/base.astro`
- Create: `src/components/icons/chevron-right.astro`
- Create: `src/components/icons/search-icon.astro`
- Create: `src/components/icons/rss.astro`
- Create: `src/components/icons/play.astro`

- [ ] **Step 1: Create `src/layouts/base.astro`**

```astro
---
import { ClientRouter } from 'astro:transitions'
import '@/styles/globals.css'

interface Props {
  title?: string
  description?: string
  locale?: 'zh-CN' | 'en'
}

const {
  title = 'Rover',
  description = 'AI-curated daily tech article digest',
  locale = 'zh-CN',
} = Astro.props
---

<html lang={locale} class="antialiased">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <ClientRouter />
  </head>
  <body>
    <main class="mx-auto max-w-5xl px-6 py-12 md:py-16">
      <slot />
    </main>
  </body>
</html>
```

- [ ] **Step 2: Create icon components**

Each icon is a `.astro` file that accepts a `class` prop and renders an inline SVG. Extract SVG paths from lucide-react source.

`src/components/icons/chevron-right.astro`:
```astro
---
interface Props { class?: string }
const { class: className = 'size-4' } = Astro.props
---
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={className}><path d="m9 18 6-6-6-6"/></svg>
```

`src/components/icons/search-icon.astro`:
```astro
---
interface Props { class?: string }
const { class: className = 'size-4' } = Astro.props
---
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={className}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
```

`src/components/icons/rss.astro`:
```astro
---
interface Props { class?: string }
const { class: className = 'size-4' } = Astro.props
---
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={className}><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>
```

`src/components/icons/play.astro`:
```astro
---
interface Props { class?: string }
const { class: className = 'size-4' } = Astro.props
---
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" class={className}><polygon points="6 3 20 12 6 21 6 3"/></svg>
```

- [ ] **Step 3: Commit**

```bash
git add src/layouts/ src/components/icons/
git commit -m "feat: add base layout and icon components"
```

---

### Task 6: Build core UI components

**Files:**
- Create: `src/components/score-badge.astro`
- Create: `src/components/digest-card.astro`
- Create: `src/components/skeleton.astro`
- Create: `src/components/empty-state.astro`
- Create: `src/components/locale-switcher.astro`

- [ ] **Step 1: Create `src/components/score-badge.astro`**

```astro
---
interface Props {
  rank: number
  finalScore: string
}

const { rank, finalScore } = Astro.props
const isTop = rank <= 3
---

<div
  class:list={[
    'inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold text-xs',
    isTop
      ? 'bg-primary text-primary-foreground'
      : 'bg-muted text-muted-foreground',
  ]}
>
  {finalScore}
</div>
```

- [ ] **Step 2: Create `src/components/digest-card.astro`**

Port from `components/digest-card.tsx`. Replace `useLocale()` with a `locale` prop. Preserve the original `<article>` semantic element, grid layout, and card-overlay link pattern (`before:absolute before:inset-0`). Use shared `DigestArticle` type from `lib/types.ts`.

```astro
---
import type { Locale } from '@/i18n/utils'
import type { DigestArticle } from '@/lib/types'
import ScoreBadge from './score-badge.astro'
import ChevronRight from './icons/chevron-right.astro'

interface Props {
  article: DigestArticle
  locale: Locale
}

const { article, locale } = Astro.props
const title = locale === 'en' ? article.titleEn : article.titleZh
const summary = locale === 'en' ? article.summaryEn : article.summaryZh
---

<div>
  <div
    aria-hidden
    class="h-px bg-[length:4px_1px] bg-repeat-x opacity-20 [background-image:linear-gradient(90deg,var(--color-foreground)_1px,transparent_1px)]"
  ></div>
  <article class="group relative grid gap-4 py-5 md:grid-cols-[1fr_auto] md:gap-8">
    <div class="grid gap-3 md:grid-cols-[auto_1fr]">
      <span class="text-muted-foreground text-sm tabular-nums md:w-10">
        #{article.rank}
      </span>
      <div>
        <h3 class="font-medium leading-snug">{title}</h3>
        <p class="mt-1 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
          {summary}
        </p>
      </div>
    </div>
    <div class="flex items-center gap-6 max-md:justify-between">
      <ScoreBadge rank={article.rank} finalScore={article.finalScore} />
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={article.titleEn}
        class="flex items-center gap-1 font-medium text-primary text-sm transition-colors duration-200 before:absolute before:inset-0 hover:text-foreground"
      >
        <ChevronRight class="size-3.5 translate-y-px duration-200 group-hover:translate-x-0.5" />
      </a>
    </div>
  </article>
</div>
```

- [ ] **Step 3: Create `src/components/skeleton.astro`**

Replace shadcn/ui `<Skeleton>` with a simple Astro component:

```astro
---
interface Props {
  class?: string
}

const { class: className = '' } = Astro.props
---

<div class:list={['animate-pulse rounded-md bg-muted', className]}></div>
```

- [ ] **Step 4: Create `src/components/empty-state.astro`**

Port the home page empty state from `app/[locale]/page.tsx`:

```astro
---
import { useTranslations } from '@/i18n/utils'
import type { Locale } from '@/i18n/utils'
import Rss from './icons/rss.astro'
import Play from './icons/play.astro'

interface Props {
  locale: Locale
}

const { locale } = Astro.props
const t = useTranslations(locale)

const sourceTypes = [
  'Tech News',
  'Developer Blogs',
  'Open Source',
  'Design & UX',
  'AI & ML',
]
---

<div class="flex flex-col items-center justify-center py-20">
  <div aria-hidden class="relative min-w-64">
    <div class="perspective-dramatic flex flex-col gap-3">
      <div class="mask-radial-[100%_100%] mask-radial-at-top-left mask-radial-from-75% -rotate-4 rotate-x-5 rotate-z-6 pt-1 pl-5">
        <div class="rounded-tl-xl bg-background/75 px-2 pt-3 shadow-black/6.5 shadow-lg ring-1 ring-border">
          <div class="mb-2 flex items-center gap-2 px-2.5 font-medium text-muted-foreground text-sm">
            {t('home.sources')}{' '}
            <Play class="size-2 translate-y-0.5 rotate-90 fill-current opacity-50" />
          </div>
          <div class="flex flex-col gap-3.5 rounded-tl-lg bg-muted/50 pt-3.5 pl-4 shadow ring-1 ring-border">
            {sourceTypes.map((type) => (
              <div class="flex items-center gap-2">
                <Rss class="size-3.5 text-muted-foreground" />
                <span class="text-sm">{type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
  <p class="mt-8 text-md text-muted-foreground">{t('home.emptyState')}</p>
</div>
```

- [ ] **Step 5: Create `src/components/locale-switcher.astro`**

```astro
---
import { getLocaleFromUrl, getLocalePath, useTranslations } from '@/i18n/utils'

const locale = getLocaleFromUrl(Astro.url)
const t = useTranslations(locale)
const targetLocale = locale === 'zh-CN' ? 'en' : 'zh-CN'
const cleanPath = Astro.url.pathname.replace(/^\/en(\/|$)/, '/')
const targetPath = getLocalePath(cleanPath, targetLocale)
---

<a
  href={targetPath}
  class="text-muted-foreground text-sm transition-colors hover:text-foreground"
>
  {t('footer.switchTo')}
</a>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: add core UI components (digest-card, score-badge, skeleton, empty-state, locale-switcher)"
```

---

### Task 7: Build search dialog component

**Files:**
- Create: `src/components/search-dialog.astro`

- [ ] **Step 1: Create `src/components/search-dialog.astro`**

Native `<dialog>` + vanilla JS. Replaces shadcn Command + cmdk + React. Read `document.documentElement.lang` for locale-aware results.

```astro
---
import { getLocaleFromUrl, useTranslations } from '@/i18n/utils'
import SearchIcon from './icons/search-icon.astro'

const locale = getLocaleFromUrl(Astro.url)
const t = useTranslations(locale)
---

<button
  type="button"
  id="search-trigger"
  class="flex items-center gap-2 rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
  aria-label={t('home.search')}
>
  <SearchIcon class="size-4" />
  <span class="hidden md:inline">{t('home.search')}</span>
</button>

<dialog
  id="search-dialog"
  class="m-0 mx-auto mt-[20vh] w-full max-w-lg rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-lg backdrop:bg-black/50"
>
  <div class="flex items-center border-border border-b px-4">
    <SearchIcon class="mr-2 size-4 shrink-0 text-muted-foreground" />
    <input
      id="search-input"
      type="text"
      placeholder={t('search.placeholder')}
      class="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      autocomplete="off"
    />
  </div>
  <div id="search-results" class="max-h-80 overflow-y-auto p-2">
    <p class="py-6 text-center text-muted-foreground text-sm" id="search-hint">
      {t('search.hint')}
    </p>
  </div>
</dialog>

<script>
  const trigger = document.getElementById('search-trigger')!
  const dialog = document.getElementById('search-dialog') as HTMLDialogElement
  const input = document.getElementById('search-input') as HTMLInputElement
  const resultsContainer = document.getElementById('search-results')!
  const hint = document.getElementById('search-hint')!

  let debounceTimer: ReturnType<typeof setTimeout>
  let abortController: AbortController | null = null

  function getLocale(): string {
    return document.documentElement.lang || 'zh-CN'
  }

  trigger.addEventListener('click', () => {
    dialog.showModal()
    input.focus()
  })

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      dialog.showModal()
      input.focus()
    }
  })

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close()
  })

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    const query = input.value.trim()

    if (!query) {
      resultsContainer.innerHTML = ''
      resultsContainer.appendChild(hint)
      return
    }

    debounceTimer = setTimeout(() => performSearch(query), 500)
  })

  async function performSearch(query: string) {
    abortController?.abort()
    abortController = new AbortController()

    resultsContainer.innerHTML =
      '<div class="space-y-2 p-2">' +
      Array(3)
        .fill('<div class="h-12 animate-pulse rounded-md bg-muted"></div>')
        .join('') +
      '</div>'

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: abortController.signal,
      })
      const data = await res.json()
      renderResults(data.results)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        resultsContainer.innerHTML =
          '<p class="py-6 text-center text-muted-foreground text-sm">Search failed</p>'
      }
    }
  }

  function renderResults(results: Array<Record<string, unknown>>) {
    const locale = getLocale()
    const isZh = locale === 'zh-CN'

    if (!results?.length) {
      resultsContainer.innerHTML =
        '<p class="py-6 text-center text-muted-foreground text-sm">' +
        (isZh ? '没有找到相关文章' : 'No matching articles found') +
        '</p>'
      return
    }

    const html = results
      .map((r) => {
        const title = isZh ? r.titleZh : r.titleEn
        const summary = isZh ? r.summaryZh : r.summaryEn
        return `<a href="${r.url}" target="_blank" rel="noopener noreferrer" class="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent">
        <div class="font-medium">${title}</div>
        ${summary ? `<div class="mt-0.5 line-clamp-1 text-muted-foreground text-xs">${summary}</div>` : ''}
      </a>`
      })
      .join('')

    const count = results.length
    const label = isZh
      ? `找到 ${count} 篇相关文章`
      : `Found ${count} articles`
    resultsContainer.innerHTML = `<p class="px-3 py-1.5 text-muted-foreground text-xs">${label}</p>${html}`
  }
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search-dialog.astro
git commit -m "feat: add search dialog with native dialog element and vanilla JS"
```

---

### Task 8: Build infinite scroll digest list component

**Files:**
- Create: `src/components/digest-list.astro`

- [ ] **Step 1: Create `src/components/digest-list.astro`**

Server-renders initial data, then client-side JS handles pagination via IntersectionObserver. The initial digests come from the parent page's SSR data passed as props.

```astro
---
import type { Locale } from '@/i18n/utils'
import { useTranslations } from '@/i18n/utils'
import type { DigestWithArticles } from '@/lib/types'
import DigestCard from './digest-card.astro'

interface Props {
  locale: Locale
  initialDigests: DigestWithArticles[]
  nextCursor: string | null
}

const { locale, initialDigests, nextCursor } = Astro.props
const t = useTranslations(locale)
const localePath = locale === 'zh-CN' ? '' : '/en'
---

<div id="digest-list" data-next-cursor={nextCursor} data-locale-path={localePath}>
  {initialDigests.map((digest) => (
    <div class="mt-8 first:mt-6" data-digest>
      <div class="mb-2 flex items-center justify-between">
        <a
          href={`${localePath}/digests/${digest.date}`}
          class="font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          {digest.date}
        </a>
        {digest.stats.selected > 0 && (
          <span class="text-muted-foreground/60 text-xs">
            {t('digests.selected', { count: digest.stats.selected })}
          </span>
        )}
      </div>
      {digest.articles.map((article) => (
        <DigestCard article={article} locale={locale} />
      ))}
    </div>
  ))}
</div>

<div id="scroll-sentinel" class="h-px"></div>
<div id="scroll-status" class="py-8 text-center text-muted-foreground text-sm">
  {!nextCursor && t('digests.noMore')}
</div>

<template id="digest-skeleton">
  <div class="mt-8 space-y-2">
    <div class="h-5 w-28 animate-pulse rounded bg-muted"></div>
    <div class="h-16 animate-pulse rounded bg-muted"></div>
    <div class="h-16 animate-pulse rounded bg-muted"></div>
    <div class="h-16 animate-pulse rounded bg-muted"></div>
  </div>
</template>

<script>
  const container = document.getElementById('digest-list')!
  const sentinel = document.getElementById('scroll-sentinel')!
  const status = document.getElementById('scroll-status')!
  const skeletonTemplate = document.getElementById(
    'digest-skeleton',
  ) as HTMLTemplateElement

  let cursor = container.dataset.nextCursor || null
  let loading = false

  if (!cursor) {
    sentinel.remove()
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor && !loading) {
          loadMore()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
  }

  async function loadMore() {
    if (!cursor || loading) return
    loading = true

    const skeleton = skeletonTemplate.content.cloneNode(true)
    status.innerHTML = ''
    status.appendChild(skeleton)

    try {
      const res = await fetch(`/api/digests?cursor=${cursor}`)
      const data = await res.json()

      const locale = document.documentElement.lang || 'zh-CN'
      const isZh = locale === 'zh-CN'
      const localePath = container.dataset.localePath || ''

      for (const digest of data.digests) {
        const section = document.createElement('div')
        section.className = 'mt-8'
        section.dataset.digest = ''

        const header = document.createElement('div')
        header.className = 'mb-2 flex items-center justify-between'
        header.innerHTML = `<a href="${localePath}/digests/${digest.date}" class="font-medium text-muted-foreground text-sm transition-colors hover:text-foreground">${digest.date}</a>`
        if (digest.stats?.selected > 0) {
          const selectedText = isZh
            ? `精选 ${digest.stats.selected} 篇`
            : `Selected ${digest.stats.selected}`
          header.innerHTML += `<span class="text-muted-foreground/60 text-xs">${selectedText}</span>`
        }
        section.appendChild(header)

        for (const article of digest.articles) {
          const title = isZh ? article.titleZh : article.titleEn
          const summary = isZh ? article.summaryZh : article.summaryEn
          const isTop = article.rank <= 3
          const badgeClass = isTop
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'

          const card = document.createElement('div')
          card.innerHTML = `<div aria-hidden class="h-px bg-[length:4px_1px] bg-repeat-x opacity-20 [background-image:linear-gradient(90deg,var(--color-foreground)_1px,transparent_1px)]"></div>
<article class="group relative grid gap-4 py-5 md:grid-cols-[1fr_auto] md:gap-8">
  <div class="grid gap-3 md:grid-cols-[auto_1fr]">
    <span class="text-muted-foreground text-sm tabular-nums md:w-10">#${article.rank}</span>
    <div>
      <h3 class="font-medium leading-snug">${title}</h3>
      <p class="mt-1 line-clamp-2 text-muted-foreground text-sm leading-relaxed">${summary}</p>
    </div>
  </div>
  <div class="flex items-center gap-6 max-md:justify-between">
    <div class="inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold text-xs ${badgeClass}">${article.finalScore}</div>
    <a href="${article.url}" target="_blank" rel="noopener noreferrer" aria-label="${article.titleEn}" class="flex items-center gap-1 font-medium text-primary text-sm transition-colors duration-200 before:absolute before:inset-0 hover:text-foreground">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="size-3.5 translate-y-px duration-200 group-hover:translate-x-0.5"><path d="m9 18 6-6-6-6"/></svg>
    </a>
  </div>
</article>`
          section.appendChild(card)
        }

        container.appendChild(section)
      }

      cursor = data.nextCursor
      if (!cursor) {
        sentinel.remove()
        const noMoreText = isZh ? '没有更多了' : 'No more digests'
        status.innerHTML = `<span>${noMoreText}</span>`
      } else {
        status.innerHTML = ''
      }
    } catch {
      status.innerHTML =
        '<span class="text-destructive">Failed to load</span>'
    } finally {
      loading = false
    }
  }
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/digest-list.astro
git commit -m "feat: add infinite scroll digest list with IntersectionObserver"
```

---

### Task 9: Build shared page components

**Files:**
- Create: `src/components/pages/home.astro`
- Create: `src/components/pages/digests.astro`
- Create: `src/components/pages/digest-date.astro`

- [ ] **Step 1: Create `src/components/pages/home.astro`**

```astro
---
import type { Locale } from '@/i18n/utils'
import { richText, useTranslations } from '@/i18n/utils'
import { getLatestDigest } from '@/lib/queries'
import DigestCard from '@/components/digest-card.astro'
import EmptyState from '@/components/empty-state.astro'
import LocaleSwitcher from '@/components/locale-switcher.astro'
import SearchDialog from '@/components/search-dialog.astro'
import ChevronRight from '@/components/icons/chevron-right.astro'
import BaseLayout from '@/layouts/base.astro'

interface Props {
  locale: Locale
}

const { locale } = Astro.props
const t = useTranslations(locale)
const localePath = locale === 'zh-CN' ? '' : '/en'

let digest = null
let error = false
try {
  digest = await getLatestDigest()
} catch {
  error = true
}

const today = new Date(
  new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }),
)
  .toISOString()
  .split('T')[0]
const isToday = digest?.date === today
---

<BaseLayout locale={locale}>
  {error ? (
    <div class="flex min-h-[50vh] flex-col items-center justify-center">
      <p class="text-muted-foreground">{t('error.title')}</p>
      <a href={Astro.url.pathname} class="mt-4 text-sm underline">{t('error.retry')}</a>
    </div>
  ) : !digest ? (
    <EmptyState locale={locale} />
  ) : (
    <section>
      <div class="flex items-center justify-between">
        <div>
          <h2
            class="text-balance font-semibold text-4xl text-muted-foreground"
            set:html={richText(isToday ? t('home.todaysDigest') : t('home.latestDigest'))}
          />
          <p class="mt-2 font-normal text-muted-foreground/60 text-sm">
            {digest.date}
            {!isToday && ` · ${t('home.notGenerated')}`}
            {digest.stats.fetched > 0 && (
              <>
                {' · '}
                {t('home.fetched', { count: digest.stats.fetched })} ·{' '}
                {t('home.selected', { count: digest.stats.selected })}
              </>
            )}
          </p>
        </div>
        <SearchDialog />
      </div>
      <div class="mt-12 md:mt-16">
        {digest.articles.map((article) => (
          <DigestCard article={article} locale={locale} />
        ))}
      </div>
      <div class="mt-12 flex items-center justify-center gap-4">
        <a
          href={`${localePath}/digests`}
          class="flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          {t('home.history')}
          <ChevronRight class="size-3.5" />
        </a>
        <span class="text-muted-foreground/30">·</span>
        <LocaleSwitcher />
      </div>
    </section>
  )}
</BaseLayout>
```

- [ ] **Step 2: Create `src/components/pages/digests.astro`**

```astro
---
import type { Locale } from '@/i18n/utils'
import { richText, useTranslations } from '@/i18n/utils'
import { getDigestList } from '@/lib/queries'
import DigestList from '@/components/digest-list.astro'
import BaseLayout from '@/layouts/base.astro'

interface Props {
  locale: Locale
}

const { locale } = Astro.props
const t = useTranslations(locale)

let initialData = { digests: [], nextCursor: null as string | null }
let error = false
try {
  initialData = await getDigestList()
} catch {
  error = true
}
---

<BaseLayout locale={locale}>
  <section>
    <h2
      class="text-balance font-semibold text-4xl text-muted-foreground"
      set:html={richText(t('digests.digestHistory'))}
    />
    {error ? (
      <div class="mt-12 text-center">
        <p class="text-muted-foreground">{t('error.title')}</p>
        <a href={Astro.url.pathname} class="mt-4 inline-block text-sm underline">
          {t('error.retry')}
        </a>
      </div>
    ) : (
      <DigestList
        locale={locale}
        initialDigests={initialData.digests}
        nextCursor={initialData.nextCursor}
      />
    )}
  </section>
</BaseLayout>
```

- [ ] **Step 3: Create `src/components/pages/digest-date.astro`**

```astro
---
import type { Locale } from '@/i18n/utils'
import { richText, useTranslations } from '@/i18n/utils'
import { getDigestByDate } from '@/lib/queries'
import DigestCard from '@/components/digest-card.astro'
import BaseLayout from '@/layouts/base.astro'

interface Props {
  locale: Locale
  date: string
}

const { locale, date } = Astro.props
const t = useTranslations(locale)

const digest = await getDigestByDate(date)
if (!digest) {
  return Astro.redirect('/404')
}
---

<BaseLayout locale={locale} title={`${date} - Rover`}>
  <section>
    <div>
      <h2 class="text-balance font-semibold text-2xl text-muted-foreground md:text-4xl">
        {date}{' '}
        <Fragment set:html={richText(t('digestDate.digest'))} />
      </h2>
      {digest.stats.fetched > 0 && (
        <p class="mt-1.5 font-normal text-muted-foreground/60 text-sm">
          {t('digestDate.fetched', { count: digest.stats.fetched })} ·{' '}
          {t('digestDate.selected', { count: digest.stats.selected })}
        </p>
      )}
    </div>
    <div class="mt-8 md:mt-16">
      {digest.articles.map((article) => (
        <DigestCard article={article} locale={locale} />
      ))}
    </div>
  </section>
</BaseLayout>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/pages/
git commit -m "feat: add shared page components (home, digests, digest-date)"
```

---

### Task 10: Create page files and 404 pages

**Files:**
- Create: `src/pages/index.astro`
- Create: `src/pages/digests/index.astro`
- Create: `src/pages/digests/[date].astro`
- Create: `src/pages/en/index.astro`
- Create: `src/pages/en/digests/index.astro`
- Create: `src/pages/en/digests/[date].astro`
- Create: `src/pages/404.astro`
- Create: `src/pages/en/404.astro`

- [ ] **Step 1: Create zh-CN page files (default locale)**

`src/pages/index.astro`:
```astro
---
import Home from '@/components/pages/home.astro'
---
<Home locale="zh-CN" />
```

`src/pages/digests/index.astro`:
```astro
---
import Digests from '@/components/pages/digests.astro'
---
<Digests locale="zh-CN" />
```

`src/pages/digests/[date].astro`:
```astro
---
import DigestDate from '@/components/pages/digest-date.astro'

const { date } = Astro.params
---
<DigestDate locale="zh-CN" date={date!} />
```

- [ ] **Step 2: Create en page files**

`src/pages/en/index.astro`:
```astro
---
import Home from '@/components/pages/home.astro'
---
<Home locale="en" />
```

`src/pages/en/digests/index.astro`:
```astro
---
import Digests from '@/components/pages/digests.astro'
---
<Digests locale="en" />
```

`src/pages/en/digests/[date].astro`:
```astro
---
import DigestDate from '@/components/pages/digest-date.astro'

const { date } = Astro.params
---
<DigestDate locale="en" date={date!} />
```

- [ ] **Step 3: Create 404 pages**

`src/pages/404.astro`:
```astro
---
import BaseLayout from '@/layouts/base.astro'
---

<BaseLayout locale="zh-CN">
  <div class="flex min-h-[50vh] flex-col items-center justify-center">
    <h1 class="font-bold text-4xl">404</h1>
    <p class="mt-2 text-muted-foreground">页面未找到</p>
  </div>
</BaseLayout>
```

`src/pages/en/404.astro`:
```astro
---
import BaseLayout from '@/layouts/base.astro'
---

<BaseLayout locale="en">
  <div class="flex min-h-[50vh] flex-col items-center justify-center">
    <h1 class="font-bold text-4xl">404</h1>
    <p class="mt-2 text-muted-foreground">Page not found</p>
  </div>
</BaseLayout>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/
git commit -m "feat: add all page files for zh-CN and en locales"
```

---

### Task 11: Create API endpoints

**Files:**
- Create: `src/pages/api/digests/index.ts`
- Create: `src/pages/api/digests/[date].ts`
- Create: `src/pages/api/search.ts`
- Create: `src/pages/api/revalidate.ts`

- [ ] **Step 1: Create `src/pages/api/digests/index.ts`**

```ts
import type { APIRoute } from 'astro'
import { getDigestList } from '@/lib/queries'

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

- [ ] **Step 2: Create `src/pages/api/digests/[date].ts`**

```ts
import type { APIRoute } from 'astro'
import { getDigestByDate } from '@/lib/queries'

export const GET: APIRoute = async ({ params }) => {
  const { date } = params
  if (!date) {
    return new Response(JSON.stringify({ error: 'Date required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const digest = await getDigestByDate(date)
  if (!digest) {
    return new Response(JSON.stringify({ error: 'Digest not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(digest), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control':
        'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
```

- [ ] **Step 3: Create `src/pages/api/search.ts`**

```ts
import type { APIRoute } from 'astro'
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai'
import { cosineDistance, desc, eq, gt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  articleEmbeddings,
  articles,
  digestArticles,
  feeds,
} from '@/lib/schema'

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as {
    query?: string
  }
  const { query } = body

  if (!query?.trim()) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const genAI = new GoogleGenerativeAI(
    import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY,
  )
  const model = genAI.getGenerativeModel({
    model: 'gemini-embedding-2-preview',
  })

  const embeddingResult = await model.embedContent({
    content: { parts: [{ text: query.trim() }], role: 'user' },
    taskType: TaskType.RETRIEVAL_QUERY,
    outputDimensionality: 768,
  })
  const embedding = embeddingResult.embedding.values

  const similarity = sql<number>`1 - (${cosineDistance(articleEmbeddings.embedding, embedding)})`

  const results = await db
    .select({
      similarity,
      titleZh: digestArticles.titleZh,
      titleEn: digestArticles.titleEn,
      summaryZh: digestArticles.summaryZh,
      summaryEn: digestArticles.summaryEn,
      finalScore: digestArticles.finalScore,
      rank: digestArticles.rank,
      url: articles.url,
      feedTitle: feeds.title,
    })
    .from(articleEmbeddings)
    .innerJoin(articles, eq(articleEmbeddings.articleId, articles.id))
    .innerJoin(digestArticles, eq(digestArticles.articleId, articles.id))
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(gt(similarity, 0.6))
    .orderBy(desc(similarity))
    .limit(10)

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 4: Create `src/pages/api/revalidate.ts`**

```ts
import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${import.meta.env.CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = (await request.json().catch(() => ({}))) as { tag?: string }
  const tag = body.tag ?? 'digest'

  return new Response(JSON.stringify({ revalidated: true, tag }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/api/
git commit -m "feat: add API endpoints (digests, search, revalidate)"
```

---

### Task 12: Update config files and clean up

**Files:**
- Modify: `biome.json`
- Modify: `vercel.json`
- Delete: `next.config.ts`
- Delete: `app/` directory
- Delete: `components/` directory (old)
- Delete: `lib/` directory (old, now at `src/lib/`)
- Delete: `i18n/` directory
- Delete: `messages/` directory
- Delete: `components.json`
- Delete: `next-env.d.ts` (if exists)

- [ ] **Step 1: Update `biome.json` includes**

Change the `files.includes` from `["app/**", "lib/**", "components/**"]` to `["src/**"]`.

- [ ] **Step 2: Replace `vercel.json`**

Remove the cron config. Replace with an empty config or delete entirely (Astro adapter handles Vercel config):

```json
{}
```

Or delete the file entirely if no other config is needed.

- [ ] **Step 3: Delete old Next.js files and directories**

```bash
rm -rf app/ components/ lib/ i18n/ messages/
rm -f next.config.ts components.json next-env.d.ts
rm -f proxy.ts postcss.config.mjs
```

Keep: `drizzle.config.ts`, `drizzle/` (migration files), `src/`, `docs/`, config files.

- [ ] **Step 4: Verify project structure**

```bash
ls src/
ls src/pages/
ls src/components/
ls src/lib/
```

Expected structure matches the spec's file tree.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove Next.js files and update configs for Astro"
```

---

### Task 13: Build verification and fixes

- [ ] **Step 1: Install dependencies**

```bash
bun install
```

- [ ] **Step 2: Run type check**

```bash
bunx astro check
```

Fix any TypeScript errors that arise. Common issues:
- Path alias resolution (`@/*` → `./src/*`)
- `import.meta.env` type declarations
- Astro component prop types

- [ ] **Step 3: Run biome check**

```bash
bun run check
```

Fix any lint/format issues.

- [ ] **Step 4: Test dev server**

```bash
bun dev
```

Verify all routes work:
- `http://localhost:4321/` — home page with latest digest
- `http://localhost:4321/en/` — English home
- `http://localhost:4321/digests` — digest history with infinite scroll
- `http://localhost:4321/en/digests` — English digest history
- `http://localhost:4321/digests/2025-01-01` — specific digest date
- `http://localhost:4321/api/digests` — JSON endpoint
- Cmd+K search dialog
- Locale switcher navigation
- View transitions between pages

- [ ] **Step 5: Test production build**

```bash
bun run build
```

Verify build completes without errors.

- [ ] **Step 6: Fix any issues found and commit**

```bash
git add -A
git commit -m "fix: resolve build and runtime issues after migration"
```

- [ ] **Step 7: Update CLAUDE.md**

Update the project documentation to reflect the new Astro architecture. Key changes:
- Commands: `bun dev` (Astro dev), `bun build` (Astro build), `bun preview` (preview)
- Architecture: Astro 6 SSR, no React, vanilla JS islands
- Stack: Remove Next.js/React references, add Astro
- File structure: `src/` based
- Data flow: Remove cache directive mentions
- Routes: Same URLs but Astro file-based routing

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Astro architecture"
```
