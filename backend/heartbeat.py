# backend/heartbeat.py
import logging
import platform
import random
import socket
from datetime import datetime

import httpx
from sqlalchemy import text

from api.telegram import send_telegram
from database import async_session
from redis_client import get_redis

logger = logging.getLogger(__name__)

SERVICES = ["movienexus-db", "movienexus-redis", "movienexus-backend", "movienexus-frontend"]


async def _check_postgres() -> tuple[str, str]:
    """Check PostgreSQL connectivity via a simple query."""
    try:
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        return "movienexus-db", "running"
    except Exception as e:
        logger.warning(f"Heartbeat: PostgreSQL check failed: {e}")
        return "movienexus-db", f"DOWN ({e.__class__.__name__})"


async def _check_redis() -> tuple[str, str]:
    """Check Redis connectivity via PING."""
    try:
        r = await get_redis()
        pong = await r.ping()
        return "movienexus-redis", "running" if pong else "DOWN (no PONG)"
    except Exception as e:
        logger.warning(f"Heartbeat: Redis check failed: {e}")
        return "movienexus-redis", f"DOWN ({e.__class__.__name__})"


async def _check_frontend() -> tuple[str, str]:
    """Check frontend via HTTP request to internal Docker hostname."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("http://movienexus-frontend:3000/")
            if resp.status_code < 500:
                return "movienexus-frontend", "running"
            return "movienexus-frontend", f"DOWN (HTTP {resp.status_code})"
    except Exception as e:
        logger.warning(f"Heartbeat: Frontend check failed: {e}")
        return "movienexus-frontend", f"DOWN ({e.__class__.__name__})"


async def _get_remote_ip() -> str:
    """Get the server's public IP address."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://ifconfig.me/ip")
            return resp.text.strip()
    except Exception:
        return "unknown"


def _get_local_ip() -> str:
    """Get the container's local IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "unknown"


async def run_heartbeat() -> None:
    """Run health checks on all services and send a Telegram report."""
    logger.info("Running heartbeat check...")

    # Check all services
    db_name, db_status = await _check_postgres()
    redis_name, redis_status = await _check_redis()
    fe_name, fe_status = await _check_frontend()

    # Backend is implicitly running (we're executing this code)
    be_status = "running"

    # System info
    remote_ip = await _get_remote_ip()
    local_ip = _get_local_ip()
    os_info = f"{platform.system()} {platform.release()} ({platform.machine()})"
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")

    all_ok = all(s == "running" for s in [db_status, redis_status, be_status, fe_status])
    status_icon = "\u2705" if all_ok else "\u26a0\ufe0f"

    message = (
        f"{status_icon} <b>MovieNexus Heartbeat</b>\n"
        f"\n"
        f"<b>Services:</b>\n"
        f"  {'✅' if db_status == 'running' else '❌'} <code>movienexus-db</code> — {db_status}\n"
        f"  {'✅' if redis_status == 'running' else '❌'} <code>movienexus-redis</code> — {redis_status}\n"
        f"  {'✅' if be_status == 'running' else '❌'} <code>movienexus-backend</code> — {be_status}\n"
        f"  {'✅' if fe_status == 'running' else '❌'} <code>movienexus-frontend</code> — {fe_status}\n"
        f"\n"
        f"<b>Network:</b>\n"
        f"  Remote IP: <code>{remote_ip}</code>\n"
        f"  Local IP: <code>{local_ip}</code>\n"
        f"\n"
        f"<b>System:</b>\n"
        f"  OS: <code>{os_info}</code>\n"
        f"  Time: <code>{now}</code>"
    )

    sent = await send_telegram(message)
    if sent:
        logger.info("Heartbeat sent to Telegram")
    else:
        logger.warning("Heartbeat failed to send to Telegram")


def get_random_heartbeat_schedule() -> tuple[int, int]:
    """Pick a random hour (1-11) and minute (0-59) for Eastern timezone.

    Range: 1:00 AM – 11:59 AM Eastern (12pm exclusive to avoid noon exactly).
    """
    hour = random.randint(1, 11)
    minute = random.randint(0, 59)
    return hour, minute
