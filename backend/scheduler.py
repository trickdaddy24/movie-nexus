# backend/scheduler.py
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def setup_scheduler() -> None:
    """Register all cron jobs. Call once at app startup."""

    # 2am daily — trending sync (all 3 windows)
    scheduler.add_job(
        _trending_sync_job,
        CronTrigger(hour=2, minute=0),
        id="trending_sync",
        name="Trending sync",
        replace_existing=True,
    )

    # 3am daily — nightly rating sync + backup
    scheduler.add_job(
        _nightly_sync_job,
        CronTrigger(hour=3, minute=0),
        id="nightly_sync",
        name="Nightly rating sync + backup",
        replace_existing=True,
    )

    # 8am daily — Telegram daily trending summary
    scheduler.add_job(
        _trending_summary_job,
        CronTrigger(hour=8, minute=0),
        id="trending_summary",
        name="Telegram daily trending summary",
        replace_existing=True,
    )

    # 4am daily — Plex library sync (only if configured)
    from config import get_settings
    _settings = get_settings()
    if _settings.plex_url and _settings.plex_token:
        scheduler.add_job(
            _plex_sync_job,
            CronTrigger(hour=4, minute=0),
            id="plex_sync",
            name="Plex library sync",
            replace_existing=True,
        )

    scheduler.start()
    _jobs = "trending@2am, ratings+backup@3am, summary@8am"
    if _settings.plex_url and _settings.plex_token:
        _jobs += ", plex@4am"
    logger.info(f"Scheduler started ({_jobs})")


async def _trending_sync_job() -> None:
    logger.info("Running trending sync...")
    from routers.trending import sync_trending_all_windows
    await sync_trending_all_windows()


async def _nightly_sync_job() -> None:
    logger.info("Running nightly rating sync...")
    from routers.admin import sync_ratings_nightly, run_nightly_backup
    await sync_ratings_nightly()
    await run_nightly_backup()


async def _trending_summary_job() -> None:
    logger.info("Sending daily trending summary...")
    from routers.trending import send_daily_trending_summary
    await send_daily_trending_summary()


async def _plex_sync_job() -> None:
    logger.info("Running Plex library sync...")
    from routers.plex import run_plex_sync_job
    await run_plex_sync_job()
