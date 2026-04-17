from datetime import date, datetime
from pydantic import BaseModel


class GenreOut(BaseModel):
    name: str


class ArtworkOut(BaseModel):
    source: str
    type: str
    url: str
    language: str | None = None
    likes: int = 0


class PersonBrief(BaseModel):
    id: int
    tmdb_person_id: int
    name: str
    profile_path: str | None = None
    known_for_department: str | None = None


class CreditOut(BaseModel):
    person: PersonBrief
    role: str
    character_name: str | None = None
    job: str | None = None
    department: str | None = None
    display_order: int = 0


class ExternalIDOut(BaseModel):
    source: str
    external_id: str


class StudioOut(BaseModel):
    name: str
    tmdb_id: int | None = None
    logo_path: str | None = None


class EpisodeOut(BaseModel):
    nexus_id: str
    tmdb_id: int | None = None
    season_number: int
    episode_number: int
    title: str | None = None
    overview: str | None = None
    air_date: date | None = None
    runtime: int | None = None
    rating_tmdb: float | None = None
    still_path: str | None = None


class SeasonOut(BaseModel):
    season_number: int
    name: str | None = None
    overview: str | None = None
    air_date: date | None = None
    episode_count: int = 0
    poster_path: str | None = None
    episodes: list[EpisodeOut] = []


class MovieBrief(BaseModel):
    nexus_id: str
    tmdb_id: int | None = None
    title: str
    release_date: date | None = None
    runtime: int | None = None
    rating_tmdb: float | None = None
    rating_imdb: float | None = None
    popularity: float = 0
    genres: list[GenreOut] = []
    added_at: datetime | None = None
    poster_url: str | None = None


class MovieDetail(MovieBrief):
    imdb_id: str | None = None
    original_title: str | None = None
    tagline: str | None = None
    overview: str | None = None
    status: str | None = None
    rating_trakt: float | None = None
    vote_count_tmdb: int = 0
    content_rating: str | None = None
    budget: int = 0
    revenue: int = 0
    homepage: str | None = None
    updated_at: datetime | None = None


class TVShowBrief(BaseModel):
    nexus_id: str
    tmdb_id: int | None = None
    title: str
    first_air_date: date | None = None
    status: str | None = None
    number_of_seasons: int = 0
    number_of_episodes: int = 0
    rating_tmdb: float | None = None
    rating_imdb: float | None = None
    popularity: float = 0
    genres: list[GenreOut] = []
    added_at: datetime | None = None
    poster_url: str | None = None


class TVShowDetail(TVShowBrief):
    tvdb_id: int | None = None
    imdb_id: str | None = None
    original_title: str | None = None
    overview: str | None = None
    last_air_date: date | None = None
    rating_trakt: float | None = None
    vote_count_tmdb: int = 0
    content_rating: str | None = None
    homepage: str | None = None
    updated_at: datetime | None = None
    seasons: list[SeasonOut] = []


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    per_page: int
    pages: int


class ImportProgress(BaseModel):
    session_id: int
    source: str
    status: str
    total: int
    imported: int
    skipped: int
    failed: int
    current_title: str = ""


class SearchResult(BaseModel):
    media_type: str
    nexus_id: str
    title: str
    year: int | None = None
    rating_tmdb: float | None = None
    popularity: float = 0


class StatsOut(BaseModel):
    total_movies: int = 0
    total_shows: int = 0
    total_episodes: int = 0
    total_people: int = 0
    total_artwork: int = 0
    avg_movie_rating: float | None = None
    avg_show_rating: float | None = None
    top_genres: list[dict] = []
    recent_imports: list[dict] = []
