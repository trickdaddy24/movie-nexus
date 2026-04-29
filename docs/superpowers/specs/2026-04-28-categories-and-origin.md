# MovieNexus — Categories, Origin Display & Color Fixes

**Date:** 2026-04-28
**Project:** `G:\kvcd\VSCODE - Main\Plex Stuff\MovieNexus\`

---

## Context

MovieNexus currently treats all movies and TV shows as a flat list with no regional or genre-based grouping. The user wants to browse by category (USA, Foreign, Anime, Korean, Indian, Documentary, Kids), import content by category (e.g. Anime-only bulk import), and see a media item's country of origin at a glance on every card and detail page. A secondary fix addresses dark/light mode color contrast issues where muted text is nearly invisible in dark mode.

---

## Categories

Eight browsing categories derived from TMDb `origin_country` and `original_language` fields (neither currently stored in the DB):

| Category | Detection logic |
|---|---|
| USA | `origin_country LIKE '%US%'` |
| Foreign | Not USA, Korean, Indian, or Anime — catch-all |
| Anime | `original_language = 'ja'` AND genre `Animation` |
| Korean | `origin_country LIKE '%KR%'` |
| Indian | `origin_country LIKE '%IN%'` |
| Documentary | genre `Documentary` |
| Kids | `origin_country LIKE '%US%'` AND (content_rating IN `['G','PG','TV-Y','TV-Y7','TV-Y7-FV','TV-G','TV-PG']` OR genre `Family`) |

**Note:** Categories are computed at query time from stored fields — no `category` column added. This keeps rules flexible without re-migration if definitions change.

**"All" tab default sort:** `CASE WHEN origin_country LIKE '%US%' THEN 0 ELSE 1 END, popularity DESC` — USA content surfaces first without hiding anything.

---

## Architecture

```
TMDb API (origin_country, original_language)
    ↓ stored on import
Movie / TVShow DB rows (2 new columns)
    ↓ filtered at query time
GET /api/movies?category=anime
GET /api/shows?category=korean
    ↓
Frontend tab bar (All · USA · Foreign · Anime · Korean · Indian · Documentary · Kids)
```

Category-specific bulk imports use TMDb Discover API filters (language/country params) so only matching content is fetched from the start — no post-import filtering needed.

---

## File Map

| Action | File | Change |
|---|---|---|
| Modify | `backend/models.py` | Add `origin_country`, `original_language` to Movie + TVShow |
| Modify | `backend/routers/imports.py` | Store new fields; add `category` param to bulk/discover endpoints |
| Create | `backend/routers/_filters.py` | Shared `apply_category_filter()` helper used by movies + shows routers |
| Modify | `backend/routers/movies.py` | Add `category` filter; change default sort to USA-first |
| Modify | `backend/routers/shows.py` | Add `category` filter; change default sort to USA-first |
| Modify | `backend/routers/export.py` | Include `origin_country`, `original_language` in all export formats |
| Create | `backend/routers/backfill.py` | One-shot endpoint to fetch+store origin fields for existing records |
| Modify | `backend/main.py` | Register backfill router |
| Modify | `frontend/src/lib/api.ts` | Add `category` param to `getMovies` / `getShows`; update types |
| Modify | `frontend/src/app/movies/page.tsx` | Add category tab bar |
| Modify | `frontend/src/app/shows/page.tsx` | Add category tab bar |
| Modify | `frontend/src/components/MediaCard.tsx` | Add origin badge; fix dark mode color contrast |
| Modify | `frontend/src/app/movies/[nexusId]/page.tsx` | Add origin section; fix dark mode color contrast |
| Modify | `frontend/src/app/shows/[nexusId]/page.tsx` | Add origin section; fix dark mode color contrast |
| Modify | `frontend/src/app/admin/page.tsx` | Update bulk import form: add Category dropdown + preview line |

---

## Detailed Design

### 1. Backend — New DB Fields

Add to both `Movie` and `TVShow` in `backend/models.py`:

```python
origin_country    = Column(String(100))   # e.g. "US" or "JP,US" (comma-joined)
original_language = Column(String(10))    # e.g. "en", "ja", "ko", "hi"
```

TMDb returns `origin_country` as a list (`["US"]`) — join with commas before storing. `original_language` is a single string.

---

### 2. Backend — Import: Store New Fields

In `backend/routers/imports.py`, update `_import_single_movie()` and `_import_single_show()`:

```python
# In movie import — TMDb returns production_countries as list of dicts
# e.g. [{"iso_3166_1": "US", "name": "United States"}]
origin_country    = ",".join(c["iso_3166_1"] for c in data.get("production_countries", []))
original_language = data.get("original_language", "")

