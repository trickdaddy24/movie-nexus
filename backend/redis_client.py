import redis.asyncio as aioredis

from config import get_settings

_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    """Return a shared async Redis client, creating it on first call."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _client


async def close_redis() -> None:
    """Close the Redis connection pool."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
