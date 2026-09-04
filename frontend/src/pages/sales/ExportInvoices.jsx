import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Edit2,
  Eye,
  Filter,
  ListFilter,
  Plus,
  Printer,
  Receipt,
  Search,
  Trash2,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageShell } from "../../components/common/ListPageShell";
import { SearchBar } from "../../components/common/SearchFilter";
import Button from "../../components/common/Button";
import RowActionMenu from "../../components/common/RowActionMenu";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { cancelInvoice, getInvoicesV2 } from "../../api/salesApi";
import { apiErrorMessage } from "../../utils/apiError";
import { formatInr, statusColor } from "../../data/salesMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { runListExport } from "../../utils/listExport";

const EXPORT_INVOICE_COLUMNS = [
  { key: "invoice_number", label: "Invoice No." },
  { key: "issue_date", label: "Date" },
  { key: "buyer_name", label: "Buyer Name" },
  { key: "due_in", label: "Due in" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
];

const PAGE_SIZES = [10, 20, 50];

const SORT_OPTIONS = [
  { id: "date_desc", label: "Invoice date (Latest First)" },
  { id: "date_asc", label: "Invoice date (Oldest First)" },
  { id: "amount_desc", label: "Invoice Amount (High to Low)" },
  { id: "amount_asc", label: "Invoice Amount (Low to High)" },
];

const EMPTY_FILTERS = {
  due: "",
  customDueDate: "",
  invoiceStatus: "",
  eInvoiceStatus: "",
  eWaybillStatus: "",
  exportStatus: "",
  documentType: "",
  amountBand: "",
};

function fmtDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function daysUntilDue(dueDate) {
  if (!dueDate) return "—";
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / 86400000);
  if (diff < 0) return `Overdue ${Math.abs(diff)}d`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `${diff} days`;
}

function Chip({ label, active, onClick, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
        active
          ? "bg-[var(--color-primary)] text-white"
          : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </button>
  );
}

