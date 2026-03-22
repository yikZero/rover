import { defineMiddleware } from 'astro:middleware'
import { defaultLocale } from '@/i18n/utils'

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next()
  if (response.status === 404 && !context.url.pathname.endsWith('/404')) {
    const locale = context.currentLocale ?? defaultLocale
    const target = locale === defaultLocale ? '/404' : `/${locale}/404`
    const rewritten = await context.rewrite(target)
    return new Response(rewritten.body, {
      status: 404,
      headers: rewritten.headers,
    })
  }
  return response
})
