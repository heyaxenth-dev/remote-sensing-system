import React, { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { AdminBadge, AdminCard, OutlineButton, PrimaryButton } from "../../components/app/adminUi";
import {
  loadMonitoringSubmissions,
  loadReforestationPlots,
  updateSubmissionVerification,
  type MonitoringRow,
  type ReforestationPlot,
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

const FLAG_REASONS = [
  "Not a field capture (screen / indoor / device photo)",
  "Unplantable surface (concrete / wood / built area)",
  "Poor visibility / blur",
  "Inaccurate GPS location",
  "Incorrect species / count",
  "Site damage / mortality observed",
];

export default function DataVerification() {
  const [rows, setRows] = useState<MonitoringRow[]>([]);
  const [plots, setPlots] = useState<ReforestationPlot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagReasons, setFlagReasons] = useState<string[]>([FLAG_REASONS[0]]);
  const [verificationNotes, setVerificationNotes] = useState("");

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
      const [list, plotList] = await Promise.all([
        loadMonitoringSubmissions(200),
        loadReforestationPlots(),
      ]);
      setRows(list);
      setPlots(plotList);
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

  const plotForSelected = selected?.plot_id
    ? plots.find((p) => p.id === selected.plot_id)
    : null;

  React.useEffect(() => {
    if (!selected) {
      setVerificationNotes("");
      setFlagReasons([FLAG_REASONS[0]]);
      return;
    }
    setVerificationNotes(selected.verification_notes ?? "");
    if (selected.verification_status === "flagged" && selected.verification_notes) {
      const parts = selected.verification_notes.split("; ").filter(Boolean);
      setFlagReasons(parts.length ? parts : [FLAG_REASONS[0]]);
    }
  }, [selected?.id, selected?.verification_notes, selected?.verification_status]);

  const applyVerification = async (status: "confirmed" | "flagged") => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const notes =
        status === "flagged"
          ? flagReasons.join("; ")
          : verificationNotes.trim() || null;
      await updateSubmissionVerification(selected.id, {
        verification_status: status,
        verification_notes: notes,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save verification.");
    } finally {
      setSaving(false);
    }
  };

  const pendingScene = rows.filter(
    (r) => r.event_type === "scene_analysis" && !r.unsuitable_for_planting,
  ).length;

  const monitorCount = rows.filter((r) => r.event_type === "monitor_seedling").length;

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
              Geospatial data verification
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Review field GPS, imagery, and plot metrics before reporting to DENR-CENRO Culasi
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <AdminBadge tone="warn">
                {loading ? "Loading…" : `${rows.length} submission${rows.length === 1 ? "" : "s"}`}
              </AdminBadge>
              {!loading && rows.length > 0 ? (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {monitorCount} confirmed submission{monitorCount === 1 ? "" : "s"}
                  {pendingScene > 0 ? (
                    <>
                      {" "}
                      · {pendingScene} legacy auto scene row{pendingScene === 1 ? "" : "s"} (pre-confirm pipeline)
                    </>
                  ) : null}
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
                        {!selected.image_url ? (
                          <p className="mt-2 text-xs text-gray-500">
                            No capture image on this row (older submission or upload failed).
                          </p>
                        ) : null}
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
                      {selected.verification_status ? (
                        <>
                          {" "}
                          ·{" "}
                          <AdminBadge
                            tone={
                              selected.verification_status === "confirmed"
                                ? "success"
                                : selected.verification_status === "flagged"
                                  ? "danger"
                                  : "warn"
                            }
                          >
                            {selected.verification_status}
                          </AdminBadge>
                        </>
                      ) : null}
                    </p>
                    {plotForSelected ? (
                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        NGP site: {plotForSelected.site_code ?? plotForSelected.plot_code} —{" "}
                        {plotForSelected.name}
                        {selected.grid_cell ? ` · Grid ${selected.grid_cell}` : ""}
                      </p>
                    ) : null}
                  </div>

                  {selected.penro_accuracy_score != null ? (
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/25 dark:bg-sky-950/30">
                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-200">
                        PENRO data accuracy
                      </p>
                      <p className="mt-1 text-3xl font-bold text-sky-800 dark:text-sky-300">
                        {selected.penro_accuracy_score}%
                      </p>
                      {plotForSelected?.latest_survival_rate != null ? (
                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                          NGP baseline survival:{" "}
                          {Math.round(Number(plotForSelected.latest_survival_rate) * 100)}% ·
                          contracted {plotForSelected.seedlings_contracted ?? plotForSelected.target_seedlings}{" "}
                          seedlings
                        </p>
                      ) : null}
                      {Array.isArray(
                        (selected.penro_accuracy_detail as { checks?: unknown })?.checks,
                      ) ? (
                        <ul className="mt-3 space-y-1 text-xs text-gray-700 dark:text-gray-300">
                          {(
                            selected.penro_accuracy_detail as {
                              checks: { label: string; score: number; detail: string }[];
                            }
                          ).checks.map((c) => (
                            <li key={c.label}>
                              {c.label}: {c.score}% — {c.detail}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  {selected.unsuitable_for_planting ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/25 dark:bg-red-950/40">
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-900 dark:text-red-200">
                        Capture rejected for stocking
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-red-900 dark:text-red-100">
                        {selected.rationale ??
                          "Likely not NGP ground vegetation (e.g. screen or indoor photo). Flag and retake on site."}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-lime-500/25 dark:bg-emerald-950/40">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-lime-200">
                      Seedlings needed (assessed)
                    </p>
                    <p className="mt-1 text-3xl font-bold text-emerald-800 dark:text-lime-300">
                      {selected.estimated_seedlings_needed ?? "—"}
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
                  )}

                  {selected.confidence != null && !selected.unsuitable_for_planting ? (
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

                  {selected.event_type === "monitor_seedling" &&
                  selected.raw_analysis &&
                  typeof selected.raw_analysis === "object" &&
                  (selected.raw_analysis as { userConfirmed?: unknown }).userConfirmed ===
                    true ? (
                    <p className="text-xs font-medium text-emerald-800 dark:text-lime-200">
                      Field officer confirmed this seedling on device; full analysis snapshot
                      is stored in <span className="font-mono">raw_analysis</span> for audit.
                    </p>
                  ) : null}

                  {selected.unsuitable_for_planting ? (
                    <AdminBadge tone="danger">Scene flagged as unsuitable for planting</AdminBadge>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-200 pt-6 dark:border-gray-800">
                <OutlineButton
                  type="button"
                  disabled={saving || !selected}
                  onClick={() => void applyVerification("confirmed")}
                >
                  Confirm seedling count
                </OutlineButton>
                <OutlineButton
                  type="button"
                  disabled={saving || !selected}
                  onClick={() => void applyVerification("flagged")}
                >
                  Flag for review
                </OutlineButton>
                <PrimaryButton
                  type="button"
                  disabled={saving || !selected}
                  onClick={() => void applyVerification("confirmed")}
                >
                  {saving ? "Saving…" : "Save verification"}
                </PrimaryButton>
              </div>
              <label className="mt-4 block text-sm text-gray-600 dark:text-gray-400">
                Reviewer notes
                <textarea
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  rows={2}
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Optional notes for confirmed captures"
                />
              </label>
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
              {FLAG_REASONS.map((label) => (
                <li key={label} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={flagReasons.includes(label)}
                    onChange={(e) => {
                      setFlagReasons((prev) =>
                        e.target.checked
                          ? [...prev, label]
                          : prev.filter((r) => r !== label),
                      );
                    }}
                    className="mt-1 size-4 rounded border-gray-400 bg-white text-lime-600 dark:border-gray-600 dark:bg-gray-800 dark:text-lime-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              <PrimaryButton
                type="button"
                disabled={saving || !selected}
                onClick={() => void applyVerification("flagged")}
              >
                Flag for review
              </PrimaryButton>
              <OutlineButton
                type="button"
                disabled={saving}
                onClick={() => setFlagReasons([])}
              >
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
                No rows yet. Confirm a seedling from mobile capture to populate this view.
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
