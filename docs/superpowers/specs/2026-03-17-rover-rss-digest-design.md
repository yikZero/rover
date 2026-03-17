# Rover — RSS Daily Digest Platform Design

## Overview

Rover is a personal RSS digest platform. Authenticated users manage RSS feeds, and every day at 09:00 Beijing time an AI generates a per-source summarized report. Users can optionally receive the digest via Telegram. Unauthenticated visitors see only a login page.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Auth**: Supabase Auth (Google OAuth)
- **Database**: Supabase PostgreSQL + Drizzle ORM
- **AI**: Vercel AI SDK + Google Gemini (`gemini-2.5-flash`)
- **Cron**: Vercel Cron Jobs
- **Telegram**: Bot API (webhook binding)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Data fetching**: SWR

---

## 1. Data Model

All tables live in Supabase PostgreSQL. IDs use `bigint generated always as identity` (except `profiles.id` which mirrors `auth.users.id`). Text columns use `text`. Timestamps use `timestamptz`. All tables have RLS enabled and forced.

### profiles

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | = auth.users.id |
| email | text | |
| telegram_chat_id | bigint | Set after Telegram binding |
| telegram_bind_token | text | One-time binding token |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | |

### feeds

| Column | Type | Notes |
|--------|------|-------|
| id | bigint generated always as identity PK | |
| user_id | uuid FK → profiles, indexed | |
| title | text | Auto-parsed from RSS |
| url | text | |
| site_url | text | |
| last_fetched_at | timestamptz | |
| is_active | boolean default true | |
| created_at | timestamptz default now() | |

### articles

| Column | Type | Notes |
|--------|------|-------|
| id | bigint generated always as identity PK | |
| feed_id | bigint FK → feeds, indexed | |
| guid | text not null | RSS item unique ID |
| title | text | |
| link | text | |
| summary | text | Original description/excerpt |
| published_at | timestamptz | |
| created_at | timestamptz default now() | |

Unique constraint: `(feed_id, guid)` for deduplication.

### daily_digests

| Column | Type | Notes |
|--------|------|-------|
| id | bigint generated always as identity PK | |
| user_id | uuid FK → profiles, indexed | |
| digest_date | date not null | |
| content | text | Markdown report |
| telegram_sent | boolean default false | |
| created_at | timestamptz default now() | |

Unique constraint: `(user_id, digest_date)` — one digest per user per day.

### Indexes

- `feeds.user_id` — B-tree (RLS policy, user feed queries)
- `articles.feed_id` — B-tree (join with feeds)
- `articles(feed_id, guid)` — unique index (dedup)
- `daily_digests.user_id` — B-tree (RLS policy, user digest queries)
- `daily_digests(user_id, digest_date)` — unique index

### RLS Policies

All tables enable RLS with `force row level security`. Policies use `(select auth.uid())` (wrapped in SELECT to avoid per-row evaluation):

- **profiles**: users can read/update only their own row (`id = (select auth.uid())`)
- **feeds**: users can CRUD only their own feeds (`user_id = (select auth.uid())`)
- **articles**: users can read articles belonging to their feeds (via join or security definer function)
- **daily_digests**: users can read only their own digests (`user_id = (select auth.uid())`)

Cron API routes bypass RLS by using the Drizzle client with the `DATABASE_URL` (service role), not the Supabase client.

---

## 2. Authentication & Routing

### Supabase Google OAuth Flow

1. User visits `/login`, clicks "Sign in with Google"
2. Supabase client calls `signInWithOAuth({ provider: 'google' })`
3. Google redirects back to `/auth/callback` (API route)
4. Callback exchanges `code` for session, sets cookie, redirects to `/`

### Route Protection — `proxy.ts`

Next.js 16 uses `proxy.ts` (replaces `middleware.ts`):

```typescript
export default async function proxy(req: NextRequest) {
  // Check Supabase session from cookie
  // Unauthenticated + protected route → redirect /login
  // Authenticated + /login → redirect /
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)']
}
```

### Page Structure

```
app/
  login/page.tsx              — Login page (Google OAuth button)
  auth/callback/route.ts      — OAuth callback handler
  (app)/                      — Protected route group
    layout.tsx                — Navigation layout
    page.tsx                  — Today's digest
    feeds/page.tsx            — RSS feed management
    history/page.tsx          — Historical digests list
    settings/page.tsx         — Telegram binding
  api/
    feeds/validate/route.ts   — Validate RSS URL
    cron/daily/route.ts       — Vercel Cron entry point
    telegram/webhook/route.ts — Telegram Bot webhook
proxy.ts                      — Route protection
```

