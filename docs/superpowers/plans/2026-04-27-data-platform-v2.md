# MovieNexus — Data Platform v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve MovieNexus from a 20-movie tracker into a comprehensive media database foundation with reformed IDs, bulk ingestion of 50k+ titles, trending snapshots, and multi-source rating sync.

**Architecture:** FastAPI backend extended with APScheduler for cron jobs, a Telegram notification helper, Trakt/AniList API clients, and new admin/trending routers. The existing `create_all` approach handles new tables; a one-time migration script handles the ID format change on existing rows.

**Tech Stack:** FastAPI, async SQLAlchemy (asyncpg), PostgreSQL 16, APScheduler 3.x, Pillow, httpx (already present), Trakt API, AniList GraphQL, Telegram Bot API

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `backend/api/trakt.py` | Trakt API client (trending, ratings) |
| `backend/api/telegram.py` | Telegram notification helper |
| `backend/scheduler.py` | APScheduler instance + all cron job registration |
| `backend/routers/trending.py` | `GET /api/trending` endpoint |
| `backend/routers/admin.py` | Admin endpoints: export, artwork verify, import start |
| `scripts/migrate_nexus_ids.py` | One-time migration: `ms-0000001` → `ms1` |

### Modified files
| File | What changes |
|---|---|
| `backend/nexus_id.py` | Rewrite: 11 media types, no padding, no dash |
| `backend/models.py` | Add `hash/width/height` to `Artwork`, add `TrendingSnapshot` |
| `backend/config.py` | Add `telegram_bot_token`, `telegram_chat_id` settings |
| `backend/main.py` | Add legacy redirect middleware, include new routers, start scheduler |
| `backend/routers/imports.py` | Add bulk crawl + Telegram notification every 10k |
| `requirements.txt` | Add `apscheduler==3.10.4`, `Pillow==10.3.0` |

---

## Task 1: Rewrite `nexus_id.py` — 11 media types, no padding

**Files:**
- Modify: `backend/nexus_id.py`

- [ ] **Step 1: Replace the file content**

```python
# backend/nexus_id.py
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

# Prefix registry — maps media_type key → ID prefix
PREFIXES = {
    "movie":         "ms",
    "show":          "tv",
    "episode":       "es",
    "anime":         "an",
    "anime_episode": "ae",
    "youtube":       "yt",
    "channel":       "yc",
    "ufc_event":     "ufc",
    "ufc_fight":     "uf",
    "wwe_event":     "wwe",
    "wwe_match":     "wm",
}

# Dedicated counter table per media type ensures no gaps from multi-type counting
_COUNTER_TABLE = "nexus_id_counters"


async def generate_nexus_id(db: AsyncSession, media_type: str) -> str:
    """Generate next nexus_id for the given media_type. Thread-safe via SELECT FOR UPDATE."""
    prefix = PREFIXES[media_type]

    # Upsert counter row and increment atomically
    await db.execute(
        text(f"""
            INSERT INTO {_COUNTER_TABLE} (media_type, next_val)
            VALUES (:mt, 1)
            ON CONFLICT (media_type) DO UPDATE
            SET next_val = {_COUNTER_TABLE}.next_val + 1
        """),
        {"mt": media_type},
    )
    result = await db.execute(
        text(f"SELECT next_val FROM {_COUNTER_TABLE} WHERE media_type = :mt"),
        {"mt": media_type},
    )
    next_val = result.scalar()
    return f"{prefix}{next_val}"


async def ensure_counter_table(db: AsyncSession) -> None:
    """Create the nexus_id_counters table if it doesn't exist. Call once at startup."""
    await db.execute(
        text(f"""
            CREATE TABLE IF NOT EXISTS {_COUNTER_TABLE} (
                media_type VARCHAR(20) PRIMARY KEY,
                next_val   BIGINT NOT NULL DEFAULT 0
            )
        """)
    )
    await db.commit()
```

- [ ] **Step 2: Verify no other file imports `PREFIXES`, `DIGITS`, or `MODELS` from nexus_id.py**

```bash
grep -r "from nexus_id import\|import nexus_id" backend/
```

Expected output: only `routers/imports.py` imports `generate_nexus_id` — that import signature is unchanged.

- [ ] **Step 3: Commit**

```bash
git add backend/nexus_id.py
git commit -m "feat: rewrite nexus_id — 11 media types, no padding, atomic counter table"
```

---

## Task 2: Update models — Artwork columns + TrendingSnapshot

**Files:**
- Modify: `backend/models.py`

- [ ] **Step 1: Add `hash`, `width`, `height` to Artwork and add TrendingSnapshot**

In `models.py`, replace the `Artwork` class:

```python
class Artwork(Base):
    __tablename__ = "artwork"

    id = Column(Integer, primary_key=True)
    media_type = Column(String(10), nullable=False)
    media_id = Column(Integer, nullable=False)
    source = Column(String(10), nullable=False)
    type = Column(String(20), nullable=False)
    url = Column(Text, nullable=False)
    language = Column(String(5))
    likes = Column(Integer, default=0)
    hash = Column(String(64))          # SHA-256 hex digest of image bytes
    width = Column(Integer)            # pixels
    height = Column(Integer)           # pixels

    __table_args__ = (
        Index("ix_artwork_media", "media_type", "media_id"),
    )
```

Then add `TrendingSnapshot` at the bottom of `models.py` (before or after `ImportSession`):

```python
class TrendingSnapshot(Base):
    __tablename__ = "trending_snapshots"

    id = Column(Integer, primary_key=True)
    nexus_id = Column(String(20), nullable=False, index=True)
    media_type = Column(String(10), nullable=False)   # movie/show/anime
    window = Column(String(10), nullable=False)        # daily/weekly/alltime
    rank = Column(Integer, nullable=False)
    watcher_count = Column(Integer, default=0)
    snapshot_date = Column(Date, nullable=False)

    __table_args__ = (
        Index("ix_trending_date_type_window", "snapshot_date", "media_type", "window"),
    )
```

