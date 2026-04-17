from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Movie, TVShow, Episode, Person, Artwork, Genre, ShowGenre, ImportSession
from schemas import StatsOut

router = APIRouter(prefix="/stats", tags=["Stats"])


@router.get("", response_model=StatsOut)
async def get_stats(db: AsyncSession = Depends(get_db)):
    total_movies = (await db.execute(select(func.count()).select_from(Movie))).scalar() or 0
    total_shows = (await db.execute(select(func.count()).select_from(TVShow))).scalar() or 0
    total_episodes = (await db.execute(select(func.count()).select_from(Episode))).scalar() or 0
    total_people = (await db.execute(select(func.count()).select_from(Person))).scalar() or 0
    total_artwork = (await db.execute(select(func.count()).select_from(Artwork))).scalar() or 0

    avg_movie = (await db.execute(select(func.avg(Movie.rating_tmdb)))).scalar()
    avg_show = (await db.execute(select(func.avg(TVShow.rating_tmdb)))).scalar()

    movie_genres = await db.execute(
        select(Genre.name, func.count().label("count"))
        .group_by(Genre.name)
        .order_by(func.count().desc())
        .limit(10)
    )
    show_genres = await db.execute(
        select(ShowGenre.name, func.count().label("count"))
        .group_by(ShowGenre.name)
        .order_by(func.count().desc())
        .limit(10)
    )

    genre_counts: dict[str, int] = {}
    for name, count in movie_genres:
        genre_counts[name] = genre_counts.get(name, 0) + count
    for name, count in show_genres:
        genre_counts[name] = genre_counts.get(name, 0) + count

    top_genres = sorted(
        [{"name": k, "count": v} for k, v in genre_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    recent = await db.execute(
        select(ImportSession).order_by(ImportSession.started_at.desc()).limit(5)
    )
    recent_imports = [
        {
            "id": s.id,
            "source": s.source,
            "media_type": s.media_type,
            "status": s.status,
            "total": s.total,
            "imported": s.imported,
            "started_at": str(s.started_at) if s.started_at else None,
        }
        for s in recent.scalars()
    ]

    return StatsOut(
        total_movies=total_movies,
        total_shows=total_shows,
        total_episodes=total_episodes,
        total_people=total_people,
        total_artwork=total_artwork,
        avg_movie_rating=round(avg_movie, 1) if avg_movie else None,
        avg_show_rating=round(avg_show, 1) if avg_show else None,
        top_genres=top_genres,
        recent_imports=recent_imports,
    )
