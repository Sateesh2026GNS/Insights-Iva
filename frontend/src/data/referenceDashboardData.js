/** Reference dashboard layout — data from API only. */

export const plants = [];
export const kpiCards = [];
export const productionOverview = [];
export const productionOverviewWeekly = [];
export const productionOverviewMonthly = [];
export const shopFloorStatus = [];
export const topMachines = [];
export const ordersOverview = { total: 0, inProgress: 0, completed: 0, onHold: 0, progress: 0 };
export const inventoryBlocks = [];
export const warehouseLocations = [];
export const alertsFeed = [];
/** One-click admin dashboard shortcuts — routes must exist in AppRoutes. */
export const ADMIN_QUICK_ACTIONS = [
  {
    id: "new-work-order",
    labelKey: "newWorkOrder",
    ariaKey: "newWorkOrderAria",
    to: "/production/work-orders/create-quick",
    icon: "clipboard",
    iconBg: "#3B82F6",
    module: "production",
  },
  {
    id: "production-entry",
    labelKey: "productionEntry",
    ariaKey: "productionEntryAria",
    to: "/production/create",
    icon: "factory",
    iconBg: "#22C55E",
    module: "production",
  },
  {
    id: "material-issue",
    labelKey: "materialIssue",
    ariaKey: "materialIssueAria",
    to: "/inventory/stock-movement",
    icon: "packageMinus",
    iconBg: "#F97316",
    module: "inventory",
  },
  {
    id: "stock-transfer",
    labelKey: "stockTransfer",
    ariaKey: "stockTransferAria",
    to: "/inventory/stock-transfer?new=1",
    icon: "transfer",
    iconBg: "#A855F7",
    module: "inventory",
  },
  {
    id: "qc-entry",
    labelKey: "qcEntry",
    ariaKey: "qcEntryAria",
    to: "/quality/inspection",
    icon: "shield",
    iconBg: "#0EA5E9",
    module: "quality",
  },
  {
    id: "reports",
    labelKey: "reports",
    ariaKey: "reportsAria",
    to: "/production/reports",
    icon: "reports",
    iconBg: "#6366F1",
    module: "analytics",
  },
];

/** @deprecated Use ADMIN_QUICK_ACTIONS — kept for legacy imports. */
export const quickActionsRef = ADMIN_QUICK_ACTIONS.map((a) => ({
  label: a.labelKey,
  to: a.to,
  bg: a.iconBg,
}));

export const recentWorkOrdersRef = [];
export const todaysSummaryRef = [];
