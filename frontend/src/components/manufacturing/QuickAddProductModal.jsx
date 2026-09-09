import { useState } from "react";

import AdminModal from "../admin/AdminModal";
import Button from "../common/Button";
import { Input } from "../common/FormField";
import SearchableSelect from "../common/SearchableSelect";
import { createProduct } from "../../api/productsApi";
import useTenantId from "../../hooks/useTenantId";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";
import { getUomOptions } from "../../utils/manualSalesJobCard";

export default function QuickAddProductModal({ open, onClose, onSaved }) {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [name, setName] = useState("");
  const [productCode, setProductCode] = useState("");
  const [uom, setUom] = useState("Nos");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const uomOptions = getUomOptions().map((u) => ({ value: u, label: u }));

  const reset = () => {
    setName("");
    setProductCode("");
    setUom("Nos");
    setDescription("");
    setErrors({});
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose?.();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = "Product name is required";
    if (!String(uom || "").trim()) nextErrors.uom = "UOM is required";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSaving(true);
    try {
      const sku = productCode.trim() || `SKU-${Date.now().toString().slice(-8)}`;
      const res = await createProduct({
        tenant_id: tenantId,
        sku,
        name: name.trim(),
        category: "Finished Goods",
        product_type: "Finished Goods",
        description: description.trim() || null,
        unit: uom,
        unit_price: 0,
        unit_cost: 0,
        current_stock: 0,
      });
      const created = res?.data ?? res;
      addToast("Product added successfully.", "success");
      onSaved?.(created);
      reset();
      onClose?.();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to add product."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal open={open} onClose={handleClose} title="Add Product" maxWidth="max-w-md">
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Product Name *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Product Code</label>
          <Input
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            placeholder="Optional — auto-generated if blank"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">UOM *</label>
          <SearchableSelect
            value={uom}
            onChange={setUom}
            options={uomOptions}
            placeholder="Select UOM"
            searchPlaceholder="Search UOM…"
            allowCustom
            error={Boolean(errors.uom)}
          />
          {errors.uom ? <p className="manual-sjc__error">{errors.uom}</p> : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="add" size="sm" loading={saving} disabled={saving}>
            Save
          </Button>
        </div>
      </form>
    </AdminModal>
  );
}
