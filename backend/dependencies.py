from fastapi import Header, HTTPException

from config import get_settings


async def require_read_key(x_api_key: str = Header(alias="X-Api-Key", default="")) -> None:
    """Dependency that enforces READ_API_KEY on read-only endpoints."""
    settings = get_settings()
    if not settings.read_api_key:
        return  # No key configured — open access (dev mode)
    if x_api_key != settings.read_api_key:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")


async def require_admin_key(x_api_key: str = Header(alias="X-Api-Key", default="")) -> None:
    """Dependency that enforces ADMIN_API_KEY on write/admin endpoints."""
    settings = get_settings()
    if not settings.admin_api_key:
        return  # No key configured — open access (dev mode)
    if x_api_key != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")
