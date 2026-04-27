from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Prefix registry — maps media_type key → ID prefix
PREFIXES = {
    "movie":         "ms",
    "show":          "tv",
    "episode":       "es",
    "anime":         "an",
    "anime_episode": "ae",
    "youtube":       "yt",
    "channel":       "yc",
    "ufc_event":     "ufc",
    "ufc_fight":     "uf",
    "wwe_event":     "wwe",
    "wwe_match":     "wm",
}

_COUNTER_TABLE = "nexus_id_counters"


async def generate_nexus_id(db: AsyncSession, media_type: str) -> str:
    """Generate next nexus_id for the given media_type. Atomic via INSERT ON CONFLICT."""
    prefix = PREFIXES[media_type]

    await db.execute(
        text(f"""
            INSERT INTO {_COUNTER_TABLE} (media_type, next_val)
            VALUES (:mt, 1)
            ON CONFLICT (media_type) DO UPDATE
            SET next_val = {_COUNTER_TABLE}.next_val + 1
        """),
        {"mt": media_type},
    )
    result = await db.execute(
        text(f"SELECT next_val FROM {_COUNTER_TABLE} WHERE media_type = :mt"),
        {"mt": media_type},
    )
    next_val = result.scalar()
    return f"{prefix}{next_val}"


async def ensure_counter_table(db: AsyncSession) -> None:
    """Create the nexus_id_counters table if it doesn't exist. Call once at startup."""
    await db.execute(
        text(f"""
            CREATE TABLE IF NOT EXISTS {_COUNTER_TABLE} (
                media_type VARCHAR(20) PRIMARY KEY,
                next_val   BIGINT NOT NULL DEFAULT 0
            )
        """)
    )
    await db.commit()
