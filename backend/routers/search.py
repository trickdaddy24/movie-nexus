from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, union_all, literal
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import require_read_key
from models import Movie, TVShow
from schemas import SearchResult

router = APIRouter(prefix="/search", tags=["Search"], dependencies=[Depends(require_read_key)])


@router.get("", response_model=list[SearchResult])
async def search(
    q: str = Query(..., min_length=1),
    type: str | None = Query(None, regex="^(movie|show)$"),
    limit: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    results = []

    if type is None or type == "movie":
        movie_q = (
            select(
                literal("movie").label("media_type"),
                Movie.nexus_id,
                Movie.title,
                func.extract("year", Movie.release_date).label("year"),
                Movie.rating_tmdb,
                Movie.popularity,
            )
            .where(Movie.title.ilike(f"%{q}%"))
            .order_by(Movie.popularity.desc())
            .limit(limit)
        )
        movie_results = await db.execute(movie_q)
        for row in movie_results:
            results.append(SearchResult(
                media_type=row.media_type,
                nexus_id=row.nexus_id,
                title=row.title,
                year=int(row.year) if row.year else None,
                rating_tmdb=row.rating_tmdb,
                popularity=row.popularity or 0,
            ))

    if type is None or type == "show":
        show_q = (
            select(
                literal("show").label("media_type"),
                TVShow.nexus_id,
                TVShow.title,
                func.extract("year", TVShow.first_air_date).label("year"),
                TVShow.rating_tmdb,
                TVShow.popularity,
            )
            .where(TVShow.title.ilike(f"%{q}%"))
            .order_by(TVShow.popularity.desc())
            .limit(limit)
        )
        show_results = await db.execute(show_q)
        for row in show_results:
            results.append(SearchResult(
                media_type=row.media_type,
                nexus_id=row.nexus_id,
                title=row.title,
                year=int(row.year) if row.year else None,
                rating_tmdb=row.rating_tmdb,
                popularity=row.popularity or 0,
            ))

    results.sort(key=lambda r: r.popularity, reverse=True)
    return results[:limit]
