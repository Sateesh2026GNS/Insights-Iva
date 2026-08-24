import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight, Filter, ListFilter, MoreVertical, Plus, Receipt, Search, X } from "lucide-react";

import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { cancelInvoice, getInvoicesV2 } from "../../api/salesApi";
import { apiErrorMessage } from "../../utils/apiError";
import { formatInr, statusColor } from "../../data/salesMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";

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
  if (!dueDate) return "ΓÇö";
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
          ? "bg-[#0f6d84] text-white"
          : "bg-[#f0f0f3] text-[#4a4a55] hover:bg-[#e4e4ea]"
      }`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </button>
  );
}

function FilterSection({ label, children }) {
  return (
    <div className="border-b border-[#d0d0d8] py-4 last:border-b-0">
      <p className="mb-2.5 text-[12px] font-medium text-[#9a9aa5]">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SummaryTab({ label, count, amount, active, tone, onClick }) {
  const activeStyles = {
    blue: "border-[#0f6d84] text-[#0f6d84]",
    purple: "border-[#0f6d84] text-[#0f6d84]",
    green: "border-[#16a34a] text-[#16a34a]",
    orange: "border-[#ea580c] text-[#ea580c]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 flex-1 border-b-[3px] px-5 py-3.5 text-left transition ${
        active
          ? `bg-white ${activeStyles[tone]}`
          : "border-transparent bg-transparent text-[#6b6b76] hover:bg-white/70"
      }`}
    >
      <p className={`text-[13px] font-medium ${active ? "" : "text-[#6b6b76]"}`}>
        {label}{" "}
        <span className={active ? "opacity-70" : "text-[#a0a0ab]"}>({count})</span>
      </p>
      <p className={`mt-1 text-[18px] font-bold tabular-nums ${active ? "text-inherit" : "text-[#1a1a1f]"}`}>
        {amount}
      </p>
    </button>
  );
}

