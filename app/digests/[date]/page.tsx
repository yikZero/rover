import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
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

export default async function DigestDatePage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params

  const [digest] = await db
    .select()
    .from(dailyDigests)
    .where(eq(dailyDigests.date, date))
    .limit(1)

  if (!digest) notFound()

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

  return (
    <div>
      <div className="mb-6">
        <p className="text-muted-foreground text-sm">{date} 精选</p>
      </div>
      <div className="space-y-3">
        {(items as DigestArticle[]).map((article) => (
          <DigestCard key={article.url} article={article} />
        ))}
      </div>
    </div>
  )
}
