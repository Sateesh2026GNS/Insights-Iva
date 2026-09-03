import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Info,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import RowActionMenu from "../../components/common/RowActionMenu";
import { SearchBar } from "../../components/common/SearchFilter";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getPayments } from "../../api/salesApi";
import {
  createBizDocument,
  deleteBizDocument,
  listBizDocuments,
  updateBizDocument,
} from "../../api/bizDocumentsApi";
import { getCompanySettings } from "../../api/settingsApi";
import { inputClass } from "../../design-system/classes";
import { apiErrorMessage } from "../../utils/apiError";
import {
  fetchCustomersWithFallback,
  filterCustomers,
} from "../../utils/customerOptions";
import { formatInr } from "../../data/salesMasterData";
import { numberToWordsInr } from "../../utils/invoiceCopyData";
import { exportToCsv, exportToExcel, exportToPdf } from "../../utils/exportUtils";

const PAGE_SIZES = [10, 25, 50];

const PAYMENT_MODES = [
  "Cash",
  "Bank Transfer / NEFT / RTGS",
  "UPI / Online",
  "Cheque",
];

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
    paid_from: meta.paid_from || meta.payment_mode || "Cash",
    payment_mode: meta.payment_mode || meta.paid_from || "Cash",
    account_name: meta.account_name || "",
    reference_no: meta.reference_no || meta.transaction_id || "",
    linked_receipt_no: meta.linked_receipt_no || "",
    place_of_supply: meta.place_of_supply || "",
    customer_gstin: meta.customer_gstin || "",
    prefix: meta.prefix || "RV-",
    voucher_no: meta.voucher_no || "",
    notes: meta.notes || meta.remark || doc.notes || "",
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

function fmtDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso).slice(0, 10);
  return `${d}/${m}/${y}`;
}

function toInputDate(iso) {
  return String(iso || new Date().toISOString()).slice(0, 10);
}

