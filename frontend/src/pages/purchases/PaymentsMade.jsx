import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, ListFilter, Plus, Receipt, Search } from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { deleteBizDocument, listBizDocuments } from "../../api/bizDocumentsApi";
import { apiErrorMessage } from "../../utils/apiError";
import { formatInr } from "../../data/salesMasterData";

const PAGE_SIZES = [10, 20, 50];

const SORT_OPTIONS = [
  { id: "date_desc", label: "Payment Date (Latest First)" },
  { id: "date_asc", label: "Payment Date (Oldest First)" },
  { id: "amount_desc", label: "Amount (High to Low)" },
  { id: "amount_asc", label: "Amount (Low to High)" },
];

const MODE_TABS = [
  { id: "all", label: "All" },
  { id: "cash", label: "Cash" },
  { id: "cheque", label: "Cheque" },
  { id: "net_banking", label: "Net Banking" },
  { id: "upi", label: "UPI" },
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

function SummaryTab({ label, count, amount, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 flex-1 border-b-[3px] px-4 py-3.5 text-left transition ${
        active
          ? "border-[var(--color-success)] bg-white text-[var(--color-success)]"
          : "border-transparent bg-transparent text-[#6b6b76] hover:bg-white/70"
      }`}
    >
      <p className={`text-[13px] font-medium ${active ? "" : "text-[#6b6b76]"}`}>
        {label} <span className={active ? "opacity-70" : "text-[#a0a0ab]"}>({count})</span>
      </p>
      <p
        className={`mt-1 text-[18px] font-bold tabular-nums ${
          active ? "text-[var(--color-success)]" : "text-[#1a1a1f]"
        }`}
      >
        {amount}
      </p>
    </button>
  );
}

export default function PaymentsMade() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [kpiFilter, setKpiFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("2026-04-01");
  const [dateTo, setDateTo] = useState("2027-03-31");
  const dateFromRef = useRef(null);
  const dateToRef = useRef(null);
  const [showSort, setShowSort] = useState(false);
  const [sortId, setSortId] = useState("date_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await listBizDocuments({
        module: "purchases",
        doc_type: "payment_made",
        page: 1,
        page_size: 100,
      });
      const items = res?.data?.items || res?.data || [];
      const enriched = (Array.isArray(items) ? items : []).map((p) => {
        const meta = p.meta || {};
        return {
          id: p.id,
          receipt_number: p.document_number,
          payment_date: p.document_date,
          party_name: p.party_name || "—",
          amount: Number(p.amount) || 0,
          advance_amount: Number(meta.advance_amount ?? meta.unused_amount) || 0,
          method: normalizeMode(meta.payment_mode || meta.method),
          status: p.status || "issued",
        };
      });
      setRows(enriched);
    } catch {
      addToast("Failed to load payments made", "error");
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
    if (!window.confirm(`Delete payment ${row.receipt_number}?`)) return;
    try {
      await deleteBizDocument(row.id);
      addToast("Payment deleted", "success");
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete payment"), "error");
    }
  };

  useEffect(() => {
    setPage(1);
  }, [kpiFilter, search, sortId, pageSize, dateFrom, dateTo]);

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
  }, [rows, search, dateFrom, dateTo, kpiFilter, sortId]);

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

  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filteredSorted.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#F5F5F5]">
        <Loader label="Loading payments made..." />
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-4 bg-[#F5F5F5] p-4 sm:p-6">

      <div className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-[var(--color-success-soft)]">
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
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#e4e4ea] bg-white px-3 py-2 text-[13px] text-[#4a4a55] shadow-sm">
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
            <Button
              variant="add"
              to="/purchases/payments-made/create"
              leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
            >
              Make Payment
            </Button>
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
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-[13px]">
              <thead className="bg-[var(--color-success-soft)] text-[12px] font-semibold uppercase tracking-wide text-[#6b6b76]">
                <tr>
                  <SerialNumberHeader className="border-b border-r border-[#d0d0d8]" />
                  {[
                    "Receipt No.",
                    "Payment Date",
                    "Seller Name",
                    "Payment Mode",
                    "Total Amount",
                    "Advance Amount",
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
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <Receipt className="mx-auto h-12 w-12 text-[#c4c4cc]" />
                      <p className="mt-3 text-[14px] text-[#6b6b76]">
                        No Payment available, Make a new payment
                      </p>
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
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 font-semibold text-[var(--color-success)]">
                        {r.receipt_number}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 text-[#4a4a55]">
                        {fmtDate(r.payment_date)}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3">
                        {r.party_name}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3">
                        {modeLabel(r.method)}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 tabular-nums font-medium">
                        {formatInr(r.amount)}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 tabular-nums">
                        {formatInr(r.advance_amount)}
                      </td>
                      <td className="border-t border-[#d0d0d8] px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/purchases/payments-made/${r.id}/edit`}
                            state={{ viewId: r.id, payment: r }}
                            className="text-[12px] font-semibold text-[var(--color-success)] hover:underline"
                          >
                            View
                          </Link>
                          <Link
                            to={`/purchases/payments-made/${r.id}/edit`}
                            state={{ viewId: r.id, payment: r }}
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
    </div>
  );
}
