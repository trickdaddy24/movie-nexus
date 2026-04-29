import { getShow } from "@/lib/api";
import RatingBadge from "@/components/RatingBadge";
import { notFound } from "next/navigation";
import { COUNTRY_MAP, LANGUAGE_MAP, getCategoryLabel } from "@/lib/origin";
import Link from "next/link";

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
        <h1 className="text-3xl font-bold dark:text-white">{show.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-nexus-muted mt-3 dark:text-[#A1A1A1]">
          {year && <span>{year}{show.last_air_date ? `–${new Date(show.last_air_date).getFullYear()}` : "–"}</span>}
          {show.status && <span>{show.status}</span>}
          <span className="dark:text-[#A1A1A1]">{show.number_of_seasons} Seasons</span>
          <span className="dark:text-[#A1A1A1]">{show.number_of_episodes} Episodes</span>
          {show.content_rating && (
            <span className="rounded border border-nexus-border px-2 py-0.5 text-xs dark:border-[#2A2A2A] dark:text-[#A1A1A1]">
              {show.content_rating}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <RatingBadge rating={show.rating_tmdb} label="TMDb" />
        <RatingBadge rating={show.rating_imdb} label="IMDb" />
        <RatingBadge rating={show.rating_trakt} label="Trakt" />
      </div>

      {/* IDs */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-nexus-muted dark:text-[#A1A1A1]">
        <span>
          <span className="font-semibold text-[#111827] dark:text-white">Nexus</span>{" "}
          <span className="font-mono">{show.nexus_id}</span>
        </span>
        {show.tmdb_id && (
          <span>
            <span className="font-semibold text-[#111827] dark:text-white">TMDb</span>{" "}
            <a
              href={`https://www.themoviedb.org/tv/${show.tmdb_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:text-nexus-accent dark:hover:text-[#39FFEE] transition"
            >
              {show.tmdb_id}
            </a>
          </span>
        )}
        {show.imdb_id && (
          <span>
            <span className="font-semibold text-[#111827] dark:text-white">IMDb</span>{" "}
            <a
              href={`https://www.imdb.com/title/${show.imdb_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:text-nexus-accent dark:hover:text-[#39FFEE] transition"
            >
              {show.imdb_id}
            </a>
          </span>
        )}
        {show.tvdb_id && (
          <span>
            <span className="font-semibold text-[#111827] dark:text-white">TVDB</span>{" "}
            <a
              href={`https://thetvdb.com/dereferrer/series/${show.tvdb_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:text-nexus-accent dark:hover:text-[#39FFEE] transition"
            >
              {show.tvdb_id}
            </a>
          </span>
        )}
      </div>

      {show.origin_country && (() => {
        const code = show.origin_country.split(",")[0].trim();
        const country = COUNTRY_MAP[code];
        const langName = LANGUAGE_MAP[show.original_language || ""] || show.original_language || "";
        const catLabel = getCategoryLabel(show.origin_country, show.original_language || "", show.genres, show.content_rating);
        return (
          <div className="flex items-center gap-3 rounded-lg border border-nexus-border dark:border-[#2A2A2A] bg-nexus-card dark:bg-[#1C1C1E] px-4 py-3">
            <span className="text-3xl">{country?.flag ?? "🌐"}</span>
            <div>
              <div className="font-semibold dark:text-white">{country?.name ?? code}</div>
              <div className="text-xs text-nexus-muted dark:text-[#A1A1A1]">
                {langName}{langName ? " · " : ""}{catLabel}
              </div>
            </div>
            <span className="ml-auto rounded-full px-3 py-1 text-xs font-semibold border border-nexus-accent/30 text-nexus-accent dark:border-[#39FFEE]/40 dark:text-[#39FFEE]">
              {catLabel.toUpperCase()}
            </span>
          </div>
        );
      })()}

      {show.genres.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {show.genres.map((g) => (
            <Link
              key={g.name}
              href={`/shows?genre=${encodeURIComponent(g.name)}`}
              className="rounded-full border border-nexus-border bg-nexus-card px-3 py-1 text-sm dark:bg-[#2A2A2A] dark:text-[#A1A1A1] dark:border-[#3A3A3A] hover:border-nexus-accent hover:text-nexus-accent dark:hover:border-[#39FFEE] dark:hover:text-[#39FFEE] transition"
            >
              {g.name}
            </Link>
          ))}
        </div>
      )}

      {show.overview && (
        <section>
          <h2 className="text-lg font-semibold mb-2 dark:text-white">Overview</h2>
          <p className="text-nexus-muted leading-relaxed dark:text-[#A1A1A1]">{show.overview}</p>
        </section>
      )}

      {show.seasons.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Seasons</h2>
          <div className="space-y-4">
            {show.seasons.map((season) => (
              <details
                key={season.season_number}
                className="group rounded-xl border border-nexus-border bg-nexus-card dark:bg-[#1C1C1E] dark:border-[#2A2A2A]"
              >
                <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-nexus-border/30 transition rounded-xl dark:text-white">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      {season.name || `Season ${season.season_number}`}
                    </span>
                    <span className="text-xs text-nexus-muted dark:text-[#A1A1A1]">
                      {season.episodes.length} episodes
                    </span>
                  </div>
                  {season.air_date && (
                    <span className="text-xs text-nexus-muted dark:text-[#A1A1A1]">
                      {new Date(season.air_date).getFullYear()}
                    </span>
                  )}
                </summary>
                <div className="border-t border-nexus-border dark:border-[#2A2A2A]">
                  {season.episodes.map((ep) => (
                    <div
                      key={ep.nexus_id}
                      className="flex items-center gap-4 border-b border-nexus-border/50 px-4 py-3 last:border-b-0 dark:border-[#2A2A2A]/50"
                    >
                      <span className="w-8 text-center text-xs text-nexus-muted dark:text-[#A1A1A1] font-mono">
                        {ep.episode_number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate dark:text-white">
                          {ep.title || `Episode ${ep.episode_number}`}
                        </div>
                        {ep.air_date && (
                          <div className="text-xs text-nexus-muted dark:text-[#A1A1A1]">{ep.air_date}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ep.runtime && (
                          <span className="text-xs text-nexus-muted dark:text-[#A1A1A1]">{ep.runtime}m</span>
                        )}
                        <RatingBadge rating={ep.rating_tmdb} />
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      <div className="border-t border-nexus-border pt-4 text-xs text-nexus-muted dark:border-[#2A2A2A]">
        <span>Added: {show.added_at ? new Date(show.added_at).toLocaleDateString() : "—"}</span>
        {show.updated_at && (
          <span className="ml-4">Updated: {new Date(show.updated_at).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}
