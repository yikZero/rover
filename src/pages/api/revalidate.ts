import { CRON_SECRET } from 'astro:env/server'
import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = (await request.json().catch(() => ({}))) as { tag?: string }
  const tag = body.tag ?? 'digest'

  return new Response(JSON.stringify({ revalidated: true, tag }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
