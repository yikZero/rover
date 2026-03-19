import { ChevronLeft } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { DigestsClient } from '@/app/[locale]/digests/digests-client'
import { Link } from '@/i18n/navigation'
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
      <Link href="/" className="group flex items-center gap-2">
        <ChevronLeft
          strokeWidth={2.5}
          className="size-6 text-muted-foreground transition-transform group-hover:-translate-x-0.5"
        />
        <h2 className="text-balance font-semibold text-4xl text-muted-foreground">
          {t.rich('digestHistory', {
            strong: (chunks) => (
              <strong className="font-semibold text-foreground">
                {chunks}
              </strong>
            ),
          })}
        </h2>
      </Link>
      <DigestsClient fallbackData={[initialData]} />
    </section>
  )
}
