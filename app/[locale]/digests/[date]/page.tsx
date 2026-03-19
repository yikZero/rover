import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { DigestCard } from '@/components/digest-card'
import { Link } from '@/i18n/navigation'
import { getDigestByDate } from '@/lib/queries'

export default async function DigestDatePage({
  params,
}: {
  params: Promise<{ locale: string; date: string }>
}) {
  const { locale, date } = await params
  setRequestLocale(locale)
  const t = await getTranslations('DigestDatePage')
  const digest = await getDigestByDate(date)

  if (!digest) notFound()

  return (
    <section>
      <div>
        <Link href="/digests" className="group flex items-center gap-2">
          <ChevronLeft
            strokeWidth={2.5}
            className="size-6 text-muted-foreground transition-transform group-hover:-translate-x-0.5"
          />
          <h2 className="text-balance font-semibold text-4xl text-muted-foreground">
            {date} {t('digest')}
          </h2>
        </Link>
        <p className="mt-2 font-normal text-muted-foreground/60 text-sm">
          {t('scored', { count: digest.stats.scored })} ·{' '}
          {t('selected', { count: digest.stats.selected })}
        </p>
      </div>
      <div className="mt-12 md:mt-16">
        {digest.articles.map((article) => (
          <DigestCard key={article.url} article={article} />
        ))}
      </div>
    </section>
  )
}
