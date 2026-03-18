# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev              # Start dev server (Turbopack)
bun build            # Production build
bun start            # Start production server
bun run check        # Lint and format with Biome
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Run Drizzle migrations
bun run db:studio    # Open Drizzle Studio (DB browser)
```

## Architecture

Next.js 16 App Router project (React 19) — an AI-curated daily tech article digest. An external pipeline fetches RSS/Twitter feeds, scores articles with AI, and writes results to Postgres. This app is the **read-only frontend** that displays daily digests.

### Stack

- **Styling**: Tailwind CSS v4 — CSS-first config in `app/globals.css` (OKLch color system, light/dark themes), no `tailwind.config`
- **UI Components**: shadcn/ui (configured in `components.json`, style "base-maia") — add with `bunx shadcn add <component>`
- **Database**: Drizzle ORM + PostgreSQL (`postgres` driver). Schema in `lib/schema.ts`, client in `lib/db.ts`, config in `drizzle.config.ts`
- **Data fetching**: SWR (`useSWRInfinite`) for client-side pagination; `unstable_cache` with tags for server-side caching
- **Code quality**: Biome (lint + format), pre-commit hook via husky + lint-staged
- **Path alias**: `@/*` maps to project root

### Data flow

1. **DB schema** (`lib/schema.ts`): `feeds` → `articles` → `scores` / `article_embeddings`; `daily_digests` → `digest_articles` (ranked article selection with summaries); `telegram_logs` for notifications
2. **Server queries** (`lib/queries.ts`): All reads go through `unstable_cache` with `'digest'` or `'feeds'` tags. Key functions: `getLatestDigest()`, `getDigestByDate(date)`, `getDigestList(cursor?)`
3. **Cache invalidation**: `POST /api/revalidate` (Bearer `CRON_SECRET`) calls `revalidateTag` — used by the external pipeline after writing new digests

### Routes

- `/` — Server component: shows today's or latest digest via `getLatestDigest()`
- `/digests` — Client component: infinite-scroll history via `useSWRInfinite` → `GET /api/digests?cursor=`
- `/digests/[date]` — Server component: single digest via `getDigestByDate(date)`
- `GET /api/digests` and `GET /api/digests/[date]` — JSON endpoints for digest data
- `POST /api/revalidate` — Auth-protected cache invalidation endpoint

### UI locale

The app uses `lang="zh-CN"` — user-facing UI strings are in Chinese (e.g. "加载中...", "没有更多了"). Keep new UI text consistent with this.

## Code Style (Biome)

- Single quotes, no semicolons, trailing commas, 2-space indent
- File names must be `kebab-case`
- No unused imports/parameters, no barrel files, no `any`
- Tailwind classes are auto-sorted (in `cn`, `clsx`, `cva` calls too)
- Prefer `import type` / `export type` for type-only imports
- Biome only checks `app/`, `lib/`, `components/` directories

## Environment Variables

Requires: `DATABASE_URL`, `GOOGLE_GENERATIVE_AI_API_KEY`, `CRON_SECRET`, `ADMIN_PASSWORD` (see `.env.example`)
