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
            <h1 className="text-3xl font-bold dark:text-white">{movie.title}</h1>
            {movie.tagline && (
              <p className="text-nexus-muted italic mt-1">{movie.tagline}</p>
            )}
          </div>
          {movie.content_rating && (
            <span className="shrink-0 rounded border border-nexus-border px-2 py-1 text-xs text-nexus-muted dark:border-[#1E2A5A] dark:text-nexus-muted">
              {movie.content_rating}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-nexus-muted mt-3 dark:text-[#64748B]">
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
              className="rounded-full border border-nexus-border bg-nexus-card px-3 py-1 text-sm dark:bg-[#1E2A5A] dark:text-nexus-muted dark:border-[#1E2A5A]"
            >
              {g.name}
            </span>
          ))}
        </div>
      )}

      {movie.overview && (
        <section>
          <h2 className="text-lg font-semibold mb-2 dark:text-white">Overview</h2>
          <p className="text-nexus-muted leading-relaxed dark:text-[#64748B]">{movie.overview}</p>
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

      <div className="border-t border-nexus-border pt-4 text-xs text-nexus-muted dark:border-[#1E2A5A]">
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
    <div className="rounded-lg border border-nexus-border bg-nexus-card p-3 dark:bg-[#121840] dark:border-[#1E2A5A]">
      <div className="text-xs text-nexus-muted dark:text-[#64748B]">{label}</div>
      <div className="text-sm font-medium mt-0.5 dark:text-white">{value}</div>
    </div>
  );
}
