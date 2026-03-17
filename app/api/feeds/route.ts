import { desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseFeed } from '@/lib/rss'
import { feeds } from '@/lib/schema'

export async function GET() {
  const authError = await requireAdmin()
  if (authError) return authError

  const allFeeds = await db.select().from(feeds).orderBy(desc(feeds.createdAt))
  return NextResponse.json(allFeeds)
}

export async function POST(request: Request) {
  const authError = await requireAdmin()
  if (authError) return authError

  const { url } = await request.json()
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  const parsed = await parseFeed(url)

  const [feed] = await db
    .insert(feeds)
    .values({
      title: parsed.title,
      url,
      siteUrl: parsed.siteUrl,
    })
    .returning()

  return NextResponse.json(feed, { status: 201 })
}
