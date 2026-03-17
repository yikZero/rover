import { and, desc, eq, gte, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { generateSummary, scoreArticles } from '@/lib/ai'
import { db } from '@/lib/db'
import { parseFeed } from '@/lib/rss'
import {
  articles,
  dailyDigests,
  digestArticles,
  feeds,
  scores,
} from '@/lib/schema'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]
  console.log(`[cron] Starting daily digest for ${today}`)

  const existing = await db
    .select()
    .from(dailyDigests)
    .where(eq(dailyDigests.date, today))
    .limit(1)

  if (existing.length > 0) {
    console.log('[cron] Digest already exists for today, skipping')
    return NextResponse.json({ message: 'Digest already exists' })
  }

  // Step 1: Fetch articles from active feeds
  const activeFeeds = await db
    .select()
    .from(feeds)
    .where(eq(feeds.isActive, true))

  console.log(`[cron] Found ${activeFeeds.length} active feeds`)

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  let totalNewArticles = 0

  for (const feed of activeFeeds) {
    try {
      const parsed = await parseFeed(feed.url)
      const recentItems = parsed.items.filter(
        (item) => !item.publishedAt || item.publishedAt >= yesterday,
      )

      for (const item of recentItems) {
        try {
          const result = await db
            .insert(articles)
            .values({
              feedId: feed.id,
              title: item.title,
              url: item.url,
              content: item.content,
              publishedAt: item.publishedAt,
            })
            .onConflictDoNothing({ target: articles.url })
            .returning({ id: articles.id })
          if (result.length > 0) totalNewArticles++
        } catch {
          // Insert error — skip
        }
      }
    } catch (e) {
      console.error(`[cron] Failed to fetch feed: ${feed.url}`, e)
    }
  }

  console.log(`[cron] Fetched ${totalNewArticles} new articles`)

  if (totalNewArticles === 0) {
    console.log('[cron] No new articles, skipping digest')
    return NextResponse.json({ message: 'No new articles' })
  }

  // Step 2: Score unscored articles
  const unscoredArticles = await db
    .select({
      id: articles.id,
      title: articles.title,
      content: articles.content,
    })
    .from(articles)
    .leftJoin(scores, eq(articles.id, scores.articleId))
    .where(and(isNull(scores.id), gte(articles.createdAt, yesterday)))

  console.log(`[cron] Scoring ${unscoredArticles.length} articles`)

  for (let i = 0; i < unscoredArticles.length; i += 20) {
    const batch = unscoredArticles.slice(i, i + 20)
    try {
      const articleScores = await scoreArticles(batch)
      for (const score of articleScores) {
        await db
          .insert(scores)
          .values({
            articleId: score.articleId,
            infoDensity: score.infoDensity,
            popularity: score.popularity,
            practicality: score.practicality,
            total: score.total,
          })
          .onConflictDoNothing({ target: scores.articleId })
      }
    } catch {
      // Retry once
      try {
        const articleScores = await scoreArticles(batch)
        for (const score of articleScores) {
          await db
            .insert(scores)
            .values({
              articleId: score.articleId,
              infoDensity: score.infoDensity,
              popularity: score.popularity,
              practicality: score.practicality,
              total: score.total,
            })
            .onConflictDoNothing({ target: scores.articleId })
        }
      } catch (retryError) {
        console.error(
          '[cron] AI scoring retry failed, skipping batch',
          retryError,
        )
      }
    }
  }

  // Step 3: Generate digest
  const topArticles = await db
    .select({
      id: articles.id,
      title: articles.title,
      content: articles.content,
      url: articles.url,
      feedTitle: feeds.title,
      total: scores.total,
      infoDensity: scores.infoDensity,
      popularity: scores.popularity,
      practicality: scores.practicality,
    })
    .from(articles)
    .innerJoin(scores, eq(articles.id, scores.articleId))
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(and(gte(scores.total, 50), gte(articles.createdAt, yesterday)))
    .orderBy(desc(scores.total))
    .limit(10)

  if (topArticles.length < 5) {
    console.log(
      `[cron] Only ${topArticles.length} articles scored >= 50, skipping digest`,
    )
    return NextResponse.json({ message: 'Not enough quality articles' })
  }

  console.log(`[cron] Generating summaries for ${topArticles.length} articles`)

  const [digest] = await db
    .insert(dailyDigests)
    .values({ date: today })
    .returning()

  for (let i = 0; i < topArticles.length; i++) {
    const article = topArticles[i]
    try {
      const summary = await generateSummary(
        article.title,
        article.content ?? '',
      )
      await db.insert(digestArticles).values({
        digestId: digest.id,
        articleId: article.id,
        rank: i + 1,
        summary,
      })
    } catch (e) {
      console.error(
        `[cron] Summary generation failed for article ${article.id}`,
        e,
      )
    }
  }

  console.log(`[cron] Daily digest generated successfully for ${today}`)

  return NextResponse.json({
    message: 'Digest generated',
    date: today,
    articleCount: topArticles.length,
  })
}