export default function InvoiceDashboard() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
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
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [sortId, setSortId] = useState("date_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [menuId, setMenuId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

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
        document_type: filters.documentType || undefined,
        amount_band: filters.amountBand || undefined,
      });
      const data = res?.data || {};
      setRows(data.items || []);
      setTotal(data.total || 0);
      if (data.summary) setSummary(data.summary);
    } catch {
      addToast("Failed to load invoices", "error");
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

  const handleCancelInvoice = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Cancel invoice ${row.invoice_number}? This cannot be undone.`)) return;
    setDeletingId(row.id);
    setMenuId(null);
    try {
      await cancelInvoice(row.id);
      addToast("Invoice cancelled", "success");
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to cancel invoice"), "error");
    } finally {
      setDeletingId(null);
    }
  };

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

  if (loading && rows.length === 0) return <Loader label="Loading invoicesΓÇª" />;

  return (
    <div className="min-h-full bg-[var(--color-bg)] px-5 py-5 sm:px-6">
      {/* Toolbar row 1: calendar + create */}
      <div className="mb-4 flex justify-end gap-3">
        <div className="inline-flex items-center gap-3 rounded-full bg-white px-4 py-3 text-[13px] text-[#4a4a55] shadow-sm shadow-[#00000010]">
          <Calendar className="h-5 w-5 text-[#6b6b76]" />
          <span className="text-[14px] font-medium text-[#2c2b3d]">{fmtDisplayDate(dateFrom)}</span>
          <span className="text-[#9a9aa5]">→</span>
          <span className="text-[14px] font-medium text-[#2c2b3d]">{fmtDisplayDate(dateTo)}</span>
          <Calendar className="h-5 w-5 text-[#6b6b76]" />
        </div>
        <Link
          to="/sales/invoices/create"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-action-blue)] px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:bg-[var(--color-action-blue-hover)] active:bg-[var(--color-action-blue-active)]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Create Invoice
        </Link>
      </div>

      {/* KPI strip */}
      <div className="mb-4 overflow-hidden rounded-xl bg-[#ececf0]">
        <div className="flex flex-wrap">
          <SummaryTab
            label="Total Sales"
            count={kpis.all.count}
            amount={formatInr(kpis.all.amount)}
            active={kpiFilter === "all"}
            tone="blue"
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

      {/* Search row: under KPI cards */}
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative ui-search-wrap w-full">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9aa5]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full rounded-full border border-[#e4e4ea] bg-white py-2.5 pl-10 pr-4 text-[14px] text-[#1a1a1f] shadow-sm placeholder:text-[#9a9aa5] focus:border-[#0f6d84] focus:outline-none focus:ring-2 focus:ring-[#0f6d84]/25"
          />
        </div>
      </div>

      {/* Toolbar row 2: filters + sort (right) */}
      <div className="relative mb-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={openFilters}
          className="inline-flex items-center gap-2 rounded-lg bg-[#ececf0] px-3.5 py-2 text-[13px] font-medium text-[#4a4a55] hover:bg-[#e0e0e6]"
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
                ? "bg-[#dcdce3] text-[#1a1a1f]"
                : "bg-[#ececf0] text-[#4a4a55] hover:bg-[#e0e0e6]"
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
              <div className="absolute right-0 z-20 mt-1.5 w-[260px] overflow-hidden rounded-xl border border-[#d0d0d8] bg-white py-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortId(opt.id);
                      setShowSort(false);
                    }}
                    className={`block w-full px-4 py-2.5 text-left text-[13px] hover:bg-[#f5f5f7] ${
                      sortId === opt.id ? "font-semibold text-[#1a1a1f]" : "font-normal text-[#3a3a42]"
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
      <div className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="bg-[#f3f3f6]">
                <SerialNumberHeader className="border-b border-r border-[#d0d0d8]" />
                {["Invoice No.", "Date", "Buyer Name", "Due in", "Amount", "Status", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="border-b border-r border-[#d0d0d8] px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-[#6b6b76] last:border-r-0"
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
                    <Receipt className="mx-auto h-14 w-14 text-[#d0d0d8]" strokeWidth={1.15} />
                    <p className="mt-3 text-[14px] text-[#8a8a95]">
                      No invoices yet. Create your first invoice.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r, rowIndex) => (
                  <tr key={r.id} className="hover:bg-[#fafafa]">
                    <SerialNumberCell
                      rowIndex={rowIndex}
                      page={page}
                      pageSize={pageSize}
                      className="border-t border-r border-[#d0d0d8]"
                    />
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3 text-[14px] font-medium text-[#0f6d84]">
                      {r.invoice_number}
                    </td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3 text-[14px] text-[#4a4a55]">
                      {fmtDisplayDate(r.issue_date || r.due_date) || "ΓÇö"}
                    </td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3 text-[14px] font-medium text-[#1a1a1f]">
                      {r.buyer_name || r.customer_name || "ΓÇö"}
                    </td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3 text-[14px] text-[#4a4a55]">
                      {r.due_in || daysUntilDue(r.due_date)}
                    </td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3 text-[14px] font-semibold tabular-nums text-[#1a1a1f]">
                      {formatInr(r.amount)}
                    </td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold capitalize ${statusColor(r.payment_status || r.status)}`}
                      >
                        {r.payment_status || r.status}
                      </span>
                    </td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3">
                      <div className="relative flex flex-wrap items-center gap-3">
                        <Link
                          to={`/sales/invoices/${r.id}`}
                          className="text-[12px] font-semibold text-[#4a4a55] hover:underline"
                        >
                          View
                        </Link>
                        {(r.invoice_status || "active") !== "cancelled" ? (
                          <Link
                            to={`/sales/invoices/${r.id}/edit`}
                            className="text-[12px] font-semibold text-[var(--color-primary)] hover:underline"
                          >
                            Edit
                          </Link>
                        ) : null}
                        <Link
                          to={`/sales/invoices/${r.id}`}
                          className="text-[12px] font-semibold text-[#4a4a55] hover:underline"
                        >
                          Print
                        </Link>
                        {(r.payment_status || r.status) !== "paid" &&
                        (r.invoice_status || "active") !== "cancelled" ? (
                          <Link
                            to={`/sales/payments/create?invoice_id=${r.id}`}
                            className="text-[12px] font-semibold text-[var(--color-success)] hover:underline"
                          >
                            Pay
                          </Link>
                        ) : null}
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
          <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap text-[13px] text-[#596b82]">
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

      {/* Filters drawer ΓÇö full sections from screenshot */}
      {showFilters && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/35"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setShowFilters(false)}
        >
          <aside className="flex h-full w-full max-w-[400px] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#d0d0d8] px-5 py-4">
              <h2 className="text-[18px] font-bold text-[#1a1a1f]">Filters</h2>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="rounded-lg p-1 text-[#9a9aa5] hover:bg-[#f5f5f7]"
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
                      className="ml-2 rounded-md border border-[#e4e4ea] px-2 py-1 text-[12px]"
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

              <FilterSection label="Document Type">
                <Chip
                  label="Sale Invoice"
                  active={draftFilters.documentType === "sale"}
                  onClick={() =>
                    setDraftFilters((f) => ({
                      ...f,
                      documentType: f.documentType === "sale" ? "" : "sale",
                    }))
                  }
                />
                <Chip
                  label="Bill of Supply"
                  active={draftFilters.documentType === "bos"}
                  onClick={() =>
                    setDraftFilters((f) => ({
                      ...f,
                      documentType: f.documentType === "bos" ? "" : "bos",
                    }))
                  }
                />
              </FilterSection>

              <FilterSection label="Total Amount">
                {[
                  { id: "under2k", label: "under Γé╣2,000" },
                  { id: "2to5", label: "Γé╣2,000-Γé╣5,000" },
                  { id: "5to10", label: "Γé╣5,000-Γé╣10,000" },
                  { id: "10to20", label: "Γé╣10,000-Γé╣20,000" },
                  { id: "20plus", label: "Γé╣20,000-Above" },
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

            <div className="grid grid-cols-2 gap-3 border-t border-[#d0d0d8] px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setDraftFilters(EMPTY_FILTERS);
                  setFilters(EMPTY_FILTERS);
                }}
                className="rounded-xl bg-[#e8e8ee] py-3 text-[14px] font-semibold text-[#1a1a1f]"
              >
                Clear Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters(draftFilters);
                  setShowFilters(false);
                }}
                className="rounded-xl bg-[#0f6d84] py-3 text-[14px] font-semibold text-white hover:bg-[#0c5a6e]"
              >
                Apply Filter
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
