import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight, Filter, ListFilter, Plus, Receipt, Search, X } from "lucide-react";

import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import { deletePayment, getInvoicesV2, getPayments } from "../../api/salesApi";
import { formatInr } from "../../data/salesMasterData";
import { apiErrorMessage } from "../../utils/apiError";

const ACCENT = "var(--color-action-teal)"; /* #0F6D84 */
const PAGE_SIZES = [10, 20, 50];

const SORT_OPTIONS = [
  { id: "date_desc", label: "Receipt date (Latest First)" },
  { id: "date_asc", label: "Receipt date (Oldest First)" },
  { id: "amount_desc", label: "Payment Amount (High to Low)" },
  { id: "amount_asc", label: "Payment Amount (Low to High)" },
];

const MODE_TABS = [
  { id: "all", label: "All" },
  { id: "cash", label: "Cash" },
  { id: "cheque", label: "Cheque" },
  { id: "net_banking", label: "Net Banking" },
  { id: "upi", label: "UPI" },
];

const EMPTY_FILTERS = { paymentMode: "", amountBand: "", unusedBand: "" };

const AMOUNT_BANDS = [
  { id: "under_2k", label: "under ₹2,000", min: 0, max: 2000 },
  { id: "2k_5k", label: "₹2,000-₹5,000", min: 2000, max: 5000 },
  { id: "5k_10k", label: "₹5,000-₹10,000", min: 5000, max: 10000 },
  { id: "10k_20k", label: "₹10,000-₹20,000", min: 10000, max: 20000 },
  { id: "20k_above", label: "₹20,000-Above", min: 20000, max: Infinity },
];

function normalizeMode(method) {
  const m = String(method || "cash").toLowerCase().replace(/\s+/g, "_");
  if (["cash"].includes(m)) return "cash";
  if (["cheque", "check", "chq"].includes(m)) return "cheque";
  if (["net_banking", "netbanking", "neft", "rtgs", "bank", "imps"].includes(m))
    return "net_banking";
  if (["upi", "gpay", "phonepe"].includes(m)) return "upi";
  return m || "cash";
}

function modeLabel(mode) {
  return (
    {
      cash: "Cash",
      cheque: "Cheque",
      net_banking: "Net Banking",
      upi: "UPI",
    }[mode] || mode
  );
}

function inBand(amount, bandId) {
  const band = AMOUNT_BANDS.find((b) => b.id === bandId);
  if (!band) return true;
  const n = Number(amount) || 0;
  return n >= band.min && n < band.max;
}

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
        active
          ? "bg-[#0f6d84] text-white"
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

