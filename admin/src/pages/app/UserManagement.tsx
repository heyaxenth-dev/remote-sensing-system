import PageMeta from "../../components/common/PageMeta";
import { AdminBadge, AdminCard, OutlineButton, PrimaryButton } from "../../components/app/adminUi";

const users = [
  { name: "Rodmar Inquit", role: "Field user", last: "Mar 24, 2:30 PM", online: true },
  { name: "Pete Malasan", role: "Admin", last: "Mar 24, 11:12 AM", online: false },
  { name: "Kimberly Farre", role: "Field user", last: "Mar 23, 4:05 PM", online: true },
  { name: "Alex Ramos", role: "Field user", last: "Mar 22, 9:00 AM", online: false },
  { name: "Jamie Cruz", role: "Admin", last: "Mar 21, 3:40 PM", online: false },
];

export default function UserManagement() {
  return (
    <>
      <PageMeta
        title="User & system management | Admin"
        description="Accounts, roles, and system health for the monitoring platform."
      />
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            User & system management
          </h1>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.18 3.18a1 1 0 01-1.414 1.414l-3.18-3.18A7 7 0 012 9z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              <input
                type="search"
                placeholder="Search users"
                className="w-full rounded-xl border border-gray-600 bg-gray-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-lime-500/50 focus:outline-none focus:ring-2 focus:ring-lime-500/20 sm:w-64"
              />
            </div>
            <PrimaryButton className="whitespace-nowrap">+ Add new user</PrimaryButton>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <AdminCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">User accounts</h2>
              <AdminBadge tone="success">5 active</AdminBadge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs uppercase text-gray-500">
                    <th className="pb-3 pr-3 font-medium">Name</th>
                    <th className="pb-3 pr-3 font-medium">Role</th>
                    <th className="pb-3 pr-3 font-medium">Last login</th>
                    <th className="pb-3 pr-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.name} className="border-b border-gray-800/80">
                      <td className="py-3 pr-3 font-medium text-gray-200">{u.name}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.role === "Admin"
                              ? "bg-lime-500/20 text-lime-200"
                              : "bg-blue-500/20 text-blue-200"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-gray-500">{u.last}</td>
                      <td className="py-3 pr-3">
                        <span className="inline-flex items-center gap-1.5 text-gray-400">
                          <span
                            className={`size-2 rounded-full ${u.online ? "bg-lime-400" : "bg-gray-600"}`}
                          />
                          {u.online ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="rounded-lg border border-gray-700 p-2 text-gray-400 hover:bg-white/5"
                            aria-label="Edit"
                          >
                            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-gray-700 p-2 text-gray-400 hover:bg-white/5"
                            aria-label="View"
                          >
                            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminCard>

          <AdminCard>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">System health</h2>
              <AdminBadge tone="success">All systems normal</AdminBadge>
            </div>
            <ul className="space-y-4 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-gray-400">Geospatial repository</span>
                <AdminBadge tone="success">Healthy</AdminBadge>
              </li>
              <li>
                <div className="mb-1 flex justify-between text-gray-400">
                  <span>Data store</span>
                  <span className="text-gray-200">62% used · 128 / 200 GB</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                  <div className="h-full w-[62%] rounded-full bg-lime-500" />
                </div>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-gray-400">Input bandwidth</span>
                <AdminBadge tone="success">Normal</AdminBadge>
              </li>
              <li>
                <p className="mb-2 text-gray-400">Server resources</p>
                {[
                  { label: "CPU", v: 68 },
                  { label: "RAM", v: 49 },
                  { label: "Network", v: 29 },
                ].map((m) => (
                  <div key={m.label} className="mb-2 flex items-center gap-3">
                    <span className="w-16 text-xs text-gray-500">{m.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
                      <div
                        className="h-full rounded-full bg-lime-500/80"
                        style={{ width: `${m.v}%` }}
                      />
                    </div>
                    <span className="w-8 text-xs text-gray-400">{m.v}%</span>
                  </div>
                ))}
              </li>
              <li className="flex items-center justify-between">
                <span className="text-gray-400">Data encryption</span>
                <AdminBadge tone="success">Enabled</AdminBadge>
              </li>
              <li className="flex items-center justify-between border-t border-gray-800 pt-4">
                <span className="text-gray-400">Last backup</span>
                <span className="text-gray-300">3 hrs ago · healthy</span>
              </li>
            </ul>
          </AdminCard>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Archive data",
              body: "Move inactive field seasons to cold storage while keeping metadata queryable.",
              icon: (
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              ),
            },
            {
              title: "Auto-archive",
              body: "Schedule archival for records older than 12 months per DENR retention policy.",
              icon: (
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              ),
            },
            {
              title: "View logs",
              body: "Audit trails for verification actions, exports, and account changes.",
              icon: (
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              ),
            },
          ].map((card) => (
            <AdminCard key={card.title} className="!p-5">
              <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-lime-500/10 text-lime-300">
                {card.icon}
              </div>
              <h3 className="font-semibold text-white">{card.title}</h3>
              <p className="mt-2 text-sm text-gray-500">{card.body}</p>
              <OutlineButton className="mt-4 w-full">Open</OutlineButton>
            </AdminCard>
          ))}
        </div>
      </div>
    </>
  );
}
