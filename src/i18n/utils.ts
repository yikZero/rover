import type { Locale, TranslationKey } from './ui'
import { ui } from './ui'

export type { Locale }

// Must match astro.config.mjs i18n.locales
export const locales: Locale[] = ['zh-CN', 'en']

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
