import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { DigestCard } from '@/components/digest-card'
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
        <h2 className="text-balance font-semibold text-2xl text-muted-foreground md:text-4xl">
          {date}{' '}
          {t.rich('digest', {
            strong: (chunks) => (
              <strong className="font-semibold text-foreground">
                {chunks}
              </strong>
            ),
          })}
        </h2>
        {digest.stats.fetched > 0 && (
          <p className="mt-1.5 font-normal text-muted-foreground/60 text-sm">
            {t('fetched', { count: digest.stats.fetched })} ·{' '}
            {t('selected', { count: digest.stats.selected })}
          </p>
        )}
      </div>
      <div className="mt-8 md:mt-16">
        {digest.articles.map((article) => (
          <DigestCard key={article.url} article={article} />
        ))}
      </div>
    </section>
  )
}
