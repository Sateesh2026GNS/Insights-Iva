import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
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
} from "../../api/bizDocumentsApi";
import { inputClass } from "../../design-system/classes";
import { apiErrorMessage } from "../../utils/apiError";
import {
  fetchCustomersWithFallback,
  filterCustomers,
} from "../../utils/customerOptions";
import { formatInr } from "../../data/salesMasterData";
import { numberToWordsInr } from "../../utils/invoiceCopyData";
import { exportToPdf } from "../../utils/exportUtils";

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
    paid_from: meta.paid_from || "Cash",
    notes: meta.notes || meta.remark || "",
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
  const [prefix, setPrefix] = useState("RV-");
  const [voucherNo, setVoucherNo] = useState("1");
  const [partyId, setPartyId] = useState("");
  const [partyOpen, setPartyOpen] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [amount, setAmount] = useState("");
  const [paidFrom, setPaidFrom] = useState("Cash");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setVoucherDate(toInputDate());
    setPrefix("RV-");
    setVoucherNo(String(nextNumber || 1));
    setPartyId("");
    setPartyOpen(false);
    setPartySearch("");
    setAmount("");
    setPaidFrom("Cash");
    setNotes("");
  }, [open, nextNumber]);

  if (!open) return null;

  const selected = customers.find((c) => String(c.id) === String(partyId));
  const selectedName = selected?.name || selected?.company || "";
  const nameKey = `name:${selectedName.trim().toLowerCase()}`;
  const unused = partyId ? Number(unusedByParty[String(partyId)] ?? unusedByParty[nameKey] ?? 0) : 0;
  const canRefund = Boolean(partyId) && unused > 0;
  const filtered = filterCustomers(customers, partySearch);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
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
            party_name: selectedName || "—",
            amount: refundAmt,
            refunded_to: selectedName || "—",
            paid_from: paidFrom,
            notes,
            created_at: new Date().toISOString(),
          });
          onClose?.();
        }}
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#d0d0d8] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <RotateCcw className="h-4 w-4" />
            </div>
            <h2 className="text-[17px] font-bold text-[#1a1a1f]">Create Refund Voucher</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer p-1 text-[#9a9aa5] hover:text-[#1a1a1f]">
            <X className="h-5 w-5 pointer-events-none" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr] gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
                Voucher Date
              </span>
              <input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className={inputClass}
              />
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
                className={inputClass}
              />
            </label>
          </div>

          <div className="relative">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
              Party / Buyer Name
            </span>
            <button
              type="button"
              onClick={() => setPartyOpen((v) => !v)}
              className={`${inputClass} flex items-center justify-between text-left cursor-pointer`}
            >
              <span className={selected ? "font-medium text-[#1a1a1f]" : "text-[#a0a0ab]"}>
                {selectedName || "Select Buyer to Refund"}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[#6b6b76] transition ${partyOpen ? "rotate-180" : ""}`}
              />
            </button>
            {partyOpen ? (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-hidden rounded-xl border border-[#d0d0d8] bg-white shadow-lg">
                <div className="border-b border-[#ececf0] p-2">
                  <SearchBar
                    size="compact"
                    value={partySearch}
                    onChange={setPartySearch}
                    placeholder="Search party..."
                    autoFocus
                    className="w-full"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto">
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
                            setAmount("");
                          }}
                          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] hover:bg-[#f7f7f9] cursor-pointer"
                        >
                          <span className="font-medium text-[#1a1a1f]">{cName}</span>
                          {cUnused > 0 ? (
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Unused: {formatInr(cUnused)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#9a9aa5]">₹0 unused</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {partyId ? (
            <>
              <div className="border-t border-[#ececf0]" />
              {!canRefund ? (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900 font-bold text-[12px]">
                      <AlertCircle className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[14px] font-bold text-amber-900">No Unused Advance Available</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-amber-800">
                        A refund voucher cannot be processed because <strong>{selectedName}</strong> has an unused advance balance of <strong>₹0</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Available Advance Balance</p>
                      <p className="mt-0.5 text-[18px] font-bold tabular-nums text-emerald-900">
                        {formatInr(unused)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAmount(String(unused))}
                      className="cursor-pointer rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[12px] font-bold text-emerald-700 shadow-sm hover:bg-emerald-50"
                    >
                      Refund Full Balance
                    </button>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
                      Refund Amount (₹)
                    </span>
                    <input
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                      placeholder={`Max: ${unused}`}
                      className={inputClass}
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
                        Paid From Account / Mode
                      </span>
                      <select
                        value={paidFrom}
                        onChange={(e) => setPaidFrom(e.target.value)}
                        className={inputClass}
                      >
                        <option value="Cash">Cash</option>
                        <option value="Bank Account">Bank Account</option>
                        <option value="UPI / Online">UPI / Online</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
                        Notes / Reason
                      </span>
                      <input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Reason for refund"
                        className={inputClass}
                      />
                    </label>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {canRefund ? (
          <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#d0d0d8] bg-[#fafafa] px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-[#d8d8e0] bg-white py-2.5 text-[14px] font-semibold text-[#4a4a55] hover:bg-[#f0f0f4]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cursor-pointer rounded-xl bg-[var(--color-primary)] py-2.5 text-[14px] font-semibold text-white hover:opacity-90 shadow-sm"
            >
              Save Refund Voucher
            </button>
          </div>
        ) : null}
      </form>
    </div>,
    document.body
  );
}

function RefundVoucherDetailModal({ voucher, onClose, onDelete }) {
  const { addToast } = useToast();
  const printRef = useRef(null);

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
    const win = window.open("", "_blank");
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Refund Voucher - ${voucher.voucher_number}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              margin: 20px;
              color: #1a1a1f;
              font-size: 13px;
            }
            .voucher-box {
              border: 2px solid #1a1a1f;
              border-radius: 8px;
              padding: 24px;
              max-width: 750px;
              margin: 0 auto;
            }
            .header-table {
              width: 100%;
              border-bottom: 2px solid #1a1a1f;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .title {
              font-size: 20px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #dc2626;
            }
            .grid-table {
              width: 100%;
              border-collapse: collapse;
              margin: 16px 0;
            }
            .grid-table td {
              padding: 8px 12px;
              border: 1px solid #d0d0d8;
            }
            .grid-table .label {
              font-weight: 600;
              background: #f7f7f9;
              width: 25%;
              color: #4a4a55;
            }
            .amount-badge {
              font-size: 18px;
              font-weight: 700;
              color: #dc2626;
            }
            .sign-row {
              margin-top: 40px;
              display: flex;
              justify-content: space-between;
              padding-top: 20px;
            }
            .sign-box {
              text-align: center;
              border-top: 1px solid #1a1a1f;
              width: 180px;
              padding-top: 6px;
              font-weight: 600;
              font-size: 12px;
            }
            .footer {
              text-align: center;
              margin-top: 24px;
              font-size: 11px;
              color: #6b6b76;
              border-top: 1px dashed #d0d0d8;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="voucher-box">
            <table class="header-table">
              <tr>
                <td>
                  <div class="title">Refund Voucher</div>
                  <div style="font-size: 11px; color: #6b6b76; margin-top: 2px;">Official Money Refund Voucher</div>
                </td>
                <td style="text-align: right;">
                  <div style="font-size: 14px; font-weight: bold;">Voucher No: ${voucher.voucher_number}</div>
                  <div style="font-size: 12px; color: #4a4a55; margin-top: 3px;">Date: ${fmtDate(voucher.voucher_date || voucher.created_at)}</div>
                </td>
              </tr>
            </table>

            <table class="grid-table">
              <tr>
                <td class="label">Refunded To (Party)</td>
                <td colspan="3"><strong>${voucher.refunded_to || voucher.party_name || "—"}</strong></td>
              </tr>
              <tr>
                <td class="label">Refund Amount</td>
                <td class="amount-badge">${formatInr(amount)}</td>
                <td class="label">Paid From</td>
                <td><strong>${voucher.paid_from || "Cash"}</strong></td>
              </tr>
              <tr>
                <td class="label">Amount in Words</td>
                <td colspan="3"><strong style="text-transform: uppercase;">${amountWords}</strong></td>
              </tr>
              ${voucher.notes ? `
              <tr>
                <td class="label">Notes / Remarks</td>
                <td colspan="3">${voucher.notes}</td>
              </tr>` : ""}
            </table>

            <div class="sign-row">
              <div class="sign-box">Prepared By</div>
              <div class="sign-box">Verified By</div>
              <div class="sign-box">Authorised Signatory</div>
            </div>

            <div class="footer">
              This is a Computer Generated Refund Voucher
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handlePdf = () => {
    try {
      exportToPdf(
        [
          {
            voucher_number: voucher.voucher_number,
            voucher_date: fmtDate(voucher.voucher_date || voucher.created_at),
            refunded_to: voucher.refunded_to || voucher.party_name || "—",
            amount: formatInr(amount),
            paid_from: voucher.paid_from || "Cash",
            notes: voucher.notes || "—",
          },
        ],
        [
          { key: "voucher_number", label: "Voucher No." },
          { key: "voucher_date", label: "Date" },
          { key: "refunded_to", label: "Refunded To" },
          { key: "amount", label: "Refund Amount" },
          { key: "paid_from", label: "Paid From" },
          { key: "notes", label: "Notes" },
        ],
        `Refund Voucher - ${voucher.voucher_number}`,
        `refund-voucher-${voucher.voucher_number}`
      );
      addToast("Refund voucher PDF downloaded", "success");
    } catch {
      addToast("Failed to download PDF", "error");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#ececf0] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-bold text-[#1a1a1f]">Refund Voucher</h3>
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-800">
                  Refund Issued
                </span>
              </div>
              <p className="text-[12px] text-[#6b6b76]">Voucher No: <span className="font-semibold text-[#1a1a1f]">{voucher.voucher_number}</span></p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose?.();
            }}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-2 text-[#6b6b76] hover:bg-[#f0f0f4] hover:text-[#1a1a1f] active:bg-[#e4e4ea] transition-colors"
          >
            <X className="h-5 w-5 pointer-events-none" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6" ref={printRef}>
          <div className="rounded-xl border border-[#d0d0d8] bg-[#fafafa] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between border-b border-[#e4e4ea] pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">Refunded To</p>
                <p className="text-[16px] font-bold text-[#1a1a1f]">{voucher.refunded_to || voucher.party_name}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a95]">Date</p>
                <p className="text-[14px] font-semibold text-[#1a1a1f]">{fmtDate(voucher.voucher_date || voucher.created_at)}</p>
              </div>
            </div>

            <div className="mb-4 rounded-xl border border-red-200 bg-white p-4 text-center shadow-sm">
              <p className="text-[12px] font-medium text-[#6b6b76]">Refund Amount</p>
              <p className="text-[26px] font-black text-red-600 tabular-nums">{formatInr(amount)}</p>
              <p className="mt-1 text-[12px] font-semibold uppercase text-[#4a4a55]">{amountWords}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[#e4e4ea] bg-white p-3">
                <span className="text-[11px] font-semibold text-[#8a8a95]">Paid From</span>
                <p className="text-[13px] font-bold text-[#1a1a1f]">{voucher.paid_from || "Cash"}</p>
              </div>
              <div className="rounded-lg border border-[#e4e4ea] bg-white p-3">
                <span className="text-[11px] font-semibold text-[#8a8a95]">Status</span>
                <p className="text-[13px] font-bold text-red-600">Issued</p>
              </div>
              {voucher.notes ? (
                <div className="rounded-lg border border-[#e4e4ea] bg-white p-3 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-[#8a8a95]">Notes / Remarks</span>
                  <p className="text-[13px] text-[#4a4a55]">{voucher.notes}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-dashed border-[#d0d0d8] pt-4 text-center text-[11px] text-[#8a8a95]">
              <div className="border-t border-[#8a8a95] px-4 pt-1 font-semibold">Prepared By</div>
              <div className="border-t border-[#8a8a95] px-4 pt-1 font-semibold">Authorised Signatory</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ececf0] bg-[#fafafa] px-6 py-3.5">
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

function fmtDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso).slice(0, 10);
  return `${d}/${m}/${y}`;
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
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);

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

      const custs = custRes.status === "fulfilled" ? custRes.value || [] : [];
      setCustomers(custs);

      const payments = payRes.status === "fulfilled" ? payRes.value?.data || [] : [];
      const map = {};
      for (const p of payments) {
        const meta = parsePaymentMeta(p.notes);
        const partyId = String(meta.party_id || p.customer_id || p.party_id || "");
        const partyName = String(meta.party_name || p.customer_name || p.party_name || "").trim().toLowerCase();
        const unused = Number(meta.unused_amount) || (meta.is_advance ? Number(p.amount) || 0 : 0);
        if (unused <= 0) continue;

        if (partyId) {
          map[partyId] = (map[partyId] || 0) + unused;
        }
        if (partyName) {
          const nameKey = `name:${partyName}`;
          map[nameKey] = (map[nameKey] || 0) + unused;
        }
      }

      // Populate for all customers by name
      for (const c of custs) {
        const byName = map[`name:${String(c.name || c.company || "").trim().toLowerCase()}`] || 0;
        if (byName > 0) {
          map[String(c.id)] = (map[String(c.id)] || 0) + byName;
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
        if (rPartyId && map[rPartyId]) {
          map[rPartyId] = Math.max(0, map[rPartyId] - rAmt);
        }
        if (map[rPartyName]) {
          map[rPartyName] = Math.max(0, map[rPartyName] - rAmt);
        }
      }

      setUnusedByParty(map);
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
  }, [search, dateFrom, dateTo, pageSize]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (q) {
          const hay = `${r.voucher_number} ${r.party_name} ${r.refunded_to} ${r.paid_from}`.toLowerCase();
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

  const totalRefundAmount = useMemo(() => {
    return rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  }, [rows]);

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
          notes: voucher.notes,
        },
      });
      addToast("Refund voucher created successfully", "success");
      setCreateOpen(false);
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to create refund voucher"), "error");
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

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[var(--color-bg)]">
        <Loader label="Loading refund vouchers..." />
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-4 bg-[var(--color-bg)] p-4 sm:p-6">
      {/* Row 1: Date Range, Summary & Action Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-3 rounded-full bg-[var(--color-surface)] px-4 py-2.5 text-[13px] text-[var(--color-text-secondary)] shadow-sm shadow-[#00000010] border border-[var(--color-border-soft)]">
            <button
              type="button"
              onClick={openDateFrom}
              className="flex items-center justify-center text-[var(--color-text-muted)] hover:text-[#0f6d84] transition-colors cursor-pointer"
              aria-label="Open start date picker"
            >
              <Calendar className="h-5 w-5" />
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
              className="text-[14px] font-medium text-[#2c2b3d] dark:text-slate-100 hover:text-[#0f6d84] transition-colors cursor-pointer"
              title="Click to select start date"
            >
              {fmtDisplayDate(dateFrom) || "Start Date"}
            </button>
            <span className="text-[var(--color-text-faint)] select-none">→</span>
            <button
              type="button"
              onClick={openDateTo}
              className="text-[14px] font-medium text-[#2c2b3d] dark:text-slate-100 hover:text-[#0f6d84] transition-colors cursor-pointer"
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
              <Calendar className="h-5 w-5" />
            </button>
          </div>
          <div className="inline-flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] shadow-sm">
            Total Refunded:&nbsp;
            <span className="font-semibold text-red-600 tabular-nums">{formatInr(totalRefundAmount)}</span>
          </div>
        </div>
        <Button
          type="button"
          variant="add"
          onClick={() => setCreateOpen(true)}
          leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
        >
          New Refund Voucher
        </Button>
      </div>

      {/* Row 2: Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar value={search} onChange={setSearch} placeholder="Search refund vouchers..." className="w-full" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--color-table-border)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-[13px]">
            <thead className="ui-table-head">
              <tr>
                <SerialNumberHeader className="border-b border-r border-[var(--color-table-border)]" />
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Voucher No.</th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Date Created</th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Amount</th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Refunded to</th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Paid From</th>
                <th className="border-b border-r border-[var(--color-table-border)] px-4 py-3 last:border-r-0">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <RotateCcw className="mx-auto h-12 w-12 text-[#c4c4cc]" />
                    <p className="mt-3 text-[14px] text-[#6b6b76]">
                      No refund vouchers available. Create a new refund voucher to refund customer advance.
                    </p>
                    <Button type="button" variant="add" onClick={() => setCreateOpen(true)} className="mt-4" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                      New Refund Voucher
                    </Button>
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
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[#4a4a55]">
                      {fmtDate(r.voucher_date || r.created_at)}
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 tabular-nums font-bold text-red-600">
                      {formatInr(r.amount)}
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 font-medium text-[#1a1a1f]">
                      {r.refunded_to}
                    </td>
                    <td className="border-t border-r border-[var(--color-table-border)] px-4 py-3 text-[#4a4a55]">
                      {r.paid_from}
                    </td>
                    <td
                      className="border-t border-r border-[var(--color-table-border)] px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedVoucher(r)}
                          className="font-medium text-[var(--color-primary)] hover:underline cursor-pointer"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(r)}
                          className="font-medium text-[#dc2626] hover:underline cursor-pointer"
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

      <CreateRefundVoucherModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleSave}
        customers={customers}
        unusedByParty={unusedByParty}
        nextNumber={nextNumber}
      />

      <RefundVoucherDetailModal
        voucher={selectedVoucher}
        onClose={() => setSelectedVoucher(null)}
        onDelete={handleDelete}
      />
    </div>
  );
}
