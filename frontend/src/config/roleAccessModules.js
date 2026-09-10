/**
 * Module groups for the New Role segmented access control UI.
 * `moduleCode` maps to backend rbac_constants.MODULE_CATALOG codes.
 */

export const ROLE_TYPE_OPTIONS = [
  { value: "user", label: "User" },
  { value: "system", label: "System" },
];

export const ROLE_ACCESS_MODULES = [
  {
    id: "contacts",
    moduleCode: "masters",
    label: "Contacts",
    layout: "table",
    particulars: [
      { key: "customers", label: "Customers", morePermissions: true },
      { key: "vendors", label: "Vendors" },
    ],
  },
  {
    id: "employee",
    moduleCode: "hr",
    label: "Employee",
    layout: "table",
    particulars: [
      { key: "basic", label: "Basic And Personal Details" },
      { key: "salary", label: "Salary Details" },
      { key: "payment", label: "Payment Information" },
      { key: "salary_revision", label: "Salary Revision" },
      { key: "declarations", label: "Declarations" },
    ],
  },
  {
    id: "salesperson",
    moduleCode: "sales",
    label: "Salesperson",
    layout: "table",
    particulars: [{ key: "salesperson", label: "Salesperson" }],
  },
  {
    id: "items",
    moduleCode: "masters",
    label: "Items",
    layout: "table",
    particulars: [
      { key: "item", label: "Item", morePermissions: true },
      { key: "composite", label: "Composite Items" },
      { key: "price_list", label: "Price List" },
    ],
  },
  {
    id: "inventory",
    moduleCode: "inventory",
    label: "Inventory",
    layout: "table",
    particulars: [
      { key: "adjustments", label: "Inventory Adjustments", morePermissions: true },
      { key: "picklist", label: "Picklist" },
      { key: "transfer", label: "Transfer Orders", morePermissions: true },
      { key: "move", label: "Move Order" },
    ],
  },
  {
    id: "sales",
    moduleCode: "sales",
    label: "Sales",
    layout: "table",
    particulars: [
      { key: "quotes", label: "Quotes", morePermissions: true },
      { key: "orders", label: "Sales Orders" },
      { key: "invoices", label: "Invoices", morePermissions: true },
      { key: "payments", label: "Customer Payments" },
      { key: "shipping", label: "Shipment Order", morePermissions: true },
    ],
  },
  {
    id: "purchases",
    moduleCode: "procurement",
    label: "Purchases",
    layout: "table",
    particulars: [
      { key: "requests", label: "Purchase Request" },
      { key: "orders", label: "Purchase Orders" },
      { key: "receive", label: "Purchase Receive" },
      { key: "bills", label: "Bills" },
    ],
  },
  {
    id: "payroll",
    moduleCode: "hr",
    label: "Payroll",
    layout: "table",
    particulars: [
      { key: "payroll_run", label: "Payroll Run", morePermissions: true },
      { key: "loan", label: "Loan", morePermissions: true },
      { key: "reimbursements", label: "Reimbursements" },
    ],
  },
  {
    id: "travel",
    moduleCode: "hr",
    label: "Travel and Expense",
    layout: "table",
    particulars: [
      { key: "trips", label: "Trips" },
      { key: "expense_report", label: "Expense Report", morePermissions: true },
    ],
  },
  {
    id: "timesheets",
    moduleCode: "hr",
    label: "Timesheets",
    layout: "table",
    particulars: [{ key: "projects", label: "Projects", morePermissions: true }],
  },
  {
    id: "tasks",
    moduleCode: "production",
    label: "Tasks",
    layout: "table",
    particulars: [{ key: "tasks", label: "Tasks", morePermissions: true }],
  },
  {
    id: "manufacturing",
    moduleCode: "production",
    label: "Manufacturing",
    layout: "table",
    particulars: [
      { key: "job_card", label: "Job Card", morePermissions: true },
      { key: "work_orders", label: "Work Orders" },
      { key: "bom", label: "Bill of Materials", morePermissions: true },
      { key: "mfg_order", label: "Manufacturing Order" },
      { key: "shop_floor", label: "Shop Floor", morePermissions: true },
    ],
  },
  {
    id: "quality",
    moduleCode: "quality",
    label: "Quality",
    layout: "table",
    particulars: [
      { key: "templates", label: "Quality Templates" },
      { key: "inspection", label: "Quality Inspection", morePermissions: true },
      { key: "worklist", label: "Inspection Worklist", morePermissions: true },
    ],
  },
  {
    id: "eway_bill",
    moduleCode: "sales",
    label: "e-Way Bill",
    layout: "simple",
    particulars: [
      { key: "generate", label: "Generate e-Way Bill" },
      { key: "cancel", label: "Cancel e-Way Bill" },
    ],
  },
  {
    id: "gst_filing",
    moduleCode: "accounts",
    label: "GST Filing",
    layout: "simple",
    particulars: [
      { key: "view_return", label: "View and Generate Return" },
      { key: "push", label: "Push Transactions" },
      { key: "reconcile", label: "Reconcile Transactions" },
      { key: "file", label: "File Returns" },
    ],
  },
  {
    id: "income_tds",
    moduleCode: "accounts",
    label: "Income TDS",
    layout: "table",
    particulars: [{ key: "tds_payment", label: "Income TDS Payment" }],
  },
  {
    id: "accounting",
    moduleCode: "accounts",
    label: "Accounting",
    layout: "table",
    particulars: [
      { key: "journals", label: "Journals" },
      { key: "chart", label: "Chart of Accounts", morePermissions: true },
      { key: "fixed_asset", label: "Fixed Asset" },
      { key: "banking", label: "Banking" },
      { key: "registers", label: "Chart of Account Registers" },
      { key: "netting", label: "Netting" },
    ],
  },
  {
    id: "budget",
    moduleCode: "accounts",
    label: "Budget",
    layout: "table",
    particulars: [{ key: "budget", label: "Budget" }],
  },
  {
    id: "documents",
    moduleCode: "documents",
    label: "Documents",
    layout: "list",
    listPermissions: [
      { key: "view", label: "View Documents" },
      { key: "upload", label: "Upload Documents" },
      { key: "delete", label: "Delete Documents" },
      { key: "folder", label: "Manage Folder" },
    ],
  },
  {
    id: "bharat_connect",
    moduleCode: "settings",
    label: "Bharat Connect",
    layout: "list",
    listPermissions: [
      { key: "send", label: "Send Transactions via Bharat Connect" },
      { key: "accept", label: "Accept Transactions from Bharat Connect" },
      { key: "manage", label: "Manage Bharat Connect Integration" },
    ],
  },
  {
    id: "loyalty",
    moduleCode: "sales",
    label: "Loyalty",
    layout: "table",
    particulars: [{ key: "loyalty_mgmt", label: "Loyalty Management", morePermissions: true }],
  },
];