# In show import — TMDb returns origin_country as list of strings e.g. ["US"]
origin_country    = ",".join(data.get("origin_country", []))
original_language = data.get("original_language", "")
```

Store on the model instance before `db.add()`.

---

### 3. Backend — Category-Filtered Bulk Import

Add `category` parameter to the bulk start endpoint in `backend/routers/imports.py`:

```python
CATEGORY_FILTERS = {
    "all":          {},
    "usa":          {"with_origin_country": "US"},
    "anime":        {"with_original_language": "ja", "with_genres": "16"},
    "korean":       {"with_origin_country": "KR"},
    "indian":       {"with_origin_country": "IN"},
    "documentary":  {"with_genres": "99"},
    "kids":         {"with_origin_country": "US", "with_genres": "10751"},
}
```

TMDb genre IDs: Animation = 16, Documentary = 99, Family = 10751.

Pass the filter params to the TMDb discover API call inside `_run_bulk_crawl`. The existing `pages` param controls how many pages of results to crawl — no change needed there.

Endpoint signature becomes:
```
POST /api/import/bulk/start?media_type=movie&pages=500&category=anime
```

---

### 4. Backend — Category Filter on List Endpoints

In `backend/routers/movies.py`, add `category: str | None = Query(None)` param.

Category WHERE clause builder (reuse in both movies and shows routers):

```python
def apply_category_filter(q, model, category: str | None):
    if not category or category == "all":
        return q
    if category == "usa":
        return q.where(model.origin_country.like("%US%"))
    if category == "anime":
        return q.join(Genre).where(
            model.original_language == "ja",
            Genre.name == "Animation"
        )
    if category == "korean":
        return q.where(model.origin_country.like("%KR%"))
    if category == "indian":
        return q.where(model.origin_country.like("%IN%"))
    if category == "documentary":
        return q.join(Genre).where(Genre.name == "Documentary")
    if category == "kids":
        kids_ratings = ["G","PG","TV-Y","TV-Y7","TV-Y7-FV","TV-G","TV-PG"]
        return q.join(Genre).where(
            model.origin_country.like("%US%"),
            or_(
                model.content_rating.in_(kids_ratings),
                Genre.name.in_(["Family", "Animation"])
            )
        )
    if category == "foreign":
        # Catch-all: not USA, Korean, or Indian origin; and not Anime (ja + Animation genre)
        # Avoid Genre join here — use a subquery to check anime condition
        anime_ids = select(Genre.movie_id).where(
            Genre.name == "Animation"
        )  # for shows, use ShowGenre.show_id
        return q.where(
            ~model.origin_country.like("%US%"),
            ~model.origin_country.like("%KR%"),
            ~model.origin_country.like("%IN%"),
            or_(
                model.original_language != "ja",
                ~model.id.in_(anime_ids)
            )
        )
    return q
