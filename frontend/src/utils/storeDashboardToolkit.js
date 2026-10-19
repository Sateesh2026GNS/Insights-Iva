/** Store Manager Dashboard — toolkit chrome aligned with Capacity Planning (mtk-theme--green). */

export const STORE_DASHBOARD_TOOLKIT_TAGLINE = "Track Stock · Check Materials · Move Inventory";

export const STORE_DASHBOARD_TOOLKIT_SUBTITLE =
  "Manufacturing Production Planning & Factory Control Toolkit";

/** Tone order used by Capacity Planning KPI chips. */
export const STORE_DASHBOARD_KPI_TONES = ["blue", "green", "orange", "purple", "red", "teal", "yellow", "lime"];

const STORE_DASHBOARD_KPI_ICONS = {
  totalItems: "I",
  lowStock: "LS",
  outOfStock: "0",
  pendingJobCards: "JC",
  pendingMaterialRequests: "MR",
  pendingTransfers: "ST",
  stockIn: "IN",
  stockOut: "OT",
};

export function storeDashboardKpiTone(index) {
  return STORE_DASHBOARD_KPI_TONES[index % STORE_DASHBOARD_KPI_TONES.length];
}

export function storeDashboardKpiIcon(key) {
  return STORE_DASHBOARD_KPI_ICONS[key] || "•";
}
