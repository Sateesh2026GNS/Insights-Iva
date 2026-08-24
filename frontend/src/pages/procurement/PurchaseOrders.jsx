import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit2,
  Eye,
  Filter,
  ListFilter,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import RowActionMenu from "../../components/common/RowActionMenu";
import PODetailModal from "../../components/procurement/PODetailModal";
import { useToast } from "../../context/ToastContext";
import {
  deletePurchaseOrder,
  getPurchaseOrdersEnriched,
  updatePurchaseOrderStatus,
} from "../../api/procurementApi";
import { formatInr } from "../../data/salesMasterData";
import { apiErrorMessage } from "../../utils/apiError";

const PAGE_BG = "var(--color-bg)";
const PAGE_SIZES = [10, 20, 50];

const SORT_OPTIONS = [
  { id: "date_desc", label: "PO Date (Latest First)" },
  { id: "date_asc", label: "PO Date (Oldest First)" },
  { id: "amount_desc", label: "Amount (High to Low)" },
  { id: "amount_asc", label: "Amount (Low to High)" },
];

const EMPTY_FILTERS = {
  status: "",
  vendor: "",
};

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

function isPendingPurchase(row) {
  const s = String(row.status || "").toLowerCase();
  return s === "draft" || s === "pending" || s === "approved";
}

