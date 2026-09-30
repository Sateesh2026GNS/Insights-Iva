import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Barcode,
  Copy,
  History,
  QrCode,
  Trash2,
  X,
} from "lucide-react";
import { PRODUCT_UNITS } from "../../data/productsMasterData";

import Button from "../common/Button";
const TABS = [
  { id: "general", label: "General" },
  { id: "inventory", label: "Inventory" },
  { id: "pricing", label: "Pricing" },
  { id: "bom", label: "Bill of Materials (BOM)" },
  { id: "suppliers", label: "Suppliers" },
  { id: "purchase", label: "Purchase History" },
  { id: "sales", label: "Sales History" },
  { id: "production", label: "Production History" },
  { id: "documents", label: "Documents" },
  { id: "audit", label: "Audit Logs" },
];

function Field({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value ?? "—"}</p>
    </div>
  );
}

function TabPlaceholder({ title }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {title} — connect to backend module when available.
    </div>
  );
}

export default function ProductDetailModal({
  product,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}) {
  const [tab, setTab] = useState("general");
  if (!product) return null;

  const formatPrice = (n) => (n != null ? `₹${Number(n).toLocaleString("en-IN")}` : "—");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#2563EB]">{product.product_code}</p>
            <h2 className="text-xl font-bold text-slate-900">{product.name}</h2>
            <p className="text-sm text-slate-500">{product.category}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.id
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "general" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Product Code" value={product.product_code} />
                <Field label="Product Name" value={product.name} />
                <Field label="Category" value={product.category} />
                <Field label="Product Type" value={product.product_type} />

                <Field label="Barcode" value={product.barcode} />
                <Field label="Brand" value={product.brand} />
                <Field label="Unit" value={product.unit} />
                <Field label="HSN Code" value={product.hsn_code} />
                <Field label="Goods & Services Tax (GST) %" value={product.gst_percent != null ? `${product.gst_percent}%` : "—"} />
                <Field label="Warehouse" value={product.warehouse} />
                <Field label="Status" value={product.status} />
                <Field label="Available for Sale" value={product.is_sellable ? "Yes" : "No"} />
              </div>
              <Field label="Description" value={product.description} />
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Manufacturing</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Bill of Materials" value={product.bom} />
                  <Field label="Production Time" value={product.production_time} />
                  <Field label="Machine Required" value={product.machine_required} />
                  <Field label="Quality Standard" value={product.quality_standard} />
                  <Field label="Batch Tracking" value={product.batch_tracking ? "Yes" : "No"} />
                  <Field label="Serial Number" value={product.serial_number ? "Yes" : "No"} />
                  <Field label="Expiry Date" value={product.expiry_date || "N/A"} />
                </div>
              </div>
            </div>
          )}

          {tab === "inventory" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Current Stock" value={product.current_stock} />
              <Field label="Minimum Stock" value={product.min_stock} />
              <Field label="Maximum Stock" value={product.max_stock} />
              <Field label="Warehouse" value={product.warehouse} />
              <Field label="Unit" value={product.unit} />
              <Field label="Stock Value" value={formatPrice(product.stock_value)} />
            </div>
          )}

          {tab === "pricing" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Purchase Price" value={formatPrice(product.purchase_price)} />
              <Field label="Selling Price" value={formatPrice(product.selling_price)} />
              <Field label="Goods & Services Tax (GST) %" value={product.gst_percent != null ? `${product.gst_percent}%` : "—"} />
              <Field label="HSN Code" value={product.hsn_code} />
              <Field label="Margin" value={
                product.selling_price && product.purchase_price
                  ? formatPrice(product.selling_price - product.purchase_price)
                  : "—"
              } />
            </div>
          )}

          {tab === "bom" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Bill of Materials (BOM) reference: <strong>{product.bom}</strong></p>
              <Link to="/masters/bom" className="text-sm font-semibold text-[#2563EB] hover:underline">
                Open Bill of Materials (BOM) Master →
              </Link>
            </div>
          )}

          {tab === "suppliers" && <TabPlaceholder title="Suppliers" />}
          {tab === "purchase" && (
            <div className="space-y-2">
              <TabPlaceholder title="Purchase History" />
              <Link to="/procurement/purchase-orders" className="text-sm font-semibold text-[#2563EB] hover:underline">
                View Purchase Orders →
              </Link>
            </div>
          )}
          {tab === "sales" && (
            <div className="space-y-2">
              <TabPlaceholder title="Sales History" />
              <Link to="/sales/orders" className="text-sm font-semibold text-[#2563EB] hover:underline">
                View Sales Orders →
              </Link>
            </div>
          )}
          {tab === "production" && (
            <div className="space-y-2">
              <TabPlaceholder title="Production History" />
              <Link to="/production/work-orders" className="text-sm font-semibold text-[#2563EB] hover:underline">
                View Work Orders →
              </Link>
            </div>
          )}
          {tab === "documents" && <TabPlaceholder title="Documents" />}
          {tab === "audit" && <TabPlaceholder title="Audit Logs" />}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <Button type="button" onClick={() => onEdit(product)} variant="primary" className="text-xs">
            Edit
          </Button>
          <button type="button" onClick={() => onDuplicate(product)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Barcode className="h-3.5 w-3.5" /> Print Barcode
          </button>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <QrCode className="h-3.5 w-3.5" /> Print QR
          </button>
          <Link to="/inventory/stock-ledger" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 no-underline">
            <History className="h-3.5 w-3.5" /> Stock Ledger
          </Link>
          <button type="button" onClick={() => onDelete(product)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProductFormModal({ product, onClose, onSave }) {
  const isEdit = Boolean(product?.id && !String(product.id).startsWith("demo-") && !String(product.id).startsWith("new-"));
  const [form, setForm] = useState({
    product_code: product?.product_code || "",
    name: product?.name || "",
    category: product?.category || "Finished Goods",
    product_type: product?.product_type || "Finished Goods",
    unit: product?.unit || product?.unit_of_measure || product?.uom || "PCS",
    brand: product?.brand || "",
    warehouse: product?.warehouse || "Main Store",
    quantity: product?.quantity ?? "",
    price_per_unit: product?.price_per_unit ?? product?.selling_price ?? product?.price ?? "",
    description: product?.description || "",
    status: product?.status || "active",
    is_sellable: Boolean(product?.is_sellable),
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const qty = Number(form.quantity) || 0;
  const ppu = Number(form.price_per_unit) || 0;
  const totalCost = qty * ppu;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !/[a-zA-Z0-9]/.test(form.name.trim())) {
      window.alert("Product Name must contain at least one letter or number and cannot consist only of special characters.");
      return;
    }
    if (!form.price_per_unit || isNaN(ppu) || ppu <= 0) {
      window.alert(ppu < 0 ? "Purchase Price cannot be negative." : "Please enter a valid Price per Unit (must be a positive number).");
      return;
    }
    if (!form.quantity || isNaN(qty) || qty <= 0) {
      window.alert("Please enter a valid Quantity (must be a positive number).");
      return;
    }
    onSave({
      ...form,
      quantity: qty,
      price_per_unit: ppu,
      selling_price: totalCost,
      purchase_price: totalCost,
      total_cost: totalCost,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? "Edit Product" : "Add Product"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          <label>
            <span className="text-xs font-semibold text-slate-500">Product Code</span>
            <input
              value={form.product_code}
              onChange={(e) => set("product_code", e.target.value)}
              placeholder="e.g. PRD001"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-slate-500">Product Name *</span>
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>

          <label>
            <span className="text-xs font-semibold text-slate-500">Category</span>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {["Raw Material", "Work in Progress (WIP)", "Finished Goods", "Consumables", "Spare Parts"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-slate-500">Unit</span>
            <select
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-slate-500">Quantity *</span>
            <input
              required
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 20"
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="text-xs font-semibold text-slate-500">Price per Unit (₹) *</span>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 100"
              value={form.price_per_unit}
              onChange={(e) => set("price_per_unit", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          {qty > 0 && ppu > 0 && (
            <div className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-600">
                {qty} {form.unit} × ₹{ppu.toLocaleString("en-IN")} per unit
              </span>
              <span className="text-base font-bold text-blue-700">
                Total: ₹{totalCost.toLocaleString("en-IN")}
              </span>
            </div>
          )}
          <label className="sm:col-span-2">
            <span className="text-xs font-semibold text-slate-500">Status</span>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-semibold text-slate-500">Description</span>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
          <Button variant="primary" type="submit" >{isEdit ? "Save Changes" : "Add Product"}</Button>
        </div>
      </form>
    </div>
  );
}
