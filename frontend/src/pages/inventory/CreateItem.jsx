import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Calendar,
  Save,
  Upload,
} from "lucide-react";

import Button from "../../components/common/Button";
import PageHeader from "../../components/common/PageHeader";
import { createInventoryItem, getWarehouses } from "../../api/inventoryApi";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import { apiErrorMessage, asArray } from "../../utils/apiError";
import { todayIso } from "../../utils/dateUtils";

const TABS = [
  { id: "basic", label: "Basic Information" },
  { id: "units-pricing", label: "Units & Pricing" },
  { id: "tax", label: "Tax & Accounting" },
  { id: "inventory", label: "Inventory Details" },
  { id: "additional", label: "Additional Information" },
];

const RAW_CATEGORIES = [
  "Metals",
  "Plastics",
  "Chemicals",
  "Liquids",
  "Hardware",
  "Rubber",
  "Electrical",
  "Raw Materials",
  "Consumables",
  "Packaging",
];

const FG_CATEGORIES = [
  "Finished Goods",
  "Assemblies",
  "Machined Parts",
  "Hardware",
  "Electrical",
  "Spare Parts",
  "Beverages",
];

const UNITS = ["KG", "Nos", "Pcs", "Ltr", "Mtr", "Roll", "Box", "Sheet", "Drum", "Gms", "Sqmtr"];

const GST_RATES = ["0", "5", "12", "18", "28"];
const GST_TYPES = ["CGST/SGST", "IGST", "Exempt"];
const TAX_TYPES = ["Taxable", "Nil Rated", "Exempt", "Non-GST"];

const DEFAULT_WAREHOUSES = ["Main Warehouse", "RM Store", "FG Store", "Unit-1 Warehouse"];

function Field({ label, required, hint, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text)]">
        {label}
        {required ? <span className="ml-0.5 text-[#ef4444]">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{hint}</p> : null}
    </div>
  );
}

function Card({ id, title, children, className = "" }) {
  return (
    <section id={id} className={`ui-card scroll-mt-28 p-4 sm:p-6 shadow-sm border border-[var(--color-border-soft)] dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-800/80 ${className}`.trim()}>
      <h3 className="mb-4 text-[14px] font-semibold text-[var(--color-text)]">{title}</h3>
      {children}
    </section>
  );
}

function CheckRow({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-action-teal)]"
      />
      <span>
        <span className="block text-[13px] font-medium text-[var(--color-text)]">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11px] text-[var(--color-text-muted)]">{hint}</span> : null}
      </span>
    </label>
  );
}

