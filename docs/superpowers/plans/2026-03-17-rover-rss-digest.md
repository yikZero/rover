# Rover RSS Digest Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public-facing AI-curated daily tech digest platform with admin-only feed management.

**Architecture:** Next.js 16 App Router monolith. Cron API route fetches RSS → AI scores articles → generates daily digest. Public SSR pages serve digests. Password-protected admin panel manages feeds. All data in PostgreSQL via Drizzle ORM.

**Tech Stack:** Next.js 16, React 19, Drizzle ORM, PostgreSQL, Vercel AI SDK v6, Google Gemini, Tailwind CSS v4, shadcn/ui, SWR, rss-parser, zod

**Spec:** `docs/superpowers/specs/2026-03-17-rover-rss-digest-design.md`

---

## File Structure

```
lib/
  schema.ts          — Full database schema (feeds, articles, scores, daily_digests, digest_articles)
  db.ts              — Drizzle client (keep existing, no changes)
  ai.ts              — AI helpers: scoreArticles(), generateSummary()
  auth.ts            — Admin HMAC token generation/verification
  rss.ts             — RSS feed parsing helper
  fetcher.ts         — SWR fetcher (keep existing, no changes)
  utils.ts           — cn() utility (keep existing, no changes)

app/
  layout.tsx         — Root layout (minor update: add metadata)
  page.tsx           — Today's digest (public, SSR)
  globals.css        — Keep existing (no changes)

  digests/
    page.tsx         — History with infinite scroll
    [date]/
      page.tsx       — Single day's digest

  admin/
    layout.tsx       — Admin layout with nav
    page.tsx         — Feed management dashboard
    login/
      page.tsx       — Login page
    feeds/
      new/
        page.tsx     — Add new feed form

  api/
    auth/
      login/route.ts
      logout/route.ts
    digests/
      route.ts       — GET paginated digest list
      [date]/
        route.ts     — GET single day's digest with articles
    feeds/
      route.ts       — GET list, POST create
      [id]/
        route.ts     — PATCH toggle, DELETE
      validate/
        route.ts     — POST validate RSS URL
    cron/
      daily/
        route.ts     — POST daily pipeline

proxy.ts             — Admin route protection

components/
  digest-card.tsx    — Article card (rank, source, title, summary, score)
  score-badge.tsx    — Total score badge with hover expansion

vercel.json          — Cron schedule config
```

---

## Task 1: Dependencies & Database Schema

**Files:**
- Modify: `package.json`
- Modify: `lib/schema.ts`
- Modify: `.env.example`
- Create: `vercel.json`

- [ ] **Step 1: Install new dependencies, remove supabase**

```bash
bun add zod rss-parser
bun remove @supabase/supabase-js
```

- [ ] **Step 2: Update `.env.example`**

```
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-key
CRON_SECRET=your-cron-secret
ADMIN_PASSWORD=your-admin-password
```

- [ ] **Step 3: Write the full Drizzle schema in `lib/schema.ts`**

Replace the existing `posts` table with the complete schema:

```typescript
import {
  bigint,
  boolean,
  date,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

export const feeds = pgTable('feeds', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  url: text().notNull().unique(),
  siteUrl: text('site_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const articles = pgTable(
  'articles',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    feedId: bigint('feed_id', { mode: 'number' })
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    url: text().notNull().unique(),
    content: text(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('articles_feed_id_idx').on(table.feedId),
    index('articles_published_at_idx').on(table.publishedAt),
  ],
)

export const scores = pgTable(
  'scores',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .unique()
      .references(() => articles.id, { onDelete: 'cascade' }),
    infoDensity: smallint('info_density').notNull(),
    popularity: smallint().notNull(),
    practicality: smallint().notNull(),
    total: smallint().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('scores_article_id_idx').on(table.articleId),
    index('scores_total_idx').on(table.total),
  ],
)

export const dailyDigests = pgTable(
  'daily_digests',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    date: date().notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('daily_digests_date_idx').on(table.date)],
)

export const digestArticles = pgTable(
  'digest_articles',
  {
    digestId: bigint('digest_id', { mode: 'number' })
      .notNull()
      .references(() => dailyDigests.id, { onDelete: 'cascade' }),
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    rank: smallint().notNull(),
    summary: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.digestId, table.articleId] }),
    index('digest_articles_digest_id_idx').on(table.digestId),
    index('digest_articles_article_id_idx').on(table.articleId),
  ],
)
```

