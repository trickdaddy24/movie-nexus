import asyncio
import json
import logging
from datetime import datetime, date, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from database import get_db, async_session
from dependencies import require_admin_key
from models import (
    Movie, TVShow, Season, Episode, Person, Credit, Genre, ShowGenre,
    Artwork, Studio, MediaStudio, ExternalID, ImportSession, ImportLog,
)
from nexus_id import generate_nexus_id
from api.tmdb import tmdb_client
from api.fanart import fanart_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/import", tags=["Import"], dependencies=[Depends(require_admin_key)])

_active_jobs: dict[int, dict] = {}

CATEGORY_FILTERS: dict[str, dict] = {
    "all":         {},
    "usa":         {"with_origin_country": "US"},
    "anime":       {"with_original_language": "ja", "with_genres": "16"},
    "korean":      {"with_origin_country": "KR"},
    "indian":      {"with_origin_country": "IN"},
    "documentary": {"with_genres": "99"},
    "kids":        {"with_origin_country": "US", "with_genres": "10751"},
    # "foreign" imports everything; category filtering happens at query time via apply_category_filter()
    "foreign":     {},
}


def _parse_date(date_str: str | None) -> date | None:
    if not date_str:
        return None
    try:
        return date.fromisoformat(date_str)
    except (ValueError, TypeError):
        return None


async def _upsert_person(db: AsyncSession, person_data: dict) -> int:
    tmdb_pid = person_data.get("id")
    result = await db.execute(select(Person).where(Person.tmdb_person_id == tmdb_pid))
    person = result.scalar_one_or_none()
    if person:
        return person.id

    person = Person(
        tmdb_person_id=tmdb_pid,
        name=person_data.get("name", "Unknown"),
        profile_path=person_data.get("profile_path"),
        known_for_department=person_data.get("known_for_department"),
    )
    db.add(person)
    await db.flush()
    return person.id


async def _upsert_studio(db: AsyncSession, studio_data: dict) -> int:
    tmdb_sid = studio_data.get("id")
    result = await db.execute(select(Studio).where(Studio.tmdb_id == tmdb_sid))
    studio = result.scalar_one_or_none()
    if studio:
        return studio.id

    studio = Studio(
        name=studio_data.get("name", "Unknown"),
        tmdb_id=tmdb_sid,
        logo_path=studio_data.get("logo_path"),
    )
    db.add(studio)
    await db.flush()
    return studio.id


