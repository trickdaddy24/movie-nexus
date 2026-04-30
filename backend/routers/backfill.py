import asyncio
import json
import logging
import time

from fastapi import APIRouter, Depends, Query
from sse_starlette.sse import EventSourceResponse
from sqlalchemy import select, func

from api.tmdb import tmdb_client
from api.fanart import fanart_client
from api.telegram import send_telegram
from database import async_session
from dependencies import require_admin_key
from models import Movie, TVShow, Artwork

router = APIRouter(prefix="/admin/backfill", tags=["backfill"], dependencies=[Depends(require_admin_key)])
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


# ── Artwork backfill ──────────────────────────────────────────────

_artwork_jobs: dict[str, dict] = {}


async def _run_artwork_backfill(media_type: str):
    progress = _artwork_jobs[media_type]
    progress["status"] = "running"
    updated = 0
    failed = 0
    last_telegram = time.monotonic()

    async with async_session() as db:
        # Find items that have zero artwork rows
        if media_type == "show":
            art_count = (
                select(Artwork.media_id)
                .where(Artwork.media_type == "show")
                .group_by(Artwork.media_id)
            ).subquery()
            result = await db.execute(
                select(TVShow).where(TVShow.id.notin_(select(art_count.c.media_id)))
            )
            items = result.scalars().all()
        else:
            art_count = (
                select(Artwork.media_id)
                .where(Artwork.media_type == "movie")
                .group_by(Artwork.media_id)
            ).subquery()
            result = await db.execute(
                select(Movie).where(Movie.id.notin_(select(art_count.c.media_id)))
            )
            items = result.scalars().all()

        progress["total"] = len(items)
        logger.info(f"Artwork backfill {media_type}: {len(items)} records missing artwork")

        await send_telegram(
            f"<b>Artwork Backfill Started</b>\n"
            f"Type: {media_type}\n"
            f"Records to process: {len(items):,}"
        )

        for i, item in enumerate(items):
            progress["processed"] = i + 1
            try:
                if media_type == "show":
                    # TMDb backdrops + posters
                    data = await tmdb_client.get_tv(item.tmdb_id)
                    for img in data.get("images", {}).get("posters", [])[:5]:
                        db.add(Artwork(
                            media_type="show", media_id=item.id, source="tmdb",
                            type="poster",
                            url=f"https://image.tmdb.org/t/p/original{img['file_path']}",
                            language=img.get("iso_639_1"),
                        ))
                    for img in data.get("images", {}).get("backdrops", [])[:5]:
                        db.add(Artwork(
                            media_type="show", media_id=item.id, source="tmdb",
                            type="backdrop",
                            url=f"https://image.tmdb.org/t/p/original{img['file_path']}",
                            language=img.get("iso_639_1"),
                        ))
                    # Fanart.tv (needs TVDB ID)
                    tvdb_id = data.get("external_ids", {}).get("tvdb_id") or item.tvdb_id
                    if tvdb_id:
                        try:
                            fanart_data = await fanart_client.get_tv_images(tvdb_id)
                            for art in fanart_client.parse_images(fanart_data, "show")[:10]:
                                db.add(Artwork(media_type="show", media_id=item.id, **art))
                        except Exception:
                            pass
                else:
                    data = await tmdb_client.get_movie(item.tmdb_id)
                    for img in data.get("images", {}).get("posters", [])[:5]:
                        db.add(Artwork(
                            media_type="movie", media_id=item.id, source="tmdb",
                            type="poster",
                            url=f"https://image.tmdb.org/t/p/original{img['file_path']}",
                            language=img.get("iso_639_1"),
                        ))
                    for img in data.get("images", {}).get("backdrops", [])[:5]:
                        db.add(Artwork(
                            media_type="movie", media_id=item.id, source="tmdb",
                            type="backdrop",
                            url=f"https://image.tmdb.org/t/p/original{img['file_path']}",
                            language=img.get("iso_639_1"),
                        ))
                    try:
                        fanart_data = await fanart_client.get_movie_images(item.tmdb_id)
                        for art in fanart_client.parse_images(fanart_data, "movie")[:10]:
                            db.add(Artwork(media_type="movie", media_id=item.id, **art))
                    except Exception:
                        pass

                await db.commit()
                updated += 1
            except Exception as e:
                failed += 1
                logger.warning(f"Artwork backfill failed for {media_type} tmdb_id={item.tmdb_id}: {e}")
                await asyncio.sleep(0.1)
                continue

            # Throttled Telegram: max once every 10 minutes
            now = time.monotonic()
            if now - last_telegram >= 600:
                last_telegram = now
                await send_telegram(
                    f"<b>Artwork Backfill Progress</b>\n"
                    f"Type: {media_type}\n"
                    f"Progress: {i + 1:,}/{len(items):,}\n"
                    f"Updated: {updated:,} | Failed: {failed:,}"
                )

            await asyncio.sleep(0.05)

    progress["processed"] = progress["total"]
    progress["updated"] = updated
    progress["failed"] = failed
    progress["status"] = "completed"
    logger.info(f"Artwork backfill {media_type} complete: {updated} updated, {failed} failed")

    await send_telegram(
        f"<b>Artwork Backfill Complete</b>\n"
        f"Type: {media_type}\n"
        f"Total: {len(items):,}\n"
        f"Updated: {updated:,}\n"
        f"Failed: {failed:,}"
    )


@router.post("/artwork")
async def start_artwork_backfill(
    media_type: str = Query("show", regex="^(movie|show)$"),
):
    key = f"artwork_{media_type}"
    if key in _artwork_jobs and _artwork_jobs[key].get("status") == "running":
        return {"message": f"Artwork backfill for {media_type} already running"}

    _artwork_jobs[key] = {
        "status": "starting",
        "total": 0,
        "processed": 0,
        "updated": 0,
        "failed": 0,
    }
    asyncio.create_task(_run_artwork_backfill(media_type))
    return {"message": f"Artwork backfill started for {media_type}"}


@router.get("/artwork/progress")
async def artwork_backfill_progress_sse(
    media_type: str = Query("show", regex="^(movie|show)$"),
):
    key = f"artwork_{media_type}"

    async def event_stream():
        while True:
            progress = _artwork_jobs.get(key)
            if not progress:
                yield {"event": "progress", "data": json.dumps({"status": "not_started"})}
                break
            yield {"event": "progress", "data": json.dumps(progress)}
            if progress.get("status") == "completed":
                break
            await asyncio.sleep(1)

    return EventSourceResponse(event_stream())