- [ ] **Step 4: Generate and run migration**

```bash
bun run db:generate
bun run db:migrate
```

- [ ] **Step 5: Create `vercel.json` for cron schedule**

```json
{
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "0 1 * * *"
    }
  ]
}
```

- [ ] **Step 6: Verify schema in Drizzle Studio**

```bash
bun run db:studio
```

Open the studio URL and confirm all 5 tables exist with correct columns and indexes.

- [ ] **Step 7: Commit**

```bash
git add lib/schema.ts package.json bun.lock .env.example vercel.json
git commit -m "feat: add database schema and dependencies for RSS digest platform"
```

---

## Task 2: Admin Authentication

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `proxy.ts`

- [ ] **Step 1: Create `lib/auth.ts` — token generation and verification**

```typescript
import { createHmac } from 'node:crypto'

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
  const expected = createHmac('sha256', getSecret()).update(timestamp).digest('hex')
  return signature === expected
}
```

- [ ] **Step 2: Create `app/api/auth/login/route.ts`**

```typescript
import { createAdminToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { password } = await request.json()

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = createAdminToken()
  const cookieStore = await cookies()
  cookieStore.set('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: '/',
  })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Create `app/api/auth/logout/route.ts`**

```typescript
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_session')
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Create `proxy.ts` in project root**

```typescript
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
```

- [ ] **Step 5: Verify — start dev server, confirm `/admin` redirects to `/admin/login`**

```bash
bun dev
# Visit http://localhost:3000/admin → should redirect to /admin/login
```

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts app/api/auth proxy.ts
git commit -m "feat: add admin password authentication with HMAC sessions"
```

---

## Task 3: Admin Login Page

**Files:**
- Create: `app/admin/login/page.tsx`
- Create: `app/admin/layout.tsx`

- [ ] **Step 1: Add shadcn/ui components needed for admin**

```bash
bunx shadcn add button input card label table switch badge
```

- [ ] **Step 2: Create `app/admin/login/page.tsx`**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/admin')
    } else {
      setError('密码错误')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Rover Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/admin/layout.tsx`**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-bold">
              Rover Admin
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/admin">Feeds</Link>
              <Link href="/admin/feeds/new">Add Feed</Link>
            </nav>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            退出
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 4: Verify — visit `/admin/login`, enter password, confirm redirect to `/admin`**

```bash
bun dev
# Visit http://localhost:3000/admin/login
# Enter ADMIN_PASSWORD → should redirect to /admin
```

- [ ] **Step 5: Commit**

```bash
git add app/admin components/ui
git commit -m "feat: add admin login page and layout"
```

---

## Task 4: Feed Management API

**Files:**
- Create: `app/api/feeds/route.ts`
- Create: `app/api/feeds/[id]/route.ts`
- Create: `app/api/feeds/validate/route.ts`
- Create: `lib/rss.ts`

- [ ] **Step 1: Create `lib/rss.ts` — RSS parsing helper**

```typescript
import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 10000,
})

export interface ParsedFeed {
  title: string
  siteUrl: string | undefined
  items: ParsedItem[]
}

export interface ParsedItem {
  title: string
  url: string
  content: string
  publishedAt: Date | undefined
}

export async function parseFeed(url: string): Promise<ParsedFeed> {
  const feed = await parser.parseURL(url)

  return {
    title: feed.title ?? url,
    siteUrl: feed.link,
    items: (feed.items ?? [])
      .filter((item) => item.link)
      .map((item) => ({
        title: item.title ?? 'Untitled',
        url: item.link!,
        content: item.contentSnippet ?? item.content ?? '',
        publishedAt: item.isoDate ? new Date(item.isoDate) : undefined,
      })),
  }
}
```

- [ ] **Step 2: Create admin auth check helper at top of `lib/auth.ts`**

Append to `lib/auth.ts`:

```typescript
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function requireAdmin(): Promise<NextResponse | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_session')?.value
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
```

- [ ] **Step 3: Create `app/api/feeds/route.ts` — GET list, POST create**

```typescript
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { parseFeed } from '@/lib/rss'
import { feeds } from '@/lib/schema'
import { desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'

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

  // Parse feed to get title and site URL
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
```

- [ ] **Step 4: Create `app/api/feeds/[id]/route.ts` — PATCH toggle, DELETE**

