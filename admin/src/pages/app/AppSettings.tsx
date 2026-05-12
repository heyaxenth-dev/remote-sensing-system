import PageMeta from "../../components/common/PageMeta";
import { AdminCard, OutlineButton, PrimaryButton } from "../../components/app/adminUi";

export default function AppSettings() {
  return (
    <>
      <PageMeta title="Settings | Admin" description="Application and integration settings." />
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Preferences for verification workflows, notifications, and integrations.
          </p>
        </div>

        <AdminCard>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Verification & CV</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-500">
            Defaults for image processing jobs.
          </p>
          <ul className="mt-6 space-y-4">
            {[
              "Auto-verify when model confidence ≥ 85%",
              "Require second reviewer for flagged sites",
              "Notify CENRO when queue depth exceeds 20 items",
            ].map((label) => (
              <li key={label} className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                <input
                  type="checkbox"
                  defaultChecked
                  className="size-4 rounded border-gray-400 bg-white text-lime-600 dark:border-gray-600 dark:bg-gray-800 dark:text-lime-500"
                />
              </li>
            ))}
          </ul>
        </AdminCard>

        <AdminCard>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data & API</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium uppercase text-gray-600 dark:text-gray-500">
              Analysis API base URL
            </label>
            <input
              type="url"
              placeholder="https://api.example.com"
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-lime-500/60 focus:outline-none focus:ring-2 focus:ring-lime-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-600 dark:focus:border-lime-500/40"
            />
            <label className="block text-xs font-medium uppercase text-gray-600 dark:text-gray-500">
              Webhook (optional)
            </label>
            <input
              type="url"
              placeholder="https://…"
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-lime-500/60 focus:outline-none focus:ring-2 focus:ring-lime-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-600 dark:focus:border-lime-500/40"
            />
          </div>
        </AdminCard>

        <div className="flex flex-wrap justify-end gap-2">
          <OutlineButton>Discard</OutlineButton>
          <PrimaryButton>Save changes</PrimaryButton>
        </div>
      </div>
    </>
  );
}
