import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DigestCard } from '@/components/digest-card'
import { getDigestByDate } from '@/lib/queries'

export default async function DigestDatePage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  const digest = await getDigestByDate(date)

  if (!digest) notFound()

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
        {digest.articles.map((article) => (
          <DigestCard key={article.url} article={article} />
        ))}
      </div>
    </section>
  )
}
