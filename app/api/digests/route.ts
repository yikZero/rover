import { desc, eq, lt } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  articles,
  dailyDigests,
  digestArticles,
  feeds,
  scores,
} from '@/lib/schema'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
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

      return { ...digest, articles: items }
    }),
  )

  return NextResponse.json({ digests: digestsWithArticles, nextCursor })
}
