import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight, FileText, Filter, ListFilter, Plus, Search, X } from "lucide-react";

import Loader from "../../components/common/Loader";
import { SearchBar } from "../../components/common/SearchFilter";
import Button from "../../components/common/Button";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { cancelInvoice, getInvoicesV2 } from "../../api/salesApi";
import { apiErrorMessage } from "../../utils/apiError";
import { formatInr } from "../../data/salesMasterData";

const YELLOW = "var(--color-primary)";
const PAGE_BG = "var(--color-bg)";
const PAGE_SIZES = [10, 20, 50];

const SORT_OPTIONS = [
  { id: "date_desc", label: "Credit Note Date (Latest First)" },
  { id: "date_asc", label: "Credit Note Date (Oldest First)" },
  { id: "amount_desc", label: "Amount (High to Low)" },
  { id: "amount_asc", label: "Amount (Low to High)" },
];

const EMPTY_FILTERS = {
  settlement: "",
  eInvoiceStatus: "",
  eWaybillStatus: "",
  documentType: "",
  amountBand: "",
};

const AMOUNT_BANDS = [
  { id: "under_2k", label: "under ₹2,000", min: 0, max: 2000 },
  { id: "2k_5k", label: "₹2,000-₹5,000", min: 2000, max: 5000 },
  { id: "5k_10k", label: "₹5,000-₹10,000", min: 5000, max: 10000 },
  { id: "10k_20k", label: "₹10,000-₹20,000", min: 10000, max: 20000 },
  { id: "20k_above", label: "₹20,000-Above", min: 20000, max: Infinity },
];

