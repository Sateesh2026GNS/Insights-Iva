import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  Calendar,
  CalendarDays,
  CheckCircle,
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
import InventoryPlanningShell from "../../components/inventory/InventoryPlanningShell";
import { SearchBar } from "../../components/common/SearchFilter";
import InventoryRowActionsMenu from "../../components/inventory/InventoryRowActionsMenu";
import KpiCard from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
import EmptyState from "../../components/common/EmptyState";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { createFinalQC, getFinalEnriched, getFinalSummary } from "../../api/qualityApi";
import { submitQualityCheck } from "../../api/workflowApi";
import {
  EMPTY_FINAL_SUMMARY,
  formatInspectionDate,
  mapFinalRow,
  mergeFinalSummary,
  normalizeProcessStatus,
  processResultLabel,
  processStatusLabel,
} from "../../data/qualityMasterData";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const PAGE_SIZES = [10, 25, 50];

const FINAL_EXPORT_COLUMNS = [
  { key: "qc_number", label: "QC No." },
  { key: "date", label: "Date" },
  { key: "customer", label: "Customer" },
  { key: "sales_order", label: "Sales Order" },
  { key: "item", label: "Item" },
  { key: "checked_by", label: "Checked By" },
  { key: "status", label: "Status" },
  { key: "result", label: "Result" },
];

