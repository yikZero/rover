# Rover — AI-Curated Daily Tech Digest

**Date:** 2026-03-17
**Status:** Approved

## Overview

Rover is a public-facing daily tech digest platform. An automated pipeline fetches articles from curated RSS feeds, scores them with AI across multiple dimensions, and publishes a daily top 5-10 selection with Chinese summaries. All visitors can browse current and historical digests without login. Only the site owner can manage RSS feeds via a password-protected admin panel.

## Architecture

Next.js 16 App Router (React 19), all-in-one deployment. Cron job runs as an API route triggered by Vercel Cron or an external scheduler.

**Stack:**
- Next.js 16 + React 19 (App Router, SSR)
- Drizzle ORM + PostgreSQL (direct connection via `DATABASE_URL`)
- Vercel AI SDK v6 + Google Gemini (`gemini-2.5-flash`)
- Tailwind CSS v4 (OKLch color system, light/dark themes)
- shadcn/ui (admin panel components)
- SWR (`useSWRInfinite` for infinite scroll)
- `rss-parser` for RSS feed parsing
- `zod` for AI structured output schema validation

## Data Model

All tables use `bigint generated always as identity` primary keys per Postgres best practices. Timestamps are `timestamptz`. Foreign keys are explicitly indexed.

### feeds

| Column | Type | Notes |
|--------|------|-------|
| id | bigint identity PK | |
| title | text NOT NULL | Feed name, e.g. "Hacker News" |
| url | text UNIQUE NOT NULL | RSS feed URL |
| site_url | text | Feed homepage |
| is_active | boolean DEFAULT true | Enable/disable toggle |
| created_at | timestamptz DEFAULT now() | |

- Partial index: `ON (id) WHERE is_active = true`
- Not publicly accessible (admin only)

### articles

| Column | Type | Notes |
|--------|------|-------|
| id | bigint identity PK | |
| feed_id | bigint FK → feeds NOT NULL | |
| title | text NOT NULL | Original title |
| url | text UNIQUE NOT NULL | Original link (dedup key) |
| content | text | Article content/description |
| published_at | timestamptz | Publish time from feed |
| created_at | timestamptz DEFAULT now() | |

- Index: `ON (feed_id)` — FK index
- Index: `ON (published_at DESC)` — time-based queries

### scores

| Column | Type | Notes |
|--------|------|-------|
| id | bigint identity PK | |
| article_id | bigint FK → articles, UNIQUE | One score per article |
| info_density | smallint CHECK (0-100) | Information density |
| popularity | smallint CHECK (0-100) | Community buzz / influence |
| practicality | smallint CHECK (0-100) | Real-world applicability |
| total | smallint CHECK (0-100) | Weighted composite score |
| created_at | timestamptz DEFAULT now() | |

- Index: `ON (article_id)` — FK index
- Index: `ON (total DESC)` — sort by score
- Weighted formula (computed server-side): `total = info_density * 0.4 + popularity * 0.3 + practicality * 0.3`

### daily_digests

| Column | Type | Notes |
|--------|------|-------|
| id | bigint identity PK | |
| date | date UNIQUE NOT NULL | Which day's digest |
| created_at | timestamptz DEFAULT now() | |

- Index: `ON (date DESC)` — cursor pagination

### digest_articles

| Column | Type | Notes |
|--------|------|-------|
| digest_id | bigint FK → daily_digests | |
| article_id | bigint FK → articles | |
| rank | smallint NOT NULL | Display order |
| summary | text NOT NULL | AI-generated Chinese summary |
| PK | (digest_id, article_id) | Composite primary key |

- Index: `ON (digest_id)` — FK index
- Index: `ON (article_id)` — FK index

## Routes

### Public Pages (no auth)

| Route | Description |
|-------|-------------|
| `/` | Today's digest — top 5-10 articles with summaries and scores |
| `/digests` | Historical digests — infinite scroll, reverse chronological |
| `/digests/[date]` | Specific day's digest, e.g. `/digests/2026-03-15` |

### Admin Pages (password auth)

