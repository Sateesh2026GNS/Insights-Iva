import { CalendarClock, ClipboardCheck, FileText, GitBranch, ListChecks, Package, ShoppingCart, Star, Target, Truck, UserRound, Users, Wallet } from "lucide-react";

/** End-to-end manufacturing workflow steps for Insights Iva. */

export const MANUFACTURING_WORKFLOW_STEPS = [
  { id: "sales_order", label: "Sales Order", shortLabel: "Sales Order", path: "/sales/orders" },
  { id: "production_planning", label: "Production Planning", shortLabel: "Production Planning", path: "/production/planning" },
  { id: "bom", label: "Bill of Materials (BOM)", shortLabel: "Bill of Materials", path: "/masters/bom" },
  { id: "purchase_request", label: "Purchase Request", shortLabel: "Purchase Request", path: "/procurement/material-requests" },
  { id: "purchase_order", label: "Purchase Order", shortLabel: "Purchase Order", path: "/procurement/purchase-orders" },
  { id: "grn", label: "Goods Receipt Note (GRN)", shortLabel: "Goods Receipt", path: "/procurement/goods-receipt" },
  { id: "raw_material", label: "Raw Material", shortLabel: "Raw Material", path: "/inventory/raw-materials" },
  { id: "schedule", label: "Schedule", shortLabel: "Schedule", path: "/production/schedule" },
  { id: "work_order", label: "Work Order", shortLabel: "Work Order", path: "/production/work-orders" },
  { id: "machine_assign", label: "Machine Assign", shortLabel: "Machine Assign", path: "/production/tasks" },
  { id: "material_issue", label: "Material Issue", shortLabel: "Material Issue", path: "/production/work-orders" },
  { id: "production", label: "Production", shortLabel: "Production", path: "/production/job-card" },
  { id: "quality", label: "Quality", shortLabel: "Quality", path: "/quality/final" },
  { id: "finished_goods", label: "Finished Goods", shortLabel: "Finished Goods", path: "/inventory/finished-goods" },
  { id: "dispatch", label: "Dispatch", shortLabel: "Dispatch", path: "/sales/dispatch" },
  { id: "invoice", label: "Invoice", shortLabel: "Invoice", path: "/sales/invoices" },
  { id: "payment", label: "Payment", shortLabel: "Payment", path: "/sales/payments" },
  { id: "dashboard", label: "Dashboard", shortLabel: "Dashboard", path: "/" },
];

/** Manufacturing spine shown on Production Planning. */
export const PLANNING_SPINE_STEP_IDS = [
  "sales_order",
  "production_planning",
  "bom",
  "purchase_request",
  "purchase_order",
  "grn",
  "raw_material",
  "schedule",
  "machine_assign",
  "material_issue",
  "production",
  "quality",
];

/** Card accent cycle matching the Role Workflow mockup: blue → green → purple → orange. */
export const RESPONSIBILITY_ACCENTS = [
  {
    iconWrap: "bg-sky-100 text-sky-600",
    role: "text-sky-600",
    hover: "hover:border-sky-300",
    active: "border-sky-400 ring-1 ring-sky-200",
  },
  {
    iconWrap: "bg-emerald-100 text-emerald-600",
    role: "text-emerald-600",
    hover: "hover:border-emerald-300",
    active: "border-emerald-500 ring-1 ring-emerald-200",
  },
  {
    iconWrap: "bg-violet-100 text-violet-600",
    role: "text-violet-600",
    hover: "hover:border-violet-300",
    active: "border-violet-400 ring-1 ring-violet-200",
  },
  {
    iconWrap: "bg-orange-100 text-orange-500",
    role: "text-orange-500",
    hover: "hover:border-orange-300",
    active: "border-orange-400 ring-1 ring-orange-200",
  },
];

const DEFAULT_ICON = FileText;

/** Icons for the first 12 Role Workflow / My Responsibilities cards. */
export const RESPONSIBILITY_ICONS = {
  enquiry: UserRound,
  quotation: FileText,
  quotation_approval: Target,
  quotation_sent: GitBranch,
  sales_order: ClipboardCheck,
  production_planning: Users,
  bom: ListChecks,
  capacity: CalendarClock,
  purchase_request: ShoppingCart,
  purchase_order: Package,
  grn: Star,
};

