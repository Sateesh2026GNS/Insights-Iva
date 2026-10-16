/** Quality demo data and helpers. */

export const QUALITY_FLOW = [
  "Purchase Order", "Incoming Inspection", "Inventory", "Production",
  "In Process QC", "Final QC", "Packing", "Dispatch", "Customer",
];

export const FINAL_QC_FLOW = [
  "Production", "In Process QC", "Final QC", "Packing", "Dispatch",
];

export const DEFECT_WORKFLOW = [
  "New", "Assigned", "In Progress", "Verification", "Resolved", "Closed",
];

export const CAPA_STATUSES = ["open", "assigned", "in_progress", "verification", "resolved", "closed"];

export const EMPTY_INCOMING_SUMMARY = {
  total: 0, approved: 0, rejected: 0, in_progress: 0, todays_inspections: 0,
  pending_inspection: 0, passed: 0, failed: 0, rejected_lots: 0, avg_inspection_time: 0,
};
export const DEMO_INCOMING_SUMMARY = EMPTY_INCOMING_SUMMARY;
export const DEMO_INCOMING_LIST = [];

export function normalizeIncomingStatus(row) {
  const rawStatus = String(row?.status || "").toLowerCase();
  const raw = rawStatus || String(row?.result || "").toLowerCase();
  if (["pass", "passed", "approved"].includes(raw)) return "approved";
  if (["fail", "failed", "rejected"].includes(raw)) return "rejected";
  if (raw === "completed" && ["pass", "passed", "approved"].includes(String(row?.result || "").toLowerCase())) return "approved";
  return "in_progress";
}

export function incomingStatusLabel(status) {
  const key = normalizeIncomingStatus({ status });
  if (key === "approved") return "Approved";
  if (key === "rejected") return "Rejected";
  return "In Progress";
}

export function mergeIncomingSummary(apiSummary = {}, rows = []) {
  const total = rows.length;
  if (total === 0 && !apiSummary.passed && !apiSummary.todays_inspections) {
    return { ...EMPTY_INCOMING_SUMMARY };
  }
  const approved = rows.length
    ? rows.filter((r) => normalizeIncomingStatus(r) === "approved").length
    : Number(apiSummary.passed) || 0;
  const rejected = rows.length
    ? rows.filter((r) => normalizeIncomingStatus(r) === "rejected").length
    : Number(apiSummary.failed || apiSummary.rejected_lots) || 0;
  const inProgress = rows.length
    ? rows.filter((r) => normalizeIncomingStatus(r) === "in_progress").length
    : Number(apiSummary.pending_inspection) || 0;
  const totalCount = rows.length || approved + rejected + inProgress  || 0;
  return {
    total: totalCount,
    approved,
    rejected,
    in_progress: inProgress,
    todays_inspections: Number(apiSummary.todays_inspections)  || 0,
    pending_inspection: inProgress,
    passed: approved,
    failed: rejected,
    rejected_lots: rejected,
    avg_inspection_time: apiSummary.avg_inspection_time  ?? 0,
  };
}

export const EMPTY_PROCESS_SUMMARY = {
  total: 0, passed: 0, failed: 0, in_progress: 0, todays_checks: 0,
  production_running: 0, qc_pending: 0, rework: 0, scrap: 0,
};
export const DEMO_PROCESS_SUMMARY = EMPTY_PROCESS_SUMMARY;
export const DEMO_PROCESS_LIST = [];

export function normalizeProcessStatus(row) {
  const values = [row?.status, row?.qc_status, row?.result].map((value) => String(value || "").toLowerCase());
  if (values.some((value) => ["pass", "passed", "approved", "conforming"].includes(value))) return "passed";
  if (values.some((value) => ["fail", "failed", "rejected", "non_conforming", "non-conforming"].includes(value))) return "failed";
  return "in_progress";
}

export function processStatusLabel(status) {
  const key = normalizeProcessStatus({ status });
  if (key === "passed") return "Passed";
  if (key === "failed") return "Failed";
  return "In Progress";
}

export function processResultLabel(row) {
  const status = normalizeProcessStatus(row);
  if (status === "in_progress") return null;
  const raw = String(row?.result || "").toLowerCase();
  if (["conforming", "pass", "passed"].includes(raw)) return "Conforming";
  if (["non_conforming", "non-conforming", "fail", "failed"].includes(raw)) return "Non-Conforming";
  return status === "passed" ? "Conforming" : "Non-Conforming";
}

