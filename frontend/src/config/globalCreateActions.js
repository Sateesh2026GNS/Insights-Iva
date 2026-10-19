import { jobCardCreateUrl } from "../utils/jobCardRoutes";
import {
  isStoreManager,
  userCanAccessPath,
  userCanAction,
  userCanCreateSalesJobCard,
} from "./permissions";

/**
 * Canonical registry of global "create" shortcuts (Add menu).
 * Filter with `getGlobalCreateActionsForUser` — do not render raw list in UI.
 */
export const GLOBAL_CREATE_ACTIONS = [
  {
    id: "customer",
    label: "New Customer",
    group: "Sales",
    path: "/sales/customers/create",
    sidebarPaths: ["/sales/customers"],
    module: "sales",
    action: "create",
  },
  {
    id: "lead",
    label: "New Lead",
    group: "Sales",
    path: "/sales/leads/new",
    sidebarPaths: ["/sales/leads", "/sales/leads/new"],
    module: "sales",
    action: "create",
  },
  {
    id: "quotation",
    label: "New Quotation",
    group: "Sales",
    path: "/sales/quotations/create",
    sidebarPaths: ["/sales/quotations"],
    module: "sales",
    action: "create",
  },
  {
    id: "invoice",
    label: "Invoice",
    group: "Sales",
    path: "/sales/invoices/create",
    sidebarPaths: ["/sales/invoices"],
    module: "sales",
    action: "create",
  },
  {
    id: "payment-receipt",
    label: "Payment Receipt",
    group: "Sales",
    path: "/sales/payment-receipts/create",
    sidebarPaths: ["/sales/payment-receipts"],
    module: "sales",
    action: "create",
  },
  {
    id: "record-payment",
    label: "Record Payment",
    group: "Sales",
    path: "/sales/payments/create",
    sidebarPaths: ["/sales/payments", "/finance/payment-tracking", "/accounts/payment-tracking"],
    module: "sales",
    action: "create",
  },
  {
    id: "proforma-invoice",
    label: "Proforma Invoice",
    group: "Sales",
    path: "/sales/proforma-invoices/create",
    sidebarPaths: ["/sales/proforma-invoices"],
    module: "sales",
    action: "create",
  },
  {
    id: "export-invoice",
    label: "Export Invoice",
    group: "Sales",
    path: "/sales/export-invoices/create",
    sidebarPaths: ["/sales/export-invoices"],
    module: "sales",
    action: "create",
  },
  {
    id: "credit-note",
    label: "Credit Note",
    group: "Sales",
    path: "/sales/credit-notes/create",
    sidebarPaths: ["/sales/credit-notes"],
    module: "sales",
    action: "create",
  },
  {
    id: "delivery-challan",
    label: "Delivery Challan",
    group: "Sales",
    path: "/sales/delivery-challans/create",
    sidebarPaths: ["/sales/delivery-challans"],
    module: "sales",
    action: "create",
  },
  {
    id: "job-card",
    label: "New Job Card",
    group: "Sales",
    getPath: () => jobCardCreateUrl(),
    sidebarPaths: ["/my-job-cards", "/sales/job-cards", "/job-cards"],
    module: "sales",
    action: "create",
    visible: (user) => userCanCreateSalesJobCard(user),
  },
  {
    id: "product",
    label: "New Product",
    group: "Inventory",
    path: "/masters/products?add=1",
    sidebarPaths: ["/masters/products", "/products"],
    module: "masters",
    action: "create",
  },
  {
    id: "inventory-item",
    label: "Inventory Item",
    group: "Inventory",
    path: "/inventory/items/create",
    sidebarPaths: ["/inventory", "/inventory/items"],
    module: "inventory",
    action: "create",
  },
  {
    id: "purchase-order",
    label: "New Purchase Order",
    group: "Purchase",
    path: "/procurement/purchase-orders/create",
    sidebarPaths: ["/procurement/purchase-orders"],
    module: "procurement",
    action: "create",
  },
  {
    id: "employee",
    label: "New Employee",
    group: "HR",
    path: "/hr/employees/create",
    sidebarPaths: ["/hr/employees", "/hr/recruitment"],
    module: "hr",
    action: "create",
  },
  {
    id: "purchase",
    label: "Purchase",
    group: "Purchase",
    path: "/purchases/create",
    sidebarPaths: ["/purchases"],
    module: "procurement",
    action: "create",
  },
  {
    id: "payment-made",
    label: "Payment Made",
    group: "Purchase",
    path: "/purchases/payments-made/create",
    sidebarPaths: ["/purchases/payments-made"],
    module: "procurement",
    action: "create",
  },
  {
    id: "purchase-debit-note",
    label: "Debit Note",
    group: "Purchase",
    path: "/purchases/debit-notes/create",
    sidebarPaths: ["/purchases/debit-notes"],
    module: "procurement",
    action: "create",
  },
  {
    id: "vendor",
    label: "Vendor",
    group: "Purchase",
    path: "/procurement/vendors/create",
    sidebarPaths: ["/procurement/vendors", "/masters/vendors"],
    module: "masters",
    action: "create",
  },
  {
    id: "material-request",
    label: "Material Request",
    group: "Purchase",
    path: "/procurement/material-requests/create",
    sidebarPaths: ["/procurement/material-requests", "/inventory/material-requests"],
    module: "procurement",
    action: "create",
  },
  {
    id: "goods-receipt",
    label: "Goods Receipt",
    group: "Purchase",
    path: "/procurement/goods-receipt/create",
    sidebarPaths: ["/procurement/goods-receipt"],
    module: "procurement",
    action: "create",
  },
  {
    id: "supplier-payment",
    label: "Supplier Payment",
    group: "Purchase",
    path: "/procurement/supplier-payments/create",
    sidebarPaths: ["/procurement/supplier-payments"],
    module: "procurement",
    action: "create",
  },
  {
    id: "bom",
    label: "Bill of Materials",
    group: "Production",
    path: "/production/bom/new",
    sidebarPaths: ["/production/bom"],
    module: "production",
    action: "create",
  },
  {
    id: "machine",
    label: "Machine",
    group: "Production",
    path: "/production/machines/create",
    sidebarPaths: ["/production/machines", "/maintenance/equipment"],
    module: "production",
    action: "create",
  },
  {
    id: "journal-entry",
    label: "Journal Entry",
    group: "Finance",
    path: "/accounts/journal-entries/new",
    sidebarPaths: ["/accounts/journal-entries"],
    module: "accounts",
    action: "create",
  },
];

