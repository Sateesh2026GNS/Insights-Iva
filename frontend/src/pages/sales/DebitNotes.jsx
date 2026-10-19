import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, Edit2, Eye, FileText, Filter, ListFilter, Plus, Search, Trash2, X } from "lucide-react";

import Loader from "../../components/common/Loader";
import EmptyState from "../../components/common/EmptyState";
import { SearchBar } from "../../components/common/SearchFilter";
import Button from "../../components/common/Button";
import { ListPageShell } from "../../components/common/ListPageShell";
import { InlineNativeDateRange } from "../../design-system/dateControls";
import RowActionMenu from "../../components/common/RowActionMenu";
import { useToast } from "../../context/ToastContext";
import { cancelInvoice, downloadInvoicePdf, getInvoicesV2 } from "../../api/salesApi";
import { apiErrorMessage } from "../../utils/apiError";
import { formatInr } from "../../data/salesMasterData";

const YELLOW = "var(--color-primary)";
const PAGE_BG = "var(--color-bg)";
const PAGE_SIZES = [10, 25, 50];

const SORT_OPTIONS = [
  { id: "date_desc", label: "Date (Latest First)" },
  { id: "date_asc", label: "Date (Oldest First)" },
  { id: "amount_desc", label: "Amount (High to Low)" },
  { id: "amount_asc", label: "Amount (Low to High)" },
];

const EMPTY_FILTERS = {
  due: "",
  eInvoiceStatus: "",
  eWaybillStatus: "",
  amountBand: "",
};

const AMOUNT_BANDS = [
  { id: "under_2k", label: "under ₹2,000", min: 0, max: 2000 },
  { id: "2k_5k", label: "₹2,000-₹5,000", min: 2000, max: 5000 },
  { id: "5k_10k", label: "₹5,000-₹10,000", min: 5000, max: 10000 },
  { id: "10k_20k", label: "₹10,000-₹20,000", min: 10000, max: 20000 },
  { id: "20k_above", label: "₹20,000-Above", min: 20000, max: Infinity },
];

function isDebitDoc(doc) {
  const d = String(doc || "").toLowerCase();
  return d === "debit_note" || d === "sales_debit_note" || d.includes("debit");
}

function inBand(amount, bandId) {
  const band = AMOUNT_BANDS.find((b) => b.id === bandId);
  if (!band) return true;
  const n = Number(amount) || 0;
  return n >= band.min && n < band.max;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso).slice(0, 10);
  return `${d}/${m}/${y}`;
}

function paymentStatus(row) {
  const raw = String(row.payment_status || "").toLowerCase();
  if (raw === "paid" || raw === "unpaid" || raw === "partial" || raw === "partially_paid") {
    return raw === "partially_paid" ? "partial" : raw;
  }
  const paid = Number(row.amount_paid) || 0;
  const total = Number(row.grand_total ?? row.total_amount) || 0;
  if (total <= 0 || paid <= 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partial";
}

function dueDiffDays(dueDate) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

function daysUntilDue(dueDate) {
  const diff = dueDiffDays(dueDate);
  if (diff === null) return "—";
  if (diff < 0) return `Overdue ${Math.abs(diff)}d`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `${diff} days`;
}

function statusColor(status) {
  const s = String(status || "").toLowerCase();
  if (s === "paid") return "bg-emerald-50 text-emerald-700";
  if (s === "partial") return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}

function statusLabel(status) {
  if (status === "partial") return "Partially Paid";
  if (status === "paid") return "Paid";
  return "Unpaid";
}

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
        active
          ? "bg-[var(--color-primary)] text-white"
          : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      {label}
    </button>
  );
}

