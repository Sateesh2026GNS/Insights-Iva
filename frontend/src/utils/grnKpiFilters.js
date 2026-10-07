/** Client filters aligned with backend `get_grn_summary` definitions. */
export function grnMatchesKpi(row, kpiFilter, todayIso) {
  if (!kpiFilter || kpiFilter === "all") return true;

  const qc = (row.qc_status || "pending").toLowerCase();
  const status = String(row.status || "").toLowerCase();

  if (kpiFilter === "today") {
    return String(row.receipt_date || row.grn_date || "").slice(0, 10) === todayIso;
  }
  if (kpiFilter === "pending_qc") {
    return qc === "pending" || status === "pending_qc";
  }
  if (kpiFilter === "received") {
    return status === "received";
  }
  if (kpiFilter === "rejected") {
    return status === "rejected" || qc === "rejected";
  }
  return true;
}

export function countGrnKpi(rows, kpiFilter, todayIso) {
  return rows.filter((row) => grnMatchesKpi(row, kpiFilter, todayIso)).length;
}
