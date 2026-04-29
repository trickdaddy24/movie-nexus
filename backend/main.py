import collections
import logging
import re as _re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from config import get_settings
from database import engine, Base, async_session
from api.tmdb import tmdb_client
from api.fanart import fanart_client
from api.plex import plex_client
from nexus_id import ensure_counter_table
from scheduler import scheduler, setup_scheduler
from routers import movies, shows, imports, search, export, stats
from routers import trending, admin, backfill, plex

# In-memory circular log buffer — last 1000 lines, streamed to admin UI
_LOG_BUFFER: collections.deque = collections.deque(maxlen=1000)

class _BufferHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        _LOG_BUFFER.append(self.format(record))

_fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
_buf_handler = _BufferHandler()
_buf_handler.setFormatter(_fmt)
_stream_handler = logging.StreamHandler()
_stream_handler.setFormatter(_fmt)
logging.root.setLevel(logging.INFO)
logging.root.addHandler(_buf_handler)
logging.root.addHandler(_stream_handler)

# Exported for SSE streaming in admin router
log_buffer = _LOG_BUFFER

logger = logging.getLogger("movienexus")


def _read_version() -> str:
    try:
        return Path("/app/../VERSION").read_text().strip()
    except FileNotFoundError:
        return "0.8.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("MovieNexus starting up...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session() as db:
        await ensure_counter_table(db)
    setup_scheduler()
    logger.info("Database tables ready")
    yield
    scheduler.shutdown(wait=False)
    await tmdb_client.close()
    await fanart_client.close()
    await plex_client.close()
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

# Legacy ID redirect: /api/movies/ms-0000001 → /api/movies/ms1
_LEGACY_ID_RE = _re.compile(r"^(/api/(movies|shows|tv_shows)/)([a-z]+-0*(\d+))$")


@app.middleware("http")
async def legacy_id_redirect(request: Request, call_next):
    path = request.url.path
    m = _LEGACY_ID_RE.match(path)
    if m:
        prefix_path = m.group(1)
        old_id = m.group(3)
        new_id = _re.sub(r"-0*(\d+)$", lambda x: x.group(1), old_id)
        if new_id != old_id:
            return RedirectResponse(url=f"{prefix_path}{new_id}", status_code=301)
    return await call_next(request)


app.include_router(movies.router, prefix="/api")
app.include_router(shows.router, prefix="/api")
app.include_router(imports.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(trending.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(backfill.router, prefix="/api")
app.include_router(plex.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": _read_version()}
