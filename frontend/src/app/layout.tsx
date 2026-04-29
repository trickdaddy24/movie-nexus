import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import SearchBar from "@/components/SearchBar";
import LogoBrand from "@/components/LogoBrand";
import ThemeToggle from "@/components/ThemeToggle";
import SessionWrapper from "@/components/SessionWrapper";
import SignOutButton from "@/components/SignOutButton";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "MovieNexus",
  description: "Movie & TV show database with multi-source ratings and artwork",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen transition-colors font-sans">
        {/* Background blobs — light mode subtle, dark mode animated */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="mol-blob-tr" />
          <div className="mol-blob-bl" />
        </div>

        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <SessionWrapper>
            <nav className="sticky top-0 z-50 border-b border-nexus-border dark:border-[#2A2A2A] bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur-md">
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
                  <Link
                    href="/admin"
                    className="text-sm text-nexus-muted hover:text-nexus-text dark:hover:text-white transition"
                  >
                    Admin
                  </Link>
                  <SearchBar />
                  <ThemeToggle />
                  <SignOutButton />
                </div>
              </div>
            </nav>
            <main className="relative z-10 mx-auto max-w-7xl px-4 py-8">{children}</main>
            <footer className="relative z-10 border-t border-nexus-border dark:border-[#2A2A2A]">
              <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-center">
                <p className="text-xs text-nexus-muted dark:text-[#A1A1A1]">
                  Built by{" "}
                  <a
                    href="https://minus-one-labs.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-nexus-accent hover:opacity-80 transition"
                  >
                    Minus One Labs
                  </a>
                </p>
              </div>
            </footer>
          </SessionWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
