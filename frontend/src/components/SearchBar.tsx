"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-48 rounded-lg border border-nexus-border bg-nexus-card px-3 py-1.5 text-sm text-nexus-text placeholder-nexus-muted outline-none focus:border-nexus-accent transition dark:bg-[#1C1C1E] dark:border-[#2A2A2A] dark:text-white dark:placeholder-[#6B7280] dark:focus:border-[#39FFEE]"
      />
    </form>
  );
}
