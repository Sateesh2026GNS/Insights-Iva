/** Reference dashboard layout — data from API with fallback defaults. */

export const plants = [
  { id: 1, name: "Plant 1 - Main Factory" },
  { id: 2, name: "Plant 2 - Assembly Unit" },
];

export const kpiCards = [
  { id: "total-orders", title: "Total Orders", value: 0, trend: "+0%", trendUp: true, trendLabel: "production orders" },
  { id: "today-production", title: "Today's Production", value: 0, trend: "+0%", trendUp: true, trendLabel: "vs yesterday" },
  { id: "machines-running", title: "Machines Running", value: "0 / 0", trend: "0%", trendUp: true, trendLabel: "utilization" },
  { id: "pending-orders", title: "Pending Orders", value: 0, trend: "0", trendUp: false, trendLabel: "awaiting action" },
  { id: "pending-approvals", title: "Pending Approvals", value: 0, trend: "0", trendUp: false, trendLabel: "awaiting action" },
  { id: "revenue-cost-snapshot", title: "Revenue & Cost", value: "₹0", suffix: "Revenue", trend: "0%", trendUp: true, trendLabel: "net margin this month" },
];

export const productionOverview = [
  { hour: "08:00", planned: 40, actual: 38 },
  { hour: "10:00", planned: 80, actual: 75 },
  { hour: "12:00", planned: 120, actual: 118 },
  { hour: "14:00", planned: 160, actual: 152 },
  { hour: "16:00", planned: 200, actual: 195 },
  { hour: "18:00", planned: 240, actual: 230 },
];

export const productionOverviewWeekly = [
  { day: "Mon", planned: 240, actual: 235 },
  { day: "Tue", planned: 250, actual: 248 },
  { day: "Wed", planned: 260, actual: 255 },
  { day: "Thu", planned: 240, actual: 230 },
  { day: "Fri", planned: 250, actual: 245 },
  { day: "Sat", planned: 180, actual: 175 },
];

export const productionOverviewMonthly = [
  { week: "Week 1", planned: 1200, actual: 1180 },
  { week: "Week 2", planned: 1250, actual: 1210 },
  { week: "Week 3", planned: 1300, actual: 1290 },
  { week: "Week 4", planned: 1250, actual: 1240 },
];

export const shopFloorStatus = [
  { name: "Running", value: 4, color: "#22C55E" },
  { name: "Idle", value: 1, color: "#3B82F6" },
  { name: "Setup", value: 1, color: "#F97316" },
  { name: "Maintenance", value: 0, color: "#EF4444" },
  { name: "Breakdown", value: 0, color: "#991B1B" },
];

export const topMachines = [
  { id: 1, name: "CNC Milling 01", code: "CNC-01", status: "Running", utilization: 92, efficiency: 94 },
  { id: 2, name: "Injection Molding 02", code: "INJ-02", status: "Running", utilization: 88, efficiency: 90 },
  { id: 3, name: "Lathe Machine 01", code: "LTH-01", status: "Running", utilization: 85, efficiency: 87 },
  { id: 4, name: "Drill Press 03", code: "DRL-03", status: "Setup", utilization: 65, efficiency: 70 },
  { id: 5, name: "Laser Cutter 01", code: "LSR-01", status: "Idle", utilization: 45, efficiency: 80 },
];

export const ordersOverview = { total: 0, inProgress: 0, completed: 0, onHold: 0, progress: 0 };

export const inventoryBlocks = [
  { key: "raw_materials", label: "Raw Materials", count: 0, unit: "SKUs", tone: "blue" },
  { key: "wip_items", label: "WIP Items", count: 0, unit: "SKUs", tone: "purple" },
  { key: "finished_goods", label: "Finished Goods", count: 0, unit: "SKUs", tone: "emerald" },
  { key: "low_stock", label: "Low Stock Items", count: 0, unit: "SKUs", tone: "amber" },
];

export const warehouseLocations = [
  { id: 1, name: "Main Store - Zone A", capacity: "82%" },
  { id: 2, name: "Production Store - Zone B", capacity: "64%" },
  { id: 3, name: "Finished Goods Warehouse", capacity: "73%" },
];

export const alertsFeed = [];

export const quickActionsRef = [
  { label: "New Work Order", to: "/production/work-orders/create-quick", bg: "#3B82F6" },
  { label: "Production Entry", to: "/production/create", bg: "#22C55E" },
  { label: "Material Issue", to: "/inventory/stock-movement", bg: "#F97316" },
  { label: "Stock Transfer", to: "/inventory/stock-transfer", bg: "#A855F7" },
  { label: "QC Entry", to: "/quality/inspection", bg: "#0EA5E9" },
  { label: "Reports", to: "/analytics/production", bg: "#6366F1" },
];

export const recentWorkOrdersRef = [];
export const todaysSummaryRef = [
  { label: "Manpower Active", value: "32 / 36", icon: "users" },
  { label: "Operating Shift", value: "Shift A (08:00 - 16:30)", icon: "clock" },
  { label: "Power Usage", value: "480 kWh", icon: "zap" },
  { label: "OEE Average", value: "88.4%", icon: "gauge" },
];

export function getFallbackDashboard() {
  return {
    dashboard_profile: "admin",
    visible_sections: [
      "kpi",
      "manufacturing_workflow",
      "production_overview",
      "shop_floor",
      "top_machines",
      "orders_overview",
      "inventory",
      "alerts",
      "quick_actions",
      "recent_work_orders",
      "todays_summary",
    ],
    kpi_cards: kpiCards,
    production_overview: productionOverview,
    production_overview_weekly: productionOverviewWeekly,
    production_overview_monthly: productionOverviewMonthly,
    shop_floor_status: shopFloorStatus,
    top_machines: topMachines,
    orders_overview: ordersOverview,
    inventory_blocks: inventoryBlocks,
    warehouse_locations: warehouseLocations,
    alerts_feed: alertsFeed,
    recent_work_orders: recentWorkOrdersRef,
    todays_summary: todaysSummaryRef,
  };
}
