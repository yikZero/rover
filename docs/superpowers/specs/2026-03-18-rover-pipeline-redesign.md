# Rover Platform Redesign: Pipeline Separation + Multi-Source Scoring

**Date:** 2026-03-18
**Status:** Approved

## Overview

Redesign Rover from a single Next.js monolith into a two-repo architecture: a Next.js frontend for displaying daily digests, and an independent Python pipeline service for data collection, scoring, and distribution.

**Goals:**
- Support 50+ sources (RSS blogs, Twitter accounts, news aggregators)
- Seven-dimension significance scoring inspired by newsminimalist.com
- Daily digest generation with Telegram push notifications
- Public website for browsing daily and historical reports

**Non-goals (MVP):**
- Real-time or weekly reports (database design allows future extension)
- Multi-user / personalized feeds
- Event clustering (MVP does simple dedup only)

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Linux Server (self-hosted)                     │
│                                                 │
│  docker-compose                                 │
│  ┌─────────────────┐  ┌──────────────────┐      │
│  │ rover-pipeline   │  │ litellm-proxy    │      │
│  │ (Python)         │─▶│ :4000            │─▶ Gemini API
│  │ cron: daily 8:00 │  └──────────────────┘      │
│  └─────────────────┘                            │
│                                                 │
└────────────────┬────────────────────────────────┘
                 │ writes
                 ▼
          ┌──────────────┐
          │  Supabase     │
          │  PostgreSQL   │
          └──────┬───────┘
                 │ reads
                 ▼
          ┌──────────────┐
          │  Vercel       │
          │  rover (Next) │──▶ Public website
          └──────────────┘
```

### Repository Split

| Repo | Stack | Deployment | Responsibility |
|------|-------|------------|----------------|
| `rover` (existing) | Next.js 16, React 19, Drizzle ORM | Vercel | Website display, DB schema management (migrations) |
| `rover-pipeline` (new) | Python 3.12+, SQLAlchemy, LiteLLM | Docker on Linux server | Data collection, filtering, scoring, digest generation, Telegram push |

The two services share only the PostgreSQL database. Schema migrations are managed by Drizzle in the rover repo; the Python pipeline uses SQLAlchemy models that mirror the same tables.

## Data Pipeline Flow

```
Cron trigger (daily 08:00 CST)
        │
        ▼
┌─────────────────────────────┐
│  Step 1: Data Collection     │
│  (parallel)                  │
│                             │
│  RSS feeds ──▶ feedparser   │
│  Twitter   ──▶ FxTwitter API│
│               + x-tweet-fetcher
│                             │
│  Batch insert into articles │
└─────────┬───────────────────┘
          ▼
┌─────────────────────────────┐
│  Step 2: Pre-filter (rules)  │
│                             │
│  - Keyword exclusion (ads,  │
│    spam, job posts)         │
│  - Keyword boost (optional) │
│  - Min content length       │
│  - Language filter (zh/en)  │
│  - Mark: passed / filtered  │
└─────────┬───────────────────┘
          ▼
┌─────────────────────────────┐
│  Step 3: Dedup               │
│                             │
│  - URL dedup                │
│  - Title similarity         │
│  - Mark duplicates          │
│  - (Future: event clustering│
│    with embeddings)         │
└─────────┬───────────────────┘
          ▼
┌─────────────────────────────┐
│  Step 4: AI Scoring          │
│  (via LiteLLM)              │
│                             │
│  - Only score passed articles│
│  - Batch processing         │
│  - 7 dimensions → total     │
└─────────┬───────────────────┘
          ▼
┌─────────────────────────────┐
│  Step 5: Digest Generation   │
│                             │
│  - Threshold (≥5.0) + top 10│
│  - AI-generated Chinese     │
│    summaries                │
│  - Write to daily_digests   │
└─────────┬───────────────────┘
          ▼
