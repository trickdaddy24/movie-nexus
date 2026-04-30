"use client";

import { useState } from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  baseHref: string; // e.g. "/movies?sort=added_at&category=all"
}

export default function Pagination({ page, totalPages, baseHref }: PaginationProps) {
  const [jumpValue, setJumpValue] = useState("");

  if (totalPages <= 1) return null;

  const sep = baseHref.includes("?") ? "&" : "?";
  const href = (p: number) => `${baseHref}${sep}page=${p}`;

  // Build page number list: 1 ... [current-2 .. current+2] ... last
  const pages: (number | "...")[] = [];
  const range = 2;
  const start = Math.max(2, page - range);
  const end = Math.min(totalPages - 1, page + range);

  pages.push(1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("...");
  if (totalPages > 1) pages.push(totalPages);

  function handleJump(e: React.FormEvent) {
    e.preventDefault();
    const target = parseInt(jumpValue);
    if (target >= 1 && target <= totalPages && target !== page) {
      window.location.href = href(target);
    }
  }

  const linkClass =
    "rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1C1C1E] px-3 py-2 text-sm text-gray-700 dark:text-[#A1A1A1] hover:border-nexus-accent dark:hover:border-[#39FFEE] transition";
  const activeClass =
    "rounded-lg bg-nexus-accent px-3 py-2 text-sm font-medium text-white";
  const disabledClass =
    "rounded-lg border border-gray-100 dark:border-[#1A1A1A] bg-gray-50 dark:bg-[#151515] px-3 py-2 text-sm text-gray-300 dark:text-[#444] cursor-default";

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      {/* Page numbers */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {page > 1 ? (
          <a href={href(page - 1)} className={linkClass}>Prev</a>
        ) : (
          <span className={disabledClass}>Prev</span>
        )}

        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} className="px-2 py-2 text-sm text-gray-400 dark:text-[#555]">...</span>
          ) : (
            <a key={p} href={href(p)} className={p === page ? activeClass : linkClass}>
              {p}
            </a>
          )
        )}

        {page < totalPages ? (
          <a href={href(page + 1)} className={linkClass}>Next</a>
        ) : (
          <span className={disabledClass}>Next</span>
        )}
      </div>

      {/* Jump to page */}
      <form onSubmit={handleJump} className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-[#777]">Go to</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={jumpValue}
          onChange={(e) => setJumpValue(e.target.value)}
          placeholder={`${page}`}
          className="w-16 rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1C1C1E] px-2 py-1.5 text-sm text-center text-gray-700 dark:text-[#A1A1A1] focus:outline-none focus:border-nexus-accent dark:focus:border-[#39FFEE]"
        />
        <button
          type="submit"
          className="rounded-lg border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1C1C1E] px-3 py-1.5 text-xs text-gray-600 dark:text-[#A1A1A1] hover:border-nexus-accent dark:hover:border-[#39FFEE] transition"
        >
          Go
        </button>
        <span className="text-xs text-gray-400 dark:text-[#555]">of {totalPages}</span>
      </form>
    </div>
  );
}