export function mapProcessRow(row) {
  const status = normalizeProcessStatus(row);
  const qcNumber = row.qc_number || `IPQC-2026-${String(row.id || 0).padStart(4, "0")}`;
  const inspectionDate = row.inspection_date || String(row.inspection_time || "").slice(0, 10);
  let result = row.result;
  if (!result || result === "pending") {
    if (status === "passed") result = "conforming";
    else if (status === "failed") result = "non_conforming";
    else result = "pending";
  }
  return {
    ...row,
    qc_number: qcNumber,
    process_operation: row.process_operation || row.machine_name || "—",
    product_name: row.product_name || row.item || "—",
    operator_name: row.operator_name || row.checked_by || "—",
    checked_by: row.checked_by || row.operator_name || "—",
    inspection_date: inspectionDate,
    qc_status: row.qc_status || status,
    status,
    result,
  };
}

export function mergeProcessSummary(apiSummary = {}, rows = []) {
  const today = new Date().toISOString().slice(0, 10);
  if (rows.length === 0 && !apiSummary.passed && !apiSummary.qc_pending) {
    return { ...EMPTY_PROCESS_SUMMARY };
  }
  const passed = rows.length
    ? rows.filter((r) => normalizeProcessStatus(r) === "passed").length
    : Number(apiSummary.passed) || 0;
  const failed = rows.length
    ? rows.filter((r) => normalizeProcessStatus(r) === "failed").length
    : Number(apiSummary.failed) || 0;
  const inProgress = rows.length
    ? rows.filter((r) => normalizeProcessStatus(r) === "in_progress").length
    : Number(apiSummary.qc_pending) || 0;
  const total = rows.length || passed + failed + inProgress  || 0;
  const todaysChecks = rows.length
    ? rows.filter((r) => String(r.inspection_date || r.inspection_time || "").slice(0, 10) === today).length
    : Number(apiSummary.todays_checks)  || 0;
  return {
    total,
    passed,
    failed,
    in_progress: inProgress,
    todays_checks: todaysChecks,
    production_running: Number(apiSummary.production_running) || 0,
    qc_pending: inProgress,
    rework: Number(apiSummary.rework) || 0,
    scrap: Number(apiSummary.scrap) || 0,
  };
}

export const EMPTY_FINAL_SUMMARY = {
  total: 0, passed: 0, failed: 0, in_progress: 0, todays_checks: 0,
  production_running: 0, qc_pending: 0, rework: 0, scrap: 0,
};
export const DEMO_FINAL_SUMMARY = EMPTY_FINAL_SUMMARY;
export const DEMO_FINAL_LIST = [];

export function mapFinalRow(row) {
  const status = normalizeProcessStatus(row);
  const qcNumber = row.qc_number || row.inspection_number || `FQC-2026-${String(row.id || 0).padStart(4, "0")}`;
  let result = row.result;
  if (!result || result === "pending") {
    if (status === "passed") result = "conforming";
    else if (status === "failed") result = "non_conforming";
    else result = "pending";
  }
  return {
    ...row,
    qc_number: qcNumber,
    inspection_number: row.inspection_number || qcNumber,
    checked_by: row.checked_by || row.inspector || "—",
    inspector: row.inspector || row.checked_by || "—",
    status,
    result,
  };
}

export function mergeFinalSummary(apiSummary = {}, rows = []) {
  const today = new Date().toISOString().slice(0, 10);
  if (rows.length === 0 && !apiSummary.passed && !apiSummary.pending_final) {
    return { ...EMPTY_FINAL_SUMMARY };
  }
  const passed = rows.length
    ? rows.filter((r) => normalizeProcessStatus(r) === "passed").length
    : Number(apiSummary.passed) || 0;
  const failed = rows.length
    ? rows.filter((r) => normalizeProcessStatus(r) === "failed").length
    : Number(apiSummary.failed) || 0;
  const inProgress = rows.length
    ? rows.filter((r) => normalizeProcessStatus(r) === "in_progress").length
    : Number(apiSummary.pending_final) || 0;
  const total = rows.length || passed + failed + inProgress  || 0;
  const todaysChecks = rows.length
    ? rows.filter((r) => String(r.inspection_date || "").slice(0, 10) === today).length
    : Number(apiSummary.todays_checks)  || 0;
  return {
    total,
    passed,
    failed,
    in_progress: inProgress,
    todays_checks: todaysChecks,
    pending_final: inProgress,
    packed: Number(apiSummary.packed) || 0,
    ready_dispatch: Number(apiSummary.ready_dispatch) || 0,
  };
}

