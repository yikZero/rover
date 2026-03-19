# Bilingual AI Content & Final Score Design

Date: 2026-03-19

## Goal

Add AI-generated bilingual (Chinese + English) titles and summaries to digest articles, and persist the adjusted score as `final_score`. All existing data will be cleared and rebuilt.

## Current State

- `articles.title`: raw title from RSS/Twitter (retained, not displayed)
- `scores`: 7-dimension scoring (scale/impact/novelty/potential/legacy/positivity/credibility) + weighted `total`
- `digest_articles`: `rank`, `summary` (Chinese only, 150-200 chars)
- Digest generation computes `adjusted = total × quality_factor` in memory but does not persist it

## Design

### Database: `digest_articles` table changes

**Remove:**
- `summary` (text) — replaced by `summary_zh`

**Add:**

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `title_zh` | text | NOT NULL | AI-generated Chinese title (max ~30 chars) |
| `title_en` | text | NOT NULL | AI-generated English title (max ~80 chars) |
| `summary_zh` | text | NOT NULL | AI-generated Chinese summary (150-200 chars) |
| `summary_en` | text | NOT NULL | AI-generated English summary (80-120 words) |
| `final_score` | numeric(4,1) | NOT NULL | `scores.total × feed_quality_factor` (practical range 0.0-12.0) |

**Migration strategy:** Truncate `telegram_logs`, `digest_articles`, and `daily_digests` (in FK order), then apply Drizzle migration to alter `digest_articles` columns. Use `bun run db:generate` + `bun run db:migrate` for the schema change. Pipeline-side SQLAlchemy model is updated to match.

### Pipeline changes (rover-pipeline)

#### 1. SQLAlchemy model (`src/db/models.py`)

Update `DigestArticle` model:
- Remove `summary` column
- Add `title_zh`, `title_en`, `summary_zh`, `summary_en` (all `Text`, nullable=False)
- Add `final_score` (`Numeric(4, 1)`, nullable=False)

#### 2. Digest generator (`src/digest/generator.py`)

**Refactor `generate_summary` → `generate_bilingual_content`:**

New function signature:
```python
def generate_bilingual_content(title: str, content: str, model: str) -> dict:
    """Returns {"title_zh", "title_en", "summary_zh", "summary_en"}"""
```

- Uses `generate_with_retry(..., json_output=True)` for structured JSON output
- JSON schema validation: verify all 4 keys present and non-empty strings
- **Fallback on failure:** use original `articles.title` for both `title_zh` and `title_en`, use truncated content (first 200 chars) for both `summary_zh` and `summary_en`

**AI prompt outline:**
- Input: article title + first 2000 chars of content (same as current)
- Output: JSON with 4 fields
- Title rules: concise, informative, no clickbait; Chinese title max ~30 chars, English title max ~80 chars
- Chinese summary rules: 150-200 chars, spaces between CJK/Latin, Chinese punctuation, half-width parens
- English summary rules: 80-120 words, concise news-style
- **CJK-Latin spacing post-processing:** apply a programmatic function to insert spaces between CJK and Latin/number characters on `title_zh` and `summary_zh`, not relying solely on the prompt

**Carry `adjusted` score through diversity enforcement:**

Current code drops `adjusted` in the diversity loop (`top_articles.append((article, score, feed))` — `adjusted` not kept). Fix: include `adjusted` in the tuple so it's available when inserting `DigestArticle` rows. Persist as `final_score`.

#### 3. Telegram message (`src/digest/telegram.py`)

- Update `articles_data` dict keys: use `title_zh` instead of `title`, `summary_zh` instead of `summary`
- Update `format_digest_message` to reference new keys
- Fallback logic (`summary or title`) no longer needed since both are NOT NULL, but keep defensive code

### Frontend changes (rover)

#### 1. Drizzle schema (`lib/schema.ts`)

Update `digestArticles` table:
- Remove `summary`
- Add `titleZh`, `titleEn`, `summaryZh`, `summaryEn` (text, notNull)
- Add `finalScore` (numeric(4,1), notNull)

#### 2. Queries (`lib/queries.ts`)

- Select new fields (`titleZh`, `titleEn`, `summaryZh`, `summaryEn`, `finalScore`) from `digestArticles`
- **Remove `scores` table join** — no longer needed since `finalScore` lives on `digest_articles`
- Remove unused `scores` import

#### 3. API routes

Update response shape (breaking change — no external consumers, frontend-only API):
- Remove `title` (from articles) and `total` (from scores)
- Add `titleZh`, `titleEn`, `summaryZh`, `summaryEn`, `finalScore`

#### 4. Components

- `DigestArticle` interface: update fields — `titleZh`, `titleEn`, `summaryZh`, `summaryEn`, `finalScore` (TypeScript type: `string` — Drizzle returns `numeric` as string)
- `digest-card.tsx`: display `titleZh` and `summaryZh` (UI locale is `zh-CN`)
- `score-badge.tsx`: rename `total` prop to `finalScore`, update all call sites

### Unchanged

- `articles.title` — preserved as raw data, not displayed to users
- `scores` table — 7-dimension scoring retained
- `feeds` table — no changes
- Collection, filtering, dedup, scoring pipeline phases — no changes
- Cache invalidation mechanism — no changes

## Constraints

- Chinese title: max ~30 characters
- English title: max ~80 characters
- Chinese summary: 150-200 characters, spaces between CJK and Latin characters, Chinese punctuation
- English summary: 80-120 words, concise
- `final_score` uses `numeric(4,1)` to accommodate values > 10 (e.g., 9.5 × 1.2 = 11.4)
- One AI call per article for all 4 fields (token efficiency)
- CJK-Latin spacing enforced programmatically as post-processing, not just via prompt
- `finalScore` is `string` in TypeScript (Drizzle numeric behavior)
