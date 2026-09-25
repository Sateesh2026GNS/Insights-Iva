import {
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  CheckCircle2,
  Factory,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  Settings,
} from "lucide-react";

/** Quality module home route (`QualityDashboard` page). */
export const QUALITY_DASHBOARD_PATH = "/quality";

/** Sidebar + post-login dashboard entry (role-aware `/dashboard` route). */
export const QUALITY_CONTROL_DASHBOARD_NAV_PATH = "/dashboard";

/**
 * Quality Control sidebar — inspection, QC records, production visibility, and shared workplace tools.
 * Only routes that exist in AppRoutes are listed.
 */
export const QUALITY_CONTROL_NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Dashboard",
    to: QUALITY_CONTROL_DASHBOARD_NAV_PATH,
    icon: LayoutDashboard,
    module: "dashboard",
    end: true,
  },
  {
    key: "quality",
    label: "Quality",
    icon: CheckCircle2,
    module: "quality",
    children: [
      { key: "qualityDashboard", label: "Quality Dashboard", to: "/quality", module: "quality", end: true },
      { key: "incoming", label: "Incoming Inspection", to: "/quality/incoming", module: "quality", end: true },
      { key: "inProcess", label: "In-Process QC", to: "/quality/in-process", module: "quality", end: true },
      { key: "final", label: "Final QC", to: "/quality/final", module: "quality", end: true },
      { key: "batchReports", label: "Batch Reports", to: "/quality/batch-reports", module: "quality", end: true },
      { key: "inspections", label: "Quality Inspections", to: "/quality/inspection", module: "quality", end: true },
      {
        key: "ncr",
        label: "NCR / Non-Conformance",
        to: "/quality/defects",
        module: "quality",
        end: true,
      },
    ],
  },
  {
    key: "production",
    label: "Production",
    icon: Factory,
    module: "production",
    children: [
      {
        key: "productionOrders",
        label: "Production Orders",
        to: "/production/planning",
        module: "production",
        end: true,
      },
    ],
  },
  {
    key: "materials",
    label: "Materials",
    icon: Boxes,
    module: "inventory",
    children: [
      { key: "rawMaterials", label: "Raw Materials", to: "/inventory/raw-materials", module: "inventory", end: true },
      { key: "finishedGoods", label: "Finished Goods", to: "/inventory/finished-goods", module: "inventory", end: true },
    ],
  },
  {
    key: "alerts",
    label: "Alerts",
    icon: Bell,
    module: "alerts",
    children: [
      { key: "allAlerts", label: "All Alerts", to: "/alerts", module: "alerts", end: true },
      { key: "qualityAlerts", label: "Quality", to: "/alerts/quality", module: "alerts", end: true },
      { key: "productionDelay", label: "Production Delay", to: "/alerts/production-delay", module: "alerts", end: true },
      { key: "lowStock", label: "Low Stock", to: "/alerts/low-stock", module: "alerts", end: true },
    ],
  },
  {
    key: "documents",
    label: "Documents",
    to: "/documents",
    icon: FolderOpen,
    module: "documents",
    end: true,
  },
  {
    key: "meetings",
    label: "Meetings",
    to: "/meetings",
    icon: CalendarDays,
    module: "meetings",
    end: true,
  },
  {
    key: "chat",
    label: "Work Chat",
    to: "/chat",
    icon: MessageSquare,
    module: "chat",
    end: true,
  },
  {
    key: "analytics",
    label: "Analytics",
    to: "/analytics/production",
    icon: BarChart3,
    module: "analytics",
    end: true,
  },
  {
    key: "settings",
    label: "Settings",
    to: "/settings",
    icon: Settings,
    module: "settings",
    end: true,
  },
];
