from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@db:5432/movienexus"
    redis_url: str = "redis://redis:6379/0"
    tmdb_api_key: str = ""
    tvdb_api_key: str = ""
    fanart_api_key: str = ""
    trakt_client_id: str = ""
    plex_url: str = ""
    plex_token: str = ""
    secret_key: str = "changeme"
    debug: bool = False
    telegram_bot_token: str = ""   # e.g. 123456:ABC-DEF...
    telegram_chat_id: str = ""     # e.g. -1001234567890
    read_api_key: str = ""         # required for all read endpoints
    admin_api_key: str = ""        # required for all write/admin endpoints

    model_config = {"env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
