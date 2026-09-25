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
  Plus,
  X,
} from "lucide-react";

import BrandLogo from "../common/BrandLogo";
import LogoutConfirmModal from "../common/LogoutConfirmModal";
import useAuth from "../../hooks/useAuth";
import { getSidebarMenus } from "../../api/authApi";
import {
  userCanAccess,
  userCanAccessApprovalQueue,
  isStoreManager,
  isProductionManager,
  isOperator,
  isHRManager,
  isAccountant,
  isSalesManager,
  isQualityTeam,
  storeManagerPathAllowed,
} from "../../config/permissions";
import {
  PRODUCTION_MANAGER_ALLOWED_CHILDREN,
  PRODUCTION_MANAGER_ALLOWED_SECTIONS,
  HR_MANAGER_ALLOWED_SECTIONS,
  ACCOUNTANT_ALLOWED_SECTIONS,
  ACCOUNTANT_ALLOWED_CHILDREN,
  OPERATOR_ALLOWED_CHILDREN,
  OPERATOR_BLOCKED_CHILDREN,
  OPERATOR_BLOCKED_SECTIONS,
} from "../../config/rbacNavFilters";
import { SIDEBAR_NAV, sectionHasActiveChild, filterNavTree, buildNestedExpanded, navNodeIsActive } from "../../config/sidebarNav";

const ACCOUNTS_DASHBOARD_PATH_ONLY = "/accounts/dashboard";

function stripFinanceDashboardDuplicate(children) {
  return (children || []).filter((c) => {
    const pathOnly = (c.to || c.path || "").split("?")[0];
    return pathOnly !== ACCOUNTS_DASHBOARD_PATH_ONLY;
  });
}
import { ACCOUNTS_DASHBOARD_PATH, SALES_DASHBOARD_PATH } from "../../utils/roleRedirect";
import { STORE_MANAGER_NAV_ITEMS } from "../../config/storeManagerNavConfig";
import { SALES_MANAGER_NAV_ITEMS } from "../../config/salesManagerNavConfig";
import { PRODUCTION_MANAGER_NAV_ITEMS } from "../../config/productionManagerNavConfig";
import { QUALITY_CONTROL_DASHBOARD_NAV_PATH, QUALITY_CONTROL_NAV_ITEMS } from "../../config/qualityControlNavConfig";

export function getRoleJobCardUrl(user) {
  if (isStoreManager(user)) return "/my-job-cards?dept=inventory";
  if (isProductionManager(user)) return "/my-job-cards?dept=production";
  if (isOperator(user)) return "/my-job-cards?dept=operator";
  if (isQualityTeam(user)) return "/my-job-cards?dept=quality";
  if (isAccountant(user)) return "/my-job-cards?dept=billing";
  if (isSalesManager(user)) return "/my-job-cards?dept=sales";
  return "/my-job-cards";
}

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

function dedupeNavSections(sections) {
  const seen = new Set();
  return (sections || []).filter((section) => {
    if (!section?.key || seen.has(section.key)) return false;
    seen.add(section.key);
    return true;
  });
}

function buildSalesManagerSidebarNav() {
  return SALES_MANAGER_NAV_ITEMS.map((item) => {
    if (item.children?.length) {
      return {
        key: item.key,
        label: item.label,
        icon: item.icon,
        module: item.module || "sales",
        children: item.children.map((c) => ({
          key: c.key,
          label: c.label,
          to: c.to,
          module: c.module || item.module || "sales",
          end: c.end,
        })),
      };
    }
    return {
      key: item.key,
      label: item.label,
      to: item.to,
      icon: item.icon,
      module: item.module || "dashboard",
      end: item.end,
    };
  });
}

function buildQualityControlSidebarNav() {
  return QUALITY_CONTROL_NAV_ITEMS.map((item) => {
    if (item.children?.length) {
      return {
        key: item.key,
        label: item.label,
        icon: item.icon,
        module: item.module,
        children: item.children.map((c) => ({
          key: c.key,
          label: c.label,
          to: c.to,
          module: c.module,
          end: c.end,
        })),
      };
    }
    return {
      key: item.key,
      label: item.label,
      to: item.to,
      icon: item.icon,
      module: item.module,
      end: item.end,
    };
  });
}

function buildProductionManagerSidebarNav() {
  return PRODUCTION_MANAGER_NAV_ITEMS.map((item) => {
    if (item.children?.length) {
      return {
        key: item.key,
        label: item.label,
        icon: item.icon,
        module: item.module,
        children: item.children.map((c) => ({
          key: c.key,
          label: c.label,
          to: c.to,
          module: c.module,
          end: c.end,
        })),
      };
    }
    return {
      key: item.key,
      label: item.label,
      to: item.to,
      icon: item.icon,
      module: item.module,
      end: item.end,
    };
  });
}

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
      module: item.module || "inventory",
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

