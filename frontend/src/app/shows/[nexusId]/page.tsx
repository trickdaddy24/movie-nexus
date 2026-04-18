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
        <h1 className="text-3xl font-bold dark:text-white">{show.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-nexus-muted mt-3 dark:text-[#64748B]">
          {year && <span>{year}{show.last_air_date ? `–${new Date(show.last_air_date).getFullYear()}` : "–"}</span>}
          {show.status && <span>{show.status}</span>}
          <span>{show.number_of_seasons} Seasons</span>
          <span>{show.number_of_episodes} Episodes</span>
          {show.content_rating && (
            <span className="rounded border border-nexus-border px-2 py-0.5 text-xs dark:border-[#1E2A5A] dark:text-nexus-muted">
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
              className="rounded-full border border-nexus-border bg-nexus-card px-3 py-1 text-sm dark:bg-[#1E2A5A] dark:text-nexus-muted dark:border-[#1E2A5A]"
            >
              {g.name}
            </span>
          ))}
        </div>
      )}

      {show.overview && (
        <section>
          <h2 className="text-lg font-semibold mb-2 dark:text-white">Overview</h2>
          <p className="text-nexus-muted leading-relaxed dark:text-[#64748B]">{show.overview}</p>
        </section>
      )}

      {show.seasons.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Seasons</h2>
          <div className="space-y-4">
            {show.seasons.map((season) => (
              <details
                key={season.season_number}
                className="group rounded-xl border border-nexus-border bg-nexus-card dark:bg-[#121840] dark:border-[#1E2A5A]"
              >
                <summary className="flex cursor-pointer items-center justify-between p-4 hover:bg-nexus-border/30 transition rounded-xl dark:text-white">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      {season.name || `Season ${season.season_number}`}
                    </span>
                    <span className="text-xs text-nexus-muted">
                      {season.episodes.length} episodes
                    </span>
                  </div>
                  {season.air_date && (
                    <span className="text-xs text-nexus-muted">
                      {new Date(season.air_date).getFullYear()}
                    </span>
                  )}
                </summary>
                <div className="border-t border-nexus-border dark:border-[#1E2A5A]">
                  {season.episodes.map((ep) => (
                    <div
                      key={ep.nexus_id}
                      className="flex items-center gap-4 border-b border-nexus-border/50 px-4 py-3 last:border-b-0 dark:border-[#1E2A5A]/50"
                    >
                      <span className="w-8 text-center text-xs text-nexus-muted font-mono">
                        {ep.episode_number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate dark:text-white">
                          {ep.title || `Episode ${ep.episode_number}`}
                        </div>
                        {ep.air_date && (
                          <div className="text-xs text-nexus-muted">{ep.air_date}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {ep.runtime && (
                          <span className="text-xs text-nexus-muted">{ep.runtime}m</span>
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

      <div className="border-t border-nexus-border pt-4 text-xs text-nexus-muted dark:border-[#1E2A5A]">
        <span>Added: {show.added_at ? new Date(show.added_at).toLocaleDateString() : "—"}</span>
        {show.updated_at && (
          <span className="ml-4">Updated: {new Date(show.updated_at).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}
