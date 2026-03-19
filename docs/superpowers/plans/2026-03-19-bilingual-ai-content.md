# Bilingual AI Content & Final Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-generated bilingual (zh/en) titles and summaries to digest articles, persist adjusted score as `final_score`, and update frontend to display new fields.

**Architecture:** Two-repo change: rover-pipeline (Python/SQLAlchemy) generates bilingual content and persists final_score; rover (Next.js/Drizzle) updates schema, queries, and components. Database data is cleared and rebuilt.

**Tech Stack:** Python 3.12, SQLAlchemy, Google GenAI (Gemini), Next.js 16, Drizzle ORM, PostgreSQL

**Spec:** `docs/superpowers/specs/2026-03-19-bilingual-ai-content-design.md`

---

## File Map

### rover-pipeline (backend)

| File | Action | Responsibility |
|------|--------|---------------|
| `src/db/models.py` | Modify:137-153 | Update `DigestArticle` model columns |
| `src/digest/generator.py` | Modify:13-26,97-111,160-193 | New prompt, `generate_bilingual_content`, carry adjusted score |
| `src/digest/telegram.py` | Modify:30-33,100-108 | Use new field names in message formatting |

### rover (frontend)

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/schema.ts` | Modify:146-162 | Update `digestArticles` Drizzle schema |
| `lib/queries.ts` | Modify:1-31 | Update select fields, remove `scores` join from article query (keep `scores` import for stats queries) |
| `components/digest-card.tsx` | Modify:5-12,52-65 | Update interface and display |
| `components/score-badge.tsx` | Modify:3-6,8,20 | Rename `total` prop to `finalScore` |

---

## Task 1: Update SQLAlchemy model (rover-pipeline)

**Files:**
- Modify: `/Users/yikzero/Code/rover-pipeline/src/db/models.py:137-153`

- [ ] **Step 1: Update DigestArticle model**

Replace the `summary` column with the 5 new columns in `DigestArticle`:

```python
class DigestArticle(Base):
    __tablename__ = "digest_articles"

    digest_id = Column(
        BigInteger, ForeignKey("daily_digests.id", ondelete="CASCADE"), primary_key=True
    )
    article_id = Column(
        BigInteger, ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True
    )
    rank = Column(SmallInteger, nullable=False)
    title_zh = Column(Text, nullable=False)
    title_en = Column(Text, nullable=False)
    summary_zh = Column(Text, nullable=False)
    summary_en = Column(Text, nullable=False)
    final_score = Column(Numeric(4, 1), nullable=False)

    __table_args__ = (
        Index("digest_articles_article_id_idx", "article_id"),
    )

    digest = relationship("DailyDigest", back_populates="digest_articles")
```

- [ ] **Step 2: Verify model imports**

Confirm `Numeric` is already imported (line 12) — it is. No import changes needed.

- [ ] **Step 3: Commit**

```bash
cd /Users/yikzero/Code/rover-pipeline
git add src/db/models.py
git commit -m "feat: update DigestArticle model with bilingual fields and final_score"
```

---

## Task 2: Refactor digest generator (rover-pipeline)

**Files:**
- Modify: `/Users/yikzero/Code/rover-pipeline/src/digest/generator.py:13-26,97-111,160-193`

- [ ] **Step 1: Add `import re` and `import json` to top-level imports**

Add after `import logging` (line 3):

```python
import json
import re
```

- [ ] **Step 2: Replace SUMMARY_PROMPT with BILINGUAL_CONTENT_PROMPT**

Replace lines 13-26 with:

```python
BILINGUAL_CONTENT_PROMPT = """You are a tech news editor. Given an article's title and content, generate a JSON object with 4 fields.

Rules:
- title_zh: Concise Chinese title, max 30 characters. Keep technical terms in English.
- title_en: Concise English title, max 80 characters.
- summary_zh: Chinese summary, 150-200 characters. Use Chinese punctuation (，。、；：「」). Use half-width parentheses for English abbreviations without extra spaces, e.g. 国防部(DOD). Use Chinese quotation marks「」for quoted terms. Keep technical terms in English. Focus on what happened and why it matters.
- summary_en: English summary, 80-120 words. Concise news-style. Focus on what happened and why it matters.

Output ONLY a JSON object with keys: title_zh, title_en, summary_zh, summary_en.

Title: {title}
Content: {content}
"""
```

- [ ] **Step 3: Add CJK-Latin spacing helper**

Add after the prompt constant:

```python
_CJK_RANGES = (
    r'\u2e80-\u9fff\uf900-\ufaff'  # CJK Unified + Compatibility
)

