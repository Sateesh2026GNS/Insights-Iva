import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Calendar, ChevronDown, ChevronLeft, ChevronRight, Plus, RotateCcw, Search, X } from "lucide-react";

import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getPayments } from "../../api/salesApi";
import {
  createBizDocument,
  deleteBizDocument,
  listBizDocuments,
} from "../../api/bizDocumentsApi";
import { inputClass } from "../../design-system/classes";
import { apiErrorMessage } from "../../utils/apiError";
import {
  fetchCustomersWithFallback,
  filterCustomers,
} from "../../utils/customerOptions";
import { formatInr } from "../../data/salesMasterData";

const YELLOW = "var(--color-primary)";
const PAGE_SIZES = [10, 25, 50];

function mapDocToRow(doc) {
  const meta = doc.meta || {};
  return {
    id: doc.id,
    voucher_number: doc.document_number,
    voucher_date: doc.document_date,
    created_at: doc.created_at,
    amount: Number(doc.amount) || 0,
    party_id: meta.party_id,
    party_name: doc.party_name,
    refunded_to: meta.refunded_to || doc.party_name || "—",
    paid_from: meta.paid_from || "—",
  };
}

function parsePaymentMeta(notes) {
  try {
    if (notes && String(notes).startsWith("{")) return JSON.parse(notes);
  } catch {
    /* ignore */
  }
  return {};
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso).slice(0, 10);
  return `${d}/${m}/${y}`;
}

function toInputDate(iso) {
  return String(iso || new Date().toISOString()).slice(0, 10);
}

