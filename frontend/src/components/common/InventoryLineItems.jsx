import { Plus, Trash2 } from "lucide-react";

import { inputClass } from "../../design-system/classes";

/**
 * Shared line-item editor for purchase orders, goods receipts, and material requests.
 * mode: "purchase" | "grn" | "request"
 */
export default function InventoryLineItems({
  items = [],
  lines,
  onChange,
  mode = "purchase",
}) {
  const addLine = () => {
    onChange([
      ...lines,
      mode === "purchase"
        ? { item_id: "", quantity: "", unit_price: "" }
        : mode === "request"
          ? { item_id: "", quantity: "", notes: "" }
          : { item_id: "", quantity_received: "", quantity_rejected: "0" },
    ]);
  };

  const updateLine = (index, field, value) => {
    onChange(lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  };

  const removeLine = (index) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Line items</span>
        <button
          type="button"
          onClick={addLine}
          className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-[var(--color-success)]"
        >
          <Plus className="h-4 w-4" />
          Add line
        </button>
      </div>
      {lines.length === 0 && (
        <p className="text-sm text-slate-500">Add at least one inventory item.</p>
      )}
      {lines.map((line, index) => (
        <div
          key={index}
          className="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-600 sm:grid-cols-12"
        >
          <div className="sm:col-span-5">
            <label className="text-xs text-slate-500">Item</label>
            <select
              required
              value={line.item_id}
              onChange={(e) => updateLine(index, "item_id", e.target.value)}
              className={inputClass}
            >
              <option value="">Select item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} — {item.name}
                </option>
              ))}
            </select>
          </div>
          {mode === "purchase" ? (
            <>
              <div className="sm:col-span-3">
                <label className="text-xs text-slate-500">Qty</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={line.quantity}
                  onChange={(e) => updateLine(index, "quantity", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs text-slate-500">Unit price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unit_price}
                  onChange={(e) => updateLine(index, "unit_price", e.target.value)}
                  className={inputClass}
                />
              </div>
            </>
          ) : mode === "request" ? (
            <div className="sm:col-span-5">
              <label className="text-xs text-slate-500">Qty</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={line.quantity}
                onChange={(e) => updateLine(index, "quantity", e.target.value)}
                className={inputClass}
              />
            </div>
          ) : (
            <>
              <div className="sm:col-span-3">
                <label className="text-xs text-slate-500">Received</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={line.quantity_received}
                  onChange={(e) => updateLine(index, "quantity_received", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs text-slate-500">Rejected</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.quantity_rejected}
                  onChange={(e) => updateLine(index, "quantity_rejected", e.target.value)}
                  className={inputClass}
                />
              </div>
            </>
          )}
          <div className="flex items-end sm:col-span-1">
            <button
              type="button"
              onClick={() => removeLine(index)}
              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Remove line"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
