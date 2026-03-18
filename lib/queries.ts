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

    const digestDate = new Date(`${digest.date}T00:00:00`)
    const dayBefore = new Date(digestDate)
    dayBefore.setDate(dayBefore.getDate() - 1)

    const [items, [{ total: totalFetched }], [{ total: totalScored }]] =
      await Promise.all([
        digestArticlesQuery(digest.id),
        db
          .select({ total: count() })
          .from(articles)
          .where(gte(articles.createdAt, dayBefore)),
        db
          .select({ total: count() })
          .from(scores)
          .innerJoin(articles, eq(scores.articleId, articles.id))
          .where(gte(articles.createdAt, dayBefore)),
      ])

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

export async function getDigestByDate(date: string) {
  return unstable_cache(
    async () => {
      const [digest] = await db
        .select()
        .from(dailyDigests)
        .where(eq(dailyDigests.date, date))
        .limit(1)

      if (!digest) return null

      const items = await digestArticlesQuery(digest.id)
      return { date: digest.date, articles: items as DigestArticle[] }
    },
    [`digest-by-date-${date}`],
    { revalidate: 86400, tags: ['digest'] },
  )()
}

export async function getDigestList(cursor?: string) {
  const cacheKey = cursor ? `digest-list-${cursor}` : 'digest-list'

  return unstable_cache(
    async () => {
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
    [cacheKey],
    { revalidate: 3600, tags: ['digest'] },
  )()
}

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
