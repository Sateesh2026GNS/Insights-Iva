import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  AlertTriangle,
  Box,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Filter,
  Gauge,
  RotateCcw,
  Search,
  X,
  XCircle,
} from "lucide-react";

import Button from "../../components/common/Button";
import InventoryRowActionsMenu from "../../components/inventory/InventoryRowActionsMenu";
import KpiCard from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { getDefectsEnriched, getDefectSummary, updateDefectStatus } from "../../api/qualityApi";
import {
  EMPTY_REJECTION_SUMMARY,
  formatInspectionDate,
  formatRejectionQty,
  mapRejectionRow,
  mergeRejectionSummary,
  normalizeRejectionStatus,
  rejectionStatusLabel,
} from "../../data/qualityMasterData";
import { exportToExcel } from "../../utils/exportUtils";

const PAGE_SIZES = [10, 25, 50];

function RejectionStatusBadge({ row }) {
  const key = normalizeRejectionStatus(row);
  const styles = {
    open: "bg-red-100 text-red-700",
    closed: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[key]}`}>
      {rejectionStatusLabel(key)}
    </span>
  );
}

function pageNumberItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items = [1];
  if (current > 3) items.push("ellipsis-start");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let p = start; p <= end; p += 1) items.push(p);
  if (current < total - 2) items.push("ellipsis-end");
  if (total > 1) items.push(total);
  return items;
}

export default function DefectTracking() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(EMPTY_REJECTION_SUMMARY);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [viewRow, setViewRow] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.allSettled([getDefectSummary(), getDefectsEnriched()]);
      let list = [];
      if (listRes.status === "fulfilled" && Array.isArray(listRes.value?.data) && listRes.value.data.length > 0) {
        list = listRes.value.data.map(mapRejectionRow);
      } 
      setRows(list);
      const apiSummary = sumRes.status === "fulfilled" ? sumRes.value?.data || {} : {};
      setSummary(mergeRejectionSummary(apiSummary, list));
    } catch (err) {
      if (isRefresh) throw err;
      setRows([]);
      setSummary(EMPTY_REJECTION_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const rejectionTypes = useMemo(
    () => [...new Set(rows.map((r) => r.reference_type).filter(Boolean))].sort(),
    [rows]
  );
  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.department).filter(Boolean))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter && r.reference_type !== typeFilter) return false;
      if (departmentFilter && r.department !== departmentFilter) return false;
      if (statusFilter && normalizeRejectionStatus(r) !== statusFilter) return false;
      const rowDate = String(r.rejection_date || r.reported_at || "").slice(0, 10);
      if (dateFrom && rowDate < dateFrom) return false;
      if (dateTo && rowDate > dateTo) return false;
      if (!q) return true;
      return [
        r.rejection_number,
        r.defect_code,
        r.product_name,
        r.material_name,
        r.reason,
        r.description,
        r.supplier_name,
        r.reference_number,
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [rows, search, typeFilter, departmentFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, departmentFilter, statusFilter, dateFrom, dateTo, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const openPct = summary.total ? Math.round((summary.open / summary.total) * 100) : 0;
  const closedPct = summary.total ? Math.round((summary.closed / summary.total) * 100) : 0;

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("");
    setDepartmentFilter("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const handleClose = async (row) => {
    const key = row.id ?? row.rejection_number;
    if (row.id) {
      try {
        await updateDefectStatus(row.id, "closed");
        addToast(`Rejection ${row.rejection_number} marked as closed`, "success");
        load();
        setViewRow(null);
        return;
      } catch {
        /* fall through to local update */
      }
    }
    setRows((prev) => {
      const next = prev.map((r) =>
        (r.id ?? r.rejection_number) === key ? { ...r, status: "closed" } : r
      );
      setSummary(mergeRejectionSummary({}, next));
      return next;
    });
    addToast(`Rejection ${row.rejection_number || ""} marked as closed`, "success");
    setViewRow(null);
  };

  const exportRows = filtered.map((r) => ({
    rejection_no: r.rejection_number,
    date: formatInspectionDate(r.rejection_date),
    reference_type: r.reference_type,
    reference_no: r.reference_number,
    product: r.product_name || r.material_name,
    quantity: formatRejectionQty(r),
    reason: r.reason,
    department: r.department,
    status: rejectionStatusLabel(r.status),
  }));

  if (loading) return <Loader label="Loading rejections..." />;

  return (
    <div className="min-w-0 space-y-5 pb-4">
      <PageHeader
        title="Rejections"
        showTitle
        subtitle="Track and manage all rejected materials and products"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                exportToExcel(
                  exportRows,
                  [
                    { key: "rejection_no", label: "Rejection No." },
                    { key: "date", label: "Date" },
                    { key: "reference_type", label: "Reference Type" },
                    { key: "reference_no", label: "Reference No." },
                    { key: "product", label: "Product / Material" },
                    { key: "quantity", label: "Quantity" },
                    { key: "reason", label: "Reason" },
                    { key: "department", label: "Department" },
                    { key: "status", label: "Status" },
                  ],
                  "rejections"
                )
              }
            >
              <FileSpreadsheet className="h-4 w-4" /> Export
            </Button>
            <Button type="button" variant="primary" onClick={() => setShowFilters((v) => !v)}>
              <Filter className="h-4 w-4" /> Filters
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total Rejections"
          value={summary.total}
          icon={XCircle}
          tone="danger"
          meta={`↓ ${summary.total_trend_pct ?? 8}% vs last 14 days`}
        />
        <KpiCard
          label="Open Rejections"
          value={summary.open}
          icon={AlertTriangle}
          tone="warning"
          meta={`${openPct}% of total`}
        />
        <KpiCard
          label="Closed Rejections"
          value={summary.closed}
          icon={CheckCircle}
          tone="success"
          meta={`${closedPct}% of total`}
        />
        <KpiCard
          label="Total Quantity Rejected"
          value={summary.total_quantity?.toLocaleString("en-IN")}
          icon={Box}
          tone="violet"
          meta="NOS / KG"
        />
        <KpiCard
          label="Rejection Rate"
          value={summary.rejection_rate}
          suffix="%"
          icon={Gauge}
          tone="yellow"
          meta={`↑ ${summary.rate_trend_pct ?? 0.6}% vs last 14 days`}
        />
      </div>

      {showFilters ? (
        <div className="ui-card ui-card--padded">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="ui-input w-full !pl-10"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="ui-select !w-auto min-w-[11rem]"
              aria-label="Rejection type filter"
            >
              <option value="">All Rejection Types</option>
              {rejectionTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="ui-select !w-auto min-w-[10.5rem]"
              aria-label="Department filter"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ui-select !w-auto min-w-[9.5rem]"
              aria-label="Status filter"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative inline-flex items-center">
                <CalendarDays className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--color-text-muted)]" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="ui-input !w-auto min-w-[9.5rem] !pl-9"
                  aria-label="Date from"
                />
              </label>
              <span className="text-xs text-[var(--color-text-muted)]">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="ui-input !w-auto min-w-[9.5rem]"
                aria-label="Date to"
              />
            </div>
            <Button type="button" variant="secondary" onClick={clearFilters}>
              <RotateCcw className="h-4 w-4" /> Clear
            </Button>
          </div>
        </div>
      ) : null}

      <div className="ui-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full border-collapse text-left text-[13px]">
            <thead className="bg-[var(--color-surface-thead)] text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr className="border-b border-[var(--color-border-soft)]">
                <SerialNumberHeader className="px-3 py-3" />
                <th className="px-4 py-3">Rejection No.</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Reference Type</th>
                <th className="px-4 py-3">Reference No.</th>
                <th className="px-4 py-3">Product / Material</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Status</th>
                <th className="w-[4.5rem] px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-muted)]">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
                    No rejections found.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, rowIndex) => (
                  <tr key={row.id ?? row.rejection_number} className="hover:bg-[var(--color-surface-muted)]/50">
                    <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="px-3 py-3.5" />
                    <td className="px-4 py-3.5 font-semibold text-[var(--color-text)]">{row.rejection_number}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--color-text-secondary)]">
                      {formatInspectionDate(row.rejection_date)}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{row.reference_type || "—"}</td>
                    <td className="px-4 py-3.5 font-medium text-[var(--color-text-secondary)]">
                      {row.reference_number || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--color-text)]">
                      {row.product_name || row.material_name || "—"}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-[var(--color-text)]">{formatRejectionQty(row)}</td>
                    <td className="max-w-[12rem] truncate px-4 py-3.5 text-[var(--color-text-secondary)]" title={row.reason}>
                      {row.reason || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{row.department || "—"}</td>
                    <td className="px-4 py-3.5">
                      <RejectionStatusBadge row={row} />
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <InventoryRowActionsMenu
                        rowId={row.id ?? row.rejection_number}
                        isOpen={openMenuId === (row.id ?? row.rejection_number)}
                        onOpen={setOpenMenuId}
                        onClose={() => setOpenMenuId(null)}
                        showAdd={false}
                        showDelete={false}
                        onView={() => setViewRow(row)}
                        onEdit={() => handleClose(row)}
                        menuWidth={176}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--color-border-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--color-text-muted)]">
            Showing {from} to {to} of {total} entries
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="grid h-8 w-8 place-items-center rounded border border-[var(--color-border)] bg-white disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageNumberItems(page, totalPages).map((item) =>
                typeof item === "string" ? (
                  <span key={item} className="px-1 text-xs text-[var(--color-text-muted)]">…</span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={`grid h-8 min-w-8 place-items-center rounded border px-2 text-xs font-semibold ${
                      page === item
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="grid h-8 w-8 place-items-center rounded border border-[var(--color-border)] bg-white disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="ui-select !w-auto min-w-[6.5rem] text-xs"
              aria-label="Rows per page"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {viewRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">{viewRow.rejection_number}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Rejection record</p>
              </div>
              <button type="button" onClick={() => setViewRow(null)} className="rounded-lg p-2 hover:bg-[var(--color-surface-muted)]" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="grid gap-3 p-6 sm:grid-cols-2">
              {[
                ["Date", formatInspectionDate(viewRow.rejection_date)],
                ["Reference Type", viewRow.reference_type || "—"],
                ["Reference No.", viewRow.reference_number || "—"],
                ["Product / Material", viewRow.product_name || viewRow.material_name || "—"],
                ["Quantity", formatRejectionQty(viewRow)],
                ["Reason", viewRow.reason || "—"],
                ["Department", viewRow.department || "—"],
                ["Supplier", viewRow.supplier_name || "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3">
                  <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
                  <dd className="mt-1 font-semibold text-[var(--color-text)]">{value}</dd>
                </div>
              ))}
              <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3 sm:col-span-2">
                <dt className="text-xs text-[var(--color-text-muted)]">Status</dt>
                <dd className="mt-1"><RejectionStatusBadge row={viewRow} /></dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              {normalizeRejectionStatus(viewRow) === "open" ? (
                <Button type="button" variant="primary" onClick={() => handleClose(viewRow)}>
                  Mark as Closed
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
