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
        <h1 className="text-4xl font-bold mb-2">
          <span className="text-nexus-accent">Movie</span>Nexus
        </h1>
        <p className="text-nexus-muted mt-4">Unable to connect to API. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section className="text-center py-8">
        <h1 className="text-4xl font-bold mb-2">
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
          <h2 className="text-lg font-semibold mb-3 dark:text-white">Top Genres</h2>
          <div className="flex flex-wrap gap-2">
            {stats.top_genres.map((g) => (
              <span
                key={g.name}
                className="rounded-full border border-nexus-border bg-nexus-card px-3 py-1 text-sm text-nexus-text dark:bg-[#121840] dark:border-[#1E2A5A] dark:text-nexus-muted"
              >
                {g.name} <span className="text-nexus-muted">({g.count})</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {movies.items.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold dark:text-white">Recent Movies</h2>
            <Link href="/movies" className="text-sm text-nexus-accent hover:text-nexus-accent-hover dark:hover:text-[#00E0FF] transition">
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
            <h2 className="text-lg font-semibold dark:text-white">Recent TV Shows</h2>
            <Link href="/shows" className="text-sm text-nexus-accent hover:text-nexus-accent-hover dark:hover:text-[#00E0FF] transition">
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
    <div className="rounded-xl border border-nexus-border bg-nexus-card p-4 text-center dark:bg-[#121840] dark:border-[#1E2A5A]">
      <div className="text-2xl font-bold text-nexus-accent">{value}</div>
      <div className="text-xs text-nexus-muted mt-1 dark:text-[#64748B]">{label}</div>
    </div>
  );
}
