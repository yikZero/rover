import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { feeds } from '@/lib/schema'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdmin()
  if (authError) return authError

  const { id } = await params
  const { isActive } = await request.json()

  const [updated] = await db
    .update(feeds)
    .set({ isActive })
    .where(eq(feeds.id, Number(id)))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Feed not found' }, { status: 404 })
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAdmin()
  if (authError) return authError

  const { id } = await params

  const [deleted] = await db
    .delete(feeds)
    .where(eq(feeds.id, Number(id)))
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: 'Feed not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
