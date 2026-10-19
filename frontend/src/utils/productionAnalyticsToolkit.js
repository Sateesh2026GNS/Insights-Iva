/** Toolkit helpers — Production Analytics aligned with Project Timeline (mtk-theme--yellow). */

import { formatKpiValue } from "../data/analyticsMasterData";

export const PRODUCTION_ANALYTICS_TOOLKIT_TAGLINE = "Plan · Implement · Monitor · Achieve";
export const PRODUCTION_ANALYTICS_TOOLKIT_SUBTITLE =
  "Manufacturing Production Planning & Factory Control Toolkit";

export const PRODUCTION_ANALYTICS_KPI_TONES = ["blue", "green", "orange", "purple", "red", "teal"];

export const MTK_ANALYTICS_GRID = {
  strokeDasharray: "3 3",
  stroke: "#e2e8f0",
  vertical: false,
};

export const MTK_ANALYTICS_AXIS = {
  fontSize: 9,
  tick: { fill: "#64748b", fontSize: 9 },
  stroke: "#cbd5e1",
  tickLine: false,
  axisLine: { stroke: "#cbd5e1" },
};

export const MTK_ANALYTICS_TOOLTIP = {
  contentStyle: {
    background: "#fff",
    border: "1px solid #c5d0dc",
    borderRadius: 4,
    fontSize: 9,
    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
  },
  labelStyle: { fontWeight: 600, color: "#0f172a", fontSize: 9 },
  itemStyle: { fontWeight: 400, fontSize: 9 },
};

export const MTK_ANALYTICS_LEGEND = {
  wrapperStyle: { fontSize: 9, paddingTop: 4 },
  iconType: "circle",
  iconSize: 6,
};

export function productionAnalyticsKpiTone(index) {
  return PRODUCTION_ANALYTICS_KPI_TONES[index % PRODUCTION_ANALYTICS_KPI_TONES.length];
}

export function productionAnalyticsKpiIcon(kpi) {
  const key = String(kpi?.key || kpi?.label || "").trim();
  if (!key) return "•";
  if (key.length <= 2) return key.toUpperCase();
  return key.charAt(0).toUpperCase();
}

export function productionAnalyticsKpiDisplay(kpi) {
  return formatKpiValue(kpi);
}
