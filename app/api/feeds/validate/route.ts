import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { parseFeed } from '@/lib/rss'

export async function POST(request: Request) {
  const authError = await requireAdmin()
  if (authError) return authError

  const { url } = await request.json()
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    const parsed = await parseFeed(url)
    return NextResponse.json({
      valid: true,
      title: parsed.title,
      siteUrl: parsed.siteUrl,
      itemCount: parsed.items.length,
    })
  } catch {
    return NextResponse.json(
      { valid: false, error: 'Invalid RSS feed URL' },
      { status: 400 },
    )
  }
}
