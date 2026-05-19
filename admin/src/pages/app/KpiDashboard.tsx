import { useCallback, useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import PageMeta from "../../components/common/PageMeta";
import FieldPointsMap from "../../components/maps/FieldPointsMap";
import { AdminBadge, AdminCard, OutlineButton } from "../../components/app/adminUi";
import {
  computeKpiSummary,
  loadMonitoringSubmissions,
  loadReforestationPlots,
  loadSeedlingProgress,
  type KpiSummary,
  type MonitoringRow,
  type ReforestationPlot,
} from "../../lib/fieldMonitoring";
import { isSupabaseConfigured } from "../../lib/supabase";

function barColor(pct: number) {
  if (pct >= 85) return "bg-lime-500";
  if (pct >= 70) return "bg-orange-400";
  return "bg-red-400";
}

export default function KpiDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<MonitoringRow[]>([]);
  const [plots, setPlots] = useState<ReforestationPlot[]>([]);
  const [kpi, setKpi] = useState<KpiSummary | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [subs, plotList, progress] = await Promise.all([
        loadMonitoringSubmissions(500),
        loadReforestationPlots(),
        loadSeedlingProgress(),
      ]);
      setSubmissions(subs);
      setPlots(plotList);
      setKpi(computeKpiSummary(progress, plotList, subs));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load KPI data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const captureTrendOptions: ApexOptions = useMemo(
    () => ({
      colors: ["#38bdf8"],
      chart: { fontFamily: "Outfit, sans-serif", type: "line", height: 200, toolbar: { show: false } },
      stroke: { curve: "smooth", width: 3 },
      dataLabels: { enabled: false },
      xaxis: { categories: kpi?.monthlySubmissions.map((m) => m.month) ?? [] },
    }),
    [kpi],
  );

  const survivalCompareOptions: ApexOptions = useMemo(
    () => ({
      colors: ["#84cc16", "#f59e0b"],
      chart: { fontFamily: "Outfit, sans-serif", type: "line", height: 200, toolbar: { show: false } },
      stroke: { curve: "smooth", width: 3 },
      dataLabels: { enabled: false },
      xaxis: { categories: kpi?.monthlySurvival.map((m) => m.month) ?? [] },
      yaxis: { max: 100, labels: { formatter: (v) => `${Math.round(Number(v))}%` } },
    }),
    [kpi],
  );

  const plantabilityOptions: ApexOptions = useMemo(
    () => ({
      colors: ["#22c55e"],
      chart: { fontFamily: "Outfit, sans-serif", type: "area", height: 200, toolbar: { show: false } },
      stroke: { curve: "smooth", width: 2 },
      fill: { type: "gradient", gradient: { opacityFrom: 0.35, opacityTo: 0.05 } },
      dataLabels: { enabled: false },
      xaxis: { categories: kpi?.monthlyPlantability.map((m) => m.month) ?? [] },
      yaxis: { max: 100 },
    }),
    [kpi],
  );

  const siteRows =
    kpi?.plotMetrics.filter((p) => p.submissionCount > 0 || p.healthy + p.atRisk > 0) ?? [];

  return (
    <>
      <PageMeta
        title="Location analytics KPIs | Admin"
        description="Seedling survival, health trends, and plot performance for reforestation monitoring."
      />
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Survival, health & plantability monitoring
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Aerial forest-area assessments, survival rates vs PENRO baselines, and health trends (DENR-CENRO Culasi)
            </p>
          </div>
          <OutlineButton type="button" disabled={loading} onClick={() => void load()}>
            {loading ? "Refreshing…" : "Refresh"}
          </OutlineButton>
        </div>

        {error ? (
          <AdminCard>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
          </AdminCard>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            {
              label: "Avg. plantability",
              value: loading ? "—" : kpi?.avgPlantabilityPct != null ? `${kpi.avgPlantabilityPct}%` : "—",
              hint:
                kpi?.plantableCapturePct != null
                  ? `${kpi.plantableCapturePct}% views plantable`
                  : "Aerial scene assessments",
              accent: true,
            },
            {
              label: "Forest canopy",
              value: loading ? "—" : kpi?.avgCanopyPct != null ? `${kpi.avgCanopyPct}%` : "—",
              hint: "Canopy cover from aerial view",
            },
            {
              label: "Health index",
              value: loading ? "—" : kpi?.avgHealthIndexPct != null ? `${kpi.avgHealthIndexPct}%` : "—",
              hint: "Vegetation health proxy",
            },
            {
              label: "Field survival",
              value: loading ? "—" : `${kpi?.overallSurvivalPct ?? 0}%`,
              hint:
                kpi?.penroBaselineSurvivalPct != null
                  ? `PENRO baseline ${kpi.penroBaselineSurvivalPct}%`
                  : "Progress statuses",
            },
            {
              label: "Healthy / at risk",
              value: loading ? "—" : `${kpi?.healthy ?? 0} / ${kpi?.atRisk ?? 0}`,
              hint: kpi?.siteHealthLabel ?? "Trend summary",
            },
            {
              label: "Aerial captures",
              value: loading ? "—" : (kpi?.growthLabel ?? "—"),
              hint: "Logged for monitoring",
            },
          ].map((k) => (
            <AdminCard key={k.label} className="!p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                {k.label}
              </p>
              <p
                className={`mt-2 text-2xl font-semibold ${k.accent ? "text-lime-700 dark:text-lime-400" : "text-gray-900 dark:text-gray-100"}`}
              >
                {k.value}
              </p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-500">{k.hint}</p>
            </AdminCard>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AdminCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Site health map</h2>
              <AdminBadge tone="success">
                {loading ? "…" : `${kpi?.overallSurvivalPct ?? 0}% survival`}
              </AdminBadge>
            </div>
            {loading ? (
              <p className="text-sm text-gray-500">Loading map…</p>
            ) : (
              <FieldPointsMap submissions={submissions} plots={plots} />
            )}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-white/5 py-2 dark:bg-white/[0.04]">
                <p className="font-semibold text-lime-300">{kpi?.healthy ?? 0}</p>
                <p className="text-gray-600 dark:text-gray-500">Healthy</p>
              </div>
              <div className="rounded-lg bg-white/5 py-2 dark:bg-white/[0.04]">
                <p className="font-semibold text-orange-300">{kpi?.atRisk ?? 0}</p>
                <p className="text-gray-600 dark:text-gray-500">At risk</p>
              </div>
              <div className="rounded-lg bg-white/5 py-2 dark:bg-white/[0.04]">
                <p className="font-semibold text-gray-300">{kpi?.pending ?? 0}</p>
                <p className="text-gray-600 dark:text-gray-500">Planned</p>
              </div>
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">How metrics are calculated</h2>
            <ul className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <li>
                <strong className="text-gray-800 dark:text-gray-200">Plantability</strong> — each aerial capture
                scores canopy, open ground, and hardscape to decide if the area is plantable.
              </li>
              <li>
                <strong className="text-gray-800 dark:text-gray-200">Survival monitoring</strong> — field
                progress compared to PENRO <em>latest survival rate</em> per NGP site.
              </li>
              <li>
                <strong className="text-gray-800 dark:text-gray-200">Health trends</strong> — vegetation health
                index and status cycles (planned → planted → growing → monitored).
              </li>
              <li>
                <strong className="text-gray-800 dark:text-gray-200">Health map</strong> — GPS points from
                confirmed mobile captures; blue markers are registered reforestation plots.
              </li>
              <li>
                <strong className="text-gray-800 dark:text-gray-200">Plot performance</strong> — grouped by
                plot assignment on capture and seedling progress.
              </li>
            </ul>
          </AdminCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AdminCard>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Survival rate vs PENRO baseline
            </h2>
            <div className="-mx-2 min-h-[200px]">
              {loading || !kpi?.monthlySurvival.length ? (
                <p className="px-2 py-8 text-sm text-gray-500">Add seedling progress updates to see trends.</p>
              ) : (
                <Chart
                  type="line"
                  height={200}
                  options={survivalCompareOptions}
                  series={[
                    { name: "Field survival %", data: kpi.monthlySurvival.map((m) => m.pct) },
                    { name: "PENRO baseline %", data: kpi.monthlyPenroSurvival.map((m) => m.pct) },
                  ]}
                />
              )}
            </div>
          </AdminCard>
          <AdminCard>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Plantability (aerial view)</h2>
            <div className="-mx-2 min-h-[200px]">
              {loading || !kpi?.monthlyPlantability.length ? (
                <p className="px-2 py-8 text-sm text-gray-500">Capture aerial views to track plantability.</p>
              ) : (
                <Chart
                  type="area"
                  height={200}
                  options={plantabilityOptions}
                  series={[
                    { name: "Plantability %", data: kpi.monthlyPlantability.map((m) => m.pct) },
                  ]}
                />
              )}
            </div>
          </AdminCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AdminCard>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Health index trend</h2>
            <div className="-mx-2 min-h-[200px]">
              {loading || !kpi?.monthlyHealthIndex.length ? (
                <p className="px-2 py-8 text-sm text-gray-500">Health trends from aerial assessments.</p>
              ) : (
                <Chart
                  type="line"
                  height={200}
                  options={{ ...plantabilityOptions, colors: ["#a78bfa"] }}
                  series={[
                    { name: "Health index %", data: kpi.monthlyHealthIndex.map((m) => m.pct) },
                  ]}
                />
              )}
            </div>
          </AdminCard>
          <AdminCard>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Field capture activity</h2>
            <div className="-mx-2 min-h-[200px]">
              {loading || !kpi?.monthlySubmissions.length ? (
                <p className="px-2 py-8 text-sm text-gray-500">Monitoring submissions will populate this chart.</p>
              ) : (
                <Chart
                  type="line"
                  height={200}
                  options={captureTrendOptions}
                  series={[{ name: "Captures", data: kpi.monthlySubmissions.map((m) => m.count) }]}
                />
              )}
            </div>
          </AdminCard>
        </div>

        <AdminCard>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Comparative plot performance
          </h2>
          {loading ? (
            <p className="mt-4 text-sm text-gray-500">Loading…</p>
          ) : siteRows.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              No plot-level data yet. Assign plots during mobile capture to compare sites.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {siteRows.map((s) => (
                <li key={s.plotId}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-gray-800 dark:text-gray-200">
                      {s.plotCode} — {s.name}
                    </span>
                    <span className="font-medium text-emerald-700 dark:text-lime-200">
                      {s.survivalPct}% field
                      {s.penroBaselineSurvivalPct != null
                        ? ` · ${s.penroBaselineSurvivalPct}% PENRO`
                        : ""}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full transition-all ${barColor(s.survivalPct)}`}
                      style={{ width: `${Math.max(s.survivalPct, 4)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {s.submissionCount} capture{s.submissionCount === 1 ? "" : "s"}
                    {s.avgAccuracyPct != null ? ` · ${s.avgAccuracyPct}% data accuracy` : ""} ·{" "}
                    {s.targetSeedlings} contracted seedlings
                  </p>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </>
  );
}
