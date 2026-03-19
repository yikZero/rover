# Performance Optimization + `use cache` Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize Rover frontend loading speed and modernize caching by fixing N+1 queries, migrating to `use cache`, SSR-ing the digests list page, and pre-computing stats in the pipeline.

**Architecture:** Two-repo change. Pipeline (Python/SQLAlchemy) adds stats fields to `daily_digests` and computes them during digest generation. Frontend (Next.js 16/Drizzle) rewrites query layer to `use cache`, batch-fetches articles, reads pre-computed stats, and splits `/digests` into SSR + client.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM, PostgreSQL, SWR, `use cache` directive, SQLAlchemy (pipeline)

---

## File Structure

### Pipeline (`/Users/yikzero/code/rover-pipeline`)

| File | Change |
|------|--------|
| `src/db/models.py:126-135` | Add `total_fetched`, `total_scored`, `total_selected` columns to `DailyDigest` |
| `src/digest/generator.py:385-403` | Compute stats and write them when creating digest |

### Frontend (`/Users/yikzero/Code/rover`)

| File | Change |
|------|--------|
| `lib/schema.ts:143-149` | Add 3 stats fields to `dailyDigests` |
| `lib/queries.ts` (full rewrite) | `use cache`, batch query, read stats from digest row |
| `next.config.ts` | Add `experimental.useCache: true` |
| `app/[locale]/digests/page.tsx` (rewrite) | Server Component: SSR first page, pass to client |
| `app/[locale]/digests/digests-client.tsx` (new) | Client Component: SWR infinite scroll with fallbackData |
| `app/[locale]/page.tsx:81-86` | Update stats display to read from digest, hide when 0 |
| `app/[locale]/digests/[date]/page.tsx:39-42` | Update stats display to read from digest, hide when 0 |
| `package.json:26` | Move `shadcn` to devDependencies |

---

## Task 1: Pipeline — Add stats columns to DailyDigest model

**Files:**
- Modify: `/Users/yikzero/code/rover-pipeline/src/db/models.py:126-135`

- [ ] **Step 1: Add columns to DailyDigest model**

In `src/db/models.py`, add 3 columns to the `DailyDigest` class:

```python
class DailyDigest(Base):
    __tablename__ = "daily_digests"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    date = Column(Date, unique=True, nullable=False)
    total_fetched = Column(Integer, nullable=False, server_default="0")
    total_scored = Column(Integer, nullable=False, server_default="0")
    total_selected = Column(SmallInteger, nullable=False, server_default="0")
    created_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )

    digest_articles = relationship("DigestArticle", back_populates="digest", cascade="all, delete-orphan")
```

Remember to add `Integer, SmallInteger` to the SQLAlchemy imports if not already present.

- [ ] **Step 2: Run ALTER TABLE on database**

Since the pipeline uses no Alembic, run the migration manually:

```sql
ALTER TABLE daily_digests
  ADD COLUMN total_fetched integer NOT NULL DEFAULT 0,
  ADD COLUMN total_scored integer NOT NULL DEFAULT 0,
  ADD COLUMN total_selected smallint NOT NULL DEFAULT 0;
```

- [ ] **Step 3: Commit**

```bash
cd /Users/yikzero/code/rover-pipeline
git add src/db/models.py
git commit -m "feat: add stats columns to daily_digests table"
```

---

## Task 2: Pipeline — Compute stats during digest generation

**Files:**
- Modify: `/Users/yikzero/code/rover-pipeline/src/digest/generator.py:385-403`

- [ ] **Step 1: Add stats computation before digest creation**

In `run_digest_generation()`, before `digest = DailyDigest(date=today)` (line ~385), compute the three stats:

```python
# Compute stats for this digest
day_before = today - timedelta(days=1)
total_fetched = session.query(func.count(Article.id)).filter(
    Article.created_at >= day_before
).scalar() or 0

total_scored = session.query(func.count(Score.id)).join(
    Article, Score.article_id == Article.id
).filter(
    Article.created_at >= day_before
).scalar() or 0

total_selected = len(top_articles)
```