def _add_cjk_spacing(text: str) -> str:
    """Insert space between CJK and Latin/number characters."""
    text = re.sub(rf'([{_CJK_RANGES}])([A-Za-z0-9])', r'\1 \2', text)
    text = re.sub(rf'([A-Za-z0-9])([{_CJK_RANGES}])', r'\1 \2', text)
    return text
```

- [ ] **Step 4: Replace `generate_summary` with `generate_bilingual_content`**

Replace the `generate_summary` function (lines 97-111) with:

```python
def generate_bilingual_content(title: str, content: str, model: str) -> dict:
    """Generate bilingual titles and summaries. Returns dict with 4 keys."""
    from src.llm import generate_with_retry

    try:
        raw = generate_with_retry(
            model=model,
            contents=BILINGUAL_CONTENT_PROMPT.format(
                title=title, content=(content or "")[:2000]
            ),
            json_output=True,
        )
        data = json.loads(raw)
        # Validate all 4 keys present and non-empty
        required = ("title_zh", "title_en", "summary_zh", "summary_en")
        for key in required:
            if not isinstance(data.get(key), str) or not data[key].strip():
                raise ValueError(f"Missing or empty key: {key}")
        # Post-process CJK spacing on Chinese fields
        data["title_zh"] = _add_cjk_spacing(data["title_zh"].strip())
        data["summary_zh"] = _add_cjk_spacing(data["summary_zh"].strip())
        data["title_en"] = data["title_en"].strip()
        data["summary_en"] = data["summary_en"].strip()
        return data
    except Exception:
        logger.exception("Failed to generate bilingual content for: %s", title)
        return {
            "title_zh": title,
            "title_en": title,
            "summary_zh": (content or title)[:200],
            "summary_en": (content or title)[:200],
        }
```

- [ ] **Step 5: Carry `adjusted` through diversity loop and use new function in insertion**

In `run_digest_generation`, update the diversity loop (line 168) to keep `adjusted`:

```python
            top_articles.append((article, score, feed, adjusted))
```

Update the break condition (line 169-170) — no change needed, just `len(top_articles)`.

Update the insertion loop (lines 183-193) to use `generate_bilingual_content` and `final_score`:

```python
        for rank, (article, _score, _feed, adjusted) in enumerate(top_articles, 1):
            content = generate_bilingual_content(
                article.title, article.content, config.model
            )
            digest_article = DigestArticle(
                digest_id=digest.id,
                article_id=article.id,
                rank=rank,
                title_zh=content["title_zh"],
                title_en=content["title_en"],
                summary_zh=content["summary_zh"],
                summary_en=content["summary_en"],
                final_score=round(adjusted, 1),
            )
            session.add(digest_article)
```

- [ ] **Step 6: Commit**

```bash
cd /Users/yikzero/Code/rover-pipeline
git add src/digest/generator.py
git commit -m "feat: generate bilingual titles/summaries and persist final_score"
```

---

## Task 3: Update Telegram message (rover-pipeline)

**Files:**
- Modify: `/Users/yikzero/Code/rover-pipeline/src/digest/telegram.py:30-33,100-108`

- [ ] **Step 1: Update `format_digest_message` to use new keys**

Replace lines 30-33:

```python
    for a in preview:
        summary = a.get("summary_zh", "")
        lines.append("")
        lines.append(f'{a["rank"]}. {summary or a["title_zh"]}')
```

- [ ] **Step 2: Update `articles_data` dict in `push_digest`**

Replace lines 100-108:

```python
        articles_data = [
            {
                "rank": da.rank,
                "title_zh": da.title_zh,
                "url": article.url,
                "summary_zh": da.summary_zh,
            }
            for da, article in items
        ]