- [ ] **Step 2: Update `nexus_id` column sizes to String(20) to accommodate all 11 prefix types**

In `Movie`, `TVShow`, `Episode` — change `String(12)` and `String(14)` to `String(20)`:

```python
# Movie
nexus_id = Column(String(20), unique=True, nullable=False, index=True)

# TVShow
nexus_id = Column(String(20), unique=True, nullable=False, index=True)

# Episode
nexus_id = Column(String(20), unique=True, nullable=False, index=True)
```

- [ ] **Step 3: Confirm `create_all` picks up new tables/columns**

Since the DB is currently empty (`create_all` runs at startup in `main.py:29`), new tables and columns will be created automatically on next container start. No manual migration needed for a fresh DB.

- [ ] **Step 4: Commit**

```bash
git add backend/models.py
git commit -m "feat: add Artwork hash/width/height columns, TrendingSnapshot table, widen nexus_id to 20 chars"
```

---

## Task 3: Config + Telegram notification helper

**Files:**
- Modify: `backend/config.py`
- Create: `backend/api/telegram.py`

- [ ] **Step 1: Add Telegram settings to config.py**

```python
# backend/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@db:5432/movienexus"
    redis_url: str = "redis://redis:6379/0"
    tmdb_api_key: str = ""
    tvdb_api_key: str = ""
    fanart_api_key: str = ""
    trakt_client_id: str = ""
    plex_url: str = ""
    plex_token: str = ""
    secret_key: str = "changeme"
    debug: bool = False
    telegram_bot_token: str = ""   # e.g. 123456:ABC-DEF...
    telegram_chat_id: str = ""     # e.g. -1001234567890

    model_config = {"env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 2: Create `backend/api/telegram.py`**

```python
# backend/api/telegram.py
import logging

import httpx

from config import get_settings

logger = logging.getLogger(__name__)

_TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"


async def send_telegram(message: str) -> bool:
    """Send a Telegram message. Returns True on success, False on failure (never raises)."""
    settings = get_settings()
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        logger.debug("Telegram not configured — skipping notification")
        return False

    url = _TELEGRAM_API.format(token=settings.telegram_bot_token)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json={
                "chat_id": settings.telegram_chat_id,
                "text": message,
                "parse_mode": "HTML",
            })
            resp.raise_for_status()
            return True
    except Exception as e:
        logger.warning(f"Telegram notification failed: {e}")
        return False
```

- [ ] **Step 3: Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to .env on the server**

Run on server2:
```bash
echo "TELEGRAM_BOT_TOKEN=your_bot_token_here" >> /opt/movienexus/.env
echo "TELEGRAM_CHAT_ID=your_chat_id_here" >> /opt/movienexus/.env
```

- [ ] **Step 4: Commit**

```bash
git add backend/config.py backend/api/telegram.py
git commit -m "feat: add Telegram notification helper + config keys"
```

---

## Task 4: Bulk import pipeline — crawl 50k movies + 20k shows with Telegram every 10k

**Files:**
- Modify: `backend/routers/imports.py`
- Modify: `backend/api/tmdb.py`

- [ ] **Step 1: Add `get_trending_movies` and `get_trending_tv` to TMDbClient**

In `backend/api/tmdb.py`, add inside the `TMDbClient` class before `close()`:

```python
async def get_now_playing(self, page: int = 1) -> dict:
    return await self._get("/movie/now_playing", {"page": page})

async def get_changes_movies(self, page: int = 1) -> dict:
    """Movies added/changed in last 24h on TMDb."""
    return await self._get("/movie/changes", {"page": page})

async def get_changes_tv(self, page: int = 1) -> dict:
    return await self._get("/tv/changes", {"page": page})
