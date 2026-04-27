# backend/api/trakt.py
import asyncio
import logging

import httpx

from config import get_settings

logger = logging.getLogger(__name__)

BASE_URL = "https://api.trakt.tv"


class TraktClient:
    def __init__(self):
        settings = get_settings()
        self.client_id = settings.trakt_client_id
        self._client: httpx.AsyncClient | None = None
        self._semaphore = asyncio.Semaphore(5)

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=BASE_URL,
                headers={
                    "Content-Type": "application/json",
                    "trakt-api-version": "2",
                    "trakt-api-key": self.client_id,
                },
                timeout=30.0,
            )
        return self._client

    async def _get(self, path: str, params: dict | None = None) -> list | dict:
        async with self._semaphore:
            client = await self._get_client()
            resp = await client.get(path, params=params)
            if resp.status_code == 429:
                await asyncio.sleep(int(resp.headers.get("Retry-After", 5)))
                resp = await client.get(path, params=params)
            resp.raise_for_status()
            return resp.json()

    async def get_trending_movies(self, limit: int = 10) -> list[dict]:
        """Returns list of {watchers, movie:{title, year, ids:{trakt,tmdb,imdb}}}"""
        return await self._get("/movies/trending", {"limit": limit, "extended": "full"})

    async def get_trending_shows(self, limit: int = 10) -> list[dict]:
        """Returns list of {watchers, show:{title, year, ids:{trakt,tmdb,imdb}}}"""
        return await self._get("/shows/trending", {"limit": limit, "extended": "full"})

    async def get_popular_movies(self, limit: int = 100) -> list[dict]:
        return await self._get("/movies/popular", {"limit": limit, "extended": "full"})

    async def get_popular_shows(self, limit: int = 100) -> list[dict]:
        return await self._get("/shows/popular", {"limit": limit, "extended": "full"})

    async def get_movie_ratings(self, trakt_slug: str) -> dict:
        """Returns {rating, votes, distribution}"""
        return await self._get(f"/movies/{trakt_slug}/ratings")

    async def get_show_ratings(self, trakt_slug: str) -> dict:
        return await self._get(f"/shows/{trakt_slug}/ratings")

    async def get_weekly_trending_movies(self, limit: int = 100) -> list[dict]:
        """Use played endpoint for weekly window."""
        return await self._get("/movies/played/weekly", {"limit": limit, "extended": "full"})

    async def get_weekly_trending_shows(self, limit: int = 100) -> list[dict]:
        return await self._get("/shows/played/weekly", {"limit": limit, "extended": "full"})

    async def get_alltime_trending_movies(self, limit: int = 100) -> list[dict]:
        return await self._get("/movies/played/all", {"limit": limit, "extended": "full"})

    async def get_alltime_trending_shows(self, limit: int = 100) -> list[dict]:
        return await self._get("/shows/played/all", {"limit": limit, "extended": "full"})

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


trakt_client = TraktClient()
