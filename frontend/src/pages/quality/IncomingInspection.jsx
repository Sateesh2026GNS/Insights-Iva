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
import { getIncomingEnriched, getIncomingSummary } from "../../api/qualityApi";
import {
  EMPTY_INCOMING_SUMMARY,
  formatInspectionDate,
  incomingStatusLabel,
  mergeIncomingSummary,
  normalizeIncomingStatus,
} from "../../data/qualityMasterData";
import { exportToExcel } from "../../utils/exportUtils";

const PAGE_SIZES = [10, 25, 50];

function formatQty(row) {
  const qty = Number(row.quantity) || 0;
  const unit = row.quantity_unit || "KG";
  return `${qty.toLocaleString("en-IN")} ${unit}`;
}

function IncomingStatusBadge({ row }) {
  const key = normalizeIncomingStatus(row);
  const styles = {
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
    in_progress: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[key]}`}>
      {incomingStatusLabel(key)}
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

export default function IncomingInspection() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(EMPTY_INCOMING_SUMMARY);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
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
      const [sumRes, listRes] = await Promise.allSettled([getIncomingSummary(), getIncomingEnriched()]);
      let list = [];
      if (listRes.status === "fulfilled" && Array.isArray(listRes.value?.data) && listRes.value.data.length > 0) {
        list = listRes.value.data.map((r) => ({
          ...r,
          quantity_unit: r.quantity_unit || "KG",
        }));
      }
      setRows(list);
      const apiSummary = sumRes.status === "fulfilled" ? sumRes.value?.data || {} : {};
      setSummary(mergeIncomingSummary(apiSummary, list));
    } catch (err) {
      if (isRefresh) throw err;
      setRows([]);
      setSummary(EMPTY_INCOMING_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const suppliers = useMemo(
    () => [...new Set(rows.map((r) => r.vendor_name).filter(Boolean))].sort(),
    [rows]
  );
  const materials = useMemo(
    () => [...new Set(rows.map((r) => r.material_name).filter(Boolean))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (supplierFilter && r.vendor_name !== supplierFilter) return false;
      if (materialFilter && r.material_name !== materialFilter) return false;
      if (statusFilter && normalizeIncomingStatus(r) !== statusFilter) return false;
      if (dateFilter && String(r.inspection_date || "").slice(0, 10) !== dateFilter) return false;
      if (!q) return true;
      return [r.inspection_number, r.vendor_name, r.material_name, r.batch_code, r.po_reference, r.inspector]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [rows, search, supplierFilter, materialFilter, statusFilter, dateFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, supplierFilter, materialFilter, statusFilter, dateFilter, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const approvedPct = summary.total ? Math.round((summary.approved / summary.total) * 100) : 0;
  const rejectedPct = summary.total ? Math.round((summary.rejected / summary.total) * 100) : 0;
  const inProgressPct = summary.total ? Math.round((summary.in_progress / summary.total) * 100) : 0;

  const handleInspect = (row) => {
    const key = row.id ?? row.inspection_number;
    setRows((prev) =>
      prev.map((r) =>
        (r.id ?? r.inspection_number) === key
          ? { ...r, status: "approved", result: "pass" }
          : r
      )
    );
    addToast(`Inspection ${row.inspection_number || ""} marked as approved`, "success");
    setViewRow(null);
  };

  const exportRows = filtered.map((r) => ({
    inspection_number: r.inspection_number,
    date: formatInspectionDate(r.inspection_date),
    supplier: r.vendor_name,
    material: r.material_name,
    batch: r.batch_code,
    quantity: formatQty(r),
    status: incomingStatusLabel(normalizeIncomingStatus(r)),
    inspector: r.inspector,
  }));

  if (loading) return <Loader label="Loading incoming inspections..." />;

  return (
    <div className="min-w-0 space-y-5 pb-4">
      <PageHeader
        title="Incoming Inspection"
        showTitle
        subtitle="Track and manage all incoming material inspections."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                exportToExcel(
                  exportRows,
                  [
                    { key: "inspection_number", label: "Inspection No." },
                    { key: "date", label: "Date" },
                    { key: "supplier", label: "Supplier" },
                    { key: "material", label: "Material" },
                    { key: "batch", label: "Batch / Lot No." },
                    { key: "quantity", label: "Quantity" },
                    { key: "status", label: "Status" },
                    { key: "inspector", label: "Inspector" },
                  ],
                  "incoming-inspections"
                )
              }
            >
              <FileSpreadsheet className="h-4 w-4" /> Export
            </Button>
            <Button variant="primary" to="/quality/inspection">
              <Plus className="h-4 w-4" /> New Inspection
            </Button>
          </div>
        }
      />

      {/* Filters */}
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
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="ui-select !w-auto min-w-[10.5rem]"
            aria-label="Supplier filter"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
            className="ui-select !w-auto min-w-[10.5rem]"
            aria-label="Material filter"
          >
            <option value="">All Materials</option>
            {materials.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ui-select !w-auto min-w-[9.5rem]"
            aria-label="Status filter"
          >
            <option value="">All Status</option>
            <option value="approved">Approved</option>
            <option value="in_progress">In Progress</option>
            <option value="rejected">Rejected</option>
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
                setSupplierFilter("");
                setMaterialFilter("");
                setStatusFilter("");
                setDateFilter("");
              }}
            >
              Clear all filters
            </Button>
          </div>
        ) : null}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Total Inspections" value={summary.total} icon={ClipboardList} tone="primary" meta="In selected period" />
        <KpiCard label="Approved" value={summary.approved} icon={CheckCircle} tone="success" meta={`${approvedPct}% of total`} />
        <KpiCard label="Rejected" value={summary.rejected} icon={XCircle} tone="danger" meta={`${rejectedPct}% of total`} />
        <KpiCard label="In Progress" value={summary.in_progress} icon={Clock} tone="warning" meta={`${inProgressPct}% of total`} />
        <KpiCard
          label="Today's Inspections"
          value={summary.todays_inspections}
          icon={Calendar}
          tone="violet"
          meta={formatInspectionDate(new Date().toISOString())}
        />
      </div>

      {/* Table */}
      <div className="ui-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1040px] w-full border-collapse text-left text-[13px]">
            <thead className="bg-[var(--color-surface-thead)] text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr className="border-b border-[var(--color-border-soft)]">
                <SerialNumberHeader className="px-3 py-3" />
                <th className="px-4 py-3">Inspection No.</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3">Batch / Lot No.</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Inspector</th>
                <th className="w-[4.5rem] px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-muted)]">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-sm text-[var(--color-text-muted)]">
                    No incoming inspections found.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, rowIndex) => (
                  <tr key={row.id ?? row.inspection_number} className="hover:bg-[var(--color-surface-muted)]/50">
                    <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="px-3 py-3.5" />
                    <td className="px-4 py-3.5 font-semibold text-[var(--color-text)]">{row.inspection_number}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--color-text-secondary)]">
                      {formatInspectionDate(row.inspection_date)}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{row.vendor_name || "—"}</td>
                    <td className="px-4 py-3.5 text-[var(--color-text)]">{row.material_name || "—"}</td>
                    <td className="px-4 py-3.5 font-medium text-[var(--color-text-secondary)]">{row.batch_code || "—"}</td>
                    <td className="px-4 py-3.5 tabular-nums text-[var(--color-text)]">{formatQty(row)}</td>
                    <td className="px-4 py-3.5">
                      <IncomingStatusBadge row={row} />
                    </td>
                    <td className="px-4 py-3.5 text-[var(--color-text-secondary)]">{row.inspector || "—"}</td>
                    <td className="px-3 py-3.5 text-right">
                      <InventoryRowActionsMenu
                        rowId={row.id ?? row.inspection_number}
                        isOpen={openMenuId === (row.id ?? row.inspection_number)}
                        onOpen={setOpenMenuId}
                        onClose={() => setOpenMenuId(null)}
                        showAdd={false}
                        showDelete={false}
                        onView={() => setViewRow(row)}
                        onEdit={() => handleInspect(row)}
                        menuWidth={176}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      {/* View modal */}
      {viewRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">{viewRow.inspection_number}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">Incoming material inspection</p>
              </div>
              <button type="button" onClick={() => setViewRow(null)} className="rounded-lg p-2 hover:bg-[var(--color-surface-muted)]" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="grid gap-3 p-6 sm:grid-cols-2">
              {[
                ["Date", formatInspectionDate(viewRow.inspection_date)],
                ["PO Reference", viewRow.po_reference || "—"],
                ["Supplier", viewRow.vendor_name || "—"],
                ["Material", viewRow.material_name || "—"],
                ["Batch / Lot", viewRow.batch_code || "—"],
                ["Quantity", formatQty(viewRow)],
                ["Inspector", viewRow.inspector || "—"],
                ["Inspection Time", viewRow.inspection_time_minutes ? `${viewRow.inspection_time_minutes} min` : "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3">
                  <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
                  <dd className="mt-1 font-semibold text-[var(--color-text)]">{value}</dd>
                </div>
              ))}
              <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-3 sm:col-span-2">
                <dt className="text-xs text-[var(--color-text-muted)]">Status</dt>
                <dd className="mt-1"><IncomingStatusBadge row={viewRow} /></dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              {normalizeIncomingStatus(viewRow) === "in_progress" ? (
                <Button type="button" variant="primary" onClick={() => handleInspect(viewRow)}>
                  Approve Inspection
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