export function filterStaticNav(user) {
  const storeMgr = isStoreManager(user);
  const isPM = isProductionManager(user);
  const isHR = isHRManager(user);
  const isAcct = isAccountant(user);
  const isOp = isOperator(user);
  const filtered = SIDEBAR_NAV.map((section) => {
    if (isPM && !PRODUCTION_MANAGER_ALLOWED_SECTIONS.has(section.key)) return null;
    if (isHR && !HR_MANAGER_ALLOWED_SECTIONS.has(section.key)) return null;
    if (isAcct && !ACCOUNTANT_ALLOWED_SECTIONS.has(section.key)) return null;
    if (isOp && OPERATOR_BLOCKED_SECTIONS.has(section.key)) return null;
    if (section.to) {
      if (!userCanAccess(user, section.module)) return null;
      if (storeMgr && !storeManagerPathAllowed(section.to)) return null;
      return section;
    }
    let children = filterNavTree(section.children, (node) => {
      const pathOnly = (node.to || "").split("?")[0];
      if (isPM && node.to && !PRODUCTION_MANAGER_ALLOWED_CHILDREN.has(node.to) && !PRODUCTION_MANAGER_ALLOWED_CHILDREN.has(pathOnly)) {
        return false;
      }
      if (isAcct && (section.key === "alerts" || section.key === "analytics") && node.to) {
        if (!ACCOUNTANT_ALLOWED_CHILDREN.has(node.to) && !ACCOUNTANT_ALLOWED_CHILDREN.has(pathOnly)) return false;
      }
      if (isOp) {
        if (node.managerOnly) return false;
        if (node.to && (OPERATOR_BLOCKED_CHILDREN.has(node.to) || OPERATOR_BLOCKED_CHILDREN.has(pathOnly))) return false;
        if (section.key === "production" && node.to && !node.operatorOnly) {
          if (!OPERATOR_ALLOWED_CHILDREN.has(node.to) && !OPERATOR_ALLOWED_CHILDREN.has(pathOnly)) return false;
        }
      }
      if (!isOp && node.operatorOnly) return false;
      if (node.approvalQueue) {
        if (!userCanAccessApprovalQueue(user)) return false;
      } else if (!userCanAccess(user, node.module)) return false;
      if (storeMgr && node.to) {
        return storeManagerPathAllowed(node.to) || storeManagerPathAllowed(pathOnly);
      }
      return true;
    });
    if (children.length === 0) return null;
    if (isAcct && section.key === "finance") {
      children = stripFinanceDashboardDuplicate(children);
      if (children.length === 0) return null;
    }
    return { ...section, children };
  }).filter(Boolean);

  if (isHR) {
    const hrIndex = filtered.findIndex((s) => s.key === "hr");
    if (hrIndex > -1) {
      const [hrSection] = filtered.splice(hrIndex, 1);
      const dashIdx = filtered.findIndex((s) => s.key === "dashboard");
      filtered.splice(dashIdx > -1 ? dashIdx + 1 : 0, 0, hrSection);
    }
  }

  if (isAcct) {
    const finIndex = filtered.findIndex((s) => s.key === "finance");
    if (finIndex > -1) {
      const [finSection] = filtered.splice(finIndex, 1);
      const dashIdx = filtered.findIndex((s) => s.key === "dashboard");
      filtered.splice(dashIdx > -1 ? dashIdx + 1 : 0, 0, finSection);
    }
  }

  return filtered;
}

function buildInitialExpanded(pathname, nav) {
  const state = {};
  nav.forEach((section) => {
    if (section.children && sectionHasActiveChild(pathname, section)) {
      state[section.key] = true;
    }
    if (section.nestedNav && section.children?.length) {
      buildNestedExpanded(pathname, section.children, section.key, state);
    }
  });
  return state;
}

