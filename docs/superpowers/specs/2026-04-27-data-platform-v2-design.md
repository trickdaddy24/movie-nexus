# MovieNexus — Data Platform v2 Design

**Date:** 2026-04-27
**Status:** Approved
**Scope:** Foundation layer for MovieNexus as a comprehensive media database platform

---

## Context

MovieNexus is evolving from a personal media tracker (~20 movies) into a comprehensive media database covering every movie, TV show, anime, UFC PPV, WWE event, and YouTube content ever made — comparable to IMDb in scope. Data Platform v2 is the foundation everything else builds on: ID reform, bulk ingestion at scale, trending data, and multi-source rating sync.

---

## Section 1: ID Reform

### New Format
All Nexus IDs remove the dash and zero-padding. Format: `{prefix}{integer}`

| Media Type | Prefix | Example |
|---|---|---|
| Movie | `ms` | `ms550` |
| TV Show | `tv` | `tv1399` |
| Episode | `es` | `es12345` |
| Anime | `an` | `an1` |
| Anime Episode | `ae` | `ae1001` |
| YouTube Video | `yt` | `yt1` |
| YouTube Channel | `yc` | `yc1` |
| UFC PPV Event | `ufc` | `ufc1` |
| UFC Fight | `uf` | `uf1` |
| WWE Event | `wwe` | `wwe1` |
| WWE Match | `wm` | `wm1` |

### Migration
- One-time migration script updates all rows in `movies`, `tv_shows`, `episodes` + any FK references
- `nexus_id.py` rewritten: auto-increment integer per media type, no padding, no dash
- Old IDs redirected via API: `GET /movies/ms-0000001` → 301 → `GET /movies/ms1`
- Backward compatibility maintained for 90 days then deprecated

---

## Section 2: Bulk Ingestion Pipeline

### Three-Phase Strategy
All three phases run simultaneously after launch.

**Phase 2 — On-demand hydration (active from day one)**
- Any media not in DB gets auto-fetched from TMDb when first requested
- Transparent to the caller — always returns a result
- First hit ~1–2s slower, cached immediately after
- Fallback: if TMDb is down, return 503 with `Retry-After` header

**Phase 1 — Bulk import (runs in background after launch)**
- Top 50,000 movies by TMDb popularity
- Top 20,000 TV shows by TMDb popularity
- Stores: metadata, ratings, genres, artwork, cast/crew
- Resumable: progress tracked in `ImportSession` table
- Estimated runtime: 8–12 hours

**Phase 3 — Nightly sync (runs forever at 3am)**
- Updates ratings for all existing records
- Adds newly released titles (added to TMDb in last 24hrs)
- Incremental diffs only — low API usage

### Telegram Notifications
- Every 10,000 records imported → Telegram summary: titles added, skipped, failed, total count, ETA
- Final message on bulk import completion with full stats
- Nightly sync completion confirmation after backup

### Artwork Verification
Three-layer quality check on every image stored:
1. **Hash check** — SHA-256 of image bytes stored in `Artwork` table; flag zero/placeholder hashes
2. **Dimension validation** — posters min `500×750px`, backdrops min `1280×720px`; reject undersized images
3. **Admin spot-check endpoint** — `GET /api/admin/artwork/verify?media_type=movie&sample=50` renders 50 random posters for visual review
4. **Fanart.tv quality filter** — prefer `likes > 0` and `language = en`; sort by like count descending

### DB Export & Backup
- On-demand: `GET /api/admin/export?format=json|csv|xml`
- JSON exported with `indent=4`
- Nightly automated backup after sync: saves JSON + CSV + XML to `/opt/movienexus/backups/YYYY-MM-DD/`
- 30-day local retention
- Backup completion → Telegram confirmation via Notifier project

---

## Section 3: Trending Data

### Storage
New `TrendingSnapshot` table:
```
nexus_id       — linked to catalog
media_type     — movie/show/anime/etc
window         — daily/weekly/alltime
rank           — position in trending list
watcher_count  — number of platform users watching
snapshot_date  — when recorded
```

Historical snapshots retained — enables "what was trending on date X" queries.

### Sync Schedule
Daily cron at 2am pulls all three windows (daily/weekly/all-time).

### Sources by Media Type
| Agent | Trending Source |
|---|---|
| Movies | Trakt + TMDb |
| TV Shows | Trakt + TMDb |
| Anime | Trakt + AniList |
| UFC / WWE | Manual / scheduled (no public trending API) |
| YouTube | YouTube Data API (view counts, trending feed) |

### Telegram Notification
Daily at 8am: top 10 trending movies + top 10 trending shows sent to Telegram.

---

## Section 4: Multi-Source Rating Sync

### Sync Schedule
| Source | Frequency | Method |
|---|---|---|
| TMDb | Nightly | Direct API |
| IMDb | Nightly | Via TMDb `external_ids` endpoint |
| Trakt | Nightly | `/movies/{id}/ratings` |
| TVDb | Weekly | TVDb API |
| AniList | Nightly | AniList GraphQL API |

### What Gets Synced
- Ratings + vote counts
- Popularity scores
- Runtime changes (director's cuts, re-releases)
- New community artwork

### Quality Control
- Rating drops >2 points in one cycle → Telegram alert (likely data error)
- IMDb ID change on existing record → logged + Telegram alert
- Weekly Sunday summary: top 10 biggest rating movers (up and down)

---

## Architecture Notes

### New Tables Required
- `TrendingSnapshot` — trending data with time windows
- Update `Artwork` — add `hash` (SHA-256), `width`, `height` columns
- Update `nexus_id.py` — new ID generator for all 11 media types

### Updated Endpoints
- `GET /api/trending?window=daily|weekly|alltime&media_type=movie|show|anime`
- `GET /api/admin/export?format=json|csv|xml`
- `GET /api/admin/artwork/verify?media_type=&sample=`
- `GET /api/admin/import/start?type=bulk|sync`
- Legacy redirect: `GET /movies/ms-0000001` → 301 → `/movies/ms1`

### Dependencies
- Trakt API key (already have `TRAKT_CLIENT_ID`)
- AniList GraphQL — no key required (public API)
- YouTube Data API key — new, required for YouTube agent
- Notifier project (`notifier.py`) — Telegram delivery

---

## What This Does NOT Include
The following are separate sub-projects to be specced independently:
- Agent system (movie, TV, YouTube, WWE, UFC, anime agents)
- Personal client (user accounts, watch history, watchlists)
- Public API (rate limiting, abuse detection, tiers)
- Monetization (free vs. paid, subscriptions)
- Minus One Labs footer branding
