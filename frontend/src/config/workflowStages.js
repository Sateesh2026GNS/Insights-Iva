/**
 * Single source of truth for manufacturing workflow stages, routes, and status display.
 * Backend workflow_status values are canonical; display labels are user-facing only.
 */

export const WORKFLOW_STATUS_LABELS = {
  SALES_CONFIRMED: "Sales Confirmed",
  MATERIAL_CHECK_PENDING: "Pending Inventory Check",
  MATERIAL_AVAILABLE: "Materials Confirmed",
  MATERIAL_SHORTAGE: "Material Shortage",
  MATERIAL_PARTIAL: "Material Partial",
  WORKFLOW_ON_HOLD: "On Hold",
  STORE_ISSUE_PENDING: "Store Issue Pending",
  STORE_ISSUE_PARTIAL: "Store Issue Partial",
  READY_FOR_PRODUCTION: "Production Pending",
  PRODUCTION_ASSIGNED: "Assigned to Operator",
  PRODUCTION_IN_PROGRESS: "In Production",
  PRODUCTION_COMPLETED: "Production Completed",
  PRODUCTION_REWORK: "Rework Required",
  QUALITY_CHECK_PENDING: "Quality Pending",
  QUALITY_ON_HOLD: "Quality On Hold",
  QUALITY_APPROVED: "Quality Approved",
  QUALITY_REJECTED: "Quality Rejected",
  PACKING_PENDING: "Packing Pending",
  PACKING_IN_PROGRESS: "Packing In Progress",
  PACKED: "Packed",
  PACKING_ISSUE: "Packing Issue",
  BILLING_PENDING: "Billing Pending",
  INVOICED: "Invoiced",
  BILLING_HOLD: "Billing Hold",
  COMPLETED: "Completed",
  draft: "Draft",
  pending: "Pending",
  confirmed: "Sales Confirmed",
};

export const WORKFLOW_STATUS_VARIANTS = {
  SALES_CONFIRMED: "info",
  MATERIAL_CHECK_PENDING: "warning",
  MATERIAL_AVAILABLE: "success",
  MATERIAL_SHORTAGE: "danger",
  MATERIAL_PARTIAL: "warning",
  WORKFLOW_ON_HOLD: "neutral",
  STORE_ISSUE_PENDING: "warning",
  STORE_ISSUE_PARTIAL: "warning",
  READY_FOR_PRODUCTION: "info",
  PRODUCTION_ASSIGNED: "info",
  PRODUCTION_IN_PROGRESS: "info",
  PRODUCTION_COMPLETED: "success",
  PRODUCTION_REWORK: "warning",
  QUALITY_CHECK_PENDING: "warning",
  QUALITY_ON_HOLD: "warning",
  QUALITY_APPROVED: "success",
  QUALITY_REJECTED: "danger",
  PACKING_PENDING: "warning",
  PACKING_IN_PROGRESS: "info",
  PACKED: "success",
  PACKING_ISSUE: "danger",
  BILLING_PENDING: "warning",
  INVOICED: "success",
  BILLING_HOLD: "warning",
  COMPLETED: "success",
};

/** Stage definitions — route segment, backend stage key, queue filter, responsible role. */
export const WORKFLOW_STAGES = [
  {
    id: "sales",
    stageKey: "sales",
    routeSegment: null,
    label: "Sales Order",
    queueLabel: "Sales Confirmed",
    filterStatuses: ["SALES_CONFIRMED"],
    filterStatus: "SALES_CONFIRMED",
    responsibleRole: "Sales Manager",
    team: "sales",
    path: "/manufacturing/workflow?status=SALES_CONFIRMED",
  },
  {
    id: "inventory_check",
    stageKey: "inventory_check",
    routeSegment: "inventory",
    label: "Inventory Check",
    queueLabel: "Inventory Check",
    filterStatuses: ["MATERIAL_CHECK_PENDING"],
    filterStatus: "MATERIAL_CHECK_PENDING",
    responsibleRole: "Store Manager",
    team: "inventory",
    path: "/manufacturing/workflow?status=MATERIAL_CHECK_PENDING",
  },
  {
    id: "material_shortage",
    stageKey: "material_shortage",
    routeSegment: null,
    label: "Material Shortage",
    queueLabel: "Material Shortage",
    filterStatuses: ["MATERIAL_SHORTAGE", "MATERIAL_PARTIAL"],
    filterStatus: "MATERIAL_SHORTAGE",
    responsibleRole: "Store Manager",
    team: "inventory",
    path: "/manufacturing/workflow?status=MATERIAL_SHORTAGE",
  },
  {
    id: "store",
    stageKey: "store",
    routeSegment: "store",
    label: "Store Manager",
    queueLabel: "Store Issue",
    filterStatuses: ["MATERIAL_AVAILABLE", "STORE_ISSUE_PENDING", "STORE_ISSUE_PARTIAL"],
    filterStatus: "STORE_ISSUE_PENDING",
    responsibleRole: "Store Manager",
    team: "inventory",
    path: "/manufacturing/workflow?status=STORE_ISSUE_PENDING",
  },
  {
    id: "production_manager",
    stageKey: "production_manager",
    routeSegment: "production",
    label: "Production Manager",
    queueLabel: "Production",
    filterStatuses: ["READY_FOR_PRODUCTION", "PRODUCTION_REWORK", "QUALITY_REJECTED"],
    filterStatus: "READY_FOR_PRODUCTION",
    responsibleRole: "Production Manager",
    team: "production",
    path: "/manufacturing/workflow?status=READY_FOR_PRODUCTION",
  },
  {
    id: "operator",
    stageKey: "operator",
    routeSegment: "operator",
    label: "Operator",
    queueLabel: "Operator",
    filterStatuses: ["PRODUCTION_ASSIGNED", "PRODUCTION_IN_PROGRESS"],
    filterStatus: "PRODUCTION_ASSIGNED",
    responsibleRole: "Operator",
    team: "operator",
    path: "/production/operator-jobs",
  },
  {
    id: "quality",
    stageKey: "quality",
    routeSegment: "quality",
    label: "Quality Check",
    queueLabel: "Quality Pending",
    filterStatuses: ["QUALITY_CHECK_PENDING", "QUALITY_ON_HOLD"],
    filterStatus: "QUALITY_CHECK_PENDING",
    responsibleRole: "Quality Team",
    team: "quality",
    path: "/manufacturing/workflow?status=QUALITY_CHECK_PENDING",
  },
  {
    id: "packing",
    stageKey: "packing",
    routeSegment: "packing",
    label: "Packing & Dispatch",
    queueLabel: "Packing",
    filterStatuses: ["QUALITY_APPROVED", "PACKING_PENDING", "PACKING_IN_PROGRESS", "PACKING_ISSUE"],
    filterStatus: "PACKING_PENDING",
    responsibleRole: "Store Manager",
    team: "packing",
    path: "/manufacturing/workflow?status=PACKING_PENDING",
  },
  {
    id: "billing",
    stageKey: "billing",
    routeSegment: "billing",
    label: "Billing",
    queueLabel: "Billing Pending",
    filterStatuses: ["BILLING_PENDING", "BILLING_HOLD", "PACKED"],
    filterStatus: "BILLING_PENDING",
    responsibleRole: "Accountant",
    team: "billing",
    path: "/manufacturing/workflow?status=BILLING_PENDING",
  },
  {
    id: "completed",
    stageKey: "completed",
    routeSegment: null,
    label: "Completed",
    queueLabel: "Completed",
    filterStatuses: ["COMPLETED"],
    filterStatus: "COMPLETED",
    responsibleRole: "Admin",
    team: "admin",
    path: "/manufacturing/workflow?status=COMPLETED",
  },
];

