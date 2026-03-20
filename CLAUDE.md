# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev              # Start dev server (Astro)
bun build            # Production build
bun preview          # Preview production build locally
bun run check        # Lint and format with Biome
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Run Drizzle migrations
bun run db:studio    # Open Drizzle Studio (DB browser)
```

## Architecture

Astro 6 SSR project — an AI-curated daily tech article digest. An external pipeline fetches RSS/Twitter feeds, scores articles with AI, and writes results to Postgres. This app is the **read-only frontend** that displays daily digests.

### Stack

- **Framework**: Astro 6 (`output: 'server'`) with `@astrojs/vercel` adapter
- **UI**: Pure `.astro` components + vanilla `<script>` tags for interactivity — no React, no UI framework runtime
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite` plugin — CSS-first config in `src/styles/globals.css` (OKLch color system, light/dark via `prefers-color-scheme`)
- **Database**: Drizzle ORM + PostgreSQL (`postgres` driver). Schema in `src/lib/schema.ts`, client in `src/lib/db.ts`, config in `drizzle.config.ts`
- **i18n**: Manual translation object in `src/i18n/ui.ts` with helper functions in `src/i18n/utils.ts`. Astro built-in i18n routing (`zh-CN` default, `en` prefixed)
- **Search**: Semantic search via `@google/generative-ai` embeddings + pgvector cosine distance
- **Code quality**: Biome (lint + format for `.ts`/`.css` files), pre-commit hook via husky + lint-staged
- **Path alias**: `@/*` maps to `./src/*`

### Data flow

1. **DB schema** (`src/lib/schema.ts`): `feeds` → `articles` → `scores` / `article_embeddings`; `daily_digests` → `digest_articles` (ranked article selection with summaries); `telegram_logs` for notifications
2. **Server queries** (`src/lib/queries.ts`): Plain async functions querying Drizzle ORM directly. Key functions: `getLatestDigest()`, `getDigestByDate(date)`, `getDigestList(cursor?)`
3. **Cache**: SSR pages always query fresh DB data. API endpoints use `Cache-Control` headers for CDN caching

### File structure

```
src/
├── pages/           # Astro file-based routing
│   ├── index.astro, digests/, 404.astro     # zh-CN (default)
│   ├── en/          # English locale
│   └── api/         # API endpoints (digests, search, revalidate)
├── layouts/         # Base HTML layout with ClientRouter
├── components/
│   ├── pages/       # Shared page components (home, digests, digest-date)
│   ├── icons/       # Inline SVG icon components
│   └── *.astro      # UI components (digest-card, search-dialog, etc.)
├── i18n/            # Translation strings and locale utilities
├── lib/             # DB client, schema, queries, types, utils
└── styles/          # Tailwind CSS v4 globals
```

### Routes

- `/` — SSR: shows today's or latest digest via `getLatestDigest()`
- `/digests` — SSR initial data + client-side infinite scroll via `IntersectionObserver` → `GET /api/digests?cursor=`
- `/digests/[date]` — SSR: single digest via `getDigestByDate(date)`
- `/en/...` — English locale versions of all pages
- `GET /api/digests` and `GET /api/digests/[date]` — JSON endpoints for digest data
- `POST /api/search` — Semantic search endpoint
- `POST /api/revalidate` — Pipeline compatibility endpoint (Bearer `CRON_SECRET`)

### Interactive components (vanilla JS)

- **Search dialog** (`search-dialog.astro`): Native `<dialog>` + Cmd+K shortcut, debounced fetch to `/api/search`
- **Infinite scroll** (`digest-list.astro`): `IntersectionObserver` + `fetch()` for lazy-loading digest pages
- **Locale switcher** (`locale-switcher.astro`): Plain `<a>` link, no JS needed

### UI locale

Default `lang="zh-CN"` — user-facing UI strings are in Chinese (e.g. "加载中...", "没有更多了"). Keep new UI text consistent. English available at `/en/`.

## Code Style (Biome)

- Single quotes, no semicolons, trailing commas, 2-space indent
- File names must be `kebab-case`
- No unused imports/parameters, no barrel files, no `any`
- Tailwind classes are auto-sorted (in `cn`, `clsx`, `cva` calls too)
- Prefer `import type` / `export type` for type-only imports
- Biome checks `src/**/*.ts` and `src/**/*.css` files (not `.astro` — Biome doesn't parse Astro syntax)

## Environment Variables

Requires: `DATABASE_URL`, `GOOGLE_GENERATIVE_AI_API_KEY`, `CRON_SECRET` (see `.env.example`)
