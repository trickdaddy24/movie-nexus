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
        <h1 className="text-2xl font-bold mb-4">TV Shows</h1>
        <p className="text-nexus-muted">Unable to load shows. Please try again later.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">TV Shows</h1>
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
              className="rounded-lg border border-nexus-border bg-nexus-card px-4 py-2 text-sm hover:border-nexus-accent transition"
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
              className="rounded-lg border border-nexus-border bg-nexus-card px-4 py-2 text-sm hover:border-nexus-accent transition"
            >
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