export default function Sidebar({ collapsed = false, onToggleCollapse, onClose, isMobile = false }) {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [apiNav, setApiNav] = useState(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const storeMode = isStoreManager(user);
  const salesMode = isSalesManager(user);
  const productionMode = isProductionManager(user);
  const qualityMode = isQualityTeam(user);

  useEffect(() => {
    if (!isAuthenticated) {
      setApiNav(null);
      return;
    }
    if (storeMode || salesMode || productionMode || qualityMode) {
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
  }, [isAuthenticated, user?.id, user?.role, user?.role_id, storeMode, salesMode, productionMode, qualityMode]);

  const visibleNav = useMemo(() => {
    let result = [];
    if (storeMode) {
      result = buildStoreManagerSidebarNav();
    } else if (salesMode) {
      result = buildSalesManagerSidebarNav();
    } else if (productionMode) {
      result = buildProductionManagerSidebarNav();
    } else if (qualityMode) {
      result = buildQualityControlSidebarNav();
    } else {
      const staticNav = filterStaticNav(user);
      const raw = staticNav.length ? staticNav : apiNav && apiNav.length ? apiNav : [];
      if (isOperator(user)) {
        result = raw.filter((section) => !OPERATOR_BLOCKED_SECTIONS.has(section.key));
      } else if (isHRManager(user)) {
        const hrIndex = raw.findIndex((s) => s.key === "hr");
        if (hrIndex > -1) {
          const copy = [...raw];
          const [hrSection] = copy.splice(hrIndex, 1);
          const dashIdx = copy.findIndex((s) => s.key === "dashboard");
          copy.splice(dashIdx > -1 ? dashIdx + 1 : 0, 0, hrSection);
          result = copy;
        } else {
          result = raw;
        }
      } else if (isAccountant(user)) {
        const filtered = raw
          .map((section) => {
            if (!ACCOUNTANT_ALLOWED_SECTIONS.has(section.key)) return null;
            if (!section.children) return section;
            let children = section.children.filter((c) => {
              if (section.key === "alerts" || section.key === "analytics") {
                const pathOnly = (c.to || "").split("?")[0];
                return ACCOUNTANT_ALLOWED_CHILDREN.has(c.to) || ACCOUNTANT_ALLOWED_CHILDREN.has(pathOnly);
              }
              return true;
            });
            if (section.key === "finance") {
              children = stripFinanceDashboardDuplicate(children);
            }
            if (children.length === 0) return null;
            return { ...section, children };
          })
          .filter(Boolean);

        const finIndex = filtered.findIndex((s) => s.key === "finance");
        if (finIndex > -1) {
          const [finSection] = filtered.splice(finIndex, 1);
          const dashIdx = filtered.findIndex((s) => s.key === "dashboard");
          filtered.splice(dashIdx > -1 ? dashIdx + 1 : 0, 0, finSection);
        }
        result = filtered;
      } else {
        result = raw;
      }
    }

    const roleJobCardUrl = getRoleJobCardUrl(user);
    return dedupeNavSections(result).map((section) => {
      if (section.key === "myJobCards") {
        return {
          ...section,
          to: roleJobCardUrl,
        };
      }
      if (section.key === "dashboard" && isAccountant(user) && section.to) {
        return {
          ...section,
          to: ACCOUNTS_DASHBOARD_PATH,
          end: true,
        };
      }
      if (section.key === "dashboard" && salesMode && section.to === SALES_DASHBOARD_PATH) {
        return { ...section, end: true };
      }
      return section;
    });
  }, [apiNav, user, storeMode, salesMode]);

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
        if (section.nestedNav && section.children?.length) {
          buildNestedExpanded(location.pathname, section.children, section.key, next);
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
    `relative flex items-center gap-2.5 rounded-lg py-2.5 min-h-[42px] text-sm transition-all ${navItemPad} ${
      isActive
        ? "bg-[var(--color-nav-active)] font-medium text-white"
        : "text-slate-300 hover:bg-white/10 hover:text-white"
    }`;

  const childLinkClass = ({ isActive }) =>
    `group relative flex w-full items-center rounded-lg px-3 py-2.5 min-h-[40px] text-[13px] transition-colors ${
      isActive
        ? "bg-white/15 font-semibold text-white"
        : "text-slate-300 hover:bg-white/10 hover:text-white"
    }`;

  const renderChildLabel = (child, isActive = false) => {
    const label = childLabel(child);
    if (child.navIcon === "create") {
      return (
        <span className="flex items-center gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
            <Plus className="h-3 w-3" strokeWidth={3} />
          </span>
          <span className="truncate">{label}</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-2.5 min-w-0">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
            isActive ? "bg-white" : "bg-slate-400 group-hover:bg-slate-200"
          }`}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </span>
    );
  };

  const nestedLinkClass = ({ isActive }, opts = {}) => {
    return `group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 min-h-[38px] text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
      collapsed ? "justify-center px-2" : ""
    } ${
      isActive
        ? "bg-white/15 font-semibold text-white"
        : "text-slate-300 hover:bg-white/10 hover:text-white"
    }`;
  };

  const submenuContainerClass = (sectionKey, depth) => {
    return "mb-1.5 space-y-0.5 rounded-b-lg border border-t-0 border-white/12 bg-black/15 p-1.5 pt-1";
  };

  const nestedGroupClass = (isOpen, hasActive) =>
    `relative flex w-full items-center text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
      collapsed ? "justify-center px-2 py-2 rounded-lg" : "justify-between gap-2 px-3 py-2.5 min-h-[40px]"
    } ${
      isOpen
        ? "rounded-t-lg rounded-b-none bg-white/15 text-white font-semibold"
        : hasActive
        ? "rounded-lg bg-white/15 text-white"
        : "rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
    }`;

  const sectionButtonClass = (isOpen, hasActive) =>
    `relative flex w-full items-center text-sm font-medium transition-all ${navItemPad} ${
      collapsed ? "justify-center rounded-xl py-2.5" : "justify-between gap-2 py-2.5 min-h-[42px]"
    } ${
      isOpen
        ? "rounded-t-xl rounded-b-none bg-white/15 text-white font-semibold"
        : hasActive
        ? "rounded-xl bg-[var(--color-nav-active)] text-white font-semibold"
        : "rounded-xl text-slate-300 hover:bg-white/10 hover:text-white"
    }`;

  const actionButtonClass = `flex w-full items-center rounded-lg py-2.5 min-h-[42px] text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white ${navItemPad} ${
    collapsed ? "justify-center" : "gap-2.5"
  }`;

  const sectionLabel = (section) => section.label || (section.labelKey ? t(section.labelKey) : section.key);
  const childLabel = (child) => child.label || (child.labelKey ? t(child.labelKey) : child.to);

  const renderNestedNav = (nodes, sectionKey, depth = 0) =>
    (nodes || []).map((node) => {
      const itemKey = `${sectionKey}:${node.key || node.label}`;
      const label = childLabel(node);
      const Icon = node.icon || LayoutDashboard;
      const isBulletLeaf = node.leafStyle === "bullet";

      if (node.children?.length) {
        const isOpen = expanded[itemKey];
        const hasActive = navNodeIsActive(location.pathname, node);
        return (
          <div key={itemKey} className="space-y-0.5">
            <button
              type="button"
              onClick={() => toggleSection(itemKey)}
              className={nestedGroupClass(hasActive)}
              aria-expanded={isOpen}
              title={collapsed ? label : undefined}
            >
              <span className={`flex min-w-0 flex-1 items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                {!collapsed && <span className="truncate text-left">{label}</span>}
              </span>
              {!collapsed &&
                (isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                ))}
            </button>
            {!collapsed && isOpen ? (
              <div className={submenuContainerClass(sectionKey, depth)}>
                {renderNestedNav(node.children, sectionKey, depth + 1)}
              </div>
            ) : null}
          </div>
        );
      }

      if (!node.to) return null;

      return (
        <NavLink
          key={itemKey}
          to={node.to}
          end={node.end}
          onClick={() => onClose?.()}
          title={collapsed ? label : undefined}
          className={nestedLinkClass}
        >
          {({ isActive }) => (
            <>
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                  isActive ? "bg-white" : "bg-slate-400 group-hover:bg-slate-200"
                }`}
                aria-hidden
              />
              {!collapsed && <span className="min-w-0 truncate">{label}</span>}
            </>
          )}
        </NavLink>
      );
    });

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[var(--color-nav-bg)] text-white">
      {typeof onToggleCollapse === "function" && !isMobile ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="app-sidebar__collapse-btn absolute z-20 hidden lg:flex items-center justify-center rounded-l-lg border border-white/35 border-r-0 bg-[var(--color-nav-bg-hover)] text-white shadow-md transition-colors hover:border-white/50 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-nav-bg)]"
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={`shrink-0 border-b border-white/10 ${collapsed ? "p-3" : "px-4 py-4 sm:py-5"} flex items-center justify-between`}>
        <Link
          to={
            storeMode
              ? "/inventory/dashboard"
              : salesMode
                ? SALES_DASHBOARD_PATH
                : productionMode
                  ? "/production/dashboard"
                  : qualityMode
                    ? QUALITY_CONTROL_DASHBOARD_NAV_PATH
                    : "/"
          }
          className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} min-w-0`}
          onClick={() => onClose?.()}
        >
          <BrandLogo size="md" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-lg font-bold tracking-tight">Insights Iva</p>
              <p className="text-xs leading-tight text-slate-400">
                {storeMode ? "Store Manager" : t("nav.tagline")}
              </p>
            </div>
          )}
        </Link>
        {isMobile ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
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
                <div className="mb-2 space-y-0.5 rounded-b-xl border border-t-0 border-white/15 bg-black/20 p-1.5 pt-1">
                  {section.nestedNav
                    ? renderNestedNav(section.children, section.key)
                    : section.children.map((child) => (
                        <NavLink
                          key={`${section.key}-${child.to}-${child.label || child.key}`}
                          to={child.to}
                          end={child.end}
                          onClick={() => onClose?.()}
                          className={childLinkClass}
                        >
                          {({ isActive }) => renderChildLabel(child, isActive)}
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
          <p className="text-center text-xs font-medium text-slate-300">
            {t("nav.footerTagline")}
          </p>
        </div>
      )}
      </div>

      <LogoutConfirmModal
        open={logoutOpen}
        busy={loggingOut}
        onCancel={() => {
          if (!loggingOut) setLogoutOpen(false);
        }}
        onConfirm={handleConfirmLogout}
      />
    </div>
  );
}
