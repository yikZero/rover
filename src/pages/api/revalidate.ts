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

  let rebuildTriggered = false
  let rebuildError: string | null = null

  if (VERCEL_DEPLOY_HOOK_URL) {
    try {
      const res = await fetch(VERCEL_DEPLOY_HOOK_URL, { method: 'POST' })
      rebuildTriggered = res.ok
      if (!res.ok) rebuildError = `Deploy hook returned ${res.status}`
    } catch (err) {
      rebuildError = err instanceof Error ? err.message : 'Unknown error'
    }
  }

  return new Response(
    JSON.stringify({ revalidated: true, rebuildTriggered, rebuildError }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}