┌─────────────────────────────┐
│  Step 6: Telegram Push       │
│                             │
│  - Concise list: title +    │
│    score + link             │
│  - Website digest page link │
└─────────────────────────────┘
```

Each step persists intermediate state to the database. If a step fails, previously completed steps are not lost.

## Scoring System

Inspired by [newsminimalist.com](https://www.newsminimalist.com/about), adapted for tech news.

**Scale:** 0.0 - 10.0 (one decimal place)

**Seven Dimensions:**

| Dimension | Description (tech context) | Weight |
|-----------|---------------------------|--------|
| Scale | How broadly does this affect the tech industry/developers? | ~1/7 |
| Impact | How strong is the immediate effect on workflows, tools, decisions? | ~1/7 |
| Novelty | Is this genuinely new, or incremental/rehashed? | ~1/7 |
| Potential | Will this still matter in a year? | ~1/7 |
| Legacy | Could this become a historical turning point? (e.g., ChatGPT launch) | ~1/7 |
| Positivity | Low weight (~1/20) to counterbalance negativity bias in reporting | ~1/20 |
| Credibility | First-party source (official blog/paper) vs rumor/speculation? | remaining |

**Total score:** Weighted average of all dimensions, normalized to 0-10.

**Two-phase scoring (future optimization):**
- Phase 1: Strong model scores historical articles as training data
- Phase 2: Cheaper model replicates scoring at scale

MVP uses a single model (Gemini Flash via LiteLLM).

**Digest selection:**
- Minimum threshold: 5.0 (configurable)
- Above threshold, take top 10
- Multi-source coverage of the same event naturally scores higher on Scale and Credibility

## Data Sources

### Twitter (~20 accounts)

Fetched via FxTwitter API (individual tweets) + x-tweet-fetcher (user timelines via Camofox headless browser).

Example accounts: @trq212, @HiTw93, @op7418, @claudeai, @OpenAI, @sama, @alexalbert__, etc.

### RSS Blogs (~15 feeds)

Direct RSS/Atom parsing via feedparser.

Example feeds: simonwillison.net, daringfireball.net, krebsonsecurity.com, troyhunt.com, etc.

### News Aggregators

Hacker News, tophub.today, and others via RSS where available.

All sources configured in `config/feeds.yaml`, not hardcoded.

## Database Schema

Uses Supabase PostgreSQL. Migrations managed by Drizzle (rover repo). Python pipeline connects via Supabase connection pooler (transaction mode).

### Best practices applied:
- `bigint generated always as identity` for all PKs
- `text` instead of `varchar(n)`
- `timestamptz` for all timestamps
- All foreign key columns indexed
- Partial indexes for filtered queries
- Batch inserts for article ingestion
- Cursor-based pagination for digest listing

### Tables

#### `feeds`
```sql
id          bigint identity PK
title       text NOT NULL
url         text NOT NULL UNIQUE
site_url    text
type        text NOT NULL CHECK (type IN ('rss', 'twitter'))
tags        text[]
is_active   boolean DEFAULT true
last_fetched_at  timestamptz
error_count smallint DEFAULT 0
created_at  timestamptz DEFAULT now()
```

#### `articles`
```sql
id              bigint identity PK
feed_id         bigint NOT NULL REFERENCES feeds(id) ON DELETE CASCADE
title           text NOT NULL
url             text NOT NULL UNIQUE
content         text
language        text
filter_status   text NOT NULL DEFAULT 'pending'
                CHECK (filter_status IN ('pending', 'passed', 'filtered', 'duplicate'))
cluster_id      text
published_at    timestamptz
created_at      timestamptz DEFAULT now()

-- Indexes
INDEX articles_feed_id_idx ON (feed_id)
INDEX articles_published_at_idx ON (published_at)
INDEX articles_pending_score_idx ON (created_at) WHERE filter_status = 'passed'
```

#### `scores`
```sql
id          bigint identity PK
article_id  bigint NOT NULL UNIQUE REFERENCES articles(id) ON DELETE CASCADE
scale       numeric(3,1) NOT NULL
impact      numeric(3,1) NOT NULL
novelty     numeric(3,1) NOT NULL
potential   numeric(3,1) NOT NULL
legacy      numeric(3,1) NOT NULL
positivity  numeric(3,1) NOT NULL
credibility numeric(3,1) NOT NULL
total       numeric(3,1) NOT NULL
created_at  timestamptz DEFAULT now()

-- Indexes
INDEX scores_article_id_idx ON (article_id)
INDEX scores_total_idx ON (total)
```

#### `daily_digests`
```sql
id          bigint identity PK
date        date NOT NULL UNIQUE
created_at  timestamptz DEFAULT now()

INDEX daily_digests_date_idx ON (date)
```

#### `digest_articles`
```sql
digest_id   bigint NOT NULL REFERENCES daily_digests(id) ON DELETE CASCADE
article_id  bigint NOT NULL REFERENCES articles(id) ON DELETE CASCADE
rank        smallint NOT NULL
summary     text NOT NULL
PRIMARY KEY (digest_id, article_id)

INDEX digest_articles_digest_id_idx ON (digest_id)
INDEX digest_articles_article_id_idx ON (article_id)
```

#### `telegram_logs`
```sql
id          bigint identity PK
digest_id   bigint NOT NULL REFERENCES daily_digests(id)
message_id  text
status      text NOT NULL CHECK (status IN ('sent', 'failed'))
sent_at     timestamptz DEFAULT now()

