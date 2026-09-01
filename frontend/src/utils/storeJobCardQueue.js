import { jobCardDetailsUrl } from "./jobCardRoutes";
import { stageJobCardUrl } from "./workflowStageRoutes";

export const STORE_STATUS_BUCKETS = {
  store_pending: ["MATERIAL_CHECK_PENDING", "MATERIAL_SHORTAGE"],
  ready_to_issue: ["MATERIAL_AVAILABLE", "STORE_ISSUE_PENDING"],
  partially_issued: ["STORE_ISSUE_PARTIAL", "MATERIAL_PARTIAL"],
};

export const STORE_STATUS_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "store_pending", label: "Store Pending" },
  { value: "ready_to_issue", label: "Ready to Issue" },
  { value: "partially_issued", label: "Partially Issued" },
];

const ACTION_LABELS = {
  view: "Open Job Card",
  check_stock: "Inventory Check",
  record_shortage: "Record Shortage",
  issue_materials: "Issue Material",
  partial_issue: "Partial Issue",
  send_to_production: "Complete Store Stage",
  hold: "Hold",
  add_remarks: "Add Remarks",
};

export function storeStatusVariant(row) {
  const ws = String(row?.workflow_status || "").toUpperCase();
  if (STORE_STATUS_BUCKETS.ready_to_issue.includes(ws)) return "success";
  if (STORE_STATUS_BUCKETS.partially_issued.includes(ws)) return "info";
  if (ws === "MATERIAL_SHORTAGE") return "danger";
  return "warning";
}

export function storeQueueStatusLabel(row) {
  if (row?.queue_status_label) return row.queue_status_label;
  const ws = String(row?.workflow_status || "").toUpperCase();
  if (STORE_STATUS_BUCKETS.store_pending.includes(ws)) return "Store Pending";
  if (STORE_STATUS_BUCKETS.ready_to_issue.includes(ws)) return "Ready to Issue";
  if (STORE_STATUS_BUCKETS.partially_issued.includes(ws)) return "Partially Issued";
  return row?.status_label || row?.status || "—";
}

export function matchesStoreStatusBucket(row, bucketKey) {
  if (!bucketKey) return true;
  const ws = String(row?.workflow_status || "").toUpperCase();
  const bucket = STORE_STATUS_BUCKETS[bucketKey];
  if (bucket) return bucket.includes(ws);
  return ws === String(bucketKey).toUpperCase();
}

export function storeActionUrl(row, action) {
  const orderId = row?.sales_order_id ?? row?.id;
  if (!orderId) return "/my-job-cards";
  if (action === "view") return jobCardDetailsUrl(orderId);
  if (action === "hold" || action === "add_remarks") return null;
  if (action === "check_stock" || action === "record_shortage") {
    return stageJobCardUrl(orderId, row.workflow_status || "MATERIAL_CHECK_PENDING");
  }
  if (action === "issue_materials" || action === "partial_issue" || action === "send_to_production") {
    return `/manufacturing/workflow/order/${orderId}/store`;
  }
  return stageJobCardUrl(orderId, row.workflow_status);
}

export function storeRowMenuItems(row) {
  const actions = Array.isArray(row?.allowed_actions) ? row.allowed_actions : ["view"];
  return actions
    .filter((action) => ACTION_LABELS[action])
    .map((action) => ({
      key: action,
      label: ACTION_LABELS[action],
      to: storeActionUrl(row, action),
    }));
}

export function uniqueFilterValues(rows, key) {
  const seen = new Set();
  const out = [];
  for (const row of rows || []) {
    const value = String(row?.[key] || "").trim();
    if (!value) continue;
    const id = value.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(value);
  }
  return out.sort((a, b) => a.localeCompare(b));
}
