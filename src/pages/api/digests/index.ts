import type { APIRoute } from 'astro'
import { getDigestList } from '@/lib/queries'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor') ?? undefined
  const data = await getDigestList(cursor)
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
