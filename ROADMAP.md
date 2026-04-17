# MovieNexus Roadmap

High-level feature roadmap with estimated timelines.

## v0.1.0 — Foundation (Current)

**Goal:** Core database + import/export + public browse

- [x] Project initialization
- [ ] PostgreSQL schema & migrations
- [ ] FastAPI backend setup
- [ ] Next.js frontend setup
- [ ] TMDb API integration (movies + TV)
- [ ] Movie/show import with SSE streaming
- [ ] Search (basic title/year/genre)
- [ ] Export to JSON/CSV/XML with configurable options
- [ ] Public movie/show browse UI
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Docker Compose + Traefik deployment config
- [ ] README + deployment guide

**Timeline:** 4-6 weeks

## v0.2.0 — Enrichment

**Goal:** Multi-source ratings + enhanced artwork + cast details

- [ ] TVDb integration for episodes
- [ ] Trakt.tv ratings (vote counts, popularity)
- [ ] Fanart.tv artwork (posters, logos, banners, clearart)
- [ ] IMDb rating scraping or API integration (if available)
- [ ] Person/cast detail pages
- [ ] Person search
- [ ] Related movies/shows (based on genres, keywords)
- [ ] Ratings aggregation (avg of TMDb, IMDb, Trakt)
- [ ] Language support for titles/overviews

**Timeline:** 3-4 weeks after v0.1.0

## v0.3.0 — Personal Tracking

**Goal:** User accounts + watch history + lists

- [ ] User authentication (JWT via existing auth_utils)
- [ ] Watch history tracking
- [ ] User ratings & personal reviews
- [ ] Watchlist (movies to watch)
- [ ] Favorites list
- [ ] Custom user lists
- [ ] List sharing (optional)
- [ ] Plex library sync (auto-add watched movies)
- [ ] User profile pages
- [ ] Activity feed

**Timeline:** 4 weeks after v0.2.0

## v0.4.0 — Advanced Features

**Goal:** Filtering, stats, admin panel, bulk operations

- [ ] Advanced filtering (genre, year, rating, runtime, language, content rating)
- [ ] Sort options (rating, release date, alphabetical, popularity, user ratings)
- [ ] Statistics dashboard (total movies, total hours watched, genre breakdown)
- [ ] Bulk import from files or URLs
- [ ] API key management UI
- [ ] Admin panel (manage users, imports, data)
- [ ] Backup/restore functionality
- [ ] Rate limiting & usage stats
- [ ] Full-text search (elasticsearch optional)

**Timeline:** 4-5 weeks after v0.3.0

## Future (Post-v0.4.0)

- [ ] Mobile app (React Native)
- [ ] Streaming availability integration (JustWatch API)
- [ ] Social features (follow users, see what friends watched)
- [ ] Recommendations engine (collaborative filtering)
- [ ] IMDb watchlist sync
- [ ] Letterboxd integration
- [ ] Multi-language UI localization
- [ ] GraphQL API (alongside REST)
- [ ] Data warehouse for analytics
- [ ] AI-powered recommendations

---

## Known Limitations (v0.1.0)

- Rotten Tomatoes unavailable (no public API) — using TMDb + IMDb + Trakt instead
- Episode data from TMDb only until TVDb integration (v0.2.0)
- No user tracking until v0.3.0
- Ratings are TMDb only until v0.2.0

## Success Metrics

- [ ] 100K+ movies loaded
- [ ] 10K+ shows loaded
- [ ] Full-text search latency <500ms
- [ ] Import speed >100 items/minute
- [ ] API response <200ms (p95)
