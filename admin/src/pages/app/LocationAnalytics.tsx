import { useCallback, useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { AdminBadge, AdminCard, OutlineButton } from "../../components/app/adminUi";
import { loadMonitoringSubmissions, type MonitoringRow } from "../../lib/fieldMonitoring";
import { isSupabaseConfigured } from "../../lib/supabase";

function formatRelativeTime(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 45) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} day${sec >= 86400 * 2 ? "s" : ""} ago`;
  return new Date(iso).toLocaleDateString();
}

function aggregate(rows: MonitoringRow[]) {
  const uniqueLocations = new Set(
    rows.map((r) => `${Number(r.latitude).toFixed(4)},${Number(r.longitude).toFixed(4)}`),
  );

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weekAgo = Date.now() - weekMs;
  const submissionsThisWeek = rows.filter((r) => new Date(r.created_at).getTime() >= weekAgo).length;

  const sceneRows = rows.filter((r) => r.event_type === "scene_analysis");
  const monitorRows = rows.filter((r) => r.event_type === "monitor_seedling");

  const primaryForStocking = sceneRows.length ? sceneRows : monitorRows;
  const avgStocking =
    primaryForStocking.length > 0
      ? primaryForStocking.reduce((s, r) => s + Number(r.estimated_seedlings_needed), 0) /
        primaryForStocking.length
      : 0;

  return {
    distinctLocations: uniqueLocations.size,
    monitorEvents: monitorRows.length,
    submissionsThisWeek,
    avgStockingRounded: sceneRows.length ? Math.round(avgStocking) : 0,
    sceneCount: sceneRows.length,
    flaggedScenes: sceneRows.filter((r) => r.unsuitable_for_planting).length,
  };
}

function computeOsmBbox(rows: MonitoringRow[]): string | null {
  if (rows.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const r of rows) {
    const la = Number(r.latitude);
    const lo = Number(r.longitude);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
    minLat = Math.min(minLat, la);
    maxLat = Math.max(maxLat, la);
    minLon = Math.min(minLon, lo);
    maxLon = Math.max(maxLon, lo);
  }
  if (!Number.isFinite(minLat)) return null;

  const pad = 0.003;
  if (minLat === maxLat && minLon === maxLon) {
    return `${minLon - pad},${minLat - pad},${maxLon + pad},${maxLat + pad}`;
  }
  return `${minLon - pad},${minLat - pad},${maxLon + pad},${maxLat + pad}`;
}

function downloadGeoJSON(rows: MonitoringRow[]) {
  const geo = {
    type: "FeatureCollection" as const,
    features: rows.map((r) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [Number(r.longitude), Number(r.latitude)],
      },
      properties: {
        id: r.id,
        created_at: r.created_at,
        event_type: r.event_type,
        estimated_seedlings_needed: r.estimated_seedlings_needed,
        seedling_id: r.seedling_id,
        common_name: r.common_name,
        scientific_name: r.scientific_name,
        unsuitable_for_planting: r.unsuitable_for_planting,
      },
    })),
  };
  const blob = new Blob([JSON.stringify(geo, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `monitoring-submissions-${new Date().toISOString().slice(0, 10)}.geojson`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function recentRowTitle(row: MonitoringRow): string {
  const name = row.common_name ?? row.seedling_id ?? "Submission";
  const coord = `${Number(row.latitude).toFixed(3)}°, ${Number(row.longitude).toFixed(3)}°`;
  return `${name} · ${coord}`;
}

function recentBadgeTone(row: MonitoringRow): "success" | "warn" | "danger" | "neutral" {
  if (row.unsuitable_for_planting) return "danger";
  if (row.event_type === "monitor_seedling") return "success";
  return "warn";
}

function recentBadgeLabel(row: MonitoringRow): string {
  if (row.event_type === "monitor_seedling") return "Monitor";
  if (row.unsuitable_for_planting) return "Flagged";
  return "Scene";
}

export default function LocationAnalytics() {
  const [rows, setRows] = useState<MonitoringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await loadMonitoringSubmissions(500);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load field data.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => aggregate(rows), [rows]);
  const osmBbox = useMemo(() => computeOsmBbox(rows), [rows]);
  const recent = useMemo(() => rows.slice(0, 10), [rows]);

  const osmEmbedUrl =
    osmBbox != null
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(osmBbox)}&layer=mapnik`
      : null;

  return (
    <>
      <PageMeta
        title="Location analytics | Admin"
        description="Site and plot-level geospatial overview for seedling monitoring."
      />
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Location analytics
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Regional overview — populated from mobile capture & monitor events in Supabase
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OutlineButton
              type="button"
              disabled={rows.length === 0 || loading}
              onClick={() => downloadGeoJSON(rows)}
            >
              Export GeoJSON
            </OutlineButton>
            <OutlineButton type="button" disabled={loading} onClick={() => void load()}>
              {loading ? "Refreshing…" : "Refresh"}
            </OutlineButton>
          </div>
        </div>

        {!isSupabaseConfigured ? (
          <AdminCard>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Set <code className="rounded bg-gray-100 px-1 dark:bg-white/10">VITE_SUPABASE_URL</code> and{" "}
              <code className="rounded bg-gray-100 px-1 dark:bg-white/10">VITE_SUPABASE_ANON_KEY</code> to load
              analytics.
            </p>
          </AdminCard>
        ) : null}

        {error ? (
          <AdminCard>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
          </AdminCard>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Distinct locations",
              value: loading ? "—" : String(metrics.distinctLocations),
              hint:
                metrics.distinctLocations === 0
                  ? "Unique GPS points (4 dp) from submissions"
                  : `${rows.length} total submissions`,
            },
            {
              label: "Monitor events",
              value: loading ? "—" : String(metrics.monitorEvents),
              hint: "“Monitor this seedling” actions recorded",
            },
            {
              label: "Submissions (7 days)",
              value: loading ? "—" : String(metrics.submissionsThisWeek),
              hint: "All events in the rolling week",
            },
            {
              label: "Avg. stocking estimate",
              value:
                loading ? "—" : metrics.sceneCount ? String(metrics.avgStockingRounded) : "—",
              hint:
                metrics.sceneCount > 0
                  ? `Mean across ${metrics.sceneCount} scene analyses`
                  : "No scene analyses yet",
            },
          ].map((k) => (
            <AdminCard key={k.label} className="!p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                {k.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-lime-700 dark:text-lime-400">{k.value}</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-500">{k.hint}</p>
            </AdminCard>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <AdminCard className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Site map</h2>
              <AdminBadge tone={loading ? "neutral" : rows.length ? "success" : "warn"}>
                {loading ? "Loading…" : rows.length ? "Live data" : "No coordinates yet"}
              </AdminBadge>
            </div>
            {loading ? (
              <div className="flex aspect-[21/9] min-h-[220px] items-center justify-center rounded-xl bg-gradient-to-br from-emerald-950/80 to-gray-900 ring-1 ring-lime-500/20">
                <p className="text-sm text-gray-400">Loading map…</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex aspect-[21/9] min-h-[220px] items-center justify-center rounded-xl bg-gradient-to-br from-emerald-950/80 to-gray-900 ring-1 ring-lime-500/20">
                <div className="text-center px-4">
                  <p className="text-sm font-medium text-lime-200/90">No field points yet</p>
                  <p className="mt-1 max-w-sm text-xs text-gray-400">
                    Capture locations appear here once the mobile app syncs monitoring submissions.
                  </p>
                </div>
              </div>
            ) : osmEmbedUrl ? (
              <iframe
                title="OpenStreetMap overview of submission bounding box"
                className="aspect-[21/9] min-h-[220px] w-full rounded-xl ring-1 ring-lime-500/20"
                src={osmEmbedUrl}
              />
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-lime-400" /> Monitor ({metrics.monitorEvents})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-orange-400" /> Scene ({metrics.sceneCount})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-red-400" /> Flagged ({metrics.flaggedScenes})
              </span>
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent activity</h2>
            {loading ? (
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                No submissions yet. Same source as Data &amp; verification.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {recent.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3 last:border-0 dark:border-gray-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                        {recentRowTitle(row)}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-500">
                        {formatRelativeTime(row.created_at)}
                      </p>
                    </div>
                    <AdminBadge tone={recentBadgeTone(row)}>{recentBadgeLabel(row)}</AdminBadge>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      </div>
    </>
  );
}
