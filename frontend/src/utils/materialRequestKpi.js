/** KPI filter definitions aligned with backend get_mr_summary (procurement_extended_service). */

const CLOSED = new Set(["converted", "fulfilled", "cancelled"]);

export function isMrPendingApproval(row) {
  const approval = String(row?.approval_status || "pending").toLowerCase();
  const status = String(row?.status || "").toLowerCase();
  if (status === "rejected" || approval === "rejected") return false;
  if (CLOSED.has(status)) return false;
  return approval === "pending" || status === "pending";
}

export function isMrApproved(row) {
  const approval = String(row?.approval_status || "").toLowerCase();
  const status = String(row?.status || "").toLowerCase();
  if (status === "rejected" || approval === "rejected") return false;
  if (CLOSED.has(status)) return false;
  return approval === "approved";
}

export function isMrRejected(row) {
  const approval = String(row?.approval_status || "").toLowerCase();
  const status = String(row?.status || "").toLowerCase();
  return status === "rejected" || approval === "rejected";
}

export function isMrConverted(row) {
  const status = String(row?.status || "").toLowerCase();
  return status === "converted" || Boolean(row?.converted_to_po);
}

export function isMrUrgent(row) {
  const p = String(row?.priority || "").toLowerCase();
  return p === "urgent" || p === "high";
}

export function filterMaterialRequestsByKpi(rows, kpi) {
  const list = Array.isArray(rows) ? rows : [];
  if (!kpi || kpi === "all") return list;
  if (kpi === "pending" || kpi === "pending_approval") {
    return list.filter(isMrPendingApproval);
  }
  if (kpi === "approved") return list.filter(isMrApproved);
  if (kpi === "rejected") return list.filter(isMrRejected);
  if (kpi === "converted") return list.filter(isMrConverted);
  if (kpi === "urgent") return list.filter(isMrUrgent);
  return list;
}

export function applyMaterialRequestFieldFilters(rows, filters = {}) {
  let list = Array.isArray(rows) ? rows : [];
  if (filters.kpi) {
    list = filterMaterialRequestsByKpi(list, filters.kpi);
  }
  if (filters.department) {
    list = list.filter((r) => r.department === filters.department);
  }
  if (filters.priority) {
    list = list.filter((r) => String(r.priority || "").toLowerCase() === filters.priority);
  }
  if (filters.status) {
    list = list.filter((r) => String(r.status || "").toLowerCase() === filters.status);
  }
  if (filters.requested_by?.trim()) {
    const q = filters.requested_by.trim().toLowerCase();
    list = list.filter((r) => String(r.requested_by || "").toLowerCase().includes(q));
  }
  return list;
}