export const EMPTY_BATCH_SUMMARY = {
  total_batches: 0, passed: 0, failed: 0, in_progress: 0, overall_pass_rate: 0,
  total_trend_pct: 0, pass_rate_trend_pct: 0,
};
export const DEMO_BATCH_SUMMARY = EMPTY_BATCH_SUMMARY;
export const DEMO_BATCH_LIST = [];

export function normalizeBatchStatus(row) {
  const raw = String(row?.status || "").toLowerCase();
  if (raw === "completed" || raw === "complete" || raw === "closed") return "completed";
  return "in_progress";
}

export function batchStatusLabel(status) {
  const key = normalizeBatchStatus({ status });
  return key === "completed" ? "Completed" : "In Progress";
}

export function batchResultLabel(row) {
  const status = normalizeBatchStatus(row);
  if (status === "in_progress") return null;
  const raw = String(row?.result || "").toLowerCase();
  if (["passed", "pass"].includes(raw)) return "Passed";
  if (["failed", "fail"].includes(raw)) return "Failed";
  const rate = Number(row?.pass_rate ?? row?.yield_pct);
  if (rate >= 85) return "Passed";
  return "Failed";
}

export function formatBatchQty(row) {
  const qty = Number(row.quantity ?? row.production_qty) || 0;
  const unit = row.quantity_unit || "NOS";
  return `${qty.toLocaleString("en-IN")} ${unit}`;
}

export function mapBatchRow(row) {
  const status = normalizeBatchStatus(row);
  let result = row.result;
  if (!result && status === "completed") {
    const rate = Number(row.pass_rate ?? row.yield_pct);
    result = rate >= 85 ? "passed" : "failed";
  }
  const passRate = row.pass_rate ?? (status === "completed" ? row.yield_pct : null);
  return {
    ...row,
    batch_code: row.batch_code || `BATCH-2026-${String(row.id || 0).padStart(3, "0")}`,
    process_operation: row.process_operation || row.process || "—",
    work_order_number: row.work_order_number || row.work_order || "—",
    quantity: row.quantity ?? row.production_qty ?? 0,
    quantity_unit: row.quantity_unit || "NOS",
    start_date: row.start_date || row.report_date || null,
    end_date: row.end_date ?? (status === "completed" ? row.report_date : null),
    status,
    result: status === "in_progress" ? null : result,
    pass_rate: passRate,
    yield_pct: Number(row.yield_pct) || passRate || 0,
  };
}

export function mergeBatchSummary(apiSummary = {}, rows = []) {
  if (rows.length === 0 && !apiSummary.total_batches && !apiSummary.passed) {
    return { ...EMPTY_BATCH_SUMMARY };
  }
  const completed = rows.filter((r) => normalizeBatchStatus(r) === "completed");
  const passed = rows.length
    ? completed.filter((r) => batchResultLabel(r) === "Passed").length
    : Number(apiSummary.passed) || 0;
  const failed = rows.length
    ? completed.filter((r) => batchResultLabel(r) === "Failed").length
    : Number(apiSummary.failed) || 0;
  const inProgress = rows.length
    ? rows.filter((r) => normalizeBatchStatus(r) === "in_progress").length
    : 0;
  const total = rows.length || Number(apiSummary.total_batches) || passed + failed + inProgress  || 0;
  const overallPassRate = total
    ? Math.round((passed / total) * 100)
    : Math.round(Number(apiSummary.yield_pct)  || 0);
  return {
    total_batches: total,
    passed,
    failed,
    in_progress: inProgress,
    overall_pass_rate: overallPassRate,
    yield_pct: Number(apiSummary.yield_pct) || overallPassRate,
    scrap_pct: Number(apiSummary.scrap_pct) || 0,
    rework_pct: Number(apiSummary.rework_pct) || 0,
    total_trend_pct: DEMO_BATCH_SUMMARY.total_trend_pct,
    pass_rate_trend_pct: DEMO_BATCH_SUMMARY.pass_rate_trend_pct,
  };
}

