import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  FileText,
  Package,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { addBomItem, deleteBomItem, getBillOfMaterials } from "../../api/bomApi";
import { getProducts } from "../../api/productsApi";
import { enrichApiProduct } from "../../data/productsMasterData";
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

function isMaterialProduct(product) {
  const category = String(product?.category || "").toLowerCase().replace(/[_-]+/g, " ");
  const code = String(product?.sku || product?.product_code || "").toUpperCase();
  return ["raw", "material", "packaging", "consumable", "spare", "component", "wip", "semi finished", "sub assembly"]
    .some((part) => category.includes(part)) || code.startsWith("RAW-") || code.startsWith("PKG-");
}

function isFinishedProduct(product) {
  const category = String(product?.category || "").toLowerCase().replace(/[_-]+/g, " ");
  const code = String(product?.sku || product?.product_code || "").toUpperCase();
  return !["raw", "packaging", "consumable", "spare", "component", "wip"]
    .some((part) => category.includes(part)) && !code.startsWith("RAW-") && !code.startsWith("PKG-");
}

function AddComponentModal({ open, onClose, onAdd, productId, existingComponents = [] }) {
  const tenantId = useTenantId();
  const [products, setProducts] = useState([]);
  const [componentProductId, setComponentProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (!open) return undefined;
    let mounted = true;
    getProducts()
      .then((res) => {
        if (mounted) setProducts((res?.data || []).map(enrichApiProduct).filter(isMaterialProduct));
      })
      .catch(() => {
        if (mounted) {
          setProducts([]);
          addToast("Could not load Product Master. Add or correct the material there first.", "error");
        }
      });
    return () => { mounted = false; };
  }, [open, addToast]);

  if (!open) return null;

  const existingIds = new Set(existingComponents.map((component) => String(component.component_product_id || "")));
  const eligibleProducts = products.filter((product) =>
    String(product.id) !== String(productId) && !existingIds.has(String(product.id))
  );
  const selectedProduct = products.find((product) => String(product.id) === String(componentProductId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = Number(quantity);
    if (!selectedProduct || !productId || !Number.isFinite(qty) || qty <= 0) {
      addToast("Select a material and enter a quantity greater than zero.", "error");
      return;
    }

    setBusy(true);
    try {
      const response = await addBomItem(Number(productId), {
        tenant_id: Number(tenantId),
        component_product_id: Number(selectedProduct.id),
        quantity: qty,
        unit: selectedProduct.unit || "Pcs",
      });
      const line = response?.data || {};
      const unitCost = Number(selectedProduct.unit_cost || selectedProduct.price_per_unit || 0);
      onAdd({
        id: line.id,
        component_product_id: selectedProduct.id,
        component: selectedProduct.name,
        item_code: selectedProduct.product_code || selectedProduct.sku,
        category: selectedProduct.category,
        unit: line.unit || selectedProduct.unit || "Pcs",
        qty: line.quantity ?? qty,
        unit_cost: unitCost,
        total_cost: qty * unitCost,
      });
      addToast("Material added to the BOM.");
      onClose();
    } catch (error) {
      addToast(error?.response?.data?.detail || "Could not save this material.", "error");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-5 rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Add BOM material</h3>
            <p className="mt-1 text-xs text-slate-500">Choose an existing Product Master item and set its per-unit quantity.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-medium text-slate-600">Material product *</span>
          <select required value={componentProductId} onChange={(event) => setComponentProductId(event.target.value)} className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500" disabled={busy}>
            <option value="">{eligibleProducts.length ? "Choose a material or component" : "No material products available"}</option>
            {eligibleProducts.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.product_code || product.sku || "No code"}</option>)}
          </select>
        </label>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0 rounded-xl bg-slate-50 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Code · category · unit</p>
            <p className="mt-1 truncate text-sm font-medium text-slate-700" title={selectedProduct ? `${selectedProduct.product_code || selectedProduct.sku || "No code"} · ${selectedProduct.category || "Uncategorized"} · ${selectedProduct.unit || "Pcs"}` : "Select a material first"}>
              {selectedProduct ? `${selectedProduct.product_code || selectedProduct.sku || "No code"} · ${selectedProduct.category || "Uncategorized"} · ${selectedProduct.unit || "Pcs"}` : "Select a material first"}
            </p>
          </div>
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-medium text-slate-600">Quantity per finished unit *</span>
            <input type="number" min="0.001" step="any" required value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-full min-w-0 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500" disabled={busy} />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-3 pt-2">
          <Button type="button" variant="cancel" onClick={onClose}>
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

        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-slate-100 px-5 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t.id ? "bg-[var(--color-primary)] text-white" : "text-slate-600 hover:bg-slate-100"}`}
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                  <thead className="ui-table-head">
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
                <thead className="ui-table-head">
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
                <thead className="ui-table-head">
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
                <thead className="ui-table-head">
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

        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button type="button" onClick={() => onEdit(bom)} variant="edit" size="sm">Edit BOM</Button>
          <button type="button" onClick={() => onCopy(bom)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Copy className="h-3.5 w-3.5" /> Copy BOM
          </button>
          <button type="button" onClick={() => onPrint(bom)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <FileText className="h-3.5 w-3.5" /> Print PDF
          </button>
          <Link to="/production/work-orders" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 no-underline">
            <Package className="h-3.5 w-3.5" /> Create Production Order
          </Link>
          <button type="button" onClick={() => onDelete(bom)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 sm:ml-auto">
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
        productId={bom?.product_id}
        existingComponents={localComponents}
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
  const [selectedProductId, setSelectedProductId] = useState(bom?.product_id ? String(bom.product_id) : "");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [existingBomNumbers, setExistingBomNumbers] = useState([]);

  const [saving, setSaving] = useState(false);

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    let mounted = true;
    setLoadingProducts(true);
    getProducts()
      .then((res) => {
        const apiData = res?.data || [];
        const rows = apiData.map((r) => enrichApiProduct(r)).filter(isFinishedProduct);
        if (mounted) setProductOptions(rows);
      })
      .catch(() => {
        if (mounted) setProductOptions([]);
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

  const handleSelectProduct = (p) => {
    if (!p) return;
    setSelectedProductId(String(p.id));
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
    if (!productOptions.some((product) => String(product.id) === selectedProductId)) {
      errs.product_name = "Select a finished product from Product Master before creating its BOM.";
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
    const selectedProduct = productOptions.find((product) => String(product.id) === selectedProductId);
    if (!selectedProduct) {
      addToast("Select a finished product from Product Master before creating its BOM.", "error");
      return;
    }

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
      product_id: Number(selectedProduct.id),
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
      components: bom?.components || [],
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
        className="w-full max-w-2xl space-y-5 rounded-3xl bg-white p-6 shadow-2xl"
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

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-medium text-slate-600">BOM No *</span>
            <input value={form.bom_number} onChange={(e) => { const value = e.target.value; setField("bom_number", value); if (errors.bom_number && value.trim()) setErrors((prev) => ({ ...prev, bom_number: null })); }} placeholder="e.g. BOM-2024-001" className={`w-full min-w-0 rounded-xl border ${errors.bom_number ? "border-red-500 ring-1 ring-red-500" : "border-slate-200"} px-3.5 py-2.5 text-sm outline-none focus:border-blue-500`} />
            {errors.bom_number && <p className="mt-1 text-xs font-medium text-red-500">{errors.bom_number}</p>}
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-medium text-slate-600">Version *</span>
            <input value={form.version} onChange={(e) => { const value = e.target.value; setField("version", value); if (errors.version && value.trim()) setErrors((prev) => ({ ...prev, version: null })); }} placeholder="e.g. V1.0" className={`w-full min-w-0 rounded-xl border ${errors.version ? "border-red-500 ring-1 ring-red-500" : "border-slate-200"} px-3.5 py-2.5 text-sm outline-none focus:border-blue-500`} />
            {errors.version && <p className="mt-1 text-xs font-medium text-red-500">{errors.version}</p>}
          </label>
        </div>

        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-medium text-slate-600">Finished product *</span>
          <select required value={selectedProductId} onChange={(event) => handleSelectProduct(productOptions.find((product) => String(product.id) === event.target.value))} disabled={loadingProducts || saving || productOptions.length === 0} className={`w-full min-w-0 rounded-xl border ${errors.product_name ? "border-red-500 ring-1 ring-red-500" : "border-slate-200"} bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50`}>
            <option value="">{loadingProducts ? "Loading products…" : productOptions.length ? "Choose a Product Master item" : "No finished products found in Product Master"}</option>
            {productOptions.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.product_code || product.sku || "No code"}</option>)}
          </select>
          {errors.product_name && <p className="mt-1 text-xs font-medium text-red-500">{errors.product_name}</p>}
        </label>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-medium text-slate-600">Product code</span>
            <input value={form.product_code} readOnly className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600" />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-medium text-slate-600">Category</span>
            <input value={productOptions.find((product) => String(product.id) === selectedProductId)?.category || ""} readOnly className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600" />
          </label>
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
          <Button type="button" variant="cancel" onClick={onClose}>
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
