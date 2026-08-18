import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  CheckCircle2,
  Factory,
  FolderOpen,
  GraduationCap,
  Landmark,
  Layers,
  LayoutDashboard,
  Palmtree,
  Settings,
  ShoppingCart,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import BrandLogo from "../common/BrandLogo";
import LogoutConfirmModal from "../common/LogoutConfirmModal";
import useAuth from "../../hooks/useAuth";
import { getSidebarMenus } from "../../api/authApi";
import { userCanAccess, isStoreManager, isProductionManager, isOperator, storeManagerPathAllowed } from "../../config/permissions";
import { SIDEBAR_NAV, sectionHasActiveChild } from "../../config/sidebarNav";
import { STORE_MANAGER_NAV_ITEMS } from "../../config/storeManagerNavConfig";

const ICON_BY_KEY = {
  dashboard: LayoutDashboard,
  masters: Layers,
  hrMasters: Layers,
  production: Factory,
  inventory: Boxes,
  procurement: ShoppingCart,
  sales: Wallet,
  hr: Users,
  attendance: CalendarDays,
  leaveManagement: Palmtree,
  hrPayroll: Wallet,
  hrPerformance: Users,
  recruitment: UserPlus,
  training: GraduationCap,
  hrReports: BarChart3,
  hrSettings: Settings,
  finance: Landmark,
  accountant: Landmark,
  quality: CheckCircle2,
  maintenance: Wrench,
  alerts: Bell,
  documents: FolderOpen,
  analytics: BarChart3,
  settings: Settings,
  admin: Settings,
};

function buildStoreManagerSidebarNav() {
  return STORE_MANAGER_NAV_ITEMS.map((item) => {
    if (item.action) {
      return {
        key: item.key,
        label: item.label,
        action: item.action,
        icon: item.icon,
      };
    }
    if (item.children?.length) {
      return {
        key: item.key,
        label: item.label,
        icon: item.icon,
        module: "inventory",
        children: item.children.map((c) => ({
          key: c.key,
          label: c.label,
          to: c.to,
          module: "inventory",
          end: c.end,
        })),
      };
    }
    return {
      key: item.key,
      label: item.label,
      to: item.to,
      icon: item.icon,
      module: "inventory",
      end: item.end,
    };
  });
}

function FactorySkyline() {
  return (
    <svg viewBox="0 0 200 60" className="w-full h-14 opacity-40" aria-hidden>
      <rect x="10" y="30" width="25" height="25" fill="#3B82F6" opacity="0.5" />
      <rect x="40" y="20" width="20" height="35" fill="#60A5FA" opacity="0.6" />
      <rect x="65" y="25" width="30" height="30" fill="#2563EB" opacity="0.5" />
      <rect x="100" y="15" width="18" height="40" fill="#3B82F6" opacity="0.55" />
      <rect x="125" y="28" width="25" height="27" fill="#60A5FA" opacity="0.5" />
      <rect x="155" y="22" width="22" height="33" fill="#2563EB" opacity="0.45" />
      <polygon points="40,20 50,8 60,20" fill="#93C5FD" opacity="0.6" />
      <polygon points="100,15 109,5 118,15" fill="#93C5FD" opacity="0.6" />
    </svg>
  );
}

function mapApiMenusToNav(menus) {
  return (menus || []).map((section) => {
    const Icon = ICON_BY_KEY[section.key] || LayoutDashboard;
    if (section.path && !(section.children && section.children.length)) {
      return {
        key: section.key,
        label: section.label,
        to: section.path,
        icon: Icon,
        module: section.module,
        end: section.path === "/",
      };
    }
    return {
      key: section.key,
      label: section.label,
      icon: Icon,
      module: section.module,
      children: (section.children || [])
        .filter((c) => c?.path)
        .map((c) => ({
          label: c.label,
          to: c.path,
          module: c.module,
        })),
    };
  });
}

const PROD_MANAGER_ALLOWED_SECTIONS = new Set([
  "dashboard",
  "masters",
  "production",
  "inventory",
  "procurement",
  "quality",
  "maintenance",
  "alerts",
  "documents",
  "analytics",
]);

const PROD_MANAGER_ALLOWED_CHILDREN = new Set([
  "/masters/products",
  "/masters/bom",
  "/production",
  "/production/dashboard",
  "/production/create",
  "/production/machines",
  "/production/planning",
  "/production/work-orders",
  "/production/work-orders/create-quick",
  "/production/job-card",
  "/production/schedule",
  "/production/tasks",
  "/production/reports",
  "/inventory",
  "/inventory/raw-materials",
  "/inventory/finished-goods",
  "/inventory/stock-transfer",
  "/sales",
  "/sales/orders",
  "/procurement/vendors",
  "/procurement/material-requests",
  "/quality/in-process",
  "/quality/final",
  "/quality/defects",
  "/maintenance/preventive",
  "/maintenance/equipment",
  "/maintenance/breakdowns",
  "/maintenance/machine-history",
  "/alerts",
  "/alerts/low-stock",
  "/alerts/machine-failure",
  "/alerts/production-delay",
  "/alerts/maintenance",
  "/alerts/quality",
  "/alerts/safety",
  "/alerts/general",
  "/documents",
  "/documents/production",
  "/documents/quality",
  "/documents/reports",
  "/analytics/production",
  "/analytics/inventory",
  "/analytics/live",
]);

