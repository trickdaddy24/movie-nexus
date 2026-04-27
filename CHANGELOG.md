# Changelog

All notable changes to MovieNexus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
