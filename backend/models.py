from sqlalchemy import (
    Column, Date, DateTime, Float, ForeignKey, Index, Integer,
    String, Text, func,
)
from sqlalchemy.orm import relationship

from database import Base


class Movie(Base):
    __tablename__ = "movies"

    id = Column(Integer, primary_key=True)
    nexus_id = Column(String(20), unique=True, nullable=False, index=True)
    tmdb_id = Column(Integer, unique=True, index=True)
    imdb_id = Column(String(15), index=True)
    title = Column(Text, nullable=False)
    original_title = Column(Text)
    tagline = Column(Text)
    overview = Column(Text)
    release_date = Column(Date)
    runtime = Column(Integer)
    status = Column(String(50))
    rating_tmdb = Column(Float)
    rating_imdb = Column(Float)
    rating_trakt = Column(Float)
    vote_count_tmdb = Column(Integer, default=0)
    content_rating = Column(String(10))
    popularity = Column(Float, default=0)
    budget = Column(Integer, default=0)
    revenue = Column(Integer, default=0)
    homepage = Column(Text)
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    genres = relationship("Genre", back_populates="movie", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_movies_title_year", "title", "release_date"),
    )


class TVShow(Base):
    __tablename__ = "tv_shows"

    id = Column(Integer, primary_key=True)
    nexus_id = Column(String(20), unique=True, nullable=False, index=True)
    tmdb_id = Column(Integer, unique=True, index=True)
    tvdb_id = Column(Integer, index=True)
    imdb_id = Column(String(15), index=True)
    title = Column(Text, nullable=False)
    original_title = Column(Text)
    overview = Column(Text)
    first_air_date = Column(Date)
    last_air_date = Column(Date)
    status = Column(String(50))
    number_of_seasons = Column(Integer, default=0)
    number_of_episodes = Column(Integer, default=0)
    rating_tmdb = Column(Float)
    rating_imdb = Column(Float)
    rating_trakt = Column(Float)
    vote_count_tmdb = Column(Integer, default=0)
    content_rating = Column(String(10))
    popularity = Column(Float, default=0)
    homepage = Column(Text)
    added_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    seasons = relationship("Season", back_populates="show", cascade="all, delete-orphan")
    show_genres = relationship("ShowGenre", back_populates="show", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_tv_shows_title_year", "title", "first_air_date"),
    )


class Season(Base):
    __tablename__ = "seasons"

    id = Column(Integer, primary_key=True)
    show_id = Column(Integer, ForeignKey("tv_shows.id", ondelete="CASCADE"), nullable=False)
    season_number = Column(Integer, nullable=False)
    name = Column(Text)
    overview = Column(Text)
    air_date = Column(Date)
    episode_count = Column(Integer, default=0)
    poster_path = Column(Text)

    show = relationship("TVShow", back_populates="seasons")
    episodes = relationship("Episode", back_populates="season", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_seasons_show_number", "show_id", "season_number", unique=True),
    )


class Episode(Base):
    __tablename__ = "episodes"

    id = Column(Integer, primary_key=True)
    nexus_id = Column(String(20), unique=True, nullable=False, index=True)
    season_id = Column(Integer, ForeignKey("seasons.id", ondelete="CASCADE"), nullable=False)
    show_id = Column(Integer, ForeignKey("tv_shows.id", ondelete="CASCADE"), nullable=False)
    tmdb_id = Column(Integer, index=True)
    tvdb_id = Column(Integer, index=True)
    season_number = Column(Integer, nullable=False)
    episode_number = Column(Integer, nullable=False)
    title = Column(Text)
    overview = Column(Text)
    air_date = Column(Date)
    runtime = Column(Integer)
    rating_tmdb = Column(Float)
    still_path = Column(Text)

    season = relationship("Season", back_populates="episodes")

    __table_args__ = (
        Index("ix_episodes_show_season_ep", "show_id", "season_number", "episode_number", unique=True),
    )


class Person(Base):
    __tablename__ = "people"

    id = Column(Integer, primary_key=True)
    tmdb_person_id = Column(Integer, unique=True, nullable=False, index=True)
    name = Column(Text, nullable=False)
    biography = Column(Text)
    birthday = Column(Date)
    deathday = Column(Date)
    profile_path = Column(Text)
    known_for_department = Column(String(50))
    added_at = Column(DateTime(timezone=True), server_default=func.now())


