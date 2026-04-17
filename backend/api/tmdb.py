import asyncio
import httpx

from config import get_settings

BASE_URL = "https://api.themoviedb.org/3"
IMAGE_BASE = "https://image.tmdb.org/t/p"


class TMDbClient:
    def __init__(self):
        settings = get_settings()
        self.api_key = settings.tmdb_api_key
        self._client: httpx.AsyncClient | None = None
        self._semaphore = asyncio.Semaphore(35)

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=BASE_URL,
                params={"api_key": self.api_key},
                timeout=30.0,
            )
        return self._client

    async def _get(self, path: str, params: dict | None = None) -> dict:
        async with self._semaphore:
            client = await self._get_client()
            resp = await client.get(path, params=params)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 2))
                await asyncio.sleep(retry_after)
                resp = await client.get(path, params=params)
            resp.raise_for_status()
            return resp.json()

    async def search_movie(self, query: str, year: int | None = None, page: int = 1) -> dict:
        params = {"query": query, "page": page}
        if year:
            params["year"] = year
        return await self._get("/search/movie", params)

    async def search_tv(self, query: str, year: int | None = None, page: int = 1) -> dict:
        params = {"query": query, "page": page}
        if year:
            params["first_air_date_year"] = year
        return await self._get("/search/tv", params)

    async def get_movie(self, tmdb_id: int) -> dict:
        return await self._get(
            f"/movie/{tmdb_id}",
            {"append_to_response": "credits,images,external_ids,videos,release_dates"},
        )

    async def get_tv(self, tmdb_id: int) -> dict:
        return await self._get(
            f"/tv/{tmdb_id}",
            {"append_to_response": "credits,images,external_ids,content_ratings"},
        )

    async def get_tv_season(self, tmdb_id: int, season_number: int) -> dict:
        return await self._get(f"/tv/{tmdb_id}/season/{season_number}")

    async def get_person(self, person_id: int) -> dict:
        return await self._get(
            f"/person/{person_id}",
            {"append_to_response": "combined_credits"},
        )

    async def get_popular_movies(self, page: int = 1) -> dict:
        return await self._get("/movie/popular", {"page": page})

    async def get_popular_tv(self, page: int = 1) -> dict:
        return await self._get("/tv/popular", {"page": page})

    async def discover_movies(self, page: int = 1, sort_by: str = "popularity.desc", **filters) -> dict:
        params = {"page": page, "sort_by": sort_by, **filters}
        return await self._get("/discover/movie", params)

    async def discover_tv(self, page: int = 1, sort_by: str = "popularity.desc", **filters) -> dict:
        params = {"page": page, "sort_by": sort_by, **filters}
        return await self._get("/discover/tv", params)

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


tmdb_client = TMDbClient()
