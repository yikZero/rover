export const prerender = false

import { CRON_SECRET, VERCEL_DEPLOY_HOOK_URL } from 'astro:env/server'
import type { APIRoute } from 'astro'

export const POST: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Trigger Vercel rebuild to regenerate static pages
  if (VERCEL_DEPLOY_HOOK_URL) {
    await fetch(VERCEL_DEPLOY_HOOK_URL, { method: 'POST' }).catch(() => {})
  }

  return new Response(
    JSON.stringify({ revalidated: true, rebuild: !!VERCEL_DEPLOY_HOOK_URL }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}
