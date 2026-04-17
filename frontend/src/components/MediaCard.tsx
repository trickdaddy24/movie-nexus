"use client";

import Link from "next/link";
import { useState } from "react";
import RatingBadge from "./RatingBadge";

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
}

export default function MediaCard({
  title,
  year,
  rating,
  genres,
  subtitle,
  href,
  posterUrl,
}: MediaCardProps) {
  const yearStr = year ? new Date(year).getFullYear() : null;
  const [imgError, setImgError] = useState(false);
  const thumbUrl = posterUrl?.replace("/original/", "/w342/");

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-nexus-border bg-nexus-card transition hover:border-nexus-accent/50 hover:shadow-lg hover:shadow-nexus-accent/5"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-nexus-border">
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
        <h3 className="text-sm font-semibold text-nexus-text line-clamp-2 group-hover:text-nexus-accent transition">
          {title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-nexus-muted">
          {yearStr && <span>{yearStr}</span>}
          {subtitle && <span>{subtitle}</span>}
        </div>
        {genres.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-2">
            {genres.slice(0, 3).map((g) => (
              <span
                key={g.name}
                className="rounded-full bg-nexus-border px-2 py-0.5 text-[10px] text-nexus-muted"
              >
                {g.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
