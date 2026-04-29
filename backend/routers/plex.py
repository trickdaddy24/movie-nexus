import asyncio
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, case
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from database import get_db, async_session
from models import (
    Movie, TVShow, Artwork, ExternalID, ImportSession, ImportLog, Genre, ShowGenre,
)
from api.plex import plex_client
from api.tmdb import tmdb_client
from api.telegram import send_telegram
from routers.imports import _import_single_movie, _import_single_show

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/plex", tags=["Plex"])

_active_jobs: dict[int, dict] = {}


def _make_progress() -> dict:
    """Create a fresh progress dict with per-library + activity feed support."""
    return {
        "imported": 0, "skipped": 0, "failed": 0, "total": 0,
        "current_title": "", "status": "running",
        "libraries": [],
        "activity": [],
    }


def _append_activity(progress: dict, title: str, action: str, library: str, media_type: str):
    """Append an item to the activity feed, capped at 200."""
    progress["activity"].append({
        "title": title, "action": action, "library": library, "type": media_type,
    })
    if len(progress["activity"]) > 200:
        progress["activity"] = progress["activity"][-200:]


def _fmt_duration(seconds: int) -> str:
    """Format seconds as e.g. '4m 23s' or '1h 12m'."""
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        return f"{seconds // 60}m {seconds % 60}s"
    h = seconds // 3600
    m = (seconds % 3600) // 60
    return f"{h}h {m}m"


# ── Schemas ──

class PlexSyncRequest(BaseModel):
    library_key: str | None = None

class PlexRefreshRequest(BaseModel):
    media_type: str = "movie"
    nexus_ids: list[str] | None = None


# ── Status ──

@router.get("/status")
async def plex_status(db: AsyncSession = Depends(get_db)):
    if not plex_client.configured:
        return {"configured": False, "url": "", "libraries": [], "last_sync": None}

    libraries = []
    try:
        libraries = await plex_client.get_libraries()
    except Exception as e:
        logger.warning(f"Plex connectivity check failed: {e}")
        return {
            "configured": True,
            "url": plex_client.base_url,
            "libraries": [],
            "last_sync": None,
            "error": str(e),
        }

    # Last successful Plex sync
    result = await db.execute(
        select(ImportSession)
        .where(ImportSession.source == "plex", ImportSession.status == "completed")
        .order_by(ImportSession.finished_at.desc())
        .limit(1)
    )
    last_session = result.scalar_one_or_none()

    return {
        "configured": True,
        "url": plex_client.base_url,
        "libraries": libraries,
        "last_sync": last_session.finished_at.isoformat() if last_session and last_session.finished_at else None,
    }


# ── Full Library Sync ──