# Note: place apply_category_filter in backend/routers/_filters.py and import in both movies.py and shows.py.
# For shows, the anime subquery uses ShowGenre.show_id instead of Genre.movie_id.
```

**USA-first default sort** (applied when `category` is `None` or `"all"`):

```python
from sqlalchemy import case
usa_first = case((model.origin_country.like("%US%"), 0), else_=1)
q = q.order_by(usa_first, model.popularity.desc())
```

---

### 5. Backend — Backfill Endpoint

New file `backend/routers/backfill.py` — single POST endpoint that iterates all existing Movie/TVShow rows without `origin_country` set, fetches from TMDb, and updates:

```
POST /api/admin/backfill/origin?media_type=movie
POST /api/admin/backfill/origin?media_type=show
```

Returns SSE progress stream same pattern as import sessions. This is a one-time operation but exposed as an admin endpoint so it can be triggered from the admin page without SSHing into the server.

---

### 6. Backend — Export

In `backend/routers/export.py`, add `origin_country` and `original_language` to the field set for all three formats (JSON, CSV, XML). These are nullable strings — export as empty string if null.

---

### 7. Frontend — Category Tabs

Add to both `movies/page.tsx` and `shows/page.tsx`. Tab state lives in the URL as `?category=anime` so links are shareable.

```tsx
const CATEGORIES = [
  { id: "all",         label: "All",         emoji: "🌐" },
  { id: "usa",         label: "USA",          emoji: "🇺🇸" },
  { id: "foreign",     label: "Foreign",      emoji: "🌍" },
  { id: "anime",       label: "Anime",        emoji: "⛩️" },
  { id: "korean",      label: "Korean",       emoji: "🇰🇷" },
  { id: "indian",      label: "Indian",       emoji: "🇮🇳" },
  { id: "documentary", label: "Documentary",  emoji: "📽️" },
  { id: "kids",        label: "Kids",         emoji: "👶" },
];
```

Tab bar renders above the media grid. Active tab: purple background. Inactive: muted border. Changing tab resets to page 1.

---

### 8. Frontend — Origin Badge on MediaCard

Add below the year/subtitle line in `MediaCard.tsx`. Requires new `originCountry` and `originalLanguage` props.

```tsx
// Country code → display name + flag (cover the common cases)
const COUNTRY_MAP: Record<string, { name: string; flag: string }> = {
  US: { name: "USA",        flag: "🇺🇸" },
  JP: { name: "Japan",      flag: "🇯🇵" },
  KR: { name: "Korea",      flag: "🇰🇷" },
  IN: { name: "India",      flag: "🇮🇳" },
  GB: { name: "UK",         flag: "🇬🇧" },
  FR: { name: "France",     flag: "🇫🇷" },
  DE: { name: "Germany",    flag: "🇩🇪" },
  ES: { name: "Spain",      flag: "🇪🇸" },
  IT: { name: "Italy",      flag: "🇮🇹" },
  MX: { name: "Mexico",     flag: "🇲🇽" },
  BR: { name: "Brazil",     flag: "🇧🇷" },
  CN: { name: "China",      flag: "🇨🇳" },
  TH: { name: "Thailand",   flag: "🇹🇭" },
  TR: { name: "Turkey",     flag: "🇹🇷" },
};
```

Badge renders as: `🇰🇷 Korea` — small pill, cyan text on cyan/10 bg in dark mode, purple/10 for USA, neutral for others. Use the first country code in the comma-joined `origin_country` string.

The same `COUNTRY_MAP` also provides display names for the detail page origin section. For languages, use this minimal map:

```tsx
const LANGUAGE_MAP: Record<string, string> = {
  en: "English", ja: "Japanese", ko: "Korean",
  hi: "Hindi",   fr: "French",   de: "German",
  es: "Spanish", it: "Italian",  pt: "Portuguese",
  zh: "Mandarin", th: "Thai",    tr: "Turkish",
};
```

Fallback: show the raw language code if not in the map.

---

### 9. Frontend — Origin Section on Detail Pages

Add after the ratings row in both `movies/[nexusId]/page.tsx` and `shows/[nexusId]/page.tsx`:

```tsx
{movie.origin_country && (
  <div className="flex items-center gap-3 rounded-lg border border-nexus-border dark:border-[#1E2A5A] bg-nexus-card dark:bg-[#121840] px-4 py-3">
    <span className="text-3xl">{flag}</span>
    <div>
      <div className="font-semibold dark:text-white">{countryName}</div>
      <div className="text-xs text-nexus-muted dark:text-[#94A3B8]">{languageName} · {categoryLabel}</div>
    </div>
    <span className="ml-auto rounded-full px-3 py-1 text-xs font-semibold border border-nexus-accent/30 text-nexus-accent dark:border-[#8A4DFF]/40 dark:text-[#A78BFA]">{categoryLabel}</span>
  </div>
)}
```

`movie.origin_country` is the first country code from the stored string. `categoryLabel` is derived client-side using the same logic as the tab system.

---

### 10. Frontend — Admin Bulk Import Form

Replace the current 2-field form in `admin/page.tsx` with a 3-field form:

**Fields:**
1. **Category** — dropdown: All, USA, Anime, Korean, Indian, Documentary, Kids
2. **Media Type** — dropdown: Movies, TV Shows  
3. **Pages** — number input (1–5000, default 100)

**Preview line** (computed from selections):
```
⛩️ Will import up to ~10,000 Anime movies from TMDb (Japanese Animation)
```

Form submits: `POST /api/import/bulk/start?media_type={type}&pages={pages}&category={category}`

Also add a **Backfill Origin Data** button (separate from bulk import) that calls the new backfill endpoint — shows progress inline. Label: "Backfill origin data for existing records".

---

## Color Contrast Fixes

All dark mode contrast issues stem from using `#64748B` or `nexus-muted` (`#6B7280`) as text on dark card backgrounds (`#121840`, `#1E2A5A`). The fix is to use `#94A3B8` for secondary text and `#2D3A6B` for subtle borders in dark mode.

