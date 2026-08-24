/** Map workflow status to stage job card route segment. */
import { ROUTE_SEGMENT_TO_STAGE, WORKFLOW_STAGES } from "../config/workflowStages";

export function workflowStatusToStagePath(workflowStatus) {
  const ws = (workflowStatus || "").toUpperCase();
  const stage = WORKFLOW_STAGES.find((s) => s.filterStatuses?.includes(ws));
  if (stage?.routeSegment) return stage.routeSegment;
  if (ws === "MATERIAL_CHECK_PENDING" || ws === "MATERIAL_SHORTAGE" || ws === "MATERIAL_PARTIAL") {
    return "inventory";
  }
  if (ws === "MATERIAL_AVAILABLE" || ws === "STORE_ISSUE_PENDING" || ws === "STORE_ISSUE_PARTIAL") {
    return "store";
  }
  if (ws === "READY_FOR_PRODUCTION" || ws === "PRODUCTION_REWORK" || ws === "QUALITY_REJECTED") {
    return "production";
  }
  if (ws === "PRODUCTION_ASSIGNED" || ws === "PRODUCTION_IN_PROGRESS" || ws === "PRODUCTION_COMPLETED") {
    return "operator";
  }
  if (ws === "QUALITY_CHECK_PENDING" || ws === "QUALITY_ON_HOLD") {
    return "quality";
  }
  if (ws.startsWith("PACKING") || ws === "QUALITY_APPROVED") {
    return "packing";
  }
  if (ws.startsWith("BILLING") || ws === "PACKED" || ws === "INVOICED") {
    return "billing";
  }
  if (ws === "SALES_CONFIRMED" || ws === "COMPLETED") {
    return null;
  }
  return "inventory";
}

export function stageJobCardUrl(orderId, workflowStatus) {
  const stage = workflowStatusToStagePath(workflowStatus);
  if (!stage) return `/sales/orders/${orderId}/job-card`;
  return `/manufacturing/workflow/order/${orderId}/${stage}`;
}

export { ROUTE_SEGMENT_TO_STAGE };
