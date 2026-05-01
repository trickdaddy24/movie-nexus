"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import RatingBadge from "./RatingBadge";
import { COUNTRY_MAP } from "@/lib/origin";

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
  originCountry?: string | null;
  originalLanguage?: string | null;
  mediaType?: "movie" | "show";
}

export default function MediaCard({
  title,
  year,
  rating,
  genres,
  subtitle,
  href,
  posterUrl,
  originCountry,
  originalLanguage: _originalLanguage,
  mediaType,
}: MediaCardProps) {
  const yearStr = year ? new Date(year).getFullYear() : null;
  const [imgError, setImgError] = useState(false);
  const thumbUrl = posterUrl?.replace("/original/", "/w342/");
  const router = useRouter();
  const genreBase = mediaType === "show" ? "/shows" : "/movies";

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-nexus-border bg-nexus-card transition-all duration-200 hover:border-nexus-accent hover:shadow-[0_4px_12px_rgba(0,245,255,0.15)] dark:bg-[#1C1C1E] dark:border-[#2A2A2A] dark:hover:border-[#39FFEE] dark:hover:shadow-[0_0_20px_rgba(57,255,238,0.35)]"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#F0F9FF] dark:bg-[#2A2A2A]">
        {thumbUrl && !imgError ? (
          <img
            src={thumbUrl}
            alt={title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-nexus-muted text-4xl font-bold opacity-20">
            {title.charAt(0)}
          </div>
        )}
        {rating !== null && (
          <div className="absolute bottom-2 left-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold backdrop-blur-sm ${
                rating >= 7.5
                  ? "bg-green-600/80 text-white"
                  : rating >= 5
                    ? "bg-yellow-500/80 text-white"
                    : "bg-red-500/80 text-white"
              }`}
            >
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {rating.toFixed(1)}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="text-sm font-semibold text-nexus-text line-clamp-2 group-hover:text-nexus-accent transition dark:text-white">
          {title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-nexus-muted dark:text-[#A1A1A1]">
          {yearStr && <span>{yearStr}</span>}
          {subtitle && <span>{subtitle}</span>}
        </div>
        {originCountry && (() => {
          const code = originCountry.split(",")[0].trim();
          const country = COUNTRY_MAP[code];
          if (!country) return null;
          return (
            <div
              className="mt-1 inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border"
              style={{
                background: country.bg,
                borderColor: country.color + "33",
                color: country.color,
              }}
            >
              <span>{country.flag}</span>
              <span>{country.name}</span>
            </div>
          );
        })()}
        {genres.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-2">
            {genres.slice(0, 3).map((g) => (
              <button
                key={g.name}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(`${genreBase}?genre=${encodeURIComponent(g.name)}`);
                }}
                className="rounded-full bg-[#F0F9FF] px-2 py-0.5 text-[10px] text-[#0891B2] border border-[#CCE8F0] hover:bg-[#0891B2] hover:text-white hover:border-[#0891B2] transition dark:bg-[#2A2A2A] dark:text-[#A1A1A1] dark:border-[#3A3A3A] dark:hover:bg-[#39FFEE] dark:hover:text-[#0A0A0A] dark:hover:border-[#39FFEE]"
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
