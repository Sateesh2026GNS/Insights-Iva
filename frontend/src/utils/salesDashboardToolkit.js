/** Sales Manager Dashboard — toolkit chrome aligned with Team Capacity (mtk-theme--teal). */

export const SALES_DASHBOARD_TOOLKIT_TAGLINE = "Plan Pipeline · Track Revenue · Close Orders";

export const SALES_DASHBOARD_TOOLKIT_SUBTITLE =
  "Manufacturing Production Planning & Factory Control Toolkit";

/** Same tone cycle as Team Capacity KPI chips. */
export const SALES_DASHBOARD_KPI_TONES = ["blue", "green", "orange", "purple", "red", "teal", "yellow", "lime"];

const SALES_DASHBOARD_KPI_ICONS = {
  monthlyRevenue: "₹",
  totalOrders: "SO",
  pendingOrders: "PO",
  dispatchPending: "D",
  openLeads: "L",
  openQuotations: "Q",
  conversionRate: "%",
  outstandingPayments: "₹",
};

export function salesDashboardKpiTone(index) {
  return SALES_DASHBOARD_KPI_TONES[index % SALES_DASHBOARD_KPI_TONES.length];
}

export function salesDashboardKpiIcon(key) {
  return SALES_DASHBOARD_KPI_ICONS[key] || "•";
}

export const SALES_DASHBOARD_CHART_STROKE = "#0d9488";

export const SALES_DASHBOARD_CHART_GRID = {
  strokeDasharray: "3 3",
  stroke: "#e2e8f0",
  vertical: false,
};

export const SALES_DASHBOARD_CHART_TICK = { fontSize: 9, fill: "#64748b" };

export const SALES_DASHBOARD_CHART_TOOLTIP = {
  contentStyle: {
    background: "#fff",
    border: "1px solid #c5d0dc",
    borderRadius: 4,
    fontSize: 9,
    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
  },
  labelStyle: { fontWeight: 700, color: "#0f172a", fontSize: 9 },
  itemStyle: { fontSize: 9 },
};
