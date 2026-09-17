/** Dashboard layout config — data from API only. */

export const plants = [];
export const kpiMetrics = [];
export const productionTrend = [];
export const oeeData = [];
export const machineUtilization = [];
export const orderStatus = [];
export const monthlyProduction = [];
export const inventoryTrend = [];
export const machineStatus = [];
export const topProducts = [];
export const inventorySummary = { rawMaterials: { count: 0, value: "₹0", lowStock: 0 }, wip: { count: 0, value: "₹0", lowStock: 0 }, finishedGoods: { count: 0, value: "₹0", lowStock: 0 }, stores: [] };
export const todaysDispatch = { total: 0, dispatched: 0, pending: 0, items: [] };
export const purchaseSummary = { openPOs: 0, pendingApproval: 0, receivedToday: 0, value: "₹0" };
export const qualityInspection = { inspected: 0, passed: 0, failed: 0, passRate: 0, pending: 0 };
export const lowStockAlerts = [];
export const criticalAlerts = [];
export const recentWorkOrders = [];
export const employeeAttendance = { present: 0, absent: 0, onLeave: 0, total: 0, shiftBreakdown: [] };
export const maintenanceSchedule = [];
export const liveProduction = { linesActive: 0, linesTotal: 0, currentOutput: 0, hourlyRate: 0, efficiency: 0 };
export const quickActions = [
  { label: "New Work Order", to: "/production/work-orders", bg: "#3B82F6" },
  { label: "Production Entry", to: "/production/create", bg: "#22C55E" },
  { label: "Material Issue", to: "/inventory/stock-movement", bg: "#F97316" },
  { label: "Stock Transfer", to: "/inventory/stock-transfer", bg: "#A855F7" },
  { label: "QC Entry", to: "/quality/inspection", bg: "#0EA5E9" },
  { label: "Reports", to: "/analytics/production", bg: "#6366F1" },
];
export const todaysSummary = { manpower: 0, workingHours: "0 Hrs", powerConsumption: "0 kWh", targetAchievement: "0%" };
