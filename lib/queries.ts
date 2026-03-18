import { count, desc, eq, gte, lt } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import type { DigestArticle } from '@/components/digest-card'
import { db } from '@/lib/db'
import {
  articles,
  dailyDigests,
  digestArticles,
  feeds,
  scores,
} from '@/lib/schema'

const digestArticleSelect = {
  rank: digestArticles.rank,
  summary: digestArticles.summary,
  title: articles.title,
  url: articles.url,
  feedTitle: feeds.title,
  total: scores.total,
}

function digestArticlesQuery(digestId: number) {
  return db
    .select(digestArticleSelect)
    .from(digestArticles)
    .innerJoin(articles, eq(digestArticles.articleId, articles.id))
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .innerJoin(scores, eq(articles.id, scores.articleId))
    .where(eq(digestArticles.digestId, digestId))
    .orderBy(digestArticles.rank)
}

export const getLatestDigest = unstable_cache(
  async () => {
    const [digest] = await db
      .select()
      .from(dailyDigests)
      .orderBy(desc(dailyDigests.date))
      .limit(1)

    if (!digest) return null

    const items = await digestArticlesQuery(digest.id)

    const digestDate = new Date(`${digest.date}T00:00:00`)
    const dayBefore = new Date(digestDate)
    dayBefore.setDate(dayBefore.getDate() - 1)

    const [{ total: totalFetched }] = await db
      .select({ total: count() })
      .from(articles)
      .where(gte(articles.createdAt, dayBefore))

    const [{ total: totalScored }] = await db
      .select({ total: count() })
      .from(scores)
      .innerJoin(articles, eq(scores.articleId, articles.id))
      .where(gte(articles.createdAt, dayBefore))

    return {
      date: digest.date,
      articles: items as DigestArticle[],
      stats: {
        fetched: totalFetched,
        scored: totalScored,
        selected: items.length,
      },
    }
  },
  ['latest-digest'],
  { revalidate: 3600, tags: ['digest'] },
)

export const getDigestByDate = unstable_cache(
  async (date: string) => {
    const [digest] = await db
      .select()
      .from(dailyDigests)
      .where(eq(dailyDigests.date, date))
      .limit(1)

    if (!digest) return null

    const items = await digestArticlesQuery(digest.id)
    return { date: digest.date, articles: items as DigestArticle[] }
  },
  ['digest-by-date'],
  { revalidate: 86400, tags: ['digest'] },
)

export const getDigestList = unstable_cache(
  async (cursor?: string) => {
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

    const digestsWithArticles = await Promise.all(
      results.map(async (digest) => {
        const items = await digestArticlesQuery(digest.id)
        return { ...digest, articles: items as DigestArticle[] }
      }),
    )

    return { digests: digestsWithArticles, nextCursor }
  },
  ['digest-list'],
  { revalidate: 3600, tags: ['digest'] },
)

export const getActiveFeeds = unstable_cache(
  async () => {
    return db
      .select({ title: feeds.title })
      .from(feeds)
      .where(eq(feeds.isActive, true))
      .limit(5)
  },
  ['active-feeds'],
  { revalidate: 86400, tags: ['feeds'] },
)
