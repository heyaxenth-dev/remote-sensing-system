import { Link } from "react-router";

export default function SidebarWidget() {
  return (
    <div
      className={`
        mx-auto mb-10 w-full max-w-60 rounded-2xl bg-gray-50 px-4 py-5 text-center dark:bg-white/[0.03]`}
    >
      <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">Remote sensing admin</h3>
      <p className="mb-4 text-theme-sm text-gray-600 dark:text-gray-400">
        CENRO Kalibo operations console for analytics, verification, KPIs, and user management.
      </p>
      <Link
        to="/settings"
        className="flex items-center justify-center rounded-lg bg-brand-500 p-3 text-theme-sm font-medium text-white hover:bg-brand-600"
      >
        Open settings
      </Link>
    </div>
  );
}