async def _import_single_movie(db: AsyncSession, tmdb_id: int) -> str:
    existing = await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
    if existing.scalar_one_or_none():
        return "skipped"

    data = await tmdb_client.get_movie(tmdb_id)
    nexus_id = await generate_nexus_id(db, "movie")

    content_rating = None
    for country in data.get("release_dates", {}).get("results", []):
        if country.get("iso_3166_1") == "US":
            for rel in country.get("release_dates", []):
                if rel.get("certification"):
                    content_rating = rel["certification"]
                    break

    # TMDb /movie/{id} returns production_countries as list of dicts: [{"iso_3166_1": "US", ...}]
    origin_country    = ",".join(c["iso_3166_1"] for c in data.get("production_countries", []))
    original_language = data.get("original_language", "")

    movie = Movie(
        nexus_id=nexus_id,
        tmdb_id=tmdb_id,
        imdb_id=data.get("imdb_id"),
        title=data.get("title", "Untitled"),
        original_title=data.get("original_title"),
        tagline=data.get("tagline"),
        overview=data.get("overview"),
        release_date=_parse_date(data.get("release_date")),
        runtime=data.get("runtime"),
        status=data.get("status"),
        rating_tmdb=data.get("vote_average"),
        vote_count_tmdb=data.get("vote_count", 0),
        content_rating=content_rating,
        popularity=data.get("popularity", 0),
        budget=data.get("budget", 0),
        revenue=data.get("revenue", 0),
        homepage=data.get("homepage"),
        origin_country=origin_country,
        original_language=original_language,
    )
    db.add(movie)
    await db.flush()

    for g in data.get("genres", []):
        db.add(Genre(movie_id=movie.id, name=g["name"]))

    credits_data = data.get("credits", {})
    for i, cast in enumerate(credits_data.get("cast", [])[:25]):
        person_id = await _upsert_person(db, cast)
        db.add(Credit(
            media_type="movie", media_id=movie.id, person_id=person_id,
            role="cast", character_name=cast.get("character"),
            display_order=cast.get("order", i),
        ))

    for crew in credits_data.get("crew", []):
        if crew.get("job") in ("Director", "Producer", "Screenplay", "Writer"):
            person_id = await _upsert_person(db, crew)
            db.add(Credit(
                media_type="movie", media_id=movie.id, person_id=person_id,
                role="crew", job=crew.get("job"), department=crew.get("department"),
            ))

    for company in data.get("production_companies", []):
        studio_id = await _upsert_studio(db, company)
        db.add(MediaStudio(media_type="movie", media_id=movie.id, studio_id=studio_id))

    for img in data.get("images", {}).get("posters", [])[:5]:
        db.add(Artwork(
            media_type="movie", media_id=movie.id, source="tmdb",
            type="poster", url=f"https://image.tmdb.org/t/p/original{img['file_path']}",
            language=img.get("iso_639_1"),
        ))
    for img in data.get("images", {}).get("backdrops", [])[:5]:
        db.add(Artwork(
            media_type="movie", media_id=movie.id, source="tmdb",
            type="backdrop", url=f"https://image.tmdb.org/t/p/original{img['file_path']}",
            language=img.get("iso_639_1"),
        ))

    ext_ids = data.get("external_ids", {})
    if ext_ids.get("imdb_id"):
        db.add(ExternalID(media_type="movie", media_id=movie.id, source="imdb", external_id=ext_ids["imdb_id"]))
    if data.get("id"):
        db.add(ExternalID(media_type="movie", media_id=movie.id, source="tmdb", external_id=str(data["id"])))

    try:
        fanart_data = await fanart_client.get_movie_images(tmdb_id)
        for art in fanart_client.parse_images(fanart_data, "movie")[:10]:
            db.add(Artwork(media_type="movie", media_id=movie.id, **art))
    except Exception:
        pass

    await db.commit()
    return "imported"


