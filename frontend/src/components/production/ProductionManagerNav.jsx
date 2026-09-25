import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  Factory,
  LayoutDashboard,
  Monitor,
} from "lucide-react";

import useAuth from "../../hooks/useAuth";
import { isAdmin, userCanAccess } from "../../config/permissions";
import { PRODUCTION_DASHBOARD_PATH } from "../../utils/roleRedirect";

const NAV_ITEMS = [
  {
    key: "dashboard",
    labelKey: "productionManagerNav.dashboard",
    to: PRODUCTION_DASHBOARD_PATH,
    icon: LayoutDashboard,
    module: "production",
    end: true,
  },
  { key: "production", labelKey: "productionManagerNav.production", to: "/production", icon: Factory, module: "production" },
  { key: "inventory", labelKey: "productionManagerNav.inventory", to: "/inventory/raw-materials", icon: Boxes, module: "inventory" },
  { key: "quality", labelKey: "productionManagerNav.quality", to: "/quality/inspection", icon: CheckCircle2, module: "quality" },
  { key: "machineMonitoring", labelKey: "productionManagerNav.machineMonitoring", to: "/factory-monitor/machine-status", icon: Monitor, module: "factoryMonitor" },
  { key: "analytics", labelKey: "productionManagerNav.analytics", to: "/analytics/production", icon: BarChart3, module: "analytics" },
];

function shouldShowNav(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const roles = (Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role, user.role_name])
    .filter(Boolean)
    .map((r) => (typeof r === "object" ? r?.name || "" : String(r)).toLowerCase());
  return roles.some((r) => r === "production manager" || r === "production_manager" || r.includes("production manager") || r.includes("production_manager"));
}

export default function ProductionManagerNav() {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!shouldShowNav(user)) return null;

  const visible = NAV_ITEMS.filter((item) => userCanAccess(user, item.module));
  if (visible.length === 0) return null;

  const linkClass = ({ isActive }) =>
    `inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "bg-[var(--color-success)] text-white shadow-sm"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    }`;

  return (
    <nav
      aria-label={t("productionManagerNav.ariaLabel")}
      className="flex flex-wrap gap-1 ui-card p-1.5"
    >
      {visible.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.key} to={item.to} end={item.end} className={linkClass}>
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {t(item.labelKey)}
          </NavLink>
        );
      })}
    </nav>
  );
}
