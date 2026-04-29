const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface Genre {
  name: string;
}

export interface MovieBrief {
  nexus_id: string;
  tmdb_id: number | null;
  title: string;
  release_date: string | null;
  runtime: number | null;
  rating_tmdb: number | null;
  rating_imdb: number | null;
  popularity: number;
  genres: Genre[];
  added_at: string | null;
  poster_url: string | null;
  origin_country: string | null;
  original_language: string | null;
}

export interface MovieDetail extends MovieBrief {
  imdb_id: string | null;
  original_title: string | null;
  tagline: string | null;
  overview: string | null;
  status: string | null;
  rating_trakt: number | null;
  vote_count_tmdb: number;
  content_rating: string | null;
  budget: number;
  revenue: number;
  homepage: string | null;
  updated_at: string | null;
}

export interface EpisodeOut {
  nexus_id: string;
  tmdb_id: number | null;
  season_number: number;
  episode_number: number;
  title: string | null;
  overview: string | null;
  air_date: string | null;
  runtime: number | null;
  rating_tmdb: number | null;
  still_path: string | null;
}

export interface SeasonOut {
  season_number: number;
  name: string | null;
  overview: string | null;
  air_date: string | null;
  episode_count: number;
  poster_path: string | null;
  episodes: EpisodeOut[];
}

export interface TVShowBrief {
  nexus_id: string;
  tmdb_id: number | null;
  title: string;
  first_air_date: string | null;
  status: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  rating_tmdb: number | null;
  rating_imdb: number | null;
  popularity: number;
  genres: Genre[];
  added_at: string | null;
  poster_url: string | null;
  origin_country: string | null;
  original_language: string | null;
}

export interface TVShowDetail extends TVShowBrief {
  tvdb_id: number | null;
  imdb_id: string | null;
  original_title: string | null;
  overview: string | null;
  last_air_date: string | null;
  rating_trakt: number | null;
  vote_count_tmdb: number;
  content_rating: string | null;
  homepage: string | null;
  updated_at: string | null;
  seasons: SeasonOut[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SearchResult {
  media_type: string;
  nexus_id: string;
  title: string;
  year: number | null;
  rating_tmdb: number | null;
  popularity: number;
}

export interface Stats {
  total_movies: number;
  total_shows: number;
  total_episodes: number;
  total_people: number;
  total_artwork: number;
  avg_movie_rating: number | null;
  avg_show_rating: number | null;
  top_genres: { name: string; count: number }[];
  recent_imports: {
    id: number;
    source: string;
    media_type: string;
    status: string;
    total: number;
    imported: number;
    started_at: string | null;
  }[];
}

export async function getMovies(
  page = 1,
  sort = "added_at",
  order = "desc",
  category = "all"
): Promise<PaginatedResponse<MovieBrief>> {
  return fetchAPI(`/movies?page=${page}&sort=${sort}&order=${order}&category=${category}`);
}

export async function getMovie(nexusId: string): Promise<MovieDetail> {
  return fetchAPI(`/movies/${nexusId}`);
}

export async function getShows(
  page = 1,
  sort = "added_at",
  order = "desc",
  category = "all"
): Promise<PaginatedResponse<TVShowBrief>> {
  return fetchAPI(`/shows?page=${page}&sort=${sort}&order=${order}&category=${category}`);
}

export async function getShow(nexusId: string): Promise<TVShowDetail> {
  return fetchAPI(`/shows/${nexusId}`);
}

export async function search(q: string): Promise<SearchResult[]> {
  return fetchAPI(`/search?q=${encodeURIComponent(q)}`);
}

export async function getStats(): Promise<Stats> {
  return fetchAPI("/stats");
}

// --- Admin / Import Monitor ---

export interface ImportSessionSummary {
  id: number;
  media_type: string;
  status: string;
  total: number;
  processed: number;
  imported: number;
  skipped: number;
  failed: number;
  started_at: string | null;
  finished_at: string | null;
  is_live: boolean;
}

export interface BulkStartResponse {
  session_id: number;
  message: string;
}

export interface ArtworkVerifyResult {
  id: number;
  url: string;
  type: string;
  hash: string | null;
  width: number | null;
  height: number | null;
  valid: boolean;
  reason: string | null;
}

export async function getImportSessions(limit = 20): Promise<ImportSessionSummary[]> {
  return fetchAPI<ImportSessionSummary[]>(`/import/sessions?limit=${limit}`);
}

export async function startBulkImport(
  media_type: "movie" | "show",
  pages: number,
  category = "all"
): Promise<BulkStartResponse> {
  return fetchAPI<BulkStartResponse>(
    `/import/bulk/start?media_type=${media_type}&pages=${pages}&category=${category}`,
    { method: "POST" }
  );
}

export async function verifyArtwork(
  media_type: string,
  sample: number
): Promise<ArtworkVerifyResult[]> {
  return fetchAPI<ArtworkVerifyResult[]>(
    `/admin/artwork/verify?media_type=${media_type}&sample=${sample}`
  );
}

// --- Import Logs ---

export interface ImportLogEntry {
  id: number;
  session_id: number;
  tmdb_id: number | null;
  media_type: string | null;
  level: string;
  message: string;
  created_at: string | null;
}

export async function getImportLogs(
  session_id?: number,
  limit = 100
): Promise<ImportLogEntry[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (session_id !== undefined) params.set("session_id", String(session_id));
  return fetchAPI<ImportLogEntry[]>(`/admin/logs?${params}`);
}

export async function startBackfill(
  media_type: "movie" | "show"
): Promise<{ message: string }> {
  return fetchAPI<{ message: string }>(
    `/admin/backfill/origin?media_type=${media_type}`,
    { method: "POST" }
  );
}
