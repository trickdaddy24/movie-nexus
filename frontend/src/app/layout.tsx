import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import SearchBar from "@/components/SearchBar";

export const metadata: Metadata = {
  title: "MovieNexus",
  description: "Movie & TV show database with multi-source ratings and artwork",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="sticky top-0 z-50 border-b border-nexus-border bg-nexus-bg/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-bold tracking-tight">
              <span className="text-nexus-accent">Movie</span>
              <span className="text-nexus-text">Nexus</span>
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/movies" className="text-sm text-nexus-muted hover:text-nexus-text transition">
                Movies
              </Link>
              <Link href="/shows" className="text-sm text-nexus-muted hover:text-nexus-text transition">
                TV Shows
              </Link>
              <SearchBar />
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
