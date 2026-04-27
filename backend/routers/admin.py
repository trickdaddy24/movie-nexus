# backend/routers/admin.py
import csv
import hashlib
import io
import json
import logging
import random
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db, async_session
from models import Artwork, Genre, Movie, ShowGenre, TVShow
from api.telegram import send_telegram

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


# ---------------------------------------------------------------------------
# Nightly rating sync
# ---------------------------------------------------------------------------

async def sync_ratings_nightly() -> None:
    """
    Update TMDb ratings for all movies and shows.
    Telegram alert if rating drops >2 points or IMDb ID changes.
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

                if new_last_air:
                    try:
                        from datetime import date as _date
                        show.last_air_date = _date.fromisoformat(new_last_air)
                    except (ValueError, TypeError):
                        pass

            except Exception as e:
                logger.warning(f"Rating sync failed for {show.nexus_id}: {e}")

        await db.commit()

    logger.info("Nightly rating sync complete")


# ---------------------------------------------------------------------------
# Artwork verification
# ---------------------------------------------------------------------------

@router.get("/artwork/verify")
async def verify_artwork(
    media_type: str = Query("movie", regex="^(movie|show)$"),
    sample: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Sample N random artwork records, download each, check SHA-256 hash and dimensions.
    Returns list of {id, url, type, hash, width, height, valid, reason}.
    Posters: min 500×750px. Backdrops: min 1280×720px.
    """
    from PIL import Image

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
                img = Image.open(io.BytesIO(image_bytes))
                art.width, art.height = img.size

                valid = True
                reason = "ok"
                if art.type == "poster" and (art.width < 500 or art.height < 750):
                    valid = False
                    reason = f"undersized poster: {art.width}×{art.height} (min 500×750)"
                elif art.type == "backdrop" and (art.width < 1280 or art.height < 720):
                    valid = False
                    reason = f"undersized backdrop: {art.width}×{art.height} (min 1280×720)"

                entry.update({
                    "hash": art.hash,
                    "width": art.width,
                    "height": art.height,
                    "valid": valid,
                    "reason": reason,
                })
            except Exception as e:
                entry.update({
                    "hash": None, "width": None, "height": None,
                    "valid": False, "reason": str(e),
                })
            output.append(entry)

    await db.commit()
    return output


# ---------------------------------------------------------------------------
# Export helpers
# ---------------------------------------------------------------------------

async def _build_export_data(db: AsyncSession, media: str) -> list[dict]:
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


# ---------------------------------------------------------------------------
# Nightly backup
# ---------------------------------------------------------------------------

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