async def _import_single_show(db: AsyncSession, tmdb_id: int) -> str:
    existing = await db.execute(select(TVShow).where(TVShow.tmdb_id == tmdb_id))
    if existing.scalar_one_or_none():
        return "skipped"

    data = await tmdb_client.get_tv(tmdb_id)
    nexus_id = await generate_nexus_id(db, "show")

    content_rating = None
    for cr in data.get("content_ratings", {}).get("results", []):
        if cr.get("iso_3166_1") == "US":
            content_rating = cr.get("rating")
            break

    ext_ids = data.get("external_ids", {})

    # TMDb /tv/{id} returns origin_country as flat list of strings: ["US", "GB"]
    origin_country    = ",".join(data.get("origin_country", []))
    original_language = data.get("original_language", "")

    show = TVShow(
        nexus_id=nexus_id,
        tmdb_id=tmdb_id,
        tvdb_id=ext_ids.get("tvdb_id"),
        imdb_id=ext_ids.get("imdb_id"),
        title=data.get("name", "Untitled"),
        original_title=data.get("original_name"),
        overview=data.get("overview"),
        first_air_date=_parse_date(data.get("first_air_date")),
        last_air_date=_parse_date(data.get("last_air_date")),
        status=data.get("status"),
        number_of_seasons=data.get("number_of_seasons", 0),
        number_of_episodes=data.get("number_of_episodes", 0),
        rating_tmdb=data.get("vote_average"),
        vote_count_tmdb=data.get("vote_count", 0),
        content_rating=content_rating,
        popularity=data.get("popularity", 0),
        homepage=data.get("homepage"),
        origin_country=origin_country,
        original_language=original_language,
    )
    db.add(show)
    await db.flush()

    for g in data.get("genres", []):
        db.add(ShowGenre(show_id=show.id, name=g["name"]))

    credits_data = data.get("credits", {})
    for i, cast in enumerate(credits_data.get("cast", [])[:25]):
        person_id = await _upsert_person(db, cast)
        db.add(Credit(
            media_type="show", media_id=show.id, person_id=person_id,
            role="cast", character_name=cast.get("character"),
            display_order=cast.get("order", i),
        ))

    for company in data.get("production_companies", []):
        studio_id = await _upsert_studio(db, company)
        db.add(MediaStudio(media_type="show", media_id=show.id, studio_id=studio_id))

    for img in data.get("images", {}).get("posters", [])[:5]:
        db.add(Artwork(
            media_type="show", media_id=show.id, source="tmdb",
            type="poster", url=f"https://image.tmdb.org/t/p/original{img['file_path']}",
            language=img.get("iso_639_1"),
        ))
    for img in data.get("images", {}).get("backdrops", [])[:5]:
        db.add(Artwork(
            media_type="show", media_id=show.id, source="tmdb",
            type="backdrop", url=f"https://image.tmdb.org/t/p/original{img['file_path']}",
            language=img.get("iso_639_1"),
        ))

    tvdb_id = ext_ids.get("tvdb_id")
    if tvdb_id:
        try:
            fanart_data = await fanart_client.get_tv_images(tvdb_id)
            for art in fanart_client.parse_images(fanart_data, "show")[:10]:
                db.add(Artwork(media_type="show", media_id=show.id, **art))
        except Exception:
            pass

    for season_data in data.get("seasons", []):
        sn = season_data["season_number"]
        season = Season(
            show_id=show.id,
            season_number=sn,
            name=season_data.get("name"),
            overview=season_data.get("overview"),
            air_date=_parse_date(season_data.get("air_date")),
            episode_count=season_data.get("episode_count", 0),
            poster_path=season_data.get("poster_path"),
        )
        db.add(season)
        await db.flush()

        try:
            season_detail = await tmdb_client.get_tv_season(tmdb_id, sn)
            for ep_data in season_detail.get("episodes", []):
                ep_nexus_id = await generate_nexus_id(db, "episode")
                db.add(Episode(
                    nexus_id=ep_nexus_id,
                    season_id=season.id,
                    show_id=show.id,
                    tmdb_id=ep_data.get("id"),
                    season_number=sn,
                    episode_number=ep_data.get("episode_number", 0),
                    title=ep_data.get("name"),
                    overview=ep_data.get("overview"),
                    air_date=_parse_date(ep_data.get("air_date")),
                    runtime=ep_data.get("runtime"),
                    rating_tmdb=ep_data.get("vote_average"),
                    still_path=ep_data.get("still_path"),
                ))
        except Exception as e:
            logger.warning(f"Failed to fetch season {sn} episodes: {e}")

    if ext_ids.get("imdb_id"):
        db.add(ExternalID(media_type="show", media_id=show.id, source="imdb", external_id=ext_ids["imdb_id"]))
    db.add(ExternalID(media_type="show", media_id=show.id, source="tmdb", external_id=str(tmdb_id)))
    if ext_ids.get("tvdb_id"):
        db.add(ExternalID(media_type="show", media_id=show.id, source="tvdb", external_id=str(ext_ids["tvdb_id"])))

    await db.commit()
    return "imported"


