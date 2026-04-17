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
      <h1 className="text-2xl font-bold mb-6">
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
            className="flex items-center justify-between rounded-lg border border-nexus-border bg-nexus-card p-4 hover:border-nexus-accent/50 transition"
          >
            <div className="flex items-center gap-3">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                r.media_type === "movie"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-purple-500/20 text-purple-400"
              }`}>
                {r.media_type === "movie" ? "Movie" : "TV"}
              </span>
              <span className="font-medium">{r.title}</span>
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