export default function CreateItem() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") === "finished_good" ? "finished_good" : "raw_material";

  const [activeTab, setActiveTab] = useState("basic");
  const [warehouses, setWarehouses] = useState(DEFAULT_WAREHOUSES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    item_type: initialType,
    category: "",
    sku_suffix: "",
    name: "",
    description: "",
    hsn_sac: "",
    brand: "",
    model_part_no: "",
    base_unit: "",
    purchase_unit: "",
    sales_unit: "",
    conversion_factor: "1.0000",
    purchase_price: "0.00",
    sales_price: "0.00",
    mrp: "0.00",
    standard_cost: "0.00",
    gst_rate: "",
    gst_type: "",
    tax_type: "",
    tax_exempt: false,
    reorder_level: "0.00",
    reorder_qty: "0.00",
    min_stock: "0.00",
    max_stock: "0.00",
    keep_stock: true,
    is_active: true,
    warehouse_name: "Main Warehouse",
    batch_number: "",
    serial_number: "",
    warranty: "",
    notes: "",
  });

  const isFinishedGood = form.item_type === "finished_good";
  const backPath = isFinishedGood ? "/inventory/finished-goods" : "/inventory/raw-materials";
  const skuPrefix = isFinishedGood ? "FG-" : "RM-";
  const categories = isFinishedGood ? FG_CATEGORIES : RAW_CATEGORIES;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    getWarehouses()
      .then((r) => {
        const names = asArray(r.data).map((w) => w.name).filter(Boolean);
        if (names.length) {
          setWarehouses(names);
          setForm((f) => ({
            ...f,
            warehouse_name: names.includes(f.warehouse_name) ? f.warehouse_name : names[0],
          }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      item_type: initialType,
      category: "",
      sku_suffix: "",
    }));
  }, [initialType]);

  const goToTab = (id) => {
    setActiveTab(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      addToast("Image must be under 2MB", "error");
      return;
    }
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const resolveSku = () => {
    const suffix = (form.sku_suffix || "").trim().replace(/^RM-|^FG-/i, "");
    if (suffix) return `${skuPrefix}${suffix}`;
    return `${skuPrefix}${Math.floor(1000 + Math.random() * 9000)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Item name is required");
      goToTab("basic");
      return;
    }
    if (!form.category) {
      setError("Item category is required");
      goToTab("basic");
      return;
    }
    if (!form.base_unit) {
      setError("Base unit is required");
      goToTab("units-pricing");
      return;
    }
    if (!form.gst_rate || !form.gst_type) {
      setError("GST rate and GST type are required");
      goToTab("tax");
      return;
    }

    const sku = resolveSku();

    const metaParts = [
      form.hsn_sac && `HSN/SAC: ${form.hsn_sac}`,
      form.brand && `Brand: ${form.brand}`,
      form.model_part_no && `Model: ${form.model_part_no}`,
      form.gst_rate && `GST: ${form.gst_rate}%`,
      form.gst_type && `GST Type: ${form.gst_type}`,
      form.tax_type && `Tax: ${form.tax_type}`,
      form.tax_exempt && "Tax Exempt",
      form.sales_price && `Sales Price: ₹${form.sales_price}`,
      form.mrp && `MRP: ₹${form.mrp}`,
      form.reorder_qty && `Reorder Qty: ${form.reorder_qty}`,
      form.min_stock && `Min Stock: ${form.min_stock}`,
      form.max_stock && `Max Stock: ${form.max_stock}`,
      form.notes && form.notes,
    ].filter(Boolean);

    const description = [form.description.trim(), metaParts.length ? metaParts.join(" · ") : ""]
      .filter(Boolean)
      .join("\n");

    setSaving(true);
    try {
      const payload = {
        tenant_id: Number(tenantId) || 1,
        supplier_id: null,
        sku,
        barcode: form.model_part_no?.trim() || null,
        name: form.name.trim(),
        description: description || null,
        category: form.category,
        warehouse_name: form.warehouse_name || "Main Warehouse",
        batch_number: form.batch_number?.trim() || null,
        quantity: form.keep_stock ? 0 : 0,
        reserved: 0,
        unit: form.base_unit || "Pcs",
        unit_cost: Number(form.purchase_price) || Number(form.standard_cost) || null,
        reorder_level: Math.round(Number(form.reorder_level) || 0),
        status: form.keep_stock ? "in_stock" : "inactive",
        customer_name: null,
        serial_number: form.serial_number?.trim() || null,
        expiry_date: null,
        production_date: null,
        warranty: form.warranty?.trim() || null,
        item_type: form.item_type,
        is_active: form.is_active,
        date: form.date || headerDate || todayIso(),
        created_at: form.date || headerDate || todayIso(),
      };
      await createInventoryItem(payload);
      addToast("Item created successfully");
      navigate(backPath);
    } catch (err) {
      const msg = apiErrorMessage(err, "Failed to create item.");
      setError(msg);
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 py-6 space-y-6 pb-28 min-w-0 w-full">
      <PageHeader
        backTo={backPath}
        backLabel={isFinishedGood ? "Back to Finished Goods" : "Back to Raw Materials"}
        action={
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={form.warehouse_name}
              onChange={(e) => set("warehouse_name", e.target.value)}
              className="ui-select !w-auto min-w-[11rem]"
              aria-label="Warehouse"
            >
              {warehouses.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
        }
      />

      <div className="overflow-x-auto border-b border-[var(--color-border-soft)]">
        <nav className="flex min-w-max gap-1" aria-label="Create item sections">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => goToTab(tab.id)}
                className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "border-[#16a34a] text-[#16a34a]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {error ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13px] font-medium text-[#b91c1c]">
          {error}
        </div>
      ) : null}

      <form id="create-item-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-12">
          <Card id="basic" title="Basic Information" className="xl:col-span-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Item Type" required>
                <select
                  value={form.item_type}
                  onChange={(e) => {
                    const t = e.target.value;
                    setForm((f) => ({
                      ...f,
                      item_type: t,
                      category: "",
                      sku_suffix: "",
                    }));
                  }}
                  className="ui-select w-full"
                >
                  <option value="raw_material">Raw Material</option>
                  <option value="finished_good">Finished Good</option>
                </select>
              </Field>
              <Field label="Item Category" required>
                <select
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  className="ui-select w-full"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Item Code" required hint="Leave blank to auto-generate">
                <div className="flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white focus-within:border-[var(--color-action-teal)]">
                  <span className="flex items-center bg-[var(--color-surface-muted)] px-3 text-[13px] font-semibold text-[var(--color-text-secondary)]">
                    {skuPrefix}
                  </span>
                  <input
                    type="text"
                    placeholder="Auto generated"
                    value={form.sku_suffix}
                    onChange={(e) => set("sku_suffix", e.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-[13px] outline-none"
                  />
                </div>
              </Field>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Field label="Item Name" required>
                <input
                  type="text"
                  required
                  placeholder="Enter item name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="Item Description">
                <textarea
                  rows={3}
                  placeholder="Enter item description"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  className="ui-textarea w-full min-h-[88px]"
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="HSN / SAC Code">
                <input
                  type="text"
                  placeholder="Enter HSN / SAC code"
                  value={form.hsn_sac}
                  onChange={(e) => set("hsn_sac", e.target.value)}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="Brand">
                <input
                  type="text"
                  placeholder="Enter brand name"
                  value={form.brand}
                  onChange={(e) => set("brand", e.target.value)}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="Model / Part No.">
                <input
                  type="text"
                  placeholder="Enter model / part number"
                  value={form.model_part_no}
                  onChange={(e) => set("model_part_no", e.target.value)}
                  className="ui-input w-full"
                />
              </Field>
            </div>
          </Card>

          <Card id="item-image" title="Item Image" className="xl:col-span-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-[220px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-4 py-8 text-center transition-colors hover:border-[var(--color-action-teal)] hover:bg-[var(--color-surface-muted)]"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Item preview" className="max-h-40 rounded-lg object-contain" />
              ) : (
                <>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--color-text-muted)] shadow-sm">
                    <Upload className="h-5 w-5" />
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--color-text)]">Upload Image</span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">PNG, JPG up to 2MB</span>
                </>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={onImagePick}
            />
            {imagePreview ? (
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="mt-2 text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                Remove image
              </button>
            ) : null}
          </Card>
        </div>

        <div id="units-pricing" className="grid scroll-mt-28 gap-6 lg:grid-cols-2">
          <Card title="Unit & Measurement">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Base Unit" required>
                <select
                  value={form.base_unit}
                  onChange={(e) => set("base_unit", e.target.value)}
                  className="ui-select w-full"
                >
                  <option value="">Select Unit</option>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </Field>
              <Field label="Purchase Unit">
                <select
                  value={form.purchase_unit}
                  onChange={(e) => set("purchase_unit", e.target.value)}
                  className="ui-select w-full"
                >
                  <option value="">Select Unit</option>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </Field>
              <Field label="Sales Unit">
                <select
                  value={form.sales_unit}
                  onChange={(e) => set("sales_unit", e.target.value)}
                  className="ui-select w-full"
                >
                  <option value="">Select Unit</option>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </Field>
              <Field label="Conversion Factor" required hint="Base Unit = 1">
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={form.conversion_factor}
                  onChange={(e) => set("conversion_factor", e.target.value)}
                  className="ui-input w-full"
                />
              </Field>
            </div>
          </Card>

          <Card title="Pricing Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Purchase Price (₹)" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchase_price}
                  onChange={(e) => set("purchase_price", e.target.value)}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="Sales Price (₹)" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sales_price}
                  onChange={(e) => set("sales_price", e.target.value)}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="MRP (₹)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.mrp}
                  onChange={(e) => set("mrp", e.target.value)}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="Standard Cost (₹)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.standard_cost}
                  onChange={(e) => set("standard_cost", e.target.value)}
                  className="ui-input w-full"
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card id="tax" title="Tax Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="GST Rate (%)" required>
                <select
                  value={form.gst_rate}
                  onChange={(e) => set("gst_rate", e.target.value)}
                  className="ui-select w-full"
                >
                  <option value="">Select GST Rate</option>
                  {GST_RATES.map((r) => (
                    <option key={r} value={r}>{r}%</option>
                  ))}
                </select>
              </Field>
              <Field label="GST Type" required>
                <select
                  value={form.gst_type}
                  onChange={(e) => set("gst_type", e.target.value)}
                  className="ui-select w-full"
                >
                  <option value="">Select GST Type</option>
                  {GST_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tax Type" className="sm:col-span-2">
                <select
                  value={form.tax_type}
                  onChange={(e) => set("tax_type", e.target.value)}
                  className="ui-select w-full"
                >
                  <option value="">Select Tax Type</option>
                  {TAX_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-4">
              <CheckRow
                checked={form.tax_exempt}
                onChange={(v) => set("tax_exempt", v)}
                label="Is Exempted from Tax"
                hint="Check if item is exempted from tax"
              />
            </div>
          </Card>

          <Card id="inventory" title="Inventory Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reorder Level" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.reorder_level}
                  onChange={(e) => set("reorder_level", e.target.value)}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="Reorder Quantity" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.reorder_qty}
                  onChange={(e) => set("reorder_qty", e.target.value)}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="Minimum Stock Level">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.min_stock}
                  onChange={(e) => set("min_stock", e.target.value)}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="Maximum Stock Level">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.max_stock}
                  onChange={(e) => set("max_stock", e.target.value)}
                  className="ui-input w-full"
                />
              </Field>
            </div>
            <div className="mt-4">
              <CheckRow
                checked={form.keep_stock}
                onChange={(v) => set("keep_stock", v)}
                label="Keep Stock"
                hint="Enable to track stock for this item"
              />
            </div>
          </Card>
        </div>

        <Card id="additional" title="Additional Information">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Batch Number">
              <input
                type="text"
                placeholder="Optional"
                value={form.batch_number}
                onChange={(e) => set("batch_number", e.target.value)}
                className="ui-input w-full"
              />
            </Field>
            <Field label="Serial Number">
              <input
                type="text"
                placeholder="Optional"
                value={form.serial_number}
                onChange={(e) => set("serial_number", e.target.value)}
                className="ui-input w-full"
              />
            </Field>
            <Field label="Warranty">
              <input
                type="text"
                placeholder="e.g. 12 Months"
                value={form.warranty}
                onChange={(e) => set("warranty", e.target.value)}
                className="ui-input w-full"
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
              <textarea
                rows={3}
                placeholder="Any additional notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="ui-textarea w-full"
              />
            </Field>
          </div>
        </Card>
      </form>

      <div className="sticky bottom-0 -mx-2 -mb-24 mt-8 z-20 border-t border-[var(--color-border-soft)] bg-[var(--color-surface)]/95 px-4 py-3.5 shadow-lg backdrop-blur sm:-mx-4 sm:px-6 lg:-mx-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pr-14 sm:pr-16">
          <CheckRow
            checked={form.is_active}
            onChange={(v) => set("is_active", v)}
            label="Item is Active"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" to={backPath}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-item-form"
              variant="primary"
              loading={saving}
              disabled={saving}
              className="!bg-[var(--color-action-teal)] hover:!bg-[var(--color-action-teal-hover)]"
            >
              <Save className="h-4 w-4" />
              Save & Create Item
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
