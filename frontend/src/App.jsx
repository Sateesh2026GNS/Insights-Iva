import { Suspense, useState } from "react";
import { useLocation } from "react-router-dom";

import AppRoutes from "./routes/AppRoutes";
import RouteFallback from "./components/common/RouteFallback";
import Navbar from "./components/layout/Navbar";
import Sidebar from "./components/layout/Sidebar";
import AiChatWidget from "./components/ai/AiChatWidget";
import GlobalRefreshButton from "./components/common/GlobalRefreshButton";
import Button from "./components/common/Button";
import { isOperator } from "./config/permissions";
import useAuth from "./hooks/useAuth";
import { isAiCopilotEnabled, isOperatorAiRoute } from "./utils/aiCopilot";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const showChatbot = shouldShowChatbot(user, location.pathname);
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
  /** Full-bleed editors keep their own chrome; list/dashboard surfaces use Products page surface. */
  const isFullBleedSales = isInvoiceEditor || isSalesDocList || isEInvoiceLogin || normalizePath(location.pathname) === "/";

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
        <div data-page-refresh-root>
          <Suspense fallback={<RouteFallback />}>
            <AppRoutes />
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
      <Button
        as="a"
        href="#main-content"
        variant="primary"
        className="absolute left-4 top-4 z-[100] -translate-y-[200%] shadow-lg outline-none ring-2 ring-[var(--color-primary)]/40 ring-offset-2 transition-transform focus:translate-y-0 dark:ring-offset-slate-900"
      >
        Skip to main content
      </Button>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity ${sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`fixed left-0 top-0 z-50 h-full shrink-0 transform transition-[width,transform] duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          sidebarCollapsed ? "w-[72px] overflow-visible" : "w-60 overflow-hidden"
        } ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className={`min-h-0 min-w-0 w-full flex-1 bg-transparent outline-none ${
            isInvoiceEditor || isEInvoiceLogin
              ? "overflow-hidden"
              : "overflow-y-auto"
          }`}
        >
          {isFullBleedSales || isInvoiceEditor || isEInvoiceLogin || isSettings ? (
            <div
              className={`min-h-full ${isSettings ? "settings-page" : ""} ${
                isInvoiceEditor || isEInvoiceLogin ? "h-full min-h-0" : ""
              }`}
            >
              <Suspense fallback={<RouteFallback />}>
                <AppRoutes />
              </Suspense>
            </div>
          ) : (
            <div className="ui-page ui-stack min-w-0 w-full">
              <Suspense fallback={<RouteFallback />}>
                <AppRoutes />
              </Suspense>
            </div>
          )}
          {showChatbot && <AiChatWidget />}
        </main>
        {!isInvoiceEditor ? <GlobalRefreshButton offsetForChat={showChatbot} /> : null}
      </div>
    </div>
  );
}
