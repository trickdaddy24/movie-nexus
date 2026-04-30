# Changelog

All notable changes to MovieNexus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2026-04-30

### Added
- Two-tier API key protection: `READ_API_KEY` for read endpoints, `ADMIN_API_KEY` for admin/write endpoints
- Emergency admin bypass token (`ADMIN_BYPASS_TOKEN`) — visit `/admin?bypass=TOKEN` to set 24-hour access cookie
- Server-side proxy route for client-side admin API calls (auth-gated)
- API key headers on all frontend-to-backend fetches

### Changed
- Swagger UI (`/api/docs`) disabled when `ADMIN_API_KEY` is configured
- All API endpoints now require appropriate API key when keys are configured

## [0.8.0] - 2026-04-29

### Added
- Clickable genre tags on media cards and detail pages — navigate to `/movies?genre=X` or `/shows?genre=X`
- Genre filter chip on list pages with removable pill UI
- Nexus/TMDb/IMDb/TVDB ID row on movie and TV show detail pages with external links
- TV show artwork pipeline — Fanart.tv + TMDb backdrops now fetched during import
- Artwork backfill endpoint (`POST /admin/backfill/artwork`) with throttled Telegram notifications
- Artwork backfill button on admin page (Backfill Movie Art / Backfill TV Art)

### Fixed
- Telegram notifications not working — env vars missing from docker-compose.yml
- Admin page dark mode contrast — section headings and cards now use proper dark colors
- TV show import missing Fanart.tv artwork and TMDb backdrops

## [0.7.0] - 2026-04-29

### Added
- Dedicated Plex Dashboard at `/admin/plex` — per-library progress cards, item-level activity feed, sync history table
- Per-library tracking with status transitions: queued → scanning → syncing → done
- Item-level activity feed — terminal-style dark pane with action badges (ADD/SKIP/FAIL), auto-scroll, 200-item cap
- SSE named events: `progress` (full state), `items` (delta feed), `complete` (final)
- Telegram notifications on Plex sync start (library list) and complete (counts + duration)
- `GET /plex/history` endpoint — recent Plex sync sessions with computed duration
- Compact Plex widget on `/admin` page linking to dedicated dashboard

## [0.6.0] - 2026-04-29

### Added
- Plex Media Server integration — sync libraries, import new items, fill metadata gaps
- Plex API client (`backend/api/plex.py`) with async httpx, GUID extraction (TMDb/IMDb/TVDB), pagination
- Plex sync router (`backend/routers/plex.py`) — endpoints: status, sync, refresh artwork, SSE progress
- Nightly 4am Plex library sync (scheduler, only when configured)
- Plex artwork refresh — replaces non-English fanart with Plex English artwork
- Gap-filling from Plex data (overview, tagline, runtime, content_rating, genres)
- Poster source ordering: plex > tmdb > fanart, English language preferred
- Admin panel Plex section — connection status, library list, sync/refresh buttons, live progress
- Frontend API functions for Plex status, sync, and refresh

## [0.5.0] - 2026-04-28

### Added
- 8 browsing categories: All, USA, Foreign, Anime, Korean, Indian, Documentary, Kids
- Category tab bar on `/movies` and `/shows` pages (URL param `?category=`, shareable)
- Origin badge (flag + country name) on every MediaCard
- Origin detail section on movie and show detail pages (flag, country, language, category badge)
- `origin_country` and `original_language` columns on Movie and TVShow models
- Category-filtered bulk imports via TMDb Discover API (`?category=anime`, etc.)
- USA-first default sort on "All" tab (US content surfaces first)
- Backfill endpoint (`POST /api/admin/backfill/origin`) to populate origin data for existing records
- Backfill buttons in Admin UI with loading state
- Admin bulk import form: Category dropdown + preview line showing estimated import count
- `origin_country` and `original_language` fields in all export formats (JSON/CSV/XML)
- Shared `src/lib/origin.ts` (COUNTRY_MAP, LANGUAGE_MAP, getCategoryLabel)

### Fixed
- Dark mode color contrast: replaced `#64748B`/`nexus-muted` text with `#94A3B8` across MediaCard, movie detail, and show detail pages
- Genre tag borders in dark mode: `#1E2A5A` → `#2D3A6B` for better readability

## [Unreleased]

### Planned for v0.1.0
- PostgreSQL schema with migrations
- TMDb movie + TV show + episode import
- SSE-based import streaming
- Basic search (title, year, genres)
- Export to JSON (configurable indent), CSV, XML
- Public browse UI
- API documentation (Swagger)

### Planned for v0.2.0
- TVDb integration for enhanced episode data
- Trakt.tv ratings integration
- Fanart.tv poster/backdrop/logo support
- IMDb rating sync
- Person/cast detail pages
- Related movies/shows recommendations

### Planned for v0.3.0
- User authentication (JWT)
- Watch history tracking
- User ratings and reviews
- Watchlists and custom lists
- Plex library sync
- User preferences

### Planned for v0.4.0
- Advanced filtering (genre, year, rating, runtime, language)
- Statistics dashboard
- Bulk operations
- API key management UI
- Admin panel

