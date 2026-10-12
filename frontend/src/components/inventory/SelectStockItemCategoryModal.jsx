import { createPortal } from "react-dom";
import { X } from "lucide-react";

import Button from "../common/Button";
import SearchableSelect from "../common/SearchableSelect";

export default function SelectStockItemCategoryModal({
  open,
  categories = [],
  selectedId = "",
  error = "",
  onSelect,
  onAddCategory,
  onContinue,
  onClose,
}) {
  if (!open) return null;

  const options = (categories || []).map((c) => ({
    value: String(c.id),
    label: c.name,
  }));
  const selected = (categories || []).find((c) => String(c.id) === String(selectedId));
  const canContinue = Boolean(selected);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="select-stock-item-category-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Step 1 – Category
            </p>
            <h3 id="select-stock-item-category-title" className="text-[17px] font-bold text-[#1a1a1f]">
              Add Stock Item
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-[#f0f0f4] text-[#1a1a1f]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-[13px] text-[var(--color-text-secondary)]">
          Select or create a category before adding a product, item, or material.
        </p>

        <label className="mb-2 block text-[12px] font-semibold text-[#6b6b76]">Select Category *</label>
        <SearchableSelect
          value={selectedId ? String(selectedId) : ""}
          onChange={(next) => {
            const match = (categories || []).find((c) => String(c.id) === String(next));
            onSelect?.(match || null);
          }}
          options={options}
          placeholder="Search / Select Category"
          searchPlaceholder="Search Category"
        />

        <div className="mt-3">
          <Button type="button" variant="add" size="sm" onClick={() => onAddCategory?.()}>
            Add New Category
          </Button>
        </div>

        {error ? (
          <p className="mt-3 text-[13px] font-medium text-[var(--color-danger)]" role="alert">
            {error}
          </p>
        ) : !canContinue ? (
          <p className="mt-3 text-[13px] text-[var(--color-text-muted)]">
            No Category selected. Product/Material creation is disabled until Category is selected.
          </p>
        ) : (
          <p className="mt-3 text-[13px] font-semibold text-[var(--color-text)]">
            Category {selected.name} <span className="text-[var(--color-success)]">✓</span>
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            disabled={!canContinue}
            onClick={() => {
              if (!canContinue) return;
              onContinue?.(selected);
            }}
          >
            Add Product / Item / Material
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
