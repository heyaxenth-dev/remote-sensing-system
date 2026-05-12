import PageMeta from "../../components/common/PageMeta";
import { AdminBadge, AdminCard, OutlineButton, PrimaryButton } from "../../components/app/adminUi";
import BarChartOne from "../../components/charts/bar/BarChartOne";
import LineChartOne from "../../components/charts/line/LineChartOne";

const sites = [
  { name: "Tibiao A3", pct: 94 },
  { name: "Libertad", pct: 81 },
  { name: "Culasi", pct: 76 },
  { name: "Pandan", pct: 69 },
  { name: "Caluya", pct: 63 },
];

function barColor(pct: number) {
  if (pct >= 85) return "bg-lime-500";
  if (pct >= 70) return "bg-orange-400";
  return "bg-red-400";
}

export default function KpiDashboard() {
  return (
    <>
      <PageMeta
        title="Automated KPI calculation | Admin"
        description="Survival, growth, and site health KPIs with export."
      />
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Automated KPI calculation
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Site: Tibiao-A, Plot A3 — reporting window and exports
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OutlineButton>Change site</OutlineButton>
            <OutlineButton>Select date range</OutlineButton>
            <OutlineButton>Generate PDF report</OutlineButton>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Survival rate", value: "84%", hint: "↑ 3% from baseline", accent: true },
            { label: "Growth rate", value: "1.2 cm/mo", hint: "Seasonal avg." },
            { label: "Trees counted", value: "382", hint: "of 420 planted" },
            { label: "Site health", value: "Good", hint: "Last verified today", accent: true },
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
              <AdminBadge tone="success">84% survival</AdminBadge>
            </div>
            <div className="flex aspect-[16/10] min-h-[200px] items-center justify-center rounded-xl bg-gradient-to-br from-emerald-950/60 to-gray-900 ring-1 ring-white/10">
              <div className="text-center text-sm text-gray-400">
                <p className="text-lime-200/90">Plot-level survival surface</p>
                <p className="mt-2 max-w-xs text-xs">
                  Green (&gt;85%), orange (70–85%), red (&lt;70%) — connect your geospatial layer here.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-white/5 py-2 dark:bg-white/[0.04]">
                <p className="font-semibold text-lime-300">354</p>
                <p className="text-gray-600 dark:text-gray-500">Healthy</p>
              </div>
              <div className="rounded-lg bg-white/5 py-2 dark:bg-white/[0.04]">
                <p className="font-semibold text-orange-300">22</p>
                <p className="text-gray-600 dark:text-gray-500">At risk</p>
              </div>
              <div className="rounded-lg bg-white/5 py-2 dark:bg-white/[0.04]">
                <p className="font-semibold text-red-300">6</p>
                <p className="text-gray-600 dark:text-gray-500">Dead</p>
              </div>
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Select date range</h2>
            <p className="text-sm text-gray-600 dark:text-gray-500">November 2025</p>
            <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-gray-600 dark:text-gray-500">
              {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                <span key={d} className="py-1 font-medium text-gray-600 dark:text-gray-400">
                  {d}
                </span>
              ))}
              {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => {
                const inRange = d >= 1 && d <= 13;
                return (
                  <span
                    key={d}
                    className={`rounded-md py-2 ${
                      inRange
                        ? "bg-lime-500/25 font-medium text-emerald-900 dark:text-lime-100"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
                    }`}
                  >
                    {d}
                  </span>
                );
              })}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <PrimaryButton>Apply range</PrimaryButton>
              <OutlineButton>Reset</OutlineButton>
            </div>
          </AdminCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AdminCard>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Survival rate trend</h2>
              <OutlineButton className="!py-1.5 !text-xs">6 months</OutlineButton>
            </div>
            <div className="-mx-2 min-h-[200px]">
              <BarChartOne />
            </div>
          </AdminCard>
          <AdminCard>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Growth trends</h2>
              <AdminBadge tone="success">On track</AdminBadge>
            </div>
            <div className="-mx-2 min-h-[200px]">
              <LineChartOne />
            </div>
          </AdminCard>
        </div>

        <AdminCard>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Comparative site performance
          </h2>
          <ul className="mt-6 space-y-4">
            {sites.map((s) => (
              <li key={s.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-800 dark:text-gray-200">{s.name}</span>
                  <span className="font-medium text-emerald-700 dark:text-lime-200">{s.pct}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                  <div
                    className={`h-full rounded-full transition-all ${barColor(s.pct)}`}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <PrimaryButton>Generate PDF</PrimaryButton>
            <OutlineButton>↓ CSV</OutlineButton>
          </div>
        </AdminCard>
      </div>
    </>
  );
}
