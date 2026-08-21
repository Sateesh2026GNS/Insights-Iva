import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  Calendar,
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Filter,
  Plus,
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
import { getProcessEnriched, getProcessSummary } from "../../api/qualityApi";
import {
  EMPTY_PROCESS_SUMMARY,
  formatInspectionDate,
  mapProcessRow,
  mergeProcessSummary,
  normalizeProcessStatus,
  processResultLabel,
  processStatusLabel,
} from "../../data/qualityMasterData";
import { exportToExcel } from "../../utils/exportUtils";

const PAGE_SIZES = [10, 25, 50];

function ProcessStatusBadge({ row }) {
  const key = normalizeProcessStatus(row);
  const styles = {
    passed: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
    in_progress: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[key]}`}>
      {processStatusLabel(key)}
    </span>
  );
}

function ProcessResultBadge({ row }) {
  const label = processResultLabel(row);
  if (!label) {
    return <span className="text-[var(--color-text-muted)]">—</span>;
  }
  const isConforming = label === "Conforming";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        isConforming ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
      }`}
    >
      {label}
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

export default function InProcessQC() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(EMPTY_PROCESS_SUMMARY);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [workOrderFilter, setWorkOrderFilter] = useState("");
  const [processFilter, setProcessFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [viewRow, setViewRow] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.allSettled([getProcessSummary(), getProcessEnriched()]);
      let list = [];
      if (listRes.status === "fulfilled" && Array.isArray(listRes.value?.data) && listRes.value.data.length > 0) {
        list = listRes.value.data.map(mapProcessRow);
      } 
      setRows(list);
      const apiSummary = sumRes.status === "fulfilled" ? sumRes.value?.data || {} : {};
      setSummary(mergeProcessSummary(apiSummary, list));
    } catch (err) {
      if (isRefresh) throw err;
      setRows([]);
      setSummary(EMPTY_PROCESS_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const workOrders = useMemo(
    () => [...new Set(rows.map((r) => r.work_order_number).filter(Boolean))].sort(),
    [rows]
  );
  const processes = useMemo(
    () => [...new Set(rows.map((r) => r.process_operation || r.machine_name).filter(Boolean))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (workOrderFilter && r.work_order_number !== workOrderFilter) return false;
      const process = r.process_operation || r.machine_name;
      if (processFilter && process !== processFilter) return false;
      if (statusFilter && normalizeProcessStatus(r) !== statusFilter) return false;
      const rowDate = String(r.inspection_date || r.inspection_time || "").slice(0, 10);
      if (dateFilter && rowDate !== dateFilter) return false;
      if (!q) return true;
      return [
        r.qc_number,
        r.work_order_number,
        r.process_operation,
        r.machine_name,
        r.product_name,
        r.operator_name,
        r.checked_by,
        r.batch_code,
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [rows, search, workOrderFilter, processFilter, statusFilter, dateFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, workOrderFilter, processFilter, statusFilter, dateFilter, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const passedPct = summary.total ? Math.round((summary.passed / summary.total) * 100) : 0;
  const failedPct = summary.total ? Math.round((summary.failed / summary.total) * 100) : 0;
  const inProgressPct = summary.total ? Math.round((summary.in_progress / summary.total) * 100) : 0;

  const handleMarkPassed = (row) => {
    const key = row.id ?? row.qc_number;
    setRows((prev) =>
      prev.map((r) =>
        (r.id ?? r.qc_number) === key
          ? { ...r, status: "passed", qc_status: "passed", result: "conforming" }
          : r
      )
    );
    addToast(`QC ${row.qc_number || ""} marked as passed`, "success");
    setViewRow(null);
  };

  const exportRows = filtered.map((r) => ({
    qc_number: r.qc_number,
    date: formatInspectionDate(r.inspection_date || r.inspection_time),
    work_order: r.work_order_number,
    process: r.process_operation || r.machine_name,
    item: r.product_name,
    checked_by: r.checked_by || r.operator_name,
    status: processStatusLabel(normalizeProcessStatus(r)),
    result: processResultLabel(r) || "—",
  }));

  if (loading) return <Loader label="Loading in-process QC..." />;

  return (
    <div className="min-w-0 space-y-5 pb-4">
      <PageHeader
        title="In-Process QC"
        showTitle
        subtitle="Monitor and manage quality checks during the production process"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                exportToExcel(
                  exportRows,
                  [
                    { key: "qc_number", label: "QC No." },
                    { key: "date", label: "Date" },
                    { key: "work_order", label: "Work Order" },
                    { key: "process", label: "Process / Operation" },
                    { key: "item", label: "Item" },
                    { key: "checked_by", label: "Checked By" },
                    { key: "status", label: "Status" },
                    { key: "result", label: "Result" },
                  ],
                  "in-process-qc"
                )
              }
            >
              <FileSpreadsheet className="h-4 w-4" /> Export
            </Button>
            <Button variant="primary" to="/quality/inspection">
              <Plus className="h-4 w-4" /> New In-Process QC
            </Button>
          </div>
        }
      />

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
            value={workOrderFilter}
            onChange={(e) => setWorkOrderFilter(e.target.value)}
            className="ui-select !w-auto min-w-[10.5rem]"
            aria-label="Work order filter"
          >
            <option value="">All Work Orders</option>
            {workOrders.map((wo) => (
              <option key={wo} value={wo}>{wo}</option>
            ))}
          </select>
          <select
            value={processFilter}
            onChange={(e) => setProcessFilter(e.target.value)}
            className="ui-select !w-auto min-w-[10.5rem]"
            aria-label="Process filter"
          >
            <option value="">All Processes</option>
            {processes.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ui-select !w-auto min-w-[9.5rem]"
            aria-label="Status filter"
          >
            <option value="">All Status</option>
            <option value="passed">Passed</option>
            <option value="in_progress">In Progress</option>
            <option value="failed">Failed</option>
          </select>
          <label className="relative inline-flex items-center">
            <CalendarDays className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--color-text-muted)]" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="ui-input !w-auto min-w-[10.5rem] !pl-9"
              aria-label="Select date"
            />
          </label>
          <Button type="button" variant="secondary" onClick={() => setShowFilters((v) => !v)}>
            <Filter className="h-4 w-4" /> Filters
          </Button>
        </div>
        {showFilters ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-border-soft)] pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setWorkOrderFilter("");
                setProcessFilter("");
                setStatusFilter("");
                setDateFilter("");
              }}
            >
              Clear all filters
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Total Checks" value={summary.total} icon={ClipboardList} tone="primary" meta="In selected period" />
        <KpiCard label="Passed" value={summary.passed} icon={CheckCircle} tone="success" meta={`${passedPct}% of total`} />
        <KpiCard label="Failed" value={summary.failed} icon={XCircle} tone="danger" meta={`${failedPct}% of total`} />
        <KpiCard label="In Progress" value={summary.in_progress} icon={Clock} tone="warning" meta={`${inProgressPct}% of total`} />
        <KpiCard
          label="Today's Checks"
          value={summary.todays_checks}
          icon={Calendar}
          tone="violet"
          meta={formatInspectionDate(new Date().toISOString())}
        />
      </div>

      <div className="ui-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full border-collapse text-left text-[13px]">
            <thead className="bg-[var(--color-surface-thead)] text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr className="border-b border-[var(--color-border-soft)]">
                <SerialNumberHeader className="px-3 py-3" />
                <th className="px-4 py-3">QC No.</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Work Order</th>
                <th className="px-4 py-3">Process / Operation</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Checked By</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Result</th>
                <th className="w-[4.5rem] px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-muted)]">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
                    No in-process QC records found.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, rowIndex) => (
                  <tr key={row.id ?? row.qc_number} className="hover:bg-[var(--color-surface-muted)]/50">
                    <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="px-3 py-3.5" />
                    <td className="px-4 py-3.5 font-semibold text-[var(--color-text)]">{row.qc_number}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--color-text-secondary)]">
                      {formatInspectionDate(row.inspection_date || row.inspection_time)}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[var(--color-text-secondary)]">
                      {row.work_order_number || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--color-text)]">
                      {row.process_operation || row.machine_name || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--color-text)]">{row.product_name || "—"}</td>
                    <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">
                      {row.checked_by || row.operator_name || "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <ProcessStatusBadge row={row} />
                    </td>
                    <td className="px-4 py-3.5">
                      <ProcessResultBadge row={row} />
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <InventoryRowActionsMenu
                        rowId={row.id ?? row.qc_number}
                        isOpen={openMenuId === (row.id ?? row.qc_number)}
                        onOpen={setOpenMenuId}
                        onClose={() => setOpenMenuId(null)}
                        showAdd={false}
                        showDelete={false}
                        onView={() => setViewRow(row)}
                        onEdit={() => handleMarkPassed(row)}
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
                <h2 className="text-lg font-bold text-[var(--color-text)]">{viewRow.qc_number}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">In-process quality check</p>
              </div>
              <button type="button" onClick={() => setViewRow(null)} className="rounded-lg p-2 hover:bg-[var(--color-surface-muted)]" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="grid gap-3 p-6 sm:grid-cols-2">
              {[
                ["Date", formatInspectionDate(viewRow.inspection_date || viewRow.inspection_time)],
                ["Work Order", viewRow.work_order_number || "—"],
                ["Process / Operation", viewRow.process_operation || viewRow.machine_name || "—"],
                ["Item", viewRow.product_name || "—"],
                ["Batch", viewRow.batch_code || "—"],
                ["Shift", viewRow.shift || "—"],
                ["Checked By", viewRow.checked_by || viewRow.operator_name || "—"],
                ["Remarks", viewRow.remarks || "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3">
                  <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
                  <dd className="mt-1 font-semibold text-[var(--color-text)]">{value}</dd>
                </div>
              ))}
              <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3">
                <dt className="text-xs text-[var(--color-text-muted)]">Status</dt>
                <dd className="mt-1"><ProcessStatusBadge row={viewRow} /></dd>
              </div>
              <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3">
                <dt className="text-xs text-[var(--color-text-muted)]">Result</dt>
                <dd className="mt-1"><ProcessResultBadge row={viewRow} /></dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              {normalizeProcessStatus(viewRow) === "in_progress" ? (
                <Button type="button" variant="primary" onClick={() => handleMarkPassed(viewRow)}>
                  Mark as Passed
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
