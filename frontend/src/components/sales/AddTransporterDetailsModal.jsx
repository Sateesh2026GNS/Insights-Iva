import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";

const EMPTY = {
  transporter_name: "",
  transporter_id: "",
};

import { inputClass } from "../../design-system/classes";

export default function AddTransporterDetailsModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm({
      transporter_name: initial?.transporter_name || "",
      transporter_id: initial?.transporter_id || "",
    });
  }, [open, initial]);

  if (!open) return null;

  const onSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!form.transporter_name.trim()) return;
    onSave?.({
      transporter_name: form.transporter_name.trim(),
      transporter_id: form.transporter_id.trim() || null,
    });
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-transporter-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ececf0] bg-white px-5 py-4">
          <h2
            id="add-transporter-title"
            className="text-[17px] font-bold text-[#1a1a1f]"
          >
            Add Transporter Details
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
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
              Transporter Name
            </span>
            <input
              value={form.transporter_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, transporter_name: e.target.value }))
              }
              placeholder="Enter Transporter Name"
              required
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
              Transporter ID
            </span>
            <input
              value={form.transporter_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, transporter_id: e.target.value }))
              }
              placeholder="Enter Transporter ID"
              className={inputClass}
            />
          </label>
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
