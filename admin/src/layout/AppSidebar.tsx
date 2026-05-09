import { Link, useLocation } from "react-router";
import { useSidebar } from "../context/SidebarContext";

const mainNav: { name: string; path: string }[] = [
  { name: "Location analytics", path: "/" },
  { name: "Data verification & image processing", path: "/verification" },
  { name: "Automated KPI calculation", path: "/kpi" },
  { name: "User & system management", path: "/users" },
];

const settingsNav: { name: string; path: string }[] = [
  { name: "Settings", path: "/settings" },
];

function NavDot({ active }: { active: boolean }) {
  return (
    <span
      className={`mt-0.5 size-2 shrink-0 rounded-full ${
        active ? "bg-lime-300" : "bg-gray-500 dark:bg-gray-600"
      }`}
      aria-hidden
    />
  );
}

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, toggleSidebar, toggleMobileSidebar } =
    useSidebar();
  const location = useLocation();

  const showLabels = isExpanded || isHovered || isMobileOpen;

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const handleMenuToggle = () => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const linkClasses = (path: string) =>
    `menu-item group ${
      isActive(path) ? "menu-item-active" : "menu-item-inactive"
    } ${!showLabels ? "lg:justify-center lg:px-2" : ""}`;

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-4 left-0 bg-white dark:bg-[#1a1a1a] dark:border-gray-800/80 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
              ? "w-[290px]"
              : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex items-center gap-3 py-6 ${
          !showLabels ? "lg:justify-center" : ""
        }`}
      >
        <Link to="/" className="shrink-0">
          <img
            className="object-contain"
            src="/images/logo/logo.png"
            alt="Logo"
            width={showLabels ? 44 : 36}
            height={showLabels ? 44 : 36}
          />
        </Link>
      </div>

      <div
        className={`mb-6 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-2 py-2 dark:border-gray-800 dark:bg-white/[0.04] ${
          !showLabels ? "lg:justify-center" : ""
        }`}
      >
        <button
          type="button"
          onClick={handleMenuToggle}
          className="flex size-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          aria-label="Toggle sidebar"
        >
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z"
              fill="currentColor"
            />
          </svg>
        </button>
        {showLabels && (
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Dashboard</span>
        )}
      </div>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar">
        <ul className="flex flex-col gap-1">
          {mainNav.map((item) => (
            <li key={item.path}>
              <Link to={item.path} className={linkClasses(item.path)}>
                <span className="menu-item-icon-size flex items-start pt-0.5">
                  <NavDot active={isActive(item.path)} />
                </span>
                {showLabels && (
                  <span className="menu-item-text leading-snug">{item.name}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        <div
          className={`my-4 border-t border-gray-200 dark:border-gray-800 ${
            !showLabels ? "mx-1" : ""
          }`}
        />

        <ul className="flex flex-col gap-1">
          {settingsNav.map((item) => (
            <li key={item.path}>
              <Link to={item.path} className={linkClasses(item.path)}>
                <span className="menu-item-icon-size flex items-start pt-0.5">
                  <NavDot active={isActive(item.path)} />
                </span>
                {showLabels && <span className="menu-item-text">{item.name}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div
        className={`mt-auto border-t border-gray-200 pt-5 pb-8 dark:border-gray-800 ${
          showLabels ? "" : "flex justify-center"
        }`}
      >
        <div className={`flex items-center gap-3 ${showLabels ? "" : "flex-col"}`}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime-400/20 text-sm font-semibold text-lime-200">
            AD
          </div>
          {showLabels && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">Admin</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">CENRO Kalibo</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