function normalizeRoleName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]+/g, " ");
}

function isHRManager(user) {
  if (!user) return false;
  if (Array.isArray(user.permissions) && user.permissions.includes("*")) return false; // admin
  const roles = Array.isArray(user.roles)
    ? user.roles.map((r) => (typeof r === "object" ? r.name : String(r)))
    : [];
  const roleStr = String(user.role || user.role_name || (typeof user.roles === "string" ? user.roles : ""));
  const allRoles = [...roles.map((r) => normalizeRoleName(r)), normalizeRoleName(roleStr)];
  return allRoles.some((r) => r.includes("hr manager") || r.includes("hr manager") || r.includes("hr") || r.includes("human resources"));
}

// Sections always hidden for HR Manager regardless of API permissions
const HR_MANAGER_BLOCKED_SECTIONS = new Set(["masters", "hrMasters"]);

export function filterStaticNav(user) {
  const storeMgr = isStoreManager(user);
  const isPM = isProductionManager(user);
  const isHR = isHRManager(user);
  return SIDEBAR_NAV.map((section) => {
    if (isPM && !PROD_MANAGER_ALLOWED_SECTIONS.has(section.key)) return null;
    if (isHR && HR_MANAGER_BLOCKED_SECTIONS.has(section.key)) return null;
    if (section.to) {
      if (!userCanAccess(user, section.module)) return null;
      if (storeMgr && !storeManagerPathAllowed(section.to)) return null;
      return section;
    }
    let children = (section.children || []).filter((c) => {
      if (isPM && !PROD_MANAGER_ALLOWED_CHILDREN.has(c.to)) return false;
      return userCanAccess(user, c.module);
    });
    if (storeMgr) {
      children = children.filter((c) => storeManagerPathAllowed(c.to));
    }
    if (children.length === 0) return null;
    return { ...section, children };
  }).filter(Boolean);
}

function buildInitialExpanded(pathname, nav) {
  const state = {};
  nav.forEach((section) => {
    if (section.children && sectionHasActiveChild(pathname, section)) {
      state[section.key] = true;
    }
  });
  return state;
}

