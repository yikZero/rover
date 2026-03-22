export const prerender = false

import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { defaultLocale, useTranslations } from '@/i18n/utils'
import { getDigestList } from '@/lib/queries'

const t = useTranslations(defaultLocale)

function escapeHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export async function GET(context: APIContext) {
  try {
    const { digests } = await getDigestList()

    const response = await rss({
      title: 'Rover',
      description: t('site.description'),
      trailingSlash: false,
      site: context.site?.href,
      items: digests.slice(0, 5).map((digest) => ({
        title: `Rover ${digest.date} ${t('digestDate.pageTitle')}`,
        description: digest.articles
          .map((a) => a.titleZh)
          .slice(0, 3)
          .join(' · '),
        content: digest.articles
          .map(
            (a) =>
              `<h3><a href="${escapeHtml(a.url)}">${escapeHtml(a.titleZh)}</a></h3><p>${escapeHtml(a.summaryZh)}</p>`,
          )
          .join(''),
        link: `/digests/${digest.date}`,
        pubDate: new Date(digest.date),
      })),
    })

    response.headers.set('Cache-Control', 'public, max-age=3600')

    return response
  } catch {
    return new Response(
      '<rss version="2.0"><channel><title>Rover</title></channel></rss>',
      {
        status: 500,
        headers: { 'Content-Type': 'application/xml' },
      },
    )
  }
}