---

## 3. Core Business Flows

### RSS Feed Management

1. User enters RSS URL on `/feeds`, clicks add
2. `POST /api/feeds/validate` — fetches URL, parses XML (RSS 2.0 / Atom), returns feed title and item count
3. Validation passes → insert into `feeds`, fetch initial articles into `articles`
4. Validation fails → frontend shows error (invalid URL or unreachable)

### Daily Cron Job (Beijing 09:00 = UTC 01:00)

```json
// vercel.json
{ "crons": [{ "path": "/api/cron/daily", "schedule": "0 1 * * *" }] }
```

`GET /api/cron/daily` flow:

1. Verify request from Vercel Cron (`CRON_SECRET` header)
2. Query all users with active feeds
3. For each user:
   a. Fetch all active feeds' new articles (`published_at > yesterday 00:00 Beijing time`)
   b. Deduplicate by `(feed_id, guid)`, insert into `articles`
   c. Group articles by feed, call Gemini AI to generate Markdown digest
   d. Store digest in `daily_digests`
   e. If user has `telegram_chat_id` → send via Bot API `sendMessage`
4. Process users in batches to avoid Vercel timeout (60s Hobby / 300s Pro)

### Telegram Binding

1. User clicks "Bind Telegram" on `/settings`
2. Generate unique token → store in `profiles.telegram_bind_token`
3. UI shows: "Send `/start <token>` to @RoverBot"
4. Telegram webhook receives `/start <token>` → match token in `profiles` → write `telegram_chat_id`, clear token
5. Frontend polls or refreshes to show binding success

---

## 4. AI Summary Strategy

### Prompt Structure

One Gemini call per user per day:

```
你是一个 RSS 新闻摘要助手。请根据以下 RSS 文章生成一份中文每日摘要报告。

要求：
- 按 RSS 源分 section，每个 section 标注源名称
- 每个 section 列出关键文章标题和一句话摘要
- 最后生成一段整体总结，概括今天的主要趋势和亮点
- 使用 Markdown 格式
- 如果某个源昨天没有新文章，跳过该 section

---
## 源: {feed.title}
{articles: title + summary + link}

## 源: {feed.title}
...
```

### Output Format (stored in `daily_digests.content`)

```markdown
# 每日 RSS 摘要 — 2026-03-16

## TechCrunch
- **Article Title** — 一句话摘要 [链接](url)
- ...

## Hacker News
- ...

---

## 今日总结
整体趋势概括...
```

### Edge Cases

- All feeds have no new articles yesterday → skip digest generation, no push
- Single feed has too many articles → cap at 20 most recent to stay within token limits
- AI call fails → log error, skip user, do not affect others

---

## 5. Frontend Pages

### Login `/login`
- Centered card: "Rover" title + "Sign in with Google" button

### Today's Digest `/` (home)
- Date header
- If digest exists → render Markdown content
- If not → "No digest today" with prompt to add feeds

### Feed Management `/feeds`
- Top: URL input + "Add" button (validates on submit)
- List: feed name, URL, active/inactive toggle, last fetched time, delete button

### History `/history`
- Date-descending list, each row shows date + preview
- Click to view full digest
- Cursor-based pagination for loading more

### Settings `/settings`
- Telegram binding: unbound → show binding instructions + token; bound → show chat ID + unbind button

### Navigation
- Simple sidebar or top nav: Home, Feeds, History, Settings, Sign out

---

## 6. Environment Variables

```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
GOOGLE_GENERATIVE_AI_API_KEY=your-key
CRON_SECRET=your-cron-secret
TELEGRAM_BOT_TOKEN=your-bot-token
```

---

## 7. Key Dependencies

Existing:
- `next`, `react`, `react-dom`
- `drizzle-orm`, `postgres`, `drizzle-kit`
- `@supabase/supabase-js`
- `ai`, `@ai-sdk/google`
- `swr`
- `tailwindcss`, `shadcn`, `lucide-react`

To add:
- `@supabase/ssr` — server-side Supabase auth helpers for Next.js
- RSS parser library (e.g., `rss-parser` or manual XML parsing)
- `react-markdown` + `remark-gfm` — render digest Markdown in the browser
