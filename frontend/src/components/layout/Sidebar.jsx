import { useEffect, useMemo, useRef, useState } from "react";
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
  PhoneCall,
  Zap,
  X,
} from "lucide-react";

import BrandLogo from "../common/BrandLogo";
import LogoutConfirmModal from "../common/LogoutConfirmModal";
import GlobalCreateMenu from "../common/GlobalCreateMenu";
import { getGlobalCreateActionsForUser } from "../../config/globalCreateActions";
import useAuth from "../../hooks/useAuth";
import { getSidebarMenus } from "../../api/authApi";
import {
  userCanAccess,
  userCanAccessMyJobCards,
  userCanAccessApprovalQueue,
  userCanAccessPath,
  userCanViewBom,
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
import {
  SIDEBAR_NAV,
  sectionHasActiveChild,
  filterNavTree,
  buildNestedExpanded,
  navNodeIsActive,
  isSidebarLinkActive,
} from "../../config/sidebarNav";

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
import { prefetchRouteChunk } from "../../utils/routePrefetch";

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
          activeMatch: c.activeMatch,
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
      const sectionModule =
        item.module || (item.key === "masters" ? "masters" : item.key === "purchases" ? "procurement" : "inventory");
      return {
        key: item.key,
        label: item.label,
        icon: item.icon,
        module: sectionModule,
        children: item.children.map((c) => ({
          key: c.key,
          label: c.label,
          to: c.to,
          module: c.module || sectionModule,
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
      if (section.key === "myJobCards") {
        if (!userCanAccessMyJobCards(user)) return null;
        return section;
      }
      if (!isOp && section.operatorOnly) return null;
      if (!userCanAccess(user, section.module)) return null;
      if (storeMgr && !storeManagerPathAllowed(section.to)) return null;
      return section;
    }
    let children = filterNavTree(section.children, (node) => {
      const pathOnly = (node.to || "").split("?")[0];
      if (isPM && node.to && !PRODUCTION_MANAGER_ALLOWED_CHILDREN.has(node.to) && !PRODUCTION_MANAGER_ALLOWED_CHILDREN.has(pathOnly)) {
        return false;
      }
      if (isAcct && section.key === "alerts" && node.to) {
        if (!ACCOUNTANT_ALLOWED_CHILDREN.has(node.to) && !ACCOUNTANT_ALLOWED_CHILDREN.has(pathOnly)) return false;
      }
      if (section.key === "analytics" && node.to) {
        if (!userCanAccessPath(user, pathOnly || node.to)) return false;
      }
      if (isOp) {
        if (node.managerOnly) return false;
        if (node.to && (OPERATOR_BLOCKED_CHILDREN.has(node.to) || OPERATOR_BLOCKED_CHILDREN.has(pathOnly))) return false;
        if (section.key === "production" && node.to && !node.operatorOnly) {
          if (!OPERATOR_ALLOWED_CHILDREN.has(node.to) && !OPERATOR_ALLOWED_CHILDREN.has(pathOnly)) return false;
        }
      }
      if (!isOp && node.operatorOnly) return false;
      if (node.bomViewOnly && !userCanViewBom(user)) return false;
      if (isAcct && section.key === "production" && node.to) {
        const pathOnly = (node.to || "").split("?")[0];
        if (!ACCOUNTANT_ALLOWED_CHILDREN.has(node.to) && !ACCOUNTANT_ALLOWED_CHILDREN.has(pathOnly)) return false;
      }
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

function buildInitialExpanded(location, nav) {
  const state = {};
  nav.forEach((section) => {
    if (section.children && sectionHasActiveChild(location, section)) {
      state[section.key] = true;
    }
    if (section.nestedNav && section.children?.length) {
      buildNestedExpanded(location, section.children, section.key, state);
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
  const [createOpen, setCreateOpen] = useState(false);
  const createButtonRef = useRef(null);
  const createCloseTimerRef = useRef(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const storeMode = isStoreManager(user);
  const salesMode = isSalesManager(user);
  const productionMode = isProductionManager(user);
  const qualityMode = isQualityTeam(user);

  const cancelCreateClose = () => {
    if (createCloseTimerRef.current) {
      clearTimeout(createCloseTimerRef.current);
      createCloseTimerRef.current = null;
    }
  };
  const scheduleCreateClose = () => {
    cancelCreateClose();
    createCloseTimerRef.current = setTimeout(() => setCreateOpen(false), 160);
  };

  useEffect(() => {
    setCreateOpen(false);
  }, [location.pathname]);

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
              const pathOnly = (c.to || "").split("?")[0];
              if (section.key === "alerts") {
                return ACCOUNTANT_ALLOWED_CHILDREN.has(c.to) || ACCOUNTANT_ALLOWED_CHILDREN.has(pathOnly);
              }
              if (section.key === "analytics") {
                return userCanAccessPath(user, pathOnly || c.to);
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
    const roleNav = dedupeNavSections(result).map((section) => {
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
    return [
      ...roleNav,
      { key: "contactUs", label: "Contact Us", to: "/contact", icon: PhoneCall, end: true },
    ];
  }, [apiNav, user, storeMode, salesMode]);

  const createActions = useMemo(
    () => getGlobalCreateActionsForUser(user, visibleNav),
    [user, visibleNav]
  );

  const [expanded, setExpanded] = useState(() => buildInitialExpanded(location, visibleNav));

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      visibleNav.forEach((section) => {
        if (section.children && sectionHasActiveChild(location, section)) {
          next[section.key] = true;
        }
        if (section.nestedNav && section.children?.length) {
          buildNestedExpanded(location, section.children, section.key, next);
        }
      });
      return next;
    });
  }, [location.pathname, location.search, visibleNav]);

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
    `relative flex items-center gap-2.5 rounded-lg py-2.5 min-h-[42px] text-sm font-normal transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 ${navItemPad} ${
      isActive
        ? "bg-[var(--color-nav-active)] font-medium text-white"
        : "text-slate-300 hover:bg-white/10 hover:text-white"
    }`;

  const childLinkClass = ({ isActive }) =>
    `group relative flex w-full items-center gap-2 rounded-md px-2.5 py-2 min-h-[38px] text-[13px] leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 ${
      isActive
        ? "bg-[var(--color-nav-active)] font-medium text-white shadow-sm"
        : "font-normal text-slate-300 hover:bg-white/10 hover:text-white"
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

  const nestedLinkClass = ({ isActive }) => {
    return `group relative flex w-full min-w-0 items-center gap-2.5 rounded-md px-2.5 py-2 min-h-[38px] text-[13px] leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 ${
      collapsed ? "justify-center px-2" : ""
    } ${
      isActive
        ? "bg-[var(--color-nav-active)] font-medium text-white shadow-sm"
        : "font-normal text-slate-300 hover:bg-white/10 hover:text-white"
    }`;
  };

  const submenuContainerClass = () => {
    return "mb-1 space-y-0.5 overflow-x-hidden rounded-b-lg border border-t-0 border-white/10 bg-black/15 p-1.5";
  };

  const submenuPanelClass =
    "mb-1 space-y-0.5 overflow-x-hidden rounded-b-xl border border-t-0 border-white/10 bg-black/15 p-1.5";

  const linkIsActive = (node) => () => isSidebarLinkActive(location, node);

  const nestedGroupClass = (isOpen, hasActive) =>
    `relative flex w-full min-w-0 items-center text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 ${
      collapsed ? "justify-center px-2 py-2 rounded-lg" : "justify-between gap-2 px-3 py-2 min-h-[38px]"
    } ${
      isOpen
        ? "rounded-t-lg rounded-b-none bg-white/12 text-white"
        : hasActive
        ? "rounded-lg bg-[var(--color-nav-active)] text-white"
        : "rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
    }`;

  const sectionButtonClass = (isOpen, hasActive) =>
    `relative flex w-full min-w-0 items-center text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 ${navItemPad} ${
      collapsed ? "justify-center rounded-xl py-2.5" : "justify-between gap-2 py-2.5 min-h-[42px]"
    } ${
      isOpen
        ? "rounded-t-xl rounded-b-none bg-white/12 text-white"
        : hasActive
        ? "rounded-xl bg-[var(--color-nav-active)] text-white"
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
        const hasActive = navNodeIsActive(location, node);
        return (
          <div key={itemKey} className="space-y-0.5">
            <button
              type="button"
              onClick={() => toggleSection(itemKey)}
              className={nestedGroupClass(isOpen, hasActive)}
              aria-expanded={isOpen}
              title={collapsed ? label : undefined}
            >
              <span className={`flex min-w-0 flex-1 items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                {!collapsed && <span className="truncate text-left">{label}</span>}
              </span>
              {!collapsed && (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  ) : (
                    <ChevronRight className="h-4 w-4 opacity-70" />
                  )}
                </span>
              )}
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
          isActive={linkIsActive(node)}
          onMouseEnter={() => prefetchRouteChunk(node.to)}
          onFocus={() => prefetchRouteChunk(node.to)}
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

  const renderFlyoutNestedNav = (nodes, sectionKey) =>
    (nodes || []).map((node) => {
      const itemKey = `flyout-${sectionKey}:${node.key || node.label}`;
      const label = childLabel(node);

      if (node.children?.length) {
        return (
          <div key={itemKey} className="pt-2 pb-0.5">
            <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {label}
            </div>
            <div className="space-y-0.5">
              {renderFlyoutNestedNav(node.children, sectionKey)}
            </div>
          </div>
        );
      }

      if (!node.to) return null;

      return (
        <NavLink
          key={itemKey}
          to={node.to}
          end={node.end}
          isActive={linkIsActive(node)}
          onMouseEnter={() => prefetchRouteChunk(node.to)}
          onFocus={() => prefetchRouteChunk(node.to)}
          onClick={() => onClose?.()}
          className={({ isActive }) =>
            `flex items-center justify-between rounded-lg px-3 py-2 min-h-[38px] text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 ${
              isActive
                ? "bg-slate-100 font-medium text-[var(--color-primary,#3157d5)] dark:bg-slate-800 dark:text-indigo-400"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className="truncate">{label}</span>
              {isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary,#3157d5)]" />
              )}
            </>
          )}
        </NavLink>
      );
    });

  return (
    <div className={`relative flex h-full min-h-0 w-full flex-col bg-[var(--color-nav-bg)] text-white ${collapsed ? "overflow-visible" : ""}`}>
      {typeof onToggleCollapse === "function" && !isMobile ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`app-sidebar__collapse-btn absolute z-20 hidden lg:flex items-center justify-center border border-white/35 bg-[var(--color-nav-bg-hover)] text-white shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-nav-bg)] ${
            collapsed ? "rounded-r-lg border-l-0" : "rounded-l-lg border-r-0"
          }`}
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
      <div className={`flex min-h-0 flex-1 flex-col ${collapsed ? "overflow-visible" : "overflow-hidden"}`}>
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

      <nav className={`sidebar-scroll flex-1 space-y-0.5 py-4 ${collapsed ? "px-2 overflow-visible" : "overflow-x-hidden overflow-y-auto px-3"}`}>
        {createActions.length > 0 && (
          <button
            ref={createButtonRef}
            type="button"
            onClick={() => setCreateOpen((open) => !open)}
            onMouseEnter={() => {
              cancelCreateClose();
              if (collapsed) setCreateOpen(true);
            }}
            onMouseLeave={scheduleCreateClose}
            className={`mb-3 flex min-h-11 w-full items-center rounded-xl bg-[var(--color-nav-active)] px-3 text-sm font-bold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-nav-bg)] ${collapsed ? "justify-center" : "justify-center gap-2.5"}`}
            aria-label="Create"
            aria-expanded={createOpen}
            aria-haspopup="menu"
            title={collapsed ? "Create" : undefined}
          >
            <Zap className="h-5 w-5 fill-current" strokeWidth={2} aria-hidden />
            {!collapsed && <span>Create</span>}
          </button>
        )}
        {visibleNav.map((section, sectionIdx) => {
          const isLowerHalf = sectionIdx > 4;

          if (section.action === "logout") {
            const Icon = section.icon || LayoutDashboard;
            const label = section.label;
            return (
              <div key={section.key} className="relative group/nav-flyout">
                <button
                  type="button"
                  title={collapsed ? label : undefined}
                  onClick={() => setLogoutOpen(true)}
                  className={actionButtonClass}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  {!collapsed && <span className="truncate">{label}</span>}
                </button>

                {collapsed && (
                  <div
                    className={`pointer-events-none absolute left-full ${
                      isLowerHalf ? "bottom-0" : "top-0"
                    } pl-3 z-[100] opacity-0 invisible group-hover/nav-flyout:pointer-events-auto group-hover/nav-flyout:opacity-100 group-hover/nav-flyout:visible transition-all duration-150 ease-out translate-x-1 group-hover/nav-flyout:translate-x-0`}
                  >
                    <div className="w-52 rounded-2xl bg-white text-slate-800 shadow-2xl border border-slate-200/90 p-2 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setLogoutOpen(true)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-red-500" strokeWidth={2} />
                        <span className="truncate">{label}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          if (section.to) {
            const Icon = section.icon || LayoutDashboard;
            const label = sectionLabel(section);
            return (
              <div key={section.key} className="relative group/nav-flyout">
                <NavLink
                  to={section.to}
                  end={section.end}
                  isActive={linkIsActive(section)}
                  onMouseEnter={() => prefetchRouteChunk(section.to)}
                  onFocus={() => prefetchRouteChunk(section.to)}
                  onClick={() => onClose?.()}
                  title={collapsed ? label : undefined}
                  className={topLinkClass}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>

                {collapsed && (
                  <div
                    className={`pointer-events-none absolute left-full ${
                      isLowerHalf ? "bottom-0" : "top-0"
                    } pl-3 z-[100] opacity-0 invisible group-hover/nav-flyout:pointer-events-auto group-hover/nav-flyout:opacity-100 group-hover/nav-flyout:visible transition-all duration-150 ease-out translate-x-1 group-hover/nav-flyout:translate-x-0`}
                  >
                    <div className="w-56 rounded-2xl bg-white text-slate-800 shadow-2xl border border-slate-200/90 p-2 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800">
                      <NavLink
                        to={section.to}
                        end={section.end}
                        isActive={linkIsActive(section)}
                        onMouseEnter={() => prefetchRouteChunk(section.to)}
                        onFocus={() => prefetchRouteChunk(section.to)}
                        onClick={() => onClose?.()}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                            isActive
                              ? "bg-slate-100 text-[var(--color-primary,#3157d5)] dark:bg-slate-800 dark:text-indigo-400"
                              : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                          }`
                        }
                      >
                        <Icon className="h-4 w-4 shrink-0 text-[var(--color-primary,#3157d5)]" strokeWidth={2} />
                        <span className="truncate">{label}</span>
                      </NavLink>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          const Icon = section.icon || LayoutDashboard;
          const isOpen = expanded[section.key];
          const hasActive = sectionHasActiveChild(location, section);
          const label = sectionLabel(section);

          return (
            <div key={section.key} className="relative group/nav-flyout space-y-0.5">
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
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                    {isOpen ? <ChevronDown className="h-4 w-4 opacity-70" /> : <ChevronRight className="h-4 w-4 opacity-70" />}
                  </span>
                )}
              </button>
              {!collapsed && isOpen && (
                <div className={submenuPanelClass}>
                  {section.nestedNav
                    ? renderNestedNav(section.children, section.key)
                    : section.children.map((child) => (
                        <NavLink
                          key={`${section.key}-${child.to}-${child.label || child.key}`}
                          to={child.to}
                          end={child.end}
                          isActive={linkIsActive(child)}
                          onMouseEnter={() => prefetchRouteChunk(child.to)}
                          onFocus={() => prefetchRouteChunk(child.to)}
                          onClick={() => onClose?.()}
                          className={childLinkClass}
                        >
                          {({ isActive }) => renderChildLabel(child, isActive)}
                        </NavLink>
                      ))}
                </div>
              )}

              {collapsed && section.children?.length > 0 && (
                <div
                  className={`pointer-events-none absolute left-full ${
                    isLowerHalf ? "bottom-0" : "top-0"
                  } pl-3 z-[100] opacity-0 invisible group-hover/nav-flyout:pointer-events-auto group-hover/nav-flyout:opacity-100 group-hover/nav-flyout:visible transition-all duration-150 ease-out translate-x-1 group-hover/nav-flyout:translate-x-0`}
                >
                  <div className="w-60 min-w-[210px] max-w-[280px] max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl bg-white text-slate-800 shadow-2xl border border-slate-200/90 p-2.5 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800">
                    <div className="px-3 py-2 mb-1.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-[var(--color-primary,#3157d5)]" strokeWidth={2} />
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {label}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      {section.nestedNav
                        ? renderFlyoutNestedNav(section.children, section.key)
                        : section.children.map((child) => {
                            const cLabel = childLabel(child);
                            return (
                              <NavLink
                                key={`flyout-${section.key}-${child.to}-${child.label || child.key}`}
                                to={child.to}
                                end={child.end}
                                isActive={linkIsActive(child)}
                                onMouseEnter={() => prefetchRouteChunk(child.to)}
                                onFocus={() => prefetchRouteChunk(child.to)}
                                onClick={() => onClose?.()}
                                className={({ isActive }) =>
                                  `group/flyout-item flex items-center justify-between rounded-lg px-3 py-2 text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 ${
                                    isActive
                                      ? "bg-slate-100 font-medium text-[var(--color-primary,#3157d5)] dark:bg-slate-800/90 dark:text-indigo-400"
                                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                                  }`
                                }
                              >
                                {({ isActive }) => (
                                  <>
                                    <span className="truncate">{cLabel}</span>
                                    {isActive && (
                                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary,#3157d5)]" />
                                    )}
                                  </>
                                )}
                              </NavLink>
                            );
                          })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <GlobalCreateMenu
        open={createOpen}
        onOpenChange={setCreateOpen}
        onPointerEnter={cancelCreateClose}
        onPointerLeave={scheduleCreateClose}
        anchorRef={createButtonRef}
        palette
        navSections={visibleNav}
        onSelect={() => onClose?.()}
      />

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
