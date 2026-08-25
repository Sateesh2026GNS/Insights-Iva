/** Production Manager sidebar sections (module grants are broader for API access). */
export const PRODUCTION_MANAGER_ALLOWED_SECTIONS = new Set([
  "dashboard",
  "masters",
  "production",
  "inventory",
  "procurement",
  "quality",
  "maintenance",
  "alerts",
  "documents",
  "meetings",
  "analytics",
]);

export const PRODUCTION_MANAGER_ALLOWED_CHILDREN = new Set([
  // Dashboard
  "/",
  "/manufacturing/workflow",

  // Masters — products reference only
  "/masters/products",
  "/masters/bom",

  // Production — full access
  "/production",
  "/production/dashboard",
  "/production/planning",
  "/production/work-orders",
  "/production/work-orders/create-quick",
  "/production/schedule",
  "/production/tasks",
  "/production/reports",
  "/production/machines",
  "/manufacturing/workflow",

  // Inventory — read-only view (no Store Dashboard, no Inventory Settings)
  "/inventory/raw-materials",
  "/inventory/finished-goods",
  "/inventory/stock-transfer",

  // Purchases — Purchase Order only (no bills / payments / debit notes)
  "/procurement/purchase-orders",

  // Quality — full quality visibility including incoming and batch reports
  "/quality",
  "/quality/incoming",
  "/quality/in-process",
  "/quality/final",
  "/quality/batch-reports",
  "/quality/defects",

  // Maintenance — full access
  "/maintenance",
  "/maintenance/equipment",
  "/maintenance/preventive",
  "/maintenance/breakdowns",
  "/maintenance/machine-history",
  "/maintenance/schedule",

  // Alerts — all factory alerts
  "/alerts",
  "/alerts/low-stock",
  "/alerts/machine-failure",
  "/alerts/production-delay",
  "/alerts/maintenance",
  "/alerts/quality",
  "/alerts/safety",
  "/alerts/general",

  // Documents
  "/documents",
  "/documents/production",
  "/documents/quality",
  "/documents/reports",

  // Meetings
  "/meetings",

  // Analytics — production-focused only
  "/analytics/live",
  "/analytics/production",

  // Factory Monitor / IoT
  "/factory-monitor/machine-status",
  "/factory-monitor/production-lines",
]);

/** Operator may only open production execution paths (no management/admin). */
export const OPERATOR_ALLOWED_PATHS = new Set([
  "/",
  "/manufacturing/workflow",
  "/production",
  "/production/dashboard",
  "/manufacturing/workflow",
  "/production/tasks",
  "/production/work-orders",
  "/factory-monitor/machine-status",
  "/factory-monitor/production-lines",
  "/factory-monitor/live-production",
  "/documents",
  "/documents/production",
  "/alerts",
  "/alerts/machine-failure",
  "/alerts/production-delay",
  "/alerts/general",
]);

/** HR Manager sidebar — HR module only (no generic masters). */
export const HR_MANAGER_ALLOWED_SECTIONS = new Set([
  "dashboard",
  "hr",
  "documents",
  "alerts",
  "analytics",
  "meetings",
  "settings",
]);

/** Sidebar sections hidden for Operator regardless of module grant. */
export const OPERATOR_BLOCKED_SECTIONS = new Set([
  "masters",
  "inventory",
  "procurement",
  "sales",
  "finance",
  "quality",
  "maintenance",
  "analytics",
  "admin",
  "settings",
  "meetings",
]);

export function productionManagerPathAllowed(pathname) {
  if (!pathname) return false;
  const path = pathname.replace(/\/$/, "") || "/";
  if (PRODUCTION_MANAGER_ALLOWED_CHILDREN.has(path)) return true;
  if (path.startsWith("/production/")) return true;
  if (path.startsWith("/inventory/raw-materials")) return true;
  if (path.startsWith("/inventory/finished-goods")) return true;
  if (path.startsWith("/inventory/stock-transfer")) return true;
  if (path.startsWith("/procurement/purchase-orders")) return true;
  if (path.startsWith("/quality/")) return true;
  if (path.startsWith("/maintenance/")) return true;
  if (path.startsWith("/alerts/")) return true;
  if (path.startsWith("/documents")) return true;
  if (path.startsWith("/meetings")) return true;
  if (path.startsWith("/analytics/live")) return true;
  if (path.startsWith("/analytics/production")) return true;
  if (path.startsWith("/factory-monitor/")) return true;
  if (path.startsWith("/manufacturing/")) return true;
  return false;
}

export function operatorPathAllowed(pathname) {
  if (!pathname) return false;
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/") return true;
  if (OPERATOR_ALLOWED_PATHS.has(path)) return true;
  if (path.startsWith("/production/")) return true;
  if (path.startsWith("/manufacturing/")) return true;
  if (path.startsWith("/factory-monitor/")) return true;
  if (path.startsWith("/documents")) return true;
  if (path.startsWith("/alerts")) return true;
  return false;
}
