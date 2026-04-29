# MovieNexus — Product Context

## Product Purpose
Personal movie and TV show database. Aggregates data from TMDb, IMDb, Trakt, and Fanart.tv into one place. Browse, search, and explore a self-hosted collection with multi-source ratings, artwork, and episode data.

## Users
Single user (owner/admin). Personal tool, not a public SaaS. The owner imports their collection, browses it, and uses it as a reference. No onboarding flow needed — this is a power tool for someone who already knows what it is.

## Register
product

## Brand Tone
Energetic, personal, vibrant. Not corporate. The Rainbow Burst palette (hot pink / lime green / electric yellow on near-black dark mode) sets the aesthetic — festival-like, maximum saturation, fun but functional.

## Anti-references
- Generic movie apps (gray cards, poster thumbnails, nothing else)
- Letterboxd (too social/review-focused)
- IMDb (too much information density, dated feel)
- Plex (utilitarian media player UI)

## Strategic Principles
- Data richness over simplicity — show ratings from multiple sources, budget/revenue, origin country
- Dark mode first — this is a personal dashboard browsed at night
- Vibrant, not muted — the Rainbow Burst palette should actually show up, not be suppressed
- Poster images are the hero — the visual identity of a movie IS its poster

## Key Surfaces
- `/movies` — grid browse with 8 category tabs
- `/shows` — same pattern for TV shows
- `/movies/[nexusId]` — movie detail (needs the most work)
- `/shows/[nexusId]` — show detail with seasons/episodes
- `/admin` — import management, bulk operations
