import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRightCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  FileText,
  Filter,
  ListFilter,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { SearchBar } from "../../components/common/SearchFilter";
import Button from "../../components/common/Button";
import RowActionMenu from "../../components/common/RowActionMenu";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { cancelInvoice, getInvoicesV2 } from "../../api/salesApi";
import { apiErrorMessage } from "../../utils/apiError";
import { formatInr } from "../../data/salesMasterData";

const YELLOW = "var(--color-primary)";
const PAGE_BG = "var(--color-bg)";
const PAGE_SIZES = [10, 20, 50];

const SORT_OPTIONS = [
  { id: "date_desc", label: "Date (Latest First)" },
  { id: "date_asc", label: "Date (Oldest First)" },
  { id: "amount_desc", label: "Amount (High to Low)" },
  { id: "amount_asc", label: "Amount (Low to High)" },
];

const EMPTY_FILTERS = { due: "", customDueDate: "", amountBand: "" };

const AMOUNT_BANDS = [
  { id: "under_2k", label: "under ₹2,000", min: 0, max: 2000 },
  { id: "2k_5k", label: "₹2,000-₹5,000", min: 2000, max: 5000 },
  { id: "5k_10k", label: "₹5,000-₹10,000", min: 5000, max: 10000 },
  { id: "10k_20k", label: "₹10,000-₹20,000", min: 10000, max: 20000 },
  { id: "20k_above", label: "₹20,000-Above", min: 20000, max: Infinity },
];

function isProforma(doc) {
  const d = String(doc || "").toLowerCase();
  return d === "proforma" || d === "export_proforma" || d.includes("proforma");
}

function inBand(amount, bandId) {
  const band = AMOUNT_BANDS.find((b) => b.id === bandId);
  if (!band) return true;
  const n = Number(amount) || 0;
  return n >= band.min && n < band.max;
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

function dueMatch(dueDate, dueFilter, customDueDate) {
  if (!dueFilter) return true;
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / 86400000);
  if (dueFilter === "overdue") return diff < 0;
  if (dueFilter === "today") return diff === 0;
  if (dueFilter === "tomorrow") return diff === 1;
  if (dueFilter === "custom" && customDueDate) {
    return String(dueDate).slice(0, 10) === String(customDueDate).slice(0, 10);
  }
  return true;
}

function fmtDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso).slice(0, 10);
  return `${d}/${m}/${y}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso).slice(0, 10);
  return `${d}/${m}/${y}`;
}

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
        active
          ? "bg-[#2d2a4a] text-white"
          : "bg-[#f0f0f3] text-[#4a4a55] hover:bg-[#e4e4ea]"
      }`}
    >
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

