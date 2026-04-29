"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import LogoBrand from "@/components/LogoBrand";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password.");
    } else {
      router.push("/admin");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-nexus-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <LogoBrand />
        </div>

        <div className="bg-nexus-card dark:bg-[#1C1C1E] rounded-2xl border border-nexus-border dark:border-[#2A2A2A] p-8 shadow-sm">
          <h1 className="text-xl font-bold text-nexus-text dark:text-white mb-6 text-center">
            Admin Login
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-nexus-muted dark:text-gray-400 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-nexus-border dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] text-nexus-text dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nexus-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-nexus-muted dark:text-gray-400 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-nexus-border dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] text-nexus-text dark:text-white px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-nexus-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-nexus-muted hover:text-nexus-accent transition-colors text-xs"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-xs text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-nexus-accent hover:bg-nexus-accent-hover text-white font-semibold text-sm transition-colors disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