function FilterSection({ label, children }) {
  return (
    <div className="border-b border-[var(--color-border)] py-4 last:border-b-0">
      <p className="mb-2.5 text-[12px] font-medium text-[var(--color-text-faint)]">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SummaryTab({ label, count, amount, active, onClick, tone }) {
  const tones = {
    blue: { border: "border-blue-600", label: "text-blue-700", count: "text-blue-500", value: "text-blue-700", ring: "focus-visible:ring-blue-600", hover: "hover:text-blue-700" },
    amber: { border: "border-amber-500", label: "text-amber-700", count: "text-amber-600", value: "text-amber-800", ring: "focus-visible:ring-amber-500", hover: "hover:text-amber-700" },
    emerald: { border: "border-emerald-600", label: "text-emerald-700", count: "text-emerald-600", value: "text-emerald-800", ring: "focus-visible:ring-emerald-600", hover: "hover:text-emerald-700" },
    violet: { border: "border-violet-600", label: "text-violet-700", count: "text-violet-600", value: "text-violet-800", ring: "focus-visible:ring-violet-600", hover: "hover:text-violet-700" },
  };
  const colors = tones[tone] || tones.blue;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{ boxSizing: "border-box", width: 170, minWidth: 170, flex: "0 0 170px" }}
      className={`relative min-w-[125px] flex-none border-b-[3px] px-4 py-2.5 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-slate-300 after:content-[''] last:after:hidden sm:px-5 sm:py-2 text-left transition duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 ${colors.ring} ${
        active
          ? `${colors.border} bg-[var(--color-surface)] shadow-sm`
          : `border-transparent bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface)]/80 ${colors.hover}`
      }`}
    >
      <p className={`text-xs sm:text-[13px] ${active ? `font-semibold ${colors.label}` : "font-medium text-[var(--color-text)]"}`}>
        {label} <span className={`${active ? colors.count : "text-[var(--color-text-muted)]"} font-normal`}>({count})</span>
      </p>
      <p className={`mt-0.5 text-base sm:text-[17px] font-bold tabular-nums ${active ? colors.value : "text-[var(--color-text)]"}`}>
        {amount}
      </p>
    </button>
  );
}

