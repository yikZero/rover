# Performance Optimization + `use cache` Migration

## Summary

Optimize the Rover frontend for faster loading, modern caching, and better data utilization. Core changes: fix N+1 query, migrate `unstable_cache` → `use cache`, SSR the digests list page, pre-compute stats in pipeline, and clean up unused dependencies.

## Motivation

- `getDigestList` runs 11 DB queries per pagination (N+1 pattern) — blocks scaling
- `unstable_cache` is legacy; Next.js 16 provides stable `use cache` directive with better DX
- `/digests` page is pure CSR — users see skeleton on every visit, no SSR content
- Stats queries (totalFetched/totalScored) run 2 extra `COUNT(*)` per page load — wasteful when pre-computable
- Unused `@base-ui/react` adds bundle bloat

## Design

### 1. Schema Change: `daily_digests` stats fields

Add 3 columns to `daily_digests`:

```sql
ALTER TABLE daily_digests
  ADD COLUMN total_fetched integer NOT NULL DEFAULT 0,
  ADD COLUMN total_scored integer NOT NULL DEFAULT 0,
  ADD COLUMN total_selected smallint NOT NULL DEFAULT 0;
```

- **Pipeline side:** Compute during `run_digest_generation()`:
  - `total_fetched`: `COUNT(*) FROM articles WHERE created_at >= day_before` (all statuses, unfiltered)
  - `total_scored`: `COUNT(*) FROM scores JOIN articles WHERE created_at >= day_before`
  - `total_selected`: number of articles inserted into `digest_articles`
- **Frontend side:** Read directly from `daily_digests` row, remove the 2 `COUNT(*)` queries

Both repos must update their schema definitions (`lib/schema.ts` in frontend, model in pipeline).

### 2. Fix N+1 Query in `getDigestList`

**Current:** `getDigestList` fetches 10 digests, then loops each with `digestArticlesQuery(digest.id)` — 11 queries.

**New:** Batch query all articles for all digests in one call:

```ts
const allItems = await db
  .select({ ...digestArticleSelect, digestId: digestArticles.digestId })
  .from(digestArticles)
  .innerJoin(articles, eq(digestArticles.articleId, articles.id))
  .innerJoin(feeds, eq(articles.feedId, feeds.id))
  .where(inArray(digestArticles.digestId, digestIds))
  .orderBy(digestArticles.digestId, digestArticles.rank)
```

Then group by `digestId` in JS. Result: 2 queries (1 list + 1 batch articles).

### 3. Migrate `unstable_cache` → `use cache`

Enable in `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
  },
}
```

Migrate all 4 cached functions in `lib/queries.ts`:

| Function | Cache Tag | Cache Life |
|----------|-----------|------------|
| `getLatestDigest()` | `'digest'` | `hours` (~1800s) |
| `getDigestByDate(date)` | `'digest'` | `days` (~86400s) |
| `getDigestList(cursor?)` | `'digest'` | `hours` (~1800s) |
| `getActiveFeeds()` | `'feeds'` | `days` (~86400s) |

Pattern:

```ts
import { cacheTag, cacheLife } from 'next/cache'

export async function getLatestDigest() {
  'use cache'
  cacheTag('digest')
  cacheLife('hours')
  // ... query logic, no manual cache keys needed
}
```

For `getDigestByDate(date)` and `getDigestList(cursor?)`, the function parameters automatically become part of the cache key — no need for manual key strings.

Update `POST /api/revalidate` if needed (current `revalidateTag` call should continue to work).

### 4. `/digests` Page: SSR First Page + SWR Hydration

**Current:** `app/[locale]/digests/page.tsx` is `'use client'` — pure CSR with skeleton.

**New:** Split into server + client:

- `app/[locale]/digests/page.tsx` — Server Component
  - Calls `getDigestList()` for first page
  - Passes data as `fallbackData` to client component
- `app/[locale]/digests/digests-client.tsx` — Client Component
  - Receives `fallbackData` prop
  - Uses `useSWRInfinite` with `fallbackData` for seamless hydration
  - Subsequent pages fetched client-side as before

User sees content immediately on first visit. No skeleton flash for initial load.

### 5. Dependency Cleanup

- **Remove** `@base-ui/react` from `dependencies` (zero imports in codebase)
- **Move** `shadcn` from `dependencies` to `devDependencies` (CLI tool, not runtime)

### 6. Revalidation Timing

| Function | Current | New |
|----------|---------|-----|
| `getLatestDigest` | 3600s | 1800s |
| `getDigestByDate` | 86400s | 86400s (unchanged) |
| `getDigestList` | 3600s | 1800s |
| `getActiveFeeds` | 86400s | 86400s (unchanged) |

## Out of Scope

- 8-dimension score visualization (future iteration)
- Feed tags filtering/categorization (future iteration)
- Cache warming after revalidation
- HTTP Cache-Control header changes on API routes
- Streaming/Suspense boundaries (current page sizes are small, benefit minimal)

## Files Changed

### rover-pipeline

| File | Change |
|------|--------|
| Schema/model definition | Add `total_fetched`, `total_scored`, `total_selected` to `daily_digests` |
| Migration | New migration for ALTER TABLE |
| Digest generation logic | Compute and write stats during digest creation |

### rover (frontend)

| File | Change |
|------|--------|
| `lib/schema.ts` | Add 3 fields to `dailyDigests` table definition |
| `lib/queries.ts` | Full rewrite: `use cache`, batch query, remove COUNT queries |
| `next.config.ts` | Add `experimental.useCache: true` |
| `app/[locale]/digests/page.tsx` | Convert to Server Component, SSR first page |
| `app/[locale]/digests/digests-client.tsx` | New file: extracted Client Component with SWR |
| `package.json` | Remove `@base-ui/react`, move `shadcn` to devDependencies |
| `drizzle.config.ts` / migrations | Generate migration for new `daily_digests` fields |

## Risks

- `use cache` is experimental in Next.js 16 — API may change in future versions
- Pre-computed stats become stale if pipeline re-processes articles after digest creation (acceptable: stats are informational only)
- SSR first page for `/digests` adds server load per request (mitigated by `use cache`)
