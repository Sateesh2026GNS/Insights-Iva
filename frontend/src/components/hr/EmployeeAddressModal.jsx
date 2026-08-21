import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, X } from "lucide-react";

import Button from "../common/Button";
const EMPTY_ADDRESS = {
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
};

function parseAddress(value) {
  if (!value) return { ...EMPTY_ADDRESS };
  const parts = String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    address_line1: parts[0] || "",
    address_line2: parts[1] || "",
    city: parts[2] || "",
    state: parts[3] || "",
    pincode: parts[4] || "",
    country: parts[5] || "India",
  };
}

export default function EmployeeAddressModal({ open, onClose, value, onSave }) {
  const [form, setForm] = useState(EMPTY_ADDRESS);

  useEffect(() => {
    if (!open) return;
    setForm(parseAddress(value));
  }, [open, value]);

  if (!open) return null;

  const updateField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = () => {
    const nextValue = [
      form.address_line1,
      form.address_line2,
      form.city,
      form.state,
      form.pincode,
      form.country,
    ]
      .filter(Boolean)
      .join(", ");
    onSave?.(nextValue);
    onClose?.();
  };

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <MapPin className="h-4 w-4 text-[#2563EB]" /> Add Address
            </h3>
            <p className="mt-1 text-sm text-slate-500">Add the employee’s full address details.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Address Line 1
            </label>
            <input value={form.address_line1} onChange={updateField("address_line1")} placeholder="House / Flat / Building" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Address Line 2
            </label>
            <input value={form.address_line2} onChange={updateField("address_line2")} placeholder="Street / Area / Landmark" className={inputClass} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">City</label>
              <input value={form.city} onChange={updateField("city")} placeholder="City" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">State</label>
              <input value={form.state} onChange={updateField("state")} placeholder="State" className={inputClass} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Pincode</label>
              <input value={form.pincode} onChange={updateField("pincode")} placeholder="Pincode" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Country</label>
              <input value={form.country} onChange={updateField("country")} placeholder="Country" className={inputClass} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <Button variant="primary" type="button" onClick={handleSave}>
            Save Address
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
