/** Shop floor demo data. */

export const DEMO_SHOP_SUMMARY = {
  running_jobs: 0,
  active_machines: 0,
  operators_working: 0,
  todays_production: 0,
  todays_target: 0,
  scrap_qty: 0,
  downtime_minutes: 0,
  oee_pct: 0,
};

export const DEMO_SHOP_GRID = [];

export const DEMO_SHOP_ALERTS = [];

export const DEMO_MACHINE_LAYOUT = [];

export const DEMO_SHOP_TIMELINE = [];

export const SHOP_FLOW_STEPS = [
  "Sales Order", "Production Planning", "Production Schedule",
  "Machine Allocation", "Shop Floor", "Production Entry",
  "Batch Tracking", "Quality Control", "Finished Goods Inventory",
];

export function shopStatusDot(status) {
  const s = (status || "").toLowerCase();
  if (s === "running") return "🟢";
  if (s === "idle") return "🟡";
  if (s === "maintenance" || s === "breakdown") return "🔴";
  return "⚪";
}

export function shopStatusLabel(status) {
  const s = (status || "").toLowerCase();
  if (s === "running") return "Running";
  if (s === "idle") return "Idle";
  if (s === "maintenance") return "Maintenance";
  if (s === "breakdown") return "Breakdown";
  return status || "—";
}
