# Rover Frontend Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip rover down to a read-only frontend: new 7-dimension schema, remove pipeline/admin code, adapt UI for 0-10 scoring.

**Architecture:** Destructive schema migration (drop + recreate all tables). Remove all write-side code (cron, feeds API, auth, AI, RSS). Update queries and components to use new score columns.

**Tech Stack:** Next.js 16, Drizzle ORM, PostgreSQL (Supabase), React 19, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-18-rover-pipeline-redesign.md`

---

### Task 1: Rewrite Database Schema

**Files:**
- Modify: `lib/schema.ts`

- [ ] **Step 1: Rewrite `lib/schema.ts` with the new schema**

Replace the entire file content with:

```typescript
import {
  bigint,
  boolean,
  check,
  date,
  index,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const feeds = pgTable('feeds', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  url: text().notNull().unique(),
  siteUrl: text('site_url'),
  type: text().notNull(),
  tags: text().array(),
  isActive: boolean('is_active').notNull().default(true),
  lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
  errorCount: smallint('error_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  check('feeds_type_check', sql`${table.type} IN ('rss', 'twitter')`),
])

export const articles = pgTable(
  'articles',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    feedId: bigint('feed_id', { mode: 'number' })
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    url: text().notNull().unique(),
    content: text(),
    language: text(),
    filterStatus: text('filter_status').notNull().default('pending'),
    clusterId: text('cluster_id'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('articles_filter_status_check', sql`${table.filterStatus} IN ('pending', 'passed', 'filtered', 'duplicate')`),
    index('articles_feed_id_idx').on(table.feedId),
    index('articles_published_at_idx').on(table.publishedAt),
    index('articles_pending_score_idx')
      .on(table.createdAt)
      .where(sql`filter_status = 'passed'`),
  ],
)

export const scores = pgTable(
  'scores',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .unique()
      .references(() => articles.id, { onDelete: 'cascade' }),
    scale: numeric({ precision: 3, scale: 1 }).notNull(),
    impact: numeric({ precision: 3, scale: 1 }).notNull(),
    novelty: numeric({ precision: 3, scale: 1 }).notNull(),
    potential: numeric({ precision: 3, scale: 1 }).notNull(),
    legacy: numeric({ precision: 3, scale: 1 }).notNull(),
    positivity: numeric({ precision: 3, scale: 1 }).notNull(),
    credibility: numeric({ precision: 3, scale: 1 }).notNull(),
    total: numeric({ precision: 3, scale: 1 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('scores_scale_check', sql`${table.scale} >= 0 AND ${table.scale} <= 10`),
    check('scores_impact_check', sql`${table.impact} >= 0 AND ${table.impact} <= 10`),
    check('scores_novelty_check', sql`${table.novelty} >= 0 AND ${table.novelty} <= 10`),
    check('scores_potential_check', sql`${table.potential} >= 0 AND ${table.potential} <= 10`),
    check('scores_legacy_check', sql`${table.legacy} >= 0 AND ${table.legacy} <= 10`),
    check('scores_positivity_check', sql`${table.positivity} >= 0 AND ${table.positivity} <= 10`),
    check('scores_credibility_check', sql`${table.credibility} >= 0 AND ${table.credibility} <= 10`),
    check('scores_total_check', sql`${table.total} >= 0 AND ${table.total} <= 10`),
    index('scores_total_idx').on(table.total),
  ],
)

export const dailyDigests = pgTable('daily_digests', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  date: date().notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const digestArticles = pgTable(
  'digest_articles',
  {
    digestId: bigint('digest_id', { mode: 'number' })
      .notNull()
      .references(() => dailyDigests.id, { onDelete: 'cascade' }),
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    rank: smallint().notNull(),
    summary: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.digestId, table.articleId] }),
    index('digest_articles_article_id_idx').on(table.articleId),
  ],
)

