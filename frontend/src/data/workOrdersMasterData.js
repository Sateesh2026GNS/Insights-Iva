/** Work order demo data and helpers. */

import { PRIORITIES, PRIORITY_COLORS, SHIFTS, DEPARTMENTS } from "./productionPlanningMasterData";

export { PRIORITIES, PRIORITY_COLORS, SHIFTS, DEPARTMENTS };

export const WO_STATUSES = [
  "draft", "released", "material_ready", "machine_ready",
  "running", "paused", "in_progress", "planned", "completed", "closed",
];

const COMPLETED_STATUSES = ["completed", "closed", "done"];
const IN_PROGRESS_STATUSES = ["running", "in_progress", "paused", "quality_check"];

export const WO_STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-600",
  released: "bg-blue-100 text-blue-800",
  material_ready: "bg-cyan-100 text-cyan-800",
  machine_ready: "bg-indigo-100 text-indigo-800",
  running: "bg-green-100 text-green-800",
  in_progress: "bg-amber-100 text-amber-800",
  planned: "bg-blue-100 text-blue-700",
  paused: "bg-orange-100 text-orange-800",
  completed: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-700",
};

export const WORKFLOW_STEPS = [
  "Sales Order",
  "Production Planning",
  "BOM Verification",
  "Material Issue",
  "Work Order",
  "Machine Allocation",
  "Operator Assignment",
  "Production Start",
  "Quality Check",
  "Finished Goods",
];

export const STATUS_FLOW = [
  "Draft", "Released", "Material Ready", "Machine Ready",
  "Running", "Paused", "Completed", "Closed",
];

export const DEMO_WO_SUMMARY = {
  total_work_orders: 0,
  planned_orders: 0,
  in_progress_orders: 0,
  completed_orders: 0,
  delayed_orders: 0,
  high_priority_orders: 0,
};

import { calculateProgressPct } from "./productionPlanningMasterData";
import { cleanProductLabel } from "../utils/productLabel";

export const DEMO_WORK_ORDERS = [];

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function enrichApiWorkOrder(row, index = 0) {
  const planned = Number(row.planned_quantity || 0);
  let rawProduced = Number(row.produced_quantity ?? row.actual_quantity ?? 0);
  let status = normalizeStatus(row.status || "planned");

  const poStatus = normalizeStatus(row.production_order_status || "");
  const poStarted = ["in_progress", "running", "quality_check"].includes(poStatus);
  if (poStarted && ["planned", "draft", "released"].includes(status)) {
    status = "in_progress";
  }

  const progress = calculateProgressPct({ ...row, produced_quantity: rawProduced, status });

  let produced = rawProduced;
  if (COMPLETED_STATUSES.includes(status) || progress >= 100 || (planned > 0 && produced >= planned)) {
    status = "completed";
    produced = Math.max(rawProduced, planned);
  } else if (rawProduced <= 0 && progress > 0 && planned > 0) {
    produced = Math.round((planned * progress) / 100);
  }

  const finalProgress = status === "completed" ? 100 : progress;
  const remaining = Number(row.remaining_quantity ?? Math.max(planned - produced, 0));
  const poNumber =
    row.production_order_number ||
    (row.production_order_id != null ? `PO-${row.production_order_id}` : "—");

  return {
    ...row,
    work_order_number: row.work_order_number || `WO-${row.id || index + 1}`,
    product_name: cleanProductLabel(row.product_name || "—"),
    customer_name: row.customer_name || "—",
    production_order_number: poNumber,
    machine_name: row.machine_name || "—",
    machine_status: row.machine_status || "—",
    operator_name: row.operator_name || "—",
    priority: row.priority || "medium",
    shift: typeof row.shift === "object" ? (row.shift?.label || row.shift?.id || "Shift A") : (row.shift || "Shift A"),
    status: status,
    planned_quantity: planned,
    produced_quantity: produced,
    remaining_quantity: remaining,
    progress_pct: finalProgress,
    materials: row.materials || [],
    documents: row.documents || [],
    audit_logs: row.audit_logs || [],
  };
}