export const PERMISSION_COLUMNS = [
  { key: "full", label: "Full" },
  { key: "view", label: "View", action: "read" },
  { key: "create", label: "Create", action: "create" },
  { key: "edit", label: "Edit", action: "update" },
  { key: "delete", label: "Delete", action: "delete" },
  { key: "approve", label: "Approve", action: "approve" },
];

/** Extra granular permissions shown in the "More Permissions" popover per row. */
export const MORE_PERMISSIONS_BY_ROW = {
  "contacts.customers": [
    { key: "communication", label: "Communication", action: "read" },
    { key: "statement", label: "Statement", action: "read" },
    { key: "import", label: "Import", action: "create" },
    { key: "export", label: "Export", action: "read" },
  ],
  "items.item": [
    { key: "item_group", label: "Item Group", action: "read" },
    { key: "opening_stock", label: "Opening Stock", action: "update" },
    { key: "price_list", label: "Price List", action: "read" },
  ],
  "inventory.adjustments": [
    { key: "reason_code", label: "Reason Code", action: "read" },
    { key: "bulk_update", label: "Bulk Update", action: "update" },
  ],
  "inventory.transfer": [
    { key: "initiate", label: "Initiate Transfer", action: "create" },
    { key: "receive", label: "Receive Transfer", action: "update" },
  ],
  "sales.quotes": [
    { key: "convert", label: "Convert to Sales Order", action: "create" },
    { key: "email", label: "Email Quote", action: "read" },
  ],
  "sales.invoices": [
    { key: "email", label: "Email Invoice", action: "read" },
    { key: "payment", label: "Record Payment", action: "create" },
    { key: "write_off", label: "Write Off", action: "update" },
  ],
  "sales.shipping": [
    { key: "pack", label: "Pack Shipment", action: "update" },
    { key: "deliver", label: "Mark Delivered", action: "update" },
  ],
  "payroll.payroll_run": [
    { key: "process", label: "Process Payroll", action: "create" },
    { key: "approve", label: "Approve Payroll", action: "approve" },
  ],
  "payroll.loan": [
    { key: "approve", label: "Approve Loan", action: "approve" },
    { key: "disburse", label: "Disburse Loan", action: "create" },
  ],
  "travel.expense_report": [
    { key: "approve", label: "Approve Expense", action: "approve" },
    { key: "reimburse", label: "Reimburse", action: "update" },
  ],
  "timesheets.projects": [
    { key: "log_time", label: "Log Time", action: "create_entry" },
    { key: "approve_time", label: "Approve Time", action: "approve" },
  ],
  "tasks.tasks": [
    { key: "assign", label: "Assign Task", action: "update" },
    { key: "complete", label: "Complete Task", action: "update" },
  ],
  "manufacturing.job_card": [
    { key: "start", label: "Start Job", action: "update" },
    { key: "complete", label: "Complete Job", action: "update" },
    { key: "downtime", label: "Report Downtime", action: "report_breakdown" },
  ],
  "manufacturing.bom": [
    { key: "approve", label: "Approve BOM", action: "approve" },
    { key: "clone", label: "Clone BOM", action: "create" },
  ],
  "manufacturing.shop_floor": [
    { key: "machine_status", label: "Machine Status", action: "update_machine_status" },
    { key: "production_entry", label: "Production Entry", action: "create_entry" },
  ],
  "quality.inspection": [
    { key: "approve", label: "Approve Inspection", action: "approve" },
    { key: "reject", label: "Reject Batch", action: "update" },
  ],
  "quality.worklist": [
    { key: "assign", label: "Assign Inspector", action: "update" },
  ],
  "accounting.chart": [
    { key: "register", label: "Account Register", action: "read" },
    { key: "lock", label: "Transaction Lock", action: "update" },
  ],
  "loyalty.loyalty_mgmt": [
    { key: "points_adjust", label: "Points Adjustment", action: "update" },
    { key: "redeem", label: "Redeem Points", action: "update" },
  ],
};