## [0.5.0] — 2026-04-27

### Added
- Auth.js v5 + Prisma + SQLite admin authentication (Login X model)
- Hidden superadmin — env-only credentials, never stored in database
- Next.js middleware protecting all /admin routes → /login redirect
- Login page with MovieNexus nexus theme (dark/light mode)
- ImportLog PostgreSQL table — per-record import failure tracking
- In-memory circular log buffer (deque 1000 lines) in backend
- GET /api/admin/logs — paginated per-record error logs with session_id filter
- GET /api/admin/logs/stream — SSE stream of live backend log output
- Import Error Logs section on admin page (filterable by session ID)
- Live Backend Logs section on admin page (terminal-style dark pane)

## [0.4.0] — 2026-04-27

### Added
- Admin interface at `/admin`: live bulk import monitor with SSE progress bar + ETA
- Import session history table with click-to-reconnect SSE on live sessions
- One-click export downloads (JSON/CSV/XML × Movies/TV Shows) — 6 buttons
- Artwork verification spot-check UI (sample=50 per media type)
- Start Bulk Import form with media_type + pages controls
- Admin nav link in header (between TV Shows and SearchBar)
- `GET /api/import/sessions` endpoint — returns recent sessions merged with live `_active_jobs` data

## [0.3.0] — 2026-04-27

### Added
- Data Platform v2 foundation
- ID system rewrite: 11 media types, no padding/dash (ms1, tv550, etc.), atomic counter table
- Bulk import pipeline: POST /api/import/bulk/start — crawls TMDb discover (50k movies / 20k shows), Telegram notification every 10k records
- Trakt API client (trending, popular, ratings endpoints)
- TrendingSnapshot table with daily/weekly/alltime windows
- GET /api/trending endpoint (latest snapshots by media_type + window)
- Multi-source rating sync: nightly TMDb update with Telegram alerts on drops >2pts or IMDb ID changes
- Artwork verification: GET /api/admin/artwork/verify — SHA-256 hash + Pillow dimension checks
- Admin export: GET /api/admin/export (JSON indent=4, CSV, XML)
- Nightly automated backup to /opt/movienexus/backups/YYYY-MM-DD/ with Telegram confirmation
- APScheduler cron jobs: trending@2am, rating sync+backup@3am, trending summary@8am
- Legacy ID redirect: GET /api/movies/ms-0000001 → 301 → /api/movies/ms1
- One-time migration script: scripts/migrate_nexus_ids.py
- Telegram notification helper (api/telegram.py)

## [0.2.1] — 2026-04-27

### Added
- Animated flowing gradient on LogoBrand component — 9-color cycle (dark purple, hot pink, yellow, green, cyan, blue, mint, purple) flowing right-to-left at 38s per cycle
- `@keyframes gradient-flow` in globals.css for smooth continuous background-position animation

### Fixed
- `frontend/src/lib/api.ts` was missing from server deployment — added to repo and redeployed
- Created `frontend/public/` directory (required for Docker multi-stage build)

### Infrastructure
- Redeployed to fresh Hetzner Server 2 (Ubuntu 24.04, 95.217.229.185) after server rebuild
- Docker partition expanded to 100GB loop file on 4TB RAID
- Traefik + Authelia installed on Server 2 via Saltbox
- All API keys reconstructed and stored in `.env`

## [0.2.0] — 2026-04-18

### Added
- Full dark/light mode theme (neon cyberpunk dark + Stripe-clean light)
- LogoBrand component with cyan-to-purple gradient and glow animation
- ThemeToggle component
- Nexus color token system in Tailwind config
- All pages themed with dark mode overrides

## [0.1.0] — 2026-04-17

### Added
- Full FastAPI backend with async SQLAlchemy (asyncpg) + PostgreSQL 16
- TMDb movie + TV show import pipeline with SSE progress streaming
- Fanart.tv artwork integration (posters, backdrops, logos, clearart, disc, banner)
- Search across movies and TV shows (ILIKE, sorted by popularity)
- Export to JSON (configurable indent), CSV, XML
- Next.js 15 frontend with dark theme, poster images, responsive grid layout
- Movie and TV show list pages with pagination
- Detail pages with ratings (TMDb/IMDb/Trakt), genres, seasons/episodes
- API docs at /api/docs (Swagger UI)
- Deploy script (`scripts/deploy.sh`) with main/restore/status commands
- Automated daily PostgreSQL backup (`scripts/backup-db.sh`) with 7-day + 4-week retention
- Database restore script (`scripts/restore-db.sh`)
- Docker Compose with Traefik integration (Saltbox pattern)
- Nexus ID system: ms-XXXXXXX (movies), tv-XXXXXXX (shows), es-XXXXXXXXX (episodes)

## [0.1.0-alpha] — 2026-04-17

### Added
- Initial project scaffolding
- Database schema design
- Docker Compose configuration
- README, ROADMAP, CHANGELOG

---

**Legend:**
- `Added` — new features
- `Changed` — changes to existing functionality
- `Deprecated` — soon-to-be removed features
- `Removed` — removed features
- `Fixed` — bug fixes
- `Security` — security fixes
