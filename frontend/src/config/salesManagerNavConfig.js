import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  MessageSquare,
  ClipboardList,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Layers,
  Package,
  Settings,
  ShoppingCart,
  Target,
  Truck,
  Users,
} from "lucide-react";

import { SALES_DASHBOARD_PATH } from "../utils/roleRedirect";
import { ROLE_MASTERS_NAV_CHILDREN } from "./roleMastersNav";

/**
 * Sales Manager sidebar — workflow-focused navigation (single dashboard, no duplicate Sales Dashboard).
 */
export const SALES_MANAGER_NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Dashboard",
    to: SALES_DASHBOARD_PATH,
    icon: LayoutDashboard,
    module: "dashboard",
    end: true,
  },
  {
    key: "sales",
    label: "Sales",
    icon: ShoppingCart,
    module: "sales",
    children: [
      { key: "leads", label: "Leads / Enquiries", to: "/sales/leads", icon: Target, module: "sales" },
      { key: "createLead", label: "Create Lead", to: "/sales/leads/new", icon: Target, module: "sales" },
      { key: "quotations", label: "Quotations", to: "/sales/quotations", icon: FileText, module: "sales" },
      { key: "orders", label: "Sales Orders", to: "/sales/orders", icon: ClipboardList, module: "sales" },
      { key: "followUps", label: "Follow-ups", to: "/sales/leads?followup=due", icon: CalendarDays, module: "sales" },
    ],
  },
  {
    key: "orderManagement",
    label: "Order Management",
    icon: ClipboardList,
    module: "sales",
    children: [
      {
        key: "jobCards",
        label: "Job Cards",
        to: "/my-job-cards?dept=sales",
        icon: ClipboardList,
        module: "sales",
      },
      { key: "shipping", label: "Shipping / Dispatch", to: "/sales/shipping", icon: Truck, module: "sales" },
    ],
  },
  {
    key: "alerts",
    label: "Alerts",
    icon: Bell,
    module: "alerts",
    children: [
      { key: "allAlerts", label: "All Alerts", to: "/alerts", icon: Bell, module: "alerts", end: true },
      { key: "followUpsDue", label: "Follow-ups Due", to: "/sales/leads?followup=due", icon: Target, module: "sales" },
      {
        key: "orderDelays",
        label: "Order Delays",
        to: "/alerts/production-delay",
        icon: AlertTriangle,
        module: "alerts",
      },
    ],
  },
  {
    key: "documents",
    label: "Documents",
    icon: FolderOpen,
    module: "documents",
    children: [
      { key: "allDocuments", label: "All Documents", to: "/documents", icon: FolderOpen, module: "documents", end: true },
    ],
  },
  {
    key: "meetings",
    label: "Meetings",
    icon: CalendarDays,
    module: "meetings",
    children: [
      { key: "meetingsList", label: "Meetings", to: "/meetings", icon: CalendarDays, module: "meetings", end: true },
    ],
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
    key: "masters",
    label: "Masters",
    icon: Layers,
    module: "masters",
    children: ROLE_MASTERS_NAV_CHILDREN.map((c) => ({ ...c })),
  },
  {
    key: "reports",
    label: "Reports",
    icon: BarChart3,
    module: "sales",
    children: [
      { key: "salesReport", label: "Sales Report", to: "/sales/reports/sales", icon: BarChart3, module: "sales" },
      {
        key: "salesOrderReport",
        label: "Sales Order Report",
        to: "/sales/reports/sales-orders",
        icon: ClipboardList,
        module: "sales",
      },
      {
        key: "quotationReport",
        label: "Quotation Report",
        to: "/sales/reports/quotations",
        icon: FileText,
        module: "sales",
      },
      { key: "customerReport", label: "Customer Report", to: "/sales/reports/customers", icon: Users, module: "sales" },
    ],
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
