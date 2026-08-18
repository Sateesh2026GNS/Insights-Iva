import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight, FileText, Filter, ListFilter, Plus, Search, X } from "lucide-react";

import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { cancelInvoice, getInvoicesV2 } from "../../api/salesApi";
import { apiErrorMessage } from "../../utils/apiError";
import { formatInr } from "../../data/salesMasterData";

const YELLOW = "var(--color-primary)";
const PAGE_BG = "var(--color-bg)";
const PAGE_SIZES = [10, 20, 25, 50];

const SORT_OPTIONS = [
  { id: "date_desc", label: "Date (Latest First)" },
  { id: "date_asc", label: "Date (Oldest First)" },
  { id: "amount_desc", label: "Amount (High to Low)" },
  { id: "amount_asc", label: "Amount (Low to High)" },
];

const EMPTY_FILTERS = {
  conversion: "",
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

function isChallan(doc) {
  const d = String(doc || "").toLowerCase();
  return d === "delivery_challan" || d.includes("challan");
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

function SummaryTab({ label, amount, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 flex-1 border-b-[3px] px-5 py-3.5 text-left transition ${
        active
          ? "border-[#3d3560] bg-white text-[#3d3560]"
          : "border-transparent bg-transparent text-[#6b6b76] hover:bg-white/70"
      }`}
    >
      <p className={`text-[13px] font-medium ${active ? "" : "text-[#6b6b76]"}`}>{label}</p>
      <p className={`mt-1 text-[18px] font-bold tabular-nums ${active ? "text-inherit" : "text-[#1a1a1f]"}`}>
        {amount}
      </p>
    </button>
  );
}

function deliveryStatus(row) {
  const s = String(row.status || row.payment_status || "").toLowerCase();
  if (s === "delivered" || s === "shipped" || s === "completed") return "delivered";
  return "undelivered";
}

function isConverted(row) {
  return Boolean(row.converted_to_invoice || row.sales_order_id);
}

export default function DeliveryChallans() {
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
  const [pageSize, setPageSize] = useState(25);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getInvoicesV2({
        page: 1,
        page_size: 500,
        document_type: "delivery_challan",
      });
      const items = res?.data?.items || res?.data || [];
      const list = (Array.isArray(items) ? items : []).filter((i) =>
        isChallan(i.document_type)
      );
      setRows(list);
    } catch {
      addToast("Failed to load delivery challans", "error");
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
    const delivered = rows.filter((r) => deliveryStatus(r) === "delivered");
    const undelivered = rows.filter((r) => deliveryStatus(r) === "undelivered");
    return {
      all: { amount: sum(rows) },
      delivered: { amount: sum(delivered) },
      undelivered: { amount: sum(undelivered) },
    };
  }, [rows]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (kpiFilter === "delivered" && deliveryStatus(r) !== "delivered") return false;
      if (kpiFilter === "undelivered" && deliveryStatus(r) !== "undelivered") return false;

      const issue = String(r.issue_date || "").slice(0, 10);
      if (dateFrom && issue && issue < dateFrom) return false;
      if (dateTo && issue && issue > dateTo) return false;

      if (q) {
        const hay = `${r.invoice_number || ""} ${r.customer_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (filters.conversion === "converted" && !isConverted(r)) return false;
      if (filters.conversion === "not_converted" && isConverted(r)) return false;

      if (filters.eInvoiceStatus) {
        const st = String(r.e_invoice_status || "all").toLowerCase();
        if (st !== filters.eInvoiceStatus) return false;
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
        <Loader label="Loading delivery challans..." />
      </div>
    );
  }

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="space-y-4 p-4 sm:p-6">
        <div className="overflow-hidden rounded-xl bg-[#ececf0]">
          <div className="flex flex-wrap">
            <SummaryTab
              label="All Challans"
              amount={formatInr(tabStats.all.amount)}
              active={kpiFilter === "all"}
              onClick={() => setKpiFilter("all")}
            />
            <SummaryTab
              label="Delivered"
              amount={formatInr(tabStats.delivered.amount)}
              active={kpiFilter === "delivered"}
              onClick={() => setKpiFilter("delivered")}
            />
            <SummaryTab
              label="Undelivered"
              amount={formatInr(tabStats.undelivered.amount)}
              active={kpiFilter === "undelivered"}
              onClick={() => setKpiFilter("undelivered")}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5">
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
          <Link
            to="/sales/delivery-challans/create"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm"
            style={{ background: YELLOW }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Delivery Challan
          </Link>
        </div>
      </div>

      <div className="rounded-t-2xl bg-white px-4 pb-6 pt-4 sm:px-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative ui-search-wrap w-full">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9aa5]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded-full border border-[#e4e4ea] bg-white py-2.5 pl-10 pr-4 text-[14px] text-[#1a1a1f] shadow-sm placeholder:text-[#9a9aa5] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25"
            />
          </div>
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
                  <div className="absolute right-0 z-20 mt-1.5 w-[240px] overflow-hidden rounded-xl border border-[#d0d0d8] bg-white py-1 shadow-lg">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSortId(opt.id);
                          setShowSort(false);
                        }}
                        className={`block w-full px-4 py-2.5 text-left text-[13px] hover:bg-[#F5F5F5] ${
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
              <thead className="bg-[#efeaf8] text-[12px] font-semibold uppercase tracking-wide text-[#6b6b76]">
                <tr>
                  <SerialNumberHeader className="border-b border-r border-[#d0d0d8]" />
                  <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Challan No.</th>
                  <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Date</th>
                  <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Buyer Name</th>
                  <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Amount</th>
                  <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Status</th>
                  <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <FileText className="mx-auto h-12 w-12 text-[#c4c4cc]" />
                      <p className="mt-3 text-[14px] text-[#9a9aa5]">
                        No Delivery Challans available, Create new Delivery Challan
                      </p>
                      <Link
                        to="/sales/delivery-challans/create"
                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white"
                        style={{ background: YELLOW }}
                      >
                        <Plus className="h-4 w-4" /> Create Delivery Challan
                      </Link>
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
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 font-semibold text-[#6b4eff]">
                        {r.invoice_number}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 text-[#4a4a55]">{fmtDate(r.issue_date)}</td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3">{r.customer_name || "—"}</td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 tabular-nums font-medium">
                        {formatInr(r.grand_total ?? r.total_amount ?? 0)}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 capitalize text-[#4a4a55]">
                        {deliveryStatus(r)}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/sales/delivery-challans/${r.id}/edit`}
                            className="text-[12px] font-semibold text-[#6b4eff] hover:underline"
                          >
                            View
                          </Link>
                          <Link
                            to={`/sales/delivery-challans/${r.id}/edit`}
                            className="text-[12px] font-semibold text-[#4a4a55] hover:underline"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Cancel challan ${r.invoice_number}?`)) return;
                              try {
                                await cancelInvoice(r.id);
                                addToast("Challan cancelled", "success");
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-[13px] text-[#6b6b76]">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-md border border-[#e4e4ea] bg-white px-2 py-1"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>
              {total === 0 ? "1-0 of 0" : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-[#e4e4ea] p-1.5 disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span
              className="min-w-[2rem] rounded-md px-2.5 py-1 text-center text-[13px] font-semibold"
              style={{ background: "color-mix(in srgb, var(--color-primary) 28%, white)" }}
            >
              {page}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-[#e4e4ea] p-1.5 disabled:opacity-35"
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
          <aside className="flex h-full w-full max-w-[400px] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#d0d0d8] px-5 py-4">
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
              <FilterSection label="Invoice Conversion Status">
                <Chip
                  label="Converted"
                  active={draftFilters.conversion === "converted"}
                  onClick={() =>
                    setDraftFilters((f) => ({
                      ...f,
                      conversion: f.conversion === "converted" ? "" : "converted",
                    }))
                  }
                />
                <Chip
                  label="Not Converted"
                  active={draftFilters.conversion === "not_converted"}
                  onClick={() =>
                    setDraftFilters((f) => ({
                      ...f,
                      conversion: f.conversion === "not_converted" ? "" : "not_converted",
                    }))
                  }
                />
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
              <FilterSection label="Delivery Challan Amount">
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
