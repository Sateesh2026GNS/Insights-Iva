import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  ListFilter,
  Plus,
  Trash2,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { SearchBar } from "../../components/common/SearchFilter";
import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import RowActionMenu from "../../components/common/RowActionMenu";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { deleteBizDocument, listBizDocuments } from "../../api/bizDocumentsApi";
import { apiErrorMessage } from "../../utils/apiError";
import { formatInr } from "../../data/salesMasterData";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { InlineNativeDateRange } from "../../design-system/dateControls";

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

function SummaryTab({ label, count, amount, active, onClick, tone }) {
  const tones = {
    blue: { border: "border-blue-600", surface: "bg-blue-100", label: "text-blue-700", count: "text-blue-500", value: "text-blue-900" },
    emerald: { border: "border-emerald-600", surface: "bg-emerald-100", label: "text-emerald-700", count: "text-emerald-600", value: "text-emerald-900" },
    violet: { border: "border-violet-600", surface: "bg-violet-100", label: "text-violet-700", count: "text-violet-600", value: "text-violet-900" },
    amber: { border: "border-amber-500", surface: "bg-amber-100", label: "text-amber-700", count: "text-amber-600", value: "text-amber-900" },
    cyan: { border: "border-cyan-600", surface: "bg-cyan-100", label: "text-cyan-700", count: "text-cyan-600", value: "text-cyan-900" },
  };
  const colors = tones[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ boxSizing: "border-box", width: 170, minWidth: 170, flex: "0 0 170px" }}
      className={`min-w-[125px] flex-none border-b-[3px] px-4 py-2.5 text-left transition duration-150 cursor-pointer ${
        active
          ? `${colors.border} ${colors.surface} ${colors.label}`
          : "border-transparent bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface)]/80"
      }`}
    >
      <p className={`text-xs sm:text-[13px] font-medium transition-colors ${active ? colors.label : "text-[var(--color-text)]"}`}>
        {label} <span className={active ? `${colors.count} opacity-80` : "text-[var(--color-text-muted)]"}>({count})</span>
      </p>
      <p
        className={`mt-1 text-[18px] font-bold tabular-nums transition-colors ${
          active ? colors.value : "text-[var(--color-text)]"
        }`}
      >
        {amount}
      </p>
    </button>
  );
}

export default function PaymentsMade() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [kpiFilter, setKpiFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("2026-04-01");
  const [dateTo, setDateTo] = useState("2027-03-31");
  const [showSort, setShowSort] = useState(false);
  const [sortId, setSortId] = useState("date_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to load payments made"), "error");
      setRows([]);


    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async () => {
    if (!deleteTarget?.id || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteBizDocument(deleteTarget.id);
      addToast("Payment deleted", "success");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete payment"), "error");
    } finally {
      setDeleteBusy(false);
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
      if (kpiFilter && kpiFilter !== "all" && r.method !== kpiFilter) return false;
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
    <div className="min-h-full space-y-0 bg-[var(--color-bg)] p-4 sm:p-6">
      <div className="flex flex-col gap-3">
        <div className="sm:ml-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <InlineNativeDateRange
            from={dateFrom}
            to={dateTo}
            fromId="payments-made-from-date"
            toId="payments-made-to-date"
            onFromChange={(value) => {
              setDateFrom(value);
              setPage(1);
            }}
            onToChange={(value) => {
              setDateTo(value);
              setPage(1);
            }}
          />
          <Button
            variant="add"
            to="/purchases/payments-made/create"
            className="h-[42px] w-full justify-center sm:w-auto"
            leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
          >
            Make Payment
          </Button>
        </div>

        <div className="w-fit max-w-full overflow-hidden rounded-xl border border-[var(--color-table-border)] bg-[var(--color-surface-muted)]">
          <div className="flex overflow-x-auto scrollbar-none" role="tablist" aria-label="Payment method">
          {MODE_TABS.map((t) => (
            <SummaryTab
              key={t.id}
              label={t.label}
              count={tabStats[t.id]?.count || 0}
              amount={formatInr(tabStats[t.id]?.amount || 0)}
              tone={{ all: "blue", cash: "emerald", cheque: "violet", net_banking: "amber", upi: "cyan" }[t.id]}
              active={kpiFilter === t.id}
              onClick={() => setKpiFilter(t.id)}
            />
          ))}
        </div>
        </div>
      </div>

      <section className="ui-list-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search"
            className="w-full sm:max-w-[420px]"
            inputClassName="pending-inventory-search-input"
          />
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSort((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-surface-muted)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-text-secondary)]"
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
                  <div className="absolute right-0 z-20 mt-1.5 w-[280px] overflow-hidden rounded-xl border border-[var(--color-table-border)] bg-[var(--color-surface)] py-1 shadow-lg">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSortId(opt.id);
                          setShowSort(false);
                        }}
                        className={`block w-full px-4 py-2.5 text-left text-[13px] hover:bg-[var(--color-surface-hover)] ${
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

        <div className="overflow-hidden rounded-xl border border-[var(--color-table-border)] bg-[var(--color-surface)]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-[13px]">
              <thead className="ui-table-head">
                <tr>
                  <SerialNumberHeader className="border-b border-r border-[var(--color-table-border)]" />
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
                    <td colSpan={8} className="border-none p-0">
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
                      <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 font-semibold text-[var(--color-success)]">
                        {r.receipt_number}
                      </td>
                      <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[var(--color-text-secondary)]">
                        {fmtDate(r.payment_date)}
                      </td>
                      <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3">
                        {r.party_name}
                      </td>
                      <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3">
                        {modeLabel(r.method)}
                      </td>
                      <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 tabular-nums font-medium">
                        {formatInr(r.amount)}
                      </td>
                      <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 tabular-nums">
                        {formatInr(r.advance_amount)}
                      </td>
                      <td className="border-t border-[var(--color-table-border)] px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <RowActionMenu
                            rowId={r.id}
                            openMenu={openMenu}
                            setOpenMenu={setOpenMenu}
                            items={[
                              {
                                label: "View Receipt",
                                icon: <Eye className="h-4 w-4" />,
                                onClick: () =>
                                  navigate(`/purchases/payments-made/${r.id}/edit`, {
                                    state: { viewId: r.id, payment: r, readOnly: true },
                                  }),
                              },
                              {
                                label: "Edit",
                                icon: <Edit2 className="h-4 w-4" />,
                                onClick: () =>
                                  navigate(`/purchases/payments-made/${r.id}/edit`, {
                                    state: { viewId: r.id, payment: r, readOnly: false },
                                  }),
                              },
                              { divider: true },
                              {
                                label: "Delete",
                                icon: <Trash2 className="h-4 w-4" />,
                                danger: true,
                                onClick: () => setDeleteTarget(r),
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
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete payment"
        message={`Delete payment ${deleteTarget?.receipt_number}? This cannot be undone.`}
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
