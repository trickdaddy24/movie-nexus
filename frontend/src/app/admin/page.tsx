"use client";

import { useEffect, useRef, useState } from "react";
import {
  getImportSessions,
  startBulkImport,
  startBackfill,
  verifyArtwork,
  getImportLogs,
  getPlexStatus,
  startPlexSync,
  startPlexRefresh,
  ImportSessionSummary,
  ArtworkVerifyResult,
  ImportLogEntry,
  PlexStatus,
} from "@/lib/api";

const API_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "/api"
    : "/api";

const IMPORT_CATEGORIES = [
  { id: "all",         label: "All",         emoji: "🌐", desc: "all titles" },
  { id: "usa",         label: "USA",          emoji: "🇺🇸", desc: "US origin" },
  { id: "anime",       label: "Anime",        emoji: "⛩️", desc: "Japanese Animation" },
  { id: "korean",      label: "Korean",       emoji: "🇰🇷", desc: "Korean origin" },
  { id: "indian",      label: "Indian",       emoji: "🇮🇳", desc: "Indian origin" },
  { id: "documentary", label: "Documentary",  emoji: "📽️", desc: "Documentary genre" },
  { id: "kids",        label: "Kids",         emoji: "👶", desc: "US Family/Animation" },
] as const;

export default function AdminPage() {
  const [sessions, setSessions] = useState<ImportSessionSummary[]>([]);
  const [liveProgress, setLiveProgress] = useState<{
    imported: number;
    skipped: number;
    failed: number;
    total: number;
    current_title?: string;
  } | null>(null);
  const [artworkResults, setArtworkResults] = useState<ArtworkVerifyResult[]>([]);
  const [artworkLoading, setArtworkLoading] = useState(false);
  const [startForm, setStartForm] = useState({ media_type: "movie", pages: 100, category: "all" });
  const [startStatus, setStartStatus] = useState<string | null>(null);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [logs, setLogs] = useState<ImportLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSession, setLogSession] = useState<number | undefined>(undefined);
  const [liveLogLines, setLiveLogLines] = useState<string[]>([]);
  const logStreamRef = useRef<EventSource | null>(null);

  const [backfillLoading, setBackfillLoading] = useState(false);

  const [plexStatus, setPlexStatus] = useState<PlexStatus | null>(null);
  const [plexLoading, setPlexLoading] = useState(false);
  const [plexSyncStatus, setPlexSyncStatus] = useState<string | null>(null);
  const [plexRefreshStatus, setPlexRefreshStatus] = useState<string | null>(null);
  const [plexSyncProgress, setPlexSyncProgress] = useState<{
    imported: number; skipped: number; failed: number; total: number; current_title?: string;
  } | null>(null);
  const plexSseRef = useRef<EventSource | null>(null);

  const sseRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const initialProcessedRef = useRef<number>(0);

  useEffect(() => {
    loadSessions();
    loadPlexStatus();
    return () => {
      sseRef.current?.close();
      logStreamRef.current?.close();
      plexSseRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSessions() {
    setLoading(true);
    try {
      const data = await getImportSessions(20);
      setSessions(data);
      const live = data.find((s) => s.is_live);
      if (live) connectSSE(live.id);
    } finally {
      setLoading(false);
    }
  }

  function connectSSE(sessionId: number) {
    if (sseRef.current) sseRef.current.close();
    startTimeRef.current = null;
    initialProcessedRef.current = 0;

    const es = new EventSource(`${API_URL}/import/progress/${sessionId}`);
    sseRef.current = es;

    es.addEventListener("progress", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      const imported = d.imported ?? 0;
      const skipped = d.skipped ?? 0;
      const failed = d.failed ?? 0;
      const processed = imported + skipped + failed;
      if (startTimeRef.current === null && processed > 0) {
        startTimeRef.current = Date.now();
        initialProcessedRef.current = processed;
      }
      setLiveProgress({
        imported,
        skipped,
        failed,
        total: d.total ?? 0,
        current_title: d.current_title,
      });
    });

    es.addEventListener("complete", () => {
      es.close();
      sseRef.current = null;
      loadSessions();
    });

    es.onerror = () => {
      es.close();
      sseRef.current = null;
    };
  }

  async function loadLogs(session_id?: number) {
    setLogsLoading(true);
    try {
      setLogs(await getImportLogs(session_id, 100));
    } finally {
      setLogsLoading(false);
    }
  }

  function connectLogStream() {
    if (logStreamRef.current) logStreamRef.current.close();
    const es = new EventSource(`${API_URL}/admin/logs/stream`);
    logStreamRef.current = es;
    es.addEventListener("log", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setLiveLogLines((prev) => [...prev.slice(-199), d.line]);
    });
    es.onerror = () => {
      es.close();
      logStreamRef.current = null;
    };
  }

  function calcEta(): string | null {
    if (!liveProgress || !startTimeRef.current) return null;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const processed = liveProgress.imported + liveProgress.skipped + liveProgress.failed;
    const done = processed - initialProcessedRef.current;
    if (done <= 0 || elapsed <= 0) return null;
    const rate = done / elapsed;
    const remaining = liveProgress.total - processed;
    if (remaining <= 0) return "finishing…";
    const secs = Math.round(remaining / rate);
    if (secs < 60) return `~${secs}s`;
    if (secs < 3600) return `~${Math.round(secs / 60)}m`;
    return `~${(secs / 3600).toFixed(1)}h`;
  }

  async function handleStart() {
    setStartStatus("Starting…");
    try {
      const res = await startBulkImport(
        startForm.media_type as "movie" | "show",
        startForm.pages,
        startForm.category
      );
      setStartStatus(`Started — session #${res.session_id}`);
      await loadSessions();
    } catch (err: unknown) {
      setStartStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleBackfill(media_type: "movie" | "show") {
    setBackfillLoading(true);
    setBackfillStatus(`Starting backfill for ${media_type}s…`);
    try {
      const res = await startBackfill(media_type);
      setBackfillStatus(res.message);
    } catch (err: unknown) {
      setBackfillStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBackfillLoading(false);
    }
  }

  async function handleVerifyArtwork(media_type: string) {
    setArtworkLoading(true);
    try {
      setArtworkResults(await verifyArtwork(media_type, 50));
    } finally {
      setArtworkLoading(false);
    }
  }

  async function loadPlexStatus() {
    try {
      setPlexStatus(await getPlexStatus());
    } catch {
      setPlexStatus(null);
    }
  }

  function connectPlexSSE(sessionId: number) {
    if (plexSseRef.current) plexSseRef.current.close();
    const es = new EventSource(`${API_URL}/plex/progress/${sessionId}`);
    plexSseRef.current = es;
    es.addEventListener("progress", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setPlexSyncProgress({
        imported: d.imported ?? 0,
        skipped: d.skipped ?? 0,
        failed: d.failed ?? 0,
        total: d.total ?? 0,
        current_title: d.current_title,
      });
    });
    es.addEventListener("complete", () => {
      es.close();
      plexSseRef.current = null;
      setPlexSyncStatus("Sync complete.");
      setPlexSyncProgress(null);
      loadPlexStatus();
      loadSessions();
    });
    es.onerror = () => {
      es.close();
      plexSseRef.current = null;
    };
  }

  async function handlePlexSync(libraryKey?: string) {
    setPlexLoading(true);
    setPlexSyncStatus("Starting Plex sync...");
    setPlexSyncProgress(null);
    try {
      const res = await startPlexSync(libraryKey);
      setPlexSyncStatus(`Syncing — session #${res.session_id}`);
      connectPlexSSE(res.session_id);
    } catch (err: unknown) {
      setPlexSyncStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPlexLoading(false);
    }
  }

  async function handlePlexRefresh(mediaType: "movie" | "show") {
    setPlexLoading(true);
    setPlexRefreshStatus(`Refreshing ${mediaType} artwork...`);
    try {
      const res = await startPlexRefresh(mediaType);
      setPlexRefreshStatus(`Refreshing — session #${res.session_id}`);
      connectPlexSSE(res.session_id);
    } catch (err: unknown) {
      setPlexRefreshStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPlexLoading(false);
    }
  }

  const processed = liveProgress
    ? liveProgress.imported + liveProgress.skipped + liveProgress.failed
    : 0;
  const pct =
    liveProgress && liveProgress.total > 0
      ? Math.round((processed / liveProgress.total) * 100)
      : 0;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin</h1>

      {/* Live Monitor */}
      <section className="bg-white dark:bg-nexus-card rounded-xl border border-gray-200 dark:border-nexus-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Live Import Monitor</h2>
        {liveProgress ? (
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
              <span>{processed.toLocaleString()} / {liveProgress.total.toLocaleString()} records</span>
              <span>{pct}%{calcEta() ? ` — ETA ${calcEta()}` : ""}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-nexus-border rounded-full h-3">
              <div
                className="bg-nexus-accent h-3 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm text-center">
              <div>
                <div className="font-bold text-green-500">{liveProgress.imported.toLocaleString()}</div>
                <div className="text-gray-500 dark:text-gray-400">Added</div>
              </div>
              <div>
                <div className="font-bold text-yellow-400">{liveProgress.skipped.toLocaleString()}</div>
                <div className="text-gray-500 dark:text-gray-400">Skipped</div>
              </div>
              <div>
                <div className="font-bold text-red-400">{liveProgress.failed.toLocaleString()}</div>
                <div className="text-gray-500 dark:text-gray-400">Failed</div>
              </div>
            </div>
            {liveProgress.current_title && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{liveProgress.current_title}</p>
            )}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No active import.</p>
        )}
      </section>

      {/* Start Import */}
      <section className="bg-white dark:bg-nexus-card rounded-xl border border-gray-200 dark:border-nexus-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Start Bulk Import</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Category</label>
            <select
              value={startForm.category}
              onChange={(e) => setStartForm({ ...startForm, category: e.target.value })}
              className="rounded-lg border border-gray-300 dark:border-nexus-border bg-white dark:bg-nexus-bg text-gray-800 dark:text-gray-100 px-3 py-2 text-sm"
            >
              {IMPORT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Media Type</label>
            <select
              value={startForm.media_type}
              onChange={(e) => setStartForm({ ...startForm, media_type: e.target.value })}
              className="rounded-lg border border-gray-300 dark:border-nexus-border bg-white dark:bg-nexus-bg text-gray-800 dark:text-gray-100 px-3 py-2 text-sm"
            >
              <option value="movie">Movies</option>
              <option value="show">TV Shows</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Pages (1–5000)</label>
            <input
              type="number"
              min={1}
              max={5000}
              value={startForm.pages}
              onChange={(e) => setStartForm({ ...startForm, pages: parseInt(e.target.value) || 1 })}
              className="w-28 rounded-lg border border-gray-300 dark:border-nexus-border bg-white dark:bg-nexus-bg text-gray-800 dark:text-gray-100 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleStart}
            className="px-5 py-2 rounded-lg bg-nexus-accent text-nexus-bg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            ▶ Start
          </button>
        </div>
        {(() => {
          const cat = IMPORT_CATEGORIES.find((c) => c.id === startForm.category);
          const type = startForm.media_type === "movie" ? "movies" : "TV shows";
          const approx = (startForm.pages * 20).toLocaleString();
          return (
            <div className="rounded-lg bg-nexus-accent/5 border border-nexus-accent/20 px-4 py-2 text-sm text-gray-600 dark:text-[#A1A1A1]">
              {cat?.emoji} Will import up to{" "}
              <strong className="text-nexus-accent">~{approx} {cat?.label} {type}</strong>
              {" "}from TMDb ({cat?.desc})
            </div>
          );
        })()}
        {startStatus && <p className="text-sm text-gray-600 dark:text-gray-400">{startStatus}</p>}
      </section>

      {/* Backfill Origin Data */}
      <section className="bg-white dark:bg-nexus-card rounded-xl border border-gray-200 dark:border-nexus-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Backfill Origin Data</h2>
        <p className="text-sm text-gray-500 dark:text-[#A1A1A1]">
          Fetch and store <code className="text-nexus-accent">origin_country</code> +{" "}
          <code className="text-nexus-accent">original_language</code> for existing records that are missing this data.
          Run once after deploying the categories feature.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => handleBackfill("movie")}
            disabled={backfillLoading}
            className="px-4 py-2 rounded-lg bg-nexus-accent text-nexus-bg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {backfillLoading ? "Backfilling…" : "Backfill Movies"}
          </button>
          <button
            onClick={() => handleBackfill("show")}
            disabled={backfillLoading}
            className="px-4 py-2 rounded-lg bg-nexus-accent text-nexus-bg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {backfillLoading ? "Backfilling…" : "Backfill TV Shows"}
          </button>
        </div>
        {backfillStatus && <p className="text-sm text-gray-600 dark:text-gray-400">{backfillStatus}</p>}
      </section>

      {/* Plex Integration */}
      <section className="bg-white dark:bg-nexus-card rounded-xl border border-gray-200 dark:border-nexus-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Plex Integration</h2>
          <button onClick={loadPlexStatus} className="text-xs text-nexus-accent hover:underline">
            Refresh
          </button>
        </div>

        {plexStatus === null ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading Plex status...</p>
        ) : !plexStatus.configured ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Plex not configured. Set <code className="text-nexus-accent">PLEX_URL</code> and{" "}
            <code className="text-nexus-accent">PLEX_TOKEN</code> in your environment.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-gray-600 dark:text-gray-300">Connected to {plexStatus.url}</span>
              {plexStatus.last_sync && (
                <span className="text-gray-400 dark:text-gray-500 ml-auto">
                  Last sync: {new Date(plexStatus.last_sync).toLocaleString()}
                </span>
              )}
            </div>

            {plexStatus.libraries.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Libraries</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {plexStatus.libraries.map((lib) => (
                    <button
                      key={lib.key}
                      onClick={() => handlePlexSync(lib.key)}
                      disabled={plexLoading}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-[#2A2A2A] hover:border-nexus-accent dark:hover:border-nexus-accent text-sm transition-colors disabled:opacity-50"
                    >
                      <span className="text-gray-700 dark:text-gray-300">
                        {lib.title}
                        <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">
                          ({lib.type})
                        </span>
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{lib.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handlePlexSync()}
                disabled={plexLoading}
                className="px-4 py-2 rounded-lg bg-nexus-accent text-nexus-bg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {plexLoading ? "Syncing..." : "Sync All Libraries"}
              </button>
              <button
                onClick={() => handlePlexRefresh("movie")}
                disabled={plexLoading}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 text-sm hover:border-nexus-accent dark:hover:border-nexus-accent transition-colors disabled:opacity-50"
              >
                Refresh Movie Art
              </button>
              <button
                onClick={() => handlePlexRefresh("show")}
                disabled={plexLoading}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 text-sm hover:border-nexus-accent dark:hover:border-nexus-accent transition-colors disabled:opacity-50"
              >
                Refresh TV Art
              </button>
            </div>

            {plexSyncProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>
                    {(plexSyncProgress.imported + plexSyncProgress.skipped + plexSyncProgress.failed).toLocaleString()} / {plexSyncProgress.total.toLocaleString()}
                  </span>
                  <span>
                    {plexSyncProgress.total > 0
                      ? Math.round(((plexSyncProgress.imported + plexSyncProgress.skipped + plexSyncProgress.failed) / plexSyncProgress.total) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-[#2A2A2A] rounded-full h-2">
                  <div
                    className="bg-nexus-accent h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${plexSyncProgress.total > 0 ? Math.round(((plexSyncProgress.imported + plexSyncProgress.skipped + plexSyncProgress.failed) / plexSyncProgress.total) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs text-center">
                  <div>
                    <div className="font-bold text-green-500">{plexSyncProgress.imported}</div>
                    <div className="text-gray-500 dark:text-gray-400">Added</div>
                  </div>
                  <div>
                    <div className="font-bold text-yellow-400">{plexSyncProgress.skipped}</div>
                    <div className="text-gray-500 dark:text-gray-400">Skipped</div>
                  </div>
                  <div>
                    <div className="font-bold text-red-400">{plexSyncProgress.failed}</div>
                    <div className="text-gray-500 dark:text-gray-400">Failed</div>
                  </div>
                </div>
                {plexSyncProgress.current_title && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{plexSyncProgress.current_title}</p>
                )}
              </div>
            )}

            {plexSyncStatus && <p className="text-sm text-gray-600 dark:text-gray-400">{plexSyncStatus}</p>}
            {plexRefreshStatus && <p className="text-sm text-gray-600 dark:text-gray-400">{plexRefreshStatus}</p>}
          </>
        )}
      </section>

      {/* Session History */}
      <section className="bg-white dark:bg-nexus-card rounded-xl border border-gray-200 dark:border-nexus-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Import History</h2>
          <button onClick={loadSessions} className="text-xs text-nexus-accent hover:underline">
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No sessions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-nexus-border">
                  <th className="pb-2 pr-4">ID</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Processed</th>
                  <th className="pb-2 pr-4">Added</th>
                  <th className="pb-2">Started</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => s.is_live && connectSSE(s.id)}
                    className="border-b border-gray-100 dark:border-nexus-border/50 hover:bg-gray-50 dark:hover:bg-nexus-border/20 cursor-pointer"
                  >
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{s.id}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300 capitalize">{s.media_type}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.is_live
                            ? "bg-green-500/20 text-green-400"
                            : s.status === "completed"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {s.is_live ? "live" : s.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{s.processed.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{s.imported.toLocaleString()}</td>
                    <td className="py-2 text-gray-500 dark:text-gray-400">
                      {s.started_at ? new Date(s.started_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Export Downloads */}
      <section className="bg-white dark:bg-nexus-card rounded-xl border border-gray-200 dark:border-nexus-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Export Database</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(["json", "csv", "xml"] as const).flatMap((fmt) =>
            (["movie", "show"] as const).map((mt) => (
              <a
                key={`${mt}-${fmt}`}
                href={`${API_URL}/admin/export?format=${fmt}&media_type=${mt}`}
                download
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-gray-200 dark:border-nexus-border hover:border-nexus-accent dark:hover:border-nexus-accent text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
              >
                <span className="uppercase text-nexus-accent font-bold">{fmt}</span>
                <span className="capitalize">{mt === "show" ? "TV Shows" : "Movies"}</span>
              </a>
            ))
          )}
        </div>
      </section>

      {/* Artwork Verify */}
      <section className="bg-white dark:bg-nexus-card rounded-xl border border-gray-200 dark:border-nexus-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Artwork Verification</h2>
        <div className="flex gap-3">
          {(["movie", "show"] as const).map((mt) => (
            <button
              key={mt}
              onClick={() => handleVerifyArtwork(mt)}
              disabled={artworkLoading}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-nexus-border text-sm text-gray-700 dark:text-gray-300 hover:border-nexus-accent dark:hover:border-nexus-accent transition-colors disabled:opacity-50"
            >
              {artworkLoading ? "Checking…" : `Check ${mt === "show" ? "TV" : "Movie"} Art`}
            </button>
          ))}
        </div>
        {artworkResults.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {artworkResults.map((r) => (
              <div
                key={r.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs ${
                  r.valid
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
              >
                <span className="font-mono">{r.id}</span>
                <span className="truncate flex-1">{r.url}</span>
                {r.width && r.height && <span>{r.width}×{r.height}</span>}
                {r.reason && <span className="italic">{r.reason}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Import Error Logs */}
      <section className="bg-white dark:bg-nexus-card rounded-xl border border-gray-200 dark:border-nexus-border p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Import Error Logs</h2>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              placeholder="Session ID"
              value={logSession ?? ""}
              onChange={(e) => setLogSession(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-28 rounded-lg border border-gray-300 dark:border-nexus-border bg-white dark:bg-nexus-bg text-gray-800 dark:text-gray-100 px-2 py-1.5 text-xs"
            />
            <button
              onClick={() => loadLogs(logSession)}
              disabled={logsLoading}
              className="px-3 py-1.5 rounded-lg bg-nexus-accent text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              {logsLoading ? "Loading…" : "Load Logs"}
            </button>
          </div>
        </div>
        {logs.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No logs loaded. Enter a session ID and click Load Logs.</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto font-mono text-xs">
            {logs.map((l) => (
              <div
                key={l.id}
                className={`flex gap-3 px-3 py-1.5 rounded ${
                  l.level === "error"
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : l.level === "warning"
                    ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                    : "bg-gray-100 dark:bg-nexus-border/30 text-gray-600 dark:text-gray-400"
                }`}
              >
                <span className="shrink-0 text-gray-400">{l.tmdb_id ?? "—"}</span>
                <span className="truncate flex-1">{l.message}</span>
                <span className="shrink-0 text-gray-400">
                  {l.created_at ? new Date(l.created_at).toLocaleTimeString() : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Live Backend Logs */}
      <section className="bg-white dark:bg-nexus-card rounded-xl border border-gray-200 dark:border-nexus-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Live Backend Logs</h2>
          <div className="flex gap-2">
            <button
              onClick={connectLogStream}
              className="px-3 py-1.5 rounded-lg bg-nexus-accent text-white text-xs font-medium hover:opacity-90"
            >
              Connect
            </button>
            <button
              onClick={() => setLiveLogLines([])}
              className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-nexus-border text-gray-600 dark:text-gray-300 text-xs hover:border-nexus-accent"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="bg-gray-950 rounded-lg p-3 h-64 overflow-y-auto font-mono text-xs space-y-0.5">
          {liveLogLines.length === 0 ? (
            <p className="text-gray-500">Click Connect to start streaming…</p>
          ) : (
            liveLogLines.map((line, i) => (
              <div
                key={i}
                className={
                  line.includes("ERROR")
                    ? "text-red-400"
                    : line.includes("WARNING")
                    ? "text-yellow-400"
                    : "text-green-400"
                }
              >
                {line}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