INDEX telegram_logs_digest_id_idx ON (digest_id)
```

## rover-pipeline Project Structure

```
rover-pipeline/
├── pyproject.toml
├── Dockerfile
├── docker-compose.yml       # pipeline + litellm
├── .env.example
├── config/
│   ├── feeds.yaml           # RSS/Twitter source definitions
│   ├── filters.yaml         # Pre-filter rules (keyword lists, min length)
│   └── scoring.yaml         # Dimension weights, thresholds
├── src/
│   ├── __init__.py
│   ├── main.py              # Orchestrator, runs all steps in sequence
│   ├── fetchers/
│   │   ├── __init__.py
│   │   ├── rss.py           # RSS fetching via feedparser
│   │   └── twitter.py       # Twitter via FxTwitter API + x-tweet-fetcher
│   ├── processors/
│   │   ├── __init__.py
│   │   ├── filter.py        # Keyword/length/language filtering
│   │   └── dedup.py         # URL + title similarity dedup
│   ├── scoring/
│   │   ├── __init__.py
│   │   └── scorer.py        # AI scoring via LiteLLM
│   ├── digest/
│   │   ├── __init__.py
│   │   ├── generator.py     # Digest creation + AI summaries
│   │   └── telegram.py      # Telegram Bot API push
│   └── db/
│       ├── __init__.py
│       └── models.py        # SQLAlchemy models mirroring Drizzle schema
└── tests/
```

Source management via `config/feeds.yaml`:
```yaml
rss:
  - url: https://simonwillison.net/atom/everything/
    tags: [ai, python]
  - url: https://daringfireball.net/feeds/main
    tags: [apple, tech]

twitter:
  - handle: trq212
    tags: [ai, dev]
  - handle: OpenAI
    tags: [ai]
```

## rover (Frontend) Changes

**Remove:**
- `app/api/cron/daily/route.ts` — pipeline handles this now
- Any remaining feed management API routes
- `lib/ai.ts`, `lib/rss.ts` — no longer needed in frontend

**Modify:**
- `lib/schema.ts` — rewrite to match new schema (new migration, drop old tables)
- Score display — show single total score (0-10) instead of three dimensions
- Digest detail page — adapt to new score fields
- Score badge component — update for 0-10 scale

**Keep as-is:**
- Page structure: home (latest digest) + `/digests` (history list) + `/digests/[date]` (detail)
- Styling, component library, layout
- SWR data fetching pattern
- Cursor-based pagination

Frontend is read-only. All data writing happens in the pipeline.

## Telegram Push Format

Sent once daily after digest generation:

```
📰 Rover Daily Digest — 2026-03-18

1. [8.2] OpenAI announces GPT-5 with real-time reasoning
   → https://openai.com/blog/gpt-5

2. [7.5] React 20 introduces server-native components
   → https://react.dev/blog/react-20

3. [6.8] GitHub Copilot now supports full repo context
   → https://github.blog/copilot-repo-context

... (up to 10 items)

🔗 Full report: https://rover.yikzero.com/digests/2026-03-18
```

## Environment Variables

### rover-pipeline
```
DATABASE_URL=postgresql://...        # Supabase connection pooler URL
LITELLM_API_BASE=http://litellm:4000 # LiteLLM proxy URL (docker network)
LITELLM_API_KEY=sk-...               # LiteLLM proxy key
TELEGRAM_BOT_TOKEN=...               # Telegram Bot API token
TELEGRAM_CHAT_ID=...                 # Target chat/channel ID
SITE_URL=https://rover.yikzero.com   # For digest page links
```

### rover (existing, updated)
```
DATABASE_URL=postgresql://...        # Supabase connection URL
```

### LiteLLM
```
GEMINI_API_KEY=...                   # Google Gemini API key
```

## Key Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Repo structure | Separate repos | Different stacks (TS/Python), different deploy targets, no shared code |
| Pipeline language | Python | Best ecosystem for Twitter scraping, NLP/dedup, native LiteLLM integration |
| Frontend hosting | Vercel | Zero-ops, CDN, good for read-heavy public site |
| Pipeline hosting | Docker on Linux server | No timeout limits, can run headless browser, full control |
| Twitter fetching | FxTwitter API + x-tweet-fetcher | No API key needed, free, timeline support via Camofox |
| AI gateway | LiteLLM (self-hosted) | Open source, model-agnostic, easy to switch providers later |
| Scoring model | newsminimalist-inspired 7 dimensions | Proven methodology, objective significance over personal relevance |
| Source management | YAML config files | Low frequency changes, git-trackable, no admin UI needed |
| Dedup strategy | Simple (URL + title similarity) for MVP | Event clustering with embeddings planned for future iteration |
| Report types | Daily only for MVP | DB schema supports weekly/realtime extension later |