export default function ProformaInvoices() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const location = useLocation();
  const exportOnly = location.pathname.includes("export-proforma");
  const pageTitle = exportOnly ? "Export Proforma Invoice" : "Proforma Invoice";
  const createTo = exportOnly
    ? "/sales/proforma-invoices/create?type=export_proforma"
    : "/sales/proforma-invoices/create";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
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
      const res = await getInvoicesV2({ page: 1, page_size: 500 });
      const items = res?.data?.items || res?.data || [];
      const list = (Array.isArray(items) ? items : []).filter((i) => {
        const d = String(i.document_type || "").toLowerCase();
        if (exportOnly) return d === "export_proforma" || d.includes("export_proforma");
        return isProforma(d);
      });
      setRows(list);
    } catch {
      addToast("Failed to load proforma invoices", "error");
      setRows([]);


    } finally {
      setLoading(false);
    }
  }, [addToast, exportOnly]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Cancel proforma ${row.invoice_number}?`)) return;
    try {
      await cancelInvoice(row.id);
      addToast("Proforma cancelled", "success");
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to cancel proforma"), "error");
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, filters, sortId, pageSize, dateFrom, dateTo]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (q) {
        const hay = `${r.invoice_number || ""} ${r.customer_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const d = String(r.issue_date || "").slice(0, 10);
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      if (!dueMatch(r.due_date, filters.due, filters.customDueDate)) return false;
      const amt = Number(r.grand_total ?? r.total_amount ?? 0);
      if (filters.amountBand && !inBand(amt, filters.amountBand)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const da = String(a.issue_date || "");
      const db = String(b.issue_date || "");
      const aa = Number(a.grand_total ?? a.total_amount ?? 0);
      const ab = Number(b.grand_total ?? b.total_amount ?? 0);
      if (sortId === "date_asc") return da.localeCompare(db);
      if (sortId === "amount_desc") return ab - aa;
      if (sortId === "amount_asc") return aa - ab;
      return db.localeCompare(da);
    });
    return list;
  }, [rows, search, dateFrom, dateTo, filters, sortId]);

  const totalSales = useMemo(
    () => filteredSorted.reduce((s, r) => s + (Number(r.grand_total ?? r.total_amount) || 0), 0),
    [filteredSorted]
  );

  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filteredSorted.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" style={{ background: PAGE_BG }}>
        <Loader label="Loading proforma invoices..." />
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="space-y-4 p-4 sm:p-6">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-3 rounded-full bg-[var(--color-surface)] px-4 py-2.5 text-[13px] text-[var(--color-text-secondary)] shadow-sm shadow-[#00000010] border border-[var(--color-border-soft)]">
              <button
                type="button"
                onClick={openDateFrom}
                className="flex items-center justify-center text-[var(--color-text-muted)] hover:text-[#0f6d84] transition-colors cursor-pointer"
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
                className="text-[14px] font-medium text-[#2c2b3d] dark:text-slate-100 hover:text-[#0f6d84] transition-colors cursor-pointer"
                title="Click to select start date"
              >
                {fmtDisplayDate(dateFrom) || "Start Date"}
              </button>
              <span className="text-[var(--color-text-faint)] select-none">→</span>
              <button
                type="button"
                onClick={openDateTo}
                className="text-[14px] font-medium text-[#2c2b3d] dark:text-slate-100 hover:text-[#0f6d84] transition-colors cursor-pointer"
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
                className="flex items-center justify-center text-[var(--color-text-muted)] hover:text-[#0f6d84] transition-colors cursor-pointer"
                aria-label="Open end date picker"
              >
                <Calendar className="h-5 w-5" />
              </button>
            </div>
            <Button variant="add" to={createTo} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              {exportOnly ? "Export Proforma Invoice" : "Proforma Invoice"}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-t-2xl bg-white px-4 pb-6 pt-4 sm:px-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="Search" className="w-full" />
          <div className="relative flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftFilters(filters);
                setShowFilters(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-[#e4e4ea] bg-white px-3.5 py-2 text-[13px] font-medium text-[#4a4a55]"
            >
              <Filter className="h-4 w-4" /> Filters
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSort((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#e4e4ea] bg-white px-3.5 py-2 text-[13px] font-medium text-[#4a4a55]"
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
                  <div className="absolute right-0 z-20 mt-1.5 w-[240px] overflow-hidden rounded-xl border border-[#d0d0d8] bg-[#f9f9f9] py-1 shadow-lg">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSortId(opt.id);
                          setShowSort(false);
                        }}
                        className={`block w-full px-4 py-2.5 text-left text-[13px] hover:bg-white ${
                          sortId === opt.id ? "font-semibold" : "text-[#4a4a55]"
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

        <div className="overflow-hidden rounded-xl border border-[#d0d0d8]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-[13px]">
              <thead className="ui-table-head">
                <tr>
                  <SerialNumberHeader className="border-b border-r border-[#d0d0d8]" />
                  <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Proforma No.</th>
                  <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Date</th>
                  <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Buyer Name</th>
                  <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Due in</th>
                  <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Amount</th>
                  <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <FileText className="mx-auto h-12 w-12 text-[#c4c4cc]" />
                      <p className="mt-3 text-[14px] text-[#9a9aa5]">
                        No proforma invoices yet. Create your first one.
                      </p>
                      <Button variant="add" to={createTo} className="mt-4" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                        {exportOnly ? "Export Proforma Invoice" : "Proforma Invoice"}
                      </Button>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r, rowIndex) => (
                    <tr key={r.id} className="hover:bg-[#fafafa]">
                      <SerialNumberCell
                        rowIndex={rowIndex}
                        page={page}
                        pageSize={pageSize}
                        className="border-t border-r border-[#d0d0d8]"
                      />
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 font-semibold text-[var(--color-primary)]">
                        <Link
                          to={`/sales/proforma-invoices/${r.id}`}
                          className="hover:underline"
                        >
                          {r.invoice_number}
                        </Link>
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 text-[#4a4a55]">{fmtDate(r.issue_date)}</td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3">{r.customer_name || "—"}</td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 text-[#4a4a55]">{daysUntilDue(r.due_date)}</td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 tabular-nums font-medium">
                        {formatInr(r.grand_total ?? r.total_amount ?? 0)}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-2 last:border-r-0" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <RowActionMenu
                            rowId={r.id}
                            openMenu={openMenu}
                            setOpenMenu={setOpenMenu}
                            items={[
                              {
                                label: "Convert to Tax Invoice",
                                icon: <ArrowRightCircle className="h-4 w-4" />,
                                onClick: () => navigate(`/sales/invoices/create?proforma_id=${r.id}`),
                              },
                              {
                                label: "View / Print",
                                icon: <Eye className="h-4 w-4" />,
                                onClick: () => navigate(`/sales/proforma-invoices/${r.id}`),
                              },
                              {
                                label: "Edit",
                                icon: <Edit2 className="h-4 w-4" />,
                                onClick: () => navigate(`/sales/proforma-invoices/${r.id}/edit`),
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
      </div>

      {showFilters ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/35"
          onMouseDown={(e) => e.target === e.currentTarget && setShowFilters(false)}
        >
          <aside className="flex h-full w-full max-w-[400px] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#d0d0d8] px-5 py-4">
              <h2 className="text-[18px] font-bold">Filters</h2>
              <button type="button" onClick={() => setShowFilters(false)}>
                <X className="h-5 w-5 text-[#9a9aa5]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5">
              <FilterSection label="Due">
                {[
                  { id: "overdue", label: "Over Due" },
                  { id: "today", label: "Due Today" },
                  { id: "tomorrow", label: "Due Tomorrow" },
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
                <div className="mt-2 w-full">
                  <input
                    type="date"
                    value={draftFilters.customDueDate}
                    onChange={(e) =>
                      setDraftFilters((f) => ({
                        ...f,
                        due: "custom",
                        customDueDate: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-[#e4e4ea] px-3 py-2 text-[13px]"
                  />
                </div>
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
            <div className="grid grid-cols-2 gap-3 border-t border-[#d0d0d8] px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setDraftFilters(EMPTY_FILTERS);
                  setFilters(EMPTY_FILTERS);
                  setShowFilters(false);
                }}
                className="rounded-xl border border-[#d8d8e0] bg-[#f0f0f4] py-3 text-[14px] font-semibold"
              >
                Clear Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters(draftFilters);
                  setShowFilters(false);
                }}
                className="rounded-xl py-3 text-[14px] font-semibold text-[#1a1a1f]"
                style={{ background: "#EAE5B3" }}
              >
                Apply Filter
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
