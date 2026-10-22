import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  Calendar,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Filter,
  Plus,
  Search,
  X,
  XCircle,
} from "lucide-react";

import Button from "../../components/common/Button";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageShell } from "../../components/common/ListPageShell";
import { SearchBar } from "../../components/common/SearchFilter";
import InventoryRowActionsMenu from "../../components/inventory/InventoryRowActionsMenu";
import KpiCard from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
import EmptyState from "../../components/common/EmptyState";
import PageHeader from "../../components/common/PageHeader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { createProcessQC, getProcessEnriched, getProcessSummary, updateProcessQCStatus } from "../../api/qualityApi";
import {
  EMPTY_PROCESS_SUMMARY,
  formatInspectionDate,
  mapProcessRow,
  mergeProcessSummary,
  normalizeProcessStatus,
  processResultLabel,
  processStatusLabel,
} from "../../data/qualityMasterData";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const PAGE_SIZES = [10, 25, 50];

const PROCESS_EXPORT_COLUMNS = [
  { key: "qc_number", label: "QC No." },
  { key: "date", label: "Date" },
  { key: "work_order", label: "Work Order" },
  { key: "process", label: "Process / Operation" },
  { key: "item", label: "Item" },
  { key: "checked_by", label: "Checked By" },
  { key: "status", label: "Status" },
  { key: "result", label: "Result" },
];

