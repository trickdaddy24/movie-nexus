import asyncio
import re
import logging

import httpx

from config import get_settings

logger = logging.getLogger(__name__)


class PlexClient:
    """Async Plex Media Server API client."""

    def __init__(self):
        settings = get_settings()
        self.base_url = (settings.plex_url or "").rstrip("/")
        self.token = settings.plex_token or ""
        self._client: httpx.AsyncClient | None = None
        self._semaphore = asyncio.Semaphore(10)

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.token)

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers={
                    "X-Plex-Token": self.token,
                    "Accept": "application/json",
                },
                timeout=30.0,
            )
        return self._client

    async def _get(self, path: str, params: dict | None = None) -> dict:
        async with self._semaphore:
            client = await self._get_client()
            resp = await client.get(path, params=params)
            resp.raise_for_status()
            return resp.json()

    # ── Library browsing ──

    async def get_libraries(self) -> list[dict]:
        """Return list of library sections with key, type, title."""
        data = await self._get("/library/sections")
        sections = []
        for d in data.get("MediaContainer", {}).get("Directory", []):
            sections.append({
                "key": d["key"],
                "type": d["type"],        # "movie" or "show"
                "title": d["title"],
                "count": d.get("count", 0),
            })
        return sections

    async def get_all_items(self, library_key: str) -> list[dict]:
        """Return every item in a library section. Handles pagination."""
        items: list[dict] = []
        start = 0
        size = 500
        while True:
            data = await self._get(
                f"/library/sections/{library_key}/all",
                params={
                    "X-Plex-Container-Start": start,
                    "X-Plex-Container-Size": size,
                    "includeGuids": 1,
                },
            )
            container = data.get("MediaContainer", {})
            batch = container.get("Metadata", [])
            if not batch:
                break
            items.extend(batch)
            total = container.get("totalSize", len(items))
            start += len(batch)
            if start >= total:
                break
        return items

    async def get_item_metadata(self, rating_key: str) -> dict:
        """Full metadata for a single item (movie or show)."""
        data = await self._get(
            f"/library/metadata/{rating_key}",
            params={"includeGuids": 1},
        )
        items = data.get("MediaContainer", {}).get("Metadata", [])
        return items[0] if items else {}

    async def get_item_children(self, rating_key: str) -> list[dict]:
        """Children of an item — seasons for a show, episodes for a season."""
        data = await self._get(f"/library/metadata/{rating_key}/children")
        return data.get("MediaContainer", {}).get("Metadata", [])

    # ── GUID extraction ──

    _TMDB_RE = re.compile(r"(?:tmdb://|agents\.themoviedb://|agents\.hama://tmdb-)(\d+)")
    _IMDB_RE = re.compile(r"(?:imdb://)(tt\d+)")
    _TVDB_RE = re.compile(r"(?:tvdb://|agents\.thetvdb://|agents\.hama://tvdb-)(\d+)")

    def extract_tmdb_id(self, guids: list) -> int | None:
        for g in guids:
            gid = g.get("id", "") if isinstance(g, dict) else str(g)
            m = self._TMDB_RE.search(gid)
            if m:
                return int(m.group(1))
        return None

    def extract_imdb_id(self, guids: list) -> str | None:
        for g in guids:
            gid = g.get("id", "") if isinstance(g, dict) else str(g)
            m = self._IMDB_RE.search(gid)
            if m:
                return m.group(1)
        return None

    def extract_tvdb_id(self, guids: list) -> int | None:
        for g in guids:
            gid = g.get("id", "") if isinstance(g, dict) else str(g)
            m = self._TVDB_RE.search(gid)
            if m:
                return int(m.group(1))
        return None

    def get_image_url(self, thumb_path: str) -> str:
        """Build full URL for a Plex image path."""
        if not thumb_path:
            return ""
        return f"{self.base_url}{thumb_path}?X-Plex-Token={self.token}"

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


plex_client = PlexClient()