const DEFAULT_MORE_PERMISSIONS = [
  { key: "communication", label: "Communication", action: "read" },
  { key: "statement", label: "Statement", action: "read" },
  { key: "import", label: "Import", action: "create" },
  { key: "export", label: "Export", action: "read" },
];

export function getMorePermissions(modId, particularKey) {
  return MORE_PERMISSIONS_BY_ROW[`${modId}.${particularKey}`] || DEFAULT_MORE_PERMISSIONS;
}

export function extraCodesForRow(moduleCode, row = {}, modId, particularKey) {
  const codes = [];
  getMorePermissions(modId, particularKey).forEach((perm) => {
    if (row.extras?.[perm.key] && perm.action) {
      codes.push(`${moduleCode}:${perm.action}`);
    }
  });
  return codes;
}

export function rowHasExtraGrants(row = {}) {
  return Boolean(row.extras && Object.values(row.extras).some(Boolean));
}

export function isRowFullyGranted(row = {}, morePermissions = []) {
  const baseFull = PERMISSION_COLUMNS.filter((c) => c.key !== "full").every((c) => row[c.key]);
  const extrasFull =
    !morePermissions.length || morePermissions.every((perm) => row.extras?.[perm.key]);
  return Boolean(baseFull && extrasFull);
}

export function fullGrantRow(morePermissions = []) {
  const row = emptyGrantRow(morePermissions);
  row.full = true;
  row.view = true;
  row.create = true;
  row.edit = true;
  row.delete = true;
  row.approve = true;
  morePermissions.forEach((perm) => {
    row.extras[perm.key] = true;
  });
  return row;
}

export function emptyGrantRow(morePermissions = []) {
  const extras = {};
  morePermissions.forEach((perm) => {
    extras[perm.key] = false;
  });
  return {
    full: false,
    view: false,
    create: false,
    edit: false,
    delete: false,
    approve: false,
    extras,
  };
}

export function buildEmptyGrants(modules = ROLE_ACCESS_MODULES) {
  const grants = {};
  modules.forEach((mod) => {
    grants[mod.id] = {};
    if (mod.layout === "list" && mod.listPermissions) {
      mod.listPermissions.forEach((p) => {
        grants[mod.id][p.key] = false;
      });
    } else {
      mod.particulars.forEach((p) => {
        const more = p.morePermissions ? getMorePermissions(mod.id, p.key) : [];
        grants[mod.id][p.key] = emptyGrantRow(more);
      });
    }
  });
  return grants;
}

