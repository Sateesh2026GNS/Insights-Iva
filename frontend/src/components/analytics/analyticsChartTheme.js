/** Shared Recharts styling aligned with ERP surface tokens. */
export const ANALYTICS_GRID = {
  strokeDasharray: "3 3",
  stroke: "#e2e8f0",
  vertical: false,
};

export const ANALYTICS_AXIS = {
  fontSize: 11,
  tick: { fill: "#64748b", fontSize: 11 },
  stroke: "#cbd5e1",
  tickLine: false,
  axisLine: { stroke: "#cbd5e1" },
};

export const ANALYTICS_TOOLTIP = {
  contentStyle: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 12,
    boxShadow: "0 4px 12px -2px rgba(15, 23, 42, 0.08)",
  },
  labelStyle: { fontWeight: 500, color: "#0f172a" },
  itemStyle: { fontWeight: 400 },
};

export const ANALYTICS_LEGEND = {
  wrapperStyle: { fontSize: 12, paddingTop: 8 },
  iconType: "circle",
  iconSize: 8,
};
