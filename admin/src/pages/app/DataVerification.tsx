import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { AdminBadge, AdminCard, OutlineButton, PrimaryButton } from "../../components/app/adminUi";

const queue = [
  { site: "Tibiao · Plot A3", progress: "5/45", status: "Active" as const },
  { site: "Libertad · Plot B2", progress: "0/38", status: "Pending" as const },
  { site: "Culasi · Plot C1", progress: "0/52", status: "Pending" as const },
  { site: "Pandan · Plot A2", progress: "12/30", status: "Flagged" as const },
];

function queueTone(s: (typeof queue)[0]["status"]) {
  if (s === "Active") return "success";
  if (s === "Flagged") return "danger";
  return "warn";
}

export default function DataVerification() {
  const [autoVerify, setAutoVerify] = useState(true);
  const flags = ["Poor visibility / blur", "Inaccurate GPS location", "Incorrect species / count", "Site damage / mortality observed"];

  return (
    <>
      <PageMeta
        title="Data verification | Admin"
        description="Review and verify computer-vision seedling counts from field photos."
      />
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Data verification & image processing
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <AdminBadge tone="warn">5 pending review</AdminBadge>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Site: Tibiao-A, Plot A3 — photo verification
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <OutlineButton>Auto-verify high confidence</OutlineButton>
            <OutlineButton>Process all</OutlineButton>
          </div>
        </div>

        <AdminCard>
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Original field photo
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Compare with CV output before confirming counts
              </p>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Site progress: <span className="font-semibold text-lime-300">5 / 45</span> photos
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-gradient-to-b from-emerald-900/40 to-gray-900 ring-1 ring-white/10">
                <div className="text-center text-gray-400">
                  <div className="mx-auto mb-3 flex size-24 items-center justify-center rounded-full bg-emerald-800/50 ring-2 ring-lime-500/30">
                    <svg className="size-10 text-lime-300/80" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 3c-4 4-6 8-6 12a6 6 0 1012 0c0-4-2-8-6-12zm0 16.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9z" />
                    </svg>
                  </div>
                  <p className="text-xs">Original capture preview</p>
                </div>
              </div>
              <OutlineButton className="w-full sm:w-auto">View full image</OutlineButton>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-200">Computer vision analysis (enhanced)</p>
              <div className="relative flex aspect-[4/3] items-center justify-center rounded-2xl bg-gradient-to-b from-emerald-900/40 to-gray-900 ring-1 ring-lime-500/20">
                <div className="absolute right-3 top-3 max-w-[200px] rounded-xl border border-gray-700 bg-gray-950/90 p-3 text-left text-xs shadow-lg backdrop-blur-sm">
                  <p className="font-semibold text-lime-200">PlantScan CV v3.1</p>
                  <ul className="mt-2 space-y-1 text-gray-300">
                    <li>Count: 2 verified, 1 low confidence</li>
                    <li>
                      Crop health: <span className="text-lime-400">Good</span>
                    </li>
                    <li>Confidence: 87%</li>
                    <li>Processing: 820ms</li>
                  </ul>
                </div>
                <div className="text-center text-gray-400">
                  <div className="mx-auto mb-3 flex size-24 items-center justify-center rounded-full bg-emerald-800/50 ring-2 ring-orange-400/40">
                    <svg className="size-10 text-orange-300/90" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 3c-4 4-6 8-6 12a6 6 0 1012 0c0-4-2-8-6-12zm0 16.5a4.5 4.5 0 110-9 4.5 4.5 0 010 9z" />
                    </svg>
                  </div>
                  <p className="text-xs">Detections overlay</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <AdminBadge tone="success">Verified seedlings (2)</AdminBadge>
            <AdminBadge tone="warn">Low confidence (1)</AdminBadge>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-6 dark:border-gray-800">
            <OutlineButton>Confirm seedling count (2)</OutlineButton>
            <OutlineButton>Add marker</OutlineButton>
            <OutlineButton>Remove marker</OutlineButton>
            <OutlineButton>Save verification</OutlineButton>
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={autoVerify}
                onChange={(e) => setAutoVerify(e.target.checked)}
                className="size-4 rounded border-gray-600 bg-gray-800 text-lime-500 focus:ring-lime-500"
              />
              Auto-verify high confidence
            </label>
          </div>
        </AdminCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <AdminCard>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Flag for review — select reason(s)
            </h2>
            <ul className="mt-4 space-y-3">
              {flags.map((label, i) => (
                <li key={label} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    defaultChecked={i === 0}
                    className="mt-1 size-4 rounded border-gray-600 bg-gray-800 text-lime-500"
                  />
                  <span className="text-sm text-gray-300">{label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              <PrimaryButton>Flag for review</PrimaryButton>
              <OutlineButton>Clear flags</OutlineButton>
            </div>
          </AdminCard>

          <AdminCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Verification queue</h2>
              <AdminBadge tone="warn">5 pending</AdminBadge>
            </div>
            <ul className="space-y-3">
              {queue.map((row) => (
                <li
                  key={row.site}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-3 dark:border-gray-800"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-200">{row.site}</p>
                    <p className="text-xs text-gray-500">{row.progress}</p>
                  </div>
                  <AdminBadge tone={queueTone(row.status)}>{row.status}</AdminBadge>
                </li>
              ))}
            </ul>
          </AdminCard>
        </div>
      </div>
    </>
  );
}