class Credit(Base):
    __tablename__ = "credits"

    id = Column(Integer, primary_key=True)
    media_type = Column(String(10), nullable=False)
    media_id = Column(Integer, nullable=False)
    person_id = Column(Integer, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(10), nullable=False)
    character_name = Column(Text)
    job = Column(Text)
    department = Column(String(50))
    display_order = Column(Integer, default=0)

    person = relationship("Person")

    __table_args__ = (
        Index("ix_credits_media", "media_type", "media_id"),
        Index("ix_credits_person", "person_id"),
    )


class Artwork(Base):
    __tablename__ = "artwork"

    id = Column(Integer, primary_key=True)
    media_type = Column(String(10), nullable=False)
    media_id = Column(Integer, nullable=False)
    source = Column(String(10), nullable=False)
    type = Column(String(20), nullable=False)
    url = Column(Text, nullable=False)
    language = Column(String(5))
    likes = Column(Integer, default=0)
    hash = Column(String(64))          # SHA-256 hex digest of image bytes
    width = Column(Integer)            # pixels
    height = Column(Integer)           # pixels

    __table_args__ = (
        Index("ix_artwork_media", "media_type", "media_id"),
    )


class Genre(Base):
    __tablename__ = "genres"

    id = Column(Integer, primary_key=True)
    movie_id = Column(Integer, ForeignKey("movies.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)

    movie = relationship("Movie", back_populates="genres")


class ShowGenre(Base):
    __tablename__ = "show_genres"

    id = Column(Integer, primary_key=True)
    show_id = Column(Integer, ForeignKey("tv_shows.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)

    show = relationship("TVShow", back_populates="show_genres")


class Studio(Base):
    __tablename__ = "studios"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    tmdb_id = Column(Integer, unique=True)
    logo_path = Column(Text)


class MediaStudio(Base):
    __tablename__ = "media_studios"

    id = Column(Integer, primary_key=True)
    media_type = Column(String(10), nullable=False)
    media_id = Column(Integer, nullable=False)
    studio_id = Column(Integer, ForeignKey("studios.id", ondelete="CASCADE"), nullable=False)

    studio = relationship("Studio")

    __table_args__ = (
        Index("ix_media_studios_media", "media_type", "media_id"),
    )


class ExternalID(Base):
    __tablename__ = "external_ids"

    id = Column(Integer, primary_key=True)
    media_type = Column(String(10), nullable=False)
    media_id = Column(Integer, nullable=False)
    source = Column(String(20), nullable=False)
    external_id = Column(Text, nullable=False)

    __table_args__ = (
        Index("ix_external_ids_media", "media_type", "media_id"),
        Index("ix_external_ids_lookup", "source", "external_id"),
    )


class ImportSession(Base):
    __tablename__ = "import_sessions"

    id = Column(Integer, primary_key=True)
    source = Column(String(20), nullable=False)
    media_type = Column(String(10))
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True))
    total = Column(Integer, default=0)
    imported = Column(Integer, default=0)
    skipped = Column(Integer, default=0)
    failed = Column(Integer, default=0)
    status = Column(String(20), default="running")


class TrendingSnapshot(Base):
    __tablename__ = "trending_snapshots"

    id = Column(Integer, primary_key=True)
    nexus_id = Column(String(20), nullable=False, index=True)
    media_type = Column(String(10), nullable=False)   # movie/show/anime
    window = Column(String(10), nullable=False)        # daily/weekly/alltime
    rank = Column(Integer, nullable=False)
    watcher_count = Column(Integer, default=0)
    snapshot_date = Column(Date, nullable=False)

    __table_args__ = (
        Index("ix_trending_date_type_window", "snapshot_date", "media_type", "window"),
    )


class ImportLog(Base):
    __tablename__ = "import_logs"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("import_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    tmdb_id = Column(Integer)
    media_type = Column(String(10))
    level = Column(String(10), default="error")   # error / warning / info
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_import_logs_session_created", "session_id", "created_at"),
    )