function isPurchased(row) {
  const s = String(row.status || "").toLowerCase();
  return s === "received" || s === "delivered";
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

export default function PurchaseOrders() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
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
      const res = await getPurchaseOrdersEnriched();
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch {
      addToast("Failed to load purchase orders", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  useManufacturingRefresh(load);

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete purchase order ${row.po_number || row.id}?`)) return;
    try {
      await deletePurchaseOrder(row.id);
      addToast("Purchase order deleted", "success");
      await load(true);
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete purchase order"), "error");
    }
  };

  const handleStatus = async (po, status) => {
    if (typeof po.id !== "number") {
      addToast("Invalid purchase order", "error");
      return;
    }
    try {
      await updatePurchaseOrderStatus(po.id, status);
      addToast(`PO marked as ${status}`, "success");
      setSelected(null);
      load(true);
    } catch (err) {
      addToast(apiErrorMessage(err, "Update failed"), "error");
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, filters, sortId, pageSize, dateFrom, dateTo, kpiFilter]);

  const tabStats = useMemo(() => {
    const sum = (arr) => arr.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
    const pending = rows.filter(isPendingPurchase);
    const purchased = rows.filter(isPurchased);
    return {
      all: { count: rows.length, amount: sum(rows) },
      pending: { count: pending.length, amount: sum(pending) },
      purchased: { count: purchased.length, amount: sum(purchased) },
    };
  }, [rows]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (kpiFilter === "pending" && !isPendingPurchase(r)) return false;
      if (kpiFilter === "purchased" && !isPurchased(r)) return false;

      const issue = String(r.order_date || "").slice(0, 10);
      if (dateFrom && issue && issue < dateFrom) return false;
      if (dateTo && issue && issue > dateTo) return false;

      if (q) {
        const hay = `${r.po_number || ""} ${r.vendor_name || ""} ${r.buyer || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (filters.status && String(r.status).toLowerCase() !== filters.status) return false;
      if (filters.vendor) {
        const vendor = (r.vendor_name || "").toLowerCase();
        if (!vendor.includes(filters.vendor.toLowerCase())) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      const da = String(a.order_date || "");
      const db = String(b.order_date || "");
      const aa = Number(a.total_amount) || 0;
      const ab = Number(b.total_amount) || 0;
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
        <Loader label="Loading purchase orders..." />
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-4 bg-[#F5F5F5] p-4 sm:p-6">
      <div className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-[var(--color-primary-soft)]">
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          <div className="flex min-w-0 flex-1 flex-wrap">
            <SummaryTab
              label="All"
              count={tabStats.all.count}
              amount={formatInr(tabStats.all.amount)}
              active={kpiFilter === "all"}
              onClick={() => setKpiFilter("all")}
            />
            <SummaryTab
              label="Pending Purchase"
              count={tabStats.pending.count}
              amount={formatInr(tabStats.pending.amount)}
              active={kpiFilter === "pending"}
              onClick={() => setKpiFilter("pending")}
            />
            <SummaryTab
              label="Purchased"
              count={tabStats.purchased.count}
              amount={formatInr(tabStats.purchased.amount)}
              active={kpiFilter === "purchased"}
              onClick={() => setKpiFilter("purchased")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 border-t border-[#e4e4ea] px-4 py-3 lg:border-l lg:border-t-0">
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
              to="/procurement/purchase-orders/create"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:opacity-95"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> Create Purchase Order
            </Link>
          </div>
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
                  {["PO No.", "Date", "Seller Name", "PO Amount", "Actions"].map((h) => (
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
                    <td colSpan={5} className="border-t border-[#e4e4ea] px-4 py-16 text-center">
                      <ClipboardList className="mx-auto h-12 w-12 text-[#c4c4cc]" strokeWidth={1.25} />
                      <p className="mt-3 text-[14px] text-[#9a9aa5]">
                        No Purchase Orders available, Create new purchase order
                      </p>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.id} className="hover:bg-[#fafafa]">
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 font-semibold text-[var(--color-primary)]">
                        {r.po_number || `PO-${r.id}`}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 text-[#4a4a55]">
                        {fmtDate(r.order_date)}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3">
                        {r.vendor_name || "—"}
                      </td>
                      <td className="border-t border-r border-[#d0d0d8] px-4 py-3 tabular-nums font-medium">
                        {r.total_amount != null ? formatInr(r.total_amount) : "—"}
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
                              onClick: () => setSelected(r),
                            },
                            {
                              label: "Edit",
                              icon: <Edit2 className="h-4 w-4" />,
                              onClick: () => navigate(`/procurement/purchase-orders/${r.id}/edit`),
                            },
                            {
                              label: "Create GRN",
                              icon: <Plus className="h-4 w-4" />,
                              onClick: () =>
                                navigate(`/procurement/goods-receipt/create?po_id=${r.id}`),
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
              <FilterSection label="Status">
                {[
                  { id: "", label: "All" },
                  { id: "draft", label: "Draft" },
                  { id: "pending", label: "Pending" },
                  { id: "approved", label: "Approved" },
                  { id: "received", label: "Received" },
                  { id: "delivered", label: "Delivered" },
                  { id: "cancelled", label: "Cancelled" },
                ].map((opt) => (
                  <Chip
                    key={opt.id || "all"}
                    label={opt.label}
                    active={draftFilters.status === opt.id}
                    onClick={() => setDraftFilters((f) => ({ ...f, status: opt.id }))}
                  />
                ))}
              </FilterSection>
              <FilterSection label="Vendor">
                <input
                  value={draftFilters.vendor}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, vendor: e.target.value }))}
                  placeholder="Search"
                  className="w-full rounded-lg border border-[#e4e4ea] bg-white px-3 py-2.5 text-[13px] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25"
                />
              </FilterSection>
            </div>
            <div className="flex gap-2 border-t border-[#e4e4ea] px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setDraftFilters(EMPTY_FILTERS);
                  setFilters(EMPTY_FILTERS);
                  setShowFilters(false);
                }}
                className="flex-1 rounded-lg border border-[#e4e4ea] py-2.5 text-[13px] font-semibold text-[#4a4a55]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters(draftFilters);
                  setShowFilters(false);
                }}
                className="flex-1 rounded-lg bg-[var(--color-primary)] py-2.5 text-[13px] font-semibold text-white"
              >
                Apply
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {selected ? (
        <PODetailModal
          po={selected}
          onClose={() => setSelected(null)}
          onApprove={(po) => handleStatus(po, "approved")}
          onReject={(po) => handleStatus(po, "cancelled")}
        />
      ) : null}
    </div>
  );
}