export const telegramLogs = pgTable(
  'telegram_logs',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    digestId: bigint('digest_id', { mode: 'number' })
      .notNull()
      .references(() => dailyDigests.id),
    messageId: text('message_id'),
    status: text().notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('telegram_logs_status_check', sql`${table.status} IN ('sent', 'failed')`),
    index('telegram_logs_digest_id_idx').on(table.digestId),
  ],
)
```

- [ ] **Step 2: Generate new migration**

Run: `bun run db:generate`

This will detect schema changes and generate a new migration SQL file in `drizzle/`.

- [ ] **Step 3: Manually drop old tables and run migration**

Since this is a destructive migration with no data to preserve, connect to Supabase and drop existing tables:

```sql
DROP TABLE IF EXISTS digest_articles CASCADE;
DROP TABLE IF EXISTS daily_digests CASCADE;
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS feeds CASCADE;
```

Then run: `bun run db:migrate`

Verify: `bun run db:studio` — check that all 6 tables exist with correct columns.

- [ ] **Step 4: Commit**

```bash
git add lib/schema.ts drizzle/
git commit -m "feat: rewrite schema for 7-dimension scoring and multi-source support"
```

---

### Task 2: Remove Pipeline and Admin Code

**Files:**
- Delete: `app/api/cron/daily/route.ts`
- Delete: `app/api/feeds/route.ts`
- Delete: `app/api/feeds/[id]/route.ts`
- Delete: `app/api/feeds/validate/route.ts`
- Delete: `app/api/auth/login/route.ts`
- Delete: `app/api/auth/logout/route.ts`
- Delete: `lib/ai.ts`
- Delete: `lib/rss.ts`
- Delete: `lib/auth.ts`

- [ ] **Step 1: Delete all pipeline and admin files**

```bash
rm -rf app/api/cron app/api/feeds app/api/auth
rm lib/ai.ts lib/rss.ts lib/auth.ts
```

- [ ] **Step 2: Remove unused dependencies from package.json**

Remove `@ai-sdk/google`, `ai`, `rss-parser`, and `zod` (only used by ai.ts):

```bash
bun remove @ai-sdk/google ai rss-parser zod
```

- [ ] **Step 3: Verify build still works**

Run: `bun build`
Expected: Build succeeds with no import errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove pipeline, admin, and AI code from frontend"
```

---

### Task 3: Update Score Badge Component

**Files:**
- Modify: `components/score-badge.tsx`

- [ ] **Step 1: Simplify ScoreBadge to show only total score (0-10)**

Replace the entire file:

```typescript
import { cn } from '@/lib/utils'

interface ScoreBadgeProps {
  rank: number
  total: string
}

export function ScoreBadge({ rank, total }: ScoreBadgeProps) {
  const isTop = rank <= 3

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold text-xs',
        isTop
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {total}
    </div>
  )
}
```

Note: `total` is `string` because Drizzle returns `numeric` columns as strings.

- [ ] **Step 2: Commit**

```bash
git add components/score-badge.tsx
git commit -m "refactor: simplify score badge for 0-10 scale"
```

---

### Task 4: Update Digest Card Component

**Files:**
- Modify: `components/digest-card.tsx`

- [ ] **Step 1: Update DigestArticle interface and ScoreBadge usage**

Remove `infoDensity`, `popularity`, `practicality` from the interface. Change `total` type to `string`:

```typescript
export interface DigestArticle {
  rank: number
  title: string
  url: string
  summary: string
  feedTitle: string
  total: string
}
```

Update ScoreBadge call in DigestCard to only pass `rank` and `total`:

```typescript
<ScoreBadge
  rank={article.rank}
  total={article.total}
/>
```

- [ ] **Step 2: Commit**

```bash
git add components/digest-card.tsx
git commit -m "refactor: update digest card for simplified scoring"
```

---

### Task 5: Update Homepage Query

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Remove old score dimension selections from getLatestDigest()**

In the `items` query, remove `infoDensity`, `popularity`, `practicality` selections. Keep only `total`:

