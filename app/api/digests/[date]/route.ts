import { NextResponse } from 'next/server'
import { getDigestByDate } from '@/lib/queries'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params
  const digest = await getDigestByDate(date)

  if (!digest) {
    return NextResponse.json({ error: 'Digest not found' }, { status: 404 })
  }

  return NextResponse.json(digest, {
    headers: {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}