function SummaryTab({ label, count, amount, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 flex-1 border-b-[3px] px-4 py-3.5 text-left transition ${
        active
          ? "border-[var(--color-primary)] bg-white text-[var(--color-primary)]"
          : "border-transparent bg-transparent text-[#6b6b76] hover:bg-white/70"
      }`}
    >
      <p className={`text-[13px] font-medium ${active ? "" : "text-[#6b6b76]"}`}>
        {label} <span className={active ? "opacity-70" : "text-[#a0a0ab]"}>({count})</span>
      </p>
      <p
        className={`mt-1 text-[18px] font-bold tabular-nums ${
          active ? "text-[var(--color-primary)]" : "text-[#1a1a1f]"
        }`}
      >
        {amount}
      </p>
    </button>
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso).slice(0, 10);
  return `${d}/${m}/${y}`;
}

function parseReceiptMeta(notes) {
  try {
    if (notes && String(notes).startsWith("{")) return JSON.parse(notes);
  } catch {
    /* ignore */
  }
  return {};
}

export default function PaymentReceipts() {
  const { addToast } = useToast();
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [kpiFilter, setKpiFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("2026-04-01");
  const [dateTo, setDateTo] = useState("2027-03-31");
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
      const [payRes, invRes] = await Promise.allSettled([
        getPayments(tenantId),
        getInvoicesV2({ page: 1, page_size: 500 }),
      ]);


      const payments = payRes.status === "fulfilled" ? payRes.value?.data || [] : [];
      const invoices =
        invRes.status === "fulfilled"
          ? invRes.value?.data?.items || invRes.value?.data || []
          : [];
      const invMap = Object.fromEntries(
        (Array.isArray(invoices) ? invoices : []).map((i) => [String(i.id), i])
      );
      const enriched = payments.map((p) => {
        const inv = invMap[String(p.invoice_id)] || {};
        const meta = parseReceiptMeta(p.notes);
        return {
          id: p.id,
          receipt_number: meta.receipt_number || `RCPT-${p.id}`,
          payment_date: p.payment_date,
          party_name: meta.party_name || inv.customer_name || inv.buyer_name || "—",
          amount: Number(p.amount) || 0,
          unused_amount: Number(meta.unused_amount) || 0,
          method: normalizeMode(meta.payment_mode || p.method),
          status: meta.is_advance ? "Advance" : inv.payment_status || inv.status || "Recorded",
          account_name: meta.account_name || null,
          notes: typeof p.notes === "string" && !p.notes.startsWith("{") ? p.notes : meta.remark || "",
        };
      });
      setRows(enriched);
    } catch {
      addToast("Failed to load payment receipts", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [addToast, tenantId]);

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
        const hay = `${r.receipt_number} ${r.party_name} ${r.method}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const d = String(r.payment_date || "").slice(0, 10);
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      if (kpiFilter !== "all" && r.method !== kpiFilter) return false;
      if (filters.paymentMode && r.method !== filters.paymentMode) return false;
      if (filters.amountBand && !inBand(r.amount, filters.amountBand)) return false;
      if (filters.unusedBand && !inBand(r.unused_amount, filters.unusedBand)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const da = String(a.payment_date || "");
      const db = String(b.payment_date || "");
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
    const sum = (arr) => arr.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const by = (id) => (id === "all" ? rows : rows.filter((r) => r.method === id));
    return Object.fromEntries(
      MODE_TABS.map((t) => {
        const arr = by(t.id);
        return [t.id, { count: arr.length, amount: sum(arr) }];
      })
    );
  }, [rows]);

  const totalUnused = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.unused_amount) || 0), 0),
    [rows]
  );

  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filteredSorted.slice((page - 1) * pageSize, page * pageSize);

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete receipt ${row.receipt_number}?`)) return;
    try {
      await deletePayment(row.id);
      addToast("Payment receipt deleted", "success");
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete receipt"), "error");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[var(--color-bg)]">
        <Loader label="Loading payment receipts..." />
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-4 bg-[var(--color-bg)] p-4 sm:p-6">

      <div className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-[#f7f7f9]">
        <div className="flex overflow-x-auto">
          {MODE_TABS.map((t) => (
            <SummaryTab
              key={t.id}
              label={t.label}
              count={tabStats[t.id]?.count || 0}
              amount={formatInr(tabStats[t.id]?.amount || 0)}
              active={kpiFilter === t.id}
              onClick={() => setKpiFilter(t.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative ui-search-wrap w-full">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9aa5]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full rounded-full border border-[#e4e4ea] bg-white py-2.5 pl-10 pr-4 text-[14px] text-[#1a1a1f] shadow-sm placeholder:text-[#9a9aa5] focus:border-[#0f6d84] focus:outline-none focus:ring-2 focus:ring-[#0f6d84]/25"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#e4e4ea] bg-white px-3 py-2 text-[13px] text-[#4a4a55] shadow-sm">
            <Calendar className="h-4 w-4 shrink-0 text-[#9a9aa5]" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[118px] border-0 bg-transparent p-0 text-[13px] focus:outline-none"
            />
            <span className="text-[#9a9aa5]">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[118px] border-0 bg-transparent p-0 text-[13px] focus:outline-none"
            />
          </div>
          <span className="text-[13px] font-medium text-[#4a4a55]">
            Total Unused:{" "}
            <span className="tabular-nums text-[#1a1a1f]">{formatInr(totalUnused)}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setDraftFilters(filters);
              setShowFilters(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#ececf0] px-3.5 py-2 text-[13px] font-medium text-[#4a4a55]"
          >
            <Filter className="h-4 w-4" /> Filters
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSort((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#ececf0] px-3.5 py-2 text-[13px] font-medium text-[#4a4a55]"
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
                <div className="absolute right-0 z-20 mt-1.5 w-[280px] overflow-hidden rounded-xl border border-[#d0d0d8] bg-white py-1 shadow-lg">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSortId(opt.id);
                        setShowSort(false);
                      }}
                      className={`block w-full px-4 py-2.5 text-left text-[13px] hover:bg-[#f5f5f7] ${
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
          <Button
            variant="add"
            to="/sales/payment-receipts/create"
            leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
          >
            Record Payment
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-[13px]">
            <thead className="bg-[#f3f3f6] text-[12px] font-semibold uppercase tracking-wide text-[#6b6b76]">
              <tr>
                <SerialNumberHeader className="border-b border-r border-[#d0d0d8]" />
                <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Receipt No.</th>
                <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Date</th>
                <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Party Name</th>
                <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Amount</th>
                <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Payment Mode</th>
                <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Status</th>
                <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Receipt className="mx-auto h-12 w-12 text-[#c4c4cc]" />
                    <p className="mt-3 text-[14px] text-[#6b6b76]">
                      No Receipt available, Record new payment
                    </p>
                    <Button
                      variant="add"
                      to="/sales/payment-receipts/create"
                      className="mt-4"
                      leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
                    >
                      Record Payment
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
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3 font-semibold text-[var(--color-primary)]">{r.receipt_number}</td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3 text-[#4a4a55]">{fmtDate(r.payment_date)}</td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3">{r.party_name}</td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3 tabular-nums font-medium">{formatInr(r.amount)}</td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3">{modeLabel(r.method)}</td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3 capitalize">{r.status}</td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/sales/payment-receipts/${r.id}/edit`}
                          className="text-[12px] font-semibold text-[var(--color-primary)] hover:underline"
                        >
                          View
                        </Link>
                        <Link
                          to={`/sales/payment-receipts/${r.id}/edit`}
                          className="text-[12px] font-semibold text-[#4a4a55] hover:underline"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(r)}
                          className="text-[12px] font-semibold text-[#dc2626] hover:underline"
                        >
                          Delete
                        </button>
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
              <FilterSection label="Payment Mode">
                {["cash", "cheque", "net_banking", "upi"].map((id) => (
                  <Chip
                    key={id}
                    label={modeLabel(id)}
                    active={draftFilters.paymentMode === id}
                    onClick={() =>
                      setDraftFilters((f) => ({
                        ...f,
                        paymentMode: f.paymentMode === id ? "" : id,
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
              <FilterSection label="Unused Amount">
                {AMOUNT_BANDS.map((b) => (
                  <Chip
                    key={`u-${b.id}`}
                    label={b.label}
                    active={draftFilters.unusedBand === b.id}
                    onClick={() =>
                      setDraftFilters((f) => ({
                        ...f,
                        unusedBand: f.unusedBand === b.id ? "" : b.id,
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
                className="rounded-xl py-3 text-[14px] font-semibold text-white"
                style={{ background: ACCENT }}
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
