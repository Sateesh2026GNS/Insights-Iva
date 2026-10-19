import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link, useNavigate } from "react-router-dom";
import {
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
import EmptyState from "../../components/common/EmptyState";
import { SearchBar } from "../../components/common/SearchFilter";
import Button from "../../components/common/Button";
import RowActionMenu from "../../components/common/RowActionMenu";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { ListPageShell } from "../../components/common/ListPageShell";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { useToast } from "../../context/ToastContext";
import { cancelInvoice, getInvoicesV2 } from "../../api/salesApi";
import { apiErrorMessage } from "../../utils/apiError";
import { formatInr } from "../../data/salesMasterData";
import { runListExport } from "../../utils/listExport";
import { InlineNativeDateRange } from "../../design-system/dateControls";

const CHALLAN_EXPORT_COLUMNS = [
  { key: "challan_no", label: "Challan No." },
  { key: "challan_date", label: "Date" },
  { key: "buyer_name", label: "Buyer Name" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
];

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

function SummaryTab({ label, count, amount, active, onClick, tone }) {
  const tones = {
    blue: { border: "border-blue-600", surface: "bg-blue-100", label: "text-blue-700", count: "text-blue-500", value: "text-blue-900" },
    amber: { border: "border-amber-500", surface: "bg-amber-100", label: "text-amber-700", count: "text-amber-600", value: "text-amber-900" },
    emerald: { border: "border-emerald-600", surface: "bg-emerald-100", label: "text-emerald-700", count: "text-emerald-600", value: "text-emerald-900" },
    rose: { border: "border-rose-600", surface: "bg-rose-100", label: "text-rose-700", count: "text-rose-600", value: "text-rose-900" },
  };
  const colors = tones[tone] || tones.blue;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{ boxSizing: "border-box", width: 170, minWidth: 170, flex: "0 0 170px" }}
      className={`relative min-w-[125px] flex-none border-b-[3px] px-4 py-2.5 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-slate-300 after:content-[''] last:after:hidden sm:px-5 sm:py-2 text-left transition duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
        active
          ? `${colors.border} ${colors.surface} ${colors.label} shadow-sm`
          : "border-transparent bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface)]/80"
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

function deliveryStatus(row) {
  const s = String(row.status || row.payment_status || "").toLowerCase();
  if (s === "delivered" || s === "shipped" || s === "completed") return "delivered";
  return "undelivered";
}

function isConverted(row) {
  return Boolean(row.converted_to_invoice || row.sales_order_id);
}

export default function DeliveryChallans() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState(null);
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
      all: { count: rows.length, amount: sum(rows) },
      delivered: { count: delivered.length, amount: sum(delivered) },
      undelivered: { count: undelivered.length, amount: sum(undelivered) },
    };
  }, [rows]);

  const handleExport = (format) => {
    const exportRows = filteredSorted.map((r) => ({
      challan_no: r.invoice_number,
      challan_date: fmtDate(r.issue_date),
      buyer_name: r.customer_name || "—",
      amount: r.grand_total ?? r.total_amount ?? 0,
      status: deliveryStatus(r),
    }));
    runListExport(format, {
      data: exportRows,
      columns: CHALLAN_EXPORT_COLUMNS,
      filename: "delivery-challans",
      title: "Delivery Challans",
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

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
      <ListPageShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader label="Loading delivery challans..." />
        </div>
      </ListPageShell>
    );
  }

  return (
    <ListPageShell stackClassName="!gap-0 space-y-0">
      <div className="flex flex-col gap-3">
        <div className="sm:ml-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <InlineNativeDateRange
            from={dateFrom}
            to={dateTo}
            fromId="delivery-challan-from-date"
            toId="delivery-challan-to-date"
            onFromChange={(value) => {
              setDateFrom(value);
              setPage(1);
            }}
            onToChange={(value) => {
              setDateTo(value);
              setPage(1);
            }}
          />
          <Link
            to="/sales/delivery-challans/create"
            className="inline-flex h-[42px] px-3.5 items-center justify-center gap-1 rounded-lg bg-[var(--color-primary,#2563eb)] text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            Delivery Challan
          </Link>
        </div>

        <div className="w-fit max-w-full overflow-hidden rounded-xl border border-[var(--color-table-border)] bg-[var(--color-surface-muted)]">
          <div className="flex overflow-x-auto scrollbar-none" role="tablist" aria-label="Delivery challan status">
            <SummaryTab
              label="All Challans"
              count={tabStats.all.count}
              amount={formatInr(tabStats.all.amount)}
              tone="blue"
              active={kpiFilter === "all"}
              onClick={() => setKpiFilter("all")}
            />
            <SummaryTab
              label="Delivered"
              count={tabStats.delivered.count}
              amount={formatInr(tabStats.delivered.amount)}
              tone="emerald"
              active={kpiFilter === "delivered"}
              onClick={() => setKpiFilter((c) => (c === "delivered" ? "all" : "delivered"))}
            />
            <SummaryTab
              label="Undelivered"
              count={tabStats.undelivered.count}
              amount={formatInr(tabStats.undelivered.amount)}
              tone="amber"
              active={kpiFilter === "undelivered"}
              onClick={() => setKpiFilter((c) => (c === "undelivered" ? "all" : "undelivered"))}
            />
          </div>
        </div>
      </div>

      <section className="ui-list-card mt-3 space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="Search" />
          <div className="flex items-center gap-2 shrink-0">
            <ExportDownloadMenu disabled={!filteredSorted.length} onExport={handleExport} />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1 sm:flex-initial"
              onClick={() => {
                setDraftFilters(filters);
                setShowFilters(true);
              }}
              leftIcon={<Filter className="h-4 w-4" aria-hidden />}
            >
              Filters
            </Button>
            <div className="relative flex-1 sm:flex-initial">
              <Button
                type="button"
                variant={showSort ? "outline" : "secondary"}
                size="sm"
                className="w-full"
                onClick={() => setShowSort((v) => !v)}
                leftIcon={<ListFilter className="h-4 w-4" aria-hidden />}
              >
                Sort by
              </Button>
              {showSort ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Close sort"
                    onClick={() => setShowSort(false)}
                  />
                  <div className="absolute right-0 z-20 mt-1.5 w-[240px] overflow-hidden rounded-xl border border-[var(--color-table-border)] bg-[var(--color-surface)] py-1 shadow-lg">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSortId(opt.id);
                          setShowSort(false);
                        }}
                        className={`block w-full px-4 py-2.5 text-left text-[13px] hover:bg-[var(--color-surface-hover)] ${
                          sortId === opt.id ? "font-semibold text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"
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
                  <SerialNumberHeader className="border-b border-r border-[var(--color-table-border)]" />
                  <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Challan No.</th>
                  <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Date</th>
                  <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Buyer Name</th>
                  <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Amount</th>
                  <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Status</th>
                  <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Actions</th>
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
                  pageRows.map((r, rowIndex) => (
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
                      <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[var(--color-text-secondary)]">{fmtDate(r.issue_date)}</td>
                      <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3">{r.customer_name || "—"}</td>
                      <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 tabular-nums font-medium">
                        {formatInr(r.grand_total ?? r.total_amount ?? 0)}
                      </td>
                      <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 capitalize text-[var(--color-text-secondary)]">
                        {deliveryStatus(r)}
                      </td>
                      <td className="border-t border-r border-[var(--color-table-border)] px-4 py-2 last:border-r-0" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <RowActionMenu
                            rowId={r.id}
                            openMenu={openMenu}
                            setOpenMenu={setOpenMenu}
                            items={[
                              {
                                label: "View / Print",
                                icon: <Eye className="h-4 w-4" />,
                                onClick: () => navigate(`/sales/delivery-challans/${r.id}/edit`),
                              },
                              {
                                label: "Edit",
                                icon: <Edit2 className="h-4 w-4" />,
                                onClick: () => navigate(`/sales/delivery-challans/${r.id}/edit`),
                              },
                              { divider: true },
                              {
                                label: "Delete",
                                icon: <Trash2 className="h-4 w-4" />,
                                danger: true,
                                onClick: async () => {
                                  if (!window.confirm(`Delete delivery challan ${r.invoice_number}?`)) return;
                                  try {
                                    await cancelInvoice(r.id);
                                    addToast("Delivery challan deleted successfully", "success");
                                    load();
                                  } catch (err) {
                                    addToast(apiErrorMessage(err, "Failed to delete delivery challan"), "error");
                                  }
                                },
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
              {total === 0 ? "0–0 of 0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
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
            <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-table-border)] px-5 py-4">
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
