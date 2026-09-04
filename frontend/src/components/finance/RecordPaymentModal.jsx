import { useRef, useState } from "react";
import { X, Save, Paperclip } from "lucide-react";
import Button, { IconButton } from "../common/Button";
import { useToast } from "../../context/ToastContext";

/* ── identical to CreateLeadModal ── */
import { inputMtClass as inputClass } from "../../design-system/classes";

const labelClass = "block text-xs font-bold text-slate-500 uppercase tracking-wider";

export default function RecordPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  initialPartyType = "customer",
  initialInvoice = "",
}) {
  const { addToast } = useToast();
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    party_type:     initialPartyType,
    party_name:     "",
    invoice:        initialInvoice,
    payment_date:   new Date().toISOString().slice(0, 10),
    amount:         "",
    payment_mode:   "NEFT",
    bank:           "",
    transaction_id: "",
    utr_number:     "",
    currency:       "INR",
    status:         "completed",
    created_by:     "",
    attachment:     "",
  });

  if (!isOpen) return null;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    setForm((f) => ({ ...f, attachment: file.name }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.party_name || !form.amount) {
      setError("Party Name and Amount are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const stored = localStorage.getItem("smrt_payments");
      const list   = stored ? JSON.parse(stored) : [];
      const newPayment = {
        ...form,
        id:             Date.now(),
        payment_number: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
        amount:         Number(form.amount) || 0,
        created_at:     new Date().toISOString().slice(0, 10),
      };
      localStorage.setItem("smrt_payments", JSON.stringify([newPayment, ...list]));
      addToast("Payment recorded successfully!", "success");
      if (onSuccess) onSuccess(newPayment);
      onClose();
    } catch {
      setError("Failed to save payment. Please try again.");
      addToast("Failed to save payment", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">

        {/* ── Header ── */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Record Payment</h3>
            <p className="text-xs text-slate-500 mt-0.5">Record a customer receipt or vendor disbursement.</p>
          </div>
          <IconButton
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </IconButton>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Error banner */}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          {/* Row 1 — Party Type + Party Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Party Type *</label>
              <select value={form.party_type} onChange={set("party_type")} className={inputClass}>
                <option value="customer">Customer</option>
                <option value="vendor">Vendor</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Party Name *</label>
              <input
                type="text" required placeholder="e.g. Apex Industries Ltd"
                value={form.party_name} onChange={set("party_name")} className={inputClass}
              />
            </div>
          </div>

          {/* Row 2 — Invoice Ref + Payment Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Invoice / Bill Ref</label>
              <input
                type="text" placeholder="e.g. INV-2026-009"
                value={form.invoice} onChange={set("invoice")} className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Payment Date *</label>
              <input
                type="date" required
                value={form.payment_date} onChange={set("payment_date")} className={inputClass}
              />
            </div>
          </div>

          {/* Row 3 — Amount + Payment Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Amount (₹) *</label>
              <input
                type="number" step="0.01" required placeholder="0.00"
                value={form.amount} onChange={set("amount")}
                className={`${inputClass} text-right`}
              />
            </div>
            <div>
              <label className={labelClass}>Payment Mode</label>
              <select value={form.payment_mode} onChange={set("payment_mode")} className={inputClass}>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CARD">Credit Card</option>
              </select>
            </div>
          </div>

          {/* Row 4 — Bank + Transaction ID */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Bank Account</label>
              <input
                type="text" placeholder="e.g. HDFC Current A/c"
                value={form.bank} onChange={set("bank")} className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Transaction ID</label>
              <input
                type="text" placeholder="e.g. TXN00012345"
                value={form.transaction_id} onChange={set("transaction_id")} className={inputClass}
              />
            </div>
          </div>

          {/* Row 5 — UTR + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>UTR Number</label>
              <input
                type="text" placeholder="e.g. UTR982183921"
                value={form.utr_number} onChange={set("utr_number")} className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <select value={form.currency} onChange={set("currency")} className={inputClass}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          {/* Row 6 — Status + Created By */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Status</label>
              <select value={form.status} onChange={set("status")} className={inputClass}>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Created By</label>
              <input
                type="text" placeholder="e.g. Finance Team"
                value={form.created_by} onChange={set("created_by")} className={inputClass}
              />
            </div>
          </div>

          {/* Row 7 — Attachment */}
          <div>
            <label className={labelClass}>Attachment</label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text" placeholder="e.g. receipt_apr2026.pdf"
                value={form.attachment} onChange={set("attachment")}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <input
                ref={fileInputRef} type="file" className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
              >
                <Paperclip className="h-4 w-4" /> Upload
              </button>
            </div>
            {attachedFile && (
              <p className="mt-1 text-xs text-emerald-600 font-medium">
                ✓ {attachedFile.name} ({(attachedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="cancel" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving} disabled={saving} leftIcon={<Save className="h-4 w-4" />}>
              Save Payment
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
