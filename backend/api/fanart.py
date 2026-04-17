import httpx

from config import get_settings

BASE_URL = "https://webservice.fanart.tv/v3"

ART_TYPES_MOVIE = ["movieposter", "moviebackground", "movielogo", "moviedisc", "moviebanner", "hdmovieclearart"]
ART_TYPES_TV = ["tvposter", "showbackground", "hdtvlogo", "tvbanner", "clearart", "hdclearart"]


class FanartClient:
    def __init__(self):
        settings = get_settings()
        self.api_key = settings.fanart_api_key
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=BASE_URL,
                params={"api_key": self.api_key},
                timeout=30.0,
            )
        return self._client

    async def get_movie_images(self, tmdb_id: int) -> dict:
        if not self.api_key:
            return {}
        client = await self._get_client()
        resp = await client.get(f"/movies/{tmdb_id}")
        if resp.status_code == 404:
            return {}
        resp.raise_for_status()
        return resp.json()

    async def get_tv_images(self, tvdb_id: int) -> dict:
        if not self.api_key:
            return {}
        client = await self._get_client()
        resp = await client.get(f"/tv/{tvdb_id}")
        if resp.status_code == 404:
            return {}
        resp.raise_for_status()
        return resp.json()

    def parse_images(self, data: dict, media_type: str) -> list[dict]:
        art_types = ART_TYPES_MOVIE if media_type == "movie" else ART_TYPES_TV
        type_map = {
            "movieposter": "poster", "tvposter": "poster",
            "moviebackground": "backdrop", "showbackground": "backdrop",
            "movielogo": "logo", "hdtvlogo": "logo",
            "moviedisc": "disc",
            "moviebanner": "banner", "tvbanner": "banner",
            "hdmovieclearart": "clearart", "clearart": "clearart", "hdclearart": "clearart",
        }
        results = []
        for art_key in art_types:
            for img in data.get(art_key, []):
                results.append({
                    "source": "fanart",
                    "type": type_map.get(art_key, art_key),
                    "url": img.get("url", ""),
                    "language": img.get("lang"),
                    "likes": int(img.get("likes", 0)),
                })
        return results

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


fanart_client = FanartClient()
