import type { APIRoute } from 'astro'
import { getDigestByDate } from '@/lib/queries'

export const prerender = false

export const GET: APIRoute = async ({ params }) => {
  const { date } = params
  if (!date) {
    return new Response(JSON.stringify({ error: 'Date required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const digest = await getDigestByDate(date)
  if (!digest) {
    return new Response(JSON.stringify({ error: 'Digest not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(digest), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=604800',
    },
  })
}
