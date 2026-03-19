import { desc, eq, inArray, lt } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import type { DigestArticle } from '@/components/digest-card'
import { db } from '@/lib/db'
import { articles, dailyDigests, digestArticles, feeds } from '@/lib/schema'

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
    articlesByDigest.get(digestId)?.push(article as DigestArticle)
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
