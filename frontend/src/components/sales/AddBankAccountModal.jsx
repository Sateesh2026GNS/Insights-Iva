import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";

import { lookupVendorBank } from "../../api/procurementApi";
import { useToast } from "../../context/ToastContext";
import Button from "../common/Button";

const EMPTY = {
  ifsc: "",
  bank_name: "",
  account_holder: "",
  account_number: "",
  branch_name: "",
  upi_id: "",
  show_upi_qr: true,
  notes: "",
};

import { inputClass } from "../../design-system/classes";

function SoftLabel({ children, required }) {
  return (
    <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
      {children}
      {required ? <span className="text-[#e11d48]"> *</span> : null}
    </span>
  );
}

export default function AddBankAccountModal({ open, onClose, onSave, initial }) {
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [showAdditional, setShowAdditional] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      ifsc: initial?.ifsc || "",
      bank_name: initial?.bank_name || "",
      account_holder: initial?.account_holder || "",
      account_number: initial?.account_number || "",
      branch_name: initial?.branch_name || "",
      upi_id: initial?.upi_id || "",
      show_upi_qr: initial?.show_upi_qr !== false,
      notes: initial?.notes || "",
    });
    setShowAdditional(Boolean(initial?.notes));
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const ifsc = String(form.ifsc || "")
      .trim()
      .toUpperCase();
    if (ifsc.length !== 11) return;
    let cancelled = false;
    setLookingUp(true);
    lookupVendorBank(ifsc)
      .then((res) => {
        if (cancelled) return;
        const data = res?.data || res;
        if (!data) return;
        setForm((f) => ({
          ...f,
          bank_name: data.bank_name || f.bank_name,
          branch_name: data.branch || data.bank_branch || f.branch_name,
          ifsc: data.ifsc || ifsc,
        }));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLookingUp(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.ifsc, open]);

  if (!open) return null;

  const onSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!form.bank_name.trim()) {
      addToast("Bank Name is required", "error");
      return;
    }
    onSave?.({
      ifsc: form.ifsc.trim().toUpperCase() || null,
      bank_name: form.bank_name.trim(),
      account_holder: form.account_holder.trim() || null,
      account_number: form.account_number.trim() || null,
      branch_name: form.branch_name.trim() || null,
      upi_id: form.upi_id.trim() || null,
      show_upi_qr: Boolean(form.show_upi_qr),
      notes: form.notes.trim() || null,
    });
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-bank-account-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={onSubmit}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#ececf0] bg-white px-5 py-4">
          <h2
            id="add-bank-account-title"
            className="text-[17px] font-bold text-[#1a1a1f]"
          >
            Add Bank Account
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#9a9aa5] hover:bg-[#f5f5f7]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-[#f3f3f6] px-5 py-4">
          <div>
            <p className="mb-3 text-[14px] font-bold text-[#1a1a1f]">Account Details</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <SoftLabel>IFSC Code</SoftLabel>
                  <input
                    value={form.ifsc}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11),
                      }))
                    }
                    placeholder="Enter IFSC Code"
                    className={inputClass}
                  />
                  {lookingUp ? (
                    <p className="mt-1 text-[11px] text-[#8a8a95]">Looking up bank…</p>
                  ) : null}
                </label>
                <label className="block">
                  <SoftLabel required>Bank Name</SoftLabel>
                  <input
                    value={form.bank_name}
                    onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                    placeholder="Enter Bank Name"
                    required
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <SoftLabel>Account Holder Name</SoftLabel>
                  <input
                    value={form.account_holder}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, account_holder: e.target.value }))
                    }
                    placeholder="Enter Account Holder Name"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <SoftLabel>Account Number</SoftLabel>
                  <input
                    value={form.account_number}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        account_number: e.target.value.replace(/\D/g, "").slice(0, 18),
                      }))
                    }
                    placeholder="Enter Account Number"
                    className={inputClass}
                  />
                </label>
              </div>
              <label className="block">
                <SoftLabel>Branch Name</SoftLabel>
                <input
                  value={form.branch_name}
                  onChange={(e) => setForm((f) => ({ ...f, branch_name: e.target.value }))}
                  placeholder="Enter Branch Name"
                  className={inputClass}
                />
              </label>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[14px] font-bold text-[#1a1a1f]">UPI ID and Payment QR</p>
            <label className="block">
              <SoftLabel>Enter UPI ID</SoftLabel>
              <input
                value={form.upi_id}
                onChange={(e) => setForm((f) => ({ ...f, upi_id: e.target.value }))}
                placeholder="Enter UPI ID"
                className={inputClass}
              />
            </label>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-[13px] text-[#1a1a1f]">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border ${
                  form.show_upi_qr
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                    : "border-[#c4c4cc] bg-white"
                }`}
              >
                {form.show_upi_qr ? (
                  <Check className="h-3 w-3 text-[#1a1a1f]" strokeWidth={3} />
                ) : null}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={form.show_upi_qr}
                onChange={(e) => setForm((f) => ({ ...f, show_upi_qr: e.target.checked }))}
              />
              Show UPI QR Code in Invoice
            </label>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAdditional((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[#1a1a1f]"
            >
              Additional Details
              <ChevronDown
                className={`h-4 w-4 text-[#6b6b76] transition ${
                  showAdditional ? "rotate-180" : ""
                }`}
              />
            </button>
            {showAdditional ? (
              <label className="mt-3 block">
                <SoftLabel>Notes</SoftLabel>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Enter additional notes"
                  className={inputClass}
                />
              </label>
            ) : null}
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#ececf0] bg-white px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button type="submit" variant="primary" fullWidth>
            Save
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
