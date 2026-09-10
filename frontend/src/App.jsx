import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import AppRoutes from "./routes/AppRoutes";
import RouteFallback from "./components/common/RouteFallback";
import NavigationProgressBar from "./components/common/NavigationProgressBar";
import NavigationLoadingOverlay from "./components/common/NavigationLoadingOverlay";
import PageTransition from "./components/common/PageTransition";
import Navbar from "./components/layout/Navbar";
import Sidebar from "./components/layout/Sidebar";
import GlobalRefreshButton from "./components/common/GlobalRefreshButton";
import Button from "./components/common/Button";
import { isOperator } from "./config/permissions";
import useAuth from "./hooks/useAuth";
import { isAiCopilotEnabled, isOperatorAiRoute } from "./utils/aiCopilot";
import { triggerServerWakeup, registerWakeupCallbacks } from "./utils/serverWakeup";


const AiChatWidget = lazy(() => import("./components/ai/AiChatWidget"));

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
    path === "/verify-email"
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

export function shouldShowChatbot(user, pathname) {
  if (!user || !isOperator(user)) return false;
  if (!isAiCopilotEnabled()) return false;
  const path = normalizePath(pathname);
  if (
    path === "/login" ||
    path === "/register" ||
    path === "/landing" ||
    path === "/forgot-password" ||
    path === "/reset-password" ||
    path === "/verify-email"
  ) {
    return false;
  }
  if (path.startsWith("/gns-admin")) return false;
  if (path.startsWith("/settings")) return false;
  return isOperatorAiRoute(pathname);
}

export default function App() {
  const location = useLocation();
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  });
  const [connectingMsg, setConnectingMsg] = useState("");

  // Warm up the backend on first app load (Render free tier sleeps after inactivity)
  useEffect(() => {
    registerWakeupCallbacks(
      (msg) => setConnectingMsg(msg),   // show "Connecting…" banner
      () => setConnectingMsg(""),        // hide it once server responds
    );
    triggerServerWakeup();
    // Auto-hide banner after 90 s regardless (backend may not have /health)
    const timer = setTimeout(() => setConnectingMsg(""), 90_000);
    return () => clearTimeout(timer);
  }, []);

  const showChatbot = shouldShowChatbot(user, location.pathname);

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
  }, [location.pathname]);
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
    location.pathname === "/settings/change-template" ||
    location.pathname === "/settings/template-settings" ||
    location.pathname === "/settings/invoice-template" ||
    location.pathname === "/settings/quotation-template" ||
    location.pathname === "/settings/purchase-template" ||
    location.pathname === "/settings/change-format" ||
    location.pathname === "/settings/format-settings" ||
    location.pathname === "/settings/invoice-settings" ||
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
    location.pathname === "/accounts/restore-deleted" ||
    location.pathname === "/accounts/restore-deleted-docs" ||
    location.pathname === "/accounts/reports" ||
    location.pathname.startsWith("/accounts/reports/") ||
    location.pathname === "/reports" ||
    location.pathname.startsWith("/reports/") ||
    location.pathname === "/ledger" ||
    location.pathname.startsWith("/ledger/");
  const isSettings = isSettingsRoute(location.pathname);
  const isEInvoiceLogin = location.pathname === "/sales/e-invoice";
  const path = normalizePath(location.pathname);
  const isJobCardAuthoring =
    path === "/sales/job-cards/create" || /^\/sales\/job-cards\/[^/]+\/edit$/.test(path);
  const isJobCardsWorkspace =
    path === "/my-job-cards" || path.startsWith("/my-job-cards/") || isJobCardAuthoring;
  /** Full-bleed editors keep their own chrome; list/dashboard surfaces use Products page surface. */
  const isFullBleedSales =
    isInvoiceEditor || isSalesDocList || isEInvoiceLogin || path === "/" || isJobCardsWorkspace;

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
      className="app-shell relative flex h-screen overflow-hidden dark:bg-slate-950"
      data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
    >
      <NavigationProgressBar />
      <NavigationLoadingOverlay />
      {connectingMsg && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "#fef3c7",
            borderBottom: "1px solid #fbbf24",
            color: "#92400e",
            fontSize: "13px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "6px 16px",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 14,
              border: "2px solid #d97706",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.75s linear infinite",
            }}
          />
          {connectingMsg}
          <button
            onClick={() => setConnectingMsg("")}
            style={{
              marginLeft: 12,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#92400e",
              fontWeight: 700,
              fontSize: 16,
              lineHeight: 1,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <Button
        as="a"
        href="#main-content"
        variant="primary"
        className="absolute left-4 top-4 z-[100] -translate-y-[200%] shadow-lg outline-none ring-2 ring-[var(--color-primary)]/40 ring-offset-2 transition-transform focus:translate-y-0 dark:ring-offset-slate-900"
      >
        Skip to main content
      </Button>
      <aside
        id="app-sidebar"
        className={`relative z-50 h-full shrink-0 transition-[width] duration-300 ease-in-out ${
          sidebarCollapsed ? "w-[72px] overflow-visible" : "w-60 overflow-visible"
        }`}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />
      </aside>
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
        <Navbar />
        <main
          id="main-content"
          tabIndex={-1}
          style={{
            overscrollBehavior: "contain",
            overscrollBehaviorX: "none",
            overscrollBehaviorY: "contain",
          }}
          className={`min-h-0 min-w-0 w-full flex-1 bg-transparent outline-none overscroll-contain ${
            isInvoiceEditor || isEInvoiceLogin
              ? "overflow-hidden"
              : "overflow-y-auto"
          }`}
        >
          <div
            className={
              isFullBleedSales || isInvoiceEditor || isEInvoiceLogin || isSettings
                ? `min-h-full ${isSettings ? "settings-page" : ""} ${
                    isInvoiceEditor || isEInvoiceLogin ? "flex h-full min-h-0 flex-col" : ""
                  }`
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
              <PageTransition fillViewport={isInvoiceEditor || isEInvoiceLogin}>
                <AppRoutes />
              </PageTransition>
            </Suspense>
          </div>
          {showChatbot ? (
            <Suspense fallback={null}>
              <AiChatWidget />
            </Suspense>
          ) : null}
        </main>
        {!isInvoiceEditor ? <GlobalRefreshButton offsetForChat={showChatbot} /> : null}
      </div>
    </div>
  );
}
