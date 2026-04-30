# backend/routers/trending.py
import logging
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, async_session
from dependencies import require_read_key
from models import Movie, TVShow, TrendingSnapshot
from api.trakt import trakt_client
from api.telegram import send_telegram

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trending", tags=["Trending"], dependencies=[Depends(require_read_key)])


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