function resolveActionPath(action) {
  if (typeof action.getPath === "function") return action.getPath();
  return action.path || "";
}

function getVisibleSidebarPaths(sections = []) {
  const paths = new Set();
  const visit = (nodes) => {
    (nodes || []).forEach((node) => {
      const path = (node.to || node.path || "").split("?")[0].replace(/\/$/, "") || "/";
      if (path) paths.add(path);
      visit(node.children);
    });
  };
  visit(sections);
  return paths;
}

export function getGlobalCreateActionsForUser(user, sidebarSections) {
  if (!user) return [];
  const visiblePaths = Array.isArray(sidebarSections) ? getVisibleSidebarPaths(sidebarSections) : null;
  return GLOBAL_CREATE_ACTIONS.filter((entry) => {
    if (isStoreManager(user) && entry.id === "job-card") return false;
    if (typeof entry.visible === "function" && !entry.visible(user)) return false;
    if (!userCanAction(user, entry.module, entry.action)) return false;
    const path = resolveActionPath(entry);
    if (!path) return false;
    if (visiblePaths && !(entry.sidebarPaths || []).some((sidebarPath) => visiblePaths.has(sidebarPath))) return false;
    const pathOnly = path.split("?")[0];
    return userCanAccessPath(user, pathOnly);
  }).map((entry) => ({
    id: entry.id,
    label: entry.label,
    path: resolveActionPath(entry),
    group: entry.group || "Other",
  }));
}
