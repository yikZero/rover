import type { Locale, TranslationKey } from './ui'
import { ui } from './ui'

export type { Locale }

export function getLocaleFromUrl(url: URL): Locale {
  const segment = url.pathname.split('/')[1]
  return segment === 'en' ? 'en' : 'zh-CN'
}

export function getLocalePrefix(locale: Locale): string {
  return locale === 'zh-CN' ? '' : '/en'
}

export function getLocalePath(path: string, locale: Locale): string {
  const cleanPath = path.replace(/^\/en(\/|$)/, '/')
  if (locale === 'zh-CN') return cleanPath
  return `/en${cleanPath === '/' ? '' : cleanPath}`
}

export function useTranslations(locale: Locale) {
  return (key: TranslationKey, params?: Record<string, string | number>) => {
    let text: string = ui[locale]?.[key] ?? ui['zh-CN'][key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v))
      }
    }
    return text
  }
}

export function richText(
  text: string,
  strongClass = 'font-semibold text-foreground',
): string {
  return text.replace(
    /<strong>(.*?)<\/strong>/g,
    `<strong class="${strongClass}">$1</strong>`,
  )
}
