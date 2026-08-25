import { useEffect, useState } from "react";
import { Calendar, X } from "lucide-react";

import Button from "../common/Button";
import { createInventoryItem, updateInventoryItem } from "../../api/inventoryApi";
import { apiErrorMessage } from "../../utils/apiError";
import { todayIso } from "../../utils/dateUtils";

const UNITS = ["KG", "Nos", "Pcs", "Ltr", "Mtr", "Roll", "Box", "Sheet", "Drum", "Gms"];

function emptyForm() {
  return {
    date: todayIso(),
    name: "",
    sku: "",
    unit: "KG",
    reorder_level: "0",
    available: "0",
  };
}

const ITEM_TYPE_CONFIG = {
  raw_material: {
    addTitle: "Add Material",
    editTitle: "Edit Material",
    addSubtitle: "Create a new raw material line",
    editSubtitle: "Update raw material details",
    addButton: "Add Material",
    nameLabel: "Material Name",
    skuPlaceholder: "RM-0001",
    defaultCategory: "General",
    itemType: "raw_material",
    createError: "Failed to create material.",
    updateError: "Failed to update material.",
    nameRequired: "Material name is required.",
  },
  finished_good: {
    addTitle: "Add Finished Good",
    editTitle: "Edit Finished Good",
    addSubtitle: "Create a new finished good line",
    editSubtitle: "Update finished good details",
    addButton: "Add Finished Good",
    nameLabel: "Product Name",
    skuPlaceholder: "FG-0001",
    defaultCategory: "General",
    itemType: "finished_good",
    createError: "Failed to create finished good.",
    updateError: "Failed to update finished good.",
    nameRequired: "Product name is required.",
  },
};

export default function MaterialFormModal({
  open,
  mode = "add",
  material,
  itemType = "raw_material",
  tenantId = 1,
  warehouseName = "Main Warehouse",
  onClose,
  onSaved,
}) {
  const config = ITEM_TYPE_CONFIG[itemType] || ITEM_TYPE_CONFIG.raw_material;
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = mode === "edit";

  useEffect(() => {
    if (!open) return;
    setError("");
    if (isEdit && material) {
      setForm({
        name: material.name || "",
        sku: material.sku || "",
        unit: material.unit || "KG",
        reorder_level: String(material.reorder_level ?? 0),
        available: String(material.available ?? Math.max((Number(material.quantity) || 0) - (Number(material.reserved) || 0), 0)),
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, isEdit, material]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const name = form.name.trim();
    const sku = form.sku.trim();
    const unit = form.unit.trim();
    const reorderLevel = Math.max(0, Math.round(Number(form.reorder_level) || 0));
    const available = Math.max(0, Number(form.available) || 0);

    if (!name) {
      setError(config.nameRequired);
      return;
    }
    if (!sku) {
      setError("SKU is required.");
      return;
    }
    if (!unit) {
      setError("Unit is required.");
      return;
    }
    if (Number.isNaN(Number(form.available)) || Number(form.available) < 0) {
      setError("Available quantity must be zero or greater.");
      return;
    }
    if (Number.isNaN(Number(form.reorder_level)) || Number(form.reorder_level) < 0) {
      setError("Required quantity must be zero or greater.");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && material?.id) {
        const reserved = Number(material.reserved) || 0;
        await updateInventoryItem(material.id, {
          name,
          sku,
          unit,
          reorder_level: reorderLevel,
          quantity: Math.round(available + reserved),
        });
      } else {
        await createInventoryItem({
          tenant_id: Number(tenantId) || 1,
          supplier_id: null,
          sku,
          name,
          unit,
          reorder_level: reorderLevel,
          quantity: Math.round(available),
          reserved: 0,
          item_type: config.itemType,
          category: material?.category || config.defaultCategory,
          warehouse_name: warehouseName,
          status: "in_stock",
          is_active: true,
        });
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(apiErrorMessage(err, isEdit ? config.updateError : config.createError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? config.editTitle : config.addTitle}</h2>
            <p className="text-sm text-slate-500">{isEdit ? config.editSubtitle : config.addSubtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6">
          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text)]">
                {config.nameLabel} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="ui-input w-full"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text)]">
                SKU <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                className="ui-input w-full"
                placeholder={config.skuPlaceholder}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text)]">
                Unit <span className="text-red-500">*</span>
              </label>
              <select value={form.unit} onChange={(e) => set("unit", e.target.value)} className="ui-select w-full">
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text)]">Required Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.reorder_level}
                  onChange={(e) => set("reorder_level", e.target.value)}
                  className="ui-input w-full"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text)]">Available Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.available}
                  onChange={(e) => set("available", e.target.value)}
                  className="ui-input w-full"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : config.addButton}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
