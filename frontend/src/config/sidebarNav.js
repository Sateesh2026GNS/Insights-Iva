import {
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  CheckCircle2,
  MessageSquare,
  ClipboardList,
  Factory,
  FolderOpen,
  Landmark,
  Layers,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Truck,
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
    module: "production",
    end: false,
  },
  {
    key: "masters",
    labelKey: "erpNav.masters",
    label: "Masters",
    icon: Layers,
    children: [
      { label: "Customers", to: "/sales/customers", module: "masters" },
      { label: "Vendors", to: "/procurement/vendors", module: "masters" },
      { label: "Products", to: "/masters/products", module: "masters" },
      { label: "Bill of Materials (BOM)", to: "/production/bom", module: "production", bomViewOnly: true },
    ],
  },
  {
    key: "production",
    labelKey: "erpNav.production",
    icon: Factory,
    children: [
      { labelKey: "erpNav.productionPlanning", to: "/production/planning", module: "production", managerOnly: true },
      { label: "Bill of Materials", to: "/production/bom", module: "production", bomViewOnly: true },
      { labelKey: "erpNav.workOrders", to: "/production/work-orders", module: "production" },
      { labelKey: "erpNav.productionSchedule", to: "/production/schedule", module: "production" },
      { labelKey: "erpNav.dailyProductionReports", to: "/production/reports", module: "production", managerOnly: true },
      { labelKey: "erpNav.myMachine", to: "/production/my-machine", module: "production", operatorOnly: true },
    ],
  },
  {
    key: "inventory",
    labelKey: "erpNav.inventory",
    label: "Inventory",
    icon: Boxes,
    module: "inventory",
    children: [
      { label: "Store Dashboard", to: "/inventory/dashboard", module: "inventory" },
      { label: "Inventory", to: "/inventory", module: "inventory", end: true },
      { labelKey: "erpNav.rawMaterials", to: "/inventory/raw-materials", module: "inventory" },
      { labelKey: "erpNav.finishedGoods", to: "/inventory/finished-goods", module: "inventory" },
      { labelKey: "erpNav.warehouses", to: "/inventory/warehouses", module: "inventory" },
      { labelKey: "erpNav.stockTransfer", to: "/inventory/stock-transfer", module: "inventory" },
      { labelKey: "erpNav.stockAdjustment", to: "/inventory/stock-adjustment", module: "inventory" },
      { labelKey: "erpNav.stockLedger", to: "/inventory/stock-ledger", module: "inventory" },
      { label: "Inventory Settings", to: "/inventory/settings", module: "inventory" },
    ],
  },
  {
    key: "procurement",
    label: "Purchases",
    labelKey: "erpNav.procurement",
    icon: ShoppingCart,
    children: [
      { label: "Purchase Order", to: "/procurement/purchase-orders", module: "procurement" },
      { label: "Purchase", to: "/purchases", module: "procurement", end: true },
      { label: "Debit Note", to: "/purchases/debit-notes", module: "procurement" },
      { label: "Payments Made", to: "/purchases/payments-made", module: "procurement" },
      {
        label: "Pending Approvals",
        to: "/admin/approvals",
        module: "procurement",
        approvalQueue: true,
      },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    labelKey: "erpNav.sales",
    icon: Wallet,
    children: [
      { label: "Sales Dashboard", to: "/sales/dashboard", module: "sales" },
      { label: "Leads", to: "/sales/leads", module: "sales", activeMatch: "leadsIndex" },
      { label: "Quotations", to: "/sales/quotations", module: "sales" },
      { label: "Sales Orders", to: "/sales/orders", module: "sales" },
      { label: "Customers", to: "/sales/customers", module: "sales" },
      { labelKey: "erpNav.workOrders", label: "Work Orders", to: "/production/work-orders", module: "sales" },
      { label: "Shipping", labelKey: "erpNav.shipping", to: "/sales/shipping", module: "sales", icon: Truck },
    ],
  },
  {
    key: "finance",
    label: "Accounting",
    labelKey: "erpNav.finance",
    icon: Landmark,
    children: [
      { label: "Receivables", to: "/finance/accounts-receivable", module: "accounts" },
      { label: "Payables", to: "/accounts/accounts-payable", module: "accounts" },
      { label: "Payments", to: "/finance/payment-tracking", module: "accounts" },
      { label: "Invoices", to: "/sales/invoices", module: "accounts" },
      { label: "Bills", to: "/procurement/vendor-bills", module: "accounts" },
      { label: "Cash & Bank", to: "/accounts/ledger", module: "accounts" },
      { label: "General Ledger", to: "/finance/general-ledger", module: "accounts" },
      { label: "Journal Entries", to: "/accounts/journal-entries", module: "accounts" },
      { label: "Reports", to: "/accounts/reports", module: "accounts" },
      { label: "Bank Reconciliation", to: "/accounts/bank-reconciliation", module: "accounts" },
      { label: "Settings", to: "/accounts/settings", module: "accounts", end: true },
      { label: "Quotations", to: "/sales/quotations", module: "accounts" },
      { label: "Payment Receipts", to: "/sales/payment-receipts", module: "accounts" },
      { label: "Refund Vouchers", to: "/sales/refund-vouchers", module: "accounts" },
      { label: "Proforma Invoice", to: "/sales/proforma-invoices", module: "accounts" },
      { label: "Export Invoice", to: "/sales/export-invoices", module: "accounts" },
      { label: "Export Packing List", to: "/sales/export-packing-list", module: "sales" },
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
      { label: "GST", to: "/accounts/gst", module: "accounts" },
      { label: "Accounting Reports", to: "/accounts/reports", module: "accounts" },
      { label: "Restore Deleted Doc.", to: "/accounts/restore-deleted", module: "accounts" },
    ],
  },
  {
    key: "quality",
    labelKey: "erpNav.quality",
    icon: CheckCircle2,
    children: [
      { labelKey: "erpNav.incomingInspection", to: "/quality/incoming", module: "quality" },
      { labelKey: "erpNav.inProcessQc", to: "/quality/in-process", module: "quality" },
      { labelKey: "erpNav.finalQc", to: "/quality/final", module: "quality" },
      { label: "Quality Check Queue", to: "/my-job-cards?dept=quality", module: "quality" },
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
      {
        label: "Pending Approvals",
        to: "/admin/approvals",
        module: "admin",
        approvalQueue: true,
      },
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
  const pathOnly = (to || "").split("?")[0];
  if (end) return pathname === pathOnly;
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}

/** Split a router `to` string into pathname and search (including leading `?`). */
export function parseNavTo(to) {
  if (!to) return { pathname: "", search: "" };
  const q = to.indexOf("?");
  if (q === -1) return { pathname: to, search: "" };
  return { pathname: to.slice(0, q), search: to.slice(q) };
}

function normalizeNavLocation(pathnameOrLocation, search = "") {
  if (pathnameOrLocation && typeof pathnameOrLocation === "object") {
    return {
      pathname: pathnameOrLocation.pathname || "",
      search: pathnameOrLocation.search || "",
    };
  }
  return { pathname: pathnameOrLocation || "", search: search || "" };
}

function navSearchParamsMatch(expectedSearch, actualSearch) {
  if (!expectedSearch) return true;
  const expected = new URLSearchParams(expectedSearch.replace(/^\?/, ""));
  const actual = new URLSearchParams((actualSearch || "").replace(/^\?/, ""));
  for (const [key, value] of expected.entries()) {
    if (actual.get(key) !== value) return false;
  }
  return true;
}

const PRODUCTION_PLANNING_PATH = "/production/planning";
/** Default toolkit when Store Manager opens planning without `?toolkit=` (see manufacturingToolkitAccess). */
const STORE_MANAGER_PLANNING_DEFAULT_TOOLKIT = "inventory_register";

/**
 * Disambiguate sidebar highlights when multiple items share `/production/planning`.
 * @returns {boolean|undefined} `undefined` when this rule does not apply.
 */
export function productionPlanningToolkitLinkActive(pathname, locationSearch, toPath, toSearch, activeToolkit) {
  if (pathname !== PRODUCTION_PLANNING_PATH || toPath !== PRODUCTION_PLANNING_PATH) {
    return undefined;
  }

  const actualParams = new URLSearchParams((locationSearch || "").replace(/^\?/, ""));
  const locToolkit = actualParams.get("toolkit");
  const linkToolkit =
    activeToolkit ||
    (toSearch ? new URLSearchParams(toSearch.replace(/^\?/, "")).get("toolkit") : null);

  if (linkToolkit) {
    const effectiveLoc = locToolkit || STORE_MANAGER_PLANNING_DEFAULT_TOOLKIT;
    return effectiveLoc === linkToolkit;
  }

  if (locToolkit) {
    return false;
  }

  return undefined;
}

/**
 * Whether a sidebar leaf should use the active style (pathname + optional query rules).
 */
export function isSidebarLinkActive(pathnameOrLocation, node, search = "") {
  if (!node?.to) return false;
  const { pathname, search: locationSearch } = normalizeNavLocation(pathnameOrLocation, search);
  const { pathname: toPath, search: toSearch } = parseNavTo(node.to);

  const planningActive = productionPlanningToolkitLinkActive(
    pathname,
    locationSearch,
    toPath,
    toSearch,
    node.activeToolkit
  );
  if (planningActive !== undefined) {
    return planningActive;
  }

  if (toSearch) {
    return pathname === toPath && navSearchParamsMatch(toSearch, locationSearch);
  }

  if (node.activeMatch === "leadsIndex") {
    return pathname === toPath;
  }

  if (node.activeMatch === "leadsCreate") {
    return (
      pathname === "/sales/leads/new" || /\/sales\/leads\/[^/]+\/edit$/.test(pathname)
    );
  }

  return isPathActive(pathname, toPath, node.end === true);
}

/** True when a nav node or any descendant matches the current route. */
export function navNodeIsActive(pathnameOrLocation, node, search = "") {
  if (!node) return false;
  if (node.to && isSidebarLinkActive(pathnameOrLocation, node, search)) return true;
  if (Array.isArray(node.children)) {
    return node.children.some((child) => navNodeIsActive(pathnameOrLocation, child, search));
  }
  return false;
}

export function sectionHasActiveChild(pathnameOrLocation, section, search = "") {
  if (!section.children) return false;
  return section.children.some((child) => navNodeIsActive(pathnameOrLocation, child, search));
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
export function buildNestedExpanded(pathnameOrLocation, nodes, sectionKey, state = {}) {
  for (const node of nodes || []) {
    const itemKey = `${sectionKey}:${node.key || node.label}`;
    if (node.children?.length) {
      if (navNodeIsActive(pathnameOrLocation, node)) state[itemKey] = true;
      buildNestedExpanded(pathnameOrLocation, node.children, sectionKey, state);
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