Then pass stats to the DailyDigest constructor:

```python
digest = DailyDigest(
    date=today,
    total_fetched=total_fetched,
    total_scored=total_scored,
    total_selected=total_selected,
)
session.add(digest)
session.flush()
```

Make sure `timedelta` is imported from `datetime` and `func` from `sqlalchemy`.

- [ ] **Step 2: Verify pipeline still runs**

```bash
cd /Users/yikzero/code/rover-pipeline
python -c "from src.digest.generator import run_digest_generation; print('import OK')"
```

- [ ] **Step 3: Commit**

```bash
cd /Users/yikzero/code/rover-pipeline
git add src/digest/generator.py
git commit -m "feat: compute and store digest stats during generation"
```

---

## Task 3: Frontend — Add stats fields to schema + enable `use cache`

**Files:**
- Modify: `/Users/yikzero/Code/rover/lib/schema.ts:143-149`
- Modify: `/Users/yikzero/Code/rover/next.config.ts`

- [ ] **Step 1: Add stats columns to dailyDigests schema**

In `lib/schema.ts`, update the `dailyDigests` table definition:

```ts
export const dailyDigests = pgTable('daily_digests', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  date: date().notNull().unique(),
  totalFetched: integer('total_fetched').notNull().default(0),
  totalScored: integer('total_scored').notNull().default(0),
  totalSelected: smallint('total_selected').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
```

Add `integer` to the import from `drizzle-orm/pg-core` (alongside the existing `bigint`, `smallint`, etc.).

- [ ] **Step 2: Enable `useCache` in next.config.ts**

```ts
import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
    cacheLife: {
      hours: { revalidate: 3600 },
      days: { revalidate: 86400 },
    },
  },
}

export default withNextIntl(nextConfig)
```

- [ ] **Step 3: Generate Drizzle migration**

```bash
cd /Users/yikzero/Code/rover
bun run db:generate
```

This generates a migration file in `drizzle/` for the new `daily_digests` columns, keeping the Drizzle migration folder in sync with the schema.

- [ ] **Step 4: Verify build compiles**

```bash
cd /Users/yikzero/Code/rover
bun run check
```

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts next.config.ts drizzle/
git commit -m "feat: add stats fields to dailyDigests schema, enable use cache"
```

---

## Task 4: Frontend — Rewrite queries.ts with `use cache` and batch query

**Files:**
- Rewrite: `/Users/yikzero/Code/rover/lib/queries.ts`

This is the core change. Rewrite the entire file.

- [ ] **Step 1: Rewrite lib/queries.ts**

```ts
import { desc, eq, inArray, lt } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import type { DigestArticle } from '@/components/digest-card'
import { db } from '@/lib/db'
import {
  articles,
  dailyDigests,
  digestArticles,
  feeds,
} from '@/lib/schema'

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