export const ROUTE_SEGMENT_TO_STAGE = Object.fromEntries(
  WORKFLOW_STAGES.filter((s) => s.routeSegment).map((s) => [s.routeSegment, s.stageKey])
);

export const STAGE_TITLES = Object.fromEntries(
  WORKFLOW_STAGES.filter((s) => s.stageKey !== "sales" && s.stageKey !== "completed").map((s) => [
    s.stageKey,
    `${s.label} Job Card`,
  ])
);

STAGE_TITLES.sales = "Sales Job Card";
STAGE_TITLES.inventory_check = "Store Manager · Inventory Check";

export function getWorkflowStatusLabel(status) {
  const key = String(status || "").toUpperCase();
  return WORKFLOW_STATUS_LABELS[key] || WORKFLOW_STATUS_LABELS[status] || status || "—";
}

export function getWorkflowStatusVariant(status) {
  const key = String(status || "").toUpperCase();
  return WORKFLOW_STATUS_VARIANTS[key] || "neutral";
}

export function getStageByRouteSegment(segment) {
  return WORKFLOW_STAGES.find((s) => s.routeSegment === segment);
}

export function getStageNavLinks(orderId) {
  return WORKFLOW_STAGES.filter((s) => s.routeSegment).map((s) => ({
    key: s.stageKey,
    label: s.label.split(" ")[0],
    path: `/manufacturing/workflow/order/${orderId}/${s.routeSegment}`,
  }));
}

export function getRoleQueueStages(roleName) {
  const map = {
    Admin: WORKFLOW_STAGES,
    "Sales Manager": WORKFLOW_STAGES.filter((s) => s.team === "sales" || s.id === "completed"),
    "Store Manager": WORKFLOW_STAGES.filter(
      (s) =>
        s.team === "inventory" ||
        s.team === "packing" ||
        s.id === "completed"
    ),
    "Production Manager": WORKFLOW_STAGES.filter(
      (s) =>
        s.id === "production_manager" ||
        s.id === "quality" ||
        s.id === "operator" ||
        s.id === "completed"
    ),
    Operator: WORKFLOW_STAGES.filter((s) => s.team === "operator" || s.id === "completed"),
    Accountant: WORKFLOW_STAGES.filter((s) => s.team === "billing" || s.id === "completed"),
    "Quality Team": WORKFLOW_STAGES.filter(
      (s) => s.team === "quality" || s.id === "completed"
    ),
    "Packing & Dispatch": WORKFLOW_STAGES.filter(
      (s) => s.team === "packing" || s.id === "completed"
    ),
  };
  return map[roleName] || WORKFLOW_STAGES.filter((s) => s.id !== "completed");
}

/** Tracker step keys aligned with backend build_workflow_tracker. */
export const WORKFLOW_TRACKER_STEPS = [
  { key: "sales_order", label: "Sales Confirmed" },
  { key: "inventory_check", label: "Inventory Check" },
  { key: "store", label: "Materials Confirmed" },
  { key: "production_manager", label: "Production Manager" },
  { key: "operator", label: "Operator" },
  { key: "quality", label: "Quality Check" },
  { key: "packing", label: "Packing" },
  { key: "dispatch", label: "Dispatch" },
  { key: "billing", label: "Billing" },
  { key: "completed", label: "Completed" },
];
