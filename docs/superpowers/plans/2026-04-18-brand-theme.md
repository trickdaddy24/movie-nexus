# MovieNexus Brand Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the shared Login X brand palette to MovieNexus — dual dark/light mode with neon cyberpunk dark and clean Stripe-like light, using the same Electric Purple + Sky Blue + Neon Cyan tokens.

**Architecture:** Replace the existing `nexus.*` Tailwind tokens with brand palette values (light mode defaults), add `dark:` class overrides in every component, install `next-themes` for the theme toggle, and create two new components (`LogoBrand`, `ThemeToggle`). No backend changes.

**Tech Stack:** Next.js 15, Tailwind CSS v3.4, `next-themes`, `lucide-react`

**Spec:** `docs/superpowers/specs/2026-04-18-movienexus-brand-theme.md`

---

## File Map

| Action | File |
|--------|------|
| Modify | `frontend/tailwind.config.ts` |
| Modify | `frontend/src/app/globals.css` |
| Modify | `frontend/src/app/layout.tsx` |
| Modify | `frontend/src/components/MediaCard.tsx` |
| Modify | `frontend/src/components/SearchBar.tsx` |
| Modify | `frontend/src/app/page.tsx` |
| Modify | `frontend/src/app/movies/page.tsx` |
| Modify | `frontend/src/app/shows/page.tsx` |
| Modify | `frontend/src/app/search/page.tsx` |
| Modify | `frontend/src/app/movies/[nexusId]/page.tsx` |
| Modify | `frontend/src/app/shows/[nexusId]/page.tsx` |
| Create | `frontend/src/components/LogoBrand.tsx` |
| Create | `frontend/src/components/ThemeToggle.tsx` |

---

### Task 1: Install dependencies, update Tailwind tokens, update globals.css

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Install next-themes and lucide-react**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus/frontend"
npm install next-themes lucide-react
```

Expected: both packages added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Replace tailwind.config.ts with brand tokens**

Write the full file `frontend/tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        nexus: {
          bg: "#FFFFFF",
          card: "#F9F9FB",
          border: "#E5E7EB",
          accent: "#8A4DFF",
          "accent-hover": "#7A3DEF",
          muted: "#6B7280",
          text: "#0B0F2A",
          cyan: "#2EC7FF",
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

Key addition: `darkMode: "class"` — required for `dark:` prefix classes to work.

- [ ] **Step 3: Replace globals.css with brand styles + animation**

Write the full file `frontend/src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background: #ffffff;
  color: #0b0f2a;
}

.dark body {
  background: #0b0f2a;
  color: #ffffff;
}

::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #f9f9fb;
}
.dark ::-webkit-scrollbar-track {
  background: #121840;
}
::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 4px;
}
.dark ::-webkit-scrollbar-thumb {
  background: #1e2a5a;
  border-radius: 4px;
}

@keyframes text-glow {
  0%, 100% {
    filter: drop-shadow(0 0 10px rgba(0, 224, 255, 0.8))
            drop-shadow(0 0 25px rgba(138, 77, 255, 0.5));
  }
  50% {
    filter: drop-shadow(0 0 18px rgba(0, 224, 255, 1))
            drop-shadow(0 0 40px rgba(138, 77, 255, 0.8));
  }
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus/frontend"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus"
git add frontend/package.json frontend/package-lock.json frontend/tailwind.config.ts frontend/src/app/globals.css
git commit -m "feat: install next-themes + lucide-react, update brand tokens and globals"
```

---

### Task 2: Create LogoBrand component

**Files:**
- Create: `frontend/src/components/LogoBrand.tsx`

- [ ] **Step 1: Create LogoBrand.tsx**

```tsx
export default function LogoBrand() {
  return (
    <div className="flex items-center gap-2 select-none">
      {/* Play button — gradient fill, glow in dark mode */}
      <span
        style={{ fontSize: "20px", lineHeight: 1 }}
        className="bg-gradient-to-br from-[#2EC7FF] to-[#8A4DFF] bg-clip-text text-transparent
          [filter:drop-shadow(0_0_6px_rgba(46,199,255,0.4))]
          dark:[filter:drop-shadow(0_0_10px_rgba(0,224,255,0.8))_drop-shadow(0_0_20px_rgba(138,77,255,0.5))]
          dark:animate-[text-glow_2s_ease-in-out_infinite]"
        aria-hidden="true"
      >
        ▶
      </span>
      {/* Wordmark */}
      <span
        className="text-lg font-bold tracking-wide
          bg-gradient-to-r from-[#2EC7FF] to-[#8A4DFF] bg-clip-text text-transparent
          [filter:drop-shadow(0_0_4px_rgba(46,199,255,0.3))]
          dark:[filter:drop-shadow(0_0_8px_rgba(0,224,255,0.6))]"
      >
        MovieNexus
      </span>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus/frontend"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus"
git add frontend/src/components/LogoBrand.tsx
git commit -m "feat: add LogoBrand component (play button + wordmark, CSS gradient)"
```

---

### Task 3: Create ThemeToggle component

**Files:**
- Create: `frontend/src/components/ThemeToggle.tsx`

- [ ] **Step 1: Create ThemeToggle.tsx**

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-1.5 rounded-lg hover:bg-[#F3F0FF] dark:hover:bg-[#1E2A5A] transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-[#2EC7FF]" />
      ) : (
        <Moon className="h-4 w-4 text-[#8A4DFF]" />
      )}
    </button>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus/frontend"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus"
