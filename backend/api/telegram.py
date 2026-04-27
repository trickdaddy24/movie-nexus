# backend/api/telegram.py
import logging

import httpx

from config import get_settings

logger = logging.getLogger(__name__)

_TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"


async def send_telegram(message: str) -> bool:
    """Send a Telegram message. Returns True on success, False on failure (never raises)."""
    settings = get_settings()
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        logger.debug("Telegram not configured — skipping notification")
        return False

    url = _TELEGRAM_API.format(token=settings.telegram_bot_token)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json={
                "chat_id": settings.telegram_chat_id,
                "text": message,
                "parse_mode": "HTML",
            })
            resp.raise_for_status()
            return True
    except Exception as e:
        logger.warning(f"Telegram notification failed: {e}")
        return False
