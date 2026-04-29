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
          <div className="absolute top-2 right-2">
            <RatingBadge rating={rating} />
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