function isCreditDoc(doc) {
  const d = String(doc || "").toLowerCase();
  return d === "credit_note" || d === "sales_return" || d.includes("credit");
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

function settlementStatus(row) {
  const paid = Number(row.amount_paid) || 0;
  const total = Number(row.grand_total ?? row.total_amount) || 0;
  if (total <= 0 || paid <= 0) return "unsettled";
  if (paid >= total) return "settled";
  return "partial";
}

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
        active
          ? "bg-[#2d2a4a] text-white"
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

function SummaryTab({ label, count, amount, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 flex-1 border-b-[3px] px-5 py-3.5 text-left transition ${
        active
          ? "border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-primary)]"
          : "border-transparent bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]/70"
      }`}
    >
      <p className={`text-[13px] font-medium ${active ? "" : "text-[var(--color-text-muted)]"}`}>
        {label}{" "}
        <span className={active ? "opacity-70" : "text-[#a0a0ab]"}>({count})</span>
      </p>
      <p className={`mt-1 text-[18px] font-bold tabular-nums ${active ? "text-inherit" : "text-[var(--color-text)]"}`}>
        {amount}
      </p>
    </button>
  );
}

export default function CreditNotes() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("2026-04-01");
  const [dateTo, setDateTo] = useState("2027-03-31");
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
      const res = await getInvoicesV2({
        page: 1,
        page_size: 500,
        document_type: "credit_note",
      });
      const items = res?.data?.items || res?.data || [];
      const list = (Array.isArray(items) ? items : []).filter((i) =>
        isCreditDoc(i.document_type)
      );
      setRows(list);
    } catch {
      addToast("Failed to load credit notes", "error");
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

  const tabStats = useMemo(() => {
    const sum = (arr) =>
      arr.reduce((s, r) => s + (Number(r.grand_total ?? r.total_amount) || 0), 0);
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

      const issue = String(r.issue_date || "").slice(0, 10);
      if (dateFrom && issue && issue < dateFrom) return false;
      if (dateTo && issue && issue > dateTo) return false;

      if (q) {
        const hay = `${r.invoice_number || ""} ${r.customer_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (filters.settlement && settle !== filters.settlement) return false;
      if (filters.eInvoiceStatus) {
        const st = String(r.e_invoice_status || "all").toLowerCase();
        if (st !== filters.eInvoiceStatus) return false;
      }
      if (filters.eWaybillStatus && filters.eWaybillStatus !== "all") {
        const st = String(r.e_waybill_status || "all").toLowerCase();
        if (st !== filters.eWaybillStatus) return false;
      }
      if (filters.documentType === "credit_note") {
        if (String(r.document_type).toLowerCase() !== "credit_note") return false;
      }
      if (filters.documentType === "sales_return") {
        if (String(r.document_type).toLowerCase() !== "sales_return") return false;
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
        <Loader label="Loading credit notes..." />
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="space-y-4 p-4 sm:p-6">

        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
          <div className="flex flex-wrap">
            <SummaryTab
              label="All Credit Notes"
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
      </div>

      <div className="rounded-t-2xl border border-[var(--color-border)] border-b-0 bg-[var(--color-surface)] px-4 pb-6 pt-4 sm:px-6">
        <div className="mb-3 flex flex-col gap-3 border-b border-[var(--color-border)] pb-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="Search" className="w-full" />
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text-secondary)]">
              <Calendar className="h-4 w-4 shrink-0 text-[var(--color-text-faint)]" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[118px] border-0 bg-transparent p-0 text-[13px] focus:outline-none"
              />
              <span className="text-[var(--color-text-faint)]">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[118px] border-0 bg-transparent p-0 text-[13px] focus:outline-none"
              />
            </div>
            <Button variant="add" to="/sales/credit-notes/create" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              Create Credit Note
            </Button>
          </div>
        </div>

        <div className="relative mb-3 flex justify-end gap-2 border-b border-[var(--color-border)] pb-3">
          <button
            type="button"
            onClick={() => {
              setDraftFilters(filters);
              setShowFilters(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-text-secondary)]"
          >
            <Filter className="h-4 w-4" /> Filters
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSort((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-text-secondary)]"
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
                <div className="absolute right-0 z-20 mt-1.5 w-[280px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg">
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

        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <div className="ui-table-wrap ui-table-wrap--scroll">
            <table className="ui-table min-w-full border-collapse text-left text-[13px]">
              <thead className="ui-table-head">
                <tr>
                  <SerialNumberHeader className="border-b border-r border-[var(--color-table-border)]" />
                  {[
                    "Credit Note No.",
                    "Date",
                    "Party Name",
                    "Total Amount",
                    "Available Amount",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="border-t border-[var(--color-border)] px-4 py-16 text-center">
                      <FileText className="mx-auto h-12 w-12 text-[var(--color-text-icon)]" />
                      <p className="mt-3 text-[14px] text-[var(--color-text-faint)]">
                        No Credit Notes yet. Create your first credit note.
                      </p>
                      <Button variant="add" to="/sales/credit-notes/create" className="mt-4" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                        Create Credit Note
                      </Button>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r, rowIndex) => {
                    const settle = settlementStatus(r);
                    const totalAmt = Number(r.grand_total ?? r.total_amount) || 0;
                    const paid = Number(r.amount_paid) || 0;
                    const available = Math.max(0, totalAmt - paid);
                    return (
                      <tr key={r.id} className="hover:bg-[var(--color-table-row-hover)]">
                        <SerialNumberCell
                          rowIndex={rowIndex}
                          page={page}
                          pageSize={pageSize}
                          className="border-t border-r border-[var(--color-table-border)]"
                        />
                        <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 font-semibold text-[var(--color-primary)]">
                          {r.invoice_number}
                        </td>
                        <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[var(--color-text-secondary)]">
                          {fmtDate(r.issue_date)}
                        </td>
                        <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3">
                          {r.customer_name || "—"}
                        </td>
                        <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 tabular-nums font-medium">
                          {formatInr(totalAmt)}
                        </td>
                        <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 tabular-nums">
                          {formatInr(available)}
                        </td>
                        <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 capitalize text-[var(--color-text-secondary)]">
                          {settle === "partial" ? "Partially Settled" : settle}
                        </td>
                        <td className="border-t border-[var(--color-table-border)] px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              to={`/sales/credit-notes/${r.id}/edit`}
                              className="text-[12px] font-semibold text-[var(--color-primary)] hover:underline"
                            >
                              View
                            </Link>
                            <Link
                              to={`/sales/credit-notes/${r.id}/edit`}
                              className="text-[12px] font-semibold text-[var(--color-text-secondary)] hover:underline"
                            >
                              Edit
                            </Link>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm(`Cancel credit note ${r.invoice_number}?`)) return;
                                try {
                                  await cancelInvoice(r.id);
                                  addToast("Credit note cancelled", "success");
                                  load();
                                } catch (err) {
                                  addToast(apiErrorMessage(err, "Failed to cancel"), "error");
                                }
                              }}
                              className="text-[12px] font-semibold text-[#dc2626] hover:underline"
                            >
                              Delete
                            </button>
                          </div>
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
              <FilterSection label="E-Invoice Status">
                {["active", "cancelled"].map((id) => (
                  <Chip
                    key={id}
                    label={id === "active" ? "Active" : "Cancelled"}
                    active={draftFilters.eInvoiceStatus === id}
                    onClick={() =>
                      setDraftFilters((f) => ({
                        ...f,
                        eInvoiceStatus: f.eInvoiceStatus === id ? "" : id,
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
              <FilterSection label="Document Type">
                <Chip
                  label="Credit Note"
                  active={draftFilters.documentType === "credit_note"}
                  onClick={() =>
                    setDraftFilters((f) => ({
                      ...f,
                      documentType: f.documentType === "credit_note" ? "" : "credit_note",
                    }))
                  }
                />
                <Chip
                  label="Sales Return"
                  active={draftFilters.documentType === "sales_return"}
                  onClick={() =>
                    setDraftFilters((f) => ({
                      ...f,
                      documentType: f.documentType === "sales_return" ? "" : "sales_return",
                    }))
                  }
                />
              </FilterSection>
              <FilterSection label="Credit Note Amount">
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
    </div>
  );
}
