import { getMovie } from "@/lib/api";
import { notFound } from "next/navigation";
import { COUNTRY_MAP, LANGUAGE_MAP, getCategoryLabel } from "@/lib/origin";
import Link from "next/link";

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
  const posterSrc = movie.poster_url?.replace("/original/", "/w500/") ?? null;

  const originCode = movie.origin_country?.split(",")[0].trim() ?? null;
  const country = originCode ? COUNTRY_MAP[originCode] : null;
  const langName = movie.original_language
    ? LANGUAGE_MAP[movie.original_language] ?? movie.original_language
    : null;
  const catLabel = movie.origin_country
    ? getCategoryLabel(movie.origin_country, movie.original_language ?? "", movie.genres, movie.content_rating)
    : null;

  const meta = [
    year,
    movie.runtime ? `${movie.runtime} min` : null,
    movie.status,
  ].filter(Boolean);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back link */}
      <Link
        href="/movies"
        className="inline-flex items-center gap-1.5 text-sm text-nexus-muted dark:text-[#A1A1A1] hover:text-nexus-accent dark:hover:text-[#39FFEE] transition mb-6"
      >
        <span aria-hidden>←</span> All Movies
      </Link>

      {/* Hero: poster + primary info */}
      <div className="flex flex-col sm:flex-row gap-8 mb-10">
        {/* Poster */}
        <div className="shrink-0 w-full sm:w-56">
          <div className="relative w-full sm:w-56 aspect-[2/3] rounded-xl overflow-hidden bg-[#1C1C1E] border border-[#2A2A2A] shadow-[0_0_40px_rgba(0,245,255,0.08)]">
            {posterSrc ? (
              <img
                src={posterSrc}
                alt={`${movie.title} poster`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-5xl font-black text-[#2A2A2A]">
                {movie.title.charAt(0)}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Title + content rating */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-black tracking-tight text-[#111827] dark:text-white leading-tight">
                {movie.title}
              </h1>
              {movie.original_title && movie.original_title !== movie.title && (
                <p className="text-sm text-nexus-muted dark:text-[#A1A1A1] mt-0.5">
                  {movie.original_title}
                </p>
              )}
              {movie.tagline && (
                <p className="text-sm italic text-nexus-muted dark:text-[#A1A1A1] mt-1">
                  &ldquo;{movie.tagline}&rdquo;
                </p>
              )}
            </div>
            {movie.content_rating && (
              <span className="shrink-0 mt-1 rounded border border-nexus-border dark:border-[#2A2A2A] px-2 py-0.5 text-xs font-mono text-nexus-muted dark:text-[#A1A1A1]">
                {movie.content_rating}
              </span>
            )}
          </div>

          {/* Meta row */}
          {meta.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-nexus-muted dark:text-[#A1A1A1]">
              {meta.map((item, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-[#3A3A3A]">·</span>}
                  {item}
                </span>
              ))}
            </div>
          )}

          {/* Ratings */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "TMDb", value: movie.rating_tmdb },
              { label: "IMDb", value: movie.rating_imdb },
              { label: "Trakt", value: movie.rating_trakt },
            ]
              .filter((r) => r.value !== null && r.value !== undefined)
              .map((r) => {
                const score = r.value!;
                const pct = Math.round(score * 10);
                const color =
                  pct >= 70
                    ? "text-[#22C55E] border-[#22C55E]/30 bg-[#22C55E]/5"
                    : pct >= 50
                    ? "text-[#EAB308] border-[#EAB308]/30 bg-[#EAB308]/5"
                    : "text-[#EF4444] border-[#EF4444]/30 bg-[#EF4444]/5";
                return (
                  <div
                    key={r.label}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${color}`}
                  >
                    <span className="text-base font-black">{score.toFixed(1)}</span>
                    <span className="text-xs font-semibold opacity-70">{r.label}</span>
                  </div>
                );
              })}
          </div>

          {/* IDs */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-nexus-muted dark:text-[#A1A1A1]">
            <span>
              <span className="font-semibold text-[#111827] dark:text-white">Nexus</span>{" "}
              <span className="font-mono">{movie.nexus_id}</span>
            </span>
            {movie.tmdb_id && (
              <span>
                <span className="font-semibold text-[#111827] dark:text-white">TMDb</span>{" "}
                <a
                  href={`https://www.themoviedb.org/movie/${movie.tmdb_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono hover:text-nexus-accent dark:hover:text-[#39FFEE] transition"
                >
                  {movie.tmdb_id}
                </a>
              </span>
            )}
            {movie.imdb_id && (
              <span>
                <span className="font-semibold text-[#111827] dark:text-white">IMDb</span>{" "}
                <a
                  href={`https://www.imdb.com/title/${movie.imdb_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono hover:text-nexus-accent dark:hover:text-[#39FFEE] transition"
                >
                  {movie.imdb_id}
                </a>
              </span>
            )}
          </div>

          {/* Origin */}
          {country && (
            <div className="flex items-center gap-2">
              <span className="text-2xl">{country.flag}</span>
              <div>
                <span className="text-sm font-semibold text-[#111827] dark:text-white">
                  {country.name}
                </span>
                {(langName || catLabel) && (
                  <span className="text-sm text-nexus-muted dark:text-[#A1A1A1]">
                    {langName ? ` · ${langName}` : ""}
                    {catLabel ? ` · ${catLabel}` : ""}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Genres */}
          {movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {movie.genres.map((g) => (
                <Link
                  key={g.name}
                  href={`/movies?genre=${encodeURIComponent(g.name)}`}
                  className="rounded-full border border-nexus-border dark:border-[#2A2A2A] bg-nexus-card dark:bg-[#1C1C1E] px-3 py-1 text-xs font-medium text-nexus-muted dark:text-[#A1A1A1] hover:border-nexus-accent hover:text-nexus-accent dark:hover:border-[#39FFEE] dark:hover:text-[#39FFEE] transition"
                >
                  {g.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overview */}
      {movie.overview && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-nexus-accent dark:text-[#39FFEE] mb-3">
            Overview
          </h2>
          <p className="text-[#374151] dark:text-[#D1D5DB] leading-relaxed max-w-[68ch]">
            {movie.overview}
          </p>
        </section>
      )}

      {/* Stats grid */}
      {(movie.budget > 0 || movie.revenue > 0 || movie.vote_count_tmdb > 0) && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-nexus-accent dark:text-[#39FFEE] mb-3">
            Details
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {movie.budget > 0 && (
              <StatCard label="Budget" value={`$${(movie.budget / 1_000_000).toFixed(0)}M`} />
            )}
            {movie.revenue > 0 && (
              <StatCard label="Revenue" value={`$${(movie.revenue / 1_000_000).toFixed(0)}M`} />
            )}
            {movie.vote_count_tmdb > 0 && (
              <StatCard label="TMDb Votes" value={movie.vote_count_tmdb.toLocaleString()} />
            )}
          </div>
        </section>
      )}

      {/* Footer meta */}
      <div className="border-t border-nexus-border dark:border-[#2A2A2A] pt-4 flex flex-wrap gap-4 text-xs text-nexus-muted dark:text-[#A1A1A1]">
        {movie.added_at && (
          <span>Added {new Date(movie.added_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
        )}
        {movie.updated_at && (
          <span>Updated {new Date(movie.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
        )}
        {movie.homepage && (
          <a
            href={movie.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-nexus-accent dark:hover:text-[#39FFEE] transition"
          >
            Official Site →
          </a>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-nexus-border dark:border-[#2A2A2A] bg-nexus-card dark:bg-[#1C1C1E] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-nexus-muted dark:text-[#A1A1A1] mb-1">
        {label}
      </div>
      <div className={`text-base font-bold text-[#111827] dark:text-white ${mono ? "font-mono text-sm" : ""}`}>
        {value}
      </div>
    </div>
  );
}
