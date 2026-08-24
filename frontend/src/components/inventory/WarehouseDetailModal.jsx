import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownUp,
  FileText,
  Package,
  Truck,
  X,
} from "lucide-react";

import { DEMO_BIN_TREE } from "../../data/warehousesMasterData";

import Button from "../common/Button";
import { inputClass as dsInput } from "../../design-system/classes";

const inputClass = `${dsInput} mt-1`;
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "inventory", label: "Inventory" },
  { id: "ledger", label: "Stock Ledger" },
  { id: "transfers", label: "Transfers" },
  { id: "receipts", label: "Purchase Receipts" },
  { id: "production", label: "Production Issues" },
  { id: "dispatch", label: "Dispatch" },
  { id: "bins", label: "Bin & Rack" },
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

function formatInr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function BinTree({ nodes, depth = 0 }) {
  if (!nodes?.length) return null;
  return (
    <ul className={depth ? "ml-4 border-l border-slate-200 pl-3" : ""}>
      {nodes.map((node) => (
        <li key={node.name} className="py-1">
          <span className={`text-sm ${node.type === "bin" ? "font-medium text-[#2563EB]" : "font-semibold text-slate-700"}`}>
            {node.type === "rack" && "📦 "}
            {node.type === "shelf" && "📋 "}
            {node.type === "bin" && "📍 "}
            {node.name}
          </span>
          <BinTree nodes={node.children} depth={depth + 1} />
        </li>
      ))}
    </ul>
  );
}

