import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import TVShow, ShowGenre, Season, Episode, Artwork
from routers._filters import apply_category_filter
from schemas import (
    TVShowBrief, TVShowDetail, GenreOut, SeasonOut, EpisodeOut,
    PaginatedResponse,
)

router = APIRouter(prefix="/shows", tags=["TV Shows"])


@router.get("", response_model=PaginatedResponse)
async def list_shows(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    sort: str = Query("added_at", regex="^(title|first_air_date|rating_tmdb|popularity|added_at)$"),
    order: str = Query("desc", regex="^(asc|desc)$"),
    genre: str | None = None,
    status: str | None = None,
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(TVShow).options(selectinload(TVShow.show_genres))

    # Track whether a genre join was performed (need distinct to prevent duplicates)
    _genre_join_categories = {"anime", "documentary", "kids"}
    needs_distinct = bool(genre) or (category in _genre_join_categories)

    if genre:
        query = query.join(ShowGenre).where(ShowGenre.name.ilike(genre))
    if status:
        query = query.where(TVShow.status.ilike(status))

    # Category filter
    query = apply_category_filter(query, TVShow, ShowGenre, ShowGenre.show_id, category)

    # Ordering: USA-first when no explicit sort override (default sort) and no category active
    if sort == "added_at" and (category is None or category == "all"):
        usa_first = case((TVShow.origin_country.like("%US%"), 0), else_=1)
        query = query.order_by(usa_first, TVShow.popularity.desc())
    else:
        sort_col = getattr(TVShow, sort)
        query = query.order_by(sort_col.desc() if order == "desc" else sort_col.asc())

    if needs_distinct:
        query = query.distinct()

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    shows = result.scalars().all()

    poster_map = {}
    if shows:
        show_ids = [s.id for s in shows]
        poster_q = (
            select(Artwork.media_id, Artwork.url)
            .where(Artwork.media_type == "show", Artwork.type == "poster", Artwork.media_id.in_(show_ids))
            .distinct(Artwork.media_id)
        )
        poster_result = await db.execute(poster_q)
        for mid, url in poster_result:
            if mid not in poster_map:
                poster_map[mid] = url

    items = [
        TVShowBrief(
            nexus_id=s.nexus_id,
            tmdb_id=s.tmdb_id,
            title=s.title,
            first_air_date=s.first_air_date,
            status=s.status,
            number_of_seasons=s.number_of_seasons,
            number_of_episodes=s.number_of_episodes,
            rating_tmdb=s.rating_tmdb,
            rating_imdb=s.rating_imdb,
            popularity=s.popularity,
            genres=[GenreOut(name=g.name) for g in s.show_genres],
            added_at=s.added_at,
            poster_url=poster_map.get(s.id),
            origin_country=s.origin_country,
            original_language=s.original_language,
        )
        for s in shows
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.get("/{nexus_id}", response_model=TVShowDetail)
async def get_show(nexus_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TVShow)
        .options(
            selectinload(TVShow.show_genres),
            selectinload(TVShow.seasons).selectinload(Season.episodes),
        )
        .where(TVShow.nexus_id == nexus_id)
    )
    show = result.scalar_one_or_none()
    if not show:
        raise HTTPException(404, "TV show not found")

    seasons_out = sorted(
        [
            SeasonOut(
                season_number=s.season_number,
                name=s.name,
                overview=s.overview,
                air_date=s.air_date,
                episode_count=s.episode_count,
                poster_path=s.poster_path,
                episodes=sorted(
                    [
                        EpisodeOut(
                            nexus_id=e.nexus_id,
                            tmdb_id=e.tmdb_id,
                            season_number=e.season_number,
                            episode_number=e.episode_number,
                            title=e.title,
                            overview=e.overview,
                            air_date=e.air_date,
                            runtime=e.runtime,
                            rating_tmdb=e.rating_tmdb,
                            still_path=e.still_path,
                        )
                        for e in s.episodes
                    ],
                    key=lambda ep: ep.episode_number,
                ),
            )
            for s in show.seasons
        ],
        key=lambda sn: sn.season_number,
    )

    poster_result = await db.execute(
        select(Artwork.url)
        .where(Artwork.media_type == "show", Artwork.type == "poster", Artwork.media_id == show.id)
        .limit(1)
    )
    poster_url = poster_result.scalar_one_or_none()

    return TVShowDetail(
        nexus_id=show.nexus_id,
        tmdb_id=show.tmdb_id,
        tvdb_id=show.tvdb_id,
        imdb_id=show.imdb_id,
        title=show.title,
        original_title=show.original_title,
        overview=show.overview,
        first_air_date=show.first_air_date,
        last_air_date=show.last_air_date,
        status=show.status,
        number_of_seasons=show.number_of_seasons,
        number_of_episodes=show.number_of_episodes,
        rating_tmdb=show.rating_tmdb,
        rating_imdb=show.rating_imdb,
        rating_trakt=show.rating_trakt,
        vote_count_tmdb=show.vote_count_tmdb,
        content_rating=show.content_rating,
        popularity=show.popularity,
        homepage=show.homepage,
        origin_country=show.origin_country,
        original_language=show.original_language,
        genres=[GenreOut(name=g.name) for g in show.show_genres],
        added_at=show.added_at,
        updated_at=show.updated_at,
        seasons=seasons_out,
        poster_url=poster_url,
    )


@router.get("/{nexus_id}/seasons/{season_number}/episodes", response_model=list[EpisodeOut])
async def get_season_episodes(nexus_id: str, season_number: int, db: AsyncSession = Depends(get_db)):
    show_result = await db.execute(select(TVShow).where(TVShow.nexus_id == nexus_id))
    show = show_result.scalar_one_or_none()
    if not show:
        raise HTTPException(404, "TV show not found")

    result = await db.execute(
        select(Episode)
        .where(Episode.show_id == show.id, Episode.season_number == season_number)
        .order_by(Episode.episode_number)
    )
    episodes = result.scalars().all()

    return [
        EpisodeOut(
            nexus_id=e.nexus_id,
            tmdb_id=e.tmdb_id,
            season_number=e.season_number,
            episode_number=e.episode_number,
            title=e.title,
            overview=e.overview,
            air_date=e.air_date,
            runtime=e.runtime,
            rating_tmdb=e.rating_tmdb,
            still_path=e.still_path,
        )
        for e in episodes
    ]
