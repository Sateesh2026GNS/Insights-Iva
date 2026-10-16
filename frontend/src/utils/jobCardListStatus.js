/** ERP list status labels for My Job Cards table and filters. */

import { rowStatusLabel } from "./jobCardQueueDisplay";

const WORKFLOW_STATUS_TONES = {
  DRAFT: "neutral",
  SAVED: "neutral",
  RETURNED_TO_SALES: "warning",
  MATERIAL_CHECK_PENDING: "warning",
  STORE_REVIEWED: "info",
  MATERIAL_AVAILABLE: "success",
  STORE_ISSUE_PENDING: "info",
  READY_FOR_PRODUCTION: "progress",
  COMPLETED: "success",
  INVOICED: "success",
};

// Mirrors the Production Manager pending KPI stages in
// backend/app/services/dashboard_production_kpis.py.
const PRODUCTION_QUEUE_PENDING_STATUSES = new Set([
  "BOM_PENDING",
  "READY_FOR_PRODUCTION",
  "PRODUCTION_REWORK",
  "QUALITY_REJECTED",
]);

export function erpListStatus(row) {
  const workflowLabel = rowStatusLabel(row);
  const ws = String(row.workflow_status || "").toUpperCase();
  if (ws === "BOM_PENDING") return { label: "Pending", tone: "warning" };

  if (workflowLabel && row?.is_manual) {
    const tone = WORKFLOW_STATUS_TONES[ws] || "progress";
    if (workflowLabel === "Pending Store Review") return { label: workflowLabel, tone: "warning" };
    if (workflowLabel === "Store Reviewed") return { label: workflowLabel, tone: "success" };
    if (workflowLabel === "Returned to Sales") return { label: workflowLabel, tone: "danger" };
    if (workflowLabel === "Draft") return { label: workflowLabel, tone: "neutral" };
    if (workflowLabel === "Saved") return { label: workflowLabel, tone: "neutral" };
    if (workflowLabel === "Sent") return { label: workflowLabel, tone: "info" };
    return { label: workflowLabel, tone };
  }

  if (["COMPLETED", "INVOICED", "DELIVERED", "DISPATCHED"].includes(ws)) {
    return { label: "Completed", tone: "success" };
  }
  if (workflowLabel && !["Created", "Draft"].includes(workflowLabel)) {
    return { label: workflowLabel, tone: WORKFLOW_STATUS_TONES[ws] || "progress" };
  }
  if (!ws || ["DRAFT", "PENDING", "SALES_ORDER_DRAFT"].includes(ws)) {
    return { label: "Not Started", tone: "neutral" };
  }
  if (ws === "MATERIAL_CHECK_PENDING") {
    return { label: workflowLabel || "Pending Store Review", tone: "warning" };
  }
  return { label: "In Progress", tone: "progress" };
}

export const ERP_LIST_STATUS_FILTER_OPTIONS = [
  { value: "", label: "Select Status" },
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export function matchesErpListStatusFilter(row, filterValue) {
  if (!filterValue) return true;
  const { label } = erpListStatus(row);
  if (filterValue === "pending") {
    return PRODUCTION_QUEUE_PENDING_STATUSES.has(
      String(row?.workflow_status || "").trim().toUpperCase()
    );
  }
  if (filterValue === "not_started") return label === "Not Started";
  if (filterValue === "in_progress") {
    const workflowStatus = String(row?.workflow_status || "").trim().toUpperCase();
    return (
      label === "In Progress" ||
      ["IN_PROGRESS", "RUNNING", "PRODUCTION_IN_PROGRESS", "PRODUCTION_REWORK"].includes(workflowStatus)
    );
  }
  if (filterValue === "completed") return label === "Completed";
  return true;
}