| Location | Current (broken) | Fixed |
|---|---|---|
| `MediaCard` genre tags | `dark:text-[#64748B]` on `dark:bg-[#1E2A5A]` | `dark:text-[#94A3B8]` + `dark:border-[#2D3A6B]` |
| `MediaCard` year/subtitle | `dark:text-[#64748B]` | `dark:text-[#94A3B8]` |
| Movie detail genre tags | `dark:text-nexus-muted dark:border-[#1E2A5A]` | `dark:text-[#94A3B8] dark:border-[#2D3A6B]` |
| Movie detail overview | `dark:text-[#64748B]` | `dark:text-[#94A3B8]` |
| Movie detail labels (DetailItem) | `dark:text-[#64748B]` | `dark:text-[#94A3B8]` |
| Show detail genre tags | `dark:text-nexus-muted dark:border-[#1E2A5A]` | `dark:text-[#94A3B8] dark:border-[#2D3A6B]` |
| Show detail overview | `dark:text-[#64748B]` | `dark:text-[#94A3B8]` |
| Show detail content rating badge | `dark:text-nexus-muted` | `dark:text-[#94A3B8]` |
| Show detail episode air date | `text-nexus-muted` | `dark:text-[#94A3B8]` |

**Rule going forward:** `#94A3B8` for secondary/muted text on dark backgrounds. `#64748B` only for truly de-emphasized placeholder-level text (timestamps, IDs).

---

## API Changes Summary

```
GET /api/movies?category=anime&page=1&sort=popularity&order=desc
GET /api/shows?category=korean&page=1
POST /api/import/bulk/start?media_type=movie&pages=500&category=anime
POST /api/admin/backfill/origin?media_type=movie   ← new
POST /api/admin/backfill/origin?media_type=show    ← new
```

`MovieBrief` and `TVShowBrief` response schemas gain: `origin_country: str | null`, `original_language: str | null`.

---

## Verification

1. Run backfill for movies + shows → confirm `origin_country` populated on existing records
2. Browse `/movies` — "All" tab shows USA content at top, foreign below
3. Click "Anime" tab — only Japanese animation shown
4. Click "Indian" tab — Bollywood + South Indian content only
5. Each MediaCard shows flag + country name badge
6. Open a movie/show detail — origin section shows flag, country, language, category label
7. Admin → start Anime import (500 pages, Movies) → confirm TMDb returns Japanese animation only
8. Export movies as JSON — confirm `origin_country` and `original_language` in output
9. Toggle light/dark mode — all genre tags, overviews, and secondary text readable in both modes