export function computeWorkOrderSummary(orders) {
  const counts = { planned: 0, in_progress: 0, completed: 0, delayed: 0, high: 0 };
  orders.forEach((o) => {
    const s = normalizeStatus(o.status);
    const progressPct = Number(o.progress_pct ?? 0);
    const plannedQty = Number(o.planned_quantity || 0);
    const producedQty = Number(o.produced_quantity || 0);

    if (
      COMPLETED_STATUSES.includes(s) ||
      progressPct >= 100 ||
      (plannedQty > 0 && producedQty >= plannedQty)
    ) {
      counts.completed += 1;
    } else if (IN_PROGRESS_STATUSES.includes(s)) {
      counts.in_progress += 1;
    } else {
      counts.planned += 1;
    }

    if (o.is_delayed) counts.delayed += 1;
    if (o.priority === "high") counts.high += 1;
  });
  return {
    total_work_orders: orders.length,
    planned_orders: counts.planned,
    in_progress_orders: counts.in_progress,
    completed_orders: counts.completed,
    delayed_orders: counts.delayed,
    high_priority_orders: counts.high,
  };
}

export function woStatusLabel(status) {
  return (status || "planned").replace(/_/g, " ");
}

export function canWoStart(status) {
  return ["draft", "released", "planned", "material_ready", "machine_ready", "pending", "paused"].includes(status);
}

export function canWoIssueMaterials(status, materialsIssued) {
  if (materialsIssued) return false;
  return ["draft", "released", "planned", "pending", "machine_ready", "material_ready"].includes(status);
}

export function canWoPause(status) {
  return ["running", "in_progress"].includes(status);
}

export function canWoStop(status) {
  return ["running", "in_progress", "paused"].includes(status);
}

export function canWoComplete(status) {
  return ["running", "in_progress", "paused", "quality_check", "material_ready", "machine_ready", "planned"].includes(status);
}

export function priorityBadge(priority) {
  return PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
}

const WO_WORKFLOW_STEP_DEFS = [
  { key: "sales_orders", label: "Sales Order" },
  { key: "inventory_check", label: "Inventory" },
  { key: "store_manager", label: "Store Manager" },
  { key: "production_manager", label: "Production Manager" },
  { key: "operator", label: "Operator" },
  { key: "quality_check", label: "Quality" },
  { key: "packing_dispatch", label: "Packing & Dispatch" },
  { key: "billing", label: "Billing" },
  { key: "completed", label: "Completed" },
];

/** Map work order / linked sales workflow state to the current manufacturing stage key. */
export function resolveWorkOrderWorkflowStageKey(row = {}) {
  const ws = String(row.workflow_status || row.sales_order_workflow_status || "").toUpperCase();
  if (ws) {
    if (ws.includes("BILL") || ws.includes("INVOICE")) return "billing";
    if (ws.includes("PACK") || ws.includes("DISPATCH")) return "packing_dispatch";
    if (ws.includes("QUALITY") || ws.includes("QC")) return "quality_check";
    if (ws.includes("PRODUCTION") || ws.includes("OPERATOR") || ws.includes("RUNNING")) return "operator";
    if (ws.includes("STORE") || ws.includes("MATERIAL") || ws.includes("ISSUE")) return "store_manager";
    if (ws.includes("INVENTORY")) return "inventory_check";
    if (ws.includes("COMPLETE") || ws.includes("CLOSED")) return "completed";
    if (ws.includes("SALES") || ws.includes("ORDER")) return "sales_orders";
  }

  const status = normalizeStatus(row.status);
  if (["completed", "closed", "done"].includes(status)) return "completed";
  if (status === "quality_check") return "quality_check";
  if (["running", "in_progress", "paused"].includes(status)) return "operator";
  if (row.materials_issued || ["material_ready", "machine_ready", "released"].includes(status)) {
    return "production_manager";
  }
  if (["planned", "draft", "pending"].includes(status)) return "store_manager";
  return "production_manager";
}

/** Build workflow tracker steps for the Work Order details drawer. */
export function buildWorkOrderWorkflowSteps(row = {}) {
  const currentKey = resolveWorkOrderWorkflowStageKey(row);
  const currentIdx = WO_WORKFLOW_STEP_DEFS.findIndex((s) => s.key === currentKey);
  const idx = currentIdx >= 0 ? currentIdx : 3;
  return WO_WORKFLOW_STEP_DEFS.map((step, i) => ({
    ...step,
    status: i < idx ? "completed" : i === idx ? "current" : "pending",
  }));
}

export function displayWoValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") {
    return value.label || value.name || value.title || (value.id != null ? String(value.id) : "—");
  }
  return String(value);
}

export function formatWoDateTime(value) {
  if (!value) return "—";
  const raw = typeof value === "string" ? value : value instanceof Date ? value.toISOString() : String(value);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 16).replace("T", " ");
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}
