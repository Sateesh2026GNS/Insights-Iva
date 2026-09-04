import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";

const GST_TREATMENTS = [
  "Registered Business - Regular",
  "Registered Business - Composition",
  "Unregistered Business",
  "Consumer",
  "Overseas",
  "SEZ",
  "Deemed Export",
];

const TAX_PREFERENCES = ["Taxable", "Tax Exempt", "Non-Taxable"];

const PARTY_TYPES = ["Buyer", "Seller", "Both"];

const EMPTY = {
  party_type: "Buyer",
  gst_treatment: "",
  tax_preference: "Taxable",
  tds: false,
  tcs: false,
};

import { inputClass } from "../../design-system/classes";

const selectClass = `${inputClass} text-[13px]`;

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-3">
      <span className="text-[13px] font-semibold text-[#6b6b76]">{label}</span>
      <div>{children}</div>
    </div>
  );
}

export default function AddOtherDetailsModal({ open, onClose, initial, onSave }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm({
      party_type: initial?.party_type || "Buyer",
      gst_treatment: initial?.gst_treatment || "",
      tax_preference: initial?.tax_preference || "Taxable",
      tds: Boolean(initial?.tds),
      tcs: Boolean(initial?.tcs),
    });
  }, [open, initial]);

  if (!open) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSave?.({ ...form });
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-other-details-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={handleSave}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ececf0] bg-white px-5 py-4">
          <h2
            id="add-other-details-title"
            className="text-[17px] font-bold text-[#1a1a1f]"
          >
            Add Other Details
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

        <div className="space-y-4 bg-white px-5 py-5">
          <Row label="Party Type">
            <select
              value={form.party_type}
              onChange={(e) => setForm((f) => ({ ...f, party_type: e.target.value }))}
              className={selectClass}
            >
              {PARTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Row>

          <Row label="GST Treatment Type">
            <select
              value={form.gst_treatment}
              onChange={(e) =>
                setForm((f) => ({ ...f, gst_treatment: e.target.value }))
              }
              className={`${selectClass} ${!form.gst_treatment ? "text-[#a0a0ab]" : ""}`}
            >
              <option value="">Select GST Treatment</option>
              {GST_TREATMENTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Row>

          <Row label="Tax Preference">
            <select
              value={form.tax_preference}
              onChange={(e) =>
                setForm((f) => ({ ...f, tax_preference: e.target.value }))
              }
              className={selectClass}
            >
              {TAX_PREFERENCES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Row>

          <Row label="TDS">
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-[#1a1a1f]">
              <input
                type="checkbox"
                checked={form.tds}
                onChange={(e) => setForm((f) => ({ ...f, tds: e.target.checked }))}
                className="h-4 w-4 rounded border-[#c4c4cc] accent-[var(--color-primary)]"
              />
              TDS
            </label>
          </Row>

          <Row label="TCS">
            <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-[#1a1a1f]">
              <input
                type="checkbox"
                checked={form.tcs}
                onChange={(e) => setForm((f) => ({ ...f, tcs: e.target.checked }))}
                className="h-4 w-4 rounded border-[#c4c4cc] accent-[var(--color-primary)]"
              />
              TCS
            </label>
          </Row>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[#ececf0] bg-white px-5 py-4">
          <Button type="button" variant="cancel" onClick={onClose} fullWidth>
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