@router.post("/sync")
async def start_plex_sync(body: PlexSyncRequest, db: AsyncSession = Depends(get_db)):
    if not plex_client.configured:
        return {"error": "Plex not configured. Set PLEX_URL and PLEX_TOKEN in .env"}

    session = ImportSession(
        source="plex",
        media_type="all",
        started_at=datetime.now(timezone.utc),
        status="running",
        total=0, imported=0, skipped=0, failed=0,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    progress = _make_progress()
    _active_jobs[session.id] = progress

    asyncio.create_task(_run_plex_sync(session.id, body.library_key))
    return {"session_id": session.id, "message": "Plex sync started"}


# ── Refresh Metadata / Artwork ──

@router.post("/refresh")
async def start_plex_refresh(body: PlexRefreshRequest, db: AsyncSession = Depends(get_db)):
    if not plex_client.configured:
        return {"error": "Plex not configured. Set PLEX_URL and PLEX_TOKEN in .env"}

    session = ImportSession(
        source="plex_refresh",
        media_type=body.media_type,
        started_at=datetime.now(timezone.utc),
        status="running",
        total=0, imported=0, skipped=0, failed=0,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    progress = _make_progress()
    _active_jobs[session.id] = progress

    asyncio.create_task(_run_plex_refresh(session.id, body.media_type, body.nexus_ids))
    return {"session_id": session.id, "message": "Plex refresh started"}


# ── SSE Progress ──

@router.get("/progress/{session_id}")
async def plex_progress(session_id: int):
    async def stream():
        last_activity_len = 0
        while True:
            progress = _active_jobs.get(session_id)
            if progress is None:
                yield {"event": "error", "data": json.dumps({"status": "not_found"})}
                return

            # Main progress tick (includes libraries)
            payload = {
                "imported": progress["imported"],
                "skipped": progress["skipped"],
                "failed": progress["failed"],
                "total": progress["total"],
                "current_title": progress["current_title"],
                "status": progress["status"],
                "libraries": progress.get("libraries", []),
            }
            yield {"event": "progress", "data": json.dumps(payload)}

            # Send new activity items since last tick (delta only)
            activity = progress.get("activity", [])
            if len(activity) > last_activity_len:
                new_items = activity[last_activity_len:]
                yield {"event": "items", "data": json.dumps(new_items)}
                last_activity_len = len(activity)

            if progress.get("status") == "completed":
                yield {"event": "complete", "data": json.dumps(payload)}
                return
            await asyncio.sleep(1)

    return EventSourceResponse(stream())


# ── Sync History ──

@router.get("/history")
async def plex_sync_history(
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ImportSession)
        .where(ImportSession.source.in_(["plex", "plex_refresh"]))
        .order_by(ImportSession.started_at.desc())
        .limit(limit)
    )
    sessions = result.scalars().all()
    return [{
        "id": s.id,
        "source": s.source,
        "media_type": s.media_type,
        "status": s.status,
        "total": s.total or 0,
        "imported": s.imported or 0,
        "skipped": s.skipped or 0,
        "failed": s.failed or 0,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "finished_at": s.finished_at.isoformat() if s.finished_at else None,
        "duration_seconds": int((s.finished_at - s.started_at).total_seconds()) if s.finished_at and s.started_at else None,
    } for s in sessions]


# ── Sync Logic ──

async def _run_plex_sync(session_id: int, library_key: str | None):
    """Scan Plex libraries, match/import items, fill gaps, pull artwork."""
    progress = _active_jobs[session_id]
    sync_start = datetime.now(timezone.utc)

    async with async_session() as db:
        try:
            libraries = await plex_client.get_libraries()
            if library_key:
                libraries = [lib for lib in libraries if lib["key"] == library_key]

            # Filter to movie/show only
            libraries = [lib for lib in libraries if lib["type"] in ("movie", "show")]

            # Initialize per-library tracking
            for lib in libraries:
                progress["libraries"].append({
                    "key": lib["key"],
                    "title": lib["title"],
                    "type": lib["type"],
                    "status": "queued",
                    "total": 0, "imported": 0, "skipped": 0, "failed": 0,
                })

            # Telegram: sync started
            lib_names = ", ".join(lib["title"] for lib in libraries)
            await send_telegram(
                f"<b>Plex Sync Started</b>\n"
                f"Libraries: {lib_names} ({len(libraries)})"
            )

            for lib_idx, lib in enumerate(libraries):
                lib_type = lib["type"]
                lib_progress = progress["libraries"][lib_idx]
                lib_progress["status"] = "scanning"

                logger.info(f"Plex sync: scanning library '{lib['title']}' ({lib_type})")
                items = await plex_client.get_all_items(lib["key"])
                lib_progress["total"] = len(items)
                lib_progress["status"] = "syncing"
                progress["total"] += len(items)

                for item in items:
                    title = item.get("title", "Unknown")
                    try:
                        progress["current_title"] = title
                        guids = item.get("Guid", [])

                        before = (progress["imported"], progress["skipped"], progress["failed"])

                        if lib_type == "movie":
                            await _sync_single_movie(db, item, guids, progress)
                        else:
                            await _sync_single_show(db, item, guids, progress)

                        after = (progress["imported"], progress["skipped"], progress["failed"])
                        if after[0] > before[0]:
                            action = "imported"
                        elif after[2] > before[2]:
                            action = "failed"
                        else:
                            action = "skipped"

                    except Exception as e:
                        progress["failed"] += 1
                        action = "failed"
                        err = f"{type(e).__name__}: {e}"
                        logger.error(f"Plex sync failed for '{title}': {err}")
                        try:
                            db.add(ImportLog(
                                session_id=session_id,
                                media_type=lib_type,
                                level="error",
                                message=f"{title}: {err}",
                            ))
                            await db.commit()
                        except Exception:
                            pass

                    # Update per-library counters
                    lib_progress[action] += 1
                    _append_activity(progress, title, action, lib["title"], lib_type)

                    await asyncio.sleep(0.15)

                lib_progress["status"] = "done"

            # Finalize session
            session_obj = await db.get(ImportSession, session_id)
            if session_obj:
                session_obj.finished_at = datetime.now(timezone.utc)
                session_obj.imported = progress["imported"]
                session_obj.skipped = progress["skipped"]
                session_obj.failed = progress["failed"]
                session_obj.total = progress["total"]
                session_obj.status = "completed"
                await db.commit()

            # Telegram: sync complete
            elapsed = int((datetime.now(timezone.utc) - sync_start).total_seconds())
            await send_telegram(
                f"<b>Plex Sync Complete</b>\n"
                f"Imported: {progress['imported']:,}\n"
                f"Skipped: {progress['skipped']:,}\n"
                f"Failed: {progress['failed']:,}\n"
                f"Duration: {_fmt_duration(elapsed)}\n"
                f"Libraries synced: {len(libraries)}"
            )

        except Exception as e:
            logger.error(f"Plex sync fatal error: {e}")
            progress["current_title"] = f"FATAL: {e}"

    progress["status"] = "completed"


async def _sync_single_movie(db: AsyncSession, plex_item: dict, guids: list, progress: dict):
    """Match or import a single Plex movie, fill gaps, sync artwork."""
    tmdb_id = plex_client.extract_tmdb_id(guids)
    imdb_id = plex_client.extract_imdb_id(guids)
    rating_key = str(plex_item.get("ratingKey", ""))

    # Try to find existing movie
    movie = None
    if tmdb_id:
        result = await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
        movie = result.scalar_one_or_none()
    if not movie and imdb_id:
        result = await db.execute(select(Movie).where(Movie.imdb_id == imdb_id))
        movie = result.scalar_one_or_none()

    if movie:
        # Existing record — fill missing fields + store Plex external ID
        _fill_missing_movie_fields(movie, plex_item)
        await _upsert_external_id(db, "movie", movie.id, "plex", rating_key)
        await _sync_plex_artwork(db, "movie", movie.id, plex_item)
        await db.commit()
        progress["skipped"] += 1  # "skipped" = already existed, updated
    elif tmdb_id:
        # New movie — import via TMDb (rich data), then link Plex extras
        try:
            result = await _import_single_movie(db, tmdb_id)
            if result == "imported":
                # Re-fetch the newly imported movie
                res = await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
                movie = res.scalar_one_or_none()
                if movie:
                    _fill_missing_movie_fields(movie, plex_item)
                    await _upsert_external_id(db, "movie", movie.id, "plex", rating_key)
                    await _sync_plex_artwork(db, "movie", movie.id, plex_item)
                    await db.commit()
                progress["imported"] += 1
            else:
                progress["skipped"] += 1
        except Exception as e:
            logger.warning(f"TMDb import failed for {tmdb_id}, skipping: {e}")
            progress["failed"] += 1
    else:
        # No TMDb ID — can't import
        logger.debug(f"Plex movie '{plex_item.get('title')}' has no TMDb GUID, skipping")
        progress["skipped"] += 1


async def _sync_single_show(db: AsyncSession, plex_item: dict, guids: list, progress: dict):
    """Match or import a single Plex show, fill gaps, sync artwork."""
    tmdb_id = plex_client.extract_tmdb_id(guids)
    imdb_id = plex_client.extract_imdb_id(guids)
    tvdb_id = plex_client.extract_tvdb_id(guids)
    rating_key = str(plex_item.get("ratingKey", ""))

    show = None
    if tmdb_id:
        result = await db.execute(select(TVShow).where(TVShow.tmdb_id == tmdb_id))
        show = result.scalar_one_or_none()
    if not show and tvdb_id:
        result = await db.execute(select(TVShow).where(TVShow.tvdb_id == tvdb_id))
        show = result.scalar_one_or_none()
    if not show and imdb_id:
        result = await db.execute(select(TVShow).where(TVShow.imdb_id == imdb_id))
        show = result.scalar_one_or_none()

    if show:
        _fill_missing_show_fields(show, plex_item)
        await _upsert_external_id(db, "show", show.id, "plex", rating_key)
        await _sync_plex_artwork(db, "show", show.id, plex_item)
        await db.commit()
        progress["skipped"] += 1
    elif tmdb_id:
        try:
            result = await _import_single_show(db, tmdb_id)
            if result == "imported":
                res = await db.execute(select(TVShow).where(TVShow.tmdb_id == tmdb_id))
                show = res.scalar_one_or_none()
                if show:
                    _fill_missing_show_fields(show, plex_item)
                    await _upsert_external_id(db, "show", show.id, "plex", rating_key)
                    await _sync_plex_artwork(db, "show", show.id, plex_item)
                    await db.commit()
                progress["imported"] += 1
            else:
                progress["skipped"] += 1
        except Exception as e:
            logger.warning(f"TMDb import failed for show {tmdb_id}: {e}")
            progress["failed"] += 1
    else:
        logger.debug(f"Plex show '{plex_item.get('title')}' has no TMDb GUID, skipping")
        progress["skipped"] += 1


# ── Gap Filling ──

def _fill_missing_movie_fields(movie: Movie, plex_item: dict):
    """Fill NULL fields from Plex data. Never overwrite existing TMDb data."""
    if not movie.overview and plex_item.get("summary"):
        movie.overview = plex_item["summary"]
    if not movie.tagline and plex_item.get("tagline"):
        movie.tagline = plex_item["tagline"]
    if not movie.runtime and plex_item.get("duration"):
        movie.runtime = plex_item["duration"] // 60000  # Plex uses milliseconds
    if not movie.content_rating and plex_item.get("contentRating"):
        movie.content_rating = plex_item["contentRating"]
    if not movie.origin_country and plex_item.get("Country"):
        countries = plex_item["Country"]
        if isinstance(countries, list):
            movie.origin_country = ",".join(c.get("tag", "") for c in countries if c.get("tag"))


def _fill_missing_show_fields(show: TVShow, plex_item: dict):
    """Fill NULL fields from Plex data. Never overwrite existing TMDb data."""
    if not show.overview and plex_item.get("summary"):
        show.overview = plex_item["summary"]
    if not show.content_rating and plex_item.get("contentRating"):
        show.content_rating = plex_item["contentRating"]
    if not show.origin_country and plex_item.get("Country"):
        countries = plex_item["Country"]
        if isinstance(countries, list):
            show.origin_country = ",".join(c.get("tag", "") for c in countries if c.get("tag"))


# ── Artwork Sync ──

async def _sync_plex_artwork(db: AsyncSession, media_type: str, media_id: int, plex_item: dict):
    """Add Plex poster and art to Artwork table as source='plex'."""
    # Check if we already have Plex artwork for this item
    existing = await db.execute(
        select(Artwork.id).where(
            Artwork.media_type == media_type,
            Artwork.media_id == media_id,
            Artwork.source == "plex",
        ).limit(1)
    )
    if existing.scalar_one_or_none():
        return  # Already synced

    # Poster (thumb)
    thumb = plex_item.get("thumb")
    if thumb:
        url = plex_client.get_image_url(thumb)
        db.add(Artwork(
            media_type=media_type, media_id=media_id,
            source="plex", type="poster", url=url, language="en",
        ))

    # Background art
    art = plex_item.get("art")
    if art:
        url = plex_client.get_image_url(art)
        db.add(Artwork(
            media_type=media_type, media_id=media_id,
            source="plex", type="backdrop", url=url, language="en",
        ))


# ── External ID Upsert ──

async def _upsert_external_id(db: AsyncSession, media_type: str, media_id: int, source: str, external_id: str):
    """Insert Plex external ID if not already stored."""
    if not external_id:
        return
    existing = await db.execute(
        select(ExternalID).where(
            ExternalID.media_type == media_type,
            ExternalID.media_id == media_id,
            ExternalID.source == source,
        )
    )
    if not existing.scalar_one_or_none():
        db.add(ExternalID(
            media_type=media_type, media_id=media_id,
            source=source, external_id=external_id,
        ))


# ── Refresh Metadata Logic ──

async def _run_plex_refresh(session_id: int, media_type: str, nexus_ids: list[str] | None):
    """Re-fetch metadata from Plex for existing records. Fix non-English artwork."""
    progress = _active_jobs[session_id]
    sync_start = datetime.now(timezone.utc)

    async with async_session() as db:
        try:
            # Get records that have a Plex external ID
            if media_type == "movie":
                model = Movie
            else:
                model = TVShow

            query = (
                select(model, ExternalID.external_id)
                .join(ExternalID, (ExternalID.media_type == media_type) & (ExternalID.media_id == model.id) & (ExternalID.source == "plex"))
            )
            if nexus_ids:
                query = query.where(model.nexus_id.in_(nexus_ids))

            result = await db.execute(query)
            rows = result.all()
            progress["total"] = len(rows)

            for record, plex_rating_key in rows:
                title = record.title or "Unknown"
                try:
                    progress["current_title"] = title

                    # Fetch fresh Plex metadata
                    plex_data = await plex_client.get_item_metadata(plex_rating_key)
                    if not plex_data:
                        progress["skipped"] += 1
                        _append_activity(progress, title, "skipped", "refresh", media_type)
                        continue

                    # Fill missing fields
                    if media_type == "movie":
                        _fill_missing_movie_fields(record, plex_data)
                    else:
                        _fill_missing_show_fields(record, plex_data)

                    # Remove non-English fanart artwork
                    non_en_fanart = await db.execute(
                        select(Artwork).where(
                            Artwork.media_type == media_type,
                            Artwork.media_id == record.id,
                            Artwork.source == "fanart",
                            (Artwork.language != "en") | (Artwork.language.is_(None)),
                        )
                    )
                    for art in non_en_fanart.scalars().all():
                        await db.delete(art)

                    # Re-sync Plex artwork (delete existing plex art first to get fresh)
                    old_plex_art = await db.execute(
                        select(Artwork).where(
                            Artwork.media_type == media_type,
                            Artwork.media_id == record.id,
                            Artwork.source == "plex",
                        )
                    )
                    for art in old_plex_art.scalars().all():
                        await db.delete(art)
                    await _sync_plex_artwork(db, media_type, record.id, plex_data)

                    await db.commit()
                    progress["imported"] += 1
                    _append_activity(progress, title, "imported", "refresh", media_type)

                except Exception as e:
                    progress["failed"] += 1
                    _append_activity(progress, title, "failed", "refresh", media_type)
                    logger.error(f"Plex refresh failed for '{title}': {e}")

                await asyncio.sleep(0.15)

            # Finalize session
            session_obj = await db.get(ImportSession, session_id)
            if session_obj:
                session_obj.finished_at = datetime.now(timezone.utc)
                session_obj.imported = progress["imported"]
                session_obj.skipped = progress["skipped"]
                session_obj.failed = progress["failed"]
                session_obj.total = progress["total"]
                session_obj.status = "completed"
                await db.commit()

            # Telegram: refresh complete
            elapsed = int((datetime.now(timezone.utc) - sync_start).total_seconds())
            await send_telegram(
                f"<b>Plex Artwork Refresh Complete</b>\n"
                f"Type: {media_type}\n"
                f"Refreshed: {progress['imported']:,}\n"
                f"Skipped: {progress['skipped']:,}\n"
                f"Failed: {progress['failed']:,}\n"
                f"Duration: {_fmt_duration(elapsed)}"
            )

        except Exception as e:
            logger.error(f"Plex refresh fatal error: {e}")
            progress["current_title"] = f"FATAL: {e}"

    progress["status"] = "completed"


# ── Scheduled Sync (called by scheduler) ──

async def run_plex_sync_job():
    """Nightly Plex sync — incremental, only new items since last sync."""
    if not plex_client.configured:
        return

    logger.info("Starting scheduled Plex sync...")
    sync_start = datetime.now(timezone.utc)

    async with async_session() as db:
        # Find last sync timestamp
        result = await db.execute(
            select(ImportSession.finished_at)
            .where(ImportSession.source == "plex", ImportSession.status == "completed")
            .order_by(ImportSession.finished_at.desc())
            .limit(1)
        )
        last_sync = result.scalar_one_or_none()

        session = ImportSession(
            source="plex",
            media_type="all",
            started_at=datetime.now(timezone.utc),
            status="running",
            total=0, imported=0, skipped=0, failed=0,
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

    progress = _make_progress()
    _active_jobs[session.id] = progress

    async with async_session() as db:
        try:
            libraries = await plex_client.get_libraries()
            sync_libs = [lib for lib in libraries if lib["type"] in ("movie", "show")]

            # Initialize per-library tracking
            for lib in sync_libs:
                progress["libraries"].append({
                    "key": lib["key"],
                    "title": lib["title"],
                    "type": lib["type"],
                    "status": "queued",
                    "total": 0, "imported": 0, "skipped": 0, "failed": 0,
                })

            # Telegram: scheduled sync started
            lib_names = ", ".join(lib["title"] for lib in sync_libs)
            await send_telegram(
                f"<b>Plex Scheduled Sync Started</b>\n"
                f"Libraries: {lib_names} ({len(sync_libs)})\n"
                f"Mode: incremental (since last sync)"
            )

            for lib_idx, lib in enumerate(sync_libs):
                lib_progress = progress["libraries"][lib_idx]
                lib_progress["status"] = "scanning"

                items = await plex_client.get_all_items(lib["key"])

                # Filter to items added since last sync (incremental)
                if last_sync:
                    last_ts = int(last_sync.timestamp())
                    items = [i for i in items if i.get("addedAt", 0) > last_ts]

                lib_progress["total"] = len(items)
                lib_progress["status"] = "syncing"
                progress["total"] += len(items)
                logger.info(f"Plex scheduled sync: {len(items)} new items in '{lib['title']}'")

                for item in items:
                    title = item.get("title", "Unknown")
                    try:
                        progress["current_title"] = title
                        guids = item.get("Guid", [])

                        before = (progress["imported"], progress["skipped"], progress["failed"])

                        if lib["type"] == "movie":
                            await _sync_single_movie(db, item, guids, progress)
                        else:
                            await _sync_single_show(db, item, guids, progress)

                        after = (progress["imported"], progress["skipped"], progress["failed"])
                        if after[0] > before[0]:
                            action = "imported"
                        elif after[2] > before[2]:
                            action = "failed"
                        else:
                            action = "skipped"

                    except Exception as e:
                        progress["failed"] += 1
                        action = "failed"
                        logger.error(f"Scheduled Plex sync error: {e}")

                    lib_progress[action] += 1
                    _append_activity(progress, title, action, lib["title"], lib["type"])
                    await asyncio.sleep(0.15)

                lib_progress["status"] = "done"

            session_obj = await db.get(ImportSession, session.id)
            if session_obj:
                session_obj.finished_at = datetime.now(timezone.utc)
                session_obj.imported = progress["imported"]
                session_obj.skipped = progress["skipped"]
                session_obj.failed = progress["failed"]
                session_obj.total = progress["total"]
                session_obj.status = "completed"
                await db.commit()

            # Telegram: scheduled sync complete
            elapsed = int((datetime.now(timezone.utc) - sync_start).total_seconds())
            await send_telegram(
                f"<b>Plex Scheduled Sync Complete</b>\n"
                f"Imported: {progress['imported']:,}\n"
                f"Skipped: {progress['skipped']:,}\n"
                f"Failed: {progress['failed']:,}\n"
                f"Duration: {_fmt_duration(elapsed)}\n"
                f"Libraries synced: {len(sync_libs)}"
            )

        except Exception as e:
            logger.error(f"Scheduled Plex sync fatal: {e}")

    progress["status"] = "completed"
    logger.info(f"Plex sync done: {progress['imported']} imported, {progress['skipped']} existing, {progress['failed']} failed")
