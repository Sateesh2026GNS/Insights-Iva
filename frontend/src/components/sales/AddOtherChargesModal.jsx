import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";

const CHARGE_NAMES = [
  "Service Charge",
  "Delivery Charge",
  "Making Charge- Imitation Jewelry",
  "Making Charge- Gold Jewelry",
  "Labour Charge",
  "Insurance Charge",
  "Packaging Charge",
  "Freight Charge",
  "Handling Charge",
  "Installation Charge",
];

const GST_OPTIONS = [
  { label: "Not Applicable", value: "" },
  { label: "GST @ 0%", value: "0" },
  { label: "Exempted", value: "exempted" },
  { label: "Non-GST", value: "non_gst" },
  { label: "GST @ 0.1%", value: "0.1" },
  { label: "GST @ 0.25%", value: "0.25" },
  { label: "GST @ 3%", value: "3" },
  { label: "GST @ 5%", value: "5" },
  { label: "GST @ 12%", value: "12" },
  { label: "GST @ 18%", value: "18" },
  { label: "GST @ 28%", value: "28" },
];

const EMPTY = {
  charge_name: "",
  hsn: "",
  amount: "",
  gst: "",
  tax_type: "Exclusive",
};

import { inputClass } from "../../design-system/classes";

function SoftLabel({ children }) {
  return (
    <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">{children}</span>
  );
}

/** Compute charge total from amount + GST + tax type. */
export function computeOtherChargeTotal({ amount, gst, tax_type }) {
  const base = Number(amount) || 0;
  const gstVal = Number(gst);
  if (!Number.isFinite(gstVal) || gstVal <= 0) return Math.round(base * 100) / 100;
  if (String(tax_type).toLowerCase() === "inclusive") {
    return Math.round(base * 100) / 100;
  }
  return Math.round(base * (1 + gstVal / 100) * 100) / 100;
}

export default function AddOtherChargesModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm({
      charge_name: initial?.charge_name || "",
      hsn: initial?.hsn || "",
      amount: initial?.amount != null ? String(initial.amount) : "",
      gst: initial?.gst || "",
      tax_type: initial?.tax_type || "Exclusive",
    });
  }, [open, initial]);

  if (!open) return null;

  const onSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!form.charge_name) return;
    if (form.amount === "" || Number.isNaN(Number(form.amount))) return;
    onSave?.({
      charge_name: form.charge_name,
      hsn: form.hsn.trim() || null,
      amount: Number(form.amount) || 0,
      gst: form.gst,
      tax_type: form.tax_type,
      total: computeOtherChargeTotal(form),
    });
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-other-charges-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ececf0] bg-white px-5 py-4">
          <h2
            id="add-other-charges-title"
            className="text-[17px] font-bold text-[#1a1a1f]"
          >
            Add Other Charges
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

        <div className="space-y-3.5 bg-[#f3f3f6] px-5 py-4">
          <div className="grid grid-cols-[1.4fr_0.7fr] gap-3">
            <label className="block">
              <SoftLabel>Charge Name</SoftLabel>
              <select
                value={form.charge_name}
                onChange={(e) => setForm((f) => ({ ...f, charge_name: e.target.value }))}
                required
                className={`${inputClass} ${!form.charge_name ? "text-[#a0a0ab]" : ""}`}
              >
                <option value="">-</option>
                {CHARGE_NAMES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <SoftLabel>HSN</SoftLabel>
              <input
                value={form.hsn}
                onChange={(e) => setForm((f) => ({ ...f, hsn: e.target.value }))}
                placeholder="-"
                className={inputClass}
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <SoftLabel>Amount</SoftLabel>
              <div className="flex overflow-hidden rounded-lg border border-[#dcdce3] bg-white focus-within:border-[#c4b5fd] focus-within:ring-1 focus-within:ring-[#c4b5fd]">
                <select
                  className="border-r border-[#dcdce3] bg-[#fafafa] px-2 text-[13px] text-[#1a1a1f] outline-none"
                  defaultValue="INR"
                  aria-label="Currency"
                >
                  <option value="INR">₹</option>
                </select>
                <input
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      amount: e.target.value.replace(/[^\d.]/g, ""),
                    }))
                  }
                  placeholder="-"
                  required
                  className="min-w-0 flex-1 px-3 py-2.5 text-[13px] outline-none"
                />
              </div>
            </label>
            <label className="block">
              <SoftLabel>GST</SoftLabel>
              <select
                value={form.gst}
                onChange={(e) => setForm((f) => ({ ...f, gst: e.target.value }))}
                className={`${inputClass} ${!form.gst ? "text-[#a0a0ab]" : ""}`}
              >
                {GST_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label === "Not Applicable" ? "-" : o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <SoftLabel>Tax Type</SoftLabel>
              <select
                value={form.tax_type}
                onChange={(e) => setForm((f) => ({ ...f, tax_type: e.target.value }))}
                className={inputClass}
              >
                <option value="Exclusive">Exclusive</option>
                <option value="Inclusive">Inclusive</option>
              </select>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[#ececf0] bg-white px-5 py-4">
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