export async function getLatestDigest() {
  'use cache'
  cacheTag('digest')
  cacheLife('hours')

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

export async function getDigestByDate(date: string) {
  'use cache'
  cacheTag('digest')
  cacheLife('days')

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

export async function getDigestList(cursor?: string) {
  'use cache'
  cacheTag('digest')
  cacheLife('hours')

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
    articlesByDigest.get(digestId)!.push(article as DigestArticle)
  }

  const digestsWithArticles = results.map((digest) => ({
    ...digest,
    articles: articlesByDigest.get(digest.id) ?? [],
  }))

  return { digests: digestsWithArticles, nextCursor }
}

export async function getActiveFeeds() {
  'use cache'
  cacheTag('feeds')
  cacheLife('days')

  return db
    .select({ title: feeds.title })
    .from(feeds)
    .where(eq(feeds.isActive, true))
    .limit(5)
}
```

- [ ] **Step 2: Verify lint passes**

```bash
cd /Users/yikzero/Code/rover
bun run check
```

- [ ] **Step 3: Commit**

```bash
git add lib/queries.ts
git commit -m "feat: rewrite queries with use cache, fix N+1, read pre-computed stats"
```

---

## Task 5: Frontend — Update pages to handle zero-stats gracefully

**Files:**
- Modify: `/Users/yikzero/Code/rover/app/[locale]/page.tsx:81-86`
- Modify: `/Users/yikzero/Code/rover/app/[locale]/digests/[date]/page.tsx:39-42`
- Modify: `/Users/yikzero/Code/rover/messages/zh-CN.json`
- Modify: `/Users/yikzero/Code/rover/messages/en.json`

- [ ] **Step 1: Update homepage stats display**

In `app/[locale]/page.tsx`, change the stats line (around line 81-86) to hide when stats are all zero (historical digests without pre-computed data):

Replace:
```tsx
            {digest.date}
            {!isToday && ` · ${t('notGenerated')}`}
            {' · '}
            {t('scored', { count: digest.stats.scored })} ·{' '}
            {t('selected', { count: digest.stats.selected })}
```

With:
```tsx
            {digest.date}
            {!isToday && ` · ${t('notGenerated')}`}
            {digest.stats.scored > 0 && (
              <>
                {' · '}
                {t('fetched', { count: digest.stats.fetched })} ·{' '}
                {t('scored', { count: digest.stats.scored })} ·{' '}
                {t('selected', { count: digest.stats.selected })}
              </>
            )}
```

- [ ] **Step 2: Update digest date page stats display**

In `app/[locale]/digests/[date]/page.tsx`, change lines 39-42:

Replace:
```tsx
        <p className="mt-1.5 font-normal text-muted-foreground/60 text-sm">
          {t('scored', { count: digest.stats.scored })} ·{' '}
          {t('selected', { count: digest.stats.selected })}
        </p>
```

With:
```tsx
        {digest.stats.scored > 0 && (
          <p className="mt-1.5 font-normal text-muted-foreground/60 text-sm">
            {t('fetched', { count: digest.stats.fetched })} ·{' '}
            {t('scored', { count: digest.stats.scored })} ·{' '}
            {t('selected', { count: digest.stats.selected })}
          </p>
        )}
```

- [ ] **Step 3: Add `fetched` translation key**

In `messages/zh-CN.json`, add to `HomePage` and `DigestDatePage`:

```json
{
  "HomePage": {
    "fetched": "抓取 {count} 篇",
    ...
  },
  "DigestDatePage": {
    "fetched": "抓取 {count} 篇",
    ...
  }
}
```

In `messages/en.json`:

```json
{
  "HomePage": {
    "fetched": "Fetched {count}",
    ...
  },
  "DigestDatePage": {
    "fetched": "Fetched {count}",
    ...
  }
}
```

- [ ] **Step 4: Verify lint passes**

```bash
bun run check
```

- [ ] **Step 5: Commit**

```bash
git add app/[locale]/page.tsx app/[locale]/digests/[date]/page.tsx messages/zh-CN.json messages/en.json
git commit -m "feat: display fetched stats, hide stats gracefully when zero"
```

---

## Task 6: Frontend — Split /digests page into SSR + Client

**Files:**
- Rewrite: `/Users/yikzero/Code/rover/app/[locale]/digests/page.tsx`
- Create: `/Users/yikzero/Code/rover/app/[locale]/digests/digests-client.tsx`

- [ ] **Step 1: Create the client component**

Create `app/[locale]/digests/digests-client.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import useSWRInfinite from 'swr/infinite'
import type { DigestArticle } from '@/components/digest-card'
import { DigestCard, DigestCardSkeleton } from '@/components/digest-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from '@/i18n/navigation'
import { fetcher } from '@/lib/fetcher'

interface DigestWithArticles {
  id: number
  date: string
  articles: DigestArticle[]
}

interface DigestsResponse {
  digests: DigestWithArticles[]
  nextCursor: string | null
}

export function DigestsClient({
  fallbackData,
}: {
  fallbackData: DigestsResponse[]
}) {
  const t = useTranslations('DigestsPage')

  const getKey = (
    pageIndex: number,
    previousPageData: DigestsResponse | null,
  ) => {
    if (previousPageData && !previousPageData.nextCursor) return null
    if (pageIndex === 0) return '/api/digests'
    return `/api/digests?cursor=${previousPageData?.nextCursor}`
  }

  const { data, setSize, isValidating } = useSWRInfinite<DigestsResponse>(
    getKey,
    fetcher,
    { fallbackData },
  )

  const allDigests = data?.flatMap((page) => page.digests) ?? []
  const hasMore = data?.[data.length - 1]?.nextCursor !== null
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isValidating) {
          setSize((prev) => prev + 1)
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isValidating, setSize])

  return (
    <>
      <div className="mt-12 space-y-14 md:mt-16">
        {allDigests.map((digest) => (
          <section key={digest.date}>
            <Link
              href={`/digests/${digest.date}`}
              className="inline-block font-medium text-muted-foreground text-sm transition-colors hover:text-foreground"
            >
              {digest.date}
              <span className="ml-2 text-muted-foreground/50">
                {t('selected', { count: digest.articles.length })}
              </span>
            </Link>
            <div className="mt-2">
              {digest.articles.map((article) => (
                <DigestCard key={article.url} article={article} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div ref={sentinelRef} className="py-8">
        {isValidating && (
          <section>
            <Skeleton className="h-4 w-24" />
            <div className="mt-2">
              <DigestCardSkeleton />
              <DigestCardSkeleton />
            </div>
          </section>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Rewrite the server page**

Rewrite `app/[locale]/digests/page.tsx`:

```tsx
import { ChevronLeft } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { DigestsClient } from '@/app/[locale]/digests/digests-client'
import { Link } from '@/i18n/navigation'
import { getDigestList } from '@/lib/queries'

export default async function DigestsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('DigestsPage')
  const initialData = await getDigestList()

  return (
    <section>
      <Link href="/" className="group flex items-center gap-2">
        <ChevronLeft
          strokeWidth={2.5}
          className="size-6 text-muted-foreground transition-transform group-hover:-translate-x-0.5"
        />
        <h2 className="text-balance font-semibold text-4xl text-muted-foreground">
          {t.rich('digestHistory', {
            strong: (chunks) => (
              <strong className="font-semibold text-foreground">
                {chunks}
              </strong>
            ),
          })}
        </h2>
      </Link>
      <DigestsClient fallbackData={[initialData]} />
    </section>
  )
}
```

- [ ] **Step 3: Verify lint passes**

```bash
bun run check
```

- [ ] **Step 4: Commit**

```bash
git add app/[locale]/digests/page.tsx app/[locale]/digests/digests-client.tsx
git commit -m "feat: SSR first page of /digests with SWR hydration"
```

---

## Task 7: Frontend — Move shadcn to devDependencies

**Files:**
- Modify: `/Users/yikzero/Code/rover/package.json`

- [ ] **Step 1: Move shadcn**

```bash
cd /Users/yikzero/Code/rover
bun remove shadcn && bun add -d shadcn
```

- [ ] **Step 2: Verify build**

```bash
bun run check
```

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: move shadcn to devDependencies"
```

---

## Task 8: Frontend — Build verification

- [ ] **Step 1: Run full build**

```bash
cd /Users/yikzero/Code/rover
bun build
```

Expected: Build succeeds with no errors. The `use cache` functions should be recognized and compiled correctly.

- [ ] **Step 2: Verify dev server starts**

```bash
bun dev
```

Navigate to `http://localhost:3000` — verify:
- Homepage loads with digest data (no skeleton flash on cached data)
- Stats show "抓取 X 篇 · 评分 X 篇 · 精选 X 篇" (or hidden if 0)
- `/digests` loads with SSR first page (no initial skeleton)
- Scrolling triggers SWR pagination
- `/digests/[date]` loads correctly

- [ ] **Step 3: Final commit if any fixes needed**