export default function WarehouseDetailModal({ warehouse, detail, onClose, onEdit, onDeactivate }) {
  const [tab, setTab] = useState("overview");
  if (!warehouse) return null;

  const w = { ...warehouse, ...(detail || {}) };
  const binTree = detail?.bin_tree || [];

  const kpis = [
    { label: "Inventory Value", value: formatInr(w.inventory_value) },
    { label: "Utilization", value: w.utilization_pct != null ? `${w.utilization_pct}%` : "—" },
    { label: "Total Items", value: w.total_items ?? w.item_count ?? 0 },
    { label: "Low Stock", value: w.low_stock ?? w.low_stock_items ?? 0 },
    { label: "Daily Inward", value: w.daily_inward ?? 0 },
    { label: "Daily Outward", value: w.daily_outward ?? 0 },
  ];

  const stockItems = detail?.stock_items || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#2563EB]">{w.code}</p>
            <h2 className="text-xl font-bold text-slate-900">{w.name}</h2>
            <p className="text-sm text-slate-500">{w.branch} · {w.plant} · {w.manager_name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3 sm:grid-cols-6">
          {kpis.map((k) => (
            <div key={k.label} className="text-center">
              <p className="text-[10px] font-medium text-slate-500">{k.label}</p>
              <p className="text-sm font-bold text-slate-800">{k.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-5 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                tab === t.id ? "bg-[var(--color-primary)] text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "overview" && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">General Information</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Warehouse Code" value={w.code} />
                  <Field label="Warehouse Name" value={w.name} />
                  <Field label="Warehouse Type" value={w.warehouse_type} />
                  <Field label="Branch" value={w.branch} />
                  <Field label="Plant" value={w.plant} />
                  <Field label="Address" value={w.address} />
                  <Field label="Manager" value={w.manager_name} />
                  <Field label="Contact" value={w.manager_phone} />
                  <Field label="Status" value={w.status} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Storage Information</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Total Capacity" value={w.capacity?.toLocaleString()} />
                  <Field label="Used Capacity" value={w.used_capacity?.toLocaleString()} />
                  <Field label="Available" value={w.available_capacity?.toLocaleString()} />
                  <Field label="Rack Count" value={w.rack_count} />
                  <Field label="Bin Locations" value={w.bin_count} />
                  <Field label="Utilization" value={w.utilization_pct != null ? `${w.utilization_pct}%` : "—"} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Inventory Summary</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Raw Materials" value={w.raw_materials} />
                  <Field label="Finished Goods" value={w.finished_goods} />
                  <Field label="Work in Progress (WIP) Items" value={w.wip_items} />
                  <Field label="Total Items" value={w.total_items ?? w.item_count} />
                  <Field label="Inventory Value" value={formatInr(w.inventory_value)} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Stock Status</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Low Stock" value={w.low_stock ?? w.low_stock_items} />
                  <Field label="Out of Stock" value={w.out_of_stock} />
                  <Field label="Overstock" value={w.overstock} />
                  <Field label="Fast Moving" value={w.fast_moving} />
                  <Field label="Slow Moving" value={w.slow_moving} />
                  <Field label="Dead Stock" value={w.dead_stock} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Warehouse KPIs</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Stock Turnover" value={w.stock_turnover} />
                  <Field label="Daily Inward" value={w.daily_inward} />
                  <Field label="Daily Outward" value={w.daily_outward} />
                </div>
              </div>
            </div>
          )}

          {tab === "inventory" && (
            stockItems.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-400">
                    <th className="py-2">Stock Keeping Unit (SKU)</th>
                    <th className="py-2">Item</th>
                    <th className="py-2">Type</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {stockItems.map((item) => (
                    <tr key={item.item_id} className="border-b border-slate-50">
                      <td className="py-2">{item.sku}</td>
                      <td className="py-2 font-medium">{item.name}</td>
                      <td className="py-2 capitalize">{item.item_type?.replace("_", " ")}</td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">{formatInr(item.stock_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No stock items in this warehouse yet.
              </p>
            )
          )}

          {tab === "ledger" && (
            <Link to="/inventory/stock-ledger" className="text-sm font-semibold text-[#2563EB] hover:underline">
              View full stock ledger →
            </Link>
          )}

          {tab === "transfers" && (
            <Link to="/inventory/stock-transfer" className="text-sm font-semibold text-[#2563EB] hover:underline">
              Create stock transfer →
            </Link>
          )}

          {tab === "receipts" && (
            <Link to="/procurement/goods-receipt" className="text-sm font-semibold text-[#2563EB] hover:underline">
              View Goods Receipt Notes (GRN) →
            </Link>
          )}

          {tab === "production" && (
            <Link to="/production/create" className="text-sm font-semibold text-[#2563EB] hover:underline">
              Production material issue →
            </Link>
          )}

          {tab === "dispatch" && (
            <Link to="/sales/dispatch" className="text-sm font-semibold text-[#2563EB] hover:underline">
              View dispatch →
            </Link>
          )}

          {tab === "bins" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-800">Bin & Rack Layout</h3>
              <BinTree nodes={binTree} />
            </div>
          )}

          {tab === "documents" && (
            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Warehouse documents — link from Document Management.
            </p>
          )}

          {tab === "audit" && (
            <Link to="/admin/access-logs" className="text-sm font-semibold text-[#2563EB] hover:underline">
              View audit logs →
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">
          <Button variant="primary" size="sm" to="/inventory/stock-transfer" leftIcon={<ArrowDownUp className="h-3.5 w-3.5" aria-hidden />}>
            Stock Transfer
          </Button>
          <Link to={`/inventory/stock-ledger`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Package className="h-3.5 w-3.5" /> Stock Ledger
          </Link>
          <Link to="/procurement/goods-receipt" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Truck className="h-3.5 w-3.5" /> Goods Receipt Note (GRN) Receipt
          </Link>
          <button type="button" onClick={() => onEdit?.(w)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Edit
          </button>
          {w.status === "active" && (
            <button type="button" onClick={() => onDeactivate?.(w)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
              Deactivate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


export function WarehouseFormModal({ warehouse, onClose, onSave }) {
  const [form, setForm] = useState({
    name: warehouse?.name || "",
    code: warehouse?.code || "",
    branch: warehouse?.branch || "",
    plant: warehouse?.plant || "",
    warehouse_type: warehouse?.warehouse_type || "General",
    state: warehouse?.state || "",
    city: warehouse?.city || "",
    address: warehouse?.address || "",
    manager_name: warehouse?.manager_name || "",
    manager_phone: warehouse?.manager_phone || "",
    capacity: warehouse?.capacity || "",
    used_capacity: warehouse?.used_capacity ?? 0,
    available_capacity: warehouse?.available_capacity ?? "",
    is_primary: warehouse?.is_primary || false,
    status: warehouse?.status || "active",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900">{warehouse?.id ? "Edit Warehouse" : "Create Warehouse"}</h2>
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Warehouse Code *
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Status
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="block sm:col-span-2 text-sm font-medium text-slate-700">
              Warehouse Name *
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Branch
              <input
                type="text"
                value={form.branch}
                onChange={(e) => set("branch", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Plant
              <input
                type="text"
                value={form.plant}
                onChange={(e) => set("plant", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Manager
              <input
                type="text"
                value={form.manager_name}
                onChange={(e) => set("manager_name", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Contact Number
              <input
                type="text"
                value={form.manager_phone}
                onChange={(e) => set("manager_phone", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Capacity
              <input
                type="number"
                min="0"
                value={form.capacity}
                onChange={(e) => set("capacity", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Used Capacity
              <input
                type="number"
                min="0"
                value={form.used_capacity}
                onChange={(e) => set("used_capacity", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block sm:col-span-2 text-sm font-medium text-slate-700">
              Available Capacity
              <input
                type="number"
                min="0"
                placeholder={form.capacity && form.used_capacity != null ? Math.max(0, form.capacity - form.used_capacity) : "Auto-calculated"}
                value={form.available_capacity}
                onChange={(e) => set("available_capacity", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              City
              <input
                type="text"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              State
              <input
                type="text"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block sm:col-span-2 text-sm font-medium text-slate-700">
              Address
              <input
                type="text"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm pt-1">
            <input type="checkbox" checked={form.is_primary} onChange={(e) => set("is_primary", e.target.checked)} />
            Primary warehouse
          </label>
          <div className="flex gap-2 pt-2">
            <Button variant="primary" type="submit" >Save Warehouse</Button>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