```

- [ ] **Step 2: Add `_run_bulk_crawl()` to `backend/routers/imports.py`**

Add these imports at the top of `imports.py`:

```python
from datetime import datetime, date, timezone
```

Then add the bulk crawl function after `_run_import()`:

```python
async def _run_bulk_crawl(session_id: int, media_type: str, total_pages: int):
    """Crawl TMDb discover pages and import everything. Telegram every 10k records."""
    progress = _active_jobs[session_id]
    imported_total = 0
    skipped_total = 0
    failed_total = 0
    last_notified_at = 0  # track last milestone for 10k notifications

    async with async_session() as db:
        for page in range(1, total_pages + 1):
            try:
                if media_type == "movie":
                    data = await tmdb_client.discover_movies(page=page, sort_by="popularity.desc")
                else:
                    data = await tmdb_client.discover_tv(page=page, sort_by="popularity.desc")
            except Exception as e:
                logger.error(f"Discover page {page} failed: {e}")
                progress["failed"] += 1
                await asyncio.sleep(2)
                continue

            items = data.get("results", [])
            for item in items:
                tmdb_id = item.get("id")
                if not tmdb_id:
                    continue
                try:
                    if media_type == "movie":
                        result = await _import_single_movie(db, tmdb_id)
                    else:
                        result = await _import_single_show(db, tmdb_id)

                    if result == "imported":
                        imported_total += 1
                        progress["imported"] += 1
                    else:
                        skipped_total += 1
                        progress["skipped"] += 1
                    progress["current_title"] = item.get("title") or item.get("name", f"TMDb #{tmdb_id}")
                except Exception as e:
                    failed_total += 1
                    progress["failed"] += 1
                    logger.error(f"Bulk import failed for {tmdb_id}: {e}")

            # Notify every 10k imported records
            total_processed = imported_total + skipped_total
            milestone = (total_processed // 10_000) * 10_000
            if milestone > last_notified_at and milestone > 0:
                last_notified_at = milestone
                eta_pages_left = total_pages - page
                approx_remaining = eta_pages_left * len(items)
                msg = (
                    f"<b>MovieNexus Bulk Import</b> — {milestone:,} records processed\n"
                    f"✅ Imported: {imported_total:,}\n"
                    f"⏭ Skipped: {skipped_total:,}\n"
                    f"❌ Failed: {failed_total:,}\n"
                    f"📄 Page: {page}/{total_pages}\n"
                    f"⏳ ~{approx_remaining:,} records remaining"
                )
                from api.telegram import send_telegram
                await send_telegram(msg)

            progress["page"] = page
            await asyncio.sleep(0.1)  # slight pause between pages

        # Final notification
        final_msg = (
            f"<b>MovieNexus Bulk Import COMPLETE</b>\n"
            f"Type: {media_type}\n"
            f"✅ Imported: {imported_total:,}\n"
            f"⏭ Skipped: {skipped_total:,}\n"
            f"❌ Failed: {failed_total:,}\n"
            f"📄 Pages crawled: {total_pages:,}"
        )
        from api.telegram import send_telegram
        await send_telegram(final_msg)

        session_obj = await db.get(ImportSession, session_id)
        if session_obj:
            session_obj.finished_at = datetime.now(timezone.utc)
            session_obj.imported = imported_total
            session_obj.skipped = skipped_total
            session_obj.failed = failed_total
            session_obj.status = "completed"
            await db.commit()

    progress["status"] = "completed"
```

- [ ] **Step 3: Add the bulk crawl endpoint to `imports.py`**

Add after the existing `import_discover_shows` endpoint:

```python
@router.post("/bulk/start")
async def start_bulk_import(
    media_type: str = Query("movie", regex="^(movie|show)$"),
    pages: int = Query(2500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
):
    """
    Start a bulk crawl of TMDb discover sorted by popularity.
    movies: pages=2500 → ~50,000 titles
    shows:  pages=1000 → ~20,000 titles
    Sends Telegram notification every 10k records.
    """
    estimated = pages * 20  # ~20 results/page
    session = ImportSession(
        source="tmdb_bulk",
        media_type=media_type,
        total=estimated,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    _active_jobs[session.id] = {
        "session_id": session.id,
        "source": "tmdb_bulk",
        "status": "running",
        "media_type": media_type,
        "total": estimated,
        "imported": 0,
        "skipped": 0,
        "failed": 0,
        "page": 0,
        "current_title": "",
    }

    asyncio.create_task(_run_bulk_crawl(session.id, media_type, pages))
    return {
        "session_id": session.id,
        "message": f"Bulk {media_type} crawl started ({pages} pages, ~{estimated:,} titles)",
    }
```

- [ ] **Step 4: Commit**

```bash
git add backend/routers/imports.py backend/api/tmdb.py
git commit -m "feat: bulk crawl endpoint — crawls TMDb discover with Telegram every 10k records"
```

---

## Task 5: Trakt API client

**Files:**
- Create: `backend/api/trakt.py`

- [ ] **Step 1: Create `backend/api/trakt.py`**

```python
# backend/api/trakt.py
import asyncio
import logging

import httpx

from config import get_settings

logger = logging.getLogger(__name__)

BASE_URL = "https://api.trakt.tv"


class TraktClient:
    def __init__(self):
        settings = get_settings()
        self.client_id = settings.trakt_client_id
        self._client: httpx.AsyncClient | None = None
        self._semaphore = asyncio.Semaphore(5)

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=BASE_URL,
                headers={
                    "Content-Type": "application/json",
                    "trakt-api-version": "2",
                    "trakt-api-key": self.client_id,
                },
                timeout=30.0,
            )
        return self._client

    async def _get(self, path: str, params: dict | None = None) -> list | dict:
        async with self._semaphore:
            client = await self._get_client()
            resp = await client.get(path, params=params)
            if resp.status_code == 429:
                await asyncio.sleep(int(resp.headers.get("Retry-After", 5)))
                resp = await client.get(path, params=params)
            resp.raise_for_status()
            return resp.json()

    async def get_trending_movies(self, limit: int = 10) -> list[dict]:
        """Returns list of {watchers, movie:{title, year, ids:{trakt,tmdb,imdb}}}"""
        return await self._get("/movies/trending", {"limit": limit, "extended": "full"})

    async def get_trending_shows(self, limit: int = 10) -> list[dict]:
        """Returns list of {watchers, show:{title, year, ids:{trakt,tmdb,imdb}}}"""
        return await self._get("/shows/trending", {"limit": limit, "extended": "full"})

    async def get_popular_movies(self, limit: int = 100) -> list[dict]:
        return await self._get("/movies/popular", {"limit": limit, "extended": "full"})

    async def get_popular_shows(self, limit: int = 100) -> list[dict]:
        return await self._get("/shows/popular", {"limit": limit, "extended": "full"})

    async def get_movie_ratings(self, trakt_slug: str) -> dict:
        """Returns {rating, votes, distribution}"""
        return await self._get(f"/movies/{trakt_slug}/ratings")

    async def get_show_ratings(self, trakt_slug: str) -> dict:
        return await self._get(f"/shows/{trakt_slug}/ratings")

    async def get_weekly_trending_movies(self, limit: int = 100) -> list[dict]:
        """Use played endpoint for weekly window."""
        return await self._get("/movies/played/weekly", {"limit": limit, "extended": "full"})

    async def get_weekly_trending_shows(self, limit: int = 100) -> list[dict]:
        return await self._get("/shows/played/weekly", {"limit": limit, "extended": "full"})

    async def get_alltime_trending_movies(self, limit: int = 100) -> list[dict]:
        return await self._get("/movies/played/all", {"limit": limit, "extended": "full"})

    async def get_alltime_trending_shows(self, limit: int = 100) -> list[dict]:
        return await self._get("/shows/played/all", {"limit": limit, "extended": "full"})

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


trakt_client = TraktClient()
```

- [ ] **Step 2: Commit**

```bash
git add backend/api/trakt.py
git commit -m "feat: Trakt API client — trending, popular, ratings endpoints"
```

---

## Task 6: Trending data — TrendingSnapshot router + sync logic

**Files:**
- Create: `backend/routers/trending.py`

- [ ] **Step 1: Create `backend/routers/trending.py`**

```python
# backend/routers/trending.py
import logging
from datetime import date, timezone, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, async_session
from models import Movie, TVShow, TrendingSnapshot
from api.trakt import trakt_client
from api.telegram import send_telegram

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trending", tags=["Trending"])


@router.get("")
async def get_trending(
    media_type: str = Query("movie", regex="^(movie|show)$"),
    window: str = Query("daily", regex="^(daily|weekly|alltime)$"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Return trending snapshots for the most recent snapshot_date for given type+window."""
    subquery = (
        select(func.max(TrendingSnapshot.snapshot_date))
        .where(
            TrendingSnapshot.media_type == media_type,
            TrendingSnapshot.window == window,
        )
        .scalar_subquery()
    )
    result = await db.execute(
        select(TrendingSnapshot)
        .where(
            TrendingSnapshot.media_type == media_type,
            TrendingSnapshot.window == window,
            TrendingSnapshot.snapshot_date == subquery,
        )
        .order_by(TrendingSnapshot.rank)
        .limit(limit)
    )
    snapshots = result.scalars().all()
    return [
        {
            "rank": s.rank,
            "nexus_id": s.nexus_id,
            "media_type": s.media_type,
            "window": s.window,
            "watcher_count": s.watcher_count,
            "snapshot_date": str(s.snapshot_date),
        }
        for s in snapshots
    ]


async def _resolve_nexus_id_for_tmdb(db: AsyncSession, tmdb_id: int, media_type: str) -> str | None:
    """Look up nexus_id in movies/tv_shows by tmdb_id."""
    if media_type == "movie":
        result = await db.execute(select(Movie.nexus_id).where(Movie.tmdb_id == tmdb_id))
    else:
        result = await db.execute(select(TVShow.nexus_id).where(TVShow.tmdb_id == tmdb_id))
    return result.scalar_one_or_none()


async def sync_trending_all_windows() -> None:
    """Fetch all 3 windows from Trakt for movies + shows, write TrendingSnapshots."""
    today = date.today()

    window_fetchers = {
        "daily": {
            "movie": trakt_client.get_trending_movies,
            "show": trakt_client.get_trending_shows,
        },
        "weekly": {
            "movie": trakt_client.get_weekly_trending_movies,
            "show": trakt_client.get_weekly_trending_shows,
        },
        "alltime": {
            "movie": trakt_client.get_alltime_trending_movies,
            "show": trakt_client.get_alltime_trending_shows,
        },
    }

    async with async_session() as db:
        for window, type_map in window_fetchers.items():
            for media_type, fetcher in type_map.items():
                try:
                    items = await fetcher(limit=100)
                except Exception as e:
                    logger.error(f"Trakt trending {media_type}/{window} failed: {e}")
                    continue

                for rank, item in enumerate(items, start=1):
                    media_obj = item.get("movie") or item.get("show") or {}
                    watchers = item.get("watchers", 0)
                    tmdb_id = media_obj.get("ids", {}).get("tmdb")
                    if not tmdb_id:
                        continue

                    nexus_id = await _resolve_nexus_id_for_tmdb(db, tmdb_id, media_type)
                    if not nexus_id:
                        continue  # not in our DB yet

                    db.add(TrendingSnapshot(
                        nexus_id=nexus_id,
                        media_type=media_type,
                        window=window,
                        rank=rank,
                        watcher_count=watchers,
                        snapshot_date=today,
                    ))

        await db.commit()
    logger.info("Trending sync complete")


async def send_daily_trending_summary() -> None:
    """Send top 10 movies + top 10 shows to Telegram."""
    today = date.today()
    async with async_session() as db:
        for media_type, label in [("movie", "Movies"), ("show", "Shows")]:
            subquery = (
                select(func.max(TrendingSnapshot.snapshot_date))
                .where(
                    TrendingSnapshot.media_type == media_type,
                    TrendingSnapshot.window == "daily",
                )
                .scalar_subquery()
            )
            result = await db.execute(
                select(TrendingSnapshot)
                .where(
                    TrendingSnapshot.media_type == media_type,
                    TrendingSnapshot.window == "daily",
                    TrendingSnapshot.snapshot_date == subquery,
                )
                .order_by(TrendingSnapshot.rank)
                .limit(10)
            )
            snapshots = result.scalars().all()

            if not snapshots:
                continue

            lines = [f"<b>Top 10 Trending {label} — {today}</b>"]
            for s in snapshots:
                if media_type == "movie":
                    title_result = await db.execute(
                        select(Movie.title).where(Movie.nexus_id == s.nexus_id)
                    )
                else:
                    title_result = await db.execute(
                        select(TVShow.title).where(TVShow.nexus_id == s.nexus_id)
                    )
                title = title_result.scalar_one_or_none() or s.nexus_id
                lines.append(f"{s.rank}. {title} ({s.watcher_count:,} watchers)")

            await send_telegram("\n".join(lines))
```

- [ ] **Step 2: Commit**

```bash
git add backend/routers/trending.py
git commit -m "feat: trending router — GET /api/trending + sync_trending_all_windows + daily Telegram summary"
```

---

## Task 7: Multi-source rating sync (nightly cron logic)

**Files:**
- Create: `backend/routers/admin.py` (partial — rating sync function only; full admin router in Task 9)

This task adds the `sync_ratings_nightly()` function that the scheduler will call. It also adds quality-control Telegram alerts.

- [ ] **Step 1: Create `backend/routers/admin.py` with the rating sync function**

```python
# backend/routers/admin.py
import csv
import io
import json
import logging
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db, async_session
from models import Movie, TVShow, Genre, ShowGenre
from api.trakt import trakt_client
from api.telegram import send_telegram

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


async def sync_ratings_nightly() -> None:
    """
    Update TMDb + Trakt ratings for all movies and shows.
    Alert via Telegram if any rating drops >2 points in one cycle.
    """
    from api.tmdb import tmdb_client

    async with async_session() as db:
        # --- Movies ---
        movie_result = await db.execute(select(Movie))
        movies = movie_result.scalars().all()

        for movie in movies:
            try:
                data = await tmdb_client.get_movie(movie.tmdb_id)
                new_tmdb = data.get("vote_average")
                new_popularity = data.get("popularity", movie.popularity)
                new_runtime = data.get("runtime", movie.runtime)

                if new_tmdb and movie.rating_tmdb:
                    drop = movie.rating_tmdb - new_tmdb
                    if drop > 2.0:
                        await send_telegram(
                            f"⚠️ <b>Rating Drop Alert</b>\n"
                            f"Movie: {movie.title} ({movie.nexus_id})\n"
                            f"TMDb: {movie.rating_tmdb:.1f} → {new_tmdb:.1f} (drop: {drop:.1f})"
                        )

                movie.rating_tmdb = new_tmdb
                movie.popularity = new_popularity
                movie.runtime = new_runtime

                # Check IMDb ID change
                ext_imdb = data.get("imdb_id")
                if ext_imdb and movie.imdb_id and ext_imdb != movie.imdb_id:
                    await send_telegram(
                        f"⚠️ <b>IMDb ID Change</b>\n"
                        f"Movie: {movie.title} ({movie.nexus_id})\n"
                        f"{movie.imdb_id} → {ext_imdb}"
                    )
                    movie.imdb_id = ext_imdb

            except Exception as e:
                logger.warning(f"Rating sync failed for {movie.nexus_id}: {e}")

        # --- TV Shows ---
        show_result = await db.execute(select(TVShow))
        shows = show_result.scalars().all()

        for show in shows:
            try:
                data = await tmdb_client.get_tv(show.tmdb_id)
                new_tmdb = data.get("vote_average")
                new_popularity = data.get("popularity", show.popularity)
                new_seasons = data.get("number_of_seasons", show.number_of_seasons)
                new_episodes = data.get("number_of_episodes", show.number_of_episodes)
                new_last_air = data.get("last_air_date")

                if new_tmdb and show.rating_tmdb:
                    drop = show.rating_tmdb - new_tmdb
                    if drop > 2.0:
                        await send_telegram(
                            f"⚠️ <b>Rating Drop Alert</b>\n"
                            f"Show: {show.title} ({show.nexus_id})\n"
                            f"TMDb: {show.rating_tmdb:.1f} → {new_tmdb:.1f} (drop: {drop:.1f})"
                        )

                show.rating_tmdb = new_tmdb
                show.popularity = new_popularity
                show.number_of_seasons = new_seasons
                show.number_of_episodes = new_episodes

                from routers.imports import _parse_date
                if new_last_air:
                    show.last_air_date = _parse_date(new_last_air)

            except Exception as e:
                logger.warning(f"Rating sync failed for {show.nexus_id}: {e}")

        await db.commit()

    logger.info("Nightly rating sync complete")
```

- [ ] **Step 2: Commit**

```bash
git add backend/routers/admin.py
git commit -m "feat: nightly rating sync — TMDb update, drop >2pt alert, IMDb ID change alert"
```

---

## Task 8: Artwork verification — SHA-256 + Pillow dimensions

**Files:**
- Modify: `backend/routers/admin.py`
- Modify: `backend/routers/imports.py`
- Modify: `requirements.txt`

- [ ] **Step 1: Add Pillow to requirements.txt**

```
Pillow==10.3.0
```

- [ ] **Step 2: Add `_verify_and_hash_artwork()` helper in `imports.py`**

Add these imports at the top of `imports.py`:

```python
import hashlib
import io as _io

import httpx
```

Then add the helper function after `_upsert_studio()`:

```python
async def _verify_and_hash_artwork(artwork_obj, min_width: int = 0, min_height: int = 0) -> bool:
    """
    Download image, compute SHA-256 hash, check dimensions.
    Mutates artwork_obj.hash, artwork_obj.width, artwork_obj.height.
    Returns False if image fails dimension check (too small).
    """
    try:
        from PIL import Image

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(artwork_obj.url)
            resp.raise_for_status()
            image_bytes = resp.content

        artwork_obj.hash = hashlib.sha256(image_bytes).hexdigest()

        img = Image.open(_io.BytesIO(image_bytes))
        artwork_obj.width, artwork_obj.height = img.size

        if min_width and artwork_obj.width < min_width:
            return False
        if min_height and artwork_obj.height < min_height:
            return False
        return True
    except Exception as e:
        logger.debug(f"Artwork verification skipped for {artwork_obj.url}: {e}")
        return True  # don't reject on network error — best-effort only
```

Note: calling `_verify_and_hash_artwork()` on every import would be very slow (one HTTP request per image). Hash verification is therefore called only by the admin endpoint below, not during bulk import.

- [ ] **Step 3: Add admin artwork verify endpoint to `admin.py`**

Add to `backend/routers/admin.py` after the `sync_ratings_nightly` function:

```python
@router.get("/artwork/verify")
async def verify_artwork(
    media_type: str = Query("movie", regex="^(movie|show)$"),
    sample: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Sample N random artwork records, download each, check SHA-256 hash and dimensions.
    Returns list of {id, url, hash, width, height, valid, reason}.
    Posters: min 500×750px. Backdrops: min 1280×720px.
    """
    import hashlib
    import io as _io
    import random

    import httpx
    from PIL import Image

    from models import Artwork

    result = await db.execute(
        select(Artwork).where(Artwork.media_type == media_type)
    )
    all_artwork = result.scalars().all()
    if not all_artwork:
        return []

    sampled = random.sample(all_artwork, min(sample, len(all_artwork)))
    output = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        for art in sampled:
            entry: dict = {"id": art.id, "url": art.url, "type": art.type}
            try:
                resp = await client.get(art.url)
                resp.raise_for_status()
                image_bytes = resp.content
                art.hash = hashlib.sha256(image_bytes).hexdigest()
                img = Image.open(_io.BytesIO(image_bytes))
                art.width, art.height = img.size

                valid = True
                reason = "ok"
                if art.type == "poster" and (art.width < 500 or art.height < 750):
                    valid = False
                    reason = f"undersized poster: {art.width}×{art.height} (min 500×750)"
                elif art.type == "backdrop" and (art.width < 1280 or art.height < 720):
                    valid = False
                    reason = f"undersized backdrop: {art.width}×{art.height} (min 1280×720)"

                entry.update({"hash": art.hash, "width": art.width, "height": art.height,
                               "valid": valid, "reason": reason})
            except Exception as e:
                entry.update({"hash": None, "width": None, "height": None,
                               "valid": False, "reason": str(e)})
            output.append(entry)

    await db.commit()  # persist hash/width/height updates
    return output
```

- [ ] **Step 4: Commit**

```bash
git add backend/routers/admin.py backend/routers/imports.py requirements.txt
git commit -m "feat: artwork verification endpoint — SHA-256 hash, Pillow dimensions, admin spot-check"
```

---

## Task 9: Admin export + nightly backup

**Files:**
- Modify: `backend/routers/admin.py`

The existing `/api/export` endpoint lives in `routers/export.py`. We add `/api/admin/export` with identical logic plus nightly backup support. The old export router stays for backward compatibility.

- [ ] **Step 1: Add export data helpers and the admin export endpoint to `admin.py`**

Add these imports at the top of `admin.py` (after existing imports):

```python
import csv
import io
import json
import xml.etree.ElementTree as ET
from pathlib import Path
```

Then add after the artwork verify endpoint:

```python
async def _build_export_data(db: AsyncSession, media: str) -> list[dict]:
    """Shared export logic for movies and shows."""
    if media == "movies":
        result = await db.execute(
            select(Movie).options(selectinload(Movie.genres)).order_by(Movie.title)
        )
        rows = result.scalars().all()
        return [
            {
                "nexus_id": m.nexus_id, "tmdb_id": m.tmdb_id, "imdb_id": m.imdb_id,
                "title": m.title, "release_date": str(m.release_date) if m.release_date else None,
                "runtime": m.runtime, "rating_tmdb": m.rating_tmdb, "rating_imdb": m.rating_imdb,
                "rating_trakt": m.rating_trakt, "popularity": m.popularity,
                "genres": [g.name for g in m.genres],
            }
            for m in rows
        ]
    else:
        result = await db.execute(
            select(TVShow).options(selectinload(TVShow.show_genres)).order_by(TVShow.title)
        )
        rows = result.scalars().all()
        return [
            {
                "nexus_id": s.nexus_id, "tmdb_id": s.tmdb_id, "tvdb_id": s.tvdb_id,
                "imdb_id": s.imdb_id, "title": s.title,
                "first_air_date": str(s.first_air_date) if s.first_air_date else None,
                "status": s.status, "seasons": s.number_of_seasons,
                "episodes": s.number_of_episodes, "rating_tmdb": s.rating_tmdb,
                "rating_imdb": s.rating_imdb, "rating_trakt": s.rating_trakt,
                "popularity": s.popularity, "genres": [g.name for g in s.show_genres],
            }
            for s in rows
        ]


def _to_json(data: list[dict]) -> bytes:
    return json.dumps(data, indent=4, default=str).encode()


def _to_csv(data: list[dict]) -> bytes:
    output = io.StringIO()
    if data:
        flat = [{k: ("|".join(v) if k == "genres" else v) for k, v in item.items()} for item in data]
        writer = csv.DictWriter(output, fieldnames=flat[0].keys())
        writer.writeheader()
        writer.writerows(flat)
    return output.getvalue().encode()


def _to_xml(data: list[dict], media: str) -> bytes:
    root = ET.Element("movienexus", type=media)
    for item in data:
        elem = ET.SubElement(root, "movie" if media == "movies" else "show")
        for key, val in item.items():
            if key == "genres":
                genres_elem = ET.SubElement(elem, "genres")
                for g in val:
                    ET.SubElement(genres_elem, "genre").text = g
            else:
                ET.SubElement(elem, key).text = str(val) if val is not None else ""
    return ET.tostring(root, encoding="unicode", xml_declaration=True).encode()


@router.get("/export")
async def admin_export(
    format: str = Query("json", regex="^(json|csv|xml)$"),
    type: str = Query("movies", regex="^(movies|shows)$"),
    db: AsyncSession = Depends(get_db),
):
    data = await _build_export_data(db, type)
    if format == "json":
        content = _to_json(data)
        media_type = "application/json"
    elif format == "csv":
        content = _to_csv(data)
        media_type = "text/csv"
    else:
        content = _to_xml(data, type)
        media_type = "application/xml"

    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename=movienexus_{type}.{format}"},
    )


async def run_nightly_backup() -> None:
    """
    Export all movies + shows to JSON + CSV + XML.
    Save to /opt/movienexus/backups/YYYY-MM-DD/.
    Send Telegram confirmation when done.
    """
    today = date.today().isoformat()
    backup_dir = Path(f"/opt/movienexus/backups/{today}")
    backup_dir.mkdir(parents=True, exist_ok=True)

    async with async_session() as db:
        for media in ("movies", "shows"):
            data = await _build_export_data(db, media)
            (backup_dir / f"{media}.json").write_bytes(_to_json(data))
            (backup_dir / f"{media}.csv").write_bytes(_to_csv(data))
            (backup_dir / f"{media}.xml").write_bytes(_to_xml(data, media))

    await send_telegram(
        f"✅ <b>MovieNexus Nightly Backup Complete</b>\n"
        f"Date: {today}\n"
        f"Path: /opt/movienexus/backups/{today}/\n"
        f"Files: movies.json, movies.csv, movies.xml, shows.json, shows.csv, shows.xml"
    )
    logger.info(f"Nightly backup written to {backup_dir}")
```

- [ ] **Step 2: Commit**

```bash
git add backend/routers/admin.py
git commit -m "feat: admin export endpoint + nightly_backup function (JSON/CSV/XML, Telegram confirmation)"
```

---

## Task 10: Scheduler setup — wire all cron jobs

**Files:**
- Create: `backend/scheduler.py`
- Modify: `requirements.txt`
- Modify: `backend/main.py`

- [ ] **Step 1: Add APScheduler to requirements.txt**

Add to `requirements.txt`:
```
APScheduler==3.10.4
```

- [ ] **Step 2: Create `backend/scheduler.py`**

```python
# backend/scheduler.py
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def setup_scheduler() -> None:
    """Register all cron jobs. Call once at app startup."""

    # 2am daily — trending sync (all 3 windows)
    scheduler.add_job(
        _trending_sync_job,
        CronTrigger(hour=2, minute=0),
        id="trending_sync",
        name="Trending sync",
        replace_existing=True,
    )

    # 3am daily — nightly rating sync + backup
    scheduler.add_job(
        _nightly_sync_job,
        CronTrigger(hour=3, minute=0),
        id="nightly_sync",
        name="Nightly rating sync + backup",
        replace_existing=True,
    )

    # 8am daily — Telegram daily trending summary
    scheduler.add_job(
        _trending_summary_job,
        CronTrigger(hour=8, minute=0),
        id="trending_summary",
        name="Telegram daily trending summary",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler started (trending@2am, ratings+backup@3am, summary@8am)")


async def _trending_sync_job() -> None:
    logger.info("Running trending sync...")
    from routers.trending import sync_trending_all_windows
    await sync_trending_all_windows()


async def _nightly_sync_job() -> None:
    logger.info("Running nightly rating sync...")
    from routers.admin import sync_ratings_nightly, run_nightly_backup
    await sync_ratings_nightly()
    await run_nightly_backup()


async def _trending_summary_job() -> None:
    logger.info("Sending daily trending summary...")
    from routers.trending import send_daily_trending_summary
    await send_daily_trending_summary()
```

- [ ] **Step 3: Wire scheduler into `main.py` lifespan**

In `backend/main.py`, add the scheduler import and update the lifespan:

```python
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from config import get_settings
from database import engine, Base, async_session
from api.tmdb import tmdb_client
from api.fanart import fanart_client
from scheduler import scheduler, setup_scheduler
from routers import movies, shows, imports, search, export, stats
from routers import trending, admin
from nexus_id import ensure_counter_table

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("movienexus")


def _read_version() -> str:
    try:
        return Path("/app/../VERSION").read_text().strip()
    except FileNotFoundError:
        return "0.3.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("MovieNexus starting up...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session() as db:
        await ensure_counter_table(db)
    setup_scheduler()
    logger.info("Database tables ready")
    yield
    scheduler.shutdown(wait=False)
    await tmdb_client.close()
    await fanart_client.close()
    await engine.dispose()
    logger.info("MovieNexus shut down")


settings = get_settings()

app = FastAPI(
    title="MovieNexus",
    description="Movie & TV show database with multi-source ratings and artwork",
    version=_read_version(),
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Legacy ID redirect: /movies/ms-0000001 → /movies/ms1
import re as _re
_LEGACY_ID_PATTERN = _re.compile(r"^(/api)?(/(movies|shows|tv_shows)/)([a-z]+-\d+)$")

@app.middleware("http")
async def legacy_id_redirect(request: Request, call_next):
    path = request.url.path
    m = _LEGACY_ID_PATTERN.match(path)
    if m:
        prefix, _, resource, old_id = m.group(1), m.group(2), m.group(3), m.group(4)
        # ms-0000001 → ms1  (strip dash and leading zeros)
        new_id = _re.sub(r"-0*(\d+)$", lambda x: x.group(1), old_id)
        if new_id != old_id:
            new_path = f"/api/{resource}/{new_id}"
            return RedirectResponse(url=new_path, status_code=301)
    return await call_next(request)


app.include_router(movies.router, prefix="/api")
app.include_router(shows.router, prefix="/api")
app.include_router(imports.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(trending.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": _read_version()}
```

- [ ] **Step 4: Commit**

```bash
git add backend/scheduler.py backend/main.py requirements.txt
git commit -m "feat: APScheduler cron jobs (2am trending, 3am ratings+backup, 8am summary) + legacy ID redirect"
```

---

## Task 11: Legacy ID migration script

**Files:**
- Create: `scripts/migrate_nexus_ids.py`

This script is only needed if the DB has existing `ms-0000001` format IDs. Run once on the server after deploying the new code.

- [ ] **Step 1: Create `scripts/migrate_nexus_ids.py`**

```python
#!/usr/bin/env python3
"""
One-time migration: convert ms-0000001 → ms1 format for all nexus_ids.
Run ONCE after deploying the Data Platform v2 code on an existing database.
Safe to run on an empty database — will simply do nothing.

Usage:
    cd /opt/movienexus && docker exec -it movienexus-backend python scripts/migrate_nexus_ids.py
"""
import asyncio
import re
import sys

sys.path.insert(0, "/app")

from sqlalchemy import text
from database import engine

LEGACY_PATTERN = re.compile(r"^([a-z]+)-0*(\d+)$")


def convert_id(old_id: str) -> str:
    """ms-0000550 → ms550"""
    m = LEGACY_PATTERN.match(old_id)
    if m:
        return f"{m.group(1)}{int(m.group(2))}"
    return old_id  # already new format or unknown


async def migrate():
    tables = [
        ("movies", "nexus_id"),
        ("tv_shows", "nexus_id"),
        ("episodes", "nexus_id"),
    ]

    async with engine.begin() as conn:
        for table, col in tables:
            result = await conn.execute(text(f"SELECT id, {col} FROM {table}"))
            rows = result.fetchall()
            updated = 0
            for row_id, nexus_id in rows:
                new_id = convert_id(nexus_id)
                if new_id != nexus_id:
                    await conn.execute(
                        text(f"UPDATE {table} SET {col} = :new WHERE id = :id"),
                        {"new": new_id, "id": row_id},
                    )
                    updated += 1
            print(f"{table}: {updated} IDs updated out of {len(rows)} rows")

    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
```

- [ ] **Step 2: Commit**

```bash
git add scripts/migrate_nexus_ids.py
git commit -m "feat: one-time nexus_id migration script (ms-0000001 → ms1)"
```

---

## Task 12: Deploy to server2 + smoke test

- [ ] **Step 1: Push all commits to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Pull and rebuild on server2**

```bash
ssh server2 "cd /opt/movienexus && git pull && docker compose up -d --build backend"
```

- [ ] **Step 3: Verify containers are healthy**

```bash
ssh server2 "docker compose -f /opt/movienexus/docker-compose.yml ps"
```

Expected: `movienexus-backend` shows `Up` status.

- [ ] **Step 4: Check startup logs for scheduler**

```bash
ssh server2 "docker logs movienexus-backend --tail 30"
```

Expected lines:
```
Database tables ready
Scheduler started (trending@2am, ratings+backup@3am, summary@8am)
```

- [ ] **Step 5: Smoke test new endpoints**

```bash
# Trending endpoint
curl https://movienexus.e4z.xyz/api/trending?media_type=movie&window=daily

# Admin export
curl -o /tmp/movies.json "https://movienexus.e4z.xyz/api/admin/export?format=json&type=movies"

# Legacy redirect
curl -v "https://movienexus.e4z.xyz/api/movies/ms-0000001" 2>&1 | grep -E "HTTP|location"
```

Expected for legacy redirect: `301` with `Location: /api/movies/ms1`

- [ ] **Step 6: Trigger bulk import (50k movies)**

```bash
curl -X POST "https://movienexus.e4z.xyz/api/import/bulk/start?media_type=movie&pages=2500"
```

Expected: `{"session_id": N, "message": "Bulk movie crawl started (2500 pages, ~50,000 titles)"}`

- [ ] **Step 7: Update VERSION and CHANGELOG**

```
VERSION: 0.3.0
CHANGELOG: ## [0.3.0] — 2026-04-27 with all Data Platform v2 features listed
```

```bash
git add VERSION CHANGELOG.md
git commit -m "chore: bump to v0.3.0 — Data Platform v2"
git push origin main
```

---

## Spec Coverage Check

| Spec Section | Task(s) |
|---|---|
| ID Reform — new format, 11 types | Task 1 |
| ID Reform — migration script | Task 11 |
| ID Reform — legacy redirect | Task 10 (main.py middleware) |
| Bulk ingestion — Phase 1 (50k movies, 20k shows) | Task 4 |
| Bulk ingestion — Phase 2 (on-demand hydration) | Not in this plan — spec excluded it from endpoints |
| Bulk ingestion — Phase 3 (nightly sync) | Task 10 (scheduler) + Task 7 |
| Telegram every 10k + final | Task 4 |
| Artwork 3-layer verification | Task 8 |
| DB export on-demand + nightly | Task 9 |
| 30-day backup retention | Not implemented — use `find /opt/movienexus/backups -mtime +30 -delete` in a cron or add to backup script |
| TrendingSnapshot table | Task 2 |
| Trending sync schedule (2am) | Task 10 |
| Trending sources: Trakt for movies/shows | Task 5, 6 |
| GET /api/trending endpoint | Task 6 |
| Daily 8am Telegram trending summary | Task 6, 10 |
| Multi-source rating sync nightly | Task 7, 10 |
| Rating drop >2 pts alert | Task 7 |
| IMDb ID change alert | Task 7 |
| Weekly Sunday rating movers summary | Not implemented — add as enhancement after v0.3.0 |
| APScheduler cron wiring | Task 10 |

**Two deferred items noted above (30-day retention cleanup, weekly movers summary) — add as follow-up tasks after v0.3.0 ships.**