export default function Sidebar({ collapsed = false, onToggleCollapse, onClose }) {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [apiNav, setApiNav] = useState(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const storeMode = isStoreManager(user);

  useEffect(() => {
    if (!isAuthenticated) {
      setApiNav(null);
      return;
    }
    let cancelled = false;
    getSidebarMenus()
      .then((menus) => {
        if (!cancelled) setApiNav(mapApiMenusToNav(menus));
      })
      .catch(() => {
        if (!cancelled) setApiNav(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, user?.role, user?.role_id]);

  const visibleNav = useMemo(() => {
    if (storeMode) {
      return buildStoreManagerSidebarNav();
    }
    // Prefer local SIDEBAR_NAV so new pages (Inventory v2, Ledger) appear even if API catalog is stale.
    const staticNav = filterStaticNav(user);
    const raw = staticNav.length ? staticNav : apiNav && apiNav.length ? apiNav : [];
    const filteredRaw = (raw || []).filter((section) => {
      if (isHRManager(user) && HR_MANAGER_BLOCKED_SECTIONS.has(section.key)) return false;
      return true;
    });
    if (isProductionManager(user)) {
      return filteredRaw
        .map((section) => {
          if (!PROD_MANAGER_ALLOWED_SECTIONS.has(section.key)) return null;
          if (!section.children) return section;
          const children = section.children.filter((c) => PROD_MANAGER_ALLOWED_CHILDREN.has(c.to));
          if (children.length === 0) return null;
          return { ...section, children };
        })
        .filter(Boolean);
    }
    // Operators do not see the Masters section
    if (isOperator(user)) {
      return filteredRaw.filter((section) => section.key !== "masters");
    }
    return filteredRaw;
  }, [apiNav, user, storeMode]);

  const [expanded, setExpanded] = useState(() =>
    buildInitialExpanded(location.pathname, visibleNav)
  );

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      visibleNav.forEach((section) => {
        if (section.children && sectionHasActiveChild(location.pathname, section)) {
          next[section.key] = true;
        }
      });
      return next;
    });
  }, [location.pathname, visibleNav]);

  const toggleSection = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirmLogout = async ({ allDevices }) => {
    setLoggingOut(true);
    try {
      await logout({ allDevices });
      onClose?.();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  /* Selected nav item — brand active teal on forest sidebar */
  const navItemPad = collapsed ? "justify-center px-2" : "px-3";

  const topLinkClass = ({ isActive }) =>
    `relative flex items-center gap-2.5 rounded-lg py-2.5 text-sm transition-all ${navItemPad} ${
      isActive
        ? "bg-[var(--color-nav-active)] font-medium text-white"
        : "text-slate-300 hover:bg-white/10 hover:text-white"
    }`;

  const childLinkClass = ({ isActive }) =>
    `relative block rounded-lg py-2 pl-9 pr-3 text-[13px] transition-colors ${
      isActive
        ? "bg-[var(--color-nav-active)] font-medium text-white"
        : "text-slate-400 hover:bg-white/10 hover:text-slate-200"
    }`;

  const sectionButtonClass = (_isOpen, hasActive) =>
    `relative flex w-full items-center rounded-lg py-2.5 text-sm font-medium transition-colors ${navItemPad} ${
      collapsed ? "justify-center" : "justify-between gap-2"
    } ${
      hasActive
        ? "bg-[var(--color-nav-active)] text-white"
        : "text-slate-300 hover:bg-white/10 hover:text-white"
    }`;

  const actionButtonClass = `flex w-full items-center rounded-lg py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white ${navItemPad} ${
    collapsed ? "justify-center" : "gap-2.5"
  }`;

  const sectionLabel = (section) => section.label || (section.labelKey ? t(section.labelKey) : section.key);
  const childLabel = (child) => child.label || (child.labelKey ? t(child.labelKey) : child.to);

  return (
    <aside className="relative flex h-full w-full shrink-0 flex-col bg-[var(--color-nav-bg)] text-white">
      {typeof onToggleCollapse === "function" ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute -right-3 top-[48%] z-20 hidden h-11 w-6 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-[#c8c8d0] bg-[var(--color-nav-bg)] text-white shadow-sm hover:bg-[var(--color-nav-bg-hover)] lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" strokeWidth={2.25} />
          ) : (
            <ChevronsLeft className="h-4 w-4" strokeWidth={2.25} />
          )}
        </button>
      ) : null}
      <div className={`shrink-0 border-b border-white/10 ${collapsed ? "p-3" : "px-4 py-5"}`}>
        <Link to={storeMode ? "/inventory" : "/"} className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`} onClick={() => onClose?.()}>
          <BrandLogo size="md" imageClassName="rounded-lg bg-white/95 p-0.5" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-lg font-bold tracking-tight">Insights Iva</p>
              <p className="text-[9px] leading-tight text-slate-400">
                {storeMode ? "Store Manager" : t("nav.tagline")}
              </p>
            </div>
          )}
        </Link>
      </div>

      <nav className={`sidebar-scroll flex-1 space-y-0.5 overflow-y-auto py-4 ${collapsed ? "px-2" : "px-3"}`}>
        {visibleNav.map((section) => {
          if (section.action === "logout") {
            const Icon = section.icon || LayoutDashboard;
            return (
              <button
                key={section.key}
                type="button"
                title={collapsed ? section.label : undefined}
                onClick={() => setLogoutOpen(true)}
                className={actionButtonClass}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                {!collapsed && <span className="truncate">{section.label}</span>}
              </button>
            );
          }

          if (section.to) {
            const Icon = section.icon || LayoutDashboard;
            const label = sectionLabel(section);
            return (
              <NavLink
                key={section.key}
                to={section.to}
                end={section.end}
                onClick={() => onClose?.()}
                title={collapsed ? label : undefined}
                className={topLinkClass}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                {!collapsed && <span className="truncate">{label}</span>}
              </NavLink>
            );
          }

          const Icon = section.icon || LayoutDashboard;
          const isOpen = expanded[section.key];
          const hasActive = sectionHasActiveChild(location.pathname, section);
          const label = sectionLabel(section);

          return (
            <div key={section.key} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleSection(section.key)}
                className={sectionButtonClass(isOpen, hasActive)}
                aria-expanded={isOpen}
                title={collapsed ? label : undefined}
              >
                <span className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  {!collapsed && <span className="truncate text-left">{label}</span>}
                </span>
                {!collapsed && (
                  isOpen ? <ChevronDown className="h-4 w-4 shrink-0 opacity-70" /> : <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
                )}
              </button>
              {!collapsed && isOpen && (
                <div className="space-y-0.5 pb-1">
                  {section.children.map((child) => (
                    <NavLink
                      key={`${section.key}-${child.to}-${child.label || child.key}`}
                      to={child.to}
                      end={child.end}
                      onClick={() => onClose?.()}
                      className={childLinkClass}
                    >
                      {childLabel(child)}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {!collapsed && !storeMode && (
        <div className="shrink-0 space-y-2.5 border-t border-white/10 px-3 py-3">
          <FactorySkyline />
          <p className="text-center text-[9px] font-medium uppercase tracking-wider text-slate-500">
            {t("nav.footerTagline")}
          </p>
        </div>
      )}

      <LogoutConfirmModal
        open={logoutOpen}
        busy={loggingOut}
        onCancel={() => {
          if (!loggingOut) setLogoutOpen(false);
        }}
        onConfirm={handleConfirmLogout}
      />
    </aside>
  );
}
