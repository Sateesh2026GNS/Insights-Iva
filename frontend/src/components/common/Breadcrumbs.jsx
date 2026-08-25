import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

import { findSettingsCategory } from "../../pages/settings/settingsCatalog";

const pathLabels = {
  "": "Dashboard",
  production: "Production",
  planning: "Production Planning",
  "work-orders": "Work Orders",
  "job-card": "Job Card",
  "operator-jobs": "My Operator Jobs",
  tasks: "Tasks",
  batches: "Batch Tracking",
  machines: "Machines",
  reports: "Daily Reports",
  create: "Create",
  inventory: "Inventory",
  "raw-materials": "Raw Materials",
  "finished-goods": "Finished Goods",
  "stock-transfer": "Stock Transfer",
  "stock-adjustment": "Stock Adjustment",
  "stock-ledger": "Stock Ledger",
  "stock-movement": "Stock Movement",
  items: "Items",
  warehouses: "Warehouses",
  suppliers: "Suppliers",
  sales: "Sales",
  leads: "Leads",
  quotations: "Quotations",
  orders: "Sales Orders",
  dispatch: "Dispatch",
  invoices: "Invoices",
  customers: "Customers",
  payments: "Payments",
  hr: "Human Resources (HR)",
  employees: "Employees",
  attendance: "Attendance",
  leave: "Leave",
  payroll: "Payroll",
  accounts: "Accounts",
  expenses: "Expenses",
  ledger: "Ledger",
  "chart-of-accounts": "Chart of Accounts",
  "journal-entries": "Journal Entries",
  "balance-sheet": "Balance Sheet",
  "profit-loss": "Profit & Loss",
  procurement: "Procurement",
  purchases: "Purchases",
  "purchase-orders": "Purchase Orders",
  vendors: "Vendors",
  "goods-receipt": "Goods Receipt Note (GRN)",
  "supply-chain": "Supply Chain",
  masters: "Masters",
  products: "Products",
  bom: "Bill of Materials (BOM)",
  quality: "Quality",
  analytics: "Analytics",
  executive: "Executive Dashboard",
  forecasting: "Forecasting",
  alerts: "Alerts",
  "low-stock": "Low Stock",
  documents: "Documents",
  admin: "Admin",
  users: "Users",
  roles: "Roles",
  permissions: "Permissions",
  "audit-logs": "Audit Logs",
  integrations: "Integrations",
  settings: "Settings",
  manufacturing: "Manufacturing",
  workflow: "My Responsibilities",
  "factory-monitor": "Factory Monitor",
  "machine-status": "Machine Status",
  "production-lines": "Production Lines",
  iot: "Internet of Things (IoT)",
  schedule: "Schedule",
  "assign-tasks": "Assign Tasks",
  dashboard: "Dashboard",
  "access-logs": "Access Logs",
  "accounts-payable": "Accounts Payable",
  "accounts-receivable": "Accounts Receivable",
  agvs: "AGVs",
  assets: "Assets",
  "bank-reconciliation": "Bank Reconciliation",
  "batch-reports": "Batch Quality Reports",
  billing: "Billing",
  bills: "Bills",
  breakdowns: "Breakdown Maintenance",
  "budget-actual": "Budget vs Actual",
  "bulk-import": "Bulk Import",
  "change-format": "Format Settings",
  "change-template": "Template Settings",
  cobots: "Cobots",
  compliance: "Compliance",
  "cost-allocation": "Cost Allocation",
  "credit-notes": "Credit Notes",
  "debit-notes": "Debit Notes",
  defects: "Rejections",
  "delivery-challans": "Delivery Challans",
  departments: "Departments",
  "digital-signature": "Digital Signature",
  drones: "Drones",
  "e-invoice": "E-Invoice",
  ewaybill: "E-Waybill",
  "expense-settings": "Expense Settings",
  "export-invoices": "Export Invoices",
  "export-proforma-invoices": "Export Proforma Invoices",
  final: "Final QC",
  finance: "Finance",
  "fixed-assets": "Fixed Assets",
  "format-settings": "Format Settings",
  "general-ledger": "General Ledger",
  history: "History",
  "in-process": "In-Process QC",
  incidents: "Incidents",
  incoming: "Incoming Inspection",
  inspection: "Inspection",
  "inventory-settings": "Inventory Settings",
  "invoice-settings": "Invoice Settings",
  "invoice-template": "Invoice Template",
  "issue-materials": "Issue Materials",
  "live-operations": "Live Operations",
  "machine-analytics": "Machine Analytics",
  "machine-efficiency": "Machine Efficiency",
  "machine-failure": "Machine Failure",
  "machine-history": "Machine History",
  equipment: "Equipment & Spare Parts",
  maintenance: "Maintenance",
  "material-requests": "Material Requests",
  "payment-receipts": "Payment Receipts",
  "payment-tracking": "Payment Tracking",
  "payments-made": "Payments Made",
  performance: "Performance",
  preventive: "Preventive Maintenance",
  "proforma-invoices": "Proforma Invoices",
  "purchase-template": "Purchase Template",
  "quotation-template": "Quotation Template",
  "refund-vouchers": "Refund Vouchers",
  "restore-deleted": "Restore Deleted",
  "restore-deleted-docs": "Restore Deleted Docs",
  rfq: "RFQ",
  safety: "Safety",
  sensors: "Sensors",
  "sequence-reset": "Sequence Reset",
  shifts: "Shifts",
  "smart-packaging": "Smart Packaging",
  "stock-in": "Stock In",
  "stock-return": "Stock Return",
  "supplier-payments": "Supplier Payments",
  "tax-reports": "Tax Reports",
  "template-settings": "Template Settings",
  "trial-balance": "Trial Balance",
  wearables: "Wearables",
};

