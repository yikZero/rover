export const revalidate = 3600

import { eq } from 'drizzle-orm'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
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
    })
    .from(digestArticles)
    .innerJoin(articles, eq(digestArticles.articleId, articles.id))
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .innerJoin(scores, eq(articles.id, scores.articleId))
    .where(eq(digestArticles.digestId, digest.id))
    .orderBy(digestArticles.rank)

  return (
    <section>
      <Link href="/digests" className="group flex items-center gap-2">
        <ChevronLeft className="size-5 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
        <h2 className="text-balance font-semibold text-4xl text-muted-foreground">
          {date}{' '}
          <strong className="font-semibold text-foreground">Digest</strong>
        </h2>
      </Link>
      <div className="mt-12 md:mt-16">
        {(items as DigestArticle[]).map((article) => (
          <DigestCard key={article.url} article={article} />
        ))}
      </div>
    </section>
  )
}
