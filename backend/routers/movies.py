import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import Movie, Genre, Artwork, Credit, ExternalID
from schemas import MovieBrief, MovieDetail, GenreOut, PaginatedResponse

router = APIRouter(prefix="/movies", tags=["Movies"])


@router.get("", response_model=PaginatedResponse)
async def list_movies(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    sort: str = Query("added_at", regex="^(title|release_date|rating_tmdb|rating_imdb|popularity|added_at)$"),
    order: str = Query("desc", regex="^(asc|desc)$"),
    genre: str | None = None,
    year: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Movie).options(selectinload(Movie.genres))

    if genre:
        query = query.join(Genre).where(Genre.name.ilike(genre))
    if year:
        query = query.where(func.extract("year", Movie.release_date) == year)

    sort_col = getattr(Movie, sort)
    query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc())

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    movies = result.scalars().all()

    poster_map = {}
    if movies:
        movie_ids = [m.id for m in movies]
        poster_q = (
            select(Artwork.media_id, Artwork.url)
            .where(Artwork.media_type == "movie", Artwork.type == "poster", Artwork.media_id.in_(movie_ids))
            .distinct(Artwork.media_id)
        )
        poster_result = await db.execute(poster_q)
        for mid, url in poster_result:
            if mid not in poster_map:
                poster_map[mid] = url

    items = [
        MovieBrief(
            nexus_id=m.nexus_id,
            tmdb_id=m.tmdb_id,
            title=m.title,
            release_date=m.release_date,
            runtime=m.runtime,
            rating_tmdb=m.rating_tmdb,
            rating_imdb=m.rating_imdb,
            popularity=m.popularity,
            genres=[GenreOut(name=g.name) for g in m.genres],
            added_at=m.added_at,
            poster_url=poster_map.get(m.id),
        )
        for m in movies
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/{nexus_id}", response_model=MovieDetail)
async def get_movie(nexus_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Movie).options(selectinload(Movie.genres)).where(Movie.nexus_id == nexus_id)
    )
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(404, "Movie not found")

    poster_result = await db.execute(
        select(Artwork.url)
        .where(Artwork.media_type == "movie", Artwork.type == "poster", Artwork.media_id == movie.id)
        .limit(1)
    )
    poster_url = poster_result.scalar_one_or_none()

    return MovieDetail(
        nexus_id=movie.nexus_id,
        tmdb_id=movie.tmdb_id,
        imdb_id=movie.imdb_id,
        title=movie.title,
        original_title=movie.original_title,
        tagline=movie.tagline,
        overview=movie.overview,
        release_date=movie.release_date,
        runtime=movie.runtime,
        status=movie.status,
        rating_tmdb=movie.rating_tmdb,
        rating_imdb=movie.rating_imdb,
        rating_trakt=movie.rating_trakt,
        vote_count_tmdb=movie.vote_count_tmdb,
        content_rating=movie.content_rating,
        popularity=movie.popularity,
        budget=movie.budget,
        revenue=movie.revenue,
        homepage=movie.homepage,
        genres=[GenreOut(name=g.name) for g in movie.genres],
        added_at=movie.added_at,
        updated_at=movie.updated_at,
        poster_url=poster_url,
    )
