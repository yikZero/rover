export const prerender = false

import { GOOGLE_GENERATIVE_AI_API_KEY } from 'astro:env/server'
import { GoogleGenAI } from '@google/genai'
import type { APIRoute } from 'astro'
import { cosineDistance, desc, eq, gt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { digestArticleSelect } from '@/lib/queries'
import {
  articleEmbeddings,
  articles,
  digestArticles,
  feeds,
} from '@/lib/schema'

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_WINDOW = 60_000
const RATE_LIMIT_MAX = 5

let lastCleanup = Date.now()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  if (now - lastCleanup > RATE_LIMIT_WINDOW) {
    for (const [key, ts] of rateLimitMap) {
      if (ts.every((t) => now - t >= RATE_LIMIT_WINDOW))
        rateLimitMap.delete(key)
    }
    lastCleanup = now
  }
  const timestamps = rateLimitMap.get(ip) ?? []
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW)
  if (recent.length >= RATE_LIMIT_MAX) return true
  recent.push(now)
  rateLimitMap.set(ip, recent)
  return false
}

export const POST: APIRoute = async ({ request }) => {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
      },
    })
  }

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

  const results = await db
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
