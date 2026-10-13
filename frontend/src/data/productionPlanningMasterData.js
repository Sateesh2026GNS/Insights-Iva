/** Production planning demo data and helpers. */

import { cleanProductLabel } from "../utils/productLabel";

export const ORDER_STATUSES = [
  "draft", "planned", "assigned", "material_ready", "machine_assigned",
  "in_progress", "quality_check", "paused", "completed", "closed", "delayed", "cancelled",
];

export const PRIORITIES = ["high", "medium", "low"];

export const PRIORITY_COLORS = {
  high: { dot: "🔴", bg: "bg-red-100", text: "text-red-800", label: "High" },
  medium: { dot: "🟡", bg: "bg-yellow-100", text: "text-yellow-800", label: "Medium" },
  low: { dot: "🟢", bg: "bg-green-100", text: "text-green-800", label: "Low" },
};

export const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-600",
  planned: "bg-blue-100 text-blue-800",
  assigned: "bg-blue-100 text-blue-800",
  paused: "bg-amber-100 text-amber-800",
  material_ready: "bg-cyan-100 text-cyan-800",
  machine_assigned: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-amber-100 text-amber-800",
  quality_check: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  closed: "bg-slate-200 text-slate-700",
  delayed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
  pending: "bg-blue-100 text-blue-800",
};

export const SHIFTS = [
  { id: "General", label: "General Shift", timing: "9:00 AM – 6:00 PM" },
  { id: "Shift A", label: "Shift A",       timing: "6:00 AM – 2:00 PM" },
  { id: "Shift B", label: "Shift B",       timing: "2:00 PM – 10:00 PM" },
  { id: "Shift C", label: "Shift C",       timing: "10:00 PM – 6:00 AM" },
];

export const DEPARTMENTS = ["Production", "Packing", "Assembly", "Quality Control"];

export const WORKFLOW_STEPS = [
  "Sales Order",
  "Production Planning",
  "BOM Verification",
  "Material Availability Check",
  "Work Order",
  "Machine Allocation",
  "Production Start",
  "Quality Inspection",
  "Finished Goods",
  "Inventory Update",
];

export const STATUS_FLOW = [
  "Draft", "Planned", "Material Ready", "Machine Assigned",
  "In Progress", "Quality Check", "Completed", "Closed",
];

export const IMPORT_TEMPLATE_HEADERS = [
  "order_number", "product", "customer", "planned_quantity", "priority",
  "department", "shift", "start_date", "due_date", "status",
];

export const DEMO_PRODUCTION_ORDERS = [];

export const DEMO_SUMMARY = {
  total_orders: 0,
  planned_orders: 0,
  in_progress_orders: 0,
  completed_orders: 0,
  delayed_orders: 0,
  cancelled_orders: 0,
  todays_target: 0,
  todays_production: 0,
};

export function calculateProgressPct(row) {
  if (!row) return 0;
  if (row.status === "completed" || row.status === "closed" || row.status === "done") {
    return 100;
  }

  const planned = Number(row.planned_quantity || 0);
  let produced = Number(row.produced_quantity ?? row.actual_quantity ?? 0);

  if (Array.isArray(row.work_orders) && row.work_orders.length > 0) {
    const woProduced = row.work_orders.reduce((sum, wo) => sum + Number(wo.actual_quantity ?? wo.produced_quantity ?? 0), 0);
    if (woProduced > 0) {
      produced = woProduced;
    }
  }

  const qtyPct = planned > 0 ? (produced / planned) * 100 : 0;

  return Math.min(100, Math.max(0, Math.round(qtyPct)));
}

