import asyncio
import json
import logging

from fastapi import APIRouter, Query
from sse_starlette.sse import EventSourceResponse
from sqlalchemy import select

from api.tmdb import tmdb_client
from database import async_session
from models import Movie, TVShow

router = APIRouter(prefix="/admin/backfill", tags=["backfill"])
logger = logging.getLogger("movienexus.backfill")

# Active backfill progress: keyed by media_type
_backfill_jobs: dict[str, dict] = {}


async def _run_backfill(media_type: str):
    progress = _backfill_jobs[media_type]
    progress["status"] = "running"
    updated = 0
    failed = 0

    async with async_session() as db:
        if media_type == "movie":
            result = await db.execute(
                select(Movie).where(Movie.origin_country.is_(None))
            )
            items = result.scalars().all()
        else:
            result = await db.execute(
                select(TVShow).where(TVShow.origin_country.is_(None))
            )
            items = result.scalars().all()

        progress["total"] = len(items)
        logger.info(f"Backfill {media_type}: {len(items)} records to update")

        for i, item in enumerate(items):
            progress["processed"] = i
            try:
                if media_type == "movie":
                    data = await tmdb_client.get_movie(item.tmdb_id)
                    # TMDb /movie/{id} returns production_countries as list of dicts
                    countries = ",".join(
                        c["iso_3166_1"] for c in data.get("production_countries", [])
                    )
                    item.origin_country = countries if countries else None
                    lang = data.get("original_language", "")
                    item.original_language = lang if lang else None
                else:
                    data = await tmdb_client.get_tv(item.tmdb_id)
                    # TMDb /tv/{id} returns origin_country as flat list of strings
                    countries = ",".join(data.get("origin_country", []))
                    item.origin_country = countries if countries else None
                    lang = data.get("original_language", "")
                    item.original_language = lang if lang else None

                await db.commit()
                updated += 1
            except Exception as e:
                failed += 1
                logger.warning(f"Backfill failed for {media_type} tmdb_id={item.tmdb_id}: {e}")
                await asyncio.sleep(0.1)
                continue

            await asyncio.sleep(0.05)  # rate-limit TMDb

    progress["processed"] = progress["total"]
    progress["updated"] = updated
    progress["failed"] = failed
    progress["status"] = "completed"
    logger.info(f"Backfill {media_type} complete: {updated} updated, {failed} failed")


@router.post("/origin")
async def start_backfill(
    media_type: str = Query("movie", regex="^(movie|show)$"),
):
    if media_type in _backfill_jobs and _backfill_jobs[media_type].get("status") == "running":
        return {"message": f"Backfill for {media_type} already running"}

    _backfill_jobs[media_type] = {
        "status": "starting",
        "total": 0,
        "processed": 0,
        "updated": 0,
        "failed": 0,
    }
    asyncio.create_task(_run_backfill(media_type))
    return {"message": f"Backfill started for {media_type}"}


@router.get("/origin/progress")
async def backfill_progress_sse(
    media_type: str = Query("movie", regex="^(movie|show)$"),
):
    async def event_stream():
        while True:
            progress = _backfill_jobs.get(media_type)
            if not progress:
                yield {"event": "progress", "data": json.dumps({"status": "not_started"})}
                break
            yield {"event": "progress", "data": json.dumps(progress)}
            if progress.get("status") == "completed":
                break
            await asyncio.sleep(1)

    return EventSourceResponse(event_stream())
