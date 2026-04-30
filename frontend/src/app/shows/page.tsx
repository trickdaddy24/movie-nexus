import { getShows } from "@/lib/api";
import MediaCard from "@/components/MediaCard";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

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

export default async function ShowsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; category?: string; genre?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1") || 1);
  const sort = params.sort || "added_at";
  const VALID_CATEGORY_IDS = CATEGORIES.map((c) => c.id);
  const category = VALID_CATEGORY_IDS.includes(params.category ?? "") ? params.category! : "all";
  const genre = params.genre || undefined;

  let data;
  try {
    data = await getShows(page, sort, "desc", category, genre);
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold dark:text-white">TV Shows</h1>
        <span className="text-sm text-nexus-muted">{data.total} total</span>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <a
            key={cat.id}
            href={`/shows?category=${cat.id}&sort=${sort}`}
            className={
              category === cat.id
                ? "rounded-full px-4 py-1.5 text-sm font-semibold bg-nexus-accent text-white"
                : "rounded-full px-4 py-1.5 text-sm border border-nexus-border text-nexus-muted hover:border-nexus-accent hover:text-nexus-accent transition dark:border-[#2A2A2A] dark:text-[#A1A1A1] dark:hover:border-[#39FFEE]"
            }
          >
            {cat.emoji} {cat.label}
          </a>
        ))}
      </div>

      {genre && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-nexus-muted dark:text-[#A1A1A1]">Filtered by:</span>
          <a
            href={`/shows?category=${category}&sort=${sort}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-nexus-accent/10 border border-nexus-accent/30 px-3 py-1 text-sm font-medium text-nexus-accent dark:text-[#39FFEE] dark:border-[#39FFEE]/30 hover:bg-nexus-accent/20 transition"
          >
            {genre}
            <span className="text-xs opacity-60">&times;</span>
          </a>
        </div>
      )}

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
            originCountry={s.origin_country}
            originalLanguage={s.original_language}
            mediaType="show"
          />
        ))}
      </div>

      <Pagination
        page={page}
        totalPages={data.pages}
        baseHref={`/shows?sort=${sort}&category=${category}${genre ? `&genre=${encodeURIComponent(genre)}` : ""}`}
      />
    </div>
  );
}