```typescript
const items = await db
  .select({
    rank: digestArticles.rank,
    summary: digestArticles.summary,
    title: articles.title,
    url: articles.url,
    feedTitle: feeds.title,
    total: scores.total,
  })
  .from(digestArticles)
  .innerJoin(articles, eq(digestArticles.articleId, articles.id))
  .innerJoin(feeds, eq(articles.feedId, feeds.id))
  .innerJoin(scores, eq(articles.id, scores.articleId))
  .where(eq(digestArticles.digestId, digest.id))
  .orderBy(digestArticles.rank)
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "refactor: update homepage query for new score schema"
```

---

### Task 6: Update Digest Detail Page Query

**Files:**
- Modify: `app/digests/[date]/page.tsx`

- [ ] **Step 1: Remove old score dimension selections**

Same change as homepage — remove `infoDensity`, `popularity`, `practicality` from the select:

```typescript
const items = await db
  .select({
    rank: digestArticles.rank,
    summary: digestArticles.summary,
    title: articles.title,
    url: articles.url,
    feedTitle: feeds.title,
    total: scores.total,
  })
  .from(digestArticles)
  .innerJoin(articles, eq(digestArticles.articleId, articles.id))
  .innerJoin(feeds, eq(articles.feedId, feeds.id))
  .innerJoin(scores, eq(articles.id, scores.articleId))
  .where(eq(digestArticles.digestId, digest.id))
  .orderBy(digestArticles.rank)
```

- [ ] **Step 2: Commit**

```bash
git add app/digests/[date]/page.tsx
git commit -m "refactor: update digest detail query for new score schema"
```

---

### Task 7: Update Digest API Routes

**Files:**
- Modify: `app/api/digests/route.ts`
- Modify: `app/api/digests/[date]/route.ts`

- [ ] **Step 1: Update `/api/digests/route.ts` — remove old score columns**

In the `items` query inside the map, replace the select with:

```typescript
const items = await db
  .select({
    rank: digestArticles.rank,
    summary: digestArticles.summary,
    title: articles.title,
    url: articles.url,
    feedTitle: feeds.title,
    total: scores.total,
  })
  .from(digestArticles)
  .innerJoin(articles, eq(digestArticles.articleId, articles.id))
  .innerJoin(feeds, eq(articles.feedId, feeds.id))
  .innerJoin(scores, eq(articles.id, scores.articleId))
  .where(eq(digestArticles.digestId, digest.id))
  .orderBy(digestArticles.rank)
```

- [ ] **Step 2: Update `/api/digests/[date]/route.ts` — remove old score columns**

Same pattern — remove `infoDensity`, `popularity`, `practicality`, `articleId`, `publishedAt`, `feedSiteUrl` from select. Keep `total`:

```typescript
const items = await db
  .select({
    rank: digestArticles.rank,
    summary: digestArticles.summary,
    title: articles.title,
    url: articles.url,
    feedTitle: feeds.title,
    total: scores.total,
  })
  .from(digestArticles)
  .innerJoin(articles, eq(digestArticles.articleId, articles.id))
  .innerJoin(feeds, eq(articles.feedId, feeds.id))
  .innerJoin(scores, eq(articles.id, scores.articleId))
  .where(eq(digestArticles.digestId, digest.id))
  .orderBy(digestArticles.rank)
```

- [ ] **Step 3: Verify build**

Run: `bun build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/api/digests/route.ts app/api/digests/[date]/route.ts
git commit -m "refactor: update digest API routes for new score schema"
```

---

### Task 8: Clean Up Environment and Config

**Files:**
- Modify: `.env.example` (if it exists)

- [ ] **Step 1: Update .env.example**

Remove env vars no longer needed by frontend:
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `CRON_SECRET`
- `ADMIN_PASSWORD`

Keep only:
```
DATABASE_URL=postgresql://...
```

- [ ] **Step 2: Final build and lint check**

Run: `bun build && bun run check`
Expected: Both succeed with no errors.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: clean up env vars for read-only frontend"
```