function FilterSection({ label, children }) {
  return (
    <div className="border-b border-[var(--color-table-border)] py-4 last:border-b-0">
      <p className="mb-2.5 text-[12px] font-medium text-[var(--color-text-faint)]">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SummaryTab({ label, count, amount, active, tone, onClick }) {
  const toneStyles = {
    blue: {
      active: "border-[var(--color-primary)] text-[var(--color-primary)]",
      hover: "hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]",
    },
    purple: {
      active: "border-[var(--color-primary)] text-[var(--color-primary)]",
      hover: "hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]",
    },
    green: {
      active: "border-[#16a34a] text-[#16a34a]",
      hover: "hover:border-[#16a34a] hover:text-[#16a34a]",
    },
    orange: {
      active: "border-[#ea580c] text-[#ea580c]",
      hover: "hover:border-[#ea580c] hover:text-[#ea580c]",
    },
  };
  const currentTone = toneStyles[tone] || toneStyles.purple;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 flex-1 border-b-[3px] px-5 py-3.5 text-left transition duration-150 cursor-pointer ${
        active
          ? `bg-[var(--color-surface)] ${currentTone.active}`
          : `border-transparent bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]/80 ${currentTone.hover}`
      }`}
    >
      <p className={`text-[13px] font-medium transition-colors ${active ? "" : "text-[var(--color-text-muted)]"}`}>
        {label}{" "}
        <span className={active ? "opacity-70" : "text-[var(--color-text-faint)]"}>({count})</span>
      </p>
      <p className={`mt-1 text-[18px] font-bold tabular-nums transition-colors ${active ? "text-inherit" : "text-[var(--color-text)]"}`}>
        {amount}
      </p>
    </button>
  );
}

export default function ExportInvoices() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({
    total_sales: { count: 0, amount: 0 },
    unpaid: { count: 0, amount: 0 },
    paid: { count: 0, amount: 0 },
    partially_paid: { count: 0, amount: 0 },
  });
  const [kpiFilter, setKpiFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [dateFrom, setDateFrom] = useState("2026-04-01");
  const [dateTo, setDateTo] = useState("2027-03-31");
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);

  const openDateFrom = () => {
    if (typeof dateFromRef.current?.showPicker === "function") {
      dateFromRef.current.showPicker();
    } else {
      dateFromRef.current?.focus();
      dateFromRef.current?.click();
    }
  };

  const openDateTo = () => {
    if (typeof dateToRef.current?.showPicker === "function") {
      dateToRef.current.showPicker();
    } else {
      dateToRef.current?.focus();
      dateToRef.current?.click();
    }
  };
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [sortId, setSortId] = useState("date_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getInvoicesV2({
        page,
        page_size: pageSize,
        search: searchDebounced || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        payment_filter: kpiFilter === "all" ? "all" : kpiFilter,
        sort_by: sortId,
        due: filters.due || undefined,
        custom_due_date: filters.due === "custom" ? filters.customDueDate || undefined : undefined,
        invoice_status: filters.invoiceStatus || undefined,
        e_invoice_status: filters.eInvoiceStatus || undefined,
        e_waybill_status: filters.eWaybillStatus || undefined,
        export_status: filters.exportStatus || undefined,
        document_type: "export",
        amount_band: filters.amountBand || undefined,
      });
      const data = res?.data || {};
      setRows(data.items || []);
      setTotal(data.total || 0);
      if (data.summary) setSummary(data.summary);
    } catch {
      addToast("Failed to load export invoices", "error");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [addToast, page, pageSize, searchDebounced, dateFrom, dateTo, kpiFilter, sortId, filters]);

  useEffect(() => {
    load();
  }, [load]);
  useManufacturingRefresh(load);

  useEffect(() => {
    setPage(1);
  }, [kpiFilter, searchDebounced, filters, sortId, pageSize, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const kpis = {
    all: summary.total_sales || { count: 0, amount: 0 },
    unpaid: summary.unpaid || { count: 0, amount: 0 },
    paid: summary.paid || { count: 0, amount: 0 },
    partial: summary.partially_paid || { count: 0, amount: 0 },
  };

  const openFilters = () => {
    setDraftFilters(filters);
    setShowFilters(true);
    setShowSort(false);
  };

  const handleExport = (format) => {
    const exportRows = rows.map((r) => ({
      invoice_number: r.invoice_number,
      issue_date: fmtDisplayDate(r.issue_date || r.due_date),
      buyer_name: r.buyer_name || r.customer_name || "",
      due_in: r.due_in || daysUntilDue(r.due_date),
      amount: r.amount,
      status: r.payment_status || r.status || "",
    }));
    runListExport(format, {
      data: exportRows,
      columns: EXPORT_INVOICE_COLUMNS,
      filename: "export-invoices",
      title: "Export Invoices",
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  if (loading && rows.length === 0) {
    return (
      <ListPageShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader label="Loading export invoices…" />
        </div>
      </ListPageShell>
    );
  }

  return (
    <ListPageShell stackClassName="space-y-4">
      <PageHeader
        title="Export Invoices"
        subtitle="Track export sales invoices, payment status, and compliance."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportDownloadMenu disabled={!rows.length} onExport={handleExport} />
            <Button variant="add" to="/sales/export-invoices/create" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              Export Invoice
            </Button>
          </div>
        }
      />
      <div className="mb-4 overflow-hidden rounded-xl bg-[var(--color-surface-muted)]">
        <div className="flex flex-wrap">
          <SummaryTab
            label="Total Sales"
            count={kpis.all.count}
            amount={formatInr(kpis.all.amount)}
            active={kpiFilter === "all"}
            tone="purple"
            onClick={() => setKpiFilter("all")}
          />
          <SummaryTab
            label="Unpaid"
            count={kpis.unpaid.count}
            amount={formatInr(kpis.unpaid.amount)}
            active={kpiFilter === "unpaid"}
            tone="purple"
            onClick={() => setKpiFilter("unpaid")}
          />
          <SummaryTab
            label="Paid"
            count={kpis.paid.count}
            amount={formatInr(kpis.paid.amount)}
            active={kpiFilter === "paid"}
            tone="green"
            onClick={() => setKpiFilter("paid")}
          />
          <SummaryTab
            label="Partially Paid"
            count={kpis.partial.count}
            amount={formatInr(kpis.partial.amount)}
            active={kpiFilter === "partial"}
            tone="orange"
            onClick={() => setKpiFilter("partial")}
          />
        </div>
      </div>

      {/* Toolbar row 1: search | date + create */}
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchBar value={search} onChange={setSearch} placeholder="Search" className="w-full" />
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-3 rounded-full bg-[var(--color-surface)] px-4 py-2.5 text-[13px] text-[var(--color-text-secondary)] shadow-sm shadow-[#00000010] border border-[var(--color-border-soft)]">
            <button
              type="button"
              onClick={openDateFrom}
              className="flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
              aria-label="Open start date picker"
            >
              <Calendar className="h-5 w-5" />
            </button>
            <input
              ref={dateFromRef}
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="sr-only"
            />
            <button
              type="button"
              onClick={openDateFrom}
              className="text-[14px] font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
              title="Click to select start date"
            >
              {fmtDisplayDate(dateFrom) || "Start Date"}
            </button>
            <span className="text-[var(--color-text-faint)] select-none">→</span>
            <button
              type="button"
              onClick={openDateTo}
              className="text-[14px] font-medium text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
              title="Click to select end date"
            >
              {fmtDisplayDate(dateTo) || "End Date"}
            </button>
            <input
              ref={dateToRef}
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="sr-only"
            />
            <button
              type="button"
              onClick={openDateTo}
              className="flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
              aria-label="Open end date picker"
            >
              <Calendar className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar row 2: filters + sort (right) */}
      <div className="relative mb-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={openFilters}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-surface-muted)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSort((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium ${
              showSort
                ? "bg-[#dcdce3] text-[var(--color-text)]"
                : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            <ListFilter className="h-4 w-4" />
            Sort by
          </button>
          {showSort && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close sort"
                onClick={() => setShowSort(false)}
              />
              <div className="absolute right-0 z-20 mt-1.5 w-[260px] overflow-hidden rounded-xl border border-[var(--color-table-border)] bg-[var(--color-surface)] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortId(opt.id);
                      setShowSort(false);
                    }}
                    className={`block w-full px-4 py-2.5 text-left text-[13px] hover:bg-[var(--color-bg)] ${
                      sortId === opt.id ? "font-semibold text-[var(--color-text)]" : "font-normal text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-table-border)] bg-[var(--color-surface)]">
        <div className="ui-table-wrap ui-table-wrap--scroll !rounded-none !border-0">
          <table className="ui-table w-full min-w-[880px] border-collapse text-left">
            <thead className="ui-table-head">
              <tr>
                <SerialNumberHeader className="border-b border-r border-[var(--color-table-border)]" />
                {["Invoice No.", "Date", "Buyer Name", "Due in", "Amount", "Status", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="border-b border-r border-[var(--color-table-border)] px-4 py-3 text-[12px] font-semibold last:border-r-0"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-20 text-center">
                    <Receipt className="mx-auto h-14 w-14 text-[var(--color-text-faint)]" strokeWidth={1.15} />
                    <p className="mt-3 text-[14px] text-[var(--color-text-muted)]">
                      No export invoices yet.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r, rowIndex) => (
                  <tr key={r.id} className="hover:bg-[var(--color-table-row-hover)]">
                    <SerialNumberCell
                      rowIndex={rowIndex}
                      page={page}
                      pageSize={pageSize}
                      className="border-t border-r border-[var(--color-table-border)]"
                    />
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[14px] font-medium text-[var(--color-primary)]">
                      <Link
                        to={`/sales/export-invoices/${r.id}`}
                        className="hover:underline text-[var(--color-primary)] font-semibold"
                      >
                        {r.invoice_number}
                      </Link>
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[14px] text-[var(--color-text-secondary)]">
                      {fmtDisplayDate(r.issue_date || r.due_date) || "—"}
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[14px] font-medium text-[var(--color-text)]">
                      {r.buyer_name || r.customer_name || "—"}
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[14px] text-[var(--color-text-secondary)]">
                      {r.due_in || daysUntilDue(r.due_date)}
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[14px] font-semibold tabular-nums text-[var(--color-text)]">
                      {formatInr(r.amount)}
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold capitalize ${statusColor(r.payment_status || r.status)}`}
                      >
                        {r.payment_status || r.status}
                      </span>
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-2 last:border-r-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end">
                        <RowActionMenu
                          rowId={r.id}
                          openMenu={openMenu}
                          setOpenMenu={setOpenMenu}
                          items={[
                            {
                              label: "View / Print",
                              icon: <Eye className="h-4 w-4" />,
                              onClick: () => navigate(`/sales/export-invoices/${r.id}`),
                            },
                            (r.invoice_status || r.status) !== "cancelled"
                              ? {
                                  label: "Edit",
                                  icon: <Edit2 className="h-4 w-4" />,
                                  onClick: () => navigate(`/sales/export-invoices/${r.id}/edit`),
                                }
                              : null,
                            (r.payment_status || r.status) !== "paid" && (r.invoice_status || r.status) !== "cancelled"
                              ? {
                                  label: "Record Payment",
                                  icon: <CreditCard className="h-4 w-4" />,
                                  onClick: () => navigate(`/sales/payments/create?invoice_id=${r.id}`),
                                }
                              : null,
                            (r.invoice_status || r.status) !== "cancelled" ? { divider: true } : null,
                            (r.invoice_status || r.status) !== "cancelled"
                              ? {
                                  label: "Cancel Invoice",
                                  icon: <Trash2 className="h-4 w-4" />,
                                  danger: true,
                                  onClick: async () => {
                                    if (!window.confirm(`Cancel export invoice ${r.invoice_number}?`)) return;
                                    try {
                                      await cancelInvoice(r.id);
                                      addToast("Export invoice cancelled", "success");
                                      load();
                                    } catch (err) {
                                      addToast(apiErrorMessage(err, "Failed to cancel"), "error");
                                    }
                                  },
                                }
                              : null,
                          ].filter(Boolean)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="ui-pagination justify-between border-t border-[var(--color-border-soft)] px-4 py-3">
          <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap text-[13px] text-[var(--color-text-muted)]">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="ui-pagination-select"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>
              {total === 0
                ? "0–0 of 0"
                : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
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
            <button
              type="button"
              className="ui-page-btn ui-page-btn--active"
            >
              {page}
            </button>
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

      {/* Filters drawer — full sections from screenshot */}
      {showFilters && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/35"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setShowFilters(false)}
        >
          <aside className="flex h-full w-full max-w-[400px] flex-col bg-[var(--color-surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--color-table-border)] px-5 py-4">
              <h2 className="text-[18px] font-bold text-[var(--color-text)]">Filters</h2>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="rounded-lg p-1 text-[var(--color-text-faint)] hover:bg-[var(--color-surface-hover)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5">
              <FilterSection label="Due">
                <Chip
                  label="Over Due"
                  active={draftFilters.due === "overdue"}
                  onClick={() =>
                    setDraftFilters((f) => ({
                      ...f,
                      due: f.due === "overdue" ? "" : "overdue",
                    }))
                  }
                />
                <Chip
                  label="Due Tomorrow"
                  active={draftFilters.due === "tomorrow"}
                  onClick={() =>
                    setDraftFilters((f) => ({
                      ...f,
                      due: f.due === "tomorrow" ? "" : "tomorrow",
                    }))
                  }
                />
                <Chip
                  label="Due Today"
                  active={draftFilters.due === "today"}
                  onClick={() =>
                    setDraftFilters((f) => ({
                      ...f,
                      due: f.due === "today" ? "" : "today",
                    }))
                  }
                />
                <label className="inline-flex cursor-pointer items-center">
                  <Chip
                    label="Custom Due Date"
                    icon={Calendar}
                    active={draftFilters.due === "custom"}
                    onClick={() =>
                      setDraftFilters((f) => ({
                        ...f,
                        due: f.due === "custom" ? "" : "custom",
                      }))
                    }
                  />
                  {draftFilters.due === "custom" && (
                    <input
                      type="date"
                      value={draftFilters.customDueDate}
                      onChange={(e) =>
                        setDraftFilters((f) => ({ ...f, customDueDate: e.target.value }))
                      }
                      className="ml-2 rounded-md border border-[var(--color-border)] px-2 py-1 text-[12px]"
                    />
                  )}
                </label>
              </FilterSection>

              <FilterSection label="Invoice Status">
                <Chip
                  label="Active"
                  active={draftFilters.invoiceStatus === "active"}
                  onClick={() =>
                    setDraftFilters((f) => ({
                      ...f,
                      invoiceStatus: f.invoiceStatus === "active" ? "" : "active",
                    }))
                  }
                />
                <Chip
                  label="Cancelled"
                  active={draftFilters.invoiceStatus === "cancelled"}
                  onClick={() =>
                    setDraftFilters((f) => ({
                      ...f,
                      invoiceStatus: f.invoiceStatus === "cancelled" ? "" : "cancelled",
                    }))
                  }
                />
              </FilterSection>

              <FilterSection label="E-Invoice Status">
                {["All", "Active", "Cancelled"].map((opt) => {
                  const id = opt.toLowerCase();
                  return (
                    <Chip
                      key={opt}
                      label={opt}
                      active={draftFilters.eInvoiceStatus === id}
                      onClick={() =>
                        setDraftFilters((f) => ({
                          ...f,
                          eInvoiceStatus: f.eInvoiceStatus === id ? "" : id,
                        }))
                      }
                    />
                  );
                })}
              </FilterSection>

              <FilterSection label="E-Waybill Status">
                {["All", "Active", "Expired", "Cancelled"].map((opt) => {
                  const id = opt.toLowerCase();
                  return (
                    <Chip
                      key={opt}
                      label={opt}
                      active={draftFilters.eWaybillStatus === id}
                      onClick={() =>
                        setDraftFilters((f) => ({
                          ...f,
                          eWaybillStatus: f.eWaybillStatus === id ? "" : id,
                        }))
                      }
                    />
                  );
                })}
              </FilterSection>

              <FilterSection label="Export Invoice Status">
                <Chip
                  label="Active"
                  active={draftFilters.exportStatus === "active"}
                  onClick={() =>
                    setDraftFilters((f) => ({
                      ...f,
                      exportStatus: f.exportStatus === "active" ? "" : "active",
                    }))
                  }
                />
              </FilterSection>

              <FilterSection label="Total Amount">
                {[
                  { id: "under2k", label: "under ₹2,000" },
                  { id: "2to5", label: "₹2,000-₹5,000" },
                  { id: "5to10", label: "₹5,000-₹10,000" },
                  { id: "10to20", label: "₹10,000-₹20,000" },
                  { id: "20plus", label: "₹20,000-Above" },
                ].map((opt) => (
                  <Chip
                    key={opt.id}
                    label={opt.label}
                    active={draftFilters.amountBand === opt.id}
                    onClick={() =>
                      setDraftFilters((f) => ({
                        ...f,
                        amountBand: f.amountBand === opt.id ? "" : opt.id,
                      }))
                    }
                  />
                ))}
              </FilterSection>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-table-border)] px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setDraftFilters(EMPTY_FILTERS);
                  setFilters(EMPTY_FILTERS);
                }}
                className="rounded-xl bg-[var(--color-surface-muted)] py-3 text-[14px] font-semibold text-[var(--color-text)]"
              >
                Clear Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters(draftFilters);
                  setShowFilters(false);
                }}
                className="rounded-xl py-3 text-[14px] font-semibold text-[var(--color-text)]"
                style={{ background: "#EAE5B3" }}
              >
                Apply Filter
              </button>
            </div>
          </aside>
        </div>
      )}
    </ListPageShell>
  );
}
