"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getPlexStatus,
  startPlexSync,
  startPlexRefresh,
  getPlexHistory,
  getFullSyncStatus,
  startFullSync,
  pauseFullSync,
  resumeFullSync,
  cancelFullSync,
  PlexStatus,
  PlexLibraryProgress,
  PlexActivityItem,
  PlexSyncHistoryEntry,
  FullSyncStatus,
} from "@/lib/api";

const API_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "/api"
    : "/api";

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "--";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function PlexDashboard() {
  const [plexStatus, setPlexStatus] = useState<PlexStatus | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    imported: number; skipped: number; failed: number; total: number;
    current_title?: string; status?: string;
  } | null>(null);
  const [libraryProgress, setLibraryProgress] = useState<PlexLibraryProgress[]>([]);
  const [activityFeed, setActivityFeed] = useState<PlexActivityItem[]>([]);
  const [syncHistory, setSyncHistory] = useState<PlexSyncHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fullSync, setFullSync] = useState<FullSyncStatus | null>(null);
  const [fullSyncPolling, setFullSyncPolling] = useState(false);

  const sseRef = useRef<EventSource | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const initialProcessedRef = useRef<number>(0);

  useEffect(() => {
    loadPlexStatus();
    loadHistory();
    loadFullSyncStatus();
    return () => { sseRef.current?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll full sync status when active
  useEffect(() => {
    if (!fullSyncPolling) return;
    const iv = setInterval(async () => {
      try {
        const s = await getFullSyncStatus();
        setFullSync(s);
        if (s.status === "completed" || s.status === "failed" || s.status === "idle" || s.status === "cancelled") {
          setFullSyncPolling(false);
          loadHistory();
        }
      } catch { /* ignore */ }
    }, 10_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullSyncPolling]);

  // Auto-scroll activity feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [activityFeed]);

  async function loadPlexStatus() {
    try { setPlexStatus(await getPlexStatus()); } catch { setPlexStatus(null); }
  }

  async function loadHistory() {
    try { setSyncHistory(await getPlexHistory(20)); } catch { /* ignore */ }
  }

  async function loadFullSyncStatus() {
    try {
      const s = await getFullSyncStatus();
      setFullSync(s);
      if (s.status === "running" || s.status === "paused") {
        setFullSyncPolling(true);
      }
    } catch { /* ignore */ }
  }

  async function handleStartFullSync() {
    try {
      await startFullSync();
      setFullSyncPolling(true);
      // Small delay then fetch initial status
      setTimeout(loadFullSyncStatus, 1500);
    } catch (err: unknown) { console.error(err); }
  }

  async function handlePauseFullSync() {
    try { await pauseFullSync(); loadFullSyncStatus(); } catch (err: unknown) { console.error(err); }
  }

  async function handleResumeFullSync() {
    try {
      await resumeFullSync();
      setFullSyncPolling(true);
      loadFullSyncStatus();
    } catch (err: unknown) { console.error(err); }
  }

  async function handleCancelFullSync() {
    if (!confirm("Cancel the full sync? Progress will be lost.")) return;
    try {
      await cancelFullSync();
      setFullSync({ status: "idle" });
      setFullSyncPolling(false);
    } catch (err: unknown) { console.error(err); }
  }

  function connectSSE(sessionId: number) {
    if (sseRef.current) sseRef.current.close();
    startTimeRef.current = null;
    initialProcessedRef.current = 0;

    const es = new EventSource(`${API_URL}/plex/progress/${sessionId}`);
    sseRef.current = es;

    es.addEventListener("progress", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      const processed = (d.imported ?? 0) + (d.skipped ?? 0) + (d.failed ?? 0);
      if (startTimeRef.current === null && processed > 0) {
        startTimeRef.current = Date.now();
        initialProcessedRef.current = processed;
      }
      setSyncProgress({
        imported: d.imported ?? 0,
        skipped: d.skipped ?? 0,
        failed: d.failed ?? 0,
        total: d.total ?? 0,
        current_title: d.current_title,
        status: d.status,
      });
      if (d.libraries) setLibraryProgress(d.libraries);
    });

    es.addEventListener("items", (e) => {
      const newItems: PlexActivityItem[] = JSON.parse((e as MessageEvent).data);
      setActivityFeed(prev => [...prev, ...newItems].slice(-200));
    });

    es.addEventListener("complete", () => {
      es.close();
      sseRef.current = null;
      loadPlexStatus();
      loadHistory();
    });

    es.onerror = () => {
      es.close();
      sseRef.current = null;
    };
  }

  async function handleSync(libraryKey?: string) {
    setIsLoading(true);
    setActivityFeed([]);
    setSyncProgress(null);
    setLibraryProgress([]);
    try {
      const res = await startPlexSync(libraryKey);
      connectSSE(res.session_id);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefresh(mediaType: "movie" | "show") {
    setIsLoading(true);
    setActivityFeed([]);
    setSyncProgress(null);
    try {
      const res = await startPlexRefresh(mediaType);
      connectSSE(res.session_id);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  function calcEta(): string | null {
    if (!syncProgress || !startTimeRef.current) return null;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const processed = syncProgress.imported + syncProgress.skipped + syncProgress.failed;
    const done = processed - initialProcessedRef.current;
    if (done <= 0 || elapsed <= 0) return null;
    const rate = done / elapsed;
    const remaining = syncProgress.total - processed;
    if (remaining <= 0) return "finishing...";
    const secs = Math.round(remaining / rate);
    if (secs < 60) return `~${secs}s`;
    if (secs < 3600) return `~${Math.round(secs / 60)}m`;
    return `~${(secs / 3600).toFixed(1)}h`;
  }

  const isSyncing = syncProgress !== null && syncProgress.status !== "completed";
  const processed = syncProgress
    ? syncProgress.imported + syncProgress.skipped + syncProgress.failed
    : 0;
  const pct = syncProgress && syncProgress.total > 0
    ? Math.round((processed / syncProgress.total) * 100)
    : 0;

  const statusColor = (s: string) => {
    switch (s) {
      case "queued": return "text-blue-400";
      case "scanning": return "text-yellow-400";
      case "syncing": return "text-[#39FFEE]";
      case "done": return "text-green-500";
      default: return "text-gray-400";
    }
  };

  const statusBorder = (s: string) => {
    switch (s) {
      case "queued": return "border-blue-400/40";
      case "scanning": return "border-yellow-400/40";
      case "syncing": return "border-[#39FFEE]/50";
      case "done": return "border-green-500/40";
      default: return "border-gray-200 dark:border-[#2A2A2A]";
    }
  };

  const actionBadge = (action: string) => {
    switch (action) {
      case "imported": return "bg-green-500/20 text-green-400";
      case "skipped": return "bg-yellow-500/20 text-yellow-400";
      case "failed": return "bg-red-500/20 text-red-400";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link href="/admin" className="hover:text-nexus-accent transition-colors">Admin</Link>
            <span>/</span>
            <span className="text-gray-800 dark:text-white">Plex Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Plex Dashboard</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {plexStatus?.configured ? (
            <>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-gray-600 dark:text-gray-300">{plexStatus.url}</span>
              </span>
              <span className="text-gray-400 dark:text-gray-500">
                {plexStatus.libraries.length} libraries
              </span>
              {plexStatus.last_sync && (
                <span className="text-gray-400 dark:text-gray-500">
                  Last sync: {new Date(plexStatus.last_sync).toLocaleString()}
                </span>
              )}
            </>
          ) : (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-gray-500">Not configured</span>
            </span>
          )}
        </div>
      </div>

      {/* Library Cards */}
      {plexStatus?.configured && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Libraries</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(libraryProgress.length > 0 ? libraryProgress : (plexStatus.libraries || []).map(lib => ({
              key: lib.key, title: lib.title, type: lib.type,
              status: "idle" as const, total: lib.count, imported: 0, skipped: 0, failed: 0,
            }))).map((lib) => {
              const libPct = lib.total > 0 && lib.status === "syncing"
                ? Math.round(((lib.imported + lib.skipped + lib.failed) / lib.total) * 100)
                : lib.status === "done" ? 100 : 0;

              return (
                <button
                  key={lib.key}
                  onClick={() => !isSyncing && handleSync(lib.key)}
                  disabled={isSyncing}
                  className={`relative text-left p-4 rounded-xl border transition-all disabled:cursor-default ${
                    lib.status !== "idle"
                      ? statusBorder(lib.status)
                      : "border-gray-200 dark:border-[#2A2A2A] hover:border-nexus-accent dark:hover:border-[#39FFEE]/50"
                  } bg-white dark:bg-[#1C1C1E]`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#2A2A2A] text-gray-500 dark:text-gray-400 font-mono">
                        {lib.type === "movie" ? "MOVIE" : "TV"}
                      </span>
                      <span className="font-medium text-gray-800 dark:text-white text-sm">{lib.title}</span>
                    </div>
                    {lib.status !== "idle" && (
                      <span className={`text-xs font-medium ${statusColor(lib.status)}`}>
                        {lib.status === "scanning" && "Scanning..."}
                        {lib.status === "syncing" && `${libPct}%`}
                        {lib.status === "queued" && "Queued"}
                        {lib.status === "done" && "Done"}
                      </span>
                    )}
                  </div>

                  {lib.status === "syncing" && lib.total > 0 && (
                    <div className="mb-2">
                      <div className="w-full bg-gray-200 dark:bg-[#2A2A2A] rounded-full h-1.5">
                        <div
                          className="bg-[#39FFEE] h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${libPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{lib.total.toLocaleString()} items</span>
                    {lib.status === "done" && (
                      <span className="flex gap-2">
                        <span className="text-green-500">+{lib.imported}</span>
                        <span className="text-yellow-400">{lib.skipped} skip</span>
                        {lib.failed > 0 && <span className="text-red-400">{lib.failed} fail</span>}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Action Bar */}
      {plexStatus?.configured && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleSync()}
            disabled={isSyncing || isLoading}
            className="px-5 py-2.5 rounded-lg bg-nexus-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSyncing ? "Syncing..." : "Sync All Libraries"}
          </button>
          <button
            onClick={() => handleRefresh("movie")}
            disabled={isSyncing || isLoading}
            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 text-sm hover:border-nexus-accent dark:hover:border-[#39FFEE]/50 transition-colors disabled:opacity-50"
          >
            Refresh Movie Art
          </button>
          <button
            onClick={() => handleRefresh("show")}
            disabled={isSyncing || isLoading}
            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 text-sm hover:border-nexus-accent dark:hover:border-[#39FFEE]/50 transition-colors disabled:opacity-50"
          >
            Refresh TV Art
          </button>
        </div>
      )}

      {/* Full Sync */}
      {plexStatus?.configured && (
        <section className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-200 dark:border-[#2A2A2A] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Full Library Sync</h2>
            {fullSync && fullSync.status !== "idle" && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                fullSync.status === "running" ? "bg-blue-500/20 text-blue-400" :
                fullSync.status === "paused" ? "bg-yellow-500/20 text-yellow-400" :
                fullSync.status === "completed" ? "bg-green-500/20 text-green-400" :
                fullSync.status === "failed" ? "bg-red-500/20 text-red-400" :
                "bg-gray-500/20 text-gray-400"
              }`}>
                {fullSync.status}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Import all existing Plex content into MovieNexus. Processes ~2,000 items per batch with adaptive delays to avoid overloading TMDb.
          </p>

          {(!fullSync || fullSync.status === "idle" || fullSync.status === "completed" || fullSync.status === "cancelled" || fullSync.status === "failed") ? (
            <button
              onClick={handleStartFullSync}
              disabled={isSyncing || isLoading}
              className="px-5 py-2.5 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              Start Full Sync
            </button>
          ) : (
            <>
              {/* Progress bar */}
              {fullSync.total && fullSync.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>
                      Batch {fullSync.batch || 0}/{fullSync.total_batches || 0}
                      {" — "}
                      {(fullSync.cursor || 0).toLocaleString()} / {fullSync.total.toLocaleString()} items
                    </span>
                    <span>{Math.round(((fullSync.cursor || 0) / fullSync.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-[#2A2A2A] rounded-full h-3">
                    <div
                      className="bg-purple-500 h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.round(((fullSync.cursor || 0) / fullSync.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Counters */}
              <div className="grid grid-cols-3 gap-4 text-sm text-center">
                <div>
                  <div className="font-bold text-green-500">{(fullSync.imported || 0).toLocaleString()}</div>
                  <div className="text-gray-500 dark:text-gray-400">Imported</div>
                </div>
                <div>
                  <div className="font-bold text-yellow-400">{(fullSync.skipped || 0).toLocaleString()}</div>
                  <div className="text-gray-500 dark:text-gray-400">Skipped</div>
                </div>
                <div>
                  <div className="font-bold text-red-400">{(fullSync.failed || 0).toLocaleString()}</div>
                  <div className="text-gray-500 dark:text-gray-400">Failed</div>
                </div>
              </div>

              {/* Current activity */}
              {fullSync.current_title && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {fullSync.current_title}
                </p>
              )}

              {/* Next batch info */}
              {fullSync.next_batch_at && fullSync.status === "running" && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Next batch at {new Date(fullSync.next_batch_at).toLocaleTimeString()}
                </p>
              )}

              {/* Controls */}
              <div className="flex gap-3">
                {fullSync.status === "running" && (
                  <button
                    onClick={handlePauseFullSync}
                    className="px-4 py-2 rounded-lg border border-yellow-400/50 text-yellow-400 text-sm hover:bg-yellow-400/10 transition-colors"
                  >
                    Pause
                  </button>
                )}
                {fullSync.status === "paused" && (
                  <button
                    onClick={handleResumeFullSync}
                    className="px-4 py-2 rounded-lg border border-green-400/50 text-green-400 text-sm hover:bg-green-400/10 transition-colors"
                  >
                    Resume
                  </button>
                )}
                <button
                  onClick={handleCancelFullSync}
                  className="px-4 py-2 rounded-lg border border-red-400/50 text-red-400 text-sm hover:bg-red-400/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Show error if failed */}
          {fullSync?.status === "failed" && fullSync.error && (
            <p className="text-sm text-red-400">{fullSync.error}</p>
          )}
        </section>
      )}

      {/* Overall Progress */}
      {syncProgress && (
        <section className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-200 dark:border-[#2A2A2A] p-6 space-y-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{processed.toLocaleString()} / {syncProgress.total.toLocaleString()} records</span>
            <span>{pct}%{calcEta() ? ` — ETA ${calcEta()}` : ""}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-[#2A2A2A] rounded-full h-3">
            <div
              className="bg-nexus-accent h-3 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm text-center">
            <div>
              <div className="font-bold text-green-500">{syncProgress.imported.toLocaleString()}</div>
              <div className="text-gray-500 dark:text-gray-400">Added</div>
            </div>
            <div>
              <div className="font-bold text-yellow-400">{syncProgress.skipped.toLocaleString()}</div>
              <div className="text-gray-500 dark:text-gray-400">Skipped</div>
            </div>
            <div>
              <div className="font-bold text-red-400">{syncProgress.failed.toLocaleString()}</div>
              <div className="text-gray-500 dark:text-gray-400">Failed</div>
            </div>
          </div>
          {syncProgress.current_title && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{syncProgress.current_title}</p>
          )}
        </section>
      )}

      {/* Activity Feed */}
      <section className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-200 dark:border-[#2A2A2A] p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Activity Feed</h2>
          <div className="flex gap-2">
            {activityFeed.length > 0 && (
              <span className="text-xs text-gray-400">{activityFeed.length} items</span>
            )}
            <button
              onClick={() => setActivityFeed([])}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-300 text-xs hover:border-nexus-accent transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
        <div
          ref={feedRef}
          className="bg-gray-950 dark:bg-[#0A0A0A] rounded-lg p-3 h-80 overflow-y-auto font-mono text-xs space-y-0.5"
        >
          {activityFeed.length === 0 ? (
            <p className="text-gray-500">Waiting for sync to start...</p>
          ) : (
            activityFeed.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${actionBadge(item.action)}`}>
                  {item.action === "imported" ? "ADD" : item.action === "skipped" ? "SKIP" : "FAIL"}
                </span>
                <span className="text-gray-300 flex-1 truncate">{item.title}</span>
                <span className="text-gray-600 shrink-0">{item.library}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Sync History */}
      <section className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-200 dark:border-[#2A2A2A] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Sync History</h2>
          <button onClick={loadHistory} className="text-xs text-nexus-accent hover:underline">
            Refresh
          </button>
        </div>
        {syncHistory.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No sync history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-[#2A2A2A]">
                  <th className="pb-2 pr-3">ID</th>
                  <th className="pb-2 pr-3">Source</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Total</th>
                  <th className="pb-2 pr-3">Added</th>
                  <th className="pb-2 pr-3">Skipped</th>
                  <th className="pb-2 pr-3">Failed</th>
                  <th className="pb-2 pr-3">Started</th>
                  <th className="pb-2">Duration</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 dark:border-[#2A2A2A]/50">
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{s.id}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        s.source === "plex" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"
                      }`}>
                        {s.source === "plex" ? "sync" : "refresh"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 capitalize">{s.media_type}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.status === "completed"
                          ? "bg-green-500/20 text-green-400"
                          : s.status === "running"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{s.total.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-green-500">{s.imported.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-yellow-400">{s.skipped.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-red-400">{s.failed.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">
                      {s.started_at ? new Date(s.started_at).toLocaleString() : "--"}
                    </td>
                    <td className="py-2 text-gray-500 dark:text-gray-400">
                      {formatDuration(s.duration_seconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