/** Exact pathname → navbar title (inventory and other routes where segment labels are ambiguous). */
const PAGE_TITLE_OVERRIDES = {
  "/settings": "Settings",
  "/inventory": "Inventory",
  "/inventory/dashboard": "Store Dashboard",
  "/inventory/settings": "Inventory Settings",
  "/inventory/list": "Inventory List",
  "/inventory/raw-materials": "Raw Materials",
  "/inventory/finished-goods": "Finished Goods",
  "/inventory/stock-transfer": "Stock Transfer",
  "/inventory/stock-adjustment": "Stock Adjustment",
  "/inventory/stock-ledger": "Stock Ledger",
  "/inventory/stock-movement": "Stock Movement",
  "/inventory/stock-in": "Stock In",
  "/inventory/stock-return": "Stock Return",
  "/inventory/material-requests": "Material Requests",
  "/inventory/issue-materials": "Issue Materials",
  "/inventory/history": "Inventory History",
  "/inventory/warehouses": "Warehouses",
  "/inventory/suppliers": "Suppliers",
  "/inventory/items/create": "Create Item",
  "/inventory/warehouses/create": "Create Warehouse",
  "/inventory/suppliers/create": "Create Supplier",
  "/meetings": "Meetings",
  "/procurement/purchase-orders/create": "Create Purchase Order",
  "/sales/payments/create": "Record Payment",
  "/sales/payment-receipts/create": "Record Payment",
  "/production/operator-jobs": "My Operator Jobs",
};

const ENTITY_SINGULAR = {
  invoices: "Invoice",
  quotations: "Quotation",
  orders: "Sales Order",
  bills: "Bill",
  "debit-notes": "Debit Note",
  "credit-notes": "Credit Note",
  "delivery-challans": "Delivery Challan",
  "proforma-invoices": "Proforma Invoice",
  "export-invoices": "Export Invoice",
  "export-proforma-invoices": "Export Proforma Invoice",
  purchases: "Purchase",
  "purchase-orders": "Purchase Order",
  "goods-receipt": "Goods Receipt",
  "material-requests": "Material Request",
  "supplier-payments": "Supplier Payment",
  "vendor-bills": "Vendor Bill",
  vendors: "Vendor",
  customers: "Customer",
  products: "Product",
  items: "Item",
  warehouses: "Warehouse",
  suppliers: "Supplier",
  "work-orders": "Work Order",
  meetings: "Meeting",
  "journal-entries": "Journal Entry",
  "chart-of-accounts": "Account",
  reports: "Report",
  "payment-receipts": "Payment Receipt",
  "refund-vouchers": "Refund Voucher",
  "payments-made": "Payment Made",
  leads: "Lead",
  employees: "Employee",
  tasks: "Task",
  machines: "Machine",
  departments: "Department",
  users: "User",
  roles: "Role",
};

