import { google } from '@ai-sdk/google'
import { embed } from 'ai'
import { cosineDistance, desc, eq, gt, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  articleEmbeddings,
  articles,
  digestArticles,
  feeds,
} from '@/lib/schema'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    query?: string
  }
  const { query } = body

  if (!query?.trim()) {
    return NextResponse.json({ results: [] })
  }

  const { embedding } = await embed({
    model: google.embedding('gemini-embedding-2-preview'),
    value: query.trim(),
    providerOptions: {
      google: { outputDimensionality: 768, taskType: 'RETRIEVAL_QUERY' },
    },
  })

  const similarity = sql<number>`1 - (${cosineDistance(articleEmbeddings.embedding, embedding)})`

  const results = await db
    .select({
      similarity,
      titleZh: digestArticles.titleZh,
      titleEn: digestArticles.titleEn,
      summaryZh: digestArticles.summaryZh,
      summaryEn: digestArticles.summaryEn,
      finalScore: digestArticles.finalScore,
      rank: digestArticles.rank,
      url: articles.url,
      feedTitle: feeds.title,
    })
    .from(articleEmbeddings)
    .innerJoin(articles, eq(articleEmbeddings.articleId, articles.id))
    .innerJoin(digestArticles, eq(digestArticles.articleId, articles.id))
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(gt(similarity, 0.6))
    .orderBy(desc(similarity))
    .limit(10)

  return NextResponse.json({ results })
}
