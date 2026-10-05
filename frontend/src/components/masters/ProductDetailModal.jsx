import { useState } from "react";
import { createPortal } from "react-dom";
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

function RelatedStatus({ loading, error, children, empty, emptyLabel }) {
  if (loading) {
    return <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Loading related records…</div>;
  }
  if (error) {
    return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">{error}</div>;
  }
  if (empty) {
    return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{emptyLabel}</div>;
  }
  return children;
}

function RelatedTable({ columns, rows, rowKey = "id" }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>{columns.map((column) => <th key={column.label} className="px-3 py-2.5 font-semibold">{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={row[rowKey] ?? index} className="text-slate-700">
              {columns.map((column) => <td key={column.label} className="px-3 py-3">{column.render ? column.render(row) : (row[column.key] ?? "—")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function ProductDetailModal({
  product,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  relatedData = {},
  loadingSections = {},
  sectionErrors = {},
  onLoadSection,
}) {
  const [tab, setTab] = useState("general");
  if (!product) return null;

  const formatPrice = (n) => (n != null ? `₹${Number(n).toLocaleString("en-IN")}` : "—");
  const sidebarWidth = typeof document !== "undefined"
    ? document.getElementById("app-sidebar")?.getBoundingClientRect().width || 0
    : 0;

  return createPortal((
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40"
      style={{
        paddingLeft: `calc(${sidebarWidth}px + 1rem)`,
        paddingRight: "1rem",
        paddingTop: "calc(var(--navbar-height, 3.5rem) + 1rem)",
        paddingBottom: "1rem",
      }}
    >
      <div
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "calc(100dvh - var(--navbar-height, 3.5rem) - 2rem)" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#2563EB]">{product.sku || "No SKU"}</p>
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
              onClick={() => {
                setTab(t.id);
                if (["bom", "suppliers", "purchase", "sales", "production", "audit"].includes(t.id)) {
                  onLoadSection?.(t.id, product);
                }
              }}
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
                <Field label="SKU" value={product.sku} />
                <Field label="Product Name" value={product.name} />
                <Field label="Category" value={product.category} />
                <Field label="Unit" value={product.unit} />
                <Field label="HSN Code" value={product.hsn_code} />
                <Field label="Goods & Services Tax (GST) %" value={product.gst_percent != null ? `${product.gst_percent}%` : "—"} />
                <Field label="Cess %" value={product.cess_percent != null ? `${product.cess_percent}%` : "—"} />
                <Field label="Status" value={product.status} />
                <Field label="Available for Sale" value={product.is_sellable ? "Yes" : "No"} />
              </div>
              <Field label="Description" value={product.description} />
            </div>
          )}

          {tab === "inventory" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Current Stock" value={product.current_stock} />
              <Field label="Minimum Stock" value={product.min_stock} />
              <Field label="Maximum Stock" value={product.max_stock} />
              <Field label="Unit" value={product.unit} />
            </div>
          )}

          {tab === "pricing" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Purchase Price" value={formatPrice(product.purchase_price)} />
              <Field label="Selling Price" value={formatPrice(product.selling_price)} />
              <Field label="Wholesale Price" value={formatPrice(product.wholesale_price)} />
              <Field label="Goods & Services Tax (GST) %" value={product.gst_percent != null ? `${product.gst_percent}%` : "—"} />
              <Field label="Cess %" value={product.cess_percent != null ? `${product.cess_percent}%` : "—"} />
              <Field label="HSN Code" value={product.hsn_code} />
            </div>
          )}

          {tab === "bom" && (() => {
            const rows = relatedData.bom || [];
            return (
              <div className="space-y-4">
                <RelatedStatus loading={loadingSections.bom} error={sectionErrors.bom} empty={!loadingSections.bom && !sectionErrors.bom && !rows.length} emptyLabel="No BOM components are linked to this product.">
                  <RelatedTable columns={[
                    { label: "Component", key: "component_name" },
                    { label: "SKU", key: "component_sku" },
                    { label: "Quantity", key: "quantity" },
                    { label: "Unit", key: "unit" },
                    { label: "Unit Cost", render: (row) => formatPrice(row.unit_cost) },
                    { label: "Line Cost", render: (row) => formatPrice(row.total_cost) },
                  ]} rows={rows} />
                </RelatedStatus>
                <Link to="/masters/bom" className="text-sm font-semibold text-[#2563EB] hover:underline">Open Bill of Materials (BOM) Master →</Link>
              </div>
            );
          })()}

          {tab === "suppliers" && (() => {
            const rows = relatedData.suppliers || [];
            return (
              <RelatedStatus loading={loadingSections.suppliers} error={sectionErrors.suppliers} empty={!loadingSections.suppliers && !sectionErrors.suppliers && !rows.length} emptyLabel="No suppliers are linked to this product yet.">
                <div className="grid gap-3 sm:grid-cols-2">
                  {rows.map((supplier) => (
                    <div key={supplier.id} className="rounded-xl border border-slate-200 p-4">
                      <p className="font-semibold text-slate-800">{supplier.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{supplier.vendor_code || "No vendor code"} · {supplier.status || "—"}</p>
                      <p className="mt-3 text-sm text-slate-600">{supplier.contact || supplier.phone || supplier.email || "No contact details"}</p>
                      {supplier.email && <p className="mt-1 text-xs text-slate-500">{supplier.email}</p>}
                    </div>
                  ))}
                </div>
              </RelatedStatus>
            );
          })()}

          {tab === "purchase" && (() => {
            const rows = relatedData.purchase || [];
            return (
              <div className="space-y-3">
                <RelatedStatus loading={loadingSections.purchase} error={sectionErrors.purchase} empty={!loadingSections.purchase && !sectionErrors.purchase && !rows.length} emptyLabel="No purchase order lines are linked to this product.">
                  <RelatedTable columns={[
                    { label: "Purchase Order", key: "order_number" },
                    { label: "Date", key: "order_date" },
                    { label: "Supplier", key: "supplier_name" },
                    { label: "Status", key: "status" },
                    { label: "Quantity", render: (row) => `${row.quantity} ${row.unit || ""}` },
                    { label: "Unit Price", render: (row) => formatPrice(row.unit_price) },
                    { label: "Total", render: (row) => formatPrice(row.line_total) },
                  ]} rows={rows} />
                </RelatedStatus>
                <Link to="/procurement/purchase-orders" className="text-sm font-semibold text-[#2563EB] hover:underline">View Purchase Orders →</Link>
              </div>
            );
          })()}

          {tab === "sales" && (() => {
            const rows = relatedData.sales || [];
            return (
              <div className="space-y-3">
                <RelatedStatus loading={loadingSections.sales} error={sectionErrors.sales} empty={!loadingSections.sales && !sectionErrors.sales && !rows.length} emptyLabel="No sales order lines are linked to this product.">
                  <RelatedTable columns={[
                    { label: "Sales Order", key: "order_number" },
                    { label: "Date", key: "order_date" },
                    { label: "Customer", key: "customer_name" },
                    { label: "Status", key: "status" },
                    { label: "Quantity", render: (row) => `${row.quantity} ${row.unit || ""}` },
                    { label: "Unit Price", render: (row) => formatPrice(row.unit_price) },
                    { label: "Total", render: (row) => formatPrice(row.line_total) },
                  ]} rows={rows} />
                </RelatedStatus>
                <Link to="/sales/orders" className="text-sm font-semibold text-[#2563EB] hover:underline">View Sales Orders →</Link>
              </div>
            );
          })()}

          {tab === "production" && (() => {
            const history = relatedData.production || {};
            const orders = history.orders || [];
            const reports = history.reports || [];
            const empty = !orders.length && !reports.length;
            return (
              <div className="space-y-5">
                <RelatedStatus loading={loadingSections.production} error={sectionErrors.production} empty={!loadingSections.production && !sectionErrors.production && empty} emptyLabel="No production orders or reports are linked to this product.">
                  <>
                    {orders.length > 0 && <section className="space-y-2"><h3 className="text-sm font-semibold text-slate-700">Production Orders</h3><RelatedTable columns={[
                      { label: "Order", key: "order_number" },
                      { label: "Status", key: "status" },
                      { label: "Planned", key: "planned_quantity" },
                      { label: "Produced", key: "actual_quantity" },
                      { label: "Start", key: "start_date" },
                      { label: "Due", key: "due_date" },
                    ]} rows={orders} /></section>}
                    {reports.length > 0 && <section className="space-y-2"><h3 className="text-sm font-semibold text-slate-700">Production Reports</h3><RelatedTable columns={[
                      { label: "Report Date", key: "report_date" },
                      { label: "Planned", key: "planned_quantity" },
                      { label: "Produced", key: "produced_quantity" },
                      { label: "Scrap", key: "scrap_quantity" },
                      { label: "Notes", key: "notes" },
                    ]} rows={reports} /></section>}
                  </>
                </RelatedStatus>
                <Link to="/production/planning" className="text-sm font-semibold text-[#2563EB] hover:underline">View Production Planning →</Link>
              </div>
            );
          })()}
          {tab === "documents" && <TabPlaceholder title="Documents" />}
          {tab === "audit" && (() => {
            const rows = relatedData.audit || [];
            return (
              <RelatedStatus
                loading={loadingSections.audit}
                error={sectionErrors.audit}
                empty={!loadingSections.audit && !sectionErrors.audit && !rows.length}
                emptyLabel="No audit events have been recorded for this product."
              >
                <RelatedTable
                  columns={[
                    { label: "Date & Time", render: (row) => formatDateTime(row.logged_at) },
                    { label: "Action", key: "action" },
                    { label: "User", key: "user" },
                    { label: "Role", key: "role" },
                    { label: "Details", key: "details" },
                  ]}
                  rows={rows}
                />
              </RelatedStatus>
            );
          })()}
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
  ), document.body);
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
