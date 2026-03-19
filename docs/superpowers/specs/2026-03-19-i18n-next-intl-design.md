# Full-Site i18n with next-intl Design

Date: 2026-03-19

## Goal

Add full-site internationalization (zh-CN / en) using next-intl v4, with locale-based routing, translated UI strings, bilingual article content switching, and a footer language switcher.

## Current State

- UI locale hardcoded as `zh-CN` (`<html lang="zh-CN">`)
- ~23 hardcoded UI strings (mix of Chinese and English) across 6 files
- Article content already has bilingual fields: `titleZh`/`titleEn`, `summaryZh`/`summaryEn`
- No i18n library installed
- Next.js 16.1.6 (uses `proxy.ts` instead of `middleware.ts`)
- No existing `proxy.ts` or `middleware.ts`
- Existing `app/loading.tsx` file

## Design

### Routing Configuration

- **Locales:** `['zh-CN', 'en']`
- **Default locale:** `'zh-CN'`
- **Locale prefix:** `'as-needed'` — `zh-CN` has no prefix (`/digests`), `en` gets prefix (`/en/digests`)
- **Locale detection:** browser `Accept-Language` → cookie (auto-set by next-intl middleware) → `defaultLocale`

### File Structure

```
rover/
  proxy.ts                          ← NEW: next-intl routing proxy (named export)
  i18n/
    routing.ts                      ← NEW: defineRouting config
    navigation.ts                   ← NEW: createNavigation (Link, useRouter, etc.)
    request.ts                      ← NEW: getRequestConfig for server components
  messages/
    zh-CN.json                      ← NEW: Chinese translations
    en.json                         ← NEW: English translations
  app/
    layout.tsx                      ← NEW: minimal root layout (passes children through)
    not-found.tsx                   ← NEW: root-level 404 for non-locale routes
    [locale]/
      layout.tsx                    ← MOVED from app/layout.tsx, add NextIntlClientProvider
      page.tsx                      ← MOVED from app/page.tsx
      loading.tsx                   ← MOVED from app/loading.tsx
      not-found.tsx                 ← MOVED from app/not-found.tsx (locale-scoped 404)
      error.tsx                     ← MOVED from app/error.tsx
      digests/
        page.tsx                    ← MOVED
        [date]/page.tsx             ← MOVED
      [...rest]/page.tsx            ← NEW: catch-all to trigger locale-scoped notFound()
    api/                            ← UNCHANGED: stays outside [locale]
      digests/
      revalidate/
    icon.svg                        ← STAYS at app/ level
    globals.css                     ← STAYS at app/ level
```

### i18n Configuration Files

#### `i18n/routing.ts`

```typescript
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['zh-CN', 'en'],
  defaultLocale: 'zh-CN',
  localePrefix: 'as-needed',
})
```

#### `i18n/navigation.ts`

```typescript
import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
```

#### `i18n/request.ts`

```typescript
import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!hasLocale(routing.locales, locale)) {
    locale = routing.defaultLocale
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
```

### Proxy (`proxy.ts`)

Next.js 16 requires a named `proxy` export (not `export default`). Wrap the next-intl middleware:

```typescript
import createMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)

export function proxy(request: NextRequest) {
  return intlMiddleware(request)
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
```

### Translation Messages

**Design note:** The current UI uses English headings ("Today's Digest", "History", "Read") with Chinese status/body text ("加载中...", "评分 X 篇"). The zh-CN translations preserve this existing mixed-language style intentionally.

#### `messages/zh-CN.json`

```json
{
  "HomePage": {
    "todaysDigest": "Today's Digest",
    "latestDigest": "Latest Digest",
    "sources": "Sources",
    "emptyState": "每日精选将在北京时间 10:00 自动生成",
    "notGenerated": "今日精选尚未生成",
    "scored": "评分 {count} 篇",
    "selected": "精选 {count} 篇",
    "history": "History"
  },
  "DigestsPage": {
    "digestHistory": "Digest History",
    "selected": "精选 {count} 篇",
    "loading": "加载中...",
    "noMore": "没有更多了"
  },
  "DigestDatePage": {
    "digest": "Digest",
    "scored": "评分 {count} 篇",
    "selected": "精选 {count} 篇"
  },
  "DigestCard": {
    "read": "Read"
  },
  "Error": {
    "title": "Something went wrong",
    "retry": "Try again"
  },
  "NotFound": {
    "title": "Page not found"
  },
  "Footer": {
    "language": "语言"
  }
}
```

