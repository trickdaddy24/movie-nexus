import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from database import engine, Base
from api.tmdb import tmdb_client
from api.fanart import fanart_client
from routers import movies, shows, imports, search, export, stats

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("movienexus")


def _read_version() -> str:
    try:
        return Path("/app/../VERSION").read_text().strip()
    except FileNotFoundError:
        return "0.1.0-alpha"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("MovieNexus starting up...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready")
    yield
    await tmdb_client.close()
    await fanart_client.close()
    await engine.dispose()
    logger.info("MovieNexus shut down")


settings = get_settings()

app = FastAPI(
    title="MovieNexus",
    description="Movie & TV show database with multi-source ratings and artwork",
    version=_read_version(),
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(movies.router, prefix="/api")
app.include_router(shows.router, prefix="/api")
app.include_router(imports.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(stats.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": _read_version()}