export const DEMO_DEFECT_SUMMARY = {
  total_defects: 0,
  open: 0,
  in_progress: 0,
  resolved: 0,
  critical: 0,
  capa_pending: 0,
};

export const DEMO_DEFECT_LIST = [];

export const EMPTY_REJECTION_SUMMARY = {
  total: 0, open: 0, closed: 0, total_quantity: 0, rejection_rate: 0,
  total_trend_pct: 0, total_trend_dir: "flat", rate_trend_pct: 0, rate_trend_dir: "flat",
};
export const DEMO_REJECTION_SUMMARY = EMPTY_REJECTION_SUMMARY;
export const DEMO_REJECTION_LIST = [];

export function normalizeRejectionStatus(row) {
  const raw = String(row?.status || "").toLowerCase();
  if (["closed", "resolved", "complete", "completed"].includes(raw)) return "closed";
  return "open";
}

export function rejectionStatusLabel(status) {
  return normalizeRejectionStatus({ status }) === "closed" ? "Closed" : "Open";
}

export function formatRejectionQty(row) {
  const qty = Number(row.quantity ?? row.quantity_affected) || 0;
  const unit = row.quantity_unit || "NOS";
  return `${qty.toLocaleString("en-IN")} ${unit}`;
}

export function mapRejectionRow(row) {
  const status = normalizeRejectionStatus(row);
  const num = row.id || 0;
  const rejectionNumber = row.rejection_number || row.defect_code || `REJ-2026-${String(num).padStart(4, "0")}`;
  const refType = row.reference_type || "Incoming Inspection";
  const prefix = REF_PREFIX[refType] || "INSP";
  return {
    ...row,
    rejection_number: rejectionNumber,
    rejection_date: row.rejection_date || String(row.reported_at || row.due_date || "").slice(0, 10),
    reference_type: refType,
    reference_number:
      row.reference_number ||
      (row.batch_code ? `${prefix}-${row.batch_code}` : `${prefix}-2026-${String(num).padStart(4, "0")}`),
    product_name: row.product_name || row.material_name || "—",
    quantity: row.quantity ?? row.quantity_affected ?? 0,
    quantity_unit: row.quantity_unit || "NOS",
    reason: row.reason || row.description || row.root_cause || "—",
    department: row.department || "Quality",
    status,
  };
}

export function mergeRejectionSummary(apiSummary = {}, rows = []) {
  if (rows.length === 0 && !apiSummary.total_defects && !apiSummary.open) {
    return { ...EMPTY_REJECTION_SUMMARY };
  }
  const open = rows.length
    ? rows.filter((r) => normalizeRejectionStatus(r) === "open").length
    : (Number(apiSummary.open) + Number(apiSummary.in_progress || 0)) || 0;
  const closed = rows.length
    ? rows.filter((r) => normalizeRejectionStatus(r) === "closed").length
    : Number(apiSummary.resolved) || 0;
  const total = rows.length || Number(apiSummary.total_defects) || open + closed  || 0;
  const totalQuantity = rows.length
    ? rows.reduce((sum, r) => sum + (Number(r.quantity ?? r.quantity_affected) || 0), 0)
    : DEMO_REJECTION_SUMMARY.total_quantity;
  return {
    total,
    open,
    closed,
    total_quantity: totalQuantity,
    rejection_rate: DEMO_REJECTION_SUMMARY.rejection_rate,
    total_trend_pct: DEMO_REJECTION_SUMMARY.total_trend_pct,
    total_trend_dir: DEMO_REJECTION_SUMMARY.total_trend_dir,
    rate_trend_pct: DEMO_REJECTION_SUMMARY.rate_trend_pct,
    rate_trend_dir: DEMO_REJECTION_SUMMARY.rate_trend_dir,
  };
}