export const DEFAULT_RESPONSIBILITY_STAGES = [
  {
    id: "enquiry",
    label: "Customer Enquiry",
    responsible_role: "Sales Manager",
    path: "/sales/leads",
    tasks: ["Resolve customer enquiry", "Capture requirements"],
  },
  {
    id: "quotation",
    label: "Quotation Prep",
    responsible_role: "Sales Manager",
    path: "/sales/quotations",
    tasks: ["Prepare quotation", "Price, GST, validity"],
  },
  {
    id: "quotation_approval",
    label: "Quote Internal Approval",
    responsible_role: "Sales Manager",
    path: "/sales/quotations",
    tasks: ["Submit for approval", "Manage approve / reject"],
  },
  {
    id: "quotation_sent",
    label: "Quote Sent / Confirm",
    responsible_role: "Sales Manager",
    path: "/sales/quotations",
    tasks: ["Send to customer", "Customer confirmation"],
  },
  {
    id: "sales_order",
    label: "Sales Order",
    responsible_role: "Sales Manager",
    path: "/sales/orders",
    tasks: ["Create SO", "Approve / Confirm → Planning"],
  },
  {
    id: "production_planning",
    label: "Production Planning",
    responsible_role: "Production Manager",
    path: "/production/planning",
    tasks: ["Review SO", "Create production plan"],
  },
  {
    id: "bom",
    label: "BOM",
    responsible_role: "Production Manager",
    path: "/masters/bom",
    tasks: ["Load active BOM", "Verify components"],
  },
  {
    id: "capacity",
    label: "Capacity / Schedule",
    responsible_role: "Production Manager",
    path: "/production/schedule",
    tasks: ["Machine capacity check", "Production schedule"],
  },
  {
    id: "purchase_request",
    label: "Purchase Requisition",
    responsible_role: "Production Manager",
    path: "/procurement/material-requests",
    tasks: ["Review shortages", "PM approve PR"],
  },
  {
    id: "purchase_order",
    label: "Purchase Order",
    responsible_role: "Production Manager",
    path: "/procurement/purchase-orders",
    tasks: ["Create PO", "Supplier confirmation"],
  },
  {
    id: "grn",
    label: "GRN",
    responsible_role: "Store Manager",
    path: "/procurement/goods-receipt",
    tasks: ["Material receipt", "Create GRN"],
  },
];

export function getResponsibilityAccent(index) {
  return RESPONSIBILITY_ACCENTS[index % RESPONSIBILITY_ACCENTS.length];
}

export function getResponsibilityIcon(stageId) {
  return RESPONSIBILITY_ICONS[stageId] || DEFAULT_ICON;
}

/** Nine high-level phases (Enquiry → Closure) displayed in the workflow legend. */
export const WORKFLOW_PHASES = [
  { id: 1, label: "Enquiry & Order" },
  { id: 2, label: "Planning" },
  { id: 3, label: "Procurement" },
  { id: 4, label: "Inventory" },
  { id: 5, label: "Scheduling" },
  { id: 6, label: "Production" },
  { id: 7, label: "Quality" },
  { id: 8, label: "Dispatch & Invoicing" },
  { id: 9, label: "Closure & Payment" },
];

/** Roles that are allowed to view the full manufacturing workflow chain. */
const FULL_ACCESS_ROLES = ["admin", "management", "manager", "superadmin", "super_admin", "super_user"];

/**
 * Extract the primary role name string from a user object.
 * Handles both `user.role` (string) and `user.roles` (array) shapes.
 * Also accepts a plain role string directly.
 * @param {object|string|null} user
 * @returns {string}
 */
export function getPrimaryRoleName(user) {
  if (!user) return "";
  if (typeof user === "string") return user;
  if (typeof user.role === "string") return user.role;
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    const first = user.roles[0];
    return typeof first === "string" ? first : first?.name ?? "";
  }
  return "";
}

/**
 * Returns true when the given role should see the full manufacturing workflow
 * (admin / management) rather than only their department stages.
 * @param {string} roleName
 * @returns {boolean}
 */
export function canViewFullWorkflow(roleName) {
  if (!roleName) return false;
  return FULL_ACCESS_ROLES.includes(roleName.toLowerCase());
}

/** Map ERP role names to workflow team keys (mirrors backend ROLE_TO_TEAMS). */
const ROLE_TEAM_MAP = {
  Admin: ["admin", "sales", "inventory", "production", "operator", "quality", "packing", "billing"],
  "Sales Manager": ["sales"],
  "Store Manager": ["inventory", "packing"],
  "Production Manager": ["production", "quality"],
  Operator: ["operator"],
  Accountant: ["billing"],
  "Purchase Manager": ["inventory"],
  "Procurement Manager": ["inventory"],
};

export function getUserWorkflowTeams(user) {
  if (!user) return [];
  const roles = [];
  if (typeof user.role === "string") roles.push(user.role);
  if (Array.isArray(user.roles)) {
    user.roles.forEach((r) => roles.push(typeof r === "string" ? r : r?.name));
  }
  const teams = new Set();
  roles.filter(Boolean).forEach((name) => {
    (ROLE_TEAM_MAP[name] || []).forEach((t) => teams.add(t));
  });
  if (canViewFullWorkflow(getPrimaryRoleName(user))) {
    ["admin", "sales", "inventory", "production", "operator", "quality", "packing", "billing"].forEach(
      (t) => teams.add(t)
    );
  }
  return [...teams];
}

export function userHasWorkflowTeam(user, team) {
  return getUserWorkflowTeams(user).includes(team);
}

