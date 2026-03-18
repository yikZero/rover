# Rover Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent Python data pipeline that collects articles from RSS feeds and Twitter, scores them with AI, generates daily digests, and pushes to Telegram.

**Architecture:** Python service running in Docker on a Linux server. Uses feedparser for RSS, FxTwitter API + x-tweet-fetcher for Twitter, LiteLLM for AI scoring, and Telegram Bot API for push notifications. Shares a PostgreSQL database (Supabase) with the rover Next.js frontend.

**Tech Stack:** Python 3.12+, SQLAlchemy 2.0, LiteLLM, feedparser, Docker, APScheduler

**Spec:** `docs/superpowers/specs/2026-03-18-rover-pipeline-redesign.md` (in the rover repo)

**Note:** This is a new repository (`rover-pipeline`), separate from the rover frontend.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `pyproject.toml`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `src/__init__.py`
- Create: `src/main.py` (placeholder)
- Create: `config/feeds.yaml`
- Create: `config/filters.yaml`
- Create: `config/scoring.yaml`

- [ ] **Step 1: Create project directory and init git**

```bash
mkdir -p ~/Code/rover-pipeline
cd ~/Code/rover-pipeline
git init
```

- [ ] **Step 2: Create `pyproject.toml`**

```toml
[project]
name = "rover-pipeline"
version = "0.1.0"
description = "Data pipeline for Rover tech news digest"
requires-python = ">=3.12"
dependencies = [
    "sqlalchemy>=2.0",
    "psycopg2-binary>=2.9",
    "feedparser>=6.0",
    "litellm>=1.0",
    "httpx>=0.27",
    "langdetect>=1.0",
    "pyyaml>=6.0",
    "apscheduler>=3.10",
    "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "ruff>=0.5",
]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "W"]
```

- [ ] **Step 3: Create `.env.example`**

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
LITELLM_API_BASE=http://litellm:4000
LITELLM_API_KEY=sk-your-key
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
SITE_URL=https://rover.yikzero.com
```

- [ ] **Step 4: Create `.gitignore`**

```
__pycache__/
*.pyc
.env
.venv/
*.egg-info/
dist/
.ruff_cache/
.pytest_cache/
```

- [ ] **Step 5: Create `docker-compose.yml`**

```yaml
services:
  pipeline:
    build: .
    env_file: .env
    depends_on:
      - litellm
    restart: unless-stopped

  litellm:
    image: ghcr.io/berriai/litellm:main-latest
    ports:
      - "4000:4000"
    volumes:
      - ./config/litellm.yaml:/app/config.yaml
    command: ["--config", "/app/config.yaml"]
    restart: unless-stopped
```

- [ ] **Step 6: Create `Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY . .

CMD ["python", "-m", "src.main"]
```

- [ ] **Step 7: Create config files**

`config/feeds.yaml`:
```yaml
rss:
  - url: https://simonwillison.net/atom/everything/
    tags: [ai, python]
  - url: https://daringfireball.net/feeds/main
    tags: [apple, tech]
  - url: https://xeiaso.net/blog.rss
    tags: [tech, devops]
  - url: https://krebsonsecurity.com/feed/
    tags: [security]
  - url: https://www.troyhunt.com/rss/
    tags: [security]
  - url: https://blog.jim-nielsen.com/feed.xml
    tags: [frontend, design]
  - url: https://lucumr.pocoo.org/feed.atom
    tags: [python, rust]
  - url: https://dynomight.net/feed.xml
    tags: [science, tech]
  - url: https://hnrss.org/frontpage
    tags: [tech, general]

twitter:
  - handle: trq212
    tags: [ai, dev]
  - handle: HiTw93
    tags: [frontend, dev]
  - handle: op7418
    tags: [ai, design]
  - handle: claudeai
    tags: [ai]
  - handle: OpenAI
    tags: [ai]
  - handle: sama
    tags: [ai, tech]
  - handle: alexalbert__
    tags: [ai]
  - handle: dotey
    tags: [ai, tech]
```

`config/filters.yaml`:
```yaml
exclude_keywords:
  - sponsor
  - sponsored
  - advertisement
  - job opening
  - hiring
  - we're hiring
  - deal of the day
  - promo code
  - affiliate

min_content_length: 100

allowed_languages:
  - zh
  - en
```

`config/scoring.yaml`:
```yaml
weights:
  scale: 0.16
  impact: 0.16
  novelty: 0.16
  potential: 0.16
  legacy: 0.16
  positivity: 0.05
  credibility: 0.15

digest:
  min_threshold: 5.0
  max_articles: 10

