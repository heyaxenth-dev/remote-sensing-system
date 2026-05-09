import PageMeta from "../../components/common/PageMeta";
import { AdminBadge, AdminCard, OutlineButton } from "../../components/app/adminUi";

export default function LocationAnalytics() {
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
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Regional overview — sites, plots, and latest field activity
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OutlineButton>Export GeoJSON</OutlineButton>
            <OutlineButton>Refresh layers</OutlineButton>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Active sites", value: "12", hint: "3 with open verification" },
            { label: "Plots monitored", value: "48", hint: "Across 4 municipalities" },
            { label: "Photos this week", value: "216", hint: "+18% vs last week" },
            { label: "Avg. GPS accuracy", value: "2.1 m", hint: "Field devices" },
          ].map((k) => (
            <AdminCard key={k.label} className="!p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {k.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-lime-400">{k.value}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">{k.hint}</p>
            </AdminCard>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <AdminCard className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Site map</h2>
              <AdminBadge tone="success">Live layers</AdminBadge>
            </div>
            <div className="flex aspect-[21/9] min-h-[220px] items-center justify-center rounded-xl bg-gradient-to-br from-emerald-950/80 to-gray-900 ring-1 ring-lime-500/20">
              <div className="text-center">
                <p className="text-sm font-medium text-lime-200/90">Geospatial workspace</p>
                <p className="mt-1 max-w-sm text-xs text-gray-400">
                  Map tiles and plot boundaries connect here. Wire to your PostGIS / tile server when
                  ready.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-lime-400" /> On track
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-orange-400" /> Review
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-red-400" /> Flagged
              </span>
            </div>
          </AdminCard>

          <AdminCard>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent uploads</h2>
            <ul className="mt-4 space-y-3">
              {[
                { site: "Tibiao-A · Plot A3", time: "12 min ago", status: "Queued" },
                { site: "Libertad · Plot B2", time: "1 hr ago", status: "Synced" },
                { site: "Culasi · Plot C1", time: "3 hr ago", status: "Synced" },
              ].map((row) => (
                <li
                  key={row.site}
                  className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3 last:border-0 dark:border-gray-800"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.site}</p>
                    <p className="text-xs text-gray-500">{row.time}</p>
                  </div>
                  <AdminBadge tone={row.status === "Synced" ? "success" : "warn"}>{row.status}</AdminBadge>
                </li>
              ))}
            </ul>
          </AdminCard>
        </div>
      </div>
    </>
  );
}
