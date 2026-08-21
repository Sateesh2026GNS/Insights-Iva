import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  Filter,
  Layers,
  LineChart,
  Percent,
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
import { getBatchEnriched, getBatchSummary } from "../../api/qualityApi";
import {
  EMPTY_BATCH_SUMMARY,
  batchResultLabel,
  batchStatusLabel,
  formatBatchQty,
  formatInspectionDate,
  mapBatchRow,
  mergeBatchSummary,
  normalizeBatchStatus,
} from "../../data/qualityMasterData";
import { exportToExcel } from "../../utils/exportUtils";

const PAGE_SIZES = [10, 25, 50];

function BatchStatusBadge({ row }) {
  const key = normalizeBatchStatus(row);
  const styles = {
    completed: "bg-emerald-100 text-emerald-700",
    in_progress: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[key]}`}>
      {batchStatusLabel(key)}
    </span>
  );
}

function BatchResultBadge({ row }) {
  const label = batchResultLabel(row);
  if (!label) {
    return <span className="text-[var(--color-text-muted)]">—</span>;
  }
  const isPassed = label === "Passed";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        isPassed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
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

export default function BatchQualityReports() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(EMPTY_BATCH_SUMMARY);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [processFilter, setProcessFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [viewRow, setViewRow] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.allSettled([getBatchSummary(), getBatchEnriched()]);
      let list = [];
      if (listRes.status === "fulfilled" && Array.isArray(listRes.value?.data) && listRes.value.data.length > 0) {
        list = listRes.value.data.map(mapBatchRow);
      } 
      setRows(list);
      const apiSummary = sumRes.status === "fulfilled" ? sumRes.value?.data || {} : {};
      setSummary(mergeBatchSummary(apiSummary, list));
    } catch (err) {
      if (isRefresh) throw err;
      setRows([]);
      setSummary(EMPTY_BATCH_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const products = useMemo(
    () => [...new Set(rows.map((r) => r.product_name).filter(Boolean))].sort(),
    [rows]
  );
  const processes = useMemo(
    () => [...new Set(rows.map((r) => r.process_operation || r.process).filter(Boolean))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (productFilter && r.product_name !== productFilter) return false;
      const process = r.process_operation || r.process;
      if (processFilter && process !== processFilter) return false;
      if (statusFilter && normalizeBatchStatus(r) !== statusFilter) return false;
      if (resultFilter) {
        const result = batchResultLabel(r);
        if (resultFilter === "passed" && result !== "Passed") return false;
        if (resultFilter === "failed" && result !== "Failed") return false;
        if (resultFilter === "pending" && result !== null) return false;
      }
      const start = String(r.start_date || r.report_date || "").slice(0, 10);
      if (dateFrom && start < dateFrom) return false;
      if (dateTo && start > dateTo) return false;
      if (!q) return true;
      return [
        r.batch_code,
        r.product_name,
        r.work_order_number,
        r.work_order,
        r.process_operation,
        r.process,
        r.inspector,
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [rows, search, productFilter, processFilter, statusFilter, resultFilter, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [search, productFilter, processFilter, statusFilter, resultFilter, dateFrom, dateTo, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const passedPct = summary.total_batches
    ? Math.round((summary.passed / summary.total_batches) * 100)
    : 0;
  const failedPct = summary.total_batches
    ? Math.round((summary.failed / summary.total_batches) * 100)
    : 0;
  const inProgressPct = summary.total_batches
    ? Math.round((summary.in_progress / summary.total_batches) * 100)
    : 0;

  const exportRows = filtered.map((r) => ({
    batch_no: r.batch_code,
    product: r.product_name,
    work_order: r.work_order_number || r.work_order,
    process: r.process_operation || r.process,
    quantity: formatBatchQty(r),
    start_date: formatInspectionDate(r.start_date || r.report_date),
    end_date: r.end_date ? formatInspectionDate(r.end_date) : "—",
    status: batchStatusLabel(r.status),
    result: batchResultLabel(r) || "—",
    pass_rate: r.pass_rate != null ? `${r.pass_rate}%` : "—",
  }));

  if (loading) return <Loader label="Loading batch quality reports..." />;

  return (
    <div className="min-w-0 space-y-5 pb-4">
      <PageHeader
        title="Batch Quality Reports"
        showTitle
        subtitle="View and analyze quality results by batch"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                exportToExcel(
                  exportRows,
                  [
                    { key: "batch_no", label: "Batch No." },
                    { key: "product", label: "Product" },
                    { key: "work_order", label: "Work Order" },
                    { key: "process", label: "Process" },
                    { key: "quantity", label: "Quantity" },
                    { key: "start_date", label: "Start Date" },
                    { key: "end_date", label: "End Date" },
                    { key: "status", label: "Status" },
                    { key: "result", label: "Result" },
                    { key: "pass_rate", label: "Pass Rate" },
                  ],
                  "batch-quality-reports"
                )
              }
            >
              <FileSpreadsheet className="h-4 w-4" /> Export
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => addToast("Batch quality report generation started", "success")}
            >
              <LineChart className="h-4 w-4" /> Generate Report
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total Batches"
          value={summary.total_batches}
          icon={Layers}
          tone="primary"
          meta={`↑ ${summary.total_trend_pct ?? 10}% vs last 14 days`}
        />
        <KpiCard
          label="Passed Batches"
          value={summary.passed}
          icon={CheckCircle}
          tone="success"
          meta={`${passedPct}% of total`}
        />
        <KpiCard
          label="Failed Batches"
          value={summary.failed}
          icon={XCircle}
          tone="danger"
          meta={`${failedPct}% of total`}
        />
        <KpiCard
          label="In Progress"
          value={summary.in_progress}
          icon={Clock}
          tone="warning"
          meta={`${inProgressPct}% of total`}
        />
        <KpiCard
          label="Overall Pass Rate"
          value={summary.overall_pass_rate ?? summary.yield_pct}
          suffix="%"
          icon={Percent}
          tone="violet"
          meta={`↑ ${summary.pass_rate_trend_pct ?? 6}% vs last 14 days`}
        />
      </div>

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
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="ui-select !w-auto min-w-[10.5rem]"
            aria-label="Product filter"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p} value={p}>{p}</option>
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
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
          </select>
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="ui-select !w-auto min-w-[9.5rem]"
            aria-label="Result filter"
          >
            <option value="">All Results</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
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
                setProductFilter("");
                setProcessFilter("");
                setStatusFilter("");
                setResultFilter("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear all filters
            </Button>
          </div>
        ) : null}
      </div>

      <div className="ui-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full border-collapse text-left text-[13px]">
            <thead className="bg-[var(--color-surface-thead)] text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr className="border-b border-[var(--color-border-soft)]">
                <SerialNumberHeader className="px-3 py-3" />
                <th className="px-4 py-3">Batch No.</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Work Order</th>
                <th className="px-4 py-3">Process</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Start Date</th>
                <th className="px-4 py-3">End Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Pass Rate</th>
                <th className="w-[4.5rem] px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-muted)]">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
                    No batch quality reports found.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, rowIndex) => (
                  <tr key={row.id ?? row.batch_code} className="hover:bg-[var(--color-surface-muted)]/50">
                    <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="px-3 py-3.5" />
                    <td className="px-4 py-3.5 font-semibold text-[var(--color-text)]">{row.batch_code}</td>
                    <td className="px-4 py-3.5 text-[var(--color-text)]">{row.product_name || "—"}</td>
                    <td className="px-4 py-3.5 font-medium text-[var(--color-text-secondary)]">
                      {row.work_order_number || row.work_order || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">
                      {row.process_operation || row.process || "—"}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-[var(--color-text)]">{formatBatchQty(row)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--color-text-secondary)]">
                      {formatInspectionDate(row.start_date || row.report_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--color-text-secondary)]">
                      {row.end_date ? formatInspectionDate(row.end_date) : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <BatchStatusBadge row={row} />
                    </td>
                    <td className="px-4 py-3.5">
                      <BatchResultBadge row={row} />
                    </td>
                    <td className="px-4 py-3.5 tabular-nums font-medium text-[var(--color-text)]">
                      {row.pass_rate != null ? `${row.pass_rate}%` : "—"}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <InventoryRowActionsMenu
                        rowId={row.id ?? row.batch_code}
                        isOpen={openMenuId === (row.id ?? row.batch_code)}
                        onOpen={setOpenMenuId}
                        onClose={() => setOpenMenuId(null)}
                        showAdd={false}
                        showDelete={false}
                        onView={() => setViewRow(row)}
                        onEdit={() => setViewRow(row)}
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
                <h2 className="text-lg font-bold text-[var(--color-text)]">{viewRow.batch_code}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Batch quality report</p>
              </div>
              <button type="button" onClick={() => setViewRow(null)} className="rounded-lg p-2 hover:bg-[var(--color-surface-muted)]" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="grid gap-3 p-6 sm:grid-cols-2">
              {[
                ["Product", viewRow.product_name || "—"],
                ["Work Order", viewRow.work_order_number || viewRow.work_order || "—"],
                ["Process", viewRow.process_operation || viewRow.process || "—"],
                ["Quantity", formatBatchQty(viewRow)],
                ["Start Date", formatInspectionDate(viewRow.start_date || viewRow.report_date)],
                ["End Date", viewRow.end_date ? formatInspectionDate(viewRow.end_date) : "—"],
                ["Pass Qty", viewRow.pass_qty?.toLocaleString("en-IN") || "—"],
                ["Reject Qty", viewRow.reject_qty?.toLocaleString("en-IN") || "—"],
                ["Inspector", viewRow.inspector || "—"],
                ["Shift", viewRow.shift || "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3">
                  <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
                  <dd className="mt-1 font-semibold text-[var(--color-text)]">{value}</dd>
                </div>
              ))}
              <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3">
                <dt className="text-xs text-[var(--color-text-muted)]">Status</dt>
                <dd className="mt-1"><BatchStatusBadge row={viewRow} /></dd>
              </div>
              <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3">
                <dt className="text-xs text-[var(--color-text-muted)]">Result</dt>
                <dd className="mt-1"><BatchResultBadge row={viewRow} /></dd>
              </div>
              <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3 sm:col-span-2">
                <dt className="text-xs text-[var(--color-text-muted)]">Pass Rate</dt>
                <dd className="mt-1 font-semibold text-[var(--color-text)]">
                  {viewRow.pass_rate != null ? `${viewRow.pass_rate}%` : "—"}
                </dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <Button type="button" variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
