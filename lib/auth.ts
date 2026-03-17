import { createHmac } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getSecret(): string {
  const password = process.env.ADMIN_PASSWORD
  if (!password) throw new Error('ADMIN_PASSWORD is not set')
  return password
}

export function createAdminToken(): string {
  const timestamp = Date.now().toString()
  const hmac = createHmac('sha256', getSecret()).update(timestamp).digest('hex')
  return `${timestamp}.${hmac}`
}

export function verifyAdminToken(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 2) return false

  const [timestamp, signature] = parts
  const ts = Number(timestamp)
  if (Number.isNaN(ts)) return false

  // Check TTL
  if (Date.now() - ts > SESSION_TTL_MS) return false

  // Verify HMAC
  const expected = createHmac('sha256', getSecret())
    .update(timestamp)
    .digest('hex')
  return signature === expected
}

export async function requireAdmin(): Promise<NextResponse | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_session')?.value
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
