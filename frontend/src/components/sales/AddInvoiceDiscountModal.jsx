import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";

import { inputClass } from "../../design-system/classes";

/**
 * Invoice-level discount modal (replaces blocked window.prompt).
 */
export default function AddInvoiceDiscountModal({
  open,
  onClose,
  onSave,
  initial,
  baseAmount = 0,
}) {
  const [value, setValue] = useState("");
  const [type, setType] = useState("₹");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setValue(
      initial?.value != null && initial.value !== ""
        ? String(initial.value)
        : initial?.amount != null
          ? String(initial.amount)
          : ""
    );
    setType(initial?.type === "%" ? "%" : "₹");
    setDescription(initial?.description || "");
  }, [open, initial]);

  if (!open) return null;

  const preview =
    type === "%"
      ? Math.round(((Number(baseAmount) || 0) * (Number(value) || 0)) / 100 * 100) / 100
      : Math.round((Number(value) || 0) * 100) / 100;

  const onSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = Number(value);
    if (!Number.isFinite(raw) || raw < 0) return;
    onSave?.({
      value: raw,
      type,
      description: description.trim() || null,
      amount: preview,
    });
    onClose?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-invoice-discount-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ececf0] px-5 py-4">
          <h2
            id="add-invoice-discount-title"
            className="text-[17px] font-bold text-[#1a1a1f]"
          >
            Add Invoice Level Discount
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

        <div className="space-y-4 bg-[#f3f3f6] px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
              Discount
            </span>
            <div className="flex overflow-hidden rounded-lg border border-[#dcdce3] bg-white focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)]">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="border-r border-[#dcdce3] bg-[#fafafa] px-3 text-[13px] text-[#1a1a1f] outline-none"
                aria-label="Discount type"
              >
                <option value="₹">₹</option>
                <option value="%">%</option>
              </select>
              <input
                autoFocus
                type="number"
                min="0"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter discount"
                required
                className="min-w-0 flex-1 px-3 py-2.5 text-[13px] outline-none"
              />
            </div>
            {value !== "" ? (
              <p className="mt-1.5 text-[12px] text-[#6b6b76]">
                Discount amount: ₹ {preview.toFixed(2)}
              </p>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
              Description (Optional)
            </span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description"
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[#ececf0] px-5 py-4">
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
