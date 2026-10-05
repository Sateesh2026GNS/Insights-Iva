/**
 * Preload lazy route chunks for faster post-login and sidebar navigation.
 * Maps canonical paths to the same dynamic imports used in lazyPages.jsx.
 */

const PATH_LOADERS = {
  "/": () => import("../pages/dashboard/Dashboard"),
  "/dashboard": () => import("../pages/dashboard/Dashboard"),
  "/inventory/dashboard": () => import("../pages/inventory/InventoryDashboard"),
  "/sales": () => import("../pages/sales/SalesDashboard"),
  "/sales/dashboard": () => import("../pages/sales/SalesDashboard"),
  "/production/dashboard": () => import("../pages/production/ProductionDashboard"),
  "/accounts/dashboard": () => import("../pages/accounts/AccountsDashboard"),
  "/hr": () => import("../pages/hr/HRDashboard"),
  "/my-job-cards": () => import("../pages/manufacturing/MyJobCardsPage"),
  "/procurement/purchase-orders": () => import("../pages/procurement/PurchaseOrders"),
  "/inventory": () => import("../pages/inventory/InventoryV2"),
  "/inventory/low-stock": () => import("../pages/inventory/InventoryV2"),
  "/sales/leads": () => import("../pages/sales/Leads"),
  "/sales/quotations": () => import("../pages/sales/Quotations"),
  "/sales/orders": () => import("../pages/sales/SalesOrders"),
  "/sales/customers": () => import("../pages/sales/Customers"),
};

const warmed = new Set();

function normalizePath(path) {
  const raw = String(path || "/").split("?")[0].replace(/\/+$/, "") || "/";
  return raw;
}

/** Start loading a route chunk (idempotent per path). */
export function prefetchRouteChunk(path) {
  const key = normalizePath(path);
  const loader = PATH_LOADERS[key];
  if (!loader || warmed.has(key)) return;
  warmed.add(key);
  loader().catch(() => {
    warmed.delete(key);
  });
}

/** Prefetch likely sidebar targets for a role dashboard path. */
export function prefetchRoleSidebarNeighbors(dashboardPath) {
  const base = normalizePath(dashboardPath);
  prefetchRouteChunk(base);
  if (base === "/inventory/dashboard") {
    ["/my-job-cards", "/inventory", "/inventory/low-stock"].forEach(prefetchRouteChunk);
  } else if (base === "/sales" || base === "/sales/dashboard") {
    ["/sales/leads", "/sales/quotations", "/sales/orders", "/sales/customers"].forEach(
      prefetchRouteChunk
    );
  } else if (base === "/production/dashboard") {
    prefetchRouteChunk("/my-job-cards");
  }
}
