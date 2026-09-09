/** ERP list status labels for My Job Cards table and filters. */

import { rowStatusLabel } from "./jobCardQueueDisplay";

const WORKFLOW_STATUS_TONES = {
  DRAFT: "neutral",
  RETURNED_TO_SALES: "warning",
  MATERIAL_CHECK_PENDING: "warning",
  STORE_REVIEWED: "info",
  MATERIAL_AVAILABLE: "success",
  STORE_ISSUE_PENDING: "info",
  READY_FOR_PRODUCTION: "progress",
  COMPLETED: "success",
  INVOICED: "success",
};

export function erpListStatus(row) {
  const workflowLabel = rowStatusLabel(row);
  if (workflowLabel && row?.is_manual) {
    const ws = String(row.workflow_status || "").toUpperCase();
    const tone = WORKFLOW_STATUS_TONES[ws] || "progress";
    if (workflowLabel === "Pending Store Review") return { label: workflowLabel, tone: "warning" };
    if (workflowLabel === "Store Reviewed") return { label: workflowLabel, tone: "success" };
    if (workflowLabel === "Returned to Sales") return { label: workflowLabel, tone: "danger" };
    if (workflowLabel === "Draft") return { label: workflowLabel, tone: "neutral" };
    return { label: workflowLabel, tone };
  }

  const ws = String(row.workflow_status || "").toUpperCase();
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
  if (filterValue === "not_started") return label === "Not Started";
  if (filterValue === "in_progress") return label === "In Progress";
  if (filterValue === "completed") return label === "Completed";
  return true;
}
