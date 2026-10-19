/** KPI strip metadata — Production Schedule page (Budget Planner toolkit alignment). */

export const SCHEDULE_TOOLKIT_KPIS = [
  { preset: "all", label: "Target Quantity", tone: "blue", icon: "T", field: "production_target", format: "locale" },
  { preset: "completed", label: "Completed Orders", tone: "green", icon: "✓", field: "completed", format: "locale" },
  { preset: "pending", label: "Pending Orders", tone: "orange", icon: "P", field: "pending", format: "locale" },
  { preset: "delayed", label: "Delayed Orders", tone: "red", icon: "!", field: "delayed_orders" },
  {
    preset: null,
    label: "Utilization",
    tone: "purple",
    icon: "%",
    field: "machine_utilization_pct",
    suffix: "%",
  },
  {
    preset: null,
    label: "Overall Progress",
    tone: "teal",
    icon: "▶",
    field: "overall_progress_pct",
    suffix: "%",
  },
];

export function formatScheduleKpiValue(dashboard, kpi) {
  const raw = dashboard?.[kpi.field];
  if (raw == null || raw === "") return kpi.suffix ? `0${kpi.suffix}` : "0";
  if (kpi.format === "locale") return Number(raw).toLocaleString();
  if (kpi.suffix) return `${Number(raw)}${kpi.suffix}`;
  return String(raw);
}