```typescript
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { feeds } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

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
```

- [ ] **Step 5: Create `app/api/feeds/validate/route.ts`**

```typescript
import { requireAdmin } from '@/lib/auth'
import { parseFeed } from '@/lib/rss'
import { NextResponse } from 'next/server'

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
    return NextResponse.json({ valid: false, error: 'Invalid RSS feed URL' }, { status: 400 })
  }
}
```

- [ ] **Step 6: Verify — use curl to test feed CRUD**

```bash
# Login first
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"your-password"}'

# Validate a feed
curl -b cookies.txt -X POST http://localhost:3000/api/feeds/validate \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://hnrss.org/frontpage"}'

# Create a feed
curl -b cookies.txt -X POST http://localhost:3000/api/feeds \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://hnrss.org/frontpage"}'

# List feeds
curl -b cookies.txt http://localhost:3000/api/feeds

# Clean up
rm cookies.txt
```

- [ ] **Step 7: Commit**

```bash
git add lib/rss.ts lib/auth.ts app/api/feeds
git commit -m "feat: add feed management API routes with RSS parsing"
```

---

## Task 5: Admin Feed Management UI

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/feeds/new/page.tsx`

- [ ] **Step 1: Create `app/admin/page.tsx` — feed list dashboard**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'

interface Feed {
  id: number
  title: string
  url: string
  siteUrl: string | null
  isActive: boolean
  createdAt: string
}

export default function AdminPage() {
  const { data: feeds, mutate } = useSWR<Feed[]>('/api/feeds', fetcher)

  async function toggleActive(id: number, isActive: boolean) {
    await fetch(`/api/feeds/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    })
    mutate()
  }

  async function deleteFeed(id: number) {
    if (!confirm('确定删除？')) return
    await fetch(`/api/feeds/${id}`, { method: 'DELETE' })
    mutate()
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">RSS Feeds</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>状态</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {feeds?.map((feed) => (
            <TableRow key={feed.id}>
              <TableCell className="font-medium">{feed.title}</TableCell>
              <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                {feed.url}
              </TableCell>
              <TableCell>
                <Switch
                  checked={feed.isActive}
                  onCheckedChange={(checked) => toggleActive(feed.id, checked)}
                />
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => deleteFeed(feed.id)}>
                  删除
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {feeds?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                暂无 Feed，去添加一个吧
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/admin/feeds/new/page.tsx` — add feed form**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function NewFeedPage() {
  const [url, setUrl] = useState('')
  const [validating, setValidating] = useState(false)
  const [creating, setCreating] = useState(false)
  const [preview, setPreview] = useState<{
    title: string
    siteUrl: string | null
    itemCount: number
  } | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleValidate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setPreview(null)
    setValidating(true)

    const res = await fetch('/api/feeds/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    const data = await res.json()
    if (data.valid) {
      setPreview(data)
    } else {
      setError(data.error ?? '无效的 RSS 地址')
    }
    setValidating(false)
  }

  async function handleCreate() {
    setCreating(true)
    const res = await fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    if (res.ok) {
      router.push('/admin')
    } else {
      const data = await res.json()
      setError(data.error ?? '创建失败')
    }
    setCreating(false)
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>添加 RSS Feed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleValidate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">RSS URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/feed.xml"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setPreview(null)
              }}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="secondary" disabled={validating}>
            {validating ? '验证中...' : '验证'}
          </Button>
        </form>

        {preview && (
          <div className="space-y-3 rounded-md border p-4">
            <p>
              <strong>名称:</strong> {preview.title}
            </p>
            {preview.siteUrl && (
              <p>
                <strong>站点:</strong> {preview.siteUrl}
              </p>
            )}
            <p>
              <strong>文章数:</strong> {preview.itemCount}
            </p>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? '添加中...' : '确认添加'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Verify — login to admin, add a real RSS feed, toggle it, delete it**

```bash
bun dev
# 1. Visit /admin/login → enter password
# 2. Visit /admin/feeds/new → enter https://hnrss.org/frontpage → validate → add
# 3. Visit /admin → see feed in table → toggle switch → delete
```

- [ ] **Step 4: Commit**

```bash
git add app/admin
git commit -m "feat: add admin feed management UI"
```

---

## Task 6: AI Scoring & Summary Helpers

**Files:**
- Modify: `lib/ai.ts`

- [ ] **Step 1: Rewrite `lib/ai.ts` with scoring and summary functions**

```typescript
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

const model = google('gemini-2.5-flash')

const scoringSchema = z.object({
  scores: z.array(
    z.object({
      article_id: z.number(),
      info_density: z.number().min(0).max(100),
      popularity: z.number().min(0).max(100),
      practicality: z.number().min(0).max(100),
    }),
  ),
})

const summarySchema = z.object({
  summary: z.string(),
})

export interface ArticleForScoring {
  id: number
  title: string
  content: string | null
}

export interface ArticleScore {
  articleId: number
  infoDensity: number
  popularity: number
  practicality: number
  total: number
}

export async function scoreArticles(articles: ArticleForScoring[]): Promise<ArticleScore[]> {
  const articlesJson = articles
    .map((a) => `[ID: ${a.id}] ${a.title}\n${a.content ?? ''}`)
    .join('\n---\n')

  const { object } = await generateObject({
    model,
    schema: scoringSchema,
    prompt: `You are a tech article quality reviewer.
Rate each article on three dimensions (0-100):
1. info_density: substantial technical insights or new knowledge, not fluff
2. popularity: hot topic in the community or influential in the industry
3. practicality: directly applicable to real-world work

Articles:
${articlesJson}`,
  })

  return object.scores.map((s) => ({
    articleId: s.article_id,
    infoDensity: s.info_density,
    popularity: s.popularity,
    practicality: s.practicality,
    total: Math.round(s.info_density * 0.4 + s.popularity * 0.3 + s.practicality * 0.3),
  }))
}

export async function generateSummary(title: string, content: string): Promise<string> {
  const { object } = await generateObject({
    model,
    schema: summarySchema,
    prompt: `You are a tech content editor.
Write a Chinese summary for the following article:
- 150-200 characters
- Highlight core insights and key information
- Professional and concise, targeting developers
- Output MUST be in Simplified Chinese

Title: ${title}
Content: ${content}`,
  })

  return object.summary
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/ai.ts
git commit -m "feat: add AI scoring and summary generation helpers"
```

---

## Task 7: Cron Pipeline

**Files:**
- Create: `app/api/cron/daily/route.ts`

- [ ] **Step 1: Create `app/api/cron/daily/route.ts`**

```typescript
import { scoreArticles, generateSummary } from '@/lib/ai'
import { db } from '@/lib/db'
import { parseFeed } from '@/lib/rss'
import {
  articles,
  dailyDigests,
  digestArticles,
  feeds,
  scores,
} from '@/lib/schema'
import { and, eq, isNull, gte, desc, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]
  console.log(`[cron] Starting daily digest for ${today}`)

  // Check idempotency
  const existing = await db
    .select()
    .from(dailyDigests)
    .where(eq(dailyDigests.date, today))
    .limit(1)

  if (existing.length > 0) {
    console.log('[cron] Digest already exists for today, skipping')
    return NextResponse.json({ message: 'Digest already exists' })
  }

  // Step 1: Fetch articles from active feeds
  const activeFeeds = await db
    .select()
    .from(feeds)
    .where(eq(feeds.isActive, true))

  console.log(`[cron] Found ${activeFeeds.length} active feeds`)

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  let totalNewArticles = 0

  for (const feed of activeFeeds) {
    try {
      const parsed = await parseFeed(feed.url)
      const recentItems = parsed.items.filter(
        (item) => !item.publishedAt || item.publishedAt >= yesterday,
      )

      for (const item of recentItems) {
        try {
          const result = await db
            .insert(articles)
            .values({
              feedId: feed.id,
              title: item.title,
              url: item.url,
              content: item.content,
              publishedAt: item.publishedAt,
            })
            .onConflictDoNothing({ target: articles.url })
            .returning({ id: articles.id })
          if (result.length > 0) totalNewArticles++
        } catch (e) {
          // Insert error — skip
        }
      }
    } catch (e) {
      console.error(`[cron] Failed to fetch feed: ${feed.url}`, e)
    }
  }

  console.log(`[cron] Fetched ${totalNewArticles} new articles`)

  if (totalNewArticles === 0) {
    console.log('[cron] No new articles, skipping digest')
    return NextResponse.json({ message: 'No new articles' })
  }

  // Step 2: Score unscored articles
  const unscoredArticles = await db
    .select({
      id: articles.id,
      title: articles.title,
      content: articles.content,
    })
    .from(articles)
    .leftJoin(scores, eq(articles.id, scores.articleId))
    .where(and(isNull(scores.id), gte(articles.createdAt, yesterday)))

  console.log(`[cron] Scoring ${unscoredArticles.length} articles`)

  // Batch score (20 at a time)
  for (let i = 0; i < unscoredArticles.length; i += 20) {
    const batch = unscoredArticles.slice(i, i + 20)
    try {
      const articleScores = await scoreArticles(batch)
      for (const score of articleScores) {
        await db.insert(scores).values({
          articleId: score.articleId,
          infoDensity: score.infoDensity,
          popularity: score.popularity,
          practicality: score.practicality,
          total: score.total,
        }).onConflictDoNothing({ target: scores.articleId })
      }
    } catch (e) {
      console.error(`[cron] AI scoring failed for batch starting at ${i}`, e)
      // Retry once
      try {
        const articleScores = await scoreArticles(batch)
        for (const score of articleScores) {
          await db.insert(scores).values({
            articleId: score.articleId,
            infoDensity: score.infoDensity,
            popularity: score.popularity,
            practicality: score.practicality,
            total: score.total,
          }).onConflictDoNothing({ target: scores.articleId })
        }
      } catch (retryError) {
        console.error(`[cron] AI scoring retry failed, skipping batch`, retryError)
      }
    }
  }

  // Step 3: Generate digest
  const topArticles = await db
    .select({
      id: articles.id,
      title: articles.title,
      content: articles.content,
      url: articles.url,
      feedTitle: feeds.title,
      total: scores.total,
      infoDensity: scores.infoDensity,
      popularity: scores.popularity,
      practicality: scores.practicality,
    })
    .from(articles)
    .innerJoin(scores, eq(articles.id, scores.articleId))
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(and(gte(scores.total, 50), gte(articles.createdAt, yesterday)))
    .orderBy(desc(scores.total))
    .limit(10)

  if (topArticles.length < 5) {
    console.log(`[cron] Only ${topArticles.length} articles scored >= 50, skipping digest`)
    return NextResponse.json({ message: 'Not enough quality articles' })
  }

  console.log(`[cron] Generating summaries for ${topArticles.length} articles`)

  // Create digest
  const [digest] = await db
    .insert(dailyDigests)
    .values({ date: today })
    .returning()

  for (let i = 0; i < topArticles.length; i++) {
    const article = topArticles[i]
    try {
      const summary = await generateSummary(article.title, article.content ?? '')
      await db.insert(digestArticles).values({
        digestId: digest.id,
        articleId: article.id,
        rank: i + 1,
        summary,
      })
    } catch (e) {
      console.error(`[cron] Summary generation failed for article ${article.id}`, e)
    }
  }

  console.log(`[cron] Daily digest generated successfully for ${today}`)

  return NextResponse.json({
    message: 'Digest generated',
    date: today,
    articleCount: topArticles.length,
  })
}
```

- [ ] **Step 2: Verify — trigger cron manually with curl**

```bash
curl -X POST http://localhost:3000/api/cron/daily \
  -H "Authorization: Bearer your-cron-secret"
```

Check console logs for the pipeline progress. Verify data in Drizzle Studio.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron
git commit -m "feat: add daily cron pipeline (fetch, score, summarize)"
```

---

## Task 8: Public Digest API Routes

**Files:**
- Create: `app/api/digests/route.ts`
- Create: `app/api/digests/[date]/route.ts`

- [ ] **Step 1: Create `app/api/digests/route.ts` — paginated digest list**

```typescript
import { db } from '@/lib/db'
import { dailyDigests } from '@/lib/schema'
import { desc, lt } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor') // date string, e.g. "2026-03-15"
  const limit = 10

  const conditions = cursor ? lt(dailyDigests.date, cursor) : undefined

  const digests = await db
    .select()
    .from(dailyDigests)
    .where(conditions)
    .orderBy(desc(dailyDigests.date))
    .limit(limit + 1) // fetch one extra to determine hasMore

  const hasMore = digests.length > limit
  const results = hasMore ? digests.slice(0, limit) : digests
  const nextCursor = hasMore ? results[results.length - 1].date : null

  return NextResponse.json({
    digests: results,
    nextCursor,
  })
}
```

- [ ] **Step 2: Create `app/api/digests/[date]/route.ts` — single day's digest with articles**

```typescript
import { db } from '@/lib/db'
import { articles, dailyDigests, digestArticles, feeds, scores } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params

  const [digest] = await db
    .select()
    .from(dailyDigests)
    .where(eq(dailyDigests.date, date))
    .limit(1)

  if (!digest) {
    return NextResponse.json({ error: 'Digest not found' }, { status: 404 })
  }

  const items = await db
    .select({
      rank: digestArticles.rank,
      summary: digestArticles.summary,
      articleId: articles.id,
      title: articles.title,
      url: articles.url,
      publishedAt: articles.publishedAt,
      feedTitle: feeds.title,
      feedSiteUrl: feeds.siteUrl,
      total: scores.total,
      infoDensity: scores.infoDensity,
      popularity: scores.popularity,
      practicality: scores.practicality,
    })
    .from(digestArticles)
    .innerJoin(articles, eq(digestArticles.articleId, articles.id))
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .innerJoin(scores, eq(articles.id, scores.articleId))
    .where(eq(digestArticles.digestId, digest.id))
    .orderBy(digestArticles.rank)

  return NextResponse.json({
    date: digest.date,
    createdAt: digest.createdAt,
    articles: items,
  })
}
```

- [ ] **Step 3: Verify — fetch digests via curl (requires cron to have run first)**

```bash
# List digests
curl http://localhost:3000/api/digests

# Get specific day
curl http://localhost:3000/api/digests/2026-03-17
```

- [ ] **Step 4: Commit**

```bash
git add app/api/digests
git commit -m "feat: add public digest API routes"
```

---

## Task 9: Shared UI Components

**Files:**
- Create: `components/digest-card.tsx`
- Create: `components/score-badge.tsx`

- [ ] **Step 1: Create `components/score-badge.tsx`**

```tsx
'use client'

import { cn } from '@/lib/utils'
import { useState } from 'react'

interface ScoreBadgeProps {
  total: number
  infoDensity: number
  popularity: number
  practicality: number
}

export function ScoreBadge({ total, infoDensity, popularity, practicality }: ScoreBadgeProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div
        className={cn(
          'inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground transition-colors',
        )}
      >
        {total}
      </div>
      {expanded && (
        <div className="absolute right-0 top-full z-10 mt-1 flex gap-2 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
          <span>
            <span className="text-muted-foreground">密度</span> {infoDensity}
          </span>
          <span>
            <span className="text-muted-foreground">热度</span> {popularity}
          </span>
          <span>
            <span className="text-muted-foreground">实用</span> {practicality}
          </span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/digest-card.tsx`**

```tsx
import { ScoreBadge } from '@/components/score-badge'

export interface DigestArticle {
  rank: number
  title: string
  url: string
  summary: string
  feedTitle: string
  total: number
  infoDensity: number
  popularity: number
  practicality: number
}

export function DigestCard({ article }: { article: DigestArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border p-4 transition-colors hover:bg-accent"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">#{article.rank}</span>
          <span>&middot;</span>
          <span>{article.feedTitle}</span>
        </div>
        <ScoreBadge
          total={article.total}
          infoDensity={article.infoDensity}
          popularity={article.popularity}
          practicality={article.practicality}
        />
      </div>
      <h3 className="mb-2 font-semibold leading-snug">{article.title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{article.summary}</p>
    </a>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/digest-card.tsx components/score-badge.tsx
git commit -m "feat: add DigestCard and ScoreBadge components"
```

---

## Task 10: Public Pages — Home & Digest Detail

**Files:**
- Modify: `app/page.tsx`
- Create: `app/digests/[date]/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update `app/layout.tsx` — add site header with nav**

Keep existing font setup, add a simple header:

```tsx
import '@/app/globals.css'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rover — Daily Tech Digest',
  description: 'AI-curated daily tech article digest',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="border-b">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-xl font-bold tracking-wider">
              ROVER
            </Link>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground">
                Today
              </Link>
              <Link href="/digests" className="hover:text-foreground">
                History
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Rewrite `app/page.tsx` — today's digest**

```tsx
import { DigestCard } from '@/components/digest-card'
import type { DigestArticle } from '@/components/digest-card'
import { db } from '@/lib/db'
import { articles, dailyDigests, digestArticles, feeds, scores } from '@/lib/schema'
import { desc, eq } from 'drizzle-orm'

async function getLatestDigest() {
  const [digest] = await db
    .select()
    .from(dailyDigests)
    .orderBy(desc(dailyDigests.date))
    .limit(1)

  if (!digest) return null

  const items = await db
    .select({
      rank: digestArticles.rank,
      summary: digestArticles.summary,
      title: articles.title,
      url: articles.url,
      feedTitle: feeds.title,
      total: scores.total,
      infoDensity: scores.infoDensity,
      popularity: scores.popularity,
      practicality: scores.practicality,
    })
    .from(digestArticles)
    .innerJoin(articles, eq(digestArticles.articleId, articles.id))
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .innerJoin(scores, eq(articles.id, scores.articleId))
    .where(eq(digestArticles.digestId, digest.id))
    .orderBy(digestArticles.rank)

  return { date: digest.date, articles: items as DigestArticle[] }
}

export default async function HomePage() {
  const digest = await getLatestDigest()

  if (!digest) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p className="text-lg">暂无精选内容</p>
        <p className="mt-2 text-sm">每日精选将在北京时间 09:00 自动生成</p>
      </div>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const isToday = digest.date === today

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">
          {isToday ? '今日精选' : `${digest.date} 精选`}
          {!isToday && ' (今日精选尚未生成)'}
        </p>
        <p className="text-xs text-muted-foreground">{digest.date}</p>
      </div>
      <div className="space-y-3">
        {digest.articles.map((article) => (
          <DigestCard key={article.url} article={article} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/digests/[date]/page.tsx`**

```tsx
import { DigestCard } from '@/components/digest-card'
import type { DigestArticle } from '@/components/digest-card'
import { db } from '@/lib/db'
import { articles, dailyDigests, digestArticles, feeds, scores } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'

export default async function DigestDatePage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params

  const [digest] = await db
    .select()
    .from(dailyDigests)
    .where(eq(dailyDigests.date, date))
    .limit(1)

  if (!digest) notFound()

  const items = await db
    .select({
      rank: digestArticles.rank,
      summary: digestArticles.summary,
      title: articles.title,
      url: articles.url,
      feedTitle: feeds.title,
      total: scores.total,
      infoDensity: scores.infoDensity,
      popularity: scores.popularity,
      practicality: scores.practicality,
    })
    .from(digestArticles)
    .innerJoin(articles, eq(digestArticles.articleId, articles.id))
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .innerJoin(scores, eq(articles.id, scores.articleId))
    .where(eq(digestArticles.digestId, digest.id))
    .orderBy(digestArticles.rank)

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">{date} 精选</p>
      </div>
      <div className="space-y-3">
        {(items as DigestArticle[]).map((article) => (
          <DigestCard key={article.url} article={article} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify — visit `/` and `/digests/YYYY-MM-DD` in browser**

```bash
bun dev
# Visit http://localhost:3000/ → should show latest digest or empty state
# Visit http://localhost:3000/digests/2026-03-17 → should show that day's digest
```

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/layout.tsx app/digests
git commit -m "feat: add public home page and digest detail page"
```

---

## Task 11: History Page with Infinite Scroll

**Files:**
- Create: `app/digests/page.tsx`

- [ ] **Step 1: Update `app/api/digests/route.ts` to include articles in response**

Update the GET handler to also return articles for each digest, so the history page can render full cards:

```typescript
import { db } from '@/lib/db'
import { articles, dailyDigests, digestArticles, feeds, scores } from '@/lib/schema'
import { desc, eq, lt } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limit = 10

  const conditions = cursor ? lt(dailyDigests.date, cursor) : undefined

  const digests = await db
    .select()
    .from(dailyDigests)
    .where(conditions)
    .orderBy(desc(dailyDigests.date))
    .limit(limit + 1)

  const hasMore = digests.length > limit
  const results = hasMore ? digests.slice(0, limit) : digests
  const nextCursor = hasMore ? results[results.length - 1].date : null

  // Fetch articles for each digest
  const digestsWithArticles = await Promise.all(
    results.map(async (digest) => {
      const items = await db
        .select({
          rank: digestArticles.rank,
          summary: digestArticles.summary,
          title: articles.title,
          url: articles.url,
          feedTitle: feeds.title,
          total: scores.total,
          infoDensity: scores.infoDensity,
          popularity: scores.popularity,
          practicality: scores.practicality,
        })
        .from(digestArticles)
        .innerJoin(articles, eq(digestArticles.articleId, articles.id))
        .innerJoin(feeds, eq(articles.feedId, feeds.id))
        .innerJoin(scores, eq(articles.id, scores.articleId))
        .where(eq(digestArticles.digestId, digest.id))
        .orderBy(digestArticles.rank)

      return { ...digest, articles: items }
    }),
  )

  return NextResponse.json({ digests: digestsWithArticles, nextCursor })
}
```

- [ ] **Step 2: Create `app/digests/page.tsx`**

```tsx
'use client'

import { DigestCard } from '@/components/digest-card'
import type { DigestArticle } from '@/components/digest-card'
import { fetcher } from '@/lib/fetcher'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import useSWRInfinite from 'swr/infinite'

interface DigestWithArticles {
  id: number
  date: string
  articles: DigestArticle[]
}

interface DigestsResponse {
  digests: DigestWithArticles[]
  nextCursor: string | null
}

export default function DigestsPage() {
  const getKey = (pageIndex: number, previousPageData: DigestsResponse | null) => {
    if (previousPageData && !previousPageData.nextCursor) return null
    if (pageIndex === 0) return '/api/digests'
    return `/api/digests?cursor=${previousPageData!.nextCursor}`
  }

  const { data, setSize, isValidating } = useSWRInfinite<DigestsResponse>(getKey, fetcher)

  const allDigests = data?.flatMap((page) => page.digests) ?? []
  const hasMore = data?.[data.length - 1]?.nextCursor !== null
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isValidating) {
          setSize((prev) => prev + 1)
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isValidating, setSize])

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold">历史精选</h1>
      <div className="space-y-10">
        {allDigests.map((digest) => (
          <section key={digest.date}>
            <Link
              href={`/digests/${digest.date}`}
              className="mb-3 block text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {digest.date}
            </Link>
            <div className="space-y-3">
              {digest.articles.map((article) => (
                <DigestCard key={article.url} article={article} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div ref={sentinelRef} className="py-8 text-center text-sm text-muted-foreground">
        {isValidating ? '加载中...' : hasMore ? '' : '没有更多了'}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify — visit `/digests`, scroll to load more**

```bash
bun dev
# Visit http://localhost:3000/digests → should show date list with infinite scroll
# Click a date → should navigate to digest detail
```

- [ ] **Step 3: Commit**

```bash
git add app/digests/page.tsx
git commit -m "feat: add history page with infinite scroll"
```

---

## Task 12: Cleanup & Final Config

**Files:**
- Modify: `CLAUDE.md`
- Modify: `.env.example` (if not already updated)
- Modify: `.gitignore`

- [ ] **Step 1: Audit and remove any remaining Supabase imports from the codebase**

Search for `@supabase` imports in `lib/` and `app/` directories. Remove any references. The `@supabase/supabase-js` package was already removed in Task 1.

- [ ] **Step 2: Update `CLAUDE.md` — remove Supabase references, add new env vars**

Update the Environment Variables section to reflect the current state:

```
Requires: `DATABASE_URL`, `GOOGLE_GENERATIVE_AI_API_KEY`, `CRON_SECRET`, `ADMIN_PASSWORD` (see `.env.example`)
```

Remove references to `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

Update Architecture section to remove Supabase Auth references.

- [ ] **Step 3: Add `.superpowers/` to `.gitignore`**

Append to `.gitignore`:

```
# Superpowers brainstorming artifacts
.superpowers/
```

- [ ] **Step 4: Run lint and format check**

```bash
bun run check
```

Fix any issues found.

- [ ] **Step 5: Verify full flow end-to-end**

```bash
bun dev
# 1. Visit / → empty state or latest digest
# 2. Visit /admin/login → enter password → redirected to /admin
# 3. Add a few RSS feeds (hnrss.org/frontpage, etc.)
# 4. Trigger cron: curl -X POST http://localhost:3000/api/cron/daily -H "Authorization: Bearer $CRON_SECRET"
# 5. Visit / → should show today's digest with scored articles
# 6. Visit /digests → should show date list
# 7. Click a date → should show full digest
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md .gitignore
git commit -m "chore: update project docs and gitignore"
```