function SummaryTab({ label, count, amount, active, onClick, badgeColor }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 flex-1 border-b-[3px] px-4 py-3 text-left transition duration-150 cursor-pointer ${
        active
          ? "border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-primary)]"
          : "border-transparent bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]/80 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-[12px] font-medium transition-colors ${active ? "font-semibold" : "text-[var(--color-text-muted)]"}`}>
          {label}
        </p>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            badgeColor || "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]"
          }`}
        >
          {count}
        </span>
      </div>
      <p
        className={`mt-1 text-[16px] font-bold tabular-nums transition-colors ${
          active ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"
        }`}
      >
        {amount}
      </p>
    </button>
  );
}

function CreateEditRefundVoucherModal({
  open,
  editData,
  onClose,
  onSave,
  customers,
  unusedByParty,
  advanceReceiptsByParty,
  nextNumber,
}) {
  const [voucherDate, setVoucherDate] = useState(toInputDate());
  const [prefix, setPrefix] = useState("RV-");
  const [voucherNo, setVoucherNo] = useState("1");
  const [partyId, setPartyId] = useState("");
  const [partyOpen, setPartyOpen] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [amount, setAmount] = useState("");
  const [paidFrom, setPaidFrom] = useState("Cash");
  const [accountName, setAccountName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [linkedReceiptNo, setLinkedReceiptNo] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [notes, setNotes] = useState("");

  const isEdit = Boolean(editData?.id);

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setVoucherDate(toInputDate(editData.voucher_date || editData.created_at));
      setPrefix(editData.prefix || "RV-");
      setVoucherNo(String(editData.voucher_no || editData.voucher_number?.replace(/^RV-?/i, "") || "1"));
      setPartyId(editData.party_id || "");
      setPartyOpen(false);
      setPartySearch("");
      setAmount(String(editData.amount || ""));
      setPaidFrom(editData.paid_from || editData.payment_mode || "Cash");
      setAccountName(editData.account_name || "");
      setReferenceNo(editData.reference_no || "");
      setLinkedReceiptNo(editData.linked_receipt_no || "");
      setPlaceOfSupply(editData.place_of_supply || "");
      setNotes(editData.notes || "");
    } else {
      setVoucherDate(toInputDate());
      setPrefix("RV-");
      setVoucherNo(String(nextNumber || 1));
      setPartyId("");
      setPartyOpen(false);
      setPartySearch("");
      setAmount("");
      setPaidFrom("Cash");
      setAccountName("");
      setReferenceNo("");
      setLinkedReceiptNo("");
      setPlaceOfSupply("");
      setNotes("");
    }
  }, [open, editData, nextNumber]);

  if (!open) return null;

  const selected = customers.find((c) => String(c.id) === String(partyId));
  const selectedName = selected?.name || selected?.company || (editData?.party_name || "");
  const nameKey = `name:${selectedName.trim().toLowerCase()}`;
  const unused = partyId ? Number(unusedByParty[String(partyId)] ?? unusedByParty[nameKey] ?? 0) : 0;
  const availableReceipts = (partyId ? (advanceReceiptsByParty[String(partyId)] || advanceReceiptsByParty[nameKey] || []) : []);
  const numericAmount = Number(amount) || 0;
  const remainingAdvance = Math.max(0, unused - numericAmount);
  const filtered = filterCustomers(customers, partySearch);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!partyId && !selectedName) return;
    const refundAmt = Number(amount) || 0;
    if (refundAmt <= 0) return;

    const fullVoucherNumber =
      [prefix, voucherNo].filter(Boolean).join("") || `RV-${voucherNo}`;

    onSave?.({
      ...(editData || {}),
      id: editData?.id || undefined,
      voucher_number: fullVoucherNumber,
      prefix,
      voucher_no: voucherNo,
      voucher_date: voucherDate,
      party_id: partyId || editData?.party_id,
      party_name: selectedName || "—",
      refunded_to: selectedName || "—",
      amount: refundAmt,
      paid_from: paidFrom,
      payment_mode: paidFrom,
      account_name: accountName,
      reference_no: referenceNo,
      linked_receipt_no: linkedReceiptNo,
      place_of_supply: placeOfSupply || selected?.state || "",
      customer_gstin: selected?.gstin || editData?.customer_gstin || "",
      notes,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#d0d0d8] dark:border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400">
              <RotateCcw className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[#1a1a1f] dark:text-slate-100">
                {isEdit ? "Edit Refund Voucher" : "Create Refund Voucher"}
              </h2>
              <p className="text-[11px] text-[#6b6b76] dark:text-slate-400">
                Issue refund against customer advance / overpayment
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-1.5 text-[#9a9aa5] hover:bg-slate-100 hover:text-[#1a1a1f] dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
          >
            <X className="h-5 w-5 pointer-events-none" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Voucher Date & Number */}
          <div className="grid grid-cols-[1.3fr_0.7fr_0.8fr] gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76] dark:text-slate-300">
                Voucher Date
              </span>
              <input
                type="date"
                required
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76] dark:text-slate-300">
                Prefix
              </span>
              <input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="RV-"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76] dark:text-slate-300">
                Voucher No.
              </span>
              <input
                required
                value={voucherNo}
                onChange={(e) => setVoucherNo(e.target.value)}
                placeholder="0001"
                className={inputClass}
              />
            </label>
          </div>

          {/* Party Selection */}
          <div className="relative">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76] dark:text-slate-300">
              Party / Buyer Name <span className="text-red-500">*</span>
            </span>
            <button
              type="button"
              onClick={() => setPartyOpen((v) => !v)}
              className={`${inputClass} flex items-center justify-between text-left cursor-pointer`}
            >
              <span className={selectedName ? "font-medium text-[#1a1a1f] dark:text-slate-100" : "text-[#a0a0ab]"}>
                {selectedName || "Select Buyer to Refund"}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[#6b6b76] transition ${partyOpen ? "rotate-180" : ""}`}
              />
            </button>
            {partyOpen ? (
              <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-hidden rounded-xl border border-[#d0d0d8] bg-white dark:bg-slate-900 dark:border-slate-700 shadow-xl">
                <div className="border-b border-[#ececf0] dark:border-slate-800 p-2">
                  <SearchBar
                    size="compact"
                    value={partySearch}
                    onChange={setPartySearch}
                    placeholder="Search party by name or company..."
                    autoFocus
                    className="w-full"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-4 text-center text-[13px] text-[#8a8a95]">No parties found</p>
                  ) : (
                    filtered.map((c) => {
                      const cName = c.company || c.name;
                      const cUnused = Number(unusedByParty[String(c.id)] ?? unusedByParty[`name:${(c.name || "").trim().toLowerCase()}`] ?? 0);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setPartyId(c.id);
                            setPartyOpen(false);
                            if (cUnused > 0 && !amount) {
                              setAmount(String(cUnused));
                            }
                            if (c.state && !placeOfSupply) {
                              setPlaceOfSupply(c.state);
                            }
                          }}
                          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] hover:bg-[#f7f7f9] dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        >
                          <div>
                            <span className="font-semibold text-[#1a1a1f] dark:text-slate-100">{cName}</span>
                            {c.gstin ? (
                              <span className="ml-2 text-[10px] text-slate-500">GST: {c.gstin}</span>
                            ) : null}
                          </div>
                          {cUnused > 0 ? (
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Advance: {formatInr(cUnused)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#9a9aa5]">₹0 advance</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Advance Details & Notice */}
          {partyId || selectedName ? (
            <div className="space-y-3">
              {unused > 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:bg-emerald-950/20 dark:border-emerald-800/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                        Available Unused Advance
                      </p>
                      <p className="text-[18px] font-bold tabular-nums text-emerald-900 dark:text-emerald-200">
                        {formatInr(unused)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAmount(String(unused))}
                      className="cursor-pointer rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[12px] font-bold text-emerald-700 shadow-xs hover:bg-emerald-50 dark:bg-slate-900 dark:border-emerald-700 dark:text-emerald-300"
                    >
                      Refund Full Balance
                    </button>
                  </div>
                  {numericAmount > 0 ? (
                    <div className="mt-2 flex items-center justify-between border-t border-emerald-200/80 pt-2 text-[11px] text-emerald-800 dark:border-emerald-800/40 dark:text-emerald-300">
                      <span>Remaining Balance After Refund:</span>
                      <strong className="font-semibold tabular-nums">{formatInr(remainingAdvance)}</strong>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50/60 px-3.5 py-2.5 text-[12px] text-blue-900 dark:bg-blue-950/30 dark:border-blue-900/60 dark:text-blue-300">
                  <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>No recorded unallocated advance found. You can enter any custom refund amount below.</span>
                </div>
              )}

              {/* Linked Advance Receipt (optional) */}
              {availableReceipts.length > 0 ? (
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76] dark:text-slate-300">
                    Linked Advance Payment Receipt (Optional)
                  </span>
                  <select
                    value={linkedReceiptNo}
                    onChange={(e) => {
                      setLinkedReceiptNo(e.target.value);
                      const rcpt = availableReceipts.find((r) => r.receipt_number === e.target.value);
                      if (rcpt && !amount) {
                        setAmount(String(rcpt.unused || rcpt.amount));
                      }
                    }}
                    className={inputClass}
                  >
                    <option value="">— Select Advance Receipt —</option>
                    {availableReceipts.map((r) => (
                      <option key={r.receipt_number} value={r.receipt_number}>
                        {r.receipt_number} ({fmtDate(r.date)}) — Unused: {formatInr(r.unused || r.amount)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {/* Refund Amount */}
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76] dark:text-slate-300">
                  Refund Amount (₹) <span className="text-red-500">*</span>
                </span>
                <input
                  required
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder={unused > 0 ? `Max available: ${unused}` : "Enter refund amount in ₹"}
                  className={inputClass}
                />
              </label>

              {/* Payment Mode & Bank/Account Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76] dark:text-slate-300">
                    Paid From / Payment Mode
                  </span>
                  <select
                    value={paidFrom}
                    onChange={(e) => setPaidFrom(e.target.value)}
                    className={inputClass}
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76] dark:text-slate-300">
                    Account / Bank Name
                  </span>
                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. HDFC Bank, Petty Cash"
                    className={inputClass}
                  />
                </label>
              </div>

              {/* Reference & Place of Supply */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76] dark:text-slate-300">
                    Reference / UTR / Cheque No.
                  </span>
                  <input
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g. UTR12345678, CHQ-001"
                    className={inputClass}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76] dark:text-slate-300">
                    Place of Supply (State)
                  </span>
                  <input
                    value={placeOfSupply}
                    onChange={(e) => setPlaceOfSupply(e.target.value)}
                    placeholder="e.g. Maharashtra, Delhi"
                    className={inputClass}
                  />
                </label>
              </div>

              {/* Notes / Reason */}
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76] dark:text-slate-300">
                  Reason for Refund / Remarks
                </span>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Order cancelled, excess advance payment refunded"
                  className={inputClass}
                />
              </label>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#d0d0d8] dark:border-slate-800 bg-[#fafafa] dark:bg-slate-900/80 px-5 py-3.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!partyId && !selectedName || numericAmount <= 0}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isEdit ? "Update Refund Voucher" : "Save Refund Voucher"}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function printRefundVoucher(voucher, companySettings, addToast) {
  const amount = Number(voucher.amount) || 0;
  const amountWords = numberToWordsInr(amount);
  const company = companySettings || {};
  const companyName = company.name || company.legal_name || "INSIGHTS IVA ENTERPRISE";

  const win = window.open("", "_blank");
  if (!win) {
    if (addToast) addToast("Please allow popups to print the refund voucher", "warning");
    return false;
  }
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Refund Voucher - ${voucher.voucher_number}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #1e293b;
            font-size: 13px;
            line-height: 1.4;
          }
          .voucher-box {
            border: 2px solid #0f172a;
            border-radius: 8px;
            padding: 24px;
            max-width: 800px;
            margin: 0 auto;
          }
          .company-header {
            display: flex;
            justify-content: space-between;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 14px;
            margin-bottom: 16px;
          }
          .company-name {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }
          .company-sub {
            font-size: 11px;
            color: #475569;
            margin-top: 3px;
          }
          .doc-title-box {
            text-align: right;
          }
          .doc-title {
            font-size: 20px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #dc2626;
          }
          .doc-meta {
            font-size: 12px;
            font-weight: 600;
            color: #334155;
            margin-top: 4px;
          }
          .grid-table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
          }
          .grid-table td {
            padding: 9px 12px;
            border: 1px solid #cbd5e1;
            vertical-align: middle;
          }
          .grid-table .label {
            font-weight: 700;
            background: #f8fafc;
            width: 24%;
            color: #475569;
            font-size: 12px;
          }
          .amount-badge {
            font-size: 20px;
            font-weight: 800;
            color: #dc2626;
          }
          .sign-row {
            margin-top: 48px;
            display: flex;
            justify-content: space-between;
            padding: 0 10px;
          }
          .sign-box {
            text-align: center;
            border-top: 1.5px solid #0f172a;
            width: 170px;
            padding-top: 6px;
            font-weight: 700;
            font-size: 11px;
            text-transform: uppercase;
            color: #334155;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 10.5px;
            color: #94a3b8;
            border-top: 1px dashed #cbd5e1;
            padding-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="voucher-box">
          <div class="company-header">
            <div>
              <div class="company-name">${companyName}</div>
              <div class="company-sub">${company.address || ""}${company.city ? `, ${company.city}` : ""}${company.state ? ` - ${company.state}` : ""}</div>
              ${company.gstin ? `<div class="company-sub"><strong>GSTIN:</strong> ${company.gstin}</div>` : ""}
              ${company.phone ? `<div class="company-sub"><strong>Phone:</strong> ${company.phone}</div>` : ""}
            </div>
            <div class="doc-title-box">
              <div class="doc-title">Refund Voucher</div>
              <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">(Pursuant to GST Section 31(3)(e))</div>
              <div class="doc-meta" style="margin-top: 8px;">Voucher No: <strong>${voucher.voucher_number}</strong></div>
              <div class="doc-meta">Date: <strong>${fmtDate(voucher.voucher_date || voucher.created_at)}</strong></div>
            </div>
          </div>

          <table class="grid-table">
            <tr>
              <td class="label">Refunded To (Buyer)</td>
              <td colspan="3">
                <strong style="font-size: 14px; color: #0f172a;">${voucher.refunded_to || voucher.party_name || "—"}</strong>
                ${voucher.customer_gstin ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">GSTIN: ${voucher.customer_gstin}</div>` : ""}
              </td>
            </tr>
            <tr>
              <td class="label">Refund Amount</td>
              <td class="amount-badge">${formatInr(amount)}</td>
              <td class="label">Payment Mode</td>
              <td><strong>${voucher.paid_from || voucher.payment_mode || "Cash"}</strong></td>
            </tr>
            <tr>
              <td class="label">Amount in Words</td>
              <td colspan="3"><strong style="text-transform: uppercase; color: #334155;">${amountWords}</strong></td>
            </tr>
            <tr>
              <td class="label">Bank / Account</td>
              <td>${voucher.account_name || "—"}</td>
              <td class="label">Ref / UTR / Cheque No.</td>
              <td>${voucher.reference_no || "—"}</td>
            </tr>
            ${voucher.linked_receipt_no ? `
            <tr>
              <td class="label">Original Advance Receipt</td>
              <td colspan="3"><strong>${voucher.linked_receipt_no}</strong></td>
            </tr>` : ""}
            ${voucher.place_of_supply ? `
            <tr>
              <td class="label">Place of Supply</td>
              <td colspan="3">${voucher.place_of_supply}</td>
            </tr>` : ""}
            ${voucher.notes ? `
            <tr>
              <td class="label">Reason / Remarks</td>
              <td colspan="3">${voucher.notes}</td>
            </tr>` : ""}
          </table>

          <div class="sign-row">
            <div class="sign-box">Prepared By</div>
            <div class="sign-box">Verified By</div>
            <div class="sign-box">Authorised Signatory</div>
          </div>

          <div class="footer">
            This is a Computer Generated Refund Voucher issued under GST rules.
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
    </html>
  `);
  win.document.close();
  return true;
}

function downloadRefundVoucherPdf(voucher, addToast) {
  try {
    const amount = Number(voucher.amount) || 0;
    exportToPdf(
      [
        {
          voucher_number: voucher.voucher_number,
          voucher_date: fmtDate(voucher.voucher_date || voucher.created_at),
          refunded_to: voucher.refunded_to || voucher.party_name || "—",
          amount: formatInr(amount),
          paid_from: voucher.paid_from || "Cash",
          account_name: voucher.account_name || "—",
          reference_no: voucher.reference_no || "—",
          notes: voucher.notes || "—",
        },
      ],
      [
        { key: "voucher_number", label: "Voucher No." },
        { key: "voucher_date", label: "Date" },
        { key: "refunded_to", label: "Refunded To" },
        { key: "amount", label: "Refund Amount" },
        { key: "paid_from", label: "Paid From" },
        { key: "account_name", label: "Bank Account" },
        { key: "reference_no", label: "Ref / UTR #" },
        { key: "notes", label: "Remarks" },
      ],
      `Refund Voucher - ${voucher.voucher_number}`,
      `refund-voucher-${voucher.voucher_number}`
    );
    if (addToast) addToast("Refund voucher PDF downloaded", "success");
  } catch {
    if (addToast) addToast("Failed to download PDF", "error");
  }
}

function RefundVoucherDetailModal({
  voucher,
  companySettings,
  onClose,
  onEdit,
  onDelete,
}) {
  const { addToast } = useToast();

  useEffect(() => {
    if (!voucher) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [voucher, onClose]);

  if (!voucher) return null;

  const amount = Number(voucher.amount) || 0;
  const amountWords = numberToWordsInr(amount);

  const handlePrint = () => {
    printRefundVoucher(voucher, companySettings, addToast);
  };

  const handlePdf = () => {
    downloadRefundVoucherPdf(voucher, addToast);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#ececf0] dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-bold text-[#1a1a1f] dark:text-slate-100">
                  Refund Voucher
                </h3>
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800 dark:bg-red-950/60 dark:text-red-300">
                  Issued
                </span>
              </div>
              <p className="text-[12px] text-[#6b6b76] dark:text-slate-400">
                Voucher No: <span className="font-semibold text-[#1a1a1f] dark:text-slate-200">{voucher.voucher_number}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-2 text-[#6b6b76] hover:bg-[#f0f0f4] hover:text-[#1a1a1f] dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
          >
            <X className="h-5 w-5 pointer-events-none" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-xl border border-[#d0d0d8] dark:border-slate-800 bg-[#fafafa] dark:bg-slate-950/50 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between border-b border-[#e4e4ea] dark:border-slate-800 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                  Refunded To (Buyer)
                </p>
                <p className="text-[16px] font-bold text-[#1a1a1f] dark:text-slate-100">
                  {voucher.refunded_to || voucher.party_name}
                </p>
                {voucher.customer_gstin ? (
                  <p className="text-[11px] text-slate-500">GSTIN: {voucher.customer_gstin}</p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a95]">
                  Date Issued
                </p>
                <p className="text-[14px] font-semibold text-[#1a1a1f] dark:text-slate-200">
                  {fmtDate(voucher.voucher_date || voucher.created_at)}
                </p>
              </div>
            </div>

            {/* Big Amount Card */}
            <div className="mb-4 rounded-xl border border-red-200 bg-white dark:bg-slate-900 dark:border-red-950 p-4 text-center shadow-xs">
              <p className="text-[12px] font-medium text-[#6b6b76] dark:text-slate-400">
                Refund Amount
              </p>
              <p className="text-[28px] font-black text-red-600 dark:text-red-400 tabular-nums">
                {formatInr(amount)}
              </p>
              <p className="mt-1 text-[11.5px] font-bold uppercase text-[#4a4a55] dark:text-slate-300">
                {amountWords}
              </p>
            </div>

            {/* Details Grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[#e4e4ea] dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                <span className="text-[11px] font-semibold text-[#8a8a95]">Payment Mode</span>
                <p className="text-[13px] font-bold text-[#1a1a1f] dark:text-slate-100">
                  {voucher.paid_from || voucher.payment_mode || "Cash"}
                </p>
              </div>

              <div className="rounded-lg border border-[#e4e4ea] dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                <span className="text-[11px] font-semibold text-[#8a8a95]">Bank / Account</span>
                <p className="text-[13px] font-bold text-[#1a1a1f] dark:text-slate-100">
                  {voucher.account_name || "—"}
                </p>
              </div>

              <div className="rounded-lg border border-[#e4e4ea] dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                <span className="text-[11px] font-semibold text-[#8a8a95]">Ref / UTR / Cheque No.</span>
                <p className="text-[13px] font-bold text-[#1a1a1f] dark:text-slate-100">
                  {voucher.reference_no || "—"}
                </p>
              </div>

              <div className="rounded-lg border border-[#e4e4ea] dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                <span className="text-[11px] font-semibold text-[#8a8a95]">Linked Advance Receipt</span>
                <p className="text-[13px] font-bold text-[#1a1a1f] dark:text-slate-100">
                  {voucher.linked_receipt_no || "—"}
                </p>
              </div>

              {voucher.notes ? (
                <div className="rounded-lg border border-[#e4e4ea] dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-[#8a8a95]">Remarks / Reason</span>
                  <p className="text-[13px] text-[#4a4a55] dark:text-slate-300">{voucher.notes}</p>
                </div>
              ) : null}
            </div>

            {/* Signature Block */}
            <div className="mt-6 flex items-center justify-between border-t border-dashed border-[#d0d0d8] dark:border-slate-800 pt-4 text-center text-[11px] text-[#8a8a95]">
              <div className="border-t border-[#8a8a95] px-4 pt-1 font-semibold">Prepared By</div>
              <div className="border-t border-[#8a8a95] px-4 pt-1 font-semibold">Verified By</div>
              <div className="border-t border-[#8a8a95] px-4 pt-1 font-semibold">Authorised Signatory</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ececf0] dark:border-slate-800 bg-[#fafafa] dark:bg-slate-900/80 px-6 py-3.5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="h-4 w-4" />}
            >
              Print Voucher
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePdf}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Download PDF
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {onEdit ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  onClose?.();
                  onEdit?.(voucher);
                }}
                leftIcon={<Edit2 className="h-4 w-4" />}
              >
                Edit
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  onClose?.();
                  onDelete?.(voucher);
                }}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Delete
              </Button>
            ) : null}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
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
  const [advanceReceiptsByParty, setAdvanceReceiptsByParty] = useState({});
  const [companySettings, setCompanySettings] = useState({});
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("2026-04-01");
  const [dateTo, setDateTo] = useState("2027-03-31");
  const [modeFilter, setModeFilter] = useState("all");
  const [kpiFilter, setKpiFilter] = useState("all");
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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [custRes, payRes, docRes, compRes] = await Promise.allSettled([
        fetchCustomersWithFallback(),
        getPayments(tenantId),
        listBizDocuments({
          module: "sales",
          doc_type: "refund_voucher",
          page: 1,
          page_size: 500,
        }),
        getCompanySettings(),
      ]);

      const custs = custRes.status === "fulfilled" ? custRes.value || [] : [];
      setCustomers(custs);

      if (compRes.status === "fulfilled") {
        setCompanySettings(compRes.value?.data?.data || compRes.value?.data || {});
      }

      const payments = payRes.status === "fulfilled" ? payRes.value?.data || [] : [];
      const unusedMap = {};
      const receiptsMap = {};

      for (const p of payments) {
        const meta = parsePaymentMeta(p.notes);
        const partyId = String(meta.party_id || p.customer_id || p.party_id || "");
        const partyName = String(meta.party_name || p.customer_name || p.party_name || "").trim().toLowerCase();
        const unused = Number(meta.unused_amount) || (meta.is_advance || !p.invoice_id ? Number(p.amount) || 0 : 0);
        if (unused <= 0) continue;

        const receiptEntry = {
          id: p.id,
          receipt_number: meta.receipt_number || `RCPT-${p.id}`,
          date: p.payment_date,
          amount: Number(p.amount) || 0,
          unused,
          mode: meta.payment_mode || p.method || "Cash",
        };

        if (partyId) {
          unusedMap[partyId] = (unusedMap[partyId] || 0) + unused;
          receiptsMap[partyId] = [...(receiptsMap[partyId] || []), receiptEntry];
        }
        if (partyName) {
          const nameKey = `name:${partyName}`;
          unusedMap[nameKey] = (unusedMap[nameKey] || 0) + unused;
          receiptsMap[nameKey] = [...(receiptsMap[nameKey] || []), receiptEntry];
        }
      }

      // Link by customer name/id
      for (const c of custs) {
        const byName = unusedMap[`name:${String(c.name || c.company || "").trim().toLowerCase()}`] || 0;
        if (byName > 0) {
          unusedMap[String(c.id)] = (unusedMap[String(c.id)] || 0) + byName;
          receiptsMap[String(c.id)] = receiptsMap[`name:${String(c.name || c.company || "").trim().toLowerCase()}`] || [];
        }
      }

      // Subtract already created refund vouchers
      const items =
        docRes.status === "fulfilled"
          ? docRes.value?.data?.items || docRes.value?.data || []
          : [];
      const mappedRows = (Array.isArray(items) ? items : []).map(mapDocToRow);

      for (const r of mappedRows) {
        const rAmt = Number(r.amount) || 0;
        const rPartyId = String(r.party_id || "");
        const rPartyName = `name:${String(r.party_name || r.refunded_to || "").trim().toLowerCase()}`;
        if (rPartyId && unusedMap[rPartyId]) {
          unusedMap[rPartyId] = Math.max(0, unusedMap[rPartyId] - rAmt);
        }
        if (unusedMap[rPartyName]) {
          unusedMap[rPartyName] = Math.max(0, unusedMap[rPartyName] - rAmt);
        }
      }

      setUnusedByParty(unusedMap);
      setAdvanceReceiptsByParty(receiptsMap);
      setRows(mappedRows);
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
  }, [search, dateFrom, dateTo, modeFilter, kpiFilter, pageSize]);

  // Filtered rows
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (q) {
          const hay = `${r.voucher_number} ${r.party_name} ${r.refunded_to} ${r.paid_from} ${r.reference_no} ${r.notes}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }

        const d = String(r.voucher_date || r.created_at || "").slice(0, 10);
        if (dateFrom && d && d < dateFrom) return false;
        if (dateTo && d && d > dateTo) return false;

        if (modeFilter !== "all") {
          const m = String(r.paid_from || r.payment_mode || "").toLowerCase();
          if (!m.includes(modeFilter.toLowerCase())) return false;
        }

        if (kpiFilter === "bank") {
          const m = String(r.paid_from || "").toLowerCase();
          if (m.includes("cash")) return false;
        } else if (kpiFilter === "cash") {
          const m = String(r.paid_from || "").toLowerCase();
          if (!m.includes("cash")) return false;
        }

        return true;
      })
      .sort((a, b) =>
        String(b.voucher_date || b.created_at || "").localeCompare(
          String(a.voucher_date || a.created_at || "")
        )
      );
  }, [rows, search, dateFrom, dateTo, modeFilter, kpiFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const nextNumber = rows.length + 1;

  // KPIs
  const totalRefundAmount = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows]
  );
  const bankRefunds = useMemo(
    () => rows.filter((r) => !String(r.paid_from || "").toLowerCase().includes("cash")),
    [rows]
  );
  const cashRefunds = useMemo(
    () => rows.filter((r) => String(r.paid_from || "").toLowerCase().includes("cash")),
    [rows]
  );

  const bankTotal = useMemo(
    () => bankRefunds.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [bankRefunds]
  );
  const cashTotal = useMemo(
    () => cashRefunds.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [cashRefunds]
  );

  const handleSave = async (voucher) => {
    try {
      const payload = {
        module: "sales",
        doc_type: "refund_voucher",
        document_number: voucher.voucher_number,
        party_name: voucher.party_name || voucher.refunded_to,
        document_date: voucher.voucher_date,
        amount: voucher.amount,
        status: "issued",
        notes: voucher.notes,
        meta: {
          party_id: voucher.party_id,
          refunded_to: voucher.refunded_to,
          paid_from: voucher.paid_from,
          payment_mode: voucher.payment_mode,
          account_name: voucher.account_name,
          reference_no: voucher.reference_no,
          linked_receipt_no: voucher.linked_receipt_no,
          place_of_supply: voucher.place_of_supply,
          customer_gstin: voucher.customer_gstin,
          prefix: voucher.prefix,
          voucher_no: voucher.voucher_no,
          notes: voucher.notes,
        },
      };

      if (voucher.id) {
        await updateBizDocument(voucher.id, payload);
        addToast("Refund voucher updated successfully", "success");
      } else {
        await createBizDocument(payload);
        addToast("Refund voucher created successfully", "success");
      }

      setModalOpen(false);
      setEditingVoucher(null);
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to save refund voucher"), "error");
    }
  };

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete refund voucher "${row.voucher_number}"?`)) return;
    try {
      await deleteBizDocument(row.id);
      addToast("Refund voucher deleted", "success");
      if (selectedVoucher?.id === row.id) setSelectedVoucher(null);
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete refund voucher"), "error");
    }
  };

  // Export handlers
  const exportColumns = [
    { key: "voucher_number", label: "Voucher No." },
    { key: "voucher_date", label: "Date", render: (r) => fmtDate(r.voucher_date || r.created_at) },
    { key: "party_name", label: "Refunded To" },
    { key: "amount", label: "Amount", render: (r) => formatInr(r.amount) },
    { key: "paid_from", label: "Paid From" },
    { key: "account_name", label: "Account Name" },
    { key: "reference_no", label: "Reference No." },
    { key: "notes", label: "Notes" },
  ];

  const handleExportExcel = () => {
    exportToExcel(filtered, exportColumns, "refund_vouchers");
    addToast("Exported to Excel", "success");
  };

  const handleExportCsv = () => {
    exportToCsv(filtered, exportColumns, "refund_vouchers");
    addToast("Exported to CSV", "success");
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
      {/* Summary KPI Tabs */}
      <div className="flex flex-wrap overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xs">
        <SummaryTab
          label="All Refund Vouchers"
          count={rows.length}
          amount={formatInr(totalRefundAmount)}
          active={kpiFilter === "all"}
          onClick={() => setKpiFilter("all")}
          badgeColor="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
        />
        <SummaryTab
          label="Bank & Online Refunds"
          count={bankRefunds.length}
          amount={formatInr(bankTotal)}
          active={kpiFilter === "bank"}
          onClick={() => setKpiFilter("bank")}
          badgeColor="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
        />
        <SummaryTab
          label="Cash Refunds"
          count={cashRefunds.length}
          amount={formatInr(cashTotal)}
          active={kpiFilter === "cash"}
          onClick={() => setKpiFilter("cash")}
          badgeColor="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
        />
      </div>

      {/* Row 1: Date Range & Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker Range Box */}
          <div className="inline-flex items-center gap-3 rounded-full bg-[var(--color-surface)] px-4 py-2 text-[13px] text-[var(--color-text-secondary)] shadow-xs border border-[var(--color-border-soft)]">
            <button
              type="button"
              onClick={openDateFrom}
              className="flex items-center justify-center text-[var(--color-text-muted)] hover:text-[#0f6d84] transition-colors cursor-pointer"
              aria-label="Open start date picker"
            >
              <Calendar className="h-4 w-4" />
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
              className="text-[13px] font-medium text-[#2c2b3d] dark:text-slate-100 hover:text-[#0f6d84] transition-colors cursor-pointer"
              title="Click to select start date"
            >
              {fmtDisplayDate(dateFrom) || "Start Date"}
            </button>
            <span className="text-[var(--color-text-faint)] select-none">→</span>
            <button
              type="button"
              onClick={openDateTo}
              className="text-[13px] font-medium text-[#2c2b3d] dark:text-slate-100 hover:text-[#0f6d84] transition-colors cursor-pointer"
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
              <Calendar className="h-4 w-4" />
            </button>
          </div>

          {/* Export Dropdown / Buttons */}
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExportExcel}
              leftIcon={<FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />}
              title="Export to Excel"
            >
              Excel
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              leftIcon={<FileText className="h-3.5 w-3.5 text-blue-600" />}
              title="Export to CSV"
            >
              CSV
            </Button>
          </div>
        </div>

        <Button
          type="button"
          variant="add"
          onClick={() => {
            setEditingVoucher(null);
            setModalOpen(true);
          }}
          leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
        >
          New Refund Voucher
        </Button>
      </div>

      {/* Row 2: Search & Mode Filter Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search voucher #, buyer name, mode, reference..."
          className="w-full sm:max-w-md"
        />

        {/* Mode Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {["all", "cash", "bank", "upi", "cheque"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModeFilter(m)}
              className={`cursor-pointer rounded-full px-3 py-1 text-[12px] font-semibold transition-colors capitalize ${
                modeFilter === m
                  ? "bg-[#0f6d84] text-white"
                  : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              {m === "all" ? "All Modes" : m}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-table-border)] bg-[var(--color-surface)] shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-[13px]">
            <thead className="ui-table-head">
              <tr>
                <SerialNumberHeader className="border-b border-r border-[var(--color-table-border)]" />
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">
                  Voucher No.
                </th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">
                  Date Created
                </th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">
                  Amount
                </th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">
                  Refunded to
                </th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">
                  Paid From
                </th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">
                  Ref / UTR #
                </th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <RotateCcw className="mx-auto h-12 w-12 text-[#c4c4cc] dark:text-slate-700" />
                    <p className="mt-3 text-[14px] font-medium text-[#6b6b76] dark:text-slate-400">
                      No refund vouchers available.
                    </p>
                    <p className="mt-1 text-[12px] text-[#9a9aa5]">
                      Create a refund voucher to issue refunds against customer advance balances.
                    </p>
                  </td>
                </tr>
              ) : (
                pageRows.map((r, rowIndex) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedVoucher(r)}
                    className="hover:bg-[var(--color-surface-hover)] cursor-pointer transition-colors"
                  >
                    <SerialNumberCell
                      rowIndex={rowIndex}
                      page={page}
                      pageSize={pageSize}
                      className="border-t border-r border-[var(--color-table-border)]"
                    />
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 font-semibold text-[var(--color-primary)]">
                      {r.voucher_number}
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[#4a4a55] dark:text-slate-300">
                      {fmtDate(r.voucher_date || r.created_at)}
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 tabular-nums font-bold text-red-600 dark:text-red-400">
                      {formatInr(r.amount)}
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 font-medium text-[#1a1a1f] dark:text-slate-100">
                      <div>{r.refunded_to}</div>
                      {r.customer_gstin ? (
                        <div className="text-[10.5px] text-slate-500">GST: {r.customer_gstin}</div>
                      ) : null}
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[#4a4a55] dark:text-slate-300">
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium">
                        {r.paid_from}
                      </span>
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[#4a4a55] dark:text-slate-400 font-mono text-[12px]">
                      {r.reference_no || "—"}
                    </td>
                    <td
                      className="border-t border-r border-[var(--color-table-border)] px-4 py-2 text-right last:border-r-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end">
                        <RowActionMenu
                          rowId={r.id}
                          openMenu={openMenu}
                          setOpenMenu={setOpenMenu}
                          items={[
                            {
                              label: "View",
                              icon: <Eye className="h-4 w-4" />,
                              onClick: () => setSelectedVoucher(r),
                            },
                            {
                              label: "Edit",
                              icon: <Edit2 className="h-4 w-4" />,
                              onClick: () => {
                                setEditingVoucher(r);
                                setModalOpen(true);
                              },
                            },
                            {
                              label: "Print Voucher",
                              icon: <Printer className="h-4 w-4" />,
                              onClick: () => printRefundVoucher(r, companySettings, addToast),
                            },
                            {
                              label: "Download PDF",
                              icon: <Download className="h-4 w-4" />,
                              onClick: () => downloadRefundVoucherPdf(r, addToast),
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

        {/* Pagination */}
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

      {/* Create / Edit Modal */}
      <CreateEditRefundVoucherModal
        open={modalOpen}
        editData={editingVoucher}
        onClose={() => {
          setModalOpen(false);
          setEditingVoucher(null);
        }}
        onSave={handleSave}
        customers={customers}
        unusedByParty={unusedByParty}
        advanceReceiptsByParty={advanceReceiptsByParty}
        nextNumber={nextNumber}
      />

      {/* View Detail Modal */}
      <RefundVoucherDetailModal
        voucher={selectedVoucher}
        companySettings={companySettings}
        onClose={() => setSelectedVoucher(null)}
        onEdit={(v) => {
          setEditingVoucher(v);
          setModalOpen(true);
        }}
        onDelete={handleDelete}
      />
    </div>
  );
}