| Route | Description |
|-------|-------------|
| `/admin/login` | Password login page |
| `/admin` | Dashboard — RSS feed list with enable/disable/delete |
| `/admin/feeds/new` | Add new feed — URL input, auto-parse title |

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/digests` | GET | Paginated digest list (cursor=date) |
| `/api/digests/[date]` | GET | Single day's digest with articles |
| `/api/cron/daily` | POST | Cron trigger: fetch → score → summarize |
| `/api/feeds/validate` | POST | Validate RSS URL (admin only) |

## Admin Authentication

Simple password protection, suitable for single-owner usage.

- Environment variable `ADMIN_PASSWORD` stores the password
- `/admin/login` page: input password → POST to login API
- On success: set httpOnly signed cookie with session token
- `proxy.ts` intercepts `/admin/*` routes, checks cookie, redirects to `/admin/login` if invalid
- Can be upgraded to OAuth later without structural changes

### proxy.ts

```typescript
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname

  if (path.startsWith('/admin') && path !== '/admin/login') {
    // Check httpOnly session cookie
    // Invalid or missing → redirect to /admin/login
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*']
}
```

## Cron Pipeline

Triggered daily at UTC 01:00 (Beijing 09:00) via `POST /api/cron/daily` with `Authorization: Bearer ${CRON_SECRET}`.

### Step 1 — Fetch Articles

- Query all feeds where `is_active = true`
- Parse each feed with `rss-parser`, extract articles published in the last 24h
- Insert into `articles` with `ON CONFLICT (url) DO NOTHING` for dedup
- Single feed failure does not block others — log error and continue

### Step 2 — AI Scoring

- Query today's new articles that have no corresponding `scores` row
- Batch send to Gemini (up to 20 articles per request) via `generateObject`
- Compute `total` server-side: `info_density * 0.4 + popularity * 0.3 + practicality * 0.3`
- Insert into `scores`
- On AI failure: retry once, then skip the article

### Step 3 — Generate Digest

- Check if `daily_digests` already has today's date (idempotency)
- Select top 10 articles by `total` score from today's scored articles
- For each, call Gemini to generate a 150-200 character Chinese summary via `generateObject`
- Create `daily_digests` row + `digest_articles` rows with rank and summary

### Estimated Execution Time

- 20 feeds x ~5 new articles = ~100 articles
- Scoring 100 articles (batched): ~10-20s
- Summarizing 10 articles: ~10-15s
- Total: ~30-60s (within Vercel Pro 300s limit)

## AI Prompt Strategy

All prompts in English, outputs in Chinese where user-facing.

### Scoring Prompt (batch, generateObject)

```typescript
const { object } = await generateObject({
  model: google('gemini-2.5-flash'),
  schema: z.object({
    scores: z.array(z.object({
      article_id: z.number(),
      info_density: z.number().min(0).max(100),
      popularity: z.number().min(0).max(100),
      practicality: z.number().min(0).max(100),
    }))
  }),
  prompt: `You are a tech article quality reviewer.
Rate each article on three dimensions (0-100):
1. info_density: substantial technical insights or new knowledge, not fluff
2. popularity: hot topic in the community or influential in the industry
3. practicality: directly applicable to real-world work

Articles:
${articlesJson}`
})
```

### Summary Prompt (per article, generateObject)

```typescript
const { object } = await generateObject({
  model: google('gemini-2.5-flash'),
  schema: z.object({
    summary: z.string(),
  }),
  prompt: `You are a tech content editor.
Write a Chinese summary for the following article:
- 150-200 characters
- Highlight core insights and key information
- Professional and concise, targeting developers
- Output MUST be in Simplified Chinese

Title: ${article.title}
Content: ${article.content}`
})
```

## Frontend Design

### Home Page `/` (Today's Digest)

- Header: brand name "ROVER" + current date
- Single-column card list, one card per article
- Card content: rank + source name + title + Chinese summary + total score badge
- Hover on card: total score badge expands to show three dimension scores (info density / popularity / practicality)
- Click card to open original article
- Single primary color scheme (follows project OKLch theme), depth through shade variations

### History Page `/digests` (Infinite Scroll)

- Grouped by date, each group is one day's digest
- Cursor-based pagination (cursor=date), auto-load on scroll to bottom
- Same card structure as home page

### Admin Panel `/admin`

- Feed list table: name, URL, status toggle, delete button
- Add feed: URL input → validate API → auto-parse title → confirm add
- Functional and clean, shadcn/ui components

### Responsive Design

- Mobile-first, single column layout scales naturally
- Cards stack vertically on all viewports
- Admin panel usable on mobile but optimized for desktop

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key |
| `CRON_SECRET` | Cron API authentication |
| `ADMIN_PASSWORD` | Admin panel login password |

## Dependencies

### Existing (keep)

- `next`, `react`, `react-dom`
- `drizzle-orm`, `postgres`, `drizzle-kit`
- `ai`, `@ai-sdk/google`
- `swr`
- `tailwindcss`, `shadcn`, `lucide-react`

### To Add

| Package | Purpose |
|---------|---------|
| `zod` | Schema validation for generateObject |
| `rss-parser` | RSS feed parsing |

### To Remove

| Package | Reason |
|---------|--------|
| `@supabase/supabase-js` | No longer needed without Supabase Auth |