const COL_BY_ACTION = {
  read: "view",
  create: "create",
  update: "edit",
  delete: "delete",
  approve: "approve",
};

export function grantsToPermissionCodes(grants, modules = ROLE_ACCESS_MODULES) {
  const codes = new Set();
  modules.forEach((mod) => {
    const moduleCode = mod.moduleCode;
    const section = grants[mod.id] || {};

    if (mod.layout === "list") {
      const any = mod.listPermissions?.some((p) => section[p.key]);
      if (any) codes.add(moduleCode);
      return;
    }

    if (mod.layout === "simple") {
      const any = mod.particulars?.some((p) => section[p.key]?.view || section[p.key]?.full);
      if (any) codes.add(moduleCode);
      return;
    }

    let moduleFull = false;
    let anyGranular = false;
    mod.particulars.forEach((particular) => {
      const row = section[particular.key];
      if (!row || typeof row !== "object") return;
      if (row.full) moduleFull = true;
      PERMISSION_COLUMNS.forEach((col) => {
        if (col.key !== "full" && row[col.key]) {
          codes.add(`${moduleCode}:${col.action}`);
          anyGranular = true;
        }
      });
      extraCodesForRow(moduleCode, row, mod.id, particular.key).forEach((code) => {
        codes.add(code);
        anyGranular = true;
      });
    });
    if (moduleFull) codes.add(moduleCode);
    else if (anyGranular) {
      // granular only
    } else if (
      mod.particulars.some((particular) => {
        const row = section[particular.key];
        return row && typeof row === "object" && (PERMISSION_COLUMNS.some((col) => row[col.key]) || rowHasExtraGrants(row));
      })
    ) {
      codes.add(moduleCode);
    }
  });
  return [...codes];
}

export function permissionCodesToGrants(codes = [], modules = ROLE_ACCESS_MODULES) {
  const grants = buildEmptyGrants(modules);
  const backendModules = new Set(codes.filter((c) => !c.includes(":")));

  modules.forEach((mod) => {
    if (mod.layout === "list") {
      if (backendModules.has(mod.moduleCode)) {
        mod.listPermissions?.forEach((p) => {
          grants[mod.id][p.key] = true;
        });
      }
      return;
    }

    const modGranular = codes.filter((c) => c.startsWith(`${mod.moduleCode}:`));
    if (backendModules.has(mod.moduleCode) && modGranular.length === 0) {
      mod.particulars.forEach((p) => {
        const more = p.morePermissions ? getMorePermissions(mod.id, p.key) : [];
        grants[mod.id][p.key] = fullGrantRow(more);
      });
    }

    modGranular.forEach((code) => {
      const action = code.split(":", 2)[1];
      const col = COL_BY_ACTION[action];
      mod.particulars.forEach((p) => {
        const more = p.morePermissions ? getMorePermissions(mod.id, p.key) : [];
        const row = grants[mod.id][p.key];
        if (col) {
          row[col] = true;
        }
        more.forEach((perm) => {
          if (perm.action === action) {
            row.extras[perm.key] = true;
          }
        });
        row.full = isRowFullyGranted(row, more);
      });
    });
  });

  return grants;
}

export function sectionHasAnyGrant(mod, sectionGrants = {}) {
  if (mod.layout === "list") {
    return mod.listPermissions?.some((p) => sectionGrants[p.key]) || false;
  }
  if (mod.layout === "simple") {
    return mod.particulars?.some((p) => {
      const row = sectionGrants[p.key];
      return row?.view || row?.full;
    }) || false;
  }
  return Object.values(sectionGrants).some(
    (row) =>
      row &&
      typeof row === "object" &&
      (PERMISSION_COLUMNS.some((col) => row[col.key]) || rowHasExtraGrants(row))
  );
}

export function sectionIsFullAccess(mod, sectionGrants = {}) {
  if (mod.layout === "list") {
    return mod.listPermissions?.every((p) => sectionGrants[p.key]) || false;
  }
  if (mod.layout === "simple") {
    return mod.particulars?.every((p) => {
      const row = sectionGrants[p.key];
      return row?.view || row?.full;
    }) || false;
  }
  if (!mod.particulars?.length) return false;
  return mod.particulars.every((p) => {
    const row = sectionGrants[p.key];
    const more = p.morePermissions ? getMorePermissions(mod.id, p.key) : [];
    return row?.full || isRowFullyGranted(row, more);
  });
}