export function enrichApiOrder(row, index = 0) {
  const planned = Number(row.planned_quantity || 0);

  const good = Number(row.good_qty ?? row.good_quantity ?? row.accepted_quantity ?? 0);
  const reject = Number(row.reject_qty ?? row.rejected_quantity ?? row.scrap_quantity ?? row.scrap ?? 0);
  let rawProduced = Number(row.produced_quantity ?? row.actual_quantity ?? 0);
  if (rawProduced <= 0 && (good > 0 || reject > 0)) {
    rawProduced = good + reject;
  }

  let woGoodTotal = 0;
  let woRejectTotal = 0;

  if (Array.isArray(row.work_orders) && row.work_orders.length > 0) {
    let woProduced = 0;
    row.work_orders.forEach((wo) => {
      const woGood = Number(wo.good_qty ?? wo.good_quantity ?? wo.accepted_quantity ?? 0);
      const woReject = Number(wo.reject_qty ?? wo.rejected_quantity ?? wo.scrap_quantity ?? wo.scrap ?? 0);
      const woAct = Number(wo.actual_quantity ?? wo.produced_quantity ?? 0);
      const woTotal = woAct > 0 ? woAct : (woGood + woReject);
      woProduced += woTotal;
      woGoodTotal += woGood;
      woRejectTotal += woReject;
    });
    if (woProduced > 0) {
      rawProduced = woProduced;
    }
  }

  // Use aggregated work order good/reject if PO-level values are 0
  const finalGood = woGoodTotal > 0 ? woGoodTotal : (good > 0 ? good : 0);
  const finalReject = woRejectTotal > 0 ? woRejectTotal : (reject > 0 ? reject : 0);

  // If produced is still 0 but we have good+reject from work orders, use that
  if (rawProduced <= 0 && (finalGood > 0 || finalReject > 0)) {
    rawProduced = finalGood + finalReject;
  }

  let status = row.status || "planned";
  const progress = calculateProgressPct({ ...row, produced_quantity: rawProduced, status });

  let produced = rawProduced;
  if (status === "completed" || status === "closed" || status === "done") {
    status = "completed";
  }

  const finalProgress = status === "completed" ? 100 : progress;
  const balance = Math.max(planned - produced, 0);

  return {
    ...row,
    order_number: row.order_number || `PO-${row.id || index + 1}`,
    product_name: cleanProductLabel(row.product_name || `Product #${row.product_id}`),
    customer_name: row.customer_name || "—",
    priority: row.priority || "medium",
    bom_version: row.bom_version || "BOM v1.0",
    work_order_number: row.work_order_number || null,
    machine_name: row.machine_name || "—",
    department: row.department || "Production",
    shift: typeof row.shift === "object" ? (row.shift?.label || row.shift?.id || "General") : (row.shift || "General"),
    status: status,
    planned_quantity: planned,
    produced_quantity: produced,
    balance_quantity: balance,
    progress_pct: finalProgress,
    good_qty: finalGood,
    reject_qty: finalReject,
    buyer_company: row.buyer_company || row.customer_name || "",
    operator_name: row.operator_name || "",
    operator_id: row.operator_id || "",
    size: row.size || "",
    is_delayed: row.is_delayed ?? false,
    materials: row.materials || [],
    work_orders: Array.isArray(row.work_orders)
      ? row.work_orders.map((wo) => ({
          ...wo,
          shift: typeof wo.shift === "object" ? (wo.shift?.label || wo.shift?.id || "Shift A") : (wo.shift || "Shift A"),
        }))
      : [],
    documents: row.documents || [],
    audit_logs: row.audit_logs || [],
  };
}

export function computePlanningSummary(orders) {
  const counts = { planned: 0, in_progress: 0, completed: 0, delayed: 0, cancelled: 0 };
  let todaysProduction = 0;
  const today = new Date().toISOString().slice(0, 10);
  orders.forEach((o) => {
    const s = o.status;
    if (s === "cancelled") counts.cancelled += 1;
    else if (["completed", "closed", "done"].includes(s)) counts.completed += 1;
    else if (["in_progress", "running", "quality_check", "paused"].includes(s)) counts.in_progress += 1;
    else if (["draft", "planned", "pending", "assigned", "material_ready", "machine_assigned"].includes(s)) counts.planned += 1;
    if (o.is_delayed || s === "delayed") counts.delayed += 1;
    todaysProduction += Number(o.produced_quantity || 0);
  });
  const todaysTarget = orders.reduce((s, o) => s + Number(o.planned_quantity || 0), 0);
  return {
    total_orders: orders.length,
    planned_orders: counts.planned,
    in_progress_orders: counts.in_progress,
    completed_orders: counts.completed,
    delayed_orders: counts.delayed,
    cancelled_orders: counts.cancelled,
    todays_target: todaysTarget,
    todays_production: todaysProduction,
  };
}

export function priorityBadge(priority) {
  const p = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
  return p;
}

export function statusLabel(status) {
  return (status || "planned").replace(/_/g, " ");
}

export function canStart(status) {
  return ["draft", "planned", "pending", "assigned", "material_ready", "machine_assigned", "paused"].includes(status);
}

export function canPause(status) {
  return ["in_progress", "running"].includes(status);
}

export function canComplete(status) {
  return ["in_progress", "running", "quality_check"].includes(status);
}
