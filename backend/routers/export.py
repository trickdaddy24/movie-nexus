import csv
import io
import json
import xml.etree.ElementTree as ET

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import Movie, TVShow, Genre, ShowGenre

router = APIRouter(prefix="/export", tags=["Export"])


async def _get_movies_data(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(Movie).options(selectinload(Movie.genres)).order_by(Movie.title))
    movies = result.scalars().all()
    return [
        {
            "nexus_id": m.nexus_id,
            "tmdb_id": m.tmdb_id,
            "imdb_id": m.imdb_id,
            "title": m.title,
            "original_title": m.original_title,
            "release_date": str(m.release_date) if m.release_date else None,
            "runtime": m.runtime,
            "status": m.status,
            "rating_tmdb": m.rating_tmdb,
            "rating_imdb": m.rating_imdb,
            "rating_trakt": m.rating_trakt,
            "content_rating": m.content_rating,
            "popularity": m.popularity,
            "origin_country": m.origin_country or "",
            "original_language": m.original_language or "",
            "genres": [g.name for g in m.genres],
        }
        for m in movies
    ]


async def _get_shows_data(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(TVShow).options(selectinload(TVShow.show_genres)).order_by(TVShow.title))
    shows = result.scalars().all()
    return [
        {
            "nexus_id": s.nexus_id,
            "tmdb_id": s.tmdb_id,
            "tvdb_id": s.tvdb_id,
            "imdb_id": s.imdb_id,
            "title": s.title,
            "first_air_date": str(s.first_air_date) if s.first_air_date else None,
            "status": s.status,
            "seasons": s.number_of_seasons,
            "episodes": s.number_of_episodes,
            "rating_tmdb": s.rating_tmdb,
            "rating_imdb": s.rating_imdb,
            "rating_trakt": s.rating_trakt,
            "content_rating": s.content_rating,
            "popularity": s.popularity,
            "origin_country": s.origin_country or "",
            "original_language": s.original_language or "",
            "genres": [g.name for g in s.show_genres],
        }
        for s in shows
    ]


@router.get("")
async def export_data(
    format: str = Query("json", regex="^(json|csv|xml)$"),
    type: str = Query("movies", regex="^(movies|shows)$"),
    indent: int = Query(4, ge=1, le=8),
    db: AsyncSession = Depends(get_db),
):
    data = await _get_movies_data(db) if type == "movies" else await _get_shows_data(db)

    if format == "json":
        content = json.dumps(data, indent=indent, default=str)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=movienexus_{type}.json"},
        )

    elif format == "csv":
        output = io.StringIO()
        if data:
            flat = []
            for item in data:
                row = {k: v for k, v in item.items() if k != "genres"}
                row["genres"] = "|".join(item.get("genres", []))
                flat.append(row)
            writer = csv.DictWriter(output, fieldnames=flat[0].keys())
            writer.writeheader()
            writer.writerows(flat)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=movienexus_{type}.csv"},
        )

    elif format == "xml":
        root = ET.Element("movienexus")
        root.set("type", type)
        for item in data:
            elem = ET.SubElement(root, "movie" if type == "movies" else "show")
            for key, val in item.items():
                if key == "genres":
                    genres_elem = ET.SubElement(elem, "genres")
                    for g in val:
                        ET.SubElement(genres_elem, "genre").text = g
                else:
                    child = ET.SubElement(elem, key)
                    child.text = str(val) if val is not None else ""
        content = ET.tostring(root, encoding="unicode", xml_declaration=True)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/xml",
            headers={"Content-Disposition": f"attachment; filename=movienexus_{type}.xml"},
        )