#### `messages/en.json`

```json
{
  "HomePage": {
    "todaysDigest": "Today's Digest",
    "latestDigest": "Latest Digest",
    "sources": "Sources",
    "emptyState": "Daily digest auto-generated at 10:00 Beijing time",
    "notGenerated": "Today's digest not generated yet",
    "scored": "Scored {count}",
    "selected": "Selected {count}",
    "history": "History"
  },
  "DigestsPage": {
    "digestHistory": "Digest History",
    "selected": "Selected {count}",
    "loading": "Loading...",
    "noMore": "No more digests"
  },
  "DigestDatePage": {
    "digest": "Digest",
    "scored": "Scored {count}",
    "selected": "Selected {count}"
  },
  "DigestCard": {
    "read": "Read"
  },
  "Error": {
    "title": "Something went wrong",
    "retry": "Try again"
  },
  "NotFound": {
    "title": "Page not found"
  },
  "Footer": {
    "language": "Language"
  }
}
```

### Layout Changes

#### Root layout (`app/layout.tsx`) — NEW pass-through wrapper

Passes children through to the locale layout. Does NOT provide `<html>` or `<body>` — those are in the locale layout.

```typescript
import type { ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
```

#### Locale layout (`app/[locale]/layout.tsx`) — MOVED from `app/layout.tsx`

- Receives `params.locale`, validates with `hasLocale`
- **Calls `notFound()` if locale is invalid** (renders root `not-found.tsx`)
- Sets `<html lang={locale}>`
- Wraps children with `NextIntlClientProvider`
- Calls `setRequestLocale(locale)` for static rendering
- Includes metadata (title, description) — moved from the old root layout
- Includes the footer with locale switcher
- Exports `generateStaticParams` for static rendering

#### Catch-all route (`app/[locale]/[...rest]/page.tsx`) — NEW

Triggers locale-scoped `notFound()` for any unmatched path under a valid locale:

```typescript
import { notFound } from 'next/navigation'

export default function CatchAllPage() {
  notFound()
}
```

#### Root not-found (`app/not-found.tsx`) — NEW

Handles 404s for routes outside any locale context (e.g., `/unknown.txt`). Minimal page without locale features.

### Article Content Switching

`DigestCard` component uses `useLocale()` from `next-intl` to pick the right title/summary:

```typescript
const locale = useLocale()
const title = locale === 'en' ? article.titleEn : article.titleZh
const summary = locale === 'en' ? article.summaryEn : article.summaryZh
```

This means `DigestCard` becomes a client component (`'use client'`).

### Navigation Updates

- All `<Link>` imports from `next/link` change to `@/i18n/navigation` for locale-aware routing
- `useRouter` and `usePathname` from `next/navigation` change to `@/i18n/navigation` in client components
- **`notFound` stays imported from `next/navigation`** — it is NOT exported by `createNavigation`

### Footer Language Switcher

A new `LocaleSwitcher` client component in the footer:

- Shows current locale name and the alternative (e.g., "中文 / English")
- Uses `useRouter().replace(pathname, { locale: targetLocale })` to switch
- Cookie is auto-set by next-intl middleware, persisting the user's choice
- Placed in the footer area, visible on all pages

### next.config.ts Update

Add the `next-intl` plugin:

```typescript
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

export default withNextIntl({
  // existing config...
})
```

### Static Rendering

All server component pages call `setRequestLocale(locale)` at the top to enable static rendering. The locale layout exports `generateStaticParams`:

```typescript
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}
```

### Unchanged

- API routes (`app/api/`) — stay outside `[locale]`, no changes
- Database schema — no changes
- Pipeline — no changes
- `lib/queries.ts` — no changes
- `lib/schema.ts` — no changes
- Cache invalidation — no changes

## Dependencies

- `next-intl` (v4.x) — install via `bun add next-intl`

## Constraints

- `DigestCard` becomes a client component to use `useLocale()` — no prop-passing needed
- `digests/page.tsx` is already a client component — use `useLocale()` directly
- `notFound` must always be imported from `next/navigation`, not `@/i18n/navigation`
- The `proxy.ts` file must be at the project root (same level as `app/`)
- `proxy.ts` must use named `proxy` export, not `export default`
