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
  FileSpreadsheet,
  Filter,
  Plus,
  Search,
  X,
  XCircle,
} from "lucide-react";

import Button from "../../components/common/Button";
import { SearchBar } from "../../components/common/SearchFilter";
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

const INSPECTION_TYPE_OPTIONS = [
  { value: "incoming", label: "Incoming Inspection" },
  { value: "in_process", label: "In-Process QC" },
  { value: "final", label: "Final QC" },
  { value: "batch", label: "Batch Quality" },
  { value: "raw_material", label: "Raw Materials Inspection" },
];

const STATUS_OPTIONS = [
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "rejected", label: "Rejected" },
];

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

function MultiSelectDropdown({
  label,
  options = [],
  selected = [],
  onChange,
  placeholder = "Search...",
  minWidth = "min-w-[10.5rem]",
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
        className={`inline-flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border-soft)] bg-white px-3 py-2 text-[13px] font-medium text-[var(--color-text)] shadow-xs transition-colors hover:border-[var(--color-primary)] ${minWidth}`}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-40 w-64 rounded-xl border border-[var(--color-border-soft)] bg-white p-2 shadow-xl">
          {normalizedOptions.length > 5 && (
            <div className="mb-2 px-1">
              <SearchBar
                size="compact"
                value={query}
                onChange={setQuery}
                placeholder={placeholder}
                className="w-full"
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

export default function IncomingInspection() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(EMPTY_INCOMING_SUMMARY);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
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

  const suppliers = useMemo(() => {
    const fromRows = rows.map((r) => r.vendor_name).filter(Boolean);
    const defaults = ["Acme Steel Corp", "Precision Forgings Ltd", "Global Alloys Inc", "Apex Polymers", "Tata Steel Ltd"];
    return [...new Set([...fromRows, ...defaults])].sort();
  }, [rows]);

  const materials = useMemo(() => {
    const fromRows = rows.map((r) => r.material_name).filter(Boolean);
    const defaults = ["Steel Rod 20mm", "Aluminum Sheet 2mm", "Brass Hex Bar 15mm", "Carbon Fiber Roll", "Copper Wire 1.5mm", "Cast Iron Ingot"];
    return [...new Set([...fromRows, ...defaults])].sort();
  }, [rows]);

  const normalizeType = (r) => {
    const t = String(r.inspection_type || r.reference_type || r.type || "incoming").toLowerCase();
    if (t.includes("process") || t.includes("ipqc")) return "in_process";
    if (t.includes("final") || t.includes("fqc")) return "final";
    if (t.includes("batch")) return "batch";
    return "incoming";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(normalizeType(r))) return false;
      if (selectedSuppliers.length > 0 && !selectedSuppliers.includes(r.vendor_name)) return false;
      if (selectedMaterials.length > 0 && !selectedMaterials.includes(r.material_name)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(normalizeIncomingStatus(r))) return false;
      if (dateFilter && String(r.inspection_date || "").slice(0, 10) !== dateFilter) return false;
      if (!q) return true;
      return [r.inspection_number, r.vendor_name, r.material_name, r.batch_code, r.po_reference, r.inspector]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [rows, search, selectedTypes, selectedSuppliers, selectedMaterials, selectedStatuses, dateFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedTypes, selectedSuppliers, selectedMaterials, selectedStatuses, dateFilter, pageSize]);

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
            <Button variant="add" to="/quality/inspection" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              New Inspection
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="ui-card ui-card--padded space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative ui-search-wrap min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by inspection no, vendor, material..."
              className="ui-input w-full !pl-10 text-[13px] text-[var(--color-text)]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-white px-3 py-1.5 text-[13px] shadow-xs">
              <CalendarDays className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border-0 bg-transparent p-0 text-[13px] text-[var(--color-text)] focus:outline-none"
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
              {(selectedTypes.length + selectedSuppliers.length + selectedMaterials.length + selectedStatuses.length) > 0 ? (
                <span className="ml-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.2 text-[10px] text-white">
                  {selectedTypes.length + selectedSuppliers.length + selectedMaterials.length + selectedStatuses.length}
                </span>
              ) : null}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border-soft)] pt-3">
          <MultiSelectDropdown
            label="Inspection Types"
            options={INSPECTION_TYPE_OPTIONS}
            selected={selectedTypes}
            onChange={setSelectedTypes}
            placeholder="Search types..."
            minWidth="min-w-[12rem]"
          />
          <MultiSelectDropdown
            label="Suppliers"
            options={suppliers}
            selected={selectedSuppliers}
            onChange={setSelectedSuppliers}
            placeholder="Search suppliers..."
            minWidth="min-w-[11rem]"
          />
          <MultiSelectDropdown
            label="Materials"
            options={materials}
            selected={selectedMaterials}
            onChange={setSelectedMaterials}
            placeholder="Search materials..."
            minWidth="min-w-[11rem]"
          />
          <MultiSelectDropdown
            label="Status"
            options={STATUS_OPTIONS}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
            placeholder="Search statuses..."
            minWidth="min-w-[9.5rem]"
          />
          {(selectedTypes.length > 0 ||
            selectedSuppliers.length > 0 ||
            selectedMaterials.length > 0 ||
            selectedStatuses.length > 0 ||
            dateFilter ||
            search) && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setSelectedTypes([]);
                setSelectedSuppliers([]);
                setSelectedMaterials([]);
                setSelectedStatuses([]);
                setDateFilter("");
              }}
              className="text-xs text-[var(--color-text-muted)] hover:text-red-600"
            >
              Clear filters
            </Button>
          )}
        </div>
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
            <thead className="ui-table-head">
              <tr className="border-b border-[#d0e5e0]">
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
                    <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="px-3 py-3.5 text-[var(--color-text-muted)]" />
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => setViewRow(row)}
                        className="font-semibold text-[var(--color-primary)] hover:underline cursor-pointer text-left"
                      >
                        {row.inspection_number}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-[var(--color-text-secondary)]">
                      {formatInspectionDate(row.inspection_date)}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[var(--color-text)]">{row.vendor_name || "—"}</td>
                    <td className="px-4 py-3.5 font-medium text-[var(--color-text)]">{row.material_name || "—"}</td>
                    <td className="px-4 py-3.5 font-medium text-[var(--color-text-secondary)]">{row.batch_code || "—"}</td>
                    <td className="px-4 py-3.5 tabular-nums font-semibold text-[var(--color-text)]">{formatQty(row)}</td>
                    <td className="px-4 py-3.5">
                      <IncomingStatusBadge row={row} />
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[var(--color-text-secondary)]">{row.inspector || "—"}</td>
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
        <div className="ui-pagination justify-between border-t border-[var(--color-border-soft)] px-4 py-3">
          <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap text-[13px] text-[var(--color-text-secondary)] font-medium">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="ui-pagination-select text-[var(--color-text)]"
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

      {/* View modal */}
      {viewRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl border border-[var(--color-border)]">
            <div className="flex items-start justify-between border-b border-[var(--color-border-soft)] px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">{viewRow.inspection_number}</h2>
                <p className="text-xs font-medium text-[var(--color-text-muted)]">Incoming material inspection</p>
              </div>
              <button type="button" onClick={() => setViewRow(null)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] transition-colors" aria-label="Close">
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
                <div key={label} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/40 p-3">
                  <dt className="text-xs font-medium text-[var(--color-text-muted)]">{label}</dt>
                  <dd className="mt-1 font-semibold text-[var(--color-text)]">{value}</dd>
                </div>
              ))}
              <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/40 p-3 sm:col-span-2">
                <dt className="text-xs font-medium text-[var(--color-text-muted)]">Status</dt>
                <dd className="mt-1"><IncomingStatusBadge row={viewRow} /></dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2 border-t border-[var(--color-border-soft)] px-6 py-4">
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
