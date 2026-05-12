import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { AdminBadge, AdminCard, OutlineButton, PrimaryButton } from "../../components/app/adminUi";
import {
  loadMonitoringSubmissions,
  type MonitoringRow,
} from "../../lib/fieldMonitoring";
import { isSupabaseConfigured } from "../../lib/supabase";

function eventLabel(t: MonitoringRow["event_type"]) {
  if (t === "scene_analysis") return "Scene analysis";
  return "Monitor seedling";
}

function queueTone(row: MonitoringRow): "success" | "warn" | "danger" {
  if (row.unsuitable_for_planting) return "danger";
  if (row.event_type === "monitor_seedling") return "success";
  return "warn";
}

export default function DataVerification() {
  const [rows, setRows] = useState<MonitoringRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      const list = await loadMonitoringSubmissions(200);
      setRows(list);
      setSelectedId((prev) => {
        if (prev && list.some((r) => r.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load submissions.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  const pendingScene = rows.filter(
    (r) => r.event_type === "scene_analysis" && !r.unsuitable_for_planting,
  ).length;

  const mapsUrl =
    selected != null
      ? `https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`
      : null;

  const rawSource =
    selected?.raw_analysis && typeof selected.raw_analysis.source === "string"
      ? selected.raw_analysis.source
      : null;

  return (
    <>
      <PageMeta
        title="Data verification | Admin"
        description="Review field captures and seedling monitoring synced from mobile devices."
      />
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Data verification & image processing
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <AdminBadge tone="warn">
                {loading ? "Loading…" : `${rows.length} submission${rows.length === 1 ? "" : "s"}`}
              </AdminBadge>
              {!loading && rows.length > 0 ? (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {pendingScene} scene analyses · synced from mobile capture & monitor actions
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <OutlineButton type="button" onClick={() => void load()} disabled={loading}>
              Refresh
            </OutlineButton>
          </div>
        </div>

        {!isSupabaseConfigured ? (
          <AdminCard>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Configure <code className="rounded bg-gray-100 px-1 dark:bg-white/10">VITE_SUPABASE_URL</code>{" "}
              and{" "}
              <code className="rounded bg-gray-100 px-1 dark:bg-white/10">VITE_SUPABASE_ANON_KEY</code>{" "}
              in <code className="rounded bg-gray-100 px-1 dark:bg-white/10">admin/.env</code> (same project as
              the mobile app) to load monitoring data.
            </p>
          </AdminCard>
        ) : null}

        {error ? (
          <AdminCard>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              Run the new SQL in <code className="rounded bg-gray-100 px-1 dark:bg-white/10">supabase/schema.sql</code>{" "}
              for the <code className="rounded bg-gray-100 px-1 dark:bg-white/10">monitoring_submissions</code> table if
              this is the first deploy.
            </p>
          </AdminCard>
        ) : null}

        <AdminCard>
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Field capture detail
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Photo location (GPS), seedling identity, and stocking estimate from the analyzer
              </p>
            </div>
            {selected ? (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Recorded{" "}
                <span className="font-semibold text-emerald-700 dark:text-lime-300">
                  {new Date(selected.created_at).toLocaleString()}
                </span>
              </div>
            ) : null}
          </div>

          {loading ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading submissions…</p>
          ) : !selected ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No submissions yet. Run a capture on the mobile app (same Supabase project) to populate this view.
            </p>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-emerald-900/40 to-gray-900 ring-1 ring-white/10">
                    {selected.image_url ? (
                      <img
                        src={selected.image_url}
                        alt="Field capture"
                        className="h-full w-full rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="px-6 text-center text-gray-400">
                        <div className="mx-auto mb-3 flex size-24 items-center justify-center rounded-full bg-emerald-800/50 ring-2 ring-lime-500/30">
                          <svg
                            className="size-10 text-lime-300/80"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden
                          >
                            <path d="M12 3c-4 4-6 8-6 12a6 6 0 1012 0c0-4-2-8-6-12zm0 16.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9z" />
                          </svg>
                        </div>
                        <p className="text-xs font-medium text-gray-300">Image capture location</p>
                        <p className="mt-2 font-mono text-sm text-lime-200/90">
                          {selected.latitude.toFixed(5)}°, {selected.longitude.toFixed(5)}°
                        </p>
                        <p className="mt-2 text-xs text-gray-500">
                          Image previews will appear here when mobile uploads are wired to storage.
                        </p>
                      </div>
                    )}
                  </div>
                  {mapsUrl ? (
                    <OutlineButton
                      className="w-full sm:w-auto"
                      type="button"
                      onClick={() => window.open(mapsUrl, "_blank", "noopener,noreferrer")}
                    >
                      Open location in Maps
                    </OutlineButton>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Seedling (field / user selection)
                    </p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                      {selected.common_name ?? "—"}
                      {selected.scientific_name ? (
                        <span className="block text-sm font-normal italic text-gray-600 dark:text-gray-400">
                          {selected.scientific_name}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-500">
                      ID: {selected.seedling_id ?? "—"} ·{" "}
                      <AdminBadge tone={queueTone(selected)}>{eventLabel(selected.event_type)}</AdminBadge>
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-lime-500/25 dark:bg-emerald-950/40">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-lime-200">
                      Seedlings needed (assessed)
                    </p>
                    <p className="mt-1 text-3xl font-bold text-emerald-800 dark:text-lime-300">
                      {selected.estimated_seedlings_needed}
                    </p>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      Derived from assessed plot area (~4 m² spacing heuristic when area is inferred from context).
                      {rawSource ? (
                        <>
                          {" "}
                          Source:{" "}
                          <span className="font-medium text-gray-800 dark:text-gray-300">{rawSource}</span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  {selected.confidence != null ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Match confidence:{" "}
                      <span className="font-semibold text-emerald-700 dark:text-lime-300">
                        {Math.round(Number(selected.confidence) * 100)}%
                      </span>
                    </p>
                  ) : null}

                  {selected.rationale ? (
                    <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                      {selected.rationale}
                    </p>
                  ) : null}

                  {selected.unsuitable_for_planting ? (
                    <AdminBadge tone="danger">Scene flagged as unsuitable for planting</AdminBadge>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-200 pt-6 dark:border-gray-800">
                <OutlineButton type="button" disabled>
                  Confirm seedling count (manual review)
                </OutlineButton>
                <OutlineButton type="button" disabled>
                  Flag for review
                </OutlineButton>
                <PrimaryButton type="button" disabled>
                  Save verification
                </PrimaryButton>
              </div>
            </>
          )}
        </AdminCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <AdminCard>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Flag for review — select reason(s)
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Checklist for reviewers (offline workflow); pair with the submission list.
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "Poor visibility / blur",
                "Inaccurate GPS location",
                "Incorrect species / count",
                "Site damage / mortality observed",
              ].map((label, i) => (
                <li key={label} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    defaultChecked={i === 0}
                    className="mt-1 size-4 rounded border-gray-400 bg-white text-lime-600 dark:border-gray-600 dark:bg-gray-800 dark:text-lime-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              <PrimaryButton type="button" disabled>
                Flag for review
              </PrimaryButton>
              <OutlineButton type="button" disabled>
                Clear flags
              </OutlineButton>
            </div>
          </AdminCard>

          <AdminCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Verification queue</h2>
              <AdminBadge tone="warn">{rows.length} total</AdminBadge>
            </div>
            {loading ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No rows yet. Capture & analyze or tap “Monitor this seedling” on mobile.
              </p>
            ) : (
              <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {rows.map((row) => {
                  const active = selectedId === row.id;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-lime-500/50 bg-lime-500/10"
                            : "border-gray-100 dark:border-gray-800"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-200">
                            {row.common_name ?? row.seedling_id ?? "Submission"}
                          </p>
                          <p className="truncate text-xs text-gray-600 dark:text-gray-500">
                            {row.latitude.toFixed(4)}°, {row.longitude.toFixed(4)}° ·{" "}
                            {eventLabel(row.event_type)}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-500">
                            Stocking est.{" "}
                            <span className="font-semibold text-emerald-700 dark:text-lime-300/90">
                              {row.estimated_seedlings_needed}
                            </span>
                          </p>
                        </div>
                        <AdminBadge tone={queueTone(row)}>
                          {row.event_type === "monitor_seedling" ? "Monitor" : "Scene"}
                        </AdminBadge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </AdminCard>
        </div>
      </div>
    </>
  );
}
