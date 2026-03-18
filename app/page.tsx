import { count, desc, eq, gte } from 'drizzle-orm'
import { ChevronRight, Play, Rss } from 'lucide-react'
import Link from 'next/link'
import type { DigestArticle } from '@/components/digest-card'
import { DigestCard } from '@/components/digest-card'
import { db } from '@/lib/db'
import {
  articles,
  dailyDigests,
  digestArticles,
  feeds,
  scores,
} from '@/lib/schema'

async function getLatestDigest() {
  const [digest] = await db
    .select()
    .from(dailyDigests)
    .orderBy(desc(dailyDigests.date))
    .limit(1)

  if (!digest) return null

  const items = await db
    .select({
      rank: digestArticles.rank,
      summary: digestArticles.summary,
      title: articles.title,
      url: articles.url,
      feedTitle: feeds.title,
      total: scores.total,
      infoDensity: scores.infoDensity,
      popularity: scores.popularity,
      practicality: scores.practicality,
    })
    .from(digestArticles)
    .innerJoin(articles, eq(digestArticles.articleId, articles.id))
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .innerJoin(scores, eq(articles.id, scores.articleId))
    .where(eq(digestArticles.digestId, digest.id))
    .orderBy(digestArticles.rank)

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
}

export default async function HomePage() {
  const digest = await getLatestDigest()

  if (!digest) {
    const topFeeds = await db
      .select({ title: feeds.title })
      .from(feeds)
      .where(eq(feeds.isActive, true))
      .limit(5)

    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div aria-hidden className="relative min-w-64">
          <div className="perspective-dramatic flex flex-col gap-3">
            <div className="mask-radial-[100%_100%] mask-radial-at-top-left mask-radial-from-75% -rotate-4 rotate-x-5 rotate-z-6 pt-1 pl-5">
              <div className="rounded-tl-xl bg-background/75 px-2 pt-3 shadow-black/6.5 shadow-lg ring-1 ring-border">
                <div className="mb-2 flex items-center gap-2 px-2.5 font-medium text-muted-foreground text-sm">
                  Sources{' '}
                  <Play className="size-2 translate-y-0.5 rotate-90 fill-current opacity-50" />
                </div>
                <div className="flex flex-col gap-3.5 rounded-tl-lg bg-muted/50 pt-3.5 pl-4 shadow ring-1 ring-border">
                  {topFeeds.map((feed) => (
                    <div key={feed.title} className="flex items-center gap-2">
                      <Rss className="size-3.5 text-muted-foreground" />
                      <span className="text-sm">{feed.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-8 text-md text-muted-foreground">
          每日精选将在北京时间 09:00 自动生成
        </p>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const isToday = digest.date === today

  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-balance font-semibold text-4xl text-muted-foreground">
            {isToday ? (
              <>
                Today&apos;s{' '}
                <strong className="font-semibold text-foreground">
                  Digest
                </strong>
              </>
            ) : (
              <>
                Latest{' '}
                <strong className="font-semibold text-foreground">
                  Digest
                </strong>
              </>
            )}
          </h2>
          <p className="mt-2 font-normal text-muted-foreground/60 text-sm">
            {digest.date}
            {!isToday && ' · 今日精选尚未生成'}
            {' · '}
            评分 {digest.stats.scored} 篇 · 精选 {digest.stats.selected} 篇
          </p>
        </div>
        <Link
          href="/digests"
          className="flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
        >
          History
          <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <div className="mt-12 md:mt-16">
        {digest.articles.map((article) => (
          <DigestCard key={article.url} article={article} />
        ))}
      </div>
    </section>
  )
}
