# MovieNexus

A full-featured movie and TV show database platform. Import from TMDb, TVDb, Plex, Trakt. Export to JSON/CSV/XML. Track your watch history, create lists, and explore comprehensive metadata.

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](./VERSION)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)
[![GitHub](https://img.shields.io/badge/github-trickdaddy24%2Fmovie--nexus-black?logo=github)](https://github.com/trickdaddy24/movie-nexus)

## Features

### v0.1.0 — Foundation
- ✅ PostgreSQL database with TV episode support
- ✅ TMDb movie + TV show import with SSE streaming
- ✅ Full cast, crew, artwork, and external IDs
- ✅ Search across 500K+ movies and shows
- ✅ Export to JSON (with configurable indent), CSV, XML
- ✅ Public-facing browse interface
- ✅ API-first architecture

### Planned
- **v0.2.0** — TVDb episodes, Trakt ratings, Fanart.tv integration, IMDb scores
- **v0.3.0** — User accounts, watch history, watchlists, Plex library sync
- **v0.4.0** — Advanced filtering, stats dashboard, bulk operations

## Architecture

| Component | Technology |
|-----------|------------|
| Backend | FastAPI + Python |
| Database | PostgreSQL 16 |
| Frontend | Next.js 15 + React + Tailwind |
| Cache | Redis |
| Deployment | Docker Compose + Traefik |
| Data Sources | TMDb, TVDb, IMDb, Trakt, Fanart.tv, Plex |

## Quick Start

### Local Development

```bash
# Clone
git clone https://github.com/trickdaddy24/movie-nexus.git
cd movie-nexus

# Setup environment
cp .env.example .env
# Edit .env with your API keys

# Start services
docker compose up -d

# Backend: http://localhost:8910/docs
# Frontend: http://localhost:3210
```

### API Documentation

Once running, visit `http://localhost:8910/docs` for interactive API docs (Swagger UI).

### Environment Variables

See `.env.example` for all required variables:
- `TMDB_API_KEY` — required
- `TVDB_API_KEY` — required for TV data
- `FANART_API_KEY` — optional
- `TRAKT_CLIENT_ID` — optional
- `PLEX_URL` / `PLEX_TOKEN` — optional for library sync

## Deployment

### Deploy / Redeploy

```bash
# Standard deploy (pull latest, rebuild, restart)
./scripts/deploy.sh main

# Check status
./scripts/deploy.sh status
```

### Backup & Recovery

Automated daily backups run via cron at 3:00 AM, dumping PostgreSQL and the `.env` file to `/opt/movienexus/backups/`. Retention: 7 daily + 4 weekly backups.

```bash
# Manual backup
./scripts/backup-db.sh

# Restore from latest backup
./scripts/restore-db.sh

# Restore from specific file
./scripts/restore-db.sh backups/movienexus_2026-04-17.sql.gz
```

### Full Disaster Recovery

If the server is lost completely:

1. Set up new server with Docker + Saltbox
2. Clone the repo: `git clone https://github.com/trickdaddy24/movie-nexus.git /opt/movienexus`
3. Copy `.env` from backup (or recreate from `.env.example`)
4. Run: `./scripts/deploy.sh main`
5. If DB backup available: `./scripts/restore-db.sh /path/to/backup.sql.gz`
6. If no backup: re-import via API — `POST /api/import/discover/movies?pages=1`

## ID System

MovieNexus uses a custom tagging format:

| Type | Format | Example |
|------|--------|---------|
| Movie | `msXXXXXXX` | `ms0000123` |
| TV Show | `tvXXXXXXX` | `tv0000111` |
| Episode | `esXXXXXXXXX` | `es000001011` |

External identifiers (TMDb, IMDb, TVDb) are stored separately in the database.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed feature planning.

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](./LICENSE)

## Support

- **Docs:** [/docs](./docs)
- **Issues:** [GitHub Issues](https://github.com/trickdaddy24/movie-nexus/issues)
- **Author:** [@trickdaddy24](https://github.com/trickdaddy24)