git add frontend/src/components/ThemeToggle.tsx
git commit -m "feat: add ThemeToggle component (Moon/Sun, next-themes)"
```

---

### Task 4: Update layout.tsx — ThemeProvider + new nav

**Files:**
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Replace layout.tsx**

Write the full file `frontend/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import SearchBar from "@/components/SearchBar";
import LogoBrand from "@/components/LogoBrand";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "MovieNexus",
  description: "Movie & TV show database with multi-source ratings and artwork",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white dark:bg-[#0B0F2A] text-nexus-text dark:text-white transition-colors">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <nav className="sticky top-0 z-50 border-b border-nexus-border dark:border-[#1E2A5A] bg-white/90 dark:bg-[#0B0F2A]/90 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
              <Link href="/">
                <LogoBrand />
              </Link>
              <div className="flex items-center gap-6">
                <Link
                  href="/movies"
                  className="text-sm text-nexus-muted hover:text-nexus-text dark:hover:text-white transition"
                >
                  Movies
                </Link>
                <Link
                  href="/shows"
                  className="text-sm text-nexus-muted hover:text-nexus-text dark:hover:text-white transition"
                >
                  TV Shows
                </Link>
                <SearchBar />
                <ThemeToggle />
              </div>
            </div>
          </nav>
          <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Note: `suppressHydrationWarning` on `<html>` prevents React hydration warnings when `next-themes` adds the `dark` class on mount.

- [ ] **Step 2: TypeScript check**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus/frontend"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus"
git add frontend/src/app/layout.tsx
git commit -m "feat: add ThemeProvider, LogoBrand, and ThemeToggle to nav"
```

---

### Task 5: Update MediaCard

**Files:**
- Modify: `frontend/src/components/MediaCard.tsx`

- [ ] **Step 1: Replace MediaCard.tsx**

Write the full file `frontend/src/components/MediaCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import RatingBadge from "./RatingBadge";

interface MediaCardProps {
  nexusId: string;
  tmdbId: number | null;
  title: string;
  year: string | null;
  rating: number | null;
  genres: { name: string }[];
  subtitle?: string;
  href: string;
  posterUrl?: string | null;
}

export default function MediaCard({
  title,
  year,
  rating,
  genres,
  subtitle,
  href,
  posterUrl,
}: MediaCardProps) {
  const yearStr = year ? new Date(year).getFullYear() : null;
  const [imgError, setImgError] = useState(false);
  const thumbUrl = posterUrl?.replace("/original/", "/w342/");

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl
        border border-nexus-border bg-nexus-card
        shadow-sm transition-all duration-300
        hover:border-nexus-accent hover:shadow-[0_4px_12px_rgba(138,77,255,0.15)] hover:-translate-y-1
        dark:border-[#1E2A5A] dark:bg-[#121840] dark:shadow-none
        dark:hover:border-[#00E0FF] dark:hover:shadow-[0_0_20px_rgba(0,224,255,0.35)] dark:hover:-translate-y-2"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#F3F0FF] dark:bg-[#1E2A5A]">
        {thumbUrl && !imgError ? (
          <img
            src={thumbUrl}
            alt={title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-nexus-border dark:text-[#2A3A6A] opacity-60">
            {title.charAt(0)}
          </div>
        )}
        {rating !== null && (
          <div className="absolute top-2 right-2">
            <RatingBadge rating={rating} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="text-sm font-semibold text-nexus-text dark:text-white line-clamp-2 group-hover:text-nexus-accent dark:group-hover:text-[#00E0FF] transition">
          {title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-nexus-muted">
          {yearStr && <span>{yearStr}</span>}
          {subtitle && <span>{subtitle}</span>}
        </div>
        {genres.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-2">
            {genres.slice(0, 3).map((g) => (
              <span
                key={g.name}
                className="rounded-full bg-[#F3F0FF] text-[#8A4DFF] dark:bg-[#1E2A5A] dark:text-nexus-muted px-2 py-0.5 text-[10px]"
              >
                {g.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus/frontend"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus"
git add frontend/src/components/MediaCard.tsx
git commit -m "feat: update MediaCard with dual dark/light brand theme"
```

---

### Task 6: Update SearchBar

**Files:**
- Modify: `frontend/src/components/SearchBar.tsx`

- [ ] **Step 1: Replace SearchBar.tsx**

Write the full file `frontend/src/components/SearchBar.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-48 rounded-lg border border-nexus-border bg-nexus-card px-3 py-1.5 text-sm text-nexus-text placeholder-nexus-muted outline-none
          focus:border-nexus-accent transition
          dark:border-[#1E2A5A] dark:bg-[#121840] dark:text-white dark:placeholder-[#64748B]
          dark:focus:border-[#00E0FF]"
      />
    </form>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus/frontend"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus"
git add frontend/src/components/SearchBar.tsx
git commit -m "feat: update SearchBar with dual dark/light brand theme"
```

---

### Task 7: Update homepage (page.tsx)

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Replace page.tsx**

Write the full file `frontend/src/app/page.tsx`:

```tsx
import Link from "next/link";
import { getStats, getMovies, getShows } from "@/lib/api";
import MediaCard from "@/components/MediaCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let stats, movies, shows;
  try {
    [stats, movies, shows] = await Promise.all([
      getStats(),
      getMovies(1, "added_at", "desc"),
      getShows(1, "added_at", "desc"),
    ]);
  } catch {
    return (
      <div className="text-center py-20">
        <h1 className="text-4xl font-bold mb-2 text-nexus-text dark:text-white">MovieNexus</h1>
        <p className="text-nexus-muted mt-4">Unable to connect to API. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section className="text-center py-8">
        <h1 className="text-4xl font-bold mb-2 text-nexus-text dark:text-white">
          <span className="text-nexus-accent">Movie</span>Nexus
        </h1>
        <p className="text-nexus-muted">
          Your personal movie & TV show database
        </p>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard label="Movies" value={stats.total_movies} />
        <StatCard label="TV Shows" value={stats.total_shows} />
        <StatCard label="Episodes" value={stats.total_episodes} />
        <StatCard label="People" value={stats.total_people} />
        <StatCard label="Avg Movie Rating" value={stats.avg_movie_rating?.toFixed(1) ?? "—"} />
        <StatCard label="Avg Show Rating" value={stats.avg_show_rating?.toFixed(1) ?? "—"} />
      </section>

      {stats.top_genres.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-nexus-text dark:text-white">Top Genres</h2>
          <div className="flex flex-wrap gap-2">
            {stats.top_genres.map((g) => (
              <span
                key={g.name}
                className="rounded-full border border-nexus-border bg-[#F3F0FF] text-[#8A4DFF] px-3 py-1 text-sm
                  dark:border-[#1E2A5A] dark:bg-[#121840] dark:text-nexus-muted"
              >
                {g.name} <span className="opacity-60">({g.count})</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {movies.items.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-nexus-text dark:text-white">Recent Movies</h2>
            <Link
              href="/movies"
              className="text-sm text-nexus-accent hover:text-nexus-accent-hover dark:hover:text-[#00E0FF] transition"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {movies.items.slice(0, 6).map((m) => (
              <MediaCard
                key={m.nexus_id}
                nexusId={m.nexus_id}
                tmdbId={m.tmdb_id}
                title={m.title}
                year={m.release_date}
                rating={m.rating_tmdb}
                genres={m.genres}
                subtitle={m.runtime ? `${m.runtime}m` : undefined}
                href={`/movies/${m.nexus_id}`}
                posterUrl={m.poster_url}
              />
            ))}
          </div>
        </section>
      )}

      {shows.items.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-nexus-text dark:text-white">Recent TV Shows</h2>
            <Link
              href="/shows"
              className="text-sm text-nexus-accent hover:text-nexus-accent-hover dark:hover:text-[#00E0FF] transition"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {shows.items.slice(0, 6).map((s) => (
              <MediaCard
                key={s.nexus_id}
                nexusId={s.nexus_id}
                tmdbId={s.tmdb_id}
                title={s.title}
                year={s.first_air_date}
                rating={s.rating_tmdb}
                genres={s.genres}
                subtitle={`${s.number_of_seasons}S ${s.number_of_episodes}E`}
                href={`/shows/${s.nexus_id}`}
                posterUrl={s.poster_url}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-nexus-border bg-nexus-card p-4 text-center
      dark:border-[#1E2A5A] dark:bg-[#121840]">
      <div className="text-2xl font-bold text-nexus-accent">{value}</div>
      <div className="text-xs text-nexus-muted mt-1">{label}</div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus/frontend"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus"
git add frontend/src/app/page.tsx
git commit -m "feat: update homepage with dual dark/light brand theme"
```

---

### Task 8: Update movies/page.tsx and shows/page.tsx

**Files:**
- Modify: `frontend/src/app/movies/page.tsx`
- Modify: `frontend/src/app/shows/page.tsx`

- [ ] **Step 1: Replace movies/page.tsx**

Write the full file `frontend/src/app/movies/page.tsx`:

```tsx
import { getMovies } from "@/lib/api";
import MediaCard from "@/components/MediaCard";

export const dynamic = "force-dynamic";

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const sort = params.sort || "added_at";

  let data;
  try {
    data = await getMovies(page, sort, "desc");
  } catch {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4 text-nexus-text dark:text-white">Movies</h1>
        <p className="text-nexus-muted">Unable to load movies. Please try again later.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-nexus-text dark:text-white">Movies</h1>
        <span className="text-sm text-nexus-muted">{data.total} total</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {data.items.map((m) => (
          <MediaCard
            key={m.nexus_id}
            nexusId={m.nexus_id}
            tmdbId={m.tmdb_id}
            title={m.title}
            year={m.release_date}
            rating={m.rating_tmdb}
            genres={m.genres}
            subtitle={m.runtime ? `${m.runtime}m` : undefined}
            href={`/movies/${m.nexus_id}`}
            posterUrl={m.poster_url}
          />
        ))}
      </div>

      {data.pages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {page > 1 && (
            <a
              href={`/movies?page=${page - 1}&sort=${sort}`}
              className="rounded-lg border border-nexus-border bg-nexus-card px-4 py-2 text-sm text-nexus-text
                hover:border-nexus-accent transition
                dark:border-[#1E2A5A] dark:bg-[#121840] dark:text-white
                dark:hover:border-[#00E0FF]"
            >
              Previous
            </a>
          )}
          <span className="rounded-lg bg-nexus-accent px-4 py-2 text-sm font-medium text-white">
            {page} / {data.pages}
          </span>
          {page < data.pages && (
            <a
              href={`/movies?page=${page + 1}&sort=${sort}`}
              className="rounded-lg border border-nexus-border bg-nexus-card px-4 py-2 text-sm text-nexus-text
                hover:border-nexus-accent transition
                dark:border-[#1E2A5A] dark:bg-[#121840] dark:text-white
                dark:hover:border-[#00E0FF]"
            >
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace shows/page.tsx**

Write the full file `frontend/src/app/shows/page.tsx`:

```tsx
import { getShows } from "@/lib/api";
import MediaCard from "@/components/MediaCard";

export const dynamic = "force-dynamic";

export default async function ShowsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const sort = params.sort || "added_at";

  let data;
  try {
    data = await getShows(page, sort, "desc");
  } catch {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-4 text-nexus-text dark:text-white">TV Shows</h1>
        <p className="text-nexus-muted">Unable to load shows. Please try again later.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-nexus-text dark:text-white">TV Shows</h1>
        <span className="text-sm text-nexus-muted">{data.total} total</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {data.items.map((s) => (
          <MediaCard
            key={s.nexus_id}
            nexusId={s.nexus_id}
            tmdbId={s.tmdb_id}
            title={s.title}
            year={s.first_air_date}
            rating={s.rating_tmdb}
            genres={s.genres}
            subtitle={`${s.number_of_seasons}S ${s.number_of_episodes}E`}
            href={`/shows/${s.nexus_id}`}
            posterUrl={s.poster_url}
          />
        ))}
      </div>

      {data.pages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {page > 1 && (
            <a
              href={`/shows?page=${page - 1}&sort=${sort}`}
              className="rounded-lg border border-nexus-border bg-nexus-card px-4 py-2 text-sm text-nexus-text
                hover:border-nexus-accent transition
                dark:border-[#1E2A5A] dark:bg-[#121840] dark:text-white
                dark:hover:border-[#00E0FF]"
            >
              Previous
            </a>
          )}
          <span className="rounded-lg bg-nexus-accent px-4 py-2 text-sm font-medium text-white">
            {page} / {data.pages}
          </span>
          {page < data.pages && (
            <a
              href={`/shows?page=${page + 1}&sort=${sort}`}
              className="rounded-lg border border-nexus-border bg-nexus-card px-4 py-2 text-sm text-nexus-text
                hover:border-nexus-accent transition
                dark:border-[#1E2A5A] dark:bg-[#121840] dark:text-white
                dark:hover:border-[#00E0FF]"
            >
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus/frontend"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus"
git add frontend/src/app/movies/page.tsx frontend/src/app/shows/page.tsx
git commit -m "feat: update movies and shows list pages with dual dark/light brand theme"
```

---

### Task 9: Update search/page.tsx

**Files:**
- Modify: `frontend/src/app/search/page.tsx`

- [ ] **Step 1: Replace search/page.tsx**

Write the full file `frontend/src/app/search/page.tsx`:

```tsx
import { search } from "@/lib/api";
import Link from "next/link";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  let results: Awaited<ReturnType<typeof search>> = [];
  if (q) {
    try {
      results = await search(q);
    } catch {
      results = [];
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-nexus-text dark:text-white">
        {q ? `Results for "${q}"` : "Search"}
      </h1>

      {q && results.length === 0 && (
        <p className="text-nexus-muted">No results found.</p>
      )}

      <div className="space-y-2">
        {results.map((r) => (
          <Link
            key={r.nexus_id}
            href={`/${r.media_type === "movie" ? "movies" : "shows"}/${r.nexus_id}`}
            className="flex items-center justify-between rounded-lg border border-nexus-border bg-nexus-card p-4
              hover:border-nexus-accent transition
              dark:border-[#1E2A5A] dark:bg-[#121840]
              dark:hover:border-[#00E0FF]/50"
          >
            <div className="flex items-center gap-3">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                r.media_type === "movie"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-[#8A4DFF]/20 text-[#8A4DFF] dark:text-[#BFA4FF]"
              }`}>
                {r.media_type === "movie" ? "Movie" : "TV"}
              </span>
              <span className="font-medium text-nexus-text dark:text-white">{r.title}</span>
              {r.year && <span className="text-sm text-nexus-muted">({r.year})</span>}
            </div>
            {r.rating_tmdb !== null && (
              <span className="text-sm text-nexus-muted">{r.rating_tmdb.toFixed(1)}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus/frontend"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus"
git add frontend/src/app/search/page.tsx
git commit -m "feat: update search page with dual dark/light brand theme"
```

---

### Task 10: Update movie + show detail pages

**Files:**
- Modify: `frontend/src/app/movies/[nexusId]/page.tsx`
- Modify: `frontend/src/app/shows/[nexusId]/page.tsx`

- [ ] **Step 1: Replace movies/[nexusId]/page.tsx**

Write the full file `frontend/src/app/movies/[nexusId]/page.tsx`:

```tsx
import { getMovie } from "@/lib/api";
import RatingBadge from "@/components/RatingBadge";
import { notFound } from "next/navigation";

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ nexusId: string }>;
}) {
  const { nexusId } = await params;

  let movie;
  try {
    movie = await getMovie(nexusId);
  } catch {
    notFound();
  }

  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <div className="flex items-start gap-4 mb-2">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-nexus-text dark:text-white">{movie.title}</h1>
            {movie.tagline && (
              <p className="text-nexus-muted italic mt-1">{movie.tagline}</p>
            )}
          </div>
          {movie.content_rating && (
            <span className="shrink-0 rounded border border-nexus-border dark:border-[#1E2A5A] px-2 py-1 text-xs text-nexus-muted">
              {movie.content_rating}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-nexus-muted mt-3">
          {year && <span>{year}</span>}
          {movie.runtime && <span>{movie.runtime} min</span>}
          {movie.status && <span>{movie.status}</span>}
          <span className="font-mono text-xs text-nexus-accent/60">{movie.nexus_id}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <RatingBadge rating={movie.rating_tmdb} label="TMDb" />
        <RatingBadge rating={movie.rating_imdb} label="IMDb" />
        <RatingBadge rating={movie.rating_trakt} label="Trakt" />
      </div>

      {movie.genres.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {movie.genres.map((g) => (
            <span
              key={g.name}
              className="rounded-full border border-nexus-border bg-[#F3F0FF] text-[#8A4DFF] px-3 py-1 text-sm
                dark:border-[#1E2A5A] dark:bg-[#121840] dark:text-nexus-muted"
            >
              {g.name}
            </span>
          ))}
        </div>
      )}

      {movie.overview && (
        <section>
          <h2 className="text-lg font-semibold mb-2 text-nexus-text dark:text-white">Overview</h2>
          <p className="text-nexus-muted leading-relaxed">{movie.overview}</p>
        </section>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {movie.budget > 0 && (
          <DetailItem label="Budget" value={`$${(movie.budget / 1_000_000).toFixed(0)}M`} />
        )}
        {movie.revenue > 0 && (
          <DetailItem label="Revenue" value={`$${(movie.revenue / 1_000_000).toFixed(0)}M`} />
        )}
        {movie.vote_count_tmdb > 0 && (
          <DetailItem label="TMDb Votes" value={movie.vote_count_tmdb.toLocaleString()} />
        )}
        {movie.imdb_id && (
          <DetailItem label="IMDb" value={movie.imdb_id} />
        )}
      </section>

      <div className="border-t border-nexus-border dark:border-[#1E2A5A] pt-4 text-xs text-nexus-muted">
        <span>Added: {movie.added_at ? new Date(movie.added_at).toLocaleDateString() : "—"}</span>
        {movie.updated_at && (
          <span className="ml-4">Updated: {new Date(movie.updated_at).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-nexus-border bg-nexus-card p-3
      dark:border-[#1E2A5A] dark:bg-[#121840]">
      <div className="text-xs text-nexus-muted">{label}</div>
      <div className="text-sm font-medium mt-0.5 text-nexus-text dark:text-white">{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Read shows/[nexusId]/page.tsx to get full content, then replace**

Read the full file first (it was only partially read during planning). Then apply the same `dark:` overrides as the movie detail page — same pattern: `DetailItem`, genre pills, section headings, footer divider, content rating badge. The full updated file:

```tsx
import { getShow } from "@/lib/api";
import RatingBadge from "@/components/RatingBadge";
import { notFound } from "next/navigation";

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ nexusId: string }>;
}) {
  const { nexusId } = await params;

  let show;
  try {
    show = await getShow(nexusId);
  } catch {
    notFound();
  }

  const year = show.first_air_date ? new Date(show.first_air_date).getFullYear() : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-nexus-text dark:text-white">{show.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-nexus-muted mt-3">
          {year && <span>{year}{show.last_air_date ? `–${new Date(show.last_air_date).getFullYear()}` : "–"}</span>}
          {show.status && <span>{show.status}</span>}
          <span>{show.number_of_seasons} Seasons</span>
          <span>{show.number_of_episodes} Episodes</span>
          {show.content_rating && (
            <span className="rounded border border-nexus-border dark:border-[#1E2A5A] px-2 py-0.5 text-xs">
              {show.content_rating}
            </span>
          )}
          <span className="font-mono text-xs text-nexus-accent/60">{show.nexus_id}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <RatingBadge rating={show.rating_tmdb} label="TMDb" />
        <RatingBadge rating={show.rating_imdb} label="IMDb" />
        <RatingBadge rating={show.rating_trakt} label="Trakt" />
      </div>

      {show.genres.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {show.genres.map((g) => (
            <span
              key={g.name}
              className="rounded-full border border-nexus-border bg-[#F3F0FF] text-[#8A4DFF] px-3 py-1 text-sm
                dark:border-[#1E2A5A] dark:bg-[#121840] dark:text-nexus-muted"
            >
              {g.name}
            </span>
          ))}
        </div>
      )}

      {show.overview && (
        <section>
          <h2 className="text-lg font-semibold mb-2 text-nexus-text dark:text-white">Overview</h2>
          <p className="text-nexus-muted leading-relaxed">{show.overview}</p>
        </section>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DetailItem label="Seasons" value={String(show.number_of_seasons)} />
        <DetailItem label="Episodes" value={String(show.number_of_episodes)} />
        {show.status && <DetailItem label="Status" value={show.status} />}
        {show.content_rating && <DetailItem label="Rating" value={show.content_rating} />}
      </section>

      <div className="border-t border-nexus-border dark:border-[#1E2A5A] pt-4 text-xs text-nexus-muted">
        <span>Added: {show.added_at ? new Date(show.added_at).toLocaleDateString() : "—"}</span>
        {show.updated_at && (
          <span className="ml-4">Updated: {new Date(show.updated_at).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-nexus-border bg-nexus-card p-3
      dark:border-[#1E2A5A] dark:bg-[#121840]">
      <div className="text-xs text-nexus-muted">{label}</div>
      <div className="text-sm font-medium mt-0.5 text-nexus-text dark:text-white">{value}</div>
    </div>
  );
}
```

⚠️ **Note:** The original `shows/[nexusId]/page.tsx` was only partially read during planning. Before writing, read the full file to verify the `DetailItem` section matches what was in the original. Add any missing fields back.

- [ ] **Step 3: TypeScript check**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus/frontend"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus"
git add "frontend/src/app/movies/[nexusId]/page.tsx" "frontend/src/app/shows/[nexusId]/page.tsx"
git commit -m "feat: update movie and show detail pages with dual dark/light brand theme"
```

---

### Task 11: Deploy and verify

**Files:** None (deploy only)

- [ ] **Step 1: Push to GitHub**

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus"
git push origin main
```

- [ ] **Step 2: Deploy to server**

```bash
ssh stunna_overlord@95.217.229.185 "cd /opt/movienexus && git pull && docker compose build frontend && docker compose up -d frontend"
```

- [ ] **Step 3: Verify dark mode**

Open `https://movienexus.e4z.xyz` — should load in dark mode (Deep Navy background, neon cyan/purple gradient logo, purple accents on stat values, neon border glow on card hover).

- [ ] **Step 4: Verify light mode**

Click the ☀ toggle in the nav — page should switch to white background, clean purple accents, soft lavender genre pills.

- [ ] **Step 5: Verify logo animation**

In dark mode, the ▶ play button should pulse with the `text-glow` animation (subtle cyan/purple glow cycle every 2 seconds).

- [ ] **Step 6: Commit version bump**

Update `frontend/package.json` version field from current to next patch (e.g. `0.1.0` → `0.2.0`). Then commit:

```bash
cd "G:/kvcd/VSCODE - Main/Plex Stuff/MovieNexus"
git add frontend/package.json
git commit -m "chore: bump version to 0.2.0 (brand theme)"
git push origin main
```
