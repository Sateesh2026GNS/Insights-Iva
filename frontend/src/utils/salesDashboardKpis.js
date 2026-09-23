import { userCanAccessPath } from "../config/permissions";

/**
 * Sales Dashboard KPI drill-down targets (canonical routes only).
 * Navigation is allowed only when userCanAccessPath passes for the destination pathname.
 */
export const SALES_DASHBOARD_KPI_DESTINATIONS = {
  monthlyRevenue: {
    path: "/sales/reports/sales",
    navLabel: "View sales report and monthly revenue analytics",
  },
  totalOrders: {
    path: "/sales/orders",
    navLabel: "View all sales orders",
  },
  pendingOrders: {
    path: "/sales/orders",
    search: "?status=pending",
    navLabel: "View pending sales orders",
  },
  dispatchPending: {
    path: "/sales/dispatch",
    search: "?status=pending_dispatch",
    navLabel: "View shipments pending dispatch",
  },
  openLeads: {
    path: "/sales/leads",
    search: "?open=1",
    navLabel: "View open leads",
  },
  openQuotations: {
    path: "/sales/quotations",
    search: "?kpi=pending",
    navLabel: "View open quotations",
  },
  conversionRate: {
    path: "/sales/reports/sales",
    navLabel: "View sales reports and conversion metrics",
  },
  outstandingPayments: {
    path: "/sales/payments",
    navLabel: "View outstanding customer payments",
  },
};

export function salesKpiPathnameFromTo(to) {
  if (!to || typeof to !== "string") return "";
  const path = to.split("?")[0].split("#")[0];
  return path.replace(/\/$/, "") || "/";
}

/**
 * @param {object} [options]
 * @param {string} [options.dateFrom] — ISO date (YYYY-MM-DD), used for monthly revenue drill-down
 * @param {string} [options.dateTo] — ISO date (YYYY-MM-DD), used for monthly revenue drill-down
 */
export function resolveSalesDashboardKpiLink(user, kpiKey, options = {}) {
  const def = SALES_DASHBOARD_KPI_DESTINATIONS[kpiKey];
  if (!def?.path) return null;
  if (!userCanAccessPath(user, def.path)) return null;
  if (kpiKey === "monthlyRevenue" && options.dateFrom && options.dateTo) {
    const qs = new URLSearchParams({ from: options.dateFrom, to: options.dateTo });
    return `${def.path}?${qs.toString()}`;
  }
  return `${def.path}${def.search || ""}`;
}

export function salesDashboardKpiNavLabel(kpiKey) {
  return SALES_DASHBOARD_KPI_DESTINATIONS[kpiKey]?.navLabel || "";
}
