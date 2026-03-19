'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'

export function LocaleSwitcher() {
  const locale = useLocale()
  const t = useTranslations('Footer')
  const router = useRouter()
  const pathname = usePathname()

  const targetLocale = locale === 'zh-CN' ? 'en' : 'zh-CN'

  function handleSwitch() {
    router.replace(pathname, { locale: targetLocale })
  }

  return (
    <button
      type="button"
      onClick={handleSwitch}
      className="text-muted-foreground text-sm transition-colors hover:text-foreground"
    >
      {t('switchTo')}
    </button>
  )
}
