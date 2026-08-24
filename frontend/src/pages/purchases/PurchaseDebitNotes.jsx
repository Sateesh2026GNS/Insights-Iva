import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Download, Edit2, Eye, FileText, Filter, ListFilter, Plus, Search, Trash2, X } from "lucide-react";

import Loader from "../../components/common/Loader";
import RowActionMenu from "../../components/common/RowActionMenu";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { deleteBizDocument, downloadPurchasePdf, listBizDocuments } from "../../api/bizDocumentsApi";
import { apiErrorMessage } from "../../utils/apiError";
import { formatInr } from "../../data/salesMasterData";

const ACCENT = "var(--color-action-teal)"; /* #0F6D84 */
const PAGE_BG = "var(--color-bg)";
const PAGE_SIZES = [10, 20, 50];

const SORT_OPTIONS = [
  { id: "date_desc", label: "Debit Note Date (Latest First)" },
  { id: "date_asc", label: "Debit Note Date (Oldest First)" },
  { id: "amount_desc", label: "Amount (High to Low)" },
  { id: "amount_asc", label: "Amount (Low to High)" },
];

const EMPTY_FILTERS = {
  settlement: "",
  eWaybillStatus: "",
  noteType: "all",
  amountBand: "",
};

const AMOUNT_BANDS = [
  { id: "under_2k", label: "under ₹2,000", min: 0, max: 2000 },
  { id: "2k_5k", label: "₹2,000-₹5,000", min: 2000, max: 5000 },
  { id: "5k_10k", label: "₹5,000-₹10,000", min: 5000, max: 10000 },
  { id: "10k_20k", label: "₹10,000-₹20,000", min: 10000, max: 20000 },
  { id: "20k_above", label: "₹20,000-Above", min: 20000, max: Infinity },
];

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

function displayDate(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}-${month}-${year}`;
}

function settlementStatus(row) {
  const meta = row.meta || {};
  const raw = String(meta.settlement_status || row.status || "").toLowerCase();
  if (raw === "settled" || raw === "partial" || raw === "partially_settled" || raw === "unsettled") {
    return raw === "partially_settled" ? "partial" : raw === "partial" ? "partial" : raw;
  }
  const paid = Number(meta.amount_settled || meta.amount_paid) || 0;
  const total = Number(row.amount) || 0;
  if (total <= 0 || paid <= 0) return "unsettled";
  if (paid >= total) return "settled";
  return "partial";
}

function noteTypeOf(row) {
  const meta = row.meta || {};
  const t = String(meta.note_type || meta.purchase_type || row.doc_type || "").toLowerCase();
  if (t.includes("return") || t === "purchase_return") return "purchase_return";
  return "debit_note";
}

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
        active
          ? "border border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
          : "bg-[#f0f0f3] text-[#4a4a55] hover:bg-[#e4e4ea]"
      }`}
    >
      {label}
    </button>
  );
}