async def _run_import(session_id: int, media_type: str, tmdb_ids: list[int]):
    progress = _active_jobs[session_id]
    progress["total"] = len(tmdb_ids)

    async with async_session() as db:
        for tmdb_id in tmdb_ids:
            try:
                if media_type == "movie":
                    result = await _import_single_movie(db, tmdb_id)
                else:
                    result = await _import_single_show(db, tmdb_id)

                if result == "imported":
                    progress["imported"] += 1
                else:
                    progress["skipped"] += 1
                progress["current_title"] = f"TMDb #{tmdb_id}"

            except Exception as e:
                progress["failed"] += 1
                err_msg = f"{type(e).__name__}: {e}"
                progress["current_title"] = f"FAILED: TMDb #{tmdb_id} ({err_msg})"
                logger.error(f"Import failed for TMDb {tmdb_id}: {err_msg}")
                try:
                    db.add(ImportLog(
                        session_id=session_id,
                        tmdb_id=tmdb_id,
                        media_type=media_type,
                        level="error",
                        message=err_msg,
                    ))
                    await db.commit()
                except Exception:
                    pass

            await asyncio.sleep(0.25)

        session_obj = await db.get(ImportSession, session_id)
        if session_obj:
            session_obj.finished_at = datetime.utcnow()
            session_obj.imported = progress["imported"]
            session_obj.skipped = progress["skipped"]
            session_obj.failed = progress["failed"]
            session_obj.total = progress["total"]
            session_obj.status = "completed"
            await db.commit()

    progress["status"] = "completed"


async def _run_bulk_crawl(session_id: int, media_type: str, total_pages: int, tmdb_filters: dict | None = None):
    """Crawl TMDb discover pages and import everything. Telegram every 10k records."""
    progress = _active_jobs[session_id]
    imported_total = 0
    skipped_total = 0
    failed_total = 0
    last_notified_at = 0

    async with async_session() as db:
        for page in range(1, total_pages + 1):
            try:
                extra = tmdb_filters or {}
                if media_type == "movie":
                    data = await tmdb_client.discover_movies(page=page, sort_by="popularity.desc", **extra)
                else:
                    data = await tmdb_client.discover_tv(page=page, sort_by="popularity.desc", **extra)
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
                    err_msg = f"{type(e).__name__}: {e}"
                    logger.error(f"Bulk import failed for TMDb {tmdb_id}: {err_msg}")
                    try:
                        db.add(ImportLog(
                            session_id=session_id,
                            tmdb_id=tmdb_id,
                            media_type=media_type,
                            level="error",
                            message=err_msg,
                        ))
                        await db.commit()
                    except Exception:
                        pass

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
            await asyncio.sleep(0.1)

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


@router.post("/movies/start")
async def start_movie_import(
    tmdb_ids: list[int],
    db: AsyncSession = Depends(get_db),
):
    session = ImportSession(source="tmdb", media_type="movie", total=len(tmdb_ids))
    db.add(session)
    await db.commit()
    await db.refresh(session)

    _active_jobs[session.id] = {
        "session_id": session.id,
        "source": "tmdb",
        "status": "running",
        "total": len(tmdb_ids),
        "imported": 0,
        "skipped": 0,
        "failed": 0,
        "current_title": "",
    }

    asyncio.create_task(_run_import(session.id, "movie", tmdb_ids))
    return {"session_id": session.id, "message": f"Importing {len(tmdb_ids)} movies"}


@router.post("/shows/start")
async def start_show_import(
    tmdb_ids: list[int],
    db: AsyncSession = Depends(get_db),
):
    session = ImportSession(source="tmdb", media_type="show", total=len(tmdb_ids))
    db.add(session)
    await db.commit()
    await db.refresh(session)

    _active_jobs[session.id] = {
        "session_id": session.id,
        "source": "tmdb",
        "status": "running",
        "total": len(tmdb_ids),
        "imported": 0,
        "skipped": 0,
        "failed": 0,
        "current_title": "",
    }

    asyncio.create_task(_run_import(session.id, "show", tmdb_ids))
    return {"session_id": session.id, "message": f"Importing {len(tmdb_ids)} TV shows"}


