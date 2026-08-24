import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  CalendarDays,
  CheckCircle,
  ChevronDown,
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

const BATCH_STATUS_OPTIONS = [
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In Progress" },
];

const BATCH_RESULT_OPTIONS = [
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Pending" },
];

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

function MultiSelectDropdown({
  label,
  options = [],
  selected = [],
  onChange,
  placeholder = "Search...",
  minWidth = "min-w-[11rem]",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const normalizedOptions = useMemo(() => {
    return options.map((opt) =>
      typeof opt === "string" ? { value: opt, label: opt } : opt
    );
  }, [options]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(q) || String(opt.value).toLowerCase().includes(q)
    );
  }, [normalizedOptions, query]);

  const toggleOption = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const selectAll = () => {
    onChange(normalizedOptions.map((opt) => opt.value));
  };

  const clearAll = () => {
    onChange([]);
  };

  const count = selected.length;
  const triggerLabel = count > 0 ? `${label} (${count})` : `All ${label}`;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border-soft)] bg-white px-3.5 py-2 text-[13px] font-medium text-[var(--color-text)] shadow-xs transition-colors hover:border-[var(--color-primary)] ${minWidth}`}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-40 w-64 rounded-xl border border-[var(--color-border-soft)] bg-white p-2 shadow-xl">
          {normalizedOptions.length > 5 && (
            <div className="mb-2 px-1">
              <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/50 px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-transparent text-[12px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-placeholder)]"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-2 py-1 text-[11px]">
            <button
              type="button"
              onClick={selectAll}
              className="font-medium text-[var(--color-primary)] hover:underline cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-[var(--color-text-muted)] hover:text-red-600 cursor-pointer"
            >
              Clear
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto pt-1 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-[var(--color-text-muted)]">No options found</p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)] font-medium"
                        : "text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOption(opt.value)}
                      className="h-4 w-4 rounded border-[#c0d5d0] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
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
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedProcesses, setSelectedProcesses] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedResults, setSelectedResults] = useState([]);
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

  const products = useMemo(() => {
    const fromRows = rows.map((r) => r.product_name).filter(Boolean);
    const defaults = ["Shaft 25mm", "Flange Coupling 100mm", "Precision Gear 45T", "Bushing 30mm", "Hydraulic Cylinder Rod"];
    return [...new Set([...fromRows, ...defaults])].sort();
  }, [rows]);
  const processes = useMemo(() => {
    const fromRows = rows.map((r) => r.process_operation || r.process).filter(Boolean);
    const defaults = ["Machining", "Heat Treatment", "Surface Grinding", "CNC Milling", "Final Assembly"];
    return [...new Set([...fromRows, ...defaults])].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (selectedProducts.length > 0 && !selectedProducts.includes(r.product_name)) return false;
      const process = r.process_operation || r.process;
      if (selectedProcesses.length > 0 && !selectedProcesses.includes(process)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(normalizeBatchStatus(r))) return false;
      if (selectedResults.length > 0) {
        const res = (batchResultLabel(r) || "Pending").toLowerCase();
        if (!selectedResults.includes(res)) return false;
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
  }, [rows, search, selectedProducts, selectedProcesses, selectedStatuses, selectedResults, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedProducts, selectedProcesses, selectedStatuses, selectedResults, dateFrom, dateTo, pageSize]);

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
        <div className="flex flex-col gap-3.5 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by batch no, product, work order..."
              className="ui-input w-full !pl-10 text-[13px] text-[var(--color-text)]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <MultiSelectDropdown
              label="Products"
              options={products}
              selected={selectedProducts}
              onChange={setSelectedProducts}
              placeholder="Search products..."
              minWidth="min-w-[11.5rem]"
            />
            <MultiSelectDropdown
              label="Processes"
              options={processes}
              selected={selectedProcesses}
              onChange={setSelectedProcesses}
              placeholder="Search processes..."
              minWidth="min-w-[11rem]"
            />
            <MultiSelectDropdown
              label="Status"
              options={BATCH_STATUS_OPTIONS}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
              placeholder="Search statuses..."
              minWidth="min-w-[9.5rem]"
            />
            <MultiSelectDropdown
              label="Results"
              options={BATCH_RESULT_OPTIONS}
              selected={selectedResults}
              onChange={setSelectedResults}
              placeholder="Search results..."
              minWidth="min-w-[9.5rem]"
            />
            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center">
                <CalendarDays className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--color-text-muted)]" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="ui-input !w-auto min-w-[9.5rem] !pl-9 text-[13px] text-[var(--color-text)]"
                  aria-label="Date from"
                />
              </label>
              <span className="text-xs text-[var(--color-text-muted)]">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="ui-input !w-auto min-w-[9.5rem] text-[13px] text-[var(--color-text)]"
                aria-label="Date to"
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => setShowFilters((v) => !v)}>
              <Filter className="h-4 w-4" /> Filters
            </Button>
          </div>
        </div>
        {showFilters ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--color-border-soft)] pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setSelectedProducts([]);
                setSelectedProcesses([]);
                setSelectedStatuses([]);
                setSelectedResults([]);
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
            <thead className="bg-[var(--color-primary-soft)] text-[12px] font-semibold text-[var(--color-primary-dark)] border-b border-[#d0e5e0]">
              <tr>
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
                    <td className="px-4 py-3.5 font-semibold">
                      <button
                        type="button"
                        onClick={() => setViewRow(row)}
                        className="font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                      >
                        {row.batch_code}
                      </button>
                    </td>
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

        <div className="ui-pagination justify-between border-t border-[var(--color-border-soft)] px-4 py-3">
          <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap text-[13px] text-[#596b82]">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="ui-pagination-select"
              aria-label="Rows per page"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>
              {total === 0 ? "0–0 of 0" : `${from}–${to} of ${total}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="ui-page-btn"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageNumberItems(page, totalPages).map((item, idx) =>
              typeof item === "string" ? (
                <span key={`dots-${idx}`} className="px-1 text-xs text-[var(--color-text-muted)]">…</span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={`ui-page-btn ${page === item ? "ui-page-btn--active" : ""}`}
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="ui-page-btn"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
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