model: gemini/gemini-2.0-flash
```

`config/litellm.yaml`:
```yaml
model_list:
  - model_name: gemini/gemini-2.0-flash
    litellm_params:
      model: gemini/gemini-2.0-flash
      api_key: os.environ/GEMINI_API_KEY
```

- [ ] **Step 8: Create placeholder `src/__init__.py` and `src/main.py`**

`src/__init__.py`: empty file

`src/main.py`:
```python
"""Rover Pipeline — daily tech news digest generator."""

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rover")


def main():
    logger.info("Rover pipeline starting...")
    # Steps will be wired in subsequent tasks
    logger.info("Rover pipeline complete.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: initial project scaffolding"
```

---

### Task 2: Database Models

**Files:**
- Create: `src/db/__init__.py`
- Create: `src/db/models.py`
- Create: `src/db/session.py`

- [ ] **Step 1: Create `src/db/session.py`**

```python
"""Database session factory."""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

engine = create_engine(os.environ["DATABASE_URL"], echo=False)
Session = sessionmaker(bind=engine)
```

- [ ] **Step 2: Create `src/db/models.py`**

SQLAlchemy models mirroring the Drizzle schema:

```python
"""SQLAlchemy models mirroring rover Drizzle schema."""

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    ForeignKey,
    Index,
    Numeric,
    SmallInteger,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, TIMESTAMP
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Feed(Base):
    __tablename__ = "feeds"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    title = Column(Text, nullable=False)
    url = Column(Text, nullable=False, unique=True)
    site_url = Column(Text)
    type = Column(Text, nullable=False)
    tags = Column(ARRAY(Text))
    is_active = Column(Boolean, nullable=False, default=True)
    last_fetched_at = Column(TIMESTAMP(timezone=True))
    error_count = Column(SmallInteger, nullable=False, default=0)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")

    __table_args__ = (
        CheckConstraint("type IN ('rss', 'twitter')", name="feeds_type_check"),
    )

    articles = relationship("Article", back_populates="feed", cascade="all, delete-orphan")


class Article(Base):
    __tablename__ = "articles"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    feed_id = Column(BigInteger, ForeignKey("feeds.id", ondelete="CASCADE"), nullable=False)
    title = Column(Text, nullable=False)
    url = Column(Text, nullable=False, unique=True)
    content = Column(Text)
    language = Column(Text)
    filter_status = Column(Text, nullable=False, default="pending")
    cluster_id = Column(Text)
    published_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")

    __table_args__ = (
        CheckConstraint(
            "filter_status IN ('pending', 'passed', 'filtered', 'duplicate')",
            name="articles_filter_status_check",
        ),
        Index("articles_feed_id_idx", "feed_id"),
        Index("articles_published_at_idx", "published_at"),
    )

    feed = relationship("Feed", back_populates="articles")
    score = relationship("Score", back_populates="article", uselist=False)


class Score(Base):
    __tablename__ = "scores"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    article_id = Column(
        BigInteger,
        ForeignKey("articles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    scale = Column(Numeric(3, 1), nullable=False)
    impact = Column(Numeric(3, 1), nullable=False)
    novelty = Column(Numeric(3, 1), nullable=False)
    potential = Column(Numeric(3, 1), nullable=False)
    legacy = Column(Numeric(3, 1), nullable=False)
    positivity = Column(Numeric(3, 1), nullable=False)
    credibility = Column(Numeric(3, 1), nullable=False)
    total = Column(Numeric(3, 1), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")

    __table_args__ = (
        *(
            CheckConstraint(f"{col} >= 0 AND {col} <= 10", name=f"scores_{col}_check")
            for col in ["scale", "impact", "novelty", "potential", "legacy", "positivity", "credibility", "total"]
        ),
        Index("scores_total_idx", "total"),
    )

    article = relationship("Article", back_populates="score")


class DailyDigest(Base):
    __tablename__ = "daily_digests"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False, unique=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")

    digest_articles = relationship("DigestArticle", back_populates="digest", cascade="all, delete-orphan")


class DigestArticle(Base):
    __tablename__ = "digest_articles"

    digest_id = Column(BigInteger, ForeignKey("daily_digests.id", ondelete="CASCADE"), primary_key=True)
    article_id = Column(BigInteger, ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True)
    rank = Column(SmallInteger, nullable=False)
    summary = Column(Text, nullable=False)

    __table_args__ = (
        Index("digest_articles_article_id_idx", "article_id"),
    )

    digest = relationship("DailyDigest", back_populates="digest_articles")


class TelegramLog(Base):
    __tablename__ = "telegram_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    digest_id = Column(BigInteger, ForeignKey("daily_digests.id"), nullable=False)
    message_id = Column(Text)
    status = Column(Text, nullable=False)
    sent_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default="now()")

    __table_args__ = (
        CheckConstraint("status IN ('sent', 'failed')", name="telegram_logs_status_check"),
        Index("telegram_logs_digest_id_idx", "digest_id"),
    )
```

- [ ] **Step 3: Create `src/db/__init__.py`**

```python
from src.db.models import Article, Base, DailyDigest, DigestArticle, Feed, Score, TelegramLog
from src.db.session import Session, engine

__all__ = [
    "Article", "Base", "DailyDigest", "DigestArticle",
    "Feed", "Score", "Session", "TelegramLog", "engine",
]
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add SQLAlchemy database models"
```

---

### Task 3: Config Loader

**Files:**
- Create: `src/config.py`

- [ ] **Step 1: Create config loader**

```python
"""Load YAML configuration files."""

from dataclasses import dataclass, field
from pathlib import Path

import yaml

CONFIG_DIR = Path(__file__).parent.parent / "config"


@dataclass
class RssFeed:
    url: str
    tags: list[str] = field(default_factory=list)


@dataclass
class TwitterFeed:
    handle: str
    tags: list[str] = field(default_factory=list)


@dataclass
class FeedsConfig:
    rss: list[RssFeed]
    twitter: list[TwitterFeed]


@dataclass
class FiltersConfig:
    exclude_keywords: list[str]
    min_content_length: int
    allowed_languages: list[str]


@dataclass
class ScoringWeights:
    scale: float
    impact: float
    novelty: float
    potential: float
    legacy: float
    positivity: float
    credibility: float


@dataclass
class DigestConfig:
    min_threshold: float
    max_articles: int


@dataclass
class ScoringConfig:
    weights: ScoringWeights
    digest: DigestConfig
    model: str


def load_feeds() -> FeedsConfig:
    data = yaml.safe_load((CONFIG_DIR / "feeds.yaml").read_text())
    return FeedsConfig(
        rss=[RssFeed(**f) for f in data.get("rss", [])],
        twitter=[TwitterFeed(**f) for f in data.get("twitter", [])],
    )


def load_filters() -> FiltersConfig:
    data = yaml.safe_load((CONFIG_DIR / "filters.yaml").read_text())
    return FiltersConfig(**data)


def load_scoring() -> ScoringConfig:
    data = yaml.safe_load((CONFIG_DIR / "scoring.yaml").read_text())
    return ScoringConfig(
        weights=ScoringWeights(**data["weights"]),
        digest=DigestConfig(**data["digest"]),
        model=data["model"],
    )
```

- [ ] **Step 2: Commit**

```bash
git add src/config.py
git commit -m "feat: add YAML config loader"
```

---

### Task 4: RSS Fetcher

**Files:**
- Create: `src/fetchers/__init__.py`
- Create: `src/fetchers/rss.py`
- Create: `tests/test_rss_fetcher.py`

- [ ] **Step 1: Write test for RSS fetcher**

```python
"""Tests for RSS fetcher."""

from src.fetchers.rss import parse_feed_items


def test_parse_returns_list():
    # Use a known stable RSS feed for integration test
    items = parse_feed_items("https://hnrss.org/frontpage", max_items=3)
    assert isinstance(items, list)
    assert len(items) <= 3
    if items:
        assert "title" in items[0]
        assert "url" in items[0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_rss_fetcher.py -v`
Expected: FAIL (import error)

- [ ] **Step 3: Implement RSS fetcher**

```python
"""RSS feed fetcher using feedparser."""

import logging
from datetime import datetime, timedelta, timezone

import feedparser

logger = logging.getLogger("rover.fetchers.rss")


def parse_feed_items(
    url: str,
    max_items: int = 50,
    hours_lookback: int = 24,
) -> list[dict]:
    """Parse an RSS/Atom feed and return recent items."""
    feed = feedparser.parse(url)

    if feed.bozo and not feed.entries:
        logger.warning("Failed to parse feed: %s — %s", url, feed.bozo_exception)
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_lookback)
    items = []

    for entry in feed.entries[:max_items]:
        link = entry.get("link")
        if not link:
            continue

        title = entry.get("title", "").strip()
        if not title:
            continue

        if entry.get("content"):
            content = entry["content"][0].get("value", "")
        else:
            content = entry.get("summary", "")

        published = None
        if entry.get("published_parsed"):
            published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            if published < cutoff:
                continue

        items.append({
            "title": title,
            "url": link,
            "content": content or "",
            "published_at": published,
        })

    logger.info("Parsed %d items from %s", len(items), url)
    return items
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_rss_fetcher.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add RSS feed fetcher"
```

---

### Task 5: Twitter Fetcher

**Files:**
- Create: `src/fetchers/twitter.py`

- [ ] **Step 1: Implement Twitter fetcher using FxTwitter API**

```python
"""Twitter fetcher using FxTwitter API for individual tweets."""

import logging

import httpx

logger = logging.getLogger("rover.fetchers.twitter")

FXTWITTER_API = "https://api.fxtwitter.com"


def fetch_user_tweets(handle: str, max_items: int = 20) -> list[dict]:
    """Fetch recent tweets from a user.

    Uses FxTwitter API. Note: FxTwitter only supports fetching
    individual tweets by ID, not user timelines directly.
    For MVP, we rely on RSS bridges or external timeline fetchers.
    This function serves as the interface — implementation can be
    swapped to x-tweet-fetcher/Camofox later.
    """
    # MVP: Try RSS bridge first (nitter instances, if available)
    # Fallback: this is a placeholder for x-tweet-fetcher integration
    logger.warning(
        "Twitter timeline fetching for @%s not yet implemented. "
        "Add x-tweet-fetcher or RSS bridge for full support.",
        handle,
    )
    return []


def fetch_tweet_by_id(tweet_id: str) -> dict | None:
    """Fetch a single tweet by ID via FxTwitter API."""
    try:
        resp = httpx.get(f"{FXTWITTER_API}/status/{tweet_id}", timeout=10)
        resp.raise_for_status()
        data = resp.json()

        if data.get("code") != 200:
            return None

        tweet = data["tweet"]
        return {
            "title": tweet["text"][:100],
            "url": tweet["url"],
            "content": tweet["text"],
            "published_at": tweet.get("created_at"),
            "author": tweet.get("author", {}).get("screen_name"),
            "likes": tweet.get("likes", 0),
            "retweets": tweet.get("retweets", 0),
        }
    except Exception:
        logger.exception("Failed to fetch tweet %s", tweet_id)
        return None
```

- [ ] **Step 2: Commit**

```bash
git add src/fetchers/twitter.py
git commit -m "feat: add Twitter fetcher with FxTwitter API"
```

---

### Task 6: Feed Sync and Collection Orchestration

**Files:**
- Create: `src/fetchers/collector.py`

- [ ] **Step 1: Implement collector that syncs feeds and collects articles**

```python
"""Orchestrates feed syncing and article collection."""

import logging
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert

from src.config import load_feeds
from src.db import Article, Feed, Session
from src.fetchers.rss import parse_feed_items

logger = logging.getLogger("rover.fetchers.collector")


def sync_feeds() -> None:
    """Sync feeds from YAML config to database."""
    config = load_feeds()
    session = Session()

    try:
        for rss in config.rss:
            stmt = insert(Feed.__table__).values(
                title=rss.url.split("/")[2],  # domain as title
                url=rss.url,
                type="rss",
                tags=rss.tags,
            ).on_conflict_do_nothing(index_elements=["url"])
            session.execute(stmt)

        for tw in config.twitter:
            url = f"https://x.com/{tw.handle}"
            stmt = insert(Feed.__table__).values(
                title=f"@{tw.handle}",
                url=url,
                type="twitter",
                tags=tw.tags,
            ).on_conflict_do_nothing(index_elements=["url"])
            session.execute(stmt)

        session.commit()
        logger.info("Feeds synced from config.")
    finally:
        session.close()


def collect_articles() -> int:
    """Fetch articles from all active feeds and store in database."""
    session = Session()
    total_new = 0

    try:
        feeds = session.query(Feed).filter(Feed.is_active.is_(True)).all()

        for feed in feeds:
            try:
                if feed.type == "rss":
                    items = parse_feed_items(feed.url)
                elif feed.type == "twitter":
                    items = []  # Twitter fetcher placeholder
                else:
                    continue

                for item in items:
                    stmt = insert(Article.__table__).values(
                        feed_id=feed.id,
                        title=item["title"],
                        url=item["url"],
                        content=item.get("content"),
                        published_at=item.get("published_at"),
                    ).on_conflict_do_nothing(index_elements=["url"])
                    result = session.execute(stmt)
                    if result.rowcount > 0:
                        total_new += 1

                # Update feed health
                feed.last_fetched_at = datetime.now(timezone.utc)
                feed.error_count = 0

            except Exception:
                logger.exception("Failed to fetch feed: %s", feed.url)
                feed.error_count = (feed.error_count or 0) + 1

        session.commit()
        logger.info("Collected %d new articles from %d feeds.", total_new, len(feeds))
    finally:
        session.close()

    return total_new
```

- [ ] **Step 2: Commit**

```bash
git add src/fetchers/collector.py
git commit -m "feat: add feed sync and article collection"
```

---

### Task 7: Pre-filter Processor

**Files:**
- Create: `src/processors/__init__.py`
- Create: `src/processors/filter.py`
- Create: `tests/test_filter.py`

- [ ] **Step 1: Write test**

```python
"""Tests for article pre-filter."""

from src.processors.filter import detect_language, should_exclude


def test_excludes_sponsored_content():
    assert should_exclude("Check out this sponsored post", ["sponsored"])


def test_passes_normal_content():
    assert not should_exclude("New AI model released today", ["sponsored"])


def test_case_insensitive():
    assert should_exclude("SPONSORED content here", ["sponsored"])


def test_detect_english():
    lang = detect_language("This is a new AI model released today")
    assert lang == "en"


def test_detect_chinese():
    lang = detect_language("今天发布了一个新的 AI 模型")
    assert lang == "zh-cn"
```

- [ ] **Step 2: Run test, verify fail**

Run: `pytest tests/test_filter.py -v`

- [ ] **Step 3: Implement filter**

```python
"""Pre-filter articles using keyword and language rules."""

import logging

from langdetect import LangDetectException, detect

from src.config import load_filters
from src.db import Article, Session

logger = logging.getLogger("rover.processors.filter")


def should_exclude(text: str, exclude_keywords: list[str]) -> bool:
    """Check if text contains any exclude keywords."""
    text_lower = text.lower()
    return any(kw.lower() in text_lower for kw in exclude_keywords)


def detect_language(text: str) -> str | None:
    """Detect language of text. Returns ISO 639-1 code or None."""
    try:
        return detect(text[:500])
    except LangDetectException:
        return None


def run_filter() -> tuple[int, int]:
    """Filter pending articles. Returns (passed, filtered) counts."""
    config = load_filters()
    session = Session()
    passed = 0
    filtered = 0

    try:
        pending = session.query(Article).filter(Article.filter_status == "pending").all()

        for article in pending:
            text = f"{article.title} {article.content or ''}"

            if should_exclude(text, config.exclude_keywords):
                article.filter_status = "filtered"
                filtered += 1
                continue

            if len(article.content or "") < config.min_content_length:
                article.filter_status = "filtered"
                filtered += 1
                continue

            # Language detection and filtering
            lang = detect_language(text)
            article.language = lang
            if lang and config.allowed_languages and lang not in config.allowed_languages:
                article.filter_status = "filtered"
                filtered += 1
                continue

            article.filter_status = "passed"
            passed += 1

        session.commit()
        logger.info("Filter complete: %d passed, %d filtered.", passed, filtered)
    finally:
        session.close()

    return passed, filtered
```

- [ ] **Step 4: Run test, verify pass**

Run: `pytest tests/test_filter.py -v`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add article pre-filter"
```

---

### Task 8: Deduplication Processor

**Files:**
- Create: `src/processors/dedup.py`
- Create: `tests/test_dedup.py`

- [ ] **Step 1: Write test**

```python
"""Tests for deduplication."""

from src.processors.dedup import titles_similar


def test_identical_titles():
    assert titles_similar("OpenAI releases GPT-5", "OpenAI releases GPT-5")


def test_similar_titles():
    assert titles_similar(
        "OpenAI releases GPT-5 with new features",
        "OpenAI announces GPT-5 release with new capabilities",
    )


def test_different_titles():
    assert not titles_similar("OpenAI releases GPT-5", "React 20 is now available")
```

- [ ] **Step 2: Run test, verify fail**

Run: `pytest tests/test_dedup.py -v`

- [ ] **Step 3: Implement dedup**

```python
"""Deduplicate articles by URL and title similarity."""

import logging
from difflib import SequenceMatcher

from src.db import Article, Session

logger = logging.getLogger("rover.processors.dedup")

SIMILARITY_THRESHOLD = 0.7


def titles_similar(a: str, b: str) -> bool:
    """Check if two titles are similar using SequenceMatcher."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() > SIMILARITY_THRESHOLD


def run_dedup() -> int:
    """Mark duplicate articles. Returns count of duplicates found."""
    session = Session()
    duplicates = 0

    try:
        passed = (
            session.query(Article)
            .filter(Article.filter_status == "passed")
            .order_by(Article.created_at)
            .all()
        )

        seen_titles: list[tuple[int, str]] = []

        for article in passed:
            is_dup = False
            for seen_id, seen_title in seen_titles:
                if titles_similar(article.title, seen_title):
                    article.filter_status = "duplicate"
                    article.cluster_id = str(seen_id)
                    duplicates += 1
                    is_dup = True
                    break

            if not is_dup:
                seen_titles.append((article.id, article.title))

        session.commit()
        logger.info("Dedup complete: %d duplicates found.", duplicates)
    finally:
        session.close()

    return duplicates
```

- [ ] **Step 4: Run test, verify pass**

Run: `pytest tests/test_dedup.py -v`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add article deduplication"
```

---

### Task 9: AI Scorer

**Files:**
- Create: `src/scoring/__init__.py`
- Create: `src/scoring/scorer.py`

- [ ] **Step 1: Implement AI scorer via LiteLLM**

```python
"""AI article scorer using LiteLLM."""

import json
import logging
import os
from decimal import Decimal

import litellm

from src.config import load_scoring
from src.db import Article, Score, Session

logger = logging.getLogger("rover.scoring")

SCORING_PROMPT = """You are a tech news significance scorer. Rate each article on 7 dimensions (0.0-10.0 scale, one decimal place).

Dimensions:
- scale: How broadly does this affect the tech industry/developers?
- impact: How strong is the immediate effect on workflows, tools, decisions?
- novelty: Is this genuinely new and unexpected, or incremental/rehashed?
- potential: Will this still matter in a year?
- legacy: Could this become a historical turning point?
- positivity: How positive is this event? (low weight, used to balance negativity bias)
- credibility: Is the source first-party/authoritative, or speculation?

Calibration:
- Most articles should score 3-6 per dimension
- Scores above 8 should be rare (top 5%)
- Score 0 for completely irrelevant dimensions

Return a JSON array with one object per article:
[{{"article_index": 0, "scale": 5.0, "impact": 4.5, ...}}, ...]

Articles to score:
"""


def score_articles_batch(articles_data: list[dict]) -> list[dict] | None:
    """Score a batch of articles via LiteLLM. Returns list of score dicts."""
    config = load_scoring()

    prompt = SCORING_PROMPT
    for i, a in enumerate(articles_data):
        prompt += f"\n[{i}] Title: {a['title']}\nContent: {(a['content'] or '')[:500]}\n"

    try:
        response = litellm.completion(
            model=config.model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            api_base=os.environ.get("LITELLM_API_BASE"),
            api_key=os.environ.get("LITELLM_API_KEY"),
        )

        text = response.choices[0].message.content
        # Extract JSON array from response
        result = json.loads(text)
        if isinstance(result, dict) and "scores" in result:
            result = result["scores"]
        return result
    except Exception:
        logger.exception("Failed to score batch of %d articles", len(articles_data))
        return None


def calculate_total(scores: dict, weights: dict) -> Decimal:
    """Calculate weighted total score."""
    total = sum(
        float(scores.get(dim, 0)) * weights[dim]
        for dim in ["scale", "impact", "novelty", "potential", "legacy", "positivity", "credibility"]
    )
    return Decimal(str(round(total, 1)))


def run_scoring() -> int:
    """Score all passed, unscored articles. Returns count scored."""
    config = load_scoring()
    session = Session()
    scored = 0
    batch_size = 20

    try:
        unscored = (
            session.query(Article)
            .outerjoin(Score, Article.id == Score.article_id)
            .filter(Article.filter_status == "passed", Score.id.is_(None))
            .all()
        )

        weights = {
            "scale": config.weights.scale,
            "impact": config.weights.impact,
            "novelty": config.weights.novelty,
            "potential": config.weights.potential,
            "legacy": config.weights.legacy,
            "positivity": config.weights.positivity,
            "credibility": config.weights.credibility,
        }

        for i in range(0, len(unscored), batch_size):
            batch = unscored[i : i + batch_size]
            articles_data = [{"title": a.title, "content": a.content} for a in batch]

            results = score_articles_batch(articles_data)
            if not results:
                continue

            for j, result in enumerate(results):
                if j >= len(batch):
                    break
                article = batch[j]
                total = calculate_total(result, weights)

                score = Score(
                    article_id=article.id,
                    scale=Decimal(str(result.get("scale", 0))),
                    impact=Decimal(str(result.get("impact", 0))),
                    novelty=Decimal(str(result.get("novelty", 0))),
                    potential=Decimal(str(result.get("potential", 0))),
                    legacy=Decimal(str(result.get("legacy", 0))),
                    positivity=Decimal(str(result.get("positivity", 0))),
                    credibility=Decimal(str(result.get("credibility", 0))),
                    total=total,
                )
                session.add(score)
                scored += 1

        session.commit()
        logger.info("Scored %d articles.", scored)
    finally:
        session.close()

    return scored
```

- [ ] **Step 2: Create `src/scoring/__init__.py`**

Empty file.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add AI article scorer via LiteLLM"
```

---

### Task 10: Digest Generator

**Files:**
- Create: `src/digest/__init__.py`
- Create: `src/digest/generator.py`

- [ ] **Step 1: Implement digest generator**

```python
"""Generate daily digest from top-scored articles."""

import json
import logging
import os
from datetime import date

import litellm
from sqlalchemy import desc
from sqlalchemy.dialects.postgresql import insert

from src.config import load_scoring
from src.db import Article, DailyDigest, DigestArticle, Feed, Score, Session

logger = logging.getLogger("rover.digest.generator")

SUMMARY_PROMPT = """Generate a concise Chinese summary (150-200 characters) of this article.

Rules:
- Add a space between CJK characters and Latin/number characters
- Use Chinese punctuation (，。、；：)
- Keep technical terms in English
- Use half-width numbers
- Focus on what happened and why it matters

Title: {title}
Content: {content}
"""


def generate_summary(title: str, content: str, model: str) -> str:
    """Generate a Chinese summary for an article."""
    try:
        response = litellm.completion(
            model=model,
            messages=[{
                "role": "user",
                "content": SUMMARY_PROMPT.format(title=title, content=(content or "")[:2000]),
            }],
            api_base=os.environ.get("LITELLM_API_BASE"),
            api_key=os.environ.get("LITELLM_API_KEY"),
        )
        return response.choices[0].message.content.strip()
    except Exception:
        logger.exception("Failed to generate summary for: %s", title)
        return title  # Fallback to title


def run_digest_generation() -> str | None:
    """Generate today's digest. Returns date string or None if skipped."""
    config = load_scoring()
    session = Session()
    today = date.today()

    try:
        # Check if digest already exists
        existing = session.query(DailyDigest).filter(DailyDigest.date == today).first()
        if existing:
            logger.info("Digest for %s already exists, skipping.", today)
            return None

        # Get top articles above threshold
        top_articles = (
            session.query(Article, Score, Feed)
            .join(Score, Article.id == Score.article_id)
            .join(Feed, Article.feed_id == Feed.id)
            .filter(
                Article.filter_status == "passed",
                Score.total >= config.digest.min_threshold,
            )
            .order_by(desc(Score.total))
            .limit(config.digest.max_articles)
            .all()
        )

        if not top_articles:
            logger.info("No articles meet threshold %.1f, skipping digest.", config.digest.min_threshold)
            return None

        # Create digest
        digest = DailyDigest(date=today)
        session.add(digest)
        session.flush()  # Get digest ID

        for rank, (article, score, feed) in enumerate(top_articles, 1):
            summary = generate_summary(article.title, article.content, config.model)

            digest_article = DigestArticle(
                digest_id=digest.id,
                article_id=article.id,
                rank=rank,
                summary=summary,
            )
            session.add(digest_article)

        session.commit()
        logger.info("Generated digest for %s with %d articles.", today, len(top_articles))
        return str(today)
    finally:
        session.close()
```

- [ ] **Step 2: Create `src/digest/__init__.py`**

Empty file.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add daily digest generator"
```

---

### Task 11: Telegram Push

**Files:**
- Create: `src/digest/telegram.py`

- [ ] **Step 1: Implement Telegram push**

```python
"""Send digest to Telegram via Bot API."""

import logging
import os

import httpx

from src.db import (
    Article,
    DailyDigest,
    DigestArticle,
    Feed,
    Score,
    Session,
    TelegramLog,
)

logger = logging.getLogger("rover.digest.telegram")

TELEGRAM_API = "https://api.telegram.org"


def format_digest_message(digest_date: str, articles: list[dict]) -> str:
    """Format digest as Telegram message."""
    lines = [f"Rover Daily Digest — {digest_date}\n"]

    for a in articles:
        lines.append(f"{a['rank']}. [{a['total']}] {a['title']}")
        lines.append(f"   → {a['url']}\n")

    site_url = os.environ.get("SITE_URL", "https://rover.yikzero.com")
    lines.append(f"Full report: {site_url}/digests/{digest_date}")

    return "\n".join(lines)


def send_telegram_message(text: str) -> str | None:
    """Send message via Telegram Bot API. Returns message_id or None."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")

    if not token or not chat_id:
        logger.warning("Telegram credentials not configured, skipping push.")
        return None

    try:
        resp = httpx.post(
            f"{TELEGRAM_API}/bot{token}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": text,
                "disable_web_page_preview": True,
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("ok"):
            return str(data["result"]["message_id"])

        logger.error("Telegram API error: %s", data)
        return None
    except Exception:
        logger.exception("Failed to send Telegram message")
        return None


def push_digest(digest_date: str) -> bool:
    """Push a digest to Telegram. Returns True if sent successfully."""
    session = Session()

    try:
        digest = session.query(DailyDigest).filter(DailyDigest.date == digest_date).first()
        if not digest:
            logger.error("Digest not found for %s", digest_date)
            return False

        items = (
            session.query(DigestArticle, Article, Score)
            .join(Article, DigestArticle.article_id == Article.id)
            .join(Score, Article.id == Score.article_id)
            .filter(DigestArticle.digest_id == digest.id)
            .order_by(DigestArticle.rank)
            .all()
        )

        articles_data = [
            {
                "rank": da.rank,
                "title": article.title,
                "url": article.url,
                "total": str(score.total),
            }
            for da, article, score in items
        ]

        message = format_digest_message(digest_date, articles_data)
        message_id = send_telegram_message(message)

        # Log the attempt
        log = TelegramLog(
            digest_id=digest.id,
            message_id=message_id,
            status="sent" if message_id else "failed",
        )
        session.add(log)
        session.commit()

        return message_id is not None
    finally:
        session.close()
```

- [ ] **Step 2: Commit**

```bash
git add src/digest/telegram.py
git commit -m "feat: add Telegram push notification"
```

---

### Task 12: Wire Main Orchestrator

**Files:**
- Modify: `src/main.py`

- [ ] **Step 1: Wire all steps in main.py**

```python
"""Rover Pipeline — daily tech news digest generator."""

import logging
import sys

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rover")


def run_pipeline():
    """Execute the full daily pipeline."""
    from src.digest.generator import run_digest_generation
    from src.digest.telegram import push_digest
    from src.fetchers.collector import collect_articles, sync_feeds
    from src.processors.dedup import run_dedup
    from src.processors.filter import run_filter
    from src.scoring.scorer import run_scoring

    logger.info("=== Rover Pipeline Starting ===")

    # Step 1: Sync feeds from config
    sync_feeds()

    # Step 2: Collect articles
    new_articles = collect_articles()
    if new_articles == 0:
        logger.info("No new articles found. Done.")
        return

    # Step 3: Pre-filter
    passed, filtered = run_filter()
    logger.info("Filter: %d passed, %d filtered.", passed, filtered)

    if passed == 0:
        logger.info("No articles passed filter. Done.")
        return

    # Step 4: Dedup
    duplicates = run_dedup()
    logger.info("Dedup: %d duplicates removed.", duplicates)

    # Step 5: AI Scoring
    scored = run_scoring()
    logger.info("Scoring: %d articles scored.", scored)

    # Step 6: Generate digest
    digest_date = run_digest_generation()

    if digest_date:
        # Step 7: Telegram push
        success = push_digest(digest_date)
        if success:
            logger.info("Telegram push sent for %s.", digest_date)
        else:
            logger.warning("Telegram push failed for %s.", digest_date)
    else:
        logger.info("No digest generated today.")

    logger.info("=== Rover Pipeline Complete ===")


def main():
    """Entry point."""
    if "--once" in sys.argv:
        run_pipeline()
        return

    # Scheduled mode
    from apscheduler.schedulers.blocking import BlockingScheduler

    scheduler = BlockingScheduler()
    scheduler.add_job(run_pipeline, "cron", hour=8, minute=0, timezone="Asia/Shanghai")
    logger.info("Scheduler started. Pipeline will run daily at 08:00 CST.")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test with --once flag (dry run)**

Run: `python -m src.main --once`
Expected: Pipeline runs through all steps, logs output. May fail on LiteLLM if not configured — that's OK, just verify the orchestration works.

- [ ] **Step 3: Commit**

```bash
git add src/main.py
git commit -m "feat: wire pipeline orchestrator with all steps"
```

---

### Task 13: Docker Build and Verify

- [ ] **Step 1: Build Docker image**

```bash
docker build -t rover-pipeline .
```

Expected: Build succeeds.

- [ ] **Step 2: Test docker-compose**

Create `.env` from `.env.example` with real values, then:

```bash
docker-compose up --build
```

Verify both `pipeline` and `litellm` containers start. Pipeline should run with `--once` for initial test (update CMD or pass args).

- [ ] **Step 3: Commit any docker fixes**

```bash
git add -A
git commit -m "chore: finalize Docker configuration"
```

---

### Task 14: Push to GitHub

- [ ] **Step 1: Create GitHub repo**

```bash
gh repo create yikZero/rover-pipeline --private --source=. --push
```

- [ ] **Step 2: Verify repo on GitHub**

Check that all files are pushed and CI (if any) passes.
