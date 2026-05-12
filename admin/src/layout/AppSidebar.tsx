import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";

import {
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  UserCircleIcon,
} from "../icons";
import { useSidebar } from "../context/SidebarContext";

type NavItem = {
  name: string;
  icon: ReactNode;
  path: string;
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Location analytics",
    path: "/",
  },
  {
    icon: <ListIcon />,
    name: "Data & verification",
    path: "/verification",
  },
  {
    icon: <PieChartIcon />,
    name: "KPI automation",
    path: "/kpi",
  },
  {
    icon: <UserCircleIcon />,
    name: "User & system",
    path: "/users",
  },
];

const othersItems: NavItem[] = [
  {
    icon: <PageIcon />,
    name: "Configuration",
    path: "/settings",
  },
];

function MenuSection({
  title,
  items,
  isExpanded,
  isHovered,
  isMobileOpen,
  pathname,
}: {
  title: ReactNode;
  items: NavItem[];
  isExpanded: boolean;
  isHovered: boolean;
  isMobileOpen: boolean;
  pathname: string;
}) {
  const showLabels = isExpanded || isHovered || isMobileOpen;

  return (
    <div>
      <h2
                className={`mb-4 flex text-xs uppercase leading-[20px] text-gray-600 dark:text-gray-400 ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        {showLabels ? title : <HorizontaLDots className="size-6" />}
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((nav) => {
          const active =
            nav.path === "/"
              ? pathname === "/" || pathname === ""
              : pathname === nav.path || pathname.startsWith(`${nav.path}/`);

          return (
            <li key={nav.path}>
              <Link
                to={nav.path}
                className={`menu-item group ${
                  active ? "menu-item-active" : "menu-item-inactive"
                } ${!isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"}`}
              >
                <span
                  className={`menu-item-icon-size ${
                    active ? "menu-item-icon-active" : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {showLabels ? <span className="menu-item-text">{nav.name}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const showExpandedLogo = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      className={`fixed top-0 left-0 z-50 mt-16 flex h-screen flex-col border-r border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 lg:mt-0
        ${
          isExpanded || isMobileOpen ? "w-[290px]" : isHovered ? "w-[290px]" : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex py-8 ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link
          to="/"
          className={`flex min-w-0 items-center gap-3 ${showExpandedLogo ? "" : "justify-center"}`}
        >
          {showExpandedLogo ? (
            <>
              <img
                className="h-10 w-10 shrink-0 object-contain"
                src="/images/logo/app-logo.png"
                alt="Remote sensing system"
                width={40}
                height={40}
              />
              <span className="truncate text-left text-base font-semibold text-gray-900 dark:text-white">
                Remote-Sensing
              </span>
            </>
          ) : (
            <img
              className="size-9 object-contain"
              src="/images/logo/app-logo.png"
              alt="Remote sensing system"
              width={36}
              height={36}
            />
          )}
        </Link>
      </div>
      <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <MenuSection
              title="Menu"
              items={navItems}
              isExpanded={isExpanded}
              isHovered={isHovered}
              isMobileOpen={isMobileOpen}
              pathname={location.pathname}
            />
            <MenuSection
              title="Others"
              items={othersItems}
              isExpanded={isExpanded}
              isHovered={isHovered}
              isMobileOpen={isMobileOpen}
              pathname={location.pathname}
            />
          </div>
        </nav>
      </div>
    </aside>
  );
}

export default AppSidebar;
