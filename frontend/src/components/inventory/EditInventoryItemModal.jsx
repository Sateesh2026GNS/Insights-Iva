import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { updateInventoryItem } from "../../api/inventoryApi";
import { apiErrorMessage } from "../../utils/apiError";
import Button from "../common/Button";

export default function EditInventoryItemModal({ item, onClose, onSaved, addToast }) {
  const [form, setForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    unit: "pcs",
    unit_cost: "",
    reorder_level: "",
    category: "",
    warehouse_name: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setForm({
      name: item.name || "",
      sku: item.sku || "",
      barcode: item.barcode || "",
      unit: item.unit || "pcs",
      unit_cost: item.unit_cost ?? "",
      reorder_level: item.reorder_level ?? "",
      category: item.category || "",
      warehouse_name: item.warehouse_name || "",
      description: item.description || "",
    });
  }, [item]);

  if (!item) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast?.("Name is required", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await updateInventoryItem(item.id, {
        name: form.name.trim(),
        sku: form.sku || undefined,
        barcode: form.barcode || null,
        unit: form.unit || "pcs",
        unit_cost: form.unit_cost === "" ? null : Number(form.unit_cost),
        reorder_level: form.reorder_level === "" ? 0 : Number(form.reorder_level),
        category: form.category || null,
        warehouse_name: form.warehouse_name || null,
        description: form.description || null,
      });
      addToast?.("Item updated", "success");
      onSaved?.(res.data);
      onClose?.();
    } catch (err) {
      addToast?.(apiErrorMessage(err, "Failed to update item"), "error");
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, props = {}) => (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        {...props}
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSave}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Edit Item</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {field("Name", "name", { required: true })}
          {field("SKU", "sku")}
          {field("Barcode", "barcode")}
          {field("Unit", "unit")}
          {field("Unit cost", "unit_cost", { type: "number", step: "0.01" })}
          {field("Reorder level", "reorder_level", { type: "number" })}
          {field("Category", "category")}
          {field("Warehouse", "warehouse_name")}
          <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">
            Description
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving} loading={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
