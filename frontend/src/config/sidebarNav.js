import {
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Factory,
  FolderOpen,
  Landmark,
  Layers,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

import { HR_SIDEBAR_ITEMS } from "./hrSidebarNav";

/**
 * Insights Iva sidebar structure. Children are filtered by RBAC per-item `module`.
 * Routes map to existing pages where available; others use /erp/* placeholders.
 */
export const SIDEBAR_NAV = [
  {
    key: "dashboard",
    labelKey: "erpNav.dashboard",
    to: "/",
    icon: LayoutDashboard,
    module: "dashboard",
    end: true,
  },
  {
    key: "myJobCards",
    label: "My Job Cards",
    to: "/my-job-cards",
    icon: ClipboardList,
    module: "sales",
    end: true,
  },
  {
    key: "masters",
    labelKey: "erpNav.masters",
    label: "Masters",
    icon: Layers,
    children: [
      { label: "Customers", to: "/masters/customers", module: "masters" },
      { label: "Vendors", to: "/procurement/vendors", module: "masters" },
      { label: "Products", to: "/masters/products", module: "masters" },
    ],
  },
  {
    key: "production",
    labelKey: "erpNav.production",
    icon: Factory,
    children: [
      { labelKey: "erpNav.productionPlanning", to: "/production/planning", module: "production" },
      { labelKey: "erpNav.workOrders", to: "/production/work-orders", module: "production" },
      { labelKey: "erpNav.productionSchedule", to: "/production/schedule", module: "production" },
      { labelKey: "erpNav.machineAllocation", to: "/production/tasks", module: "production" },
      { labelKey: "erpNav.dailyProductionReports", to: "/production/reports", module: "production" },
    ],
  },
  {
    key: "inventory",
    labelKey: "erpNav.inventory",
    label: "Inventory",
    icon: Boxes,
    module: "inventory",
    children: [
      { label: "Inventory", to: "/inventory", module: "inventory", end: true },
      { label: "Store Dashboard", to: "/inventory/dashboard", module: "inventory" },
      { labelKey: "erpNav.rawMaterials", to: "/inventory/raw-materials", module: "inventory" },
      { labelKey: "erpNav.finishedGoods", to: "/inventory/finished-goods", module: "inventory" },
      { labelKey: "erpNav.stockTransfer", to: "/inventory/stock-transfer", module: "inventory" },
      { labelKey: "erpNav.stockAdjustment", to: "/inventory/stock-adjustment", module: "inventory" },
      { labelKey: "erpNav.stockLedger", to: "/inventory/stock-ledger", module: "inventory" },
      { labelKey: "erpNav.warehouses", to: "/inventory/warehouses", module: "inventory" },
      { label: "Inventory Settings", to: "/inventory/settings", module: "inventory" },
    ],
  },
  {
    key: "procurement",
    label: "Purchases",
    labelKey: "erpNav.procurement",
    icon: ShoppingCart,
    children: [
      { label: "Purchase", to: "/purchases", module: "procurement" },
      { label: "Payments Made", to: "/purchases/payments-made", module: "procurement" },
      { label: "Debit Note", to: "/purchases/debit-notes", module: "procurement" },
      { label: "Purchase Order", to: "/procurement/purchase-orders", module: "procurement" },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    labelKey: "erpNav.sales",
    icon: Wallet,
    children: [
      { label: "Sales Dashboard", to: "/sales/dashboard", module: "sales" },
      { label: "Leads", to: "/sales/leads", module: "sales" },
      { label: "Quotations", to: "/sales/quotations", module: "sales" },
      { label: "Sales Orders", to: "/sales/orders", module: "sales" },
      { label: "Customers", to: "/masters/customers", module: "sales" },
      { labelKey: "erpNav.workOrders", label: "Work Orders", to: "/production/work-orders", module: "sales" },
      { label: "Dispatch", to: "/sales/dispatch", module: "sales" },
    ],
  },
  {
    key: "finance",
    label: "Accounting",
    labelKey: "erpNav.finance",
    icon: Landmark,
    children: [
      { label: "Invoices", to: "/sales/invoices", module: "accounts" },
      { label: "Quotations", to: "/sales/quotations", module: "accounts" },
      { label: "Payment Receipts", to: "/sales/payment-receipts", module: "accounts" },
      { label: "Refund Vouchers", to: "/sales/refund-vouchers", module: "accounts" },
      { label: "Proforma Invoice", to: "/sales/proforma-invoices", module: "accounts" },
      { label: "Export Invoice", to: "/sales/export-invoices", module: "accounts" },
      { label: "Export Proforma Invoice", to: "/sales/export-proforma-invoices", module: "accounts" },
      { label: "Delivery Challans", to: "/sales/delivery-challans", module: "accounts" },
      { label: "Credit Note", to: "/sales/credit-notes", module: "accounts" },
      { label: "e-Invoice", to: "/sales/e-invoice", module: "accounts" },
      { label: "Sales Debit Note", to: "/sales/debit-notes", module: "accounts" },
      { label: "E-Waybill Login", to: "/ewaybill/login", module: "accounts" },
      { label: "Digital Signature", to: "/digital-signature", module: "accounts" },
      { label: "Ledger", to: "/accounts/ledger", module: "accounts" },
      { label: "Expense", to: "/accounts/expenses", module: "accounts" },
      { label: "Expense Settings", to: "/accounts/expenses/settings", module: "accounts" },
      { label: "Chart of Accounts", to: "/accounts/chart-of-accounts", module: "accounts" },
      { label: "Manual Journal Entry", to: "/accounts/journal-entries", module: "accounts" },
      { label: "Balance Sheet", to: "/accounts/balance-sheet", module: "accounts" },
      { label: "Profit & Loss Report", to: "/accounts/profit-loss", module: "accounts" },
      { label: "Accounting Reports", to: "/accounts/reports", module: "accounts" },
      { label: "Restore Deleted Doc.", to: "/accounts/restore-deleted", module: "accounts" },
    ],
  },
  {
    key: "quality",
    labelKey: "erpNav.quality",
    icon: CheckCircle2,
    children: [
      { labelKey: "erpNav.qualityDashboard", to: "/quality", module: "quality" },
      { labelKey: "erpNav.incomingInspection", to: "/quality/incoming", module: "quality" },
      { labelKey: "erpNav.inProcessQc", to: "/quality/in-process", module: "quality" },
      { labelKey: "erpNav.finalQc", to: "/quality/final", module: "quality" },
      { labelKey: "erpNav.batchReports", to: "/quality/batch-reports", module: "quality" },
    ],
  },
  {
    key: "maintenance",
    labelKey: "erpNav.maintenance",
    icon: Wrench,
    children: [
      { labelKey: "erpNav.maintenanceDashboard", to: "/maintenance", module: "maintenance" },
      { labelKey: "erpNav.equipmentSpareParts", to: "/maintenance/equipment", module: "maintenance" },
      { labelKey: "erpNav.preventiveMaintenance", to: "/maintenance/preventive", module: "maintenance" },
      { labelKey: "erpNav.breakdownMaintenance", to: "/maintenance/breakdowns", module: "maintenance" },
      { labelKey: "erpNav.machineHistory", to: "/maintenance/machine-history", module: "maintenance" },
      { labelKey: "erpNav.maintenanceSchedule", to: "/maintenance/schedule", module: "maintenance" },
    ],
  },
  {
    key: "hr",
    label: "Human Resources",
    icon: Users,
    module: "hr",
    nestedNav: true,
    children: HR_SIDEBAR_ITEMS,
  },
  {
    key: "alerts",
    labelKey: "erpNav.alerts",
    icon: Bell,
    children: [
      { labelKey: "erpNav.allAlerts", to: "/alerts", module: "alerts", end: true },
      { labelKey: "erpNav.lowStockAlerts", to: "/alerts/low-stock", module: "alerts" },
      { labelKey: "erpNav.machineFailureAlerts", to: "/alerts/machine-failure", module: "alerts" },
      { labelKey: "erpNav.productionDelayAlerts", to: "/alerts/production-delay", module: "alerts" },
      { labelKey: "erpNav.maintenanceAlerts", to: "/alerts/maintenance", module: "alerts" },
      { labelKey: "erpNav.qualityAlerts", to: "/alerts/quality", module: "alerts" },
      { labelKey: "erpNav.safetyAlerts", to: "/alerts/safety", module: "alerts" },
      { labelKey: "erpNav.generalAlerts", to: "/alerts/general", module: "alerts" },
    ],
  },
  {
    key: "documents",
    labelKey: "erpNav.documents",
    icon: FolderOpen,
    children: [
      { labelKey: "erpNav.allDocuments",       to: "/documents",            module: "documents",     end: true },
      { labelKey: "erpNav.purchaseDocuments",  to: "/documents/purchase",   module: "documents_ops" },
      { labelKey: "erpNav.productionDocuments",to: "/documents/production", module: "documents_ops" },
      { labelKey: "erpNav.qualityDocuments",   to: "/documents/quality",    module: "documents_ops" },
      { labelKey: "erpNav.reportDocuments",    to: "/documents/reports",    module: "documents_ops" },
    ],
  },
  {
    key: "meetings",
    labelKey: "erpNav.meetings",
    icon: CalendarDays,
    children: [
      { labelKey: "erpNav.allMeetings", to: "/meetings", module: "meetings", end: true },
    ],
  },
  {
    key: "analytics",
    labelKey: "erpNav.analytics",
    icon: BarChart3,
    children: [
      { labelKey: "erpNav.executiveDashboard", to: "/analytics/executive", module: "analytics" },
      { labelKey: "erpNav.liveDashboard", to: "/analytics/live", module: "analytics" },
      { labelKey: "erpNav.productionKpi", to: "/analytics/production", module: "analytics" },
      { labelKey: "erpNav.inventoryKpi", to: "/analytics/inventory", module: "analytics" },
      { labelKey: "erpNav.salesKpi", to: "/analytics/sales", module: "analytics" },
      { labelKey: "erpNav.financeKpi", to: "/analytics/finance", module: "analytics" },
    ],
  },
  {
    key: "admin",
    label: "Administration",
    icon: Settings,
    children: [
      { label: "Users", to: "/admin/users", module: "admin" },
      { label: "Roles & Permissions", to: "/admin/roles", module: "admin" },
      { label: "Access Logs", to: "/admin/audit-logs", module: "admin" },
      { label: "Pending Approvals", to: "/admin/approvals", module: "admin" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    labelKey: "erpNav.settings",
    to: "/settings",
    icon: Settings,
    module: "settings",
  },
];

export function isPathActive(pathname, to, end = false) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** True when a nav node or any descendant matches the current path. */
export function navNodeIsActive(pathname, node) {
  if (!node) return false;
  if (node.to && isPathActive(pathname, node.to, node.end)) return true;
  if (Array.isArray(node.children)) {
    return node.children.some((child) => navNodeIsActive(pathname, child));
  }
  return false;
}

export function sectionHasActiveChild(pathname, section) {
  if (!section.children) return false;
  return section.children.some((child) => navNodeIsActive(pathname, child));
}

/** Filter a nested nav tree by module/RBAC on leaf nodes. */
export function filterNavTree(nodes, canAccessLeaf) {
  return (nodes || [])
    .map((node) => {
      if (node.children?.length) {
        const children = filterNavTree(node.children, canAccessLeaf);
        if (!children.length) return null;
        return { ...node, children };
      }
      if (!canAccessLeaf(node)) return null;
      return node;
    })
    .filter(Boolean);
}

/** Collect expand keys for nested groups that contain the active route. */
export function buildNestedExpanded(pathname, nodes, sectionKey, state = {}) {
  for (const node of nodes || []) {
    const itemKey = `${sectionKey}:${node.key || node.label}`;
    if (node.children?.length) {
      if (navNodeIsActive(pathname, node)) state[itemKey] = true;
      buildNestedExpanded(pathname, node.children, sectionKey, state);
    }
  }
  return state;
}

/** Flat list of navigable routes for global search (path, label, module, optional section). */
export function flattenNavForSearch() {
  const items = [];
  const walk = (nodes, sectionKey) => {
    for (const node of nodes || []) {
      if (node.to) {
        items.push({
          path: node.to,
          label: node.label,
          labelKey: node.labelKey,
          module: node.module,
          sectionKey,
        });
      }
      if (node.children?.length) walk(node.children, sectionKey);
    }
  };

  for (const section of SIDEBAR_NAV) {
    const sectionKey = section.labelKey || section.label;
    if (section.to) {
      items.push({
        path: section.to,
        labelKey: section.labelKey,
        module: section.module,
        sectionKey: null,
      });
    }
    if (section.children) walk(section.children, sectionKey);
  }
  return items;
}
