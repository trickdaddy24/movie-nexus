from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Movie, TVShow, Episode

PREFIXES = {
    "movie": "ms",
    "show": "tv",
    "episode": "es",
}

DIGITS = {
    "movie": 7,
    "show": 7,
    "episode": 9,
}

MODELS = {
    "movie": Movie,
    "show": TVShow,
    "episode": Episode,
}


async def generate_nexus_id(db: AsyncSession, media_type: str) -> str:
    prefix = PREFIXES[media_type]
    digits = DIGITS[media_type]
    model = MODELS[media_type]

    result = await db.execute(
        select(func.count()).select_from(model)
    )
    count = result.scalar() or 0
    next_num = count + 1

    return f"{prefix}-{next_num:0{digits}d}"