@router.post("/discover/movies")
async def import_discover_movies(
    pages: int = Query(1, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    tmdb_ids = []
    for page in range(1, pages + 1):
        data = await tmdb_client.get_popular_movies(page)
        for item in data.get("results", []):
            tmdb_ids.append(item["id"])

    session = ImportSession(source="tmdb_discover", media_type="movie", total=len(tmdb_ids))
    db.add(session)
    await db.commit()
    await db.refresh(session)

    _active_jobs[session.id] = {
        "session_id": session.id,
        "source": "tmdb_discover",
        "status": "running",
        "total": len(tmdb_ids),
        "imported": 0,
        "skipped": 0,
        "failed": 0,
        "current_title": "",
    }

    asyncio.create_task(_run_import(session.id, "movie", tmdb_ids))
    return {"session_id": session.id, "message": f"Discovering {len(tmdb_ids)} movies from {pages} pages"}


@router.post("/discover/shows")
async def import_discover_shows(
    pages: int = Query(1, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    tmdb_ids = []
    for page in range(1, pages + 1):
        data = await tmdb_client.get_popular_tv(page)
        for item in data.get("results", []):
            tmdb_ids.append(item["id"])

    session = ImportSession(source="tmdb_discover", media_type="show", total=len(tmdb_ids))
    db.add(session)
    await db.commit()
    await db.refresh(session)

    _active_jobs[session.id] = {
        "session_id": session.id,
        "source": "tmdb_discover",
        "status": "running",
        "total": len(tmdb_ids),
        "imported": 0,
        "skipped": 0,
        "failed": 0,
        "current_title": "",
    }

    asyncio.create_task(_run_import(session.id, "show", tmdb_ids))
    return {"session_id": session.id, "message": f"Discovering {len(tmdb_ids)} shows from {pages} pages"}


@router.post("/bulk/start")
async def start_bulk_import(
    media_type: str = Query("movie", regex="^(movie|show)$"),
    pages: int = Query(2500, ge=1, le=5000),
    category: str = Query("all", regex="^(all|usa|anime|korean|indian|documentary|kids|foreign)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Start a bulk crawl of TMDb discover sorted by popularity.
    movies: pages=2500 → ~50,000 titles
    shows:  pages=1000 → ~20,000 titles
    Sends Telegram notification every 10k records.
    """
    estimated = pages * 20
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

    tmdb_filters = CATEGORY_FILTERS.get(category, {})
    logger.info(f"Bulk {media_type} import started: category={category}, filters={tmdb_filters}, pages={pages}")
    asyncio.create_task(_run_bulk_crawl(session.id, media_type, pages, tmdb_filters))
    return {
        "session_id": session.id,
        "message": f"Bulk {media_type} crawl started ({pages} pages, category={category}, ~{estimated:,} titles)",
    }


@router.get("/progress/{session_id}", dependencies=[])
async def import_progress_sse(session_id: int):
    async def event_stream():
        while True:
            progress = _active_jobs.get(session_id)
            if not progress:
                yield {"event": "error", "data": json.dumps({"message": "Session not found"})}
                return

            yield {"event": "progress", "data": json.dumps(progress)}

            if progress["status"] == "completed":
                yield {"event": "complete", "data": json.dumps(progress)}
                _active_jobs.pop(session_id, None)
                return

            await asyncio.sleep(1)

    return EventSourceResponse(event_stream())


@router.get("/sessions")
async def list_import_sessions(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Return recent import sessions merged with live _active_jobs data."""
    result = await db.execute(
        select(ImportSession).order_by(ImportSession.started_at.desc()).limit(limit)
    )
    sessions = result.scalars().all()

    rows = []
    for s in sessions:
        live = _active_jobs.get(s.id, {})
        imported = live.get("imported", s.imported or 0)
        skipped = live.get("skipped", s.skipped or 0)
        failed = live.get("failed", s.failed or 0)
        rows.append({
            "id": s.id,
            "media_type": s.media_type,
            "status": live.get("status", s.status),
            "total": live.get("total", s.total or 0),
            "processed": imported + skipped + failed,
            "imported": imported,
            "skipped": skipped,
            "failed": failed,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "finished_at": s.finished_at.isoformat() if s.finished_at else None,
            "is_live": s.id in _active_jobs,
        })
    return rows
