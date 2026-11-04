import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import AppRoutes from "./routes/AppRoutes";
import HrPlanningLayout from "./components/hr/HrPlanningLayout";
import RouteFallback from "./components/common/RouteFallback";
import NavigationProgressBar from "./components/common/NavigationProgressBar";
import NavigationLoadingOverlay from "./components/common/NavigationLoadingOverlay";
import PageTransition from "./components/common/PageTransition";
import RouteErrorBoundary from "./components/common/RouteErrorBoundary";
import Navbar from "./components/layout/Navbar";
import Sidebar from "./components/layout/Sidebar";
import GlobalRefreshButton from "./components/common/GlobalRefreshButton";
import AppShellBottomActionBar from "./components/layout/AppShellBottomActionBar";
import Button from "./components/common/Button";
import useAuth from "./hooks/useAuth";
import useBreakpoint from "./hooks/useBreakpoint";
import useSettings from "./context/SettingsContext";
import { isStoreManager } from "./config/permissions";
import { resolveErpAiAssistantMode, erpPageContextLabel } from "./utils/erpAiAssistant";
import { triggerServerWakeup, startServerKeepAlive, stopServerKeepAlive } from "./utils/serverWakeup";

const ErpAiAssistant = lazy(() => import("./components/ai/ErpAiAssistant"));

function normalizePath(pathname) {
  return (pathname || "/").replace(/\/+$/, "") || "/";
}

/** Routes that render without the ERP shell (sidebar + navbar). */
function isShellLessRoute(pathname) {
  const path = normalizePath(pathname);
  if (
    path === "/login" ||
    path === "/register" ||
    path === "/landing" ||
    path === "/forgot-password" ||
    path === "/reset-password" ||
    path === "/verify-email" ||
    path.startsWith("/e-quotation/")
  ) {
    return true;
  }
  if (path.startsWith("/gns-admin")) return true;
  return false;
}

function isSettingsRoute(pathname) {
  const path = normalizePath(pathname);
  return path === "/settings" || path.startsWith("/settings/");
}

/** Document library routes use an in-page refresh control instead of the global FAB. */
function isDocumentsLibraryRoute(pathname) {
  const path = normalizePath(pathname);
  if (path === "/hr/documents") return false;
  return path === "/documents" || path.startsWith("/documents/");
}

/** @deprecated use resolveErpAiAssistantMode from utils/erpAiAssistant */
export function shouldShowChatbot(user, pathname) {
  return resolveErpAiAssistantMode(user, pathname) === "shared";
}

/** @deprecated use resolveErpAiAssistantMode from utils/erpAiAssistant */
export function shouldShowStoreAgent(user, pathname) {
  return resolveErpAiAssistantMode(user, pathname) === "shared";
}

