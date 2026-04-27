#!/usr/bin/env python3
"""
One-time migration: convert ms-0000001 → ms1 format for all nexus_ids.
Run ONCE after deploying the Data Platform v2 code on an existing database.
Safe to run on an empty database — will simply do nothing.

Usage:
    cd /opt/movienexus && docker exec -it movienexus-backend python scripts/migrate_nexus_ids.py
"""
import asyncio
import re
import sys

sys.path.insert(0, "/app")

from sqlalchemy import text
from database import engine

LEGACY_PATTERN = re.compile(r"^([a-z]+)-0*(\d+)$")


def convert_id(old_id: str) -> str:
    """ms-0000550 → ms550"""
    m = LEGACY_PATTERN.match(old_id)
    if m:
        return f"{m.group(1)}{int(m.group(2))}"
    return old_id  # already new format or unknown


async def migrate():
    tables = [
        ("movies", "nexus_id"),
        ("tv_shows", "nexus_id"),
        ("episodes", "nexus_id"),
    ]

    async with engine.begin() as conn:
        for table, col in tables:
            result = await conn.execute(text(f"SELECT id, {col} FROM {table}"))
            rows = result.fetchall()
            updated = 0
            for row_id, nexus_id in rows:
                new_id = convert_id(nexus_id)
                if new_id != nexus_id:
                    await conn.execute(
                        text(f"UPDATE {table} SET {col} = :new WHERE id = :id"),
                        {"new": new_id, "id": row_id},
                    )
                    updated += 1
            print(f"{table}: {updated} IDs updated out of {len(rows)} rows")

    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