function FilterSection({ label, children }) {
  return (
    <div className="border-b border-[#e4e4ea] py-4 last:border-b-0">
      <p className="mb-2.5 text-[12px] font-medium text-[#9a9aa5]">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SummaryTab({ label, count, amount, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 flex-1 border-b-[3px] px-5 py-3.5 text-left transition ${
        active
          ? "border-[var(--color-primary)] bg-white text-[var(--color-primary)]"
          : "border-transparent bg-transparent text-[#6b6b76] hover:bg-white/70"
      }`}
    >
      <p className={`text-[13px] font-medium ${active ? "text-[var(--color-primary)]" : "text-[#6b6b76]"}`}>
        {label}{" "}
        <span className={active ? "opacity-70" : "text-[#a0a0ab]"}>({count})</span>
      </p>
      <p className={`mt-1 text-[18px] font-bold tabular-nums ${active ? "text-[var(--color-primary)]" : "text-[#1a1a1f]"}`}>
        {amount}
      </p>
    </button>
  );
}

export default function PurchaseDebitNotes() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [pdfBusyId, setPdfBusyId] = useState(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("2026-04-01");
  const [dateTo, setDateTo] = useState("2027-03-31");
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const [kpiFilter, setKpiFilter] = useState("all");
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
      const res = await listBizDocuments({
        module: "purchases",
        doc_type: "purchase_debit_note",
        page: 1,
        page_size: 100,
      });
      const items = res?.data?.items || res?.data || [];
      setRows(Array.isArray(items) ? items : []);


    } catch {
      addToast("Failed to load debit notes", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete debit note ${row.document_number}?`)) return;
    try {
      await deleteBizDocument(row.id);
      addToast("Debit note deleted", "success");
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete debit note"), "error");
    }
  };

  const handleDownloadPdf = useCallback(
    async (row) => {
      if (!row?.id) return;
      setPdfBusyId(row.id);
      try {
        const res = await downloadPurchasePdf(row.id);
        const blob = new Blob([res.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `DebitNote-${row.document_number || row.id}.pdf`;
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

  useEffect(() => {
    setPage(1);
  }, [search, filters, sortId, pageSize, dateFrom, dateTo, kpiFilter]);

  const tabStats = useMemo(() => {
    const sum = (arr) => arr.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const unsettled = rows.filter((r) => settlementStatus(r) === "unsettled");
    const partial = rows.filter((r) => settlementStatus(r) === "partial");
    const settled = rows.filter((r) => settlementStatus(r) === "settled");
    return {
      all: { count: rows.length, amount: sum(rows) },
      unsettled: { count: unsettled.length, amount: sum(unsettled) },
      partial: { count: partial.length, amount: sum(partial) },
      settled: { count: settled.length, amount: sum(settled) },
    };
  }, [rows]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      const settle = settlementStatus(r);
      if (kpiFilter === "unsettled" && settle !== "unsettled") return false;
      if (kpiFilter === "partial" && settle !== "partial") return false;
      if (kpiFilter === "settled" && settle !== "settled") return false;

      const issue = String(r.document_date || "").slice(0, 10);
      if (dateFrom && issue && issue < dateFrom) return false;
      if (dateTo && issue && issue > dateTo) return false;

      if (q) {
        const hay = `${r.document_number || ""} ${r.party_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (filters.settlement && settle !== filters.settlement) return false;
      if (filters.eWaybillStatus && filters.eWaybillStatus !== "all") {
        const st = String((r.meta || {}).e_waybill_status || "all").toLowerCase();
        if (st !== filters.eWaybillStatus) return false;
      }
      if (filters.noteType && filters.noteType !== "all") {
        if (noteTypeOf(r) !== filters.noteType) return false;
      }
      if (filters.amountBand && !inBand(r.amount, filters.amountBand)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      const da = String(a.document_date || "");
      const db = String(b.document_date || "");
      const aa = Number(a.amount) || 0;
      const ab = Number(b.amount) || 0;
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
        <Loader label="Loading debit notes..." />
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-4 bg-[#F5F5F5] p-4 sm:p-6">
      <div className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-[var(--color-primary-soft)]">
        <div className="flex flex-wrap">
          <SummaryTab
            label="All Debit Notes"
            count={tabStats.all.count}
            amount={formatInr(tabStats.all.amount)}
            active={kpiFilter === "all"}
            onClick={() => setKpiFilter("all")}
          />
          <SummaryTab
            label="Unsettled"
            count={tabStats.unsettled.count}
            amount={formatInr(tabStats.unsettled.amount)}
            active={kpiFilter === "unsettled"}
            onClick={() => setKpiFilter("unsettled")}
          />
          <SummaryTab
            label="Partially Settled"
            count={tabStats.partial.count}
            amount={formatInr(tabStats.partial.amount)}
            active={kpiFilter === "partial"}
            onClick={() => setKpiFilter("partial")}
          />
          <SummaryTab
            label="Settled"
            count={tabStats.settled.count}
            amount={formatInr(tabStats.settled.amount)}
            active={kpiFilter === "settled"}
            onClick={() => setKpiFilter("settled")}
          />
        </div>
      </div>

      <div className="rounded-t-2xl border border-[#e4e4ea] border-b-0 bg-white px-4 pb-6 pt-4 sm:px-6">
        <div className="mb-3 flex flex-col gap-3 border-b border-[#e4e4ea] pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative ui-search-wrap w-full">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9aa5]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded-full border border-[#e4e4ea] bg-white py-2.5 pl-10 pr-4 text-[14px] text-[#1a1a1f] shadow-sm placeholder:text-[#9a9aa5] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#e4e4ea] bg-white px-3 py-2 text-[13px] text-[#4a4a55]">
              <button
                type="button"
                onClick={() => dateFromRef.current?.showPicker?.() || dateFromRef.current?.click()}
                className="flex items-center justify-center text-[#697b78] hover:text-[#1f3935] transition-colors"
                aria-label="Open start date picker"
              >
                <CalendarDays className="h-4 w-4" />
              </button>
              <input
                ref={dateFromRef}
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => dateFromRef.current?.showPicker?.() || dateFromRef.current?.click()}
                className="font-medium text-[#1f3935] hover:text-black transition-colors cursor-pointer"
                title="Change start date"
              >
                {displayDate(dateFrom)}
              </button>
              <span className="text-[#697b78] select-none font-medium px-0.5">→</span>
              <button
                type="button"
                onClick={() => dateToRef.current?.showPicker?.() || dateToRef.current?.click()}
                className="font-medium text-[#1f3935] hover:text-black transition-colors cursor-pointer"
                title="Change end date"
              >
                {displayDate(dateTo)}
              </button>
              <input
                ref={dateToRef}
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => dateToRef.current?.showPicker?.() || dateToRef.current?.click()}
                className="flex items-center justify-center text-[#697b78] hover:text-[#1f3935] transition-colors"
                aria-label="Open end date picker"
              >
                <CalendarDays className="h-4 w-4" />
              </button>
            </div>
            <Link
              to="/purchases/debit-notes/create"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm"
              style={{ background: ACCENT }}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> Create Debit Note
            </Link>
            <button
              type="button"
              onClick={() => {
                setDraftFilters(filters);
                setShowFilters(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-[#e4e4ea] bg-[#f5f5f5] px-3.5 py-2 text-[13px] font-medium text-[#4a4a55]"
            >
              <Filter className="h-4 w-4" /> Filters
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSort((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#e4e4ea] bg-[#f5f5f5] px-3.5 py-2 text-[13px] font-medium text-[#4a4a55]"
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
                  <div className="absolute right-0 z-20 mt-1.5 w-[280px] overflow-hidden rounded-xl border border-[#e4e4ea] bg-white py-1 shadow-lg">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSortId(opt.id);
                          setShowSort(false);
                        }}
                        className={`block w-full border-b border-[#f0f0f3] px-4 py-2.5 text-left text-[13px] last:border-b-0 hover:bg-[#F5F5F5] ${
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

        <div className="overflow-hidden rounded-xl border border-[#e4e4ea]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-[13px]">
              <thead className="bg-[var(--color-primary-soft)] text-[12px] font-semibold uppercase tracking-wide text-[#6b6b76]">
                <tr>
                  <SerialNumberHeader className="border-b border-r border-[#d0d0d8]" />
                  {[
                    "Debit Note No.",
                    "Date",
                    "Party Name",
                    "Total Amount",
                    "Available Amount",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="border-t border-[#e4e4ea] px-4 py-16 text-center">
                      <FileText className="mx-auto h-12 w-12 text-[#c4c4cc]" />
                      <p className="mt-3 text-[14px] text-[#9a9aa5]">
                        No Debit Notes yet. Create your first debit note.
                      </p>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r, rowIndex) => {
                    const settle = settlementStatus(r);
                    const totalAmt = Number(r.amount) || 0;
                    const settledAmt = Number((r.meta || {}).amount_settled || (r.meta || {}).amount_paid) || 0;
                    const available = Math.max(0, totalAmt - settledAmt);
                    return (
                      <tr key={r.id} className="hover:bg-[#fafafa]">
                        <SerialNumberCell
                          rowIndex={rowIndex}
                          page={page}
                          pageSize={pageSize}
                          className="border-t border-r border-[#d0d0d8]"
                        />
                        <td className="border-t border-r border-[#d0d0d8] px-4 py-3 font-semibold text-[var(--color-primary)]">
                          {r.document_number}
                        </td>
                        <td className="border-t border-r border-[#d0d0d8] px-4 py-3 text-[#4a4a55]">
                          {fmtDate(r.document_date)}
                        </td>
                        <td className="border-t border-r border-[#d0d0d8] px-4 py-3">
                          {r.party_name || "—"}
                        </td>
                        <td className="border-t border-r border-[#d0d0d8] px-4 py-3 tabular-nums font-medium">
                          {formatInr(totalAmt)}
                        </td>
                        <td className="border-t border-r border-[#d0d0d8] px-4 py-3 tabular-nums">
                          {formatInr(available)}
                        </td>
                        <td className="border-t border-r border-[#d0d0d8] px-4 py-3 capitalize text-[#4a4a55]">
                          {settle === "partial" ? "Partially Settled" : settle}
                        </td>
                        <td className="border-t border-[#d0d0d8] px-4 py-3">
                          <RowActionMenu
                            rowId={r.id}
                            openMenu={openMenu}
                            setOpenMenu={setOpenMenu}
                            items={[
                              {
                                label: "View",
                                icon: <Eye className="h-4 w-4" />,
                                onClick: () => navigate(`/purchases/debit-notes/${r.id}`),
                              },
                              {
                                label: "Edit",
                                icon: <Edit2 className="h-4 w-4" />,
                                onClick: () =>
                                  navigate(`/purchases/debit-notes/${r.id}/edit`, {
                                    state: { viewId: r.id, document: r },
                                  }),
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
        </div>

        <div className="mt-4 ui-pagination justify-between border-t border-[var(--color-border-soft)] pt-4">
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

      {showFilters ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/35"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setShowFilters(false)}
        >
          <aside className="flex h-full w-full max-w-[400px] flex-col border-l border-[#e4e4ea] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e4e4ea] px-5 py-4">
              <h2 className="text-[18px] font-bold text-[#1a1a1f]">Filters</h2>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="rounded-lg p-1 text-[#9a9aa5] hover:bg-[#F5F5F5]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5">
              <FilterSection label="Settlement Status">
                {[
                  { id: "unsettled", label: "Unsettled" },
                  { id: "partial", label: "Partially Settled" },
                  { id: "settled", label: "Settled" },
                ].map((opt) => (
                  <Chip
                    key={opt.id}
                    label={opt.label}
                    active={draftFilters.settlement === opt.id}
                    onClick={() =>
                      setDraftFilters((f) => ({
                        ...f,
                        settlement: f.settlement === opt.id ? "" : opt.id,
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
              <FilterSection label="Note Type">
                {[
                  { id: "all", label: "All" },
                  { id: "debit_note", label: "Debit Note" },
                  { id: "purchase_return", label: "Purchase Return" },
                ].map((opt) => (
                  <Chip
                    key={opt.id}
                    label={opt.label}
                    active={draftFilters.noteType === opt.id}
                    onClick={() => setDraftFilters((f) => ({ ...f, noteType: opt.id }))}
                  />
                ))}
              </FilterSection>
              <FilterSection label="Debit Note Amount">
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
            <div className="grid grid-cols-2 gap-3 border-t border-[#e4e4ea] px-5 py-4">
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