/** End-to-end manufacturing team job cards (Sales → Billing). */
export const TEAM_WORKFLOW_JOB_CARDS = [
  {
    id: "sales",
    team: "sales",
    label: "Sales",
    role: "Sales Manager",
    icon: ShoppingCart,
    statuses: ["draft", "SALES_CONFIRMED"],
    whenShown: "Draft or new sales order",
    actions: ["Create sales order", "Confirm order → send to Inventory"],
    filterStatus: "SALES_CONFIRMED",
    path: "/sales/orders",
  },
  {
    id: "inventory",
    team: "inventory",
    label: "Inventory",
    role: "Store Manager",
    icon: Package,
    statuses: ["MATERIAL_CHECK_PENDING", "MATERIAL_SHORTAGE", "MATERIAL_PARTIAL", "MATERIAL_AVAILABLE"],
    whenShown: "After sales confirmation",
    actions: ["Verify materials", "Check stock & shortages", "Release to Production"],
    filterStatus: "MATERIAL_CHECK_PENDING",
    path: "/inventory/raw-materials",
  },
  {
    id: "production",
    team: "production",
    label: "Production Manager",
    role: "Production Manager",
    icon: Users,
    statuses: ["READY_FOR_PRODUCTION", "PRODUCTION_ASSIGNED", "PRODUCTION_REWORK", "QUALITY_REJECTED"],
    whenShown: "Materials available",
    actions: ["Review job card", "Assign operator & machine", "Set schedule"],
    filterStatus: "READY_FOR_PRODUCTION",
    path: "/production/planning",
  },
  {
    id: "operator",
    team: "operator",
    label: "Operator",
    role: "Operator",
    icon: UserRound,
    statuses: ["PRODUCTION_ASSIGNED", "PRODUCTION_IN_PROGRESS"],
    whenShown: "After manager assignment",
    actions: ["Start production", "Update progress", "Complete production"],
    filterStatus: "PRODUCTION_ASSIGNED",
    path: "/production/tasks",
  },
  {
    id: "quality",
    team: "quality",
    label: "Quality",
    role: "Quality Team",
    icon: ClipboardCheck,
    statuses: ["QUALITY_CHECK_PENDING"],
    whenShown: "After production completed",
    actions: ["Inspect output", "Record defects", "Pass / Fail / Partial"],
    filterStatus: "QUALITY_CHECK_PENDING",
    path: "/quality/final",
  },
  {
    id: "packing",
    team: "packing",
    label: "Packing & Dispatch",
    role: "Store Manager",
    icon: Truck,
    statuses: ["QUALITY_APPROVED", "PACKING_PENDING", "PACKING_IN_PROGRESS", "PACKED"],
    whenShown: "After quality approval",
    actions: ["Pack goods", "Enter dispatch details", "LR / tracking number"],
    filterStatus: "PACKING_PENDING",
    path: "/sales/dispatch",
  },
  {
    id: "billing",
    team: "billing",
    label: "Billing",
    role: "Accountant",
    icon: Wallet,
    statuses: ["BILLING_PENDING", "BILLING_HOLD", "PACKED"],
    whenShown: "After packing completed",
    actions: ["Create GST invoice", "Record billing status", "Complete order"],
    filterStatus: "BILLING_PENDING",
    path: "/sales/invoices",
  },
];

/**
 * Map a page/context key to the current step index in the manufacturing spine.
 * @param {string} currentStepId
 * @returns {number}
 */
export function getWorkflowStepIndex(currentStepId) {
  const idx = MANUFACTURING_WORKFLOW_STEPS.findIndex((s) => s.id === currentStepId);
  return idx >= 0 ? idx : 0;
}

/**
 * Build step statuses relative to the current step.
 * @param {string} currentStepId
 * @param {{ roleName?: string, filterByRole?: boolean, stepIds?: string[] }} [options]
 * @returns {{ id: string, label: string, shortLabel?: string, path: string, state: 'completed'|'current'|'pending' }[]}
 */
export function buildWorkflowProgress(currentStepId, options = {}) {
  const { filterByRole = false, stepIds = null } = options;
  const fullCurrent = getWorkflowStepIndex(currentStepId);
  const catalog =
    Array.isArray(stepIds) && stepIds.length
      ? stepIds
          .map((id) => MANUFACTURING_WORKFLOW_STEPS.find((s) => s.id === id))
          .filter(Boolean)
      : MANUFACTURING_WORKFLOW_STEPS;

  const steps = catalog.map((step) => {
    const fullIdx = getWorkflowStepIndex(step.id);
    const state =
      fullIdx < fullCurrent ? "completed" : fullIdx === fullCurrent ? "current" : "pending";
    return { ...step, state };
  });

  // When filterByRole is true, show a focused window around the current step.
  // Full role-based filtering is handled by the backend via getManufacturingWorkflowBoard.
  if (filterByRole) {
    const current = steps.findIndex((s) => s.state === "current");
    const focus = current >= 0 ? current : 0;
    return steps.filter(
      (_, i) => i >= Math.max(0, focus - 2) && i <= Math.min(steps.length - 1, focus + 2)
    );
  }

  return steps;
}