export default function App() {
  const location = useLocation();
  const { user } = useAuth();
  const { isLaptop, isDesktop } = useBreakpoint();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = window.localStorage.getItem("erp-sidebar-collapsed");
      if (saved !== null) return saved === "true";
    } catch {
      return window.innerWidth >= 1024 && window.innerWidth < 1440;
    }
    return window.innerWidth >= 1024 && window.innerWidth < 1440;
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [navItems, setNavItems] = useState([]);
  const isDesktopNav = isLaptop || isDesktop;
  const handleNavChange = useCallback((items) => setNavItems(items), []);

  useEffect(() => {
    if (isDesktopNav) setMobileSidebarOpen(false);
  }, [isDesktopNav]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // Close on Escape key
  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setMobileSidebarOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileSidebarOpen]);

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        window.localStorage.setItem("erp-sidebar-collapsed", String(next));
      } catch {
        // Keep the in-memory choice when browser storage is unavailable.
      }
      return next;
    });
  };

  // Silently warm up the backend and keep it alive in background
  useEffect(() => {
    triggerServerWakeup();
    startServerKeepAlive(8);
    return () => stopServerKeepAlive();
  }, []);

  const aiAssistantMode = resolveErpAiAssistantMode(user, location.pathname);
  const aiPageContext = erpPageContextLabel(location.pathname);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefetchKeyRoutes = () => {
      // Warm up most common route chunks in background so clicks feel instantaneous
      import("./pages/production/ProductionDashboard").catch(() => {});
      import("./pages/inventory/InventoryV2").catch(() => {});
      import("./pages/hr/HRDashboard").catch(() => {});
      import("./pages/hr/Leave").catch(() => {});
      import("./pages/hr/LeaveAdjustment").catch(() => {});
      import("./pages/accounts/AccountsDashboard").catch(() => {});
    };

    if ("requestIdleCallback" in window) {
      const handle = window.requestIdleCallback(prefetchKeyRoutes, { timeout: 3000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(prefetchKeyRoutes, 1500);
    return () => clearTimeout(timer);
  }, []);

  const { theme } = useSettings();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const isShellLess = isShellLessRoute(location.pathname);
    if (isShellLess) {
      document.documentElement.classList.remove("has-app-shell");
      document.body.classList.remove("has-app-shell");
    } else {
      document.documentElement.classList.add("has-app-shell");
      document.body.classList.add("has-app-shell");
    }

    const path = (location.pathname || "/").replace(/\/+$/, "") || "/";
    const isLogin =
      path === "/login" ||
      path === "/signin" ||
      path === "/gns-admin/login" ||
      path === "/super-admin/login" ||
      path === "/forgot-password" ||
      path === "/reset-password" ||
      path === "/verify-email" ||
      path === "/landing";

    if (isLogin) {
      document.documentElement.dataset.theme = "light";
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [location.pathname, theme]);
  const isInvoiceEditor =
    location.pathname === "/sales/invoices/create" ||
    /^\/sales\/invoices\/[^/]+\/edit$/.test(location.pathname) ||
    location.pathname === "/sales/quotations/create" ||
    /^\/sales\/quotations\/[^/]+\/edit$/.test(location.pathname) ||
    location.pathname === "/sales/payments/create" ||
    location.pathname === "/sales/payment-receipts/create" ||
    /^\/sales\/payment-receipts\/[^/]+\/edit$/.test(location.pathname) ||
    location.pathname === "/sales/proforma-invoices/create" ||
    /^\/sales\/proforma-invoices\/[^/]+\/edit$/.test(location.pathname) ||
    location.pathname === "/sales/export-proforma-invoices/create" ||
    /^\/sales\/export-proforma-invoices\/[^/]+\/edit$/.test(location.pathname) ||
    location.pathname === "/sales/export-invoices/create" ||
    /^\/sales\/export-invoices\/[^/]+\/edit$/.test(location.pathname) ||
    location.pathname === "/sales/delivery-challans/create" ||
    /^\/sales\/delivery-challans\/[^/]+\/edit$/.test(location.pathname) ||
    location.pathname === "/sales/credit-notes/create" ||
    /^\/sales\/credit-notes\/[^/]+\/edit$/.test(location.pathname) ||
    location.pathname === "/sales/debit-notes/create" ||
    /^\/sales\/debit-notes\/[^/]+\/edit$/.test(location.pathname) ||
    location.pathname === "/purchases/create" ||
    /^\/purchases\/[^/]+\/edit$/.test(location.pathname) ||
    location.pathname === "/purchases/payments-made/create" ||
    /^\/purchases\/payments-made\/[^/]+\/edit$/.test(location.pathname) ||
    location.pathname === "/purchases/debit-notes/create" ||
    /^\/purchases\/debit-notes\/[^/]+\/edit$/.test(location.pathname) ||
    location.pathname === "/procurement/purchase-orders/create" ||
    /^\/procurement\/purchase-orders\/[^/]+\/edit$/.test(location.pathname) ||
    /^\/sales\/invoices\/[^/]+\/copy$/.test(location.pathname);
  const isSalesDocList =
    location.pathname === "/sales/invoices" ||
    location.pathname === "/sales/quotations" ||
    location.pathname === "/sales/payment-receipts" ||
    location.pathname === "/sales/refund-vouchers" ||
    location.pathname === "/sales/proforma-invoices" ||
    location.pathname === "/sales/export-proforma-invoices" ||
    location.pathname === "/sales/export-invoices" ||
    location.pathname === "/sales/delivery-challans" ||
    location.pathname === "/sales/credit-notes" ||
    location.pathname === "/sales/debit-notes" ||
    location.pathname === "/purchases" ||
    location.pathname === "/purchases/payments-made" ||
    location.pathname === "/purchases/debit-notes" ||
    location.pathname === "/procurement/purchase-orders" ||
    location.pathname === "/inventory" ||
    location.pathname.startsWith("/inventory/items/") ||
    location.pathname === "/inventory/settings" ||
    location.pathname === "/inventory/godown-planner" ||
    location.pathname === "/inventory/unit-converter" ||
    location.pathname === "/inventory/eoq-helper" ||
    location.pathname === "/inventory/stock-valuation" ||
    location.pathname === "/inventory/hamali-cost" ||
    location.pathname === "/inventory/truck-load" ||
    location.pathname === "/inventory/damage-loss" ||
    location.pathname === "/inventory/storage-quotation" ||
    location.pathname === "/inventory/gate-pass" ||
    location.pathname === "/inventory/godown-dashboard" ||
    location.pathname === "/settings/change-template" ||
    location.pathname === "/settings/template-settings" ||
    location.pathname === "/settings/invoice-template" ||
    location.pathname === "/settings/quotation-template" ||
    location.pathname === "/settings/purchase-template" ||
    location.pathname === "/settings/change-format" ||
    location.pathname === "/settings/format-settings" ||
    location.pathname === "/settings/invoice-settings" ||
    location.pathname === "/settings/opening-balances" ||
    location.pathname === "/inventory/items/create" ||
    location.pathname === "/masters/products" ||
    location.pathname.startsWith("/masters/products/") ||
    location.pathname === "/products" ||
    location.pathname.startsWith("/products/") ||
    location.pathname === "/master/products" ||
    location.pathname.startsWith("/master/products/") ||
    location.pathname === "/accounts/ledger" ||
    location.pathname.startsWith("/accounts/ledger/") ||
    location.pathname === "/accounts/expenses" ||
    location.pathname.startsWith("/accounts/expenses/") ||
    location.pathname === "/accounts/chart-of-accounts" ||
    location.pathname.startsWith("/accounts/chart-of-accounts/") ||
    location.pathname === "/accounts/journal-entries" ||
    location.pathname.startsWith("/accounts/journal-entries/") ||
    location.pathname === "/accounts/balance-sheet" ||
    location.pathname === "/accounts/profit-loss" ||
    location.pathname === "/accounts/gst" ||
    location.pathname === "/accounts/restore-deleted" ||
    location.pathname === "/accounts/restore-deleted-docs" ||
    location.pathname === "/accounts/reports" ||
    location.pathname.startsWith("/accounts/reports/") ||
    location.pathname === "/reports" ||
    location.pathname.startsWith("/reports/") ||
    location.pathname === "/ledger" ||
    location.pathname.startsWith("/ledger/");
  const isSettings = isSettingsRoute(location.pathname);
  const isDocumentsLibrary = isDocumentsLibraryRoute(location.pathname);
  const isEInvoiceLogin = location.pathname === "/sales/e-invoice";
  const path = normalizePath(location.pathname);
  const isStoreManagerProductPage =
    isStoreManager(user) &&
    (path === "/products" ||
      path.startsWith("/products/") ||
      path === "/masters/products" ||
      path.startsWith("/masters/products/") ||
      path === "/master/products" ||
      path.startsWith("/master/products/"));
  const isJobCardAuthoring =
    path === "/sales/job-cards/create" || /^\/sales\/job-cards\/[^/]+\/edit$/.test(path);
  const isCustomerForm =
    path === "/sales/customers/create" || /^\/sales\/customers\/[^/]+\/edit$/.test(path);
  const isJobCardsWorkspace =
    path === "/my-job-cards" || path.startsWith("/my-job-cards/") || isJobCardAuthoring;
  /** Full-bleed editors keep their own chrome; list/dashboard surfaces use Products page surface. */
  const isFullBleedSales =
    isInvoiceEditor || isSalesDocList || isEInvoiceLogin || path === "/" || isJobCardsWorkspace || isCustomerForm;
  const isHrModule = path === "/hr" || path.startsWith("/hr/");

  if (isShellLessRoute(location.pathname)) {
    const path = normalizePath(location.pathname);
    const isAdminShell = path.startsWith("/gns-admin");
    const isAuthShell =
      path === "/login" ||
      path === "/register" ||
      path === "/landing" ||
      path === "/forgot-password" ||
      path === "/reset-password" ||
      path === "/verify-email" ||
      path === "/gns-admin/login" ||
      path === "/gns-admin/verify-otp";
    const showRefresh = !isAuthShell && (isAdminShell || path === "/settings" || path.startsWith("/settings/"));
    return (
      <div className={`min-h-screen ${isAdminShell ? "" : "bg-[var(--color-bg)]"}`}>
        <NavigationProgressBar />
        <NavigationLoadingOverlay />
        <div data-page-refresh-root>
          <Suspense fallback={<RouteFallback />}>
            <PageTransition>
              <AppRoutes />
            </PageTransition>
          </Suspense>
        </div>
        {showRefresh ? <GlobalRefreshButton /> : null}
      </div>
    );
  }

  return (
    <div
      className={`app-shell relative grid h-screen overflow-hidden dark:bg-slate-950 ${
        isDesktopNav
          ? isLaptop && sidebarCollapsed
            ? "grid-cols-[4.5rem_minmax(0,1fr)]"
            : "grid-cols-[16.25rem_minmax(0,1fr)]"
          : "grid-cols-[minmax(0,1fr)]"
      }`}
      data-sidebar-collapsed={isLaptop && sidebarCollapsed ? "true" : "false"}
    >
      <NavigationProgressBar />
      <NavigationLoadingOverlay />
      <Button
        as="a"
        href="#main-content"
        variant="primary"
        className="absolute left-4 top-4 z-[100] min-h-[44px] -translate-y-[200%] shadow-lg outline-none ring-2 ring-[var(--color-primary)]/40 ring-offset-2 transition-transform focus:translate-y-0 dark:ring-offset-slate-900"
      >
        Skip to main content
      </Button>
      {/* Mobile Drawer Backdrop */}
      {mobileSidebarOpen && (
        <div
     className="fixed inset-0 z-[70] transition-opacity lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {!isDesktopNav && mobileSidebarOpen ? (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/45 transition-opacity"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}
      <aside
        id="app-sidebar"
        className={`flex h-full min-h-0 shrink-0 flex-col overflow-visible transition-[width,transform] duration-300 ease-in-out ${
          isDesktopNav
            ? `relative z-40 ${isLaptop && sidebarCollapsed ? "w-[72px]" : "w-[260px]"}`
            : `fixed inset-y-0 left-0 z-[75] w-[280px] max-w-[85vw] shadow-2xl ${
                mobileSidebarOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
              }`
        }`}
        role={!isDesktopNav && mobileSidebarOpen ? "dialog" : undefined}
        aria-modal={!isDesktopNav && mobileSidebarOpen ? "true" : undefined}
        aria-label={!isDesktopNav && mobileSidebarOpen ? "Navigation Menu" : undefined}
        aria-hidden={!isDesktopNav && !mobileSidebarOpen}
        inert={!isDesktopNav && !mobileSidebarOpen ? "" : undefined}
      >
        <Sidebar
          collapsed={isLaptop && sidebarCollapsed}
          onToggleCollapse={isLaptop ? toggleSidebar : undefined}
          onClose={() => setMobileSidebarOpen(false)}
          onNavChange={handleNavChange}
          isMobile={!isDesktopNav}
        />
      </aside>
      <div className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden">
        <main
          id="main-content"
          tabIndex={-1}
          style={{
            overscrollBehavior: "contain",
            overscrollBehaviorX: "none",
            overscrollBehaviorY: "contain",
          }}
          className={`flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-hidden bg-transparent outline-none overscroll-contain max-sm:pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] ${
            isInvoiceEditor || isEInvoiceLogin
              ? "overflow-hidden max-lg:pb-0"
              : "overflow-y-auto"
          }`}
        >
          <div className="sticky top-0 z-[60] shrink-0">
            <Navbar
              onOpenSidebar={!isDesktopNav ? () => setMobileSidebarOpen(true) : undefined}
              onToggleSidebar={isLaptop ? toggleSidebar : undefined}
              sidebarCollapsed={isLaptop && sidebarCollapsed}
            />
          </div>
          <div
            className={
              isInvoiceEditor || isEInvoiceLogin || isFullBleedSales
                ? `flex min-h-0 flex-1 flex-col ${isStoreManagerProductPage ? "pt-5" : ""}`
                : isSettings
                  ? `settings-page min-h-0 flex-1 ${isStoreManager(user) ? "pt-5" : ""}`
                  : isHrModule
                ? "hr-plan-slot min-h-0 min-w-0 w-full flex-1"
                : "ui-page ui-stack min-w-0 w-full"
            }
          >
            <Suspense
              fallback={
                <RouteFallback
                  isFullBleed={isFullBleedSales || isInvoiceEditor || isEInvoiceLogin}
                />
              }
            >
              <RouteErrorBoundary>
                <PageTransition fillViewport={isInvoiceEditor || isEInvoiceLogin}>
                  {isHrModule ? (
                    <HrPlanningLayout>
                      <AppRoutes />
                    </HrPlanningLayout>
                  ) : (
                    <AppRoutes />
                  )}
                </PageTransition>
              </RouteErrorBoundary>
            </Suspense>
          </div>
        </main>
        {user && !isInvoiceEditor && !isEInvoiceLogin ? <AppShellBottomActionBar navItems={navItems} /> : null}
        {!isInvoiceEditor ? (
          <div
            className={`app-shell-fab-stack pointer-events-none fixed bottom-5 z-50 flex flex-col items-end gap-3 pb-[env(safe-area-inset-bottom,0px)] sm:bottom-6 max-lg:bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] ${
              isSettings
                ? "bottom-28 sm:bottom-28 lg:bottom-28 max-lg:bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-[var(--space-4)] sm:right-[var(--space-6)] lg:right-[var(--space-8)]"
                : "right-5 sm:right-6"
            }`}
          >
            {aiAssistantMode ? (
              <Suspense fallback={null}>
                <ErpAiAssistant
                  mode={aiAssistantMode}
                  pageContextLabel={aiPageContext}
                  floatingStacked
                />
              </Suspense>
            ) : null}
            {!isDocumentsLibrary ? <GlobalRefreshButton stacked /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