export default function DebitNotes() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [pdfBusyId, setPdfBusyId] = useState(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("2026-04-01");
  const [dateTo, setDateTo] = useState("2027-03-31");
  const [kpiFilter, setKpiFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [sortId, setSortId] = useState("date_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getInvoicesV2({
        page: 1,
        page_size: 500,
        document_type: "debit_note",
      });
      const items = res?.data?.items || res?.data || [];
      const list = (Array.isArray(items) ? items : []).filter((i) =>
        isDebitDoc(i.document_type)
      );
      setRows(list);
    } catch {
      addToast("Failed to load sales debit notes", "error");
      setRows([]);


    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, filters, sortId, pageSize, dateFrom, dateTo, kpiFilter]);

  const handleDownloadPdf = useCallback(
    async (row) => {
      if (!row?.id) return;
      setPdfBusyId(row.id);
      try {
        const res = await downloadInvoicePdf(row.id);
        const blob = new Blob([res.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `DebitNote-${row.invoice_number || row.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        addToast("PDF downloaded.", "success");
      } catch (err) {
        addToast(apiErrorMessage(err, "Could not download PDF."), "error");
      } finally {
        setPdfBusyId(null);
      }
    },
    [addToast]
  );

  const handleDelete = useCallback(
    async (row) => {
      if (!window.confirm(`Delete debit note ${row.invoice_number}?`)) return;
      try {
        await cancelInvoice(row.id);
        addToast("Debit note deleted", "success");
        load();
      } catch (err) {
        addToast(apiErrorMessage(err, "Failed to delete"), "error");
      }
    },
    [addToast, load]
  );

  const tabStats = useMemo(() => {
    const sum = (arr) =>
      arr.reduce((s, r) => s + (Number(r.grand_total ?? r.total_amount) || 0), 0);
    const unpaid = rows.filter((r) => paymentStatus(r) === "unpaid");
    const partial = rows.filter((r) => paymentStatus(r) === "partial");
    const paid = rows.filter((r) => paymentStatus(r) === "paid");
    return {
      all: { count: rows.length, amount: sum(rows) },
      unpaid: { count: unpaid.length, amount: sum(unpaid) },
      paid: { count: paid.length, amount: sum(paid) },
      partial: { count: partial.length, amount: sum(partial) },
    };
  }, [rows]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      const pay = paymentStatus(r);
      if (kpiFilter === "unpaid" && pay !== "unpaid") return false;
      if (kpiFilter === "paid" && pay !== "paid") return false;
      if (kpiFilter === "partial" && pay !== "partial") return false;

      const issue = String(r.issue_date || "").slice(0, 10);
      if (dateFrom && issue && issue < dateFrom) return false;
      if (dateTo && issue && issue > dateTo) return false;

      if (q) {
        const hay = `${r.invoice_number || ""} ${r.customer_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (filters.due) {
        const diff = dueDiffDays(r.due_date);
        if (diff === null) return false;
        if (filters.due === "overdue" && !(diff < 0)) return false;
        if (filters.due === "tomorrow" && diff !== 1) return false;
        if (filters.due === "today" && diff !== 0) return false;
      }
      if (filters.eInvoiceStatus) {
        const st = String(r.e_invoice_status || "all").toLowerCase();
        if (filters.eInvoiceStatus === "all") {
          /* keep */
        } else if (st !== filters.eInvoiceStatus) {
          return false;
        }
      }
      if (filters.eWaybillStatus && filters.eWaybillStatus !== "all") {
        const st = String(r.e_waybill_status || "all").toLowerCase();
        if (st !== filters.eWaybillStatus) return false;
      }
      if (filters.amountBand && !inBand(r.grand_total ?? r.total_amount, filters.amountBand)) {
        return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      const da = String(a.issue_date || "");
      const db = String(b.issue_date || "");
      const aa = Number(a.grand_total ?? a.total_amount) || 0;
      const ab = Number(b.grand_total ?? b.total_amount) || 0;
      if (sortId === "date_asc") return da.localeCompare(db);
      if (sortId === "amount_desc") return ab - aa;
      if (sortId === "amount_asc") return aa - ab;
      return db.localeCompare(da);
    });
    return list;
  }, [rows, search, dateFrom, dateTo, kpiFilter, filters, sortId]);

  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filteredSorted.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" style={{ background: PAGE_BG }}>
        <Loader label="Loading sales debit notes..." />
      </div>
    );
  }

  return (
    <ListPageShell stackClassName="!gap-0 space-y-0">
      <div className="flex flex-col gap-3">
        <div className="sm:ml-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <InlineNativeDateRange
            from={dateFrom}
            to={dateTo}
            fromId="sales-debit-note-from-date"
            toId="sales-debit-note-to-date"
            onFromChange={(value) => { setDateFrom(value); setPage(1); }}
            onToChange={(value) => { setDateTo(value); setPage(1); }}
          />
          <Button variant="add" to="/sales/debit-notes/create" className="h-[42px] justify-center sm:w-auto" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
            Sales Debit Note
          </Button>
        </div>

        <div className="w-fit max-w-full overflow-hidden rounded-xl border border-[var(--color-table-border)] bg-[var(--color-surface-muted)]">
          <div className="flex overflow-x-auto scrollbar-none" role="tablist" aria-label="Sales debit note payment status">
          <SummaryTab
            label="Total Sales"
            count={tabStats.all.count}
            amount={formatInr(tabStats.all.amount)}
            tone="blue"
            active={kpiFilter === "all"}
            onClick={() => setKpiFilter("all")}
          />
          <SummaryTab
            label="Unpaid"
            count={tabStats.unpaid.count}
            amount={formatInr(tabStats.unpaid.amount)}
            tone="amber"
            active={kpiFilter === "unpaid"}
            onClick={() => setKpiFilter("unpaid")}
          />
          <SummaryTab
            label="Paid"
            count={tabStats.paid.count}
            amount={formatInr(tabStats.paid.amount)}
            tone="emerald"
            active={kpiFilter === "paid"}
            onClick={() => setKpiFilter("paid")}
          />
          <SummaryTab
            label="Partially Paid"
            count={tabStats.partial.count}
            amount={formatInr(tabStats.partial.amount)}
            tone="violet"
            active={kpiFilter === "partial"}
            onClick={() => setKpiFilter("partial")}
          />
          </div>
        </div>
      </div>

      <section className="ui-list-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="Search" />
          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setDraftFilters(filters);
                setShowFilters(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-text-secondary)]"
            >
              <Filter className="h-4 w-4" /> Filters
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSort((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-text-secondary)]"
              >
                <ListFilter className="h-4 w-4" /> Sort by
              </button>
              {showSort ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Close sort"
                    onClick={() => setShowSort(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1.5 w-[260px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSortId(opt.id);
                          setShowSort(false);
                        }}
                        className={`block w-full border-b border-[#f0f0f3] px-4 py-2.5 text-left text-[13px] last:border-b-0 hover:bg-[var(--color-surface-hover)] ${
                          sortId === opt.id ? "font-semibold" : "text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="ui-table-wrap ui-table-wrap--scroll">
            <table className="ui-table min-w-full border-collapse text-left text-[13px]">
              <thead className="ui-table-head">
                <tr>
                  {["SDN No.", "Date", "Buyer Name", "Due In", "Amount", "Status", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="border-b border-r border-[var(--color-border)] px-4 py-3 last:border-r-0"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border-none p-0">
                      <EmptyState
                        icon="document"
                        title="No records found."
                        description="There is nothing to show here yet."
                        className="border-none bg-transparent py-12"
                      />
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => {
                    const pay = paymentStatus(r);
                    const totalAmt = Number(r.grand_total ?? r.total_amount) || 0;
                    return (
                      <tr key={r.id} className="hover:bg-[var(--color-table-row-hover)]">
                        <td className="border-t border-r border-[var(--color-border)] px-4 py-3 font-semibold text-[var(--color-primary)]">
                          {r.invoice_number}
                        </td>
                        <td className="border-t border-r border-[var(--color-border)] px-4 py-3 text-[var(--color-text-secondary)]">
                          {fmtDate(r.issue_date)}
                        </td>
                        <td className="border-t border-r border-[var(--color-border)] px-4 py-3">
                          {r.customer_name || "—"}
                        </td>
                        <td className="border-t border-r border-[var(--color-border)] px-4 py-3 text-[var(--color-text-secondary)]">
                          {daysUntilDue(r.due_date)}
                        </td>
                        <td className="border-t border-r border-[var(--color-border)] px-4 py-3 tabular-nums font-medium">
                          {formatInr(totalAmt)}
                        </td>
                        <td className="border-t border-r border-[var(--color-border)] px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${statusColor(pay)}`}
                          >
                            {statusLabel(pay)}
                          </span>
                        </td>
                        <td className="border-t border-[var(--color-border)] px-4 py-3">
                          <RowActionMenu
                            rowId={r.id}
                            openMenu={openMenu}
                            setOpenMenu={setOpenMenu}
                            items={[
                              {
                                label: "View",
                                icon: <Eye className="h-4 w-4" />,
                                onClick: () => navigate(`/sales/debit-notes/${r.id}`),
                              },
                              {
                                label: "Edit",
                                icon: <Edit2 className="h-4 w-4" />,
                                onClick: () => navigate(`/sales/debit-notes/${r.id}/edit`),
                              },
                              {
                                label: pdfBusyId === r.id ? "Downloading…" : "Download PDF",
                                icon: <Download className="h-4 w-4" />,
                                onClick: () => handleDownloadPdf(r),
                              },
                              {
                                label: "Delete",
                                icon: <Trash2 className="h-4 w-4" />,
                                danger: true,
                                onClick: () => handleDelete(r),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
        </div>

        <div className="mt-4 ui-pagination justify-between border-t border-[var(--color-border-soft)] pt-4">
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
      </section>

      {showFilters ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/35"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setShowFilters(false)}
        >
          <aside className="flex h-full w-full max-w-[400px] flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
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
                {[
                  { id: "overdue", label: "Over Due" },
                  { id: "tomorrow", label: "Due Tommorow" },
                  { id: "today", label: "Due Today" },
                ].map((opt) => (
                  <Chip
                    key={opt.id}
                    label={opt.label}
                    active={draftFilters.due === opt.id}
                    onClick={() =>
                      setDraftFilters((f) => ({
                        ...f,
                        due: f.due === opt.id ? "" : opt.id,
                      }))
                    }
                  />
                ))}
              </FilterSection>
              <FilterSection label="E-Invoice Status">
                {[
                  { id: "all", label: "All" },
                  { id: "active", label: "Active" },
                  { id: "cancelled", label: "Cancelled" },
                ].map((opt) => (
                  <Chip
                    key={opt.id}
                    label={opt.label}
                    active={draftFilters.eInvoiceStatus === opt.id}
                    onClick={() =>
                      setDraftFilters((f) => ({
                        ...f,
                        eInvoiceStatus: f.eInvoiceStatus === opt.id ? "" : opt.id,
                      }))
                    }
                  />
                ))}
              </FilterSection>
              <FilterSection label="E-Waybill Status">
                {[
                  { id: "all", label: "All" },
                  { id: "active", label: "Active" },
                  { id: "expired", label: "Expired" },
                  { id: "cancelled", label: "Cancelled" },
                ].map((opt) => (
                  <Chip
                    key={opt.id}
                    label={opt.label}
                    active={draftFilters.eWaybillStatus === opt.id}
                    onClick={() =>
                      setDraftFilters((f) => ({
                        ...f,
                        eWaybillStatus: f.eWaybillStatus === opt.id ? "" : opt.id,
                      }))
                    }
                  />
                ))}
              </FilterSection>
              <FilterSection label="Total Amount">
                {AMOUNT_BANDS.map((b) => (
                  <Chip
                    key={b.id}
                    label={b.label}
                    active={draftFilters.amountBand === b.id}
                    onClick={() =>
                      setDraftFilters((f) => ({
                        ...f,
                        amountBand: f.amountBand === b.id ? "" : b.id,
                      }))
                    }
                  />
                ))}
              </FilterSection>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-border)] px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setDraftFilters(EMPTY_FILTERS);
                  setFilters(EMPTY_FILTERS);
                  setShowFilters(false);
                }}
                className="rounded-xl border border-[var(--color-border-soft)] bg-[#f0f0f4] py-3 text-[14px] font-semibold"
              >
                Clear Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters(draftFilters);
                  setShowFilters(false);
                }}
                className="rounded-xl py-3 text-[14px] font-semibold text-white"
                style={{ background: "#036f71" }}
              >
                Apply Filter
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </ListPageShell>
  );
}
