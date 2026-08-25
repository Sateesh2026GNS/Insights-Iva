import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  FileText,
  History,
  Package,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { addBomItem, deleteBomItem, getBillOfMaterials } from "../../api/bomApi";
import { getProducts } from "../../api/productsApi";
import { DEMO_PRODUCTS, enrichApiProduct } from "../../data/productsMasterData";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";

import Button from "../common/Button";
import { DocumentEmptyIcon } from "../common/EmptyState";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "components", label: "Components" },
  { id: "costing", label: "Costing" },
  { id: "routing", label: "Routing" },
  { id: "machines", label: "Machines" },
  { id: "inventory", label: "Inventory" },
  { id: "documents", label: "Documents" },
  { id: "versions", label: "Version History" },
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

function StatusPill({ status }) {
  const styles = {
    active: "bg-green-100 text-green-700",
    draft: "bg-amber-100 text-amber-700",
    inactive: "bg-slate-100 text-slate-600",
    pending_approval: "bg-blue-100 text-blue-700",
    low_stock: "bg-orange-100 text-orange-700",
    available: "bg-green-100 text-green-700",
    completed: "bg-green-100 text-green-700",
    pending: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${styles[status] || "bg-slate-100 text-slate-600"}`}>
      {String(status).replace(/_/g, " ")}
    </span>
  );
}

function WorkflowStep({ step, index, total }) {
  const Icon = step.status === "completed" ? CheckCircle2 : step.status === "active" ? Clock : Circle;
  const color = step.status === "completed" ? "text-green-500" : step.status === "active" ? "text-[#2563EB]" : "text-slate-300";
  return (
    <div className="flex flex-col items-center">
      <Icon className={`h-6 w-6 ${color}`} />
      <p className="mt-1 text-xs font-semibold text-slate-700">{step.step}</p>
      <p className="text-[10px] text-slate-400">{step.date !== "—" ? step.date : "Pending"}</p>
      {index < total - 1 && <ArrowDown className="my-1 h-4 w-4 text-slate-300" />}
    </div>
  );
}

function AddComponentModal({ open, onClose, onAdd, bomId }) {
  const [form, setForm] = useState({
    component: "",
    item_code: "",
    category: "Raw Material",
    unit: "Nos",
    qty: 1,
    unit_cost: 0,
  });
  const [busy, setBusy] = useState(false);
  const { addToast } = useToast();

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = form.component.trim();
    if (!name) {
      addToast("Component name is required.", "error");
      return;
    }
    const quantity = Number(form.qty);
    if (isNaN(quantity) || quantity <= 0) {
      addToast("Quantity must be greater than 0.", "error");
      return;
    }
    const cost = Number(form.unit_cost) || 0;
    if (cost < 0) {
      addToast("Unit cost cannot be negative.", "error");
      return;
    }

    setBusy(true);
    try {
      const newComp = {
        id: Date.now(),
        component: name,
        item_code: form.item_code.trim() || `RM-${Date.now().toString().slice(-4)}`,
        category: form.category || "Raw Material",
        unit: form.unit || "Nos",
        qty: quantity,
        unit_cost: cost,
        total_cost: quantity * cost,
      };

      if (bomId && typeof bomId === "number") {
        try {
          await addBomItem({
            bom_id: bomId,
            component_id: newComp.id,
            qty: quantity,
            unit_cost: cost,
          });
        } catch {
          // ignore offline / demo fallback
        }
      }

      onAdd(newComp);
      addToast("Component added successfully.");
      onClose();
    } catch (err) {
      addToast("Failed to add component.", "error");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Add Component</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Component Name *</label>
          <input
            required
            value={form.component}
            onChange={(e) => setForm((f) => ({ ...f, component: e.target.value }))}
            placeholder="e.g. Active Ingredient / Raw Material"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Item Code</label>
            <input
              value={form.item_code}
              onChange={(e) => setForm((f) => ({ ...f, item_code: e.target.value }))}
              placeholder="e.g. RM-001"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="Raw Material">Raw Material</option>
              <option value="Semi-Finished">Semi-Finished</option>
              <option value="Consumables">Consumables</option>
              <option value="Spare Parts">Spare Parts</option>
              <option value="Packaging">Packaging</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Unit</label>
            <select
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500"
            >
              {PRODUCT_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Qty *</label>
            <input
              type="number"
              min="0.001"
              step="any"
              required
              value={form.qty}
              onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Unit Cost (₹)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.unit_cost}
              onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy} loading={busy}>
            {busy ? "Adding..." : "Add Component"}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export default function BomDetailModal({ bom, onClose, onEdit, onCopy, onDelete, onPrint, onRefresh }) {
  const [tab, setTab] = useState("overview");
  const [addComponentOpen, setAddComponentOpen] = useState(false);
  const [localComponents, setLocalComponents] = useState(bom?.components || []);
  const { addToast } = useToast();

  useEffect(() => {
    setLocalComponents(bom?.components || []);
  }, [bom?.components]);

  if (!bom) return null;

  const formatInr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
  const componentCount = localComponents.length;

  const handleDeleteLine = async (lineId) => {
    if (!window.confirm("Remove this component line?")) return;
    try {
      if (typeof lineId === "number") {
        await deleteBomItem(lineId);
      }
      setLocalComponents((prev) => prev.filter((c) => c.id !== lineId));
      if (bom) bom.components = (bom.components || []).filter((c) => c.id !== lineId);
      addToast("Component removed");
      onRefresh?.();
    } catch {
      addToast("Failed to remove component", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#2563EB]">{bom.bom_number}</p>
            <h2 className="text-xl font-bold text-slate-900">{bom.product_name || bom.product}</h2>
            <p className="text-sm text-slate-500">{bom.product_code} · {bom.version} · {componentCount} components</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-5 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t.id ? "bg-[var(--color-primary)] text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "overview" && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Bill of Materials (BOM) Information</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Bill of Materials (BOM) Number" value={bom.bom_number} />
                  <Field label="Product Name" value={bom.product_name || bom.product} />
                  <Field label="Product Code" value={bom.product_code} />
                  <Field label="Version" value={bom.version} />
                  <Field label="Revision" value={bom.revision} />
                  <Field label="Status" value={<StatusPill status={bom.status} />} />
                  <Field label="Effective Date" value={bom.effective_date || "—"} />
                  <Field label="Expiry Date" value={bom.expiry_date || "N/A"} />
                  <Field label="Created By" value={bom.created_by} />
                  <Field label="Approved By" value={bom.approved_by} />
                </div>
                  <div className="mt-3"><Field label="Description" value={bom.description} /></div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Approval Workflow</h3>
                <div className="flex flex-wrap items-start justify-center gap-2 rounded-xl bg-slate-50 p-4">
                  {(bom.approval_workflow || []).map((step, i, arr) => (
                    <WorkflowStep key={step.step} step={step} index={i} total={arr.length} />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link to="/masters/products" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#2563EB] hover:bg-blue-50 no-underline">View Product</Link>
                <Link to="/inventory/raw-materials" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 no-underline">View Inventory</Link>
                <Link to="/procurement/purchase-orders" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 no-underline">Purchase Orders</Link>
                <Link to="/production/work-orders" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 no-underline">Production Orders</Link>
                <Link to="/quality/inspection" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 no-underline">Quality Reports</Link>
              </div>
            </div>
          )}

          {tab === "components" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">BOM Components</h3>
                <Button type="button" variant="add" size="sm" onClick={() => setAddComponentOpen(true)} leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden />}>
                  Add Component
                </Button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Component</th>
                      <th className="px-3 py-2">Item Code</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Unit</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Unit Cost</th>
                      <th className="px-3 py-2">Total Cost</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localComponents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-10 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <DocumentEmptyIcon className="mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
                            <p className="text-sm font-medium text-slate-500">No components added yet</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      localComponents.map((c, i) => (
                        <tr key={c.id || i} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium">{c.component}</td>
                          <td className="px-3 py-2">{c.item_code}</td>
                          <td className="px-3 py-2">{c.category}</td>
                          <td className="px-3 py-2">{c.unit}</td>
                          <td className="px-3 py-2">{c.qty}</td>
                          <td className="px-3 py-2">{formatInr(c.unit_cost)}</td>
                          <td className="px-3 py-2 font-semibold">{formatInr(c.total_cost)}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteLine(c.id)}
                              className="text-red-500 hover:text-red-700"
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "costing" && bom.costing && (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Material Cost", bom.costing.material_cost],
                ["Labour Cost", bom.costing.labour_cost],
                ["Machine Cost", bom.costing.machine_cost],
                ["Electricity Cost", bom.costing.electricity_cost],
                ["Overhead Cost", bom.costing.overhead_cost],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-600">{label}</span>
                  <span className="font-bold text-slate-900">{formatInr(val)}</span>
                </div>
              ))}
              <div className="sm:col-span-2 flex justify-between rounded-xl bg-[var(--color-primary)]/10 px-4 py-4">
                <span className="font-bold text-[#2563EB]">Total Manufacturing Cost</span>
                <span className="text-xl font-bold text-[#2563EB]">{formatInr(bom.costing.total_cost)}</span>
              </div>
            </div>
          )}

          {tab === "routing" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Operation</th>
                    <th className="px-3 py-2">Work Center</th>
                    <th className="px-3 py-2">Machine</th>
                    <th className="px-3 py-2">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {(bom.routing || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-10 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <DocumentEmptyIcon className="mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm font-medium text-slate-500">No routing defined</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    bom.routing.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium">{r.operation}</td>
                        <td className="px-3 py-2">{r.work_center}</td>
                        <td className="px-3 py-2">{r.machine}</td>
                        <td className="px-3 py-2">{r.duration}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "machines" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Machine Name</th>
                    <th className="px-3 py-2">Machine Code</th>
                    <th className="px-3 py-2">Capacity</th>
                    <th className="px-3 py-2">Operators</th>
                    <th className="px-3 py-2">Setup Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(bom.machines || []).map((m, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">{m.name}</td>
                      <td className="px-3 py-2">{m.code}</td>
                      <td className="px-3 py-2">{m.capacity}</td>
                      <td className="px-3 py-2">{m.operator_required}</td>
                      <td className="px-3 py-2">{m.setup_time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "inventory" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Component</th>
                    <th className="px-3 py-2">Required</th>
                    <th className="px-3 py-2">Available</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(bom.inventory_availability || []).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">{row.component}</td>
                      <td className="px-3 py-2">{row.required}</td>
                      <td className="px-3 py-2">{row.available}</td>
                      <td className="px-3 py-2"><StatusPill status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "documents" && (
            <ul className="space-y-2">
              {(bom.documents || []).length === 0 ? (
                <li className="text-sm text-slate-400">No documents attached</li>
              ) : (
                bom.documents.map((d, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
                    <FileText className="h-5 w-5 text-[#2563EB]" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{d.name}</p>
                      <p className="text-xs text-slate-500">{d.type} · {d.size}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          )}

          {tab === "versions" && (
            <ul className="space-y-3">
              {(bom.version_history || []).map((v, i) => (
                <li key={i} className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#2563EB]">{v.version}</span>
                    <span className="text-xs text-slate-400">{v.date}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{v.changes}</p>
                  <p className="text-xs text-slate-500">By {v.author}</p>
                </li>
              ))}
            </ul>
          )}

          {tab === "audit" && bom.audit && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Created By" value={bom.audit.created_by} />
              <Field label="Modified By" value={bom.audit.modified_by} />
              <Field label="Approved By" value={bom.audit.approved_by} />
              <Field label="Modified Date" value={bom.audit.modified_date} />
              <div className="col-span-2"><Field label="Remarks" value={bom.audit.remarks} /></div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <Button type="button" onClick={() => onEdit(bom)} variant="edit" size="sm">Edit BOM</Button>
          <button type="button" onClick={() => onCopy(bom)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Copy className="h-3.5 w-3.5" /> Copy BOM
          </button>
          <button type="button" onClick={() => onPrint(bom)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <FileText className="h-3.5 w-3.5" /> Print PDF
          </button>
          <Link to="/production/work-orders/create-quick" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 no-underline">
            <Package className="h-3.5 w-3.5" /> Create Production Order
          </Link>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <History className="h-3.5 w-3.5" /> Material Requirement
          </button>
          <button type="button" onClick={() => onDelete(bom)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>
      <AddComponentModal
        open={addComponentOpen}
        onClose={() => setAddComponentOpen(false)}
        onAdd={(newComp) => {
          setLocalComponents((prev) => [...prev, newComp]);
          if (bom) bom.components = [...(bom.components || []), newComp];
          onRefresh?.();
        }}
        bomId={bom?.id}
      />
    </div>
  );
}

export function normalizeVersion(v) {
  if (!v) return "1.0";
  return String(v).trim().toUpperCase().replace(/^V/, "") || "1.0";
}

export function checkDuplicateBom(candidateBom, existingBoms, currentBomId = null) {
  if (!candidateBom || !Array.isArray(existingBoms)) return false;

  const candId = String(currentBomId || candidateBom.id || "");
  const candName = String(candidateBom.product_name || candidateBom.product || candidateBom.name || "").trim().toLowerCase();
  const candCode = String(candidateBom.product_code || candidateBom.product_id || candidateBom.sku || "").trim().toLowerCase();
  const candVer = normalizeVersion(candidateBom.version);

  return existingBoms.some((b) => {
    const bId = String(b.id || "");
    if (candId && bId && candId === bId) return false;

    const bName = String(b.product_name || b.product || b.name || "").trim().toLowerCase();
    const bCode = String(b.product_code || b.product_id || b.sku || "").trim().toLowerCase();
    const bVer = normalizeVersion(b.version);

    if (candVer !== bVer) return false;

    const nameMatches = candName && bName && candName === bName;
    const codeMatches = candCode && bCode && candCode === bCode;

    return nameMatches || codeMatches;
  });
}

/**
 * BomFormModal — Create or edit a full Bill of Materials.
 */
export function BomFormModal({ bom, onClose, onSave, existingBoms = [] }) {
  const { addToast } = useToast();

  const [form, setForm] = useState({
    bom_number: bom?.bom_number || "",
    version: bom?.version || "V1.0",
    product_name: bom?.product_name || bom?.product || "",
    product_code: bom?.product_code || "",
    total_cost: bom?.costing?.total_cost ?? "",
    status: bom?.status || "active",
    description: bom?.description || "",
  });

  const [errors, setErrors] = useState({});
  const [productOptions, setProductOptions] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [existingBomNumbers, setExistingBomNumbers] = useState([]);
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const wrapperRef = useRef(null);

  const [nameQuery, setNameQuery] = useState("");
  const [nameDropdownOpen, setNameDropdownOpen] = useState(false);
  const nameWrapperRef = useRef(null);

  const [saving, setSaving] = useState(false);

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    let mounted = true;
    setLoadingProducts(true);
    getProducts()
      .then((res) => {
        const apiData = res?.data || [];
        const combined = apiData.length > 0 ? apiData : DEMO_PRODUCTS;
        const rows = combined.map((r) => enrichApiProduct(r));
        if (mounted) setProductOptions(rows);
      })
      .catch(() => {
        if (mounted) setProductOptions(DEMO_PRODUCTS.map((r) => enrichApiProduct(r)));
      })
      .finally(() => mounted && setLoadingProducts(false));
    return () => (mounted = false);
  }, []);

  useEffect(() => {
    let mounted = true;
    getBillOfMaterials()
      .then((res) => {
        const rows = res?.data || [];
        const nums = rows.map((r) => r.bom_number);
        if (mounted) setExistingBomNumbers(nums.filter(Boolean));
      })
      .catch(() => {
        if (mounted) setExistingBomNumbers([]);
      });
    return () => (mounted = false);
  }, []);

  // close dropdowns when clicking outside
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (nameWrapperRef.current && !nameWrapperRef.current.contains(e.target)) {
        setNameDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const q = (query || form.product_code || "").toLowerCase().trim();
  const filteredOptions = productOptions.filter((p) => {
    if (!q) return true;
    return (
      (p.product_code || "").toLowerCase().includes(q) ||
      (p.name || "").toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q)
    );
  });

  const nq = (nameQuery || form.product_name || "").toLowerCase().trim();
  const filteredNameOptions = productOptions.filter((p) => {
    if (!nq) return true;
    return (
      (p.name || "").toLowerCase().includes(nq) ||
      (p.product_code || "").toLowerCase().includes(nq) ||
      (p.sku || "").toLowerCase().includes(nq)
    );
  });

  const handleSelectProduct = (p) => {
    if (!p) return;
    const code = p.product_code || p.sku || (p.id ? `PRD-${String(p.id).padStart(3, "0")}` : "");
    const name = (p.name || "").trim();

    setForm((prev) => ({
      ...prev,
      product_code: code || prev.product_code,
      product_name: name || prev.product_name,
      total_cost: p.selling_price ?? p.total_cost ?? p.price_per_unit ?? p.purchase_price ?? p.unit_cost ?? prev.total_cost,
      status: p.status || prev.status || "active",
      description: p.description || prev.description,
    }));

    setErrors((prev) => ({
      ...prev,
      ...(code ? { product_code: null } : {}),
      ...(name ? { product_name: null } : {}),
    }));
  };

  const handleSelectProductCode = (code) => {
    setField("product_code", code);
    if (code && errors.product_code) {
      setErrors((prev) => ({ ...prev, product_code: null }));
    }
    if (!code) return;
    const p = productOptions.find(
      (x) =>
        x.product_code === code ||
        x.sku === code ||
        String(x.id) === String(code)
    );
    if (p) {
      handleSelectProduct(p);
    }
  };

  const handleProductNameChange = (val) => {
    setField("product_name", val);
    setNameQuery(val);
    setNameDropdownOpen(true);
    if (errors.product_name && val.trim() !== "") {
      setErrors((prev) => ({ ...prev, product_name: null }));
    }

    if (val.trim()) {
      const match = productOptions.find(
        (x) =>
          (x.name || "").toLowerCase().trim() === val.toLowerCase().trim() ||
          (x.product_code || "").toLowerCase().trim() === val.toLowerCase().trim()
      );
      if (match) {
        handleSelectProduct(match);
      }
    }
  };

  const [allExistingBoms, setAllExistingBoms] = useState([]);

  useEffect(() => {
    let mounted = true;
    getBillOfMaterials()
      .then((res) => {
        const rows = res?.data || [];
        if (mounted) setAllExistingBoms(rows);
      })
      .catch(() => {});
    return () => (mounted = false);
  }, []);

  const validateForm = () => {
    const errs = {};
    const bomNo = String(form.bom_number || "").trim();
    const prodCode = String(form.product_code || "").trim();
    const prodName = String(form.product_name || "").trim();
    const version = String(form.version || "").trim();

    if (!bomNo) {
      errs.bom_number = "BOM No is required and cannot be blank or contain only spaces.";
    }
    if (!prodCode) {
      errs.product_code = "Product Code is required and cannot be blank or contain only spaces.";
    }
    if (!prodName) {
      errs.product_name = "Product Name is required and cannot be blank or contain only spaces.";
    } else if (!/[a-zA-Z0-9]/.test(prodName)) {
      errs.product_name = "Please enter a valid product name.";
    }
    if (!version) {
      errs.version = "Version is required and cannot be blank or contain only spaces.";
    }

    if (prodName && prodCode && productOptions && productOptions.length > 0) {
      const matchByName = productOptions.find(
        (x) => (x.name || "").toLowerCase().trim() === prodName.toLowerCase()
      );
      const matchByCode = productOptions.find(
        (x) =>
          (x.product_code || "").toLowerCase().trim() === prodCode.toLowerCase() ||
          (x.sku || "").toLowerCase().trim() === prodCode.toLowerCase()
      );

      if (matchByName && matchByCode && matchByName.id !== matchByCode.id) {
        errs.product_code = `Product Code "${prodCode}" belongs to "${matchByCode.name}", not "${prodName}".`;
      } else if (matchByName && !matchByCode) {
        const expectedCode = matchByName.product_code || matchByName.sku || (matchByName.id ? `PRD-${String(matchByName.id).padStart(3, "0")}` : "");
        if (expectedCode && expectedCode.toLowerCase() !== prodCode.toLowerCase()) {
          errs.product_code = `Product Code "${prodCode}" does not match selected Product Name "${prodName}". Expected "${expectedCode}".`;
        }
      }
    }

    setErrors(errs);
    return { isValid: Object.keys(errs).length === 0, errs, bomNo, prodCode, prodName, version };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { isValid, errs, bomNo, prodCode, prodName, version } = validateForm();

    if (!isValid) {
      const firstKey = Object.keys(errs)[0];
      if (firstKey && errs[firstKey]) {
        addToast(errs[firstKey], "error");
      }
      return;
    }

    const existingList = [
      ...(existingBoms || []),
      ...(bom?._existingBoms || []),
      ...allExistingBoms,
    ];

    // Validate BOM number uniqueness
    const entered = bomNo;
    const dupBomNo = existingList.find(
      (b) => String(b.id) !== String(bom?.id) &&
             b.bom_number &&
             String(b.bom_number).trim().toLowerCase() === entered.toLowerCase()
    );
    if (dupBomNo) {
      setErrors((prev) => ({ ...prev, bom_number: `BOM No "${entered}" already exists.` }));
      addToast("BOM No already exists — please choose a unique BOM No", "error");
      return;
    }

    // Validate Product + Version uniqueness
    const isDup = checkDuplicateBom(
      { id: bom?.id, product_name: prodName, product_code: prodCode, version },
      existingList,
      bom?.id
    );

    if (isDup) {
      addToast(
        `A BOM for product "${prodName}" with version "${version}" already exists. Duplicate BOMs for the same product and version are not allowed.`,
        "error"
      );
      return;
    }

    setSaving(true);
    const costVal = form.total_cost !== "" && form.total_cost != null ? Number(form.total_cost) : 0;

    const savedBom = {
      id: bom?.id || `bom-custom-${Date.now()}`,
      bom_number: bomNo,
      product_name: prodName,
      product: prodName,
      product_code: prodCode,
      version: version || "V1.0",
      status: form.status || "active",
      category: bom?.category || "Finished Goods",
      warehouse: bom?.warehouse || "Main Store",
      description: String(form.description || "").trim(),
      created_by: bom?.created_by || "Store Manager",
      created_date: bom?.created_date || new Date().toISOString().slice(0, 10),
      last_updated: "Just now",
      components: bom?.components || [
        { id: 1, component: "Raw Material Item", item_code: "RM-001", category: "Raw Material", unit: "Nos", qty: 1, unit_cost: costVal, total_cost: costVal }
      ],
      costing: {
        material_cost: costVal,
        labour_cost: Math.round(costVal * 0.2),
        machine_cost: Math.round(costVal * 0.1),
        electricity_cost: Math.round(costVal * 0.05),
        overhead_cost: Math.round(costVal * 0.08),
        total_cost: costVal,
      },
    };

    setSaving(false);
    onSave(savedBom);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        noValidate
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {bom?.id ? "Edit BOM" : "Create BOM"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Row 1: BOM No */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            BOM No *
          </label>
          <input
            value={form.bom_number}
            onChange={(e) => {
              const val = e.target.value;
              setField("bom_number", val);
              if (errors.bom_number && val.trim() !== "") {
                setErrors((prev) => ({ ...prev, bom_number: null }));
              }
            }}
            placeholder="e.g. BOM-2024-001"
            className={`w-full rounded-2xl border ${
              errors.bom_number ? "border-red-500 ring-1 ring-red-500" : "border-slate-200"
            } px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all placeholder:text-slate-400`}
          />
          {errors.bom_number && (
            <p className="mt-1 text-xs font-medium text-red-500">{errors.bom_number}</p>
          )}
        </div>

        {/* Row 2: Product Code */}
        <div className="relative" ref={wrapperRef}>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Product Code *
          </label>
          <div className="relative">
            {/* Searchable dropdown container */}
            <div className="relative">
              <input
                value={form.product_code}
                onChange={(e) => {
                  const val = e.target.value;
                  setField("product_code", val);
                  setQuery(val);
                  setDropdownOpen(true);
                  if (errors.product_code && val.trim() !== "") {
                    setErrors((prev) => ({ ...prev, product_code: null }));
                  }
                  if (val.trim()) {
                    const match = productOptions.find(
                      (x) =>
                        (x.product_code || "").toLowerCase().trim() === val.toLowerCase().trim() ||
                        (x.sku || "").toLowerCase().trim() === val.toLowerCase().trim()
                    );
                    if (match) handleSelectProduct(match);
                  }
                }}
                onFocus={() => setDropdownOpen(true)}
                placeholder={loadingProducts ? "Loading products..." : "Select or type product code"}
                className={`w-full rounded-2xl border ${
                  errors.product_code ? "border-red-500 ring-1 ring-red-500" : "border-slate-200"
                } px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all`}
              />
              <button type="button" onClick={() => setDropdownOpen((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">
                ▾
              </button>
            </div>

            {dropdownOpen && (
              <div className="absolute z-40 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-slate-100 bg-white shadow-lg">
                <ul className="p-2">
                  {filteredOptions.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-slate-400">No products</li>
                  ) : (
                    filteredOptions.map((p) => (
                      <li
                        key={`code-opt-${p.product_code || p.id}`}
                        onMouseDown={() => {
                          handleSelectProduct(p);
                          setQuery(p.product_code || "");
                          setDropdownOpen(false);
                        }}
                        className="cursor-pointer rounded-lg px-3 py-2 hover:bg-slate-50"
                      >
                        <div className="text-sm font-bold text-slate-800">{p.product_code || p.sku}</div>
                        <div className="text-xs text-slate-500">{p.name}</div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
          {errors.product_code && (
            <p className="mt-1 text-xs font-medium text-red-500">{errors.product_code}</p>
          )}
        </div>

        {/* Row 3: Product Name & Version */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 relative" ref={nameWrapperRef}>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Product Name *
            </label>
            <div className="relative">
              <input
                value={form.product_name}
                onChange={(e) => handleProductNameChange(e.target.value)}
                onFocus={() => setNameDropdownOpen(true)}
                placeholder={loadingProducts ? "Loading products..." : "Select or type product name"}
                className={`w-full rounded-2xl border ${
                  errors.product_name ? "border-red-500 ring-1 ring-red-500" : "border-slate-200"
                } px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all`}
              />
              <button
                type="button"
                onClick={() => setNameDropdownOpen((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
              >
                ▾
              </button>
            </div>

            {nameDropdownOpen && (
              <div className="absolute z-40 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-slate-100 bg-white shadow-lg">
                <ul className="p-2">
                  {filteredNameOptions.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-slate-400">No products found</li>
                  ) : (
                    filteredNameOptions.map((p) => (
                      <li
                        key={`name-opt-${p.product_code || p.id}`}
                        onMouseDown={() => {
                          handleSelectProduct(p);
                          setNameQuery(p.name || "");
                          setNameDropdownOpen(false);
                        }}
                        className="cursor-pointer rounded-lg px-3 py-2 hover:bg-slate-50"
                      >
                        <div className="text-sm font-bold text-slate-800">{p.name}</div>
                        <div className="text-xs text-slate-500">Code: {p.product_code || p.sku || "N/A"}</div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}

            {errors.product_name && (
              <p className="mt-1 text-xs font-medium text-red-500">{errors.product_name}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Version *
            </label>
            <input
              value={form.version}
              onChange={(e) => {
                const val = e.target.value;
                setField("version", val);
                if (errors.version && val.trim() !== "") {
                  setErrors((prev) => ({ ...prev, version: null }));
                }
              }}
              placeholder="e.g. V1.0"
              className={`w-full rounded-2xl border ${
                errors.version ? "border-red-500 ring-1 ring-red-500" : "border-slate-200"
              } px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all placeholder:text-slate-400`}
            />
            {errors.version && (
              <p className="mt-1 text-xs font-medium text-red-500">{errors.version}</p>
            )}
          </div>
        </div>

        {/* Row 4: Cost (₹) & Status */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Cost (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.total_cost}
              onChange={(e) => setField("total_cost", e.target.value)}
              placeholder="e.g. 500"
              className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setField("status", e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all text-slate-700"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
              <option value="pending_approval">Pending Approval</option>
            </select>
          </div>
        </div>

        {/* Row 6: Description */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Description
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all resize-none"
          />
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving} loading={saving}>
            {saving ? "Saving..." : "Save BOM"}
          </Button>
        </div>
      </form>
    </div>
  );
}