const PROCESS_STATUS_OPTIONS = [
  { value: "passed", label: "Passed" },
  { value: "in_progress", label: "In Progress" },
  { value: "failed", label: "Failed" },
];

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
        className={`inline-flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2 text-[13px] font-medium text-[var(--color-text)] shadow-xs transition-colors hover:border-[var(--color-primary)] ${minWidth}`}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-40 w-64 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-2 shadow-xl">
          {normalizedOptions.length > 5 && (
            <div className="mb-2 px-1">
              <SearchBar
                size="compact"
                value={query}
                onChange={setQuery}
                placeholder={placeholder}
               
              />
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

export default function InProcessQC() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(EMPTY_PROCESS_SUMMARY);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedWorkOrders, setSelectedWorkOrders] = useState([]);
  const [selectedProcesses, setSelectedProcesses] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const dateInputRef = useRef(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newQC, setNewQC] = useState({
    inspection_date: new Date().toLocaleDateString("en-CA"),
    work_order_number: "",
    machine_name: "",
    shift: "",
    operator_name: "",
    inspection_time_minutes: "",
    product_name: "",
    batch_code: "",
    qc_status: "in_progress",
    remarks: "",
  });

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

  const workOrders = useMemo(() => {
    const fromRows = rows.map((r) => r.work_order_number || r.work_order).filter(Boolean);
    const standardWOs = [
      "WO-2026-0001",
      "WO-2026-0002",
      "WO-2026-0003",
      "WO-2026-0004",
      "WO-2026-0005",
      "WO-2026-0006",
      "WO-2026-0007",
      "WO-2026-0008",
    ];
    return [...new Set([...fromRows, ...standardWOs])].sort();
  }, [rows]);

  const processes = useMemo(() => {
    const fromRows = rows.map((r) => r.process_operation || r.machine_name || r.process).filter(Boolean);
    const standardProcesses = [
      "Cutting & Slitting",
      "CNC Machining",
      "Stamping & Pressing",
      "Welding & Fabrication",
      "Heat Treatment",
      "Surface Coating",
      "Assembly & Fitting",
    ];
    return [...new Set([...fromRows, ...standardProcesses])].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const wo = r.work_order_number || r.work_order;
      if (selectedWorkOrders.length > 0 && !selectedWorkOrders.includes(wo)) return false;
      const process = r.process_operation || r.machine_name;
      if (selectedProcesses.length > 0 && !selectedProcesses.includes(process)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(normalizeProcessStatus(r))) return false;
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
  }, [rows, search, selectedWorkOrders, selectedProcesses, selectedStatuses, dateFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedWorkOrders, selectedProcesses, selectedStatuses, dateFilter, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const passedPct = summary.total ? Math.round((summary.passed / summary.total) * 100) : 0;
  const failedPct = summary.total ? Math.round((summary.failed / summary.total) * 100) : 0;
  const inProgressPct = summary.total ? Math.round((summary.in_progress / summary.total) * 100) : 0;

  const handleMarkPassed = async (row) => {
    try {
      await updateProcessQCStatus(row.id, "passed");
      await load(true);
      addToast(`QC ${row.qc_number || ""} marked as passed`, "success");
      setViewRow(null);
      setOpenMenuId(null);
    } catch (error) {
      addToast(error?.response?.data?.detail || "Could not update the QC status", "error");
    }
  };

  const handleCreateQC = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createProcessQC({
        ...newQC,
        inspection_time_minutes: newQC.inspection_time_minutes === "" ? null : Number(newQC.inspection_time_minutes),
      });
      await load(true);
      setShowCreate(false);
      addToast("In-process QC record created", "success");
    } catch (error) {
      addToast(error?.response?.data?.detail || "Could not create the in-process QC record", "error");
    } finally {
      setSaving(false);
    }
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

  const handleExport = (format) => {
    if (format === "pdf") {
      exportToPdf(exportRows, PROCESS_EXPORT_COLUMNS, "In-Process QC", "in-process-qc");
    } else {
      exportToExcel(exportRows, PROCESS_EXPORT_COLUMNS, "in-process-qc");
    }
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <ListPageShell>
    <div className="min-w-0 space-y-5 pb-4">
      <PageHeader
        subtitle="Monitor and manage quality checks during the production process"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportDownloadMenu disabled={!exportRows.length} onExport={handleExport} />
            <Button variant="add" onClick={() => setShowCreate(true)} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              New In-Process QC
            </Button>
          </div>
        }
      />

      <div className="ui-card ui-card--padded space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search"
            aria-label="Search in-process QC records"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex min-h-[var(--control-h)] min-w-[11rem] items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
              <button
                type="button"
                aria-label="Open date picker"
                onClick={() => {
                  const input = dateInputRef.current;
                  if (!input) return;
                  if (typeof input.showPicker === "function") input.showPicker();
                  else { input.focus(); input.click(); }
                }}
                className="shrink-0 text-[var(--color-text-muted)]"
              >
                <CalendarDays className="h-4 w-4" />
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="quality-date-input min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[var(--color-text)] focus:outline-none"
                aria-label="Select date"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowFilters((v) => !v)}
              className={showFilters ? "!border-[var(--color-primary)] !text-[var(--color-primary)] font-semibold" : ""}
            >
              <Filter className="h-4 w-4" /> Filters
              {(selectedWorkOrders.length + selectedProcesses.length + selectedStatuses.length) > 0 ? (
                <span className="ml-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.2 text-[10px] text-white">
                  {selectedWorkOrders.length + selectedProcesses.length + selectedStatuses.length}
                </span>
              ) : null}
            </Button>
          </div>
        </div>

        {showFilters ? (
        <div className="grid grid-cols-1 gap-3 border-t border-[var(--color-border-soft)] pt-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          <MultiSelectDropdown
            label="Work Orders"
            options={workOrders}
            selected={selectedWorkOrders}
            onChange={setSelectedWorkOrders}
            placeholder="Search work orders..."
            minWidth="min-w-[12rem]"
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
            options={PROCESS_STATUS_OPTIONS}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
            placeholder="Search statuses..."
            minWidth="min-w-[9.5rem]"
          />
          {(selectedWorkOrders.length > 0 ||
            selectedProcesses.length > 0 ||
            selectedStatuses.length > 0 ||
            dateFilter ||
            search) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setSelectedWorkOrders([]);
                setSelectedProcesses([]);
                setSelectedStatuses([]);
                setDateFilter("");
              }}
              className="text-xs text-[var(--color-text-muted)] hover:text-red-600"
            >
              Clear filters
            </Button>
          )}
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
            <thead className="ui-table-head">
              <tr>
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
                  <td colSpan={10} className="border-none p-0">
                    <EmptyState
                      icon="document"
                      title="No records found."
                      description="No production checks match these filters. Create an in-process QC record to start tracking checks."
                      className="border-none bg-transparent py-12"
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((row, rowIndex) => (
                  <tr key={row.id ?? row.qc_number} className="hover:bg-[var(--color-surface-muted)]/50">
                    <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="px-3 py-3.5" />
                    <td className="px-4 py-3.5 font-semibold">
                      <button
                        type="button"
                        onClick={() => setViewRow(row)}
                        className="font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                      >
                        {row.qc_number}
                      </button>
                    </td>
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
                        showEdit={false}
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
          <div className="ui-modal max-h-[90vh] w-full max-w-lg overflow-y-auto">
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
      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
          <form onSubmit={handleCreateQC} className="ui-modal max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <div className="flex items-start justify-between border-b px-6 py-4">
              <div><h2 className="text-lg font-bold text-[var(--color-text)]">New In-Process QC</h2><p className="text-sm text-[var(--color-text-muted)]">Record a quality check for a production operation.</p></div>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-2 hover:bg-[var(--color-surface-muted)]" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              {[
                ["Inspection date", "inspection_date", "date", true],
                ["Work order", "work_order_number", "text", true],
                ["Machine / operation", "machine_name", "text"],
                ["Product", "product_name", "text"],
                ["Batch", "batch_code", "text"],
                ["Operator", "operator_name", "text"],
                ["Shift", "shift", "text"],
                ["Inspection time (minutes)", "inspection_time_minutes", "number"],
              ].map(([label, name, type, required]) => (
                <label key={name} className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">{label}
                  <input type={type} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.1" : undefined} required={Boolean(required)} value={newQC[name]} onChange={(event) => setNewQC((prev) => ({ ...prev, [name]: event.target.value }))} className="w-full rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                </label>
              ))}
              <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">QC status
                <select value={newQC.qc_status} onChange={(event) => setNewQC((prev) => ({ ...prev, qc_status: event.target.value }))} className="w-full rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2.5 text-[var(--color-text)]">
                  <option value="in_progress">In progress</option><option value="pending">Pending</option><option value="passed">Passed</option><option value="failed">Failed</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] sm:col-span-2">Remarks
                <textarea rows={3} value={newQC.remarks} onChange={(event) => setNewQC((prev) => ({ ...prev, remarks: event.target.value }))} className="w-full rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4"><Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving…" : "Save QC"}</Button></div>
          </form>
        </div>
      ) : null}
    </div>
    </ListPageShell>
  );
}