function getLabel(segment, segments, index) {
  const prev = index > 0 ? segments[index - 1] : null;
  if (segment === "dashboard" && prev === "inventory") return "Store Dashboard";
  if (segment === "settings" && prev === "inventory") return "Inventory Settings";
  if (segment === "create-quick" && prev === "work-orders") return "Quick Work Order";
  if (segment === "create" && prev && ENTITY_SINGULAR[prev]) {
    return `Create ${ENTITY_SINGULAR[prev]}`;
  }
  if (segment === "edit" && index >= 2) {
    const parentEntity = segments[index - 2];
    if (ENTITY_SINGULAR[parentEntity]) return `Edit ${ENTITY_SINGULAR[parentEntity]}`;
    return "Edit";
  }
  if (segment === "copy" && index >= 2) {
    const parentEntity = segments[index - 2];
    if (ENTITY_SINGULAR[parentEntity]) return `${ENTITY_SINGULAR[parentEntity]} Copy`;
    return "Copy";
  }
  if (prev === "settings" && index >= 1) {
    const cat = findSettingsCategory(segment);
    if (cat) return cat.title;
  }
  // If segment is a numeric or alphanumeric ID (like "1", "INV-000001", etc.) under an entity list
  const isIdSegment = /^\d+$/.test(segment) || (prev && ENTITY_SINGULAR[prev] && !pathLabels[segment] && segment.length > 0 && !["create", "edit", "copy", "bulk-import"].includes(segment));
  if (isIdSegment && prev && ENTITY_SINGULAR[prev]) {
    return `${ENTITY_SINGULAR[prev]} Details`;
  }
  return pathLabels[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Build breadcrumb trail for a pathname. */
export function getBreadcrumbTrail(pathname) {
  const segments = (pathname || "/").split("/").filter(Boolean);

  if (segments[0] === "admin") {
    const adminLabels = {
      users: "Users",
      roles: "Roles",
      permissions: "Permissions",
      "audit-logs": "Audit Logs",
    };
    const trail = [{ label: "Dashboard", path: "/" }, { label: "Administration", path: "/admin/users" }];
    segments.slice(1).forEach((seg, i) => {
      const slice = segments.slice(0, i + 2);
      trail.push({
        label: adminLabels[seg] || getLabel(seg, segments, i + 1),
        path: `/${slice.join("/")}`,
      });
    });
    return trail;
  }

  if (!segments.length) {
    return [{ label: "Dashboard", path: "/" }];
  }

  return [
    { label: "Dashboard", path: "/" },
    ...segments.map((seg, i) => ({
      label: getLabel(seg, segments, i),
      path: "/" + segments.slice(0, i + 1).join("/"),
    })),
  ];
}

/** Current page title from the last breadcrumb segment. */
export function getPageTitle(pathname) {
  const path = (pathname || "/").replace(/\/$/, "") || "/";
  if (PAGE_TITLE_OVERRIDES[path]) return PAGE_TITLE_OVERRIDES[path];
  const trail = getBreadcrumbTrail(pathname);
  return trail[trail.length - 1]?.label || "Dashboard";
}

export default function Breadcrumbs({ items: customItems, compact = false, className = "" }) {
  const { pathname } = useLocation();
  const items = customItems ?? getBreadcrumbTrail(pathname);

  if (items.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 print:hidden ${
        compact ? "text-xs" : ""
      } ${className}`}
    >
      {items.map((item, i) => (
        <span key={item.path + i} className="flex min-w-0 items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />}
          {i === items.length - 1 ? (
            <span className="truncate font-medium text-slate-700 dark:text-slate-200">
              {i === 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Home className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">Dashboard</span>
                </span>
              ) : (
                item.label
              )}
            </span>
          ) : (
            <Link
              to={item.path}
              className="flex items-center gap-1 truncate transition-colors hover:text-[var(--color-primary)]"
            >
              {i === 0 ? <Home className="h-3.5 w-3.5 shrink-0" aria-hidden /> : item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
