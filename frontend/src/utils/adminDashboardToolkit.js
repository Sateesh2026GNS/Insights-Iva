/** Admin ERP dashboard — toolkit chrome aligned with Department Operating Plan (mtk-theme--navy). */

export const ADMIN_DASHBOARD_TOOLKIT_SUBTITLE =
  "Manufacturing Production Planning & Factory Control Toolkit";

export const ADMIN_DASHBOARD_KPI_TONES = ["blue", "green", "orange", "purple", "red", "teal"];

export function adminDashboardKpiTone(index) {
  return ADMIN_DASHBOARD_KPI_TONES[index % ADMIN_DASHBOARD_KPI_TONES.length];
}

export function adminDashboardKpiIcon(card) {
  const id = String(card?.id || card?.title || "").trim();
  if (!id) return "•";
  return id.charAt(0).toUpperCase();
}

export function formatAdminDashboardHeroDate(date = new Date()) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
