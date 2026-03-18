import { NextResponse } from 'next/server'
import { getDigestList } from '@/lib/queries'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor') ?? undefined

  const result = await getDigestList(cursor)

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
