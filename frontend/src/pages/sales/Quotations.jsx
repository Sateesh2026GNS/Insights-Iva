import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  Eye,
  FileText,
  Filter,
  ListFilter,
  Pencil,
  Plus,
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
import QuoteDetailModal from "../../components/sales/QuoteDetailModal";
import { useToast } from "../../context/ToastContext";
import {
  getQuotationSummary,
  getQuotationsEnriched,
  deleteQuotation,
  updateQuotationStatus,
} from "../../api/salesApi";
import { apiErrorMessage } from "../../utils/apiError";
import { formatInr, statusColor } from "../../data/salesMasterData";
import { runListExport } from "../../utils/listExport";

const QUOTATION_EXPORT_COLUMNS = [
  { key: "quote_number", label: "Quotation No." },
  { key: "quote_date", label: "Date" },
  { key: "customer_name", label: "Party Name" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
];
const PAGE_SIZES = [10, 20, 50];

const SORT_OPTIONS = [
  { id: "date_desc", label: "Quotation date (Latest First)" },
  { id: "date_asc", label: "Quotation date (Oldest First)" },
  { id: "amount_desc", label: "Quotation Amount (High to Low)" },
  { id: "amount_asc", label: "Quotation Amount (Low to High)" },
];

const EMPTY_FILTERS = {
  quotationType: "",
  amountBand: "",
};

const AMOUNT_BANDS = [
  { id: "under_2k", label: "under ₹2,000", min: 0, max: 2000 },
  { id: "2k_5k", label: "₹2,000-₹5,000", min: 2000, max: 5000 },
  { id: "5k_10k", label: "₹5,000-₹10,000", min: 5000, max: 10000 },
  { id: "10k_20k", label: "₹10,000-₹20,000", min: 10000, max: 20000 },
  { id: "20k_above", label: "₹20,000-Above", min: 20000, max: Infinity },
];

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
    <div className="border-b border-[var(--color-table-border)] py-4 last:border-b-0">
      <p className="mb-2.5 text-[12px] font-medium text-[var(--color-text-faint)]">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SummaryTab({ label, count, amount, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 flex-1 border-b-[3px] px-5 py-3.5 text-left transition duration-150 cursor-pointer ${
        active
          ? "border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-primary)]"
          : "border-transparent bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]/80 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
      }`}
    >
      <p className={`text-[13px] font-medium transition-colors ${active ? "" : "text-[var(--color-text-muted)]"}`}>
        {label}{" "}
        <span className={active ? "opacity-70" : "text-[var(--color-text-faint)]"}>({count})</span>
      </p>
      <p
        className={`mt-1 text-[18px] font-bold tabular-nums transition-colors ${
          active ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"
        }`}
      >
        {amount}
      </p>
    </button>
  );
}

function inAmountBand(amount, bandId) {
  const band = AMOUNT_BANDS.find((b) => b.id === bandId);
  if (!band) return true;
  const n = Number(amount) || 0;
  return n >= band.min && n < band.max;
}

function statusBucket(status) {
  const s = String(status || "").toLowerCase();
  if (["accepted", "approved"].includes(s)) return "accepted";
  if (["rejected", "cancelled", "canceled", "expired"].includes(s)) return "cancelled";
  return "pending";
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso).slice(0, 10);
  return `${d}/${m}/${y}`;
}

function fmtDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso).slice(0, 10);
  return `${d}/${m}/${y}`;
}

export default function Quotations() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [selected, setSelected] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [kpiFilter, setKpiFilter] = useState("all");
  const [search, setSearch] = useState("");
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

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.allSettled([
        getQuotationSummary(),
        getQuotationsEnriched(),
      ]);


      if (sumRes.status === "fulfilled" && sumRes.value?.data) setSummary(sumRes.value.data);
      else setSummary({});
      if (listRes.status === "fulfilled") setRows(listRes.value?.data || []);
      else setRows([]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [kpiFilter, search, filters, sortId, pageSize, dateFrom, dateTo]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (q) {
        const hay = `${r.quote_number || ""} ${r.customer_name || ""} ${r.sales_person || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const d = String(r.quote_date || r.valid_until || "").slice(0, 10);
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      const bucket = statusBucket(r.status);
      if (kpiFilter === "pending" && bucket !== "pending") return false;
      if (kpiFilter === "accepted" && bucket !== "accepted") return false;
      if (kpiFilter === "cancelled" && bucket !== "cancelled") return false;
      if (filters.quotationType === "converted" && !r.converted_to_invoice) return false;
      if (filters.quotationType === "not_converted" && r.converted_to_invoice) return false;
      if (filters.amountBand && !inAmountBand(r.amount, filters.amountBand)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      const da = String(a.quote_date || a.valid_until || "");
      const db = String(b.quote_date || b.valid_until || "");
      const aa = Number(a.amount) || 0;
      const ab = Number(b.amount) || 0;
      if (sortId === "date_asc") return da.localeCompare(db);
      if (sortId === "amount_desc") return ab - aa;
      if (sortId === "amount_asc") return aa - ab;
      return db.localeCompare(da);
    });
    return list;
  }, [rows, search, dateFrom, dateTo, kpiFilter, filters, sortId]);

  const tabStats = useMemo(() => {
    const base = rows;
    const sumAmt = (arr) => arr.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const pending = base.filter((r) => statusBucket(r.status) === "pending");
    const accepted = base.filter((r) => statusBucket(r.status) === "accepted");
    const cancelled = base.filter((r) => statusBucket(r.status) === "cancelled");
    return {
      all: { count: base.length, amount: sumAmt(base) },
      pending: { count: pending.length, amount: sumAmt(pending) },
      accepted: { count: accepted.length, amount: sumAmt(accepted) },
      cancelled: { count: cancelled.length, amount: sumAmt(cancelled) },
    };
  }, [rows]);

  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filteredSorted.slice((page - 1) * pageSize, page * pageSize);

  const handleStatus = async (quote, status) => {
    if (typeof quote.id === "number") {
      try {
        await updateQuotationStatus(quote.id, status);
        addToast(`Quotation marked as ${status}`);
        load();
      } catch (err) {
        addToast(err.response?.data?.detail || "Update failed", "error");
        return;
      }
    }
    setSelected(null);
  };

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Cancel quotation ${row.quote_number}?`)) return;
    try {
      await deleteQuotation(row.id);
      addToast("Quotation cancelled", "success");
      setSelected(null);
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to cancel quotation"), "error");
    }
  };

  const handleExport = (format) => {
    const exportRows = filteredSorted.map((r) => ({
      quote_number: r.quote_number,
      quote_date: fmtDate(r.quote_date || r.valid_until),
      customer_name: r.customer_name,
      amount: r.amount,
      status: r.status,
    }));
    runListExport(format, {
      data: exportRows,
      columns: QUOTATION_EXPORT_COLUMNS,
      filename: "quotations",
      title: "Quotations",
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  if (loading) {
    return (
      <ListPageShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader label="Loading quotations..." />
        </div>
      </ListPageShell>
    );
  }

  return (
    <ListPageShell stackClassName="space-y-4">
      <PageHeader
        title="Quotations"
        subtitle="Create, track, and convert quotations into sales orders."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportDownloadMenu disabled={!filteredSorted.length} onExport={handleExport} />
            <Button variant="add" to="/sales/quotations/create" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              Create Quotation
            </Button>
          </div>
        }
      />

      <div className="overflow-hidden rounded-xl border border-[var(--color-table-border)] bg-[var(--color-surface-muted)]">
        <div className="flex overflow-x-auto">
          <SummaryTab
            label="All Quotations"
            count={tabStats.all.count}
            amount={formatInr(tabStats.all.amount)}
            active={kpiFilter === "all"}
            onClick={() => setKpiFilter("all")}
          />
          <SummaryTab
            label="Pending"
            count={tabStats.pending.count}
            amount={formatInr(tabStats.pending.amount)}
            active={kpiFilter === "pending"}
            onClick={() => setKpiFilter("pending")}
          />
          <SummaryTab
            label="Accepted"
            count={tabStats.accepted.count}
            amount={formatInr(tabStats.accepted.amount)}
            active={kpiFilter === "accepted"}
            onClick={() => setKpiFilter("accepted")}
          />
          <SummaryTab
            label="Cancelled"
            count={tabStats.cancelled.count}
            amount={formatInr(tabStats.cancelled.amount)}
            active={kpiFilter === "cancelled"}
            onClick={() => setKpiFilter("cancelled")}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar value={search} onChange={setSearch} placeholder="Search" className="w-full" />
        <div className="relative flex gap-2">
          <button
            type="button"
            onClick={() => {
              setDraftFilters(filters);
              setShowFilters(true);
            }}
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
            {showSort ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="Close sort"
                  onClick={() => setShowSort(false)}
                />
                <div className="absolute right-0 z-20 mt-1.5 w-[280px] overflow-hidden rounded-xl border border-[var(--color-table-border)] bg-[var(--color-surface)] py-1 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSortId(opt.id);
                        setShowSort(false);
                      }}
                      className={`block w-full px-4 py-2.5 text-left text-[13px] hover:bg-[var(--color-surface-hover)] ${
                        sortId === opt.id ? "font-semibold text-[var(--color-text)]" : "text-[var(--color-text-secondary)]"
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

      <div className="overflow-hidden rounded-xl border border-[var(--color-table-border)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-[13px]">
              <thead className="ui-table-head">
              <tr>
                <SerialNumberHeader className="border-b border-r border-[var(--color-table-border)]" />
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Quotation No.</th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Date</th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Party Name</th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Amount</th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Status</th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <FileText className="mx-auto h-12 w-12 text-[var(--color-text-icon)]" />
                    <p className="mt-3 text-[14px] text-[var(--color-text-muted)]">
                      No Quotations available, Create new quotation
                    </p>
                    <Button variant="add" to="/sales/quotations/create" className="mt-4" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                      Create Quotation
                    </Button>
                  </td>
                </tr>
              ) : (
                pageRows.map((r, rowIndex) => (
                  <tr key={r.id} className="hover:bg-[var(--color-table-row-hover)]">
                    <SerialNumberCell
                      rowIndex={rowIndex}
                      page={page}
                      pageSize={pageSize}
                      className="border-t border-r border-[var(--color-table-border)]"
                    />
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 font-semibold text-[var(--color-primary)]">
                      {r.quote_number}
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[var(--color-text-secondary)]">{fmtDate(r.quote_date)}</td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[var(--color-text)]">{r.customer_name || "—"}</td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 tabular-nums font-medium text-[var(--color-text)]">
                      {formatInr(r.amount)}
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(r.status)}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="border-t border-[var(--color-table-border)] px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end">
                        <RowActionMenu
                          rowId={r.id}
                          openMenu={openMenu}
                          setOpenMenu={setOpenMenu}
                          items={[
                            {
                              label: "View / Print",
                              icon: <Eye className="h-4 w-4" />,
                              onClick: () => navigate(`/sales/quotations/${r.id}`),
                            },
                            {
                              label: "Edit",
                              icon: <Edit2 className="h-4 w-4" />,
                              onClick: () => navigate(`/sales/quotations/${r.id}/edit`),
                            },
                            { divider: true },
                            {
                              label: "Delete",
                              icon: <Trash2 className="h-4 w-4" />,
                              danger: true,
                              onClick: () => handleDelete(r),
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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

      {showFilters ? (
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
              <FilterSection label="Quotation Type">
                <Chip
                  label="Converted to Invoice"
                  active={draftFilters.quotationType === "converted"}
                  onClick={() =>
                    setDraftFilters((f) => ({
                      ...f,
                      quotationType: f.quotationType === "converted" ? "" : "converted",
                    }))
                  }
                />
                <Chip
                  label="Not Converted"
                  active={draftFilters.quotationType === "not_converted"}
                  onClick={() =>
                    setDraftFilters((f) => ({
                      ...f,
                      quotationType: f.quotationType === "not_converted" ? "" : "not_converted",
                    }))
                  }
                />
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
            <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-table-border)] px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setDraftFilters(EMPTY_FILTERS);
                  setFilters(EMPTY_FILTERS);
                  setShowFilters(false);
                }}
                className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] py-3 text-[14px] font-semibold text-[var(--color-text)]"
              >
                Clear Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters(draftFilters);
                  setShowFilters(false);
                }}
                className="rounded-xl bg-[var(--color-primary)] py-3 text-[14px] font-semibold text-white"
              >
                Apply Filter
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {selected ? (
        <QuoteDetailModal
          quote={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatus}
        />
      ) : null}
    </ListPageShell>
  );
}
