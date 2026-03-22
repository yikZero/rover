import type { APIRoute } from 'astro'
import { getAllDigests } from '@/lib/queries'
import type { DigestWithArticles } from '@/lib/types'

export async function getStaticPaths() {
  const digests = await getAllDigests()
  return digests.map((digest) => ({
    params: { date: digest.date },
    props: { digest },
  }))
}

export const GET: APIRoute = async ({ props }) => {
  const { digest } = props as { digest: DigestWithArticles }

  return new Response(JSON.stringify(digest), {
    headers: { 'Content-Type': 'application/json' },
  })
}