function FinalStatusBadge({ row }) {
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

function FinalResultBadge({ row }) {
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

export default function FinalQC() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(EMPTY_FINAL_SUMMARY);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [salesOrderFilter, setSalesOrderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(() => {
    const raw = new URLSearchParams(window.location.search).get("status") || "";
    return ["passed", "in_progress", "failed"].includes(raw) ? raw : "";
  });
  const [dateFilter, setDateFilter] = useState("");
  const [showFilters, setShowFilters] = useState(() => Boolean(statusFilter));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingFinalQC, setCreatingFinalQC] = useState(false);
  const [newFinalQC, setNewFinalQC] = useState({
    inspection_number: "",
    inspection_date: new Date().toISOString().slice(0, 10),
    customer_name: "",
    sales_order_number: "",
    product_name: "",
    batch_code: "",
    inspector: "",
    notes: "",
  });
  const [savingPassId, setSavingPassId] = useState(null);
  const dateInputRef = useRef(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.allSettled([getFinalSummary(), getFinalEnriched()]);
      let list = [];
      if (listRes.status === "fulfilled" && Array.isArray(listRes.value?.data) && listRes.value.data.length > 0) {
        list = listRes.value.data.map(mapFinalRow);
      } 
      setRows(list);
      const apiSummary = sumRes.status === "fulfilled" ? sumRes.value?.data || {} : {};
      setSummary(mergeFinalSummary(apiSummary, list));
    } catch (err) {
      if (isRefresh) throw err;
      setRows([]);
      setSummary(EMPTY_FINAL_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const customers = useMemo(() => {
    const fromRows = rows.map((r) => r.customer_name).filter(Boolean);
    const defaults = ["Tata Motors Ltd", "Mahindra & Mahindra", "Bajaj Auto Ltd", "Bharat Forge", "Larsen & Toubro"];
    return [...new Set([...fromRows, ...defaults])].sort();
  }, [rows]);
  const salesOrders = useMemo(() => {
    const fromRows = rows.map((r) => r.sales_order_number).filter(Boolean);
    const defaults = ["SO-2026-0001", "SO-2026-0002", "SO-2026-0003", "SO-2026-0004", "SO-2026-0005"];
    return [...new Set([...fromRows, ...defaults])].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (customerFilter && r.customer_name !== customerFilter) return false;
      if (salesOrderFilter && r.sales_order_number !== salesOrderFilter) return false;
      if (statusFilter && normalizeProcessStatus(r) !== statusFilter) return false;
      if (dateFilter && String(r.inspection_date || "").slice(0, 10) !== dateFilter) return false;
      if (!q) return true;
      return [
        r.qc_number,
        r.inspection_number,
        r.customer_name,
        r.sales_order_number,
        r.product_name,
        r.inspector,
        r.checked_by,
        r.batch_code,
        r.certificate_ref,
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [rows, search, customerFilter, salesOrderFilter, statusFilter, dateFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, customerFilter, salesOrderFilter, statusFilter, dateFilter, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const passedPct = summary.total ? Math.round((summary.passed / summary.total) * 100) : 0;
  const failedPct = summary.total ? Math.round((summary.failed / summary.total) * 100) : 0;
  const inProgressPct = summary.total ? Math.round((summary.in_progress / summary.total) * 100) : 0;

  const handleMarkPassed = async (row) => {
    if (!row?.id || normalizeProcessStatus(row) !== "in_progress" || savingPassId !== null) return;
    const key = row.id ?? row.qc_number ?? row.inspection_number;
    setSavingPassId(row.id);
    try {
      await submitQualityCheck(row.id, { result: "pass" });
      const updatedRows = rows.map((r) =>
        (r.id ?? r.qc_number ?? r.inspection_number) === key
          ? { ...r, status: "passed", result: "pass", approval: "approved" }
          : r
      );
      setRows(updatedRows);
      setSummary((prev) => mergeFinalSummary(prev, updatedRows));
      addToast(`QC ${row.qc_number || row.inspection_number || ""} marked as passed`, "success");
      setViewRow(null);
    } catch (err) {
      addToast(err?.response?.data?.detail || "Could not update this Final QC inspection", "error");
    } finally {
      setSavingPassId(null);
    }
  };

  const openNewFinalQCForm = () => {
    setNewFinalQC({
      inspection_number: `FQC-${Date.now()}`,
      inspection_date: new Date().toISOString().slice(0, 10),
      customer_name: "",
      sales_order_number: "",
      product_name: "",
      batch_code: "",
      inspector: "",
      notes: "",
    });
    setShowCreateForm(true);
  };

  const handleCreateFinalQC = async (event) => {
    event.preventDefault();
    if (creatingFinalQC) return;
    setCreatingFinalQC(true);
    try {
      const response = await createFinalQC(newFinalQC);
      const createdRow = mapFinalRow(response.data);
      const nextRows = [createdRow, ...rows];
      setRows(nextRows);
      setSummary((prev) => mergeFinalSummary(prev, nextRows));
      setPage(1);
      setShowCreateForm(false);
      addToast("Final QC created successfully", "success");
    } catch (err) {
      addToast(err?.response?.data?.detail || "Could not create Final QC", "error");
    } finally {
      setCreatingFinalQC(false);
    }
  };

  const exportRows = filtered.map((r) => ({
    qc_number: r.qc_number || r.inspection_number,
    date: formatInspectionDate(r.inspection_date),
    customer: r.customer_name,
    sales_order: r.sales_order_number,
    item: r.product_name,
    checked_by: r.checked_by || r.inspector,
    status: processStatusLabel(normalizeProcessStatus(r)),
    result: processResultLabel(r) || "—",
  }));

  if (loading) {
    return (
      <InventoryPlanningShell theme="orange" kicker="Inspect · Approve · Release" title="FINAL" accent="QC">
        <Loader label="Loading final QC..." />
      </InventoryPlanningShell>
    );
  }

  const handleExport = (format) => {
    if (format === "pdf") {
      exportToPdf(exportRows, FINAL_EXPORT_COLUMNS, "Final QC", "final-qc");
    } else {
      exportToExcel(exportRows, FINAL_EXPORT_COLUMNS, "final-qc");
    }
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <InventoryPlanningShell theme="orange"
      kicker="Inspect · Approve · Release"
      title="FINAL"
      accent="QC"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ExportDownloadMenu disabled={!exportRows.length} onExport={handleExport} />
          <Button variant="add" onClick={openNewFinalQCForm} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
            New Final QC
          </Button>
        </div>
      }
    >
    <div className="min-w-0 space-y-5 pb-4">

      <div className="ui-card ui-card--padded space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search"
            aria-label="Search final QC records"
          />
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex min-h-[var(--control-h)] min-w-[8.5rem] items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
              <button
                type="button"
                aria-label="Open date picker"
                onClick={() => {
                  const input = dateInputRef.current;
                  if (!input) return;
                  if (typeof input.showPicker === "function") input.showPicker();
                  else {
                    input.focus();
                    input.click();
                  }
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
                className="w-[6rem] min-w-0 flex-none border-0 bg-transparent p-0 text-sm text-[var(--color-text)] focus:outline-none"
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
              {(customerFilter || salesOrderFilter || statusFilter) ? (
                <span className="ml-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.2 text-[10px] text-white">
                  {[customerFilter, salesOrderFilter, statusFilter].filter(Boolean).length}
                </span>
              ) : null}
            </Button>
          </div>
        </div>

        {showFilters ? (
        <div className="grid grid-cols-1 gap-3 border-t border-[var(--color-border-soft)] pt-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="ui-select !w-auto min-w-[10.5rem]"
            aria-label="Customer filter"
          >
            <option value="">All Customers</option>
            {customers.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={salesOrderFilter}
            onChange={(e) => setSalesOrderFilter(e.target.value)}
            className="ui-select !w-auto min-w-[10.5rem]"
            aria-label="Sales order filter"
          >
            <option value="">All Sales Orders</option>
            {salesOrders.map((so) => (
              <option key={so} value={so}>{so}</option>
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
          {(customerFilter || salesOrderFilter || statusFilter || dateFilter || search) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setCustomerFilter("");
                setSalesOrderFilter("");
                setStatusFilter("");
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
          <table className="w-full min-w-[1440px] table-fixed border-collapse text-left text-[13px]">
            <colgroup>
              <col className="w-[4.5rem]" />
              <col className="w-[11rem]" />
              <col className="w-[8.5rem]" />
              <col className="w-[14rem]" />
              <col className="w-[12rem]" />
              <col className="w-[12rem]" />
              <col className="w-[9rem]" />
              <col className="w-[9rem]" />
              <col className="w-[8rem]" />
              <col className="w-[4.5rem]" />
            </colgroup>
            <thead className="ui-table-head">
              <tr className="border-b border-[var(--color-border-soft)]">
                <SerialNumberHeader className="!text-center whitespace-nowrap px-3 py-3" />
                <th className="whitespace-nowrap px-4 py-3">QC No.</th>
                <th className="whitespace-nowrap px-4 py-3">Date</th>
                <th className="whitespace-nowrap px-4 py-3">Customer</th>
                <th className="whitespace-nowrap px-4 py-3">Sales Order</th>
                <th className="whitespace-nowrap px-4 py-3">Item</th>
                <th className="whitespace-nowrap px-4 py-3">Checked By</th>
                <th className="whitespace-nowrap px-4 py-3">Status</th>
                <th className="whitespace-nowrap px-4 py-3">Result</th>
                <th className="whitespace-nowrap px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-muted)]">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="border-none p-0">
                    <EmptyState
                      icon="document"
                      title="No records found."
                      description="There is nothing to show here yet."
                      className="border-none bg-transparent py-12"
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((row, rowIndex) => (
                  <tr key={row.id ?? row.qc_number ?? row.inspection_number} className="hover:bg-[var(--color-surface-muted)]/50">
                    <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="px-3 py-3.5" />
                    <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-[var(--color-text)]">
                      {row.qc_number || row.inspection_number}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--color-text-secondary)]">
                      {formatInspectionDate(row.inspection_date)}
                    </td>
                    <td
                      className="truncate px-4 py-3.5 text-[var(--color-text-secondary)]"
                      title={row.customer_name || "—"}
                    >
                      {row.customer_name || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-[var(--color-text-secondary)]">
                      {row.sales_order_number || "—"}
                    </td>
                    <td
                      className="truncate px-4 py-3.5 text-[var(--color-text)]"
                      title={row.product_name || "—"}
                    >
                      {row.product_name || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--color-text-secondary)]">
                      {row.checked_by || row.inspector || "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <FinalStatusBadge row={row} />
                    </td>
                    <td className="px-4 py-3.5">
                      <FinalResultBadge row={row} />
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <InventoryRowActionsMenu
                        rowId={row.id ?? row.qc_number ?? row.inspection_number}
                        isOpen={openMenuId === (row.id ?? row.qc_number ?? row.inspection_number)}
                        onOpen={setOpenMenuId}
                        onClose={() => setOpenMenuId(null)}
                        showAdd={false}
                        showEdit={normalizeProcessStatus(row) === "in_progress"}
                        editLabel="Mark as Passed"
                        editIcon={CheckCircle}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4">
          <div className="ui-modal !p-0 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden">
            <div className="flex shrink-0 items-start justify-between border-b border-[var(--color-border-soft)] px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">
                  {viewRow.qc_number || viewRow.inspection_number}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">Final quality check details</p>
              </div>
              <button type="button" onClick={() => setViewRow(null)} className="rounded-lg p-2 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto p-5 sm:grid-cols-2">
              {[
                ["Date", formatInspectionDate(viewRow.inspection_date)],
                ["Customer", viewRow.customer_name || "—"],
                ["Sales Order", viewRow.sales_order_number || "—"],
                ["Item", viewRow.product_name || "—"],
                ["Batch", viewRow.batch_code || "—"],
                ["Packing Status", viewRow.packing_status || "—"],
                ["Approval", viewRow.approval || "—"],
                ["Certificate", viewRow.certificate_ref || "—"],
                ["Checked By", viewRow.checked_by || viewRow.inspector || "—"],
                ["Remarks", viewRow.remarks || "—"],
              ].map(([label, value]) => (
                <div key={label} className="min-h-[4.25rem] rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-[var(--color-text)]">{value}</dd>
                </div>
              ))}
              <div className="min-h-[4.25rem] rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Status</dt>
                <dd className="mt-1"><FinalStatusBadge row={viewRow} /></dd>
              </div>
              <div className="min-h-[4.25rem] rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Result</dt>
                <dd className="mt-1"><FinalResultBadge row={viewRow} /></dd>
              </div>
            </dl>
            <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-border-soft)] bg-[var(--color-surface)] px-6 py-4">
              {normalizeProcessStatus(viewRow) === "in_progress" ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => handleMarkPassed(viewRow)}
                  disabled={savingPassId !== null}
                >
                  {savingPassId === viewRow.id ? "Saving…" : "Mark as Passed"}
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={() => setViewRow(null)}>Close</Button>
            </div>
          </div>
        </div>
      ) : null}
      {showCreateForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4">
          <form onSubmit={handleCreateFinalQC} className="ui-modal !p-0 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden">
            <div className="flex shrink-0 items-start justify-between border-b border-[var(--color-border-soft)] px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">New Final QC</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">Create a final quality check record.</p>
              </div>
              <button type="button" onClick={() => setShowCreateForm(false)} className="rounded-lg p-2 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2">
              {[
                ["inspection_number", "QC Number", "text", true],
                ["inspection_date", "Date", "date", true],
                ["customer_name", "Customer", "text", false],
                ["sales_order_number", "Sales Order", "text", false],
                ["product_name", "Item", "text", false],
                ["batch_code", "Batch", "text", false],
                ["inspector", "Checked By", "text", false],
              ].map(([name, label, type, required]) => (
                <label key={name} className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
                  {label}{required ? " *" : ""}
                  <input
                    type={type}
                    required={required}
                    maxLength={name === "inspection_number" ? 64 : undefined}
                    value={newFinalQC[name]}
                    onChange={(event) => setNewFinalQC((prev) => ({ ...prev, [name]: event.target.value }))}
                    className="ui-input w-full"
                  />
                </label>
              ))}
              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] sm:col-span-2">
                Remarks
                <textarea
                  rows={3}
                  value={newFinalQC.notes}
                  onChange={(event) => setNewFinalQC((prev) => ({ ...prev, notes: event.target.value }))}
                  className="ui-input w-full resize-y"
                />
              </label>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-border-soft)] bg-[var(--color-surface)] px-6 py-4">
              <Button type="button" variant="secondary" onClick={() => setShowCreateForm(false)} disabled={creatingFinalQC}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={creatingFinalQC}>
                {creatingFinalQC ? "Creating…" : "Create Final QC"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
    </InventoryPlanningShell>
  );
}
