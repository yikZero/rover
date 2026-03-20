import { asc, desc, eq, inArray, lt } from 'drizzle-orm'
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

export async function getAllDigestDates(): Promise<string[]> {
  const results = await db
    .select({ date: dailyDigests.date })
    .from(dailyDigests)
    .orderBy(asc(dailyDigests.date))

  return results.map((r) => r.date)
}