export const EMPTY_QUALITY_HUB = {
  total_inspections: 0, passed: 0, failed: 0, rejected: 0, in_process: 0,
  pass_rate: 0, yield_pct: 0, defect_rate: 0, kpi_trends: {},
  pass_vs_fail: [], defect_trend: [], monthly_yield: [], supplier_quality: [],
  machine_defects: [], pareto_defects: [], root_cause_analysis: [], qc_performance: [],
  inspection_trend: [], inspection_by_type: [], rejection_reasons: [],
  recent_inspections: [], alerts: [],
};
export const DEMO_QUALITY_HUB = EMPTY_QUALITY_HUB;

const TYPE_LABELS = {
  incoming: "Incoming Inspection",
  in_process: "In-Process QC",
  process: "In-Process QC",
  final: "Final QC",
  final_qc: "Final QC",
};

export function inspectionTypeLabel(type) {
  const key = String(type || "").toLowerCase();
  return TYPE_LABELS[key] || String(type || "—").replace(/_/g, " ");
}

export function formatInspectionDate(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(value);
  }
}

export function mapRecentInspection(row) {
  const result = String(row.result || "").toLowerCase();
  const isPending = !result || result === "pending" || result === "in_progress";
  return {
    date: formatInspectionDate(row.date),
    type: inspectionTypeLabel(row.type),
    reference: row.reference || row.number || "—",
    status: isPending ? "in_progress" : "completed",
    result: isPending ? null : result,
  };
}

export function mergeQualityHub(api = {}) {
  const total = Number(api.total_inspections) || 0;
  if (total <= 0) return { ...EMPTY_QUALITY_HUB };

  const passed = Number(api.passed) || 0;
  const failed = Number(api.failed) || 0;
  const pendingEntry = (api.pass_vs_fail || []).find((p) => String(p.name).toLowerCase() === "pending");
  const inProcess = pendingEntry?.count ?? Math.max(0, total - passed - failed);
  const passRate = total ? Math.round((passed / total) * 100) : 0;

  return {
    ...EMPTY_QUALITY_HUB,
    ...api,
    total_inspections: total,
    passed,
    failed,
    in_process: inProcess,
    pass_rate: passRate,
    yield_pct: api.yield_pct ?? passRate,
    inspection_trend: api.inspection_trend?.length ? api.inspection_trend : [],
    inspection_by_type: api.inspection_by_type?.length ? api.inspection_by_type : [],
    rejection_reasons: api.rejection_reasons?.length
      ? api.rejection_reasons
      : api.pareto_defects?.length
        ? api.pareto_defects.map((d, i) => ({
            name: d.name,
            count: d.count,
            color: ["#ef4444", "#f97316", "#22c55e", "#2563eb", "#8b5cf6"][i % 5],
          }))
        : [],
    recent_inspections: (api.recent_inspections || []).map(mapRecentInspection),
  };
}

/** Pass=Green, Fail=Red, Pending=Orange */
export function qcStatusColor(s) {
  const m = {
    pass: "bg-green-100 text-green-800",
    passed: "bg-green-100 text-green-800",
    fail: "bg-red-100 text-red-800",
    failed: "bg-red-100 text-red-800",
    pending: "bg-orange-100 text-orange-800",
    rework: "bg-amber-100 text-amber-800",
    scrap: "bg-red-200 text-red-900",
    rejected: "bg-red-100 text-red-800",
    approved: "bg-green-100 text-green-800",
    packed: "bg-blue-100 text-blue-800",
    in_progress: "bg-blue-100 text-blue-800",
    open: "bg-orange-100 text-orange-800",
    new: "bg-orange-100 text-orange-800",
    assigned: "bg-indigo-100 text-indigo-800",
    verification: "bg-purple-100 text-purple-800",
    resolved: "bg-green-100 text-green-800",
    closed: "bg-slate-200 text-slate-700",
  };
  return m[s] || "bg-slate-100 text-slate-700";
}

/** Low=Green, Medium=Orange, High=Red, Critical=Dark Red */
export function severityColor(s) {
  const m = {
    low: "bg-green-100 text-green-800",
    medium: "bg-orange-100 text-orange-800",
    high: "bg-red-100 text-red-800",
    critical: "bg-red-900 text-white",
  };
  return m[s] || "bg-slate-100 text-slate-700";
}

export function formatPct(v) {
  if (v == null) return "—";
  return `${Number(v).toFixed(1)}%`;
}