function CreateRefundVoucherModal({
  open,
  onClose,
  onSave,
  customers,
  unusedByParty,
  nextNumber,
}) {
  const [voucherDate, setVoucherDate] = useState(toInputDate());
  const [prefix, setPrefix] = useState("");
  const [voucherNo, setVoucherNo] = useState("1");
  const [partyId, setPartyId] = useState("");
  const [partyOpen, setPartyOpen] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [amount, setAmount] = useState("");
  const [paidFrom, setPaidFrom] = useState("Cash");

  useEffect(() => {
    if (!open) return;
    setVoucherDate(toInputDate());
    setPrefix("");
    setVoucherNo(String(nextNumber || 1));
    setPartyId("");
    setPartyOpen(false);
    setPartySearch("");
    setAmount("");
    setPaidFrom("Cash");
  }, [open, nextNumber]);

  if (!open) return null;

  const selected = customers.find((c) => String(c.id) === String(partyId));
  const unused = partyId ? Number(unusedByParty[String(partyId)] || 0) : 0;
  const canRefund = Boolean(partyId) && unused > 0;
  const filtered = filterCustomers(customers, partySearch);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canRefund) return;
          const refundAmt = Number(amount) || 0;
          if (refundAmt <= 0 || refundAmt > unused) return;
          onSave?.({
            id: `rv-${Date.now()}`,
            voucher_number: [prefix, voucherNo].filter(Boolean).join("") || `RV-${voucherNo}`,
            prefix,
            voucher_no: voucherNo,
            voucher_date: voucherDate,
            party_id: partyId,
            party_name: selected?.name || "—",
            amount: refundAmt,
            refunded_to: selected?.name || "—",
            paid_from: paidFrom,
            created_at: new Date().toISOString(),
          });
          onClose?.();
        }}
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#d0d0d8] px-5 py-4">
          <h2 className="text-[17px] font-bold text-[#1a1a1f]">Create Refund Voucher</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#9a9aa5]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr] gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
                Voucher Date
              </span>
              <div className="relative">
                <input
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">Prefix</span>
              <input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
                Voucher No.
              </span>
              <input
                value={voucherNo}
                onChange={(e) => setVoucherNo(e.target.value)}
                className={`${inputClass} bg-[#f0f0f4]`}
              />
            </label>
          </div>

          <div className="relative">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
              Party name
            </span>
            <button
              type="button"
              onClick={() => setPartyOpen((v) => !v)}
              className={`${inputClass} flex items-center justify-between text-left`}
            >
              <span className={selected ? "text-[#1a1a1f]" : "text-[#a0a0ab]"}>
                {selected?.name || "Select Buyer"}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[#6b6b76] transition ${partyOpen ? "rotate-180" : ""}`}
              />
            </button>
            {partyOpen ? (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-hidden rounded-xl border border-[#d0d0d8] bg-white shadow-lg">
                <div className="border-b border-[#ececf0] p-2">
                  <input
                    autoFocus
                    value={partySearch}
                    onChange={(e) => setPartySearch(e.target.value)}
                    placeholder="Search"
                    className="w-full rounded-lg border border-[#e4e4ea] px-3 py-2 text-[13px] outline-none"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-4 text-center text-[13px] text-[#8a8a95]">No parties</p>
                  ) : (
                    filtered.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setPartyId(c.id);
                          setPartyOpen(false);
                          setAmount("");
                        }}
                        className="block w-full px-3 py-2.5 text-left text-[13px] hover:bg-[#f7f7f9]"
                      >
                        {c.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {partyId ? (
            <>
              <div className="border-t border-[#ececf0]" />
              {!canRefund ? (
                <div className="space-y-3 py-2">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1a1a1f] text-white">
                      <AlertCircle className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[15px] font-bold text-[#1a1a1f]">Refund Not Available</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-[#4a4a55]">
                        A refund voucher cannot be created as the{" "}
                        <span className="font-semibold">
                          “Unused amount balance is ₹0”
                        </span>
                        . To process a refund, the unused amount must be greater than ₹0.
                      </p>
                    </div>
                  </div>
                  <div className="pl-10">
                    <p className="text-[13px] text-[#4a4a55]">Unused Amount Balance :</p>
                    <p className="mt-1 text-[18px] font-bold text-[#1a1a1f]">₹ 0</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl bg-[#f7f7f9] px-4 py-3">
                    <p className="text-[12px] text-[#6b6b76]">Unused Amount Balance</p>
                    <p className="mt-0.5 text-[18px] font-bold tabular-nums text-[#1a1a1f]">
                      {formatInr(unused)}
                    </p>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
                      Refund Amount
                    </span>
                    <input
                      required
                      value={amount}
                      onChange={(e) =>
                        setAmount(e.target.value.replace(/[^\d.]/g, ""))
                      }
                      placeholder="Enter amount"
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
                      Paid From
                    </span>
                    <select
                      value={paidFrom}
                      onChange={(e) => setPaidFrom(e.target.value)}
                      className={inputClass}
                    >
                      <option>Cash</option>
                      <option>Bank</option>
                      <option>UPI</option>
                    </select>
                  </label>
                </div>
              )}
            </>
          ) : null}
        </div>

        {canRefund ? (
          <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#d0d0d8] px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#d8d8e0] bg-[#f0f0f4] py-3 text-[14px] font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl py-3 text-[14px] font-semibold text-white"
              style={{ background: YELLOW }}
            >
              Save
            </button>
          </div>
        ) : null}
      </form>
    </div>,
    document.body
  );
}

export default function RefundVouchers() {
  const { addToast } = useToast();
  const tenantId = useTenantId();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [unusedByParty, setUnusedByParty] = useState({});
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("2026-04-01");
  const [dateTo, setDateTo] = useState("2027-03-31");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [custRes, payRes, docRes] = await Promise.allSettled([
        fetchCustomersWithFallback(),
        getPayments(tenantId),
        listBizDocuments({
          module: "sales",
          doc_type: "refund_voucher",
          page: 1,
          page_size: 200,
        }),
      ]);


      setCustomers(custRes.status === "fulfilled" ? custRes.value || [] : []);
      const payments = payRes.status === "fulfilled" ? payRes.value?.data || [] : [];
      const map = {};
      for (const p of payments) {
        const meta = parsePaymentMeta(p.notes);
        const key = String(meta.party_id || meta.customer_id || meta.party_name || "");
        if (!key) continue;
        const unused = Number(meta.unused_amount) || 0;
        if (!map[key]) map[key] = 0;
        map[key] += unused;
        if (meta.party_name) {
          const nameKey = `name:${String(meta.party_name).toLowerCase()}`;
          map[nameKey] = (map[nameKey] || 0) + unused;
        }
      }
      const custs = custRes.status === "fulfilled" ? custRes.value || [] : [];
      for (const c of custs) {
        const byName = map[`name:${String(c.name || "").toLowerCase()}`] || 0;
        map[String(c.id)] = (map[String(c.id)] || 0) + byName;
      }
      setUnusedByParty(map);
      const items =
        docRes.status === "fulfilled"
          ? docRes.value?.data?.items || docRes.value?.data || []
          : [];
      setRows((Array.isArray(items) ? items : []).map(mapDocToRow));
    } catch {
      addToast("Failed to load refund vouchers", "error");
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
  }, [search, dateFrom, dateTo, pageSize]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (q) {
          const hay = `${r.voucher_number} ${r.party_name} ${r.paid_from}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        const d = String(r.voucher_date || r.created_at || "").slice(0, 10);
        if (dateFrom && d && d < dateFrom) return false;
        if (dateTo && d && d > dateTo) return false;
        return true;
      })
      .sort((a, b) =>
        String(b.voucher_date || b.created_at || "").localeCompare(
          String(a.voucher_date || a.created_at || "")
        )
      );
  }, [rows, search, dateFrom, dateTo]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const nextNumber = rows.length + 1;

  const handleSave = async (voucher) => {
    try {
      await createBizDocument({
        module: "sales",
        doc_type: "refund_voucher",
        document_number: voucher.voucher_number,
        party_name: voucher.party_name || voucher.refunded_to,
        document_date: voucher.voucher_date,
        amount: voucher.amount,
        status: "issued",
        meta: {
          party_id: voucher.party_id,
          refunded_to: voucher.refunded_to,
          paid_from: voucher.paid_from,
          prefix: voucher.prefix,
          voucher_no: voucher.voucher_no,
        },
      });
      addToast("Refund voucher created", "success");
      setCreateOpen(false);
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to create refund voucher"), "error");
    }
  };

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm("Delete this refund voucher?")) return;
    try {
      await deleteBizDocument(row.id);
      addToast("Refund voucher deleted", "success");
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete refund voucher"), "error");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[var(--color-bg)]">
        <Loader label="Loading refund vouchers..." />
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-4 bg-[var(--color-bg)] p-4 sm:p-6">

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white"
            style={{ background: YELLOW }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> New Refund Voucher
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-[13px]">
            <thead className="bg-[#f3f3f6] text-[12px] font-semibold uppercase tracking-wide text-[#6b6b76]">
              <tr>
                <SerialNumberHeader className="border-b border-r border-[#d0d0d8]" />
                <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Voucher No.</th>
                <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Date Created</th>
                <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Amount</th>
                <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Refunded to</th>
                <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Paid From</th>
                <th className="border-b border-r border-[#d0d0d8] px-4 py-3 last:border-r-0">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <RotateCcw className="mx-auto h-12 w-12 text-[#c4c4cc]" />
                    <p className="mt-3 text-[14px] text-[#6b6b76]">
                      No refund vouchers available, Create new refund voucher
                    </p>
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white"
                      style={{ background: YELLOW }}
                    >
                      <Plus className="h-4 w-4" /> New Refund Voucher
                    </button>
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
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3 font-semibold text-[var(--color-primary)]">{r.voucher_number}</td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3 text-[#4a4a55]">
                      {fmtDate(r.voucher_date || r.created_at)}
                    </td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3 tabular-nums font-medium">{formatInr(r.amount)}</td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3">{r.refunded_to}</td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3">{r.paid_from}</td>
                    <td className="border-t border-r border-[#d0d0d8] px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        className="text-[12px] font-semibold text-[#dc2626] hover:underline"
                      >
                        Delete
                      </button>
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

      <CreateRefundVoucherModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleSave}
        customers={customers}
        unusedByParty={unusedByParty}
        nextNumber={nextNumber}
      />
    </div>
  );
}
