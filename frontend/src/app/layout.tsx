import type { Metadata } from "next";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import SearchBar from "@/components/SearchBar";
import LogoBrand from "@/components/LogoBrand";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "MovieNexus",
  description: "Movie & TV show database with multi-source ratings and artwork",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen transition-colors">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <nav className="sticky top-0 z-50 border-b border-nexus-border dark:border-[#1E2A5A] bg-white/90 dark:bg-[#0B0F2A]/90 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
              <Link href="/">
                <LogoBrand />
              </Link>
              <div className="flex items-center gap-6">
                <Link
                  href="/movies"
                  className="text-sm text-nexus-muted hover:text-nexus-text dark:hover:text-white transition"
                >
                  Movies
                </Link>
                <Link
                  href="/shows"
                  className="text-sm text-nexus-muted hover:text-nexus-text dark:hover:text-white transition"
                >
                  TV Shows
                </Link>
                <SearchBar />
                <ThemeToggle />
              </div>
            </div>
          </nav>
          <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