```

- [ ] **Step 3: Commit**

```bash
cd /Users/yikzero/Code/rover-pipeline
git add src/digest/telegram.py
git commit -m "feat: use bilingual fields in Telegram digest message"
```

---

## Task 4: Truncate data and update Drizzle schema (rover)

**Files:**
- Modify: `/Users/yikzero/Code/rover/lib/schema.ts:146-162`

- [ ] **Step 1: Truncate existing data in FK order**

Run against the database:

```bash
cd /Users/yikzero/Code/rover
psql "$DATABASE_URL" -c "TRUNCATE telegram_logs, digest_articles, daily_digests CASCADE;"
```

- [ ] **Step 2: Update `digestArticles` table in schema.ts**

Replace lines 146-162:

```typescript
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
    titleZh: text('title_zh').notNull(),
    titleEn: text('title_en').notNull(),
    summaryZh: text('summary_zh').notNull(),
    summaryEn: text('summary_en').notNull(),
    finalScore: numeric('final_score', { precision: 4, scale: 1 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.digestId, table.articleId] }),
    index('digest_articles_article_id_idx').on(table.articleId),
  ],
)
```

- [ ] **Step 3: Generate and run Drizzle migration**

```bash
cd /Users/yikzero/Code/rover
bun run db:generate
bun run db:migrate
```

- [ ] **Step 4: Commit**

```bash
cd /Users/yikzero/Code/rover
git add lib/schema.ts drizzle/
git commit -m "feat: update digest_articles schema with bilingual fields and final_score"
```

---

## Task 5: Update queries (rover)

**Files:**
- Modify: `/Users/yikzero/Code/rover/lib/queries.ts:1-31`

- [ ] **Step 1: Update `digestArticleSelect` and `digestArticlesQuery`**

Remove the `scores` join from `digestArticlesQuery` — `finalScore` now comes from `digestArticles`. Keep the `scores` import since it's still used by stats-counting queries in `getLatestDigest` (line 56) and `getDigestByDate` (line 103).

Replace lines 13-31:

```typescript
const digestArticleSelect = {
  rank: digestArticles.rank,
  titleZh: digestArticles.titleZh,
  titleEn: digestArticles.titleEn,
  summaryZh: digestArticles.summaryZh,
  summaryEn: digestArticles.summaryEn,
  finalScore: digestArticles.finalScore,
  url: articles.url,
  feedTitle: feeds.title,
}

function digestArticlesQuery(digestId: number) {
  return db
    .select(digestArticleSelect)
    .from(digestArticles)
    .innerJoin(articles, eq(digestArticles.articleId, articles.id))
    .innerJoin(feeds, eq(articles.feedId, feeds.id))
    .where(eq(digestArticles.digestId, digestId))
    .orderBy(digestArticles.rank)
}
```

Note: `scores` join is removed from `digestArticlesQuery`. The `scores` import is retained — it's still used by stats queries in `getLatestDigest` and `getDigestByDate`. The API routes (`app/api/digests/route.ts`, `app/api/digests/[date]/route.ts`) need no changes since they delegate to these query functions.

- [ ] **Step 2: Commit**

```bash
cd /Users/yikzero/Code/rover
git add lib/queries.ts
git commit -m "feat: update digest queries with bilingual fields, remove scores join"
```

---

## Task 6: Update frontend components (rover)

**Files:**
- Modify: `/Users/yikzero/Code/rover/components/digest-card.tsx:5-12,52-65`
- Modify: `/Users/yikzero/Code/rover/components/score-badge.tsx:3-6,8,20`

- [ ] **Step 1: Update ScoreBadge props**

In `components/score-badge.tsx`, replace lines 3-8:

```typescript
interface ScoreBadgeProps {
  rank: number
  finalScore: string
}

export function ScoreBadge({ rank, finalScore }: ScoreBadgeProps) {
```

Replace line 20 (`{total}`) with:

```typescript
      {finalScore}
```

- [ ] **Step 2: Update DigestArticle interface**

In `components/digest-card.tsx`, replace lines 5-12:

```typescript
export interface DigestArticle {
  rank: number
  titleZh: string
  titleEn: string
  url: string
  summaryZh: string
  summaryEn: string
  feedTitle: string
  finalScore: string
}
```

- [ ] **Step 3: Update DigestCard component**

In `components/digest-card.tsx`, update the JSX to use new field names.

Replace line 52 (`{article.title}`) with:

```tsx
            <h3 className="font-medium leading-snug">{article.titleZh}</h3>
```

Replace line 53-55 (summary paragraph) with:

```tsx
            <p className="mt-1 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
              {article.summaryZh}
            </p>
```

Replace line 59 (ScoreBadge call) with:

```tsx
          <ScoreBadge rank={article.rank} finalScore={article.finalScore} />
```

Replace line 64 (aria-label) with:

```tsx
            aria-label={`Read ${article.titleEn}`}
```

- [ ] **Step 4: Run lint check**

```bash
cd /Users/yikzero/Code/rover
bun run check
```

Expected: PASS with no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/yikzero/Code/rover
git add components/digest-card.tsx components/score-badge.tsx
git commit -m "feat: update components to display bilingual titles/summaries and finalScore"
```

---

## Task 7: Verify build (rover)

- [ ] **Step 1: Run production build**

```bash
cd /Users/yikzero/Code/rover
bun build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Verify dev server starts**

```bash
cd /Users/yikzero/Code/rover
bun dev
```

Expected: Server starts without errors. Pages load (empty state is fine since data was truncated).
