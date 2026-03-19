import { getTranslations, setRequestLocale } from 'next-intl/server'
import { DigestsClient } from '@/app/[locale]/digests/digests-client'
import { getDigestList } from '@/lib/queries'

export default async function DigestsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('DigestsPage')
  const initialData = await getDigestList()

  return (
    <section>
      <h2 className="text-balance font-semibold text-4xl text-muted-foreground">
        {t.rich('digestHistory', {
          strong: (chunks) => (
            <strong className="font-semibold text-foreground">{chunks}</strong>
          ),
        })}
      </h2>
      <DigestsClient fallbackData={[initialData]} />
    </section>
  )
}
