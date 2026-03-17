import { verifyAdminToken } from '@/lib/auth'
import { type NextRequest, NextResponse } from 'next/server'

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname

  if (path.startsWith('/admin') && path !== '/admin/login') {
    const token = req.cookies.get('admin_session')?.value
    if (!token || !verifyAdminToken(token)) {
      return NextResponse.redirect(new URL('/admin/login', req.nextUrl))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
