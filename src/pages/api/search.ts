export const prerender = false

import { GOOGLE_GENERATIVE_AI_API_KEY } from 'astro:env/server'
import { GoogleGenAI } from '@google/genai'
import type { APIRoute } from 'astro'
import { cosineDistance, desc, eq, gt, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { digestArticleSelect } from '@/lib/queries'
import {
  articleEmbeddings,
  articles,
  digestArticles,
  feeds,
} from '@/lib/schema'

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as {
    query?: string
  }
  const { query } = body

  if (!query?.trim()) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ai = new GoogleGenAI({ apiKey: GOOGLE_GENERATIVE_AI_API_KEY })
  const embeddingResult = await ai.models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: query.trim(),
    config: {
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: 768,
    },
  })
  const embedding = embeddingResult.embeddings?.[0]?.values ?? []

  const similarity = sql<number>`1 - (${cosineDistance(articleEmbeddings.embedding, embedding)})`

  const results = await getDb()
    .select({
      similarity,
      ...digestArticleSelect,
    })
    .from(articleEmbeddings)
    .innerJoin(articles, eq(articleEmbeddings.articleId, articles.id))
    .innerJoin(digestArticles, eq(digestArticles.articleId, articles.id))
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(gt(similarity, 0.6))
    .orderBy(desc(similarity))
    .limit(10)

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
