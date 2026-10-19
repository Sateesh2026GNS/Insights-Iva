/** Production hub demo data. */

export const DEMO_HUB = {
  running_jobs: 0,
  machines_running: 0,
  machines_idle: 0,
  machines_down: 0,
  production_in_progress: 0,
  production_completed_today: 0,
  material_shortages: 0,
  material_available: 0,
  operators_present: 0,
  operators_absent: 0,
  quality_passed: 0,
  quality_failed: 0,
  recent_jobs: [],
  machine_status: [],
};

export const HUB_MODULES = [
  { label: "Production Planning", to: "/production/planning", color: "bg-blue-500" },
  { label: "Work Orders", to: "/production/work-orders", color: "bg-cyan-500" },
  { label: "Production Schedule", to: "/production/schedule", color: "bg-indigo-500" },
  { label: "Quality Control", to: "/quality/final", color: "bg-green-500" },
  { label: "Finished Goods Inventory", to: "/inventory/finished-goods", color: "bg-emerald-500" },
];

export const HUB_FLOW = [
  "Production Planning", "Work Orders", "Production Schedule",
  "Quality Control", "Finished Goods Inventory",
];

export function hubStatusColor(status) {
  if (status === "ok" || status === "running" || status === "passed") return "text-green-600";
  if (status === "warning" || status === "idle") return "text-amber-600";
  return "text-red-600";
}
