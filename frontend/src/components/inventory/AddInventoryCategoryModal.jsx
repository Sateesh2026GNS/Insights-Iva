import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { inputClass } from "../../design-system/classes";

function OutlinedField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">{label}</span>
      {children}
    </label>
  );
}

export default function AddInventoryCategoryModal({ open, name, onNameChange, onClose, onSubmit, busy }) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-inventory-category-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 id="add-inventory-category-title" className="text-[17px] font-bold text-[#1a1a1f]">
            Add Category
          </h3>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-[#f0f0f4] text-[#1a1a1f] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <OutlinedField label="Category Name *">
          <input
            autoFocus
            className={inputClass}
            placeholder="Category name"
            value={name}
            disabled={busy}
            onChange={(e) => onNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
          />
        </OutlinedField>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#cfcfd6] py-3 text-[14px] font-semibold text-[#1a1a1f] hover:bg-[#f5f5f7] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSubmit}
            className="flex-1 rounded-lg bg-[var(--color-primary)] py-3 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
