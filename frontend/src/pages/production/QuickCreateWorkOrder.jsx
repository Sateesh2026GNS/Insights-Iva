import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Check,
  ClipboardList,
  Package,
  Plus,
  Search,
  StickyNote,
  X,
} from "lucide-react";

import { useToast } from "../../context/ToastContext";
import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import SearchableSelect from "../../components/common/SearchableSelect";
import { ListPageShell } from "../../components/common/ListPageShell";
import {
  getMachines,
  getWorkOrders,
  quickCreateWorkOrder,
} from "../../api/productionApi";
import { getProductBom } from "../../api/bomApi";
import { getRawMaterials } from "../../api/inventoryApi";
import { getSalesOrdersEnriched } from "../../api/salesApi";
import { getUsers } from "../../api/adminApi";
import { fetchProductsWithFallback } from "../../utils/productOptions";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import AddNewItemModal from "../../components/sales/AddNewItemModal";
import CreateMachineModal from "../../components/production/CreateMachineModal";
import { apiErrorMessage } from "../../utils/apiError";

const PRIORITY_OPTIONS = [
  { value: "medium", label: "Normal" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
];

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function fmtMoney(value) {
  const n = Number(value);
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function emptyLine() {
  return { key: crypto.randomUUID(), product_id: "", qty: "1", unit_price: "0.00" };
}

function suggestWoNumber(rows) {
  let max = 0;
  for (const row of rows) {
    const label = String(row.work_order_number || "");
    const match = /^WO-(\d+)/i.exec(label);
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return `WO-${String(max + 1).padStart(2, "0")}`;
}

function SectionHeader({ icon: Icon, title, action }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-primary)]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function FieldLabel({ children, required = false }) {
  return (
    <span className="text-xs font-semibold text-slate-700">
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
    </span>
  );
}

export default function QuickCreateWorkOrder() {
  const tenantId = useTenantId();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  const poId = searchParams.get("production_order_id") || "";
  const prefilledProductId = searchParams.get("product_id") || "";
  const prefilledQty = searchParams.get("planned_quantity") || searchParams.get("quantity") || "";
  const isQuickAssign = Boolean(poId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [products, setProducts] = useState([]);
  const [machines, setMachines] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddMachineModal, setShowAddMachineModal] = useState(false);
  const [materialCheck, setMaterialCheck] = useState(null);
  const [checkingMaterials, setCheckingMaterials] = useState(false);

  const [form, setForm] = useState({
    work_order_number: "",
    priority: "medium",
    planned_start: todayIso(),
    planned_end: "",
    drawing_revision: "",
    sales_order_id: "",
    assigned_user_id: "",
    machine_id: "",
    notes: "",
  });
  const [lines, setLines] = useState([emptyLine()]);

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: String(p.id),
        label: `${p.name}${p.sku || p.product_code ? ` (${p.sku || p.product_code})` : ""}`,
      })),
    [products]
  );

  const salesOrderOptions = useMemo(
    () => [
      { value: "", label: "None" },
      ...salesOrders.map((o) => ({
        value: String(o.id),
        label: o.order_number || o.so_number || `SO-${o.id}`,
      })),
    ],
    [salesOrders]
  );

  const userOptions = useMemo(
    () => [
      { value: "", label: "Unassigned" },
      ...users.map((u) => ({
        value: String(u.id),
        label: u.full_name || u.name || u.email || `User ${u.id}`,
      })),
    ],
    [users]
  );

  const grandTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.qty) || 0;
        const price = Number(line.unit_price) || 0;
        return sum + qty * price;
      }, 0),
    [lines]
  );

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [productList, mRes, soRes, userRes, woRes, rmRes] = await Promise.all([
        fetchProductsWithFallback().catch(() => []),
        getMachines(tenantId).catch(() => ({ data: [] })),
        getSalesOrdersEnriched().catch(() => ({ data: [] })),
        getUsers().catch(() => ({ data: [] })),
        getWorkOrders().catch(() => ({ data: [] })),
        getRawMaterials().catch(() => ({ data: [] })),
      ]);

      const sortedProducts = [...(Array.isArray(productList) ? productList : productList?.data || [])].sort(
        (a, b) => (b.id || 0) - (a.id || 0)
      );
      setProducts(sortedProducts);
      setMachines(mRes?.data || []);
      setSalesOrders(soRes?.data || []);
      setUsers(userRes?.data || []);
      setRawMaterials(rmRes?.data || []);

      const woRows = woRes?.data?.items || woRes?.data || [];
      const suggested = suggestWoNumber(Array.isArray(woRows) ? woRows : []);

      setForm((prev) => ({
        ...prev,
        work_order_number: prev.work_order_number || suggested,
        production_order_id: poId ? Number(poId) : null,
      }));

      if (prefilledProductId || prefilledQty) {
        setLines([
          {
            key: crypto.randomUUID(),
            product_id: String(prefilledProductId || sortedProducts[0]?.id || ""),
            qty: String(prefilledQty || "1"),
            unit_price: "0.00",
          },
        ]);
      }
    } catch (e) {
      console.error(e);
      if (isRefresh) throw e;
    } finally {
      setLoading(false);
    }
  }, [tenantId, poId, prefilledProductId, prefilledQty]);

  useEffect(() => {
    load();
  }, [load]);

  usePageRefresh(() => load(true));

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const updateLine = (key, patch) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    setMaterialCheck(null);
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (key) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
    setMaterialCheck(null);
  };

  const runMaterialCheck = async () => {
    const validLines = lines.filter((l) => l.product_id && Number(l.qty) > 0);
    if (!validLines.length) {
      addToast("Add at least one product with quantity before checking materials.", "warning");
      return;
    }
    setCheckingMaterials(true);
    try {
      const stockMap = new Map();
      rawMaterials.forEach((rm) => {
        const name = String(rm.name || rm.item_name || "").toLowerCase();
        if (name) {
          stockMap.set(name, Number(rm.current_stock ?? rm.quantity ?? rm.available_stock ?? 0));
        }
      });

      const results = [];
      for (const line of validLines) {
        const product = products.find((p) => String(p.id) === String(line.product_id));
        const bomRes = await getProductBom(line.product_id).catch(() => ({ data: [] }));
        const bomItems = Array.isArray(bomRes?.data) ? bomRes.data : [];
        const qty = Number(line.qty) || 1;

        if (!bomItems.length) {
          results.push({
            product: product?.name || "Product",
            status: "no_bom",
            items: [],
          });
          continue;
        }

        const items = bomItems.map((item) => {
          const materialName = String(item.material_name || item.component_name || item.name || "").trim();
          const required = Number(item.quantity || item.qty || 0) * qty;
          const available = stockMap.get(materialName.toLowerCase()) ?? null;
          let status = "unknown";
          if (available != null) {
            status = available >= required ? "ok" : "short";
          }
          return { materialName, required, available, status, unit: item.unit || item.uom || "" };
        });

        const short = items.some((i) => i.status === "short");
        results.push({
          product: product?.name || "Product",
          status: short ? "short" : "ok",
          items,
        });
      }

      setMaterialCheck(results);
    } catch (err) {
      addToast(apiErrorMessage(err, "Material check failed"), "error");
    } finally {
      setCheckingMaterials(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.product_id && Number(l.qty) > 0);
    if (!form.work_order_number.trim()) {
      setError("Work order number is required.");
      return;
    }
    if (!form.planned_start) {
      setError("Start date is required.");
      return;
    }
    if (!form.planned_end) {
      setError("Due date is required.");
      return;
    }
    if (!validLines.length) {
      setError("Add at least one product with quantity.");
      return;
    }

    setSaving(true);
    setError("");

    const selectedSo = salesOrders.find((o) => String(o.id) === String(form.sales_order_id));
    const customerName = selectedSo?.customer_name || selectedSo?.buyer_name || null;
    const assignedUser = users.find((u) => String(u.id) === String(form.assigned_user_id));
    const operatorName = assignedUser?.full_name || assignedUser?.name || null;

    try {
      const baseWo = form.work_order_number.trim();
      for (let i = 0; i < validLines.length; i += 1) {
        const line = validLines[i];
        const suffix = validLines.length > 1 ? `-${i + 1}` : "";
        const payload = {
          tenant_id: tenantId,
          production_order_id: poId ? Number(poId) : null,
          product_id: Number(line.product_id),
          planned_quantity: Number(line.qty),
          work_order_number: `${baseWo}${suffix}`,
          customer_name: customerName,
          assigned_user_id: form.assigned_user_id ? Number(form.assigned_user_id) : null,
          operator_name: operatorName,
          machine_id: form.machine_id ? Number(form.machine_id) : null,
          priority: form.priority || "medium",
          planned_start: form.planned_start ? `${form.planned_start}T08:00:00` : null,
          planned_end: form.planned_end ? `${form.planned_end}T17:00:00` : null,
        };
        await quickCreateWorkOrder(payload);
      }

      addToast(
        validLines.length > 1
          ? `${validLines.length} work orders created successfully`
          : "Work order created successfully",
        "success"
      );
      navigate(isQuickAssign ? "/production/planning" : "/production/work-orders");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create work order."));
      addToast(apiErrorMessage(err, "Failed to create work order."), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ListPageShell>
        <div className="flex justify-center py-16">
          <Loader label="Loading create work order…" />
        </div>
      </ListPageShell>
    );
  }

  const pageTitle = isQuickAssign
    ? "Quick Assign Machine and Raw Material"
    : t("erpNav.createWorkOrder", { defaultValue: "Create Work Order" });

  return (
    <ListPageShell>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav className="mb-1 text-xs text-slate-500">
            <Link to="/production/work-orders" className="hover:text-[var(--color-primary)]">
              Work Orders
            </Link>
            <span className="mx-1.5">/</span>
            <span className="font-medium text-slate-700">New</span>
          </nav>
          <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
        </div>
        <Button variant="secondary" to="/production/work-orders" leftIcon={<X className="h-4 w-4" />}>
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader icon={ClipboardList} title="General Information" />
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block space-y-1">
                <FieldLabel required>WO Number</FieldLabel>
                <input
                  type="text"
                  value={form.work_order_number}
                  onChange={(e) => handleFormChange("work_order_number", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <FieldLabel>Priority</FieldLabel>
                <select
                  value={form.priority}
                  onChange={(e) => handleFormChange("priority", e.target.value)}
                  className={inputClass}
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <FieldLabel required>Start Date</FieldLabel>
                <input
                  type="date"
                  value={form.planned_start}
                  onChange={(e) => handleFormChange("planned_start", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <FieldLabel required>Due Date</FieldLabel>
                <input
                  type="date"
                  value={form.planned_end}
                  onChange={(e) => handleFormChange("planned_end", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <FieldLabel>Drawing Revision</FieldLabel>
                <input
                  type="text"
                  value={form.drawing_revision}
                  onChange={(e) => handleFormChange("drawing_revision", e.target.value)}
                  placeholder="e.g. Rev B"
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <FieldLabel>Linked Sales Order</FieldLabel>
                <select
                  value={form.sales_order_id}
                  onChange={(e) => handleFormChange("sales_order_id", e.target.value)}
                  className={inputClass}
                >
                  {salesOrderOptions.map((opt) => (
                    <option key={opt.value || "none"} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 sm:col-span-2 lg:col-span-1">
                <FieldLabel>Assigned To</FieldLabel>
                <select
                  value={form.assigned_user_id}
                  onChange={(e) => handleFormChange("assigned_user_id", e.target.value)}
                  className={inputClass}
                >
                  {userOptions.map((opt) => (
                    <option key={opt.value || "none"} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              {isQuickAssign ? (
                <label className="block space-y-1 sm:col-span-2 lg:col-span-3">
                  <FieldLabel>Machine</FieldLabel>
                  <select
                    value={form.machine_id}
                    onChange={(e) => {
                      if (e.target.value === "__add__") {
                        setShowAddMachineModal(true);
                        return;
                      }
                      handleFormChange("machine_id", e.target.value);
                    }}
                    className={inputClass}
                  >
                    <option value="">Select Machine (Optional)</option>
                    <option value="__add__">+ Add new Machine</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>{m.name || m.code}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={Package}
              title="Products to Build"
              action={
                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Product
                </button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Product</th>
                    <th className="px-4 py-2.5 w-24">Qty</th>
                    <th className="px-4 py-2.5 w-32">Unit Price</th>
                    <th className="px-4 py-2.5 w-28">Total</th>
                    <th className="px-4 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const lineTotal = (Number(line.qty) || 0) * (Number(line.unit_price) || 0);
                    return (
                      <tr key={line.key} className="border-b border-slate-100">
                        <td className="px-4 py-2.5">
                          <SearchableSelect
                            value={line.product_id}
                            onChange={(val) => {
                              if (val === "__add_product__") {
                                setShowAddProductModal(true);
                                return;
                              }
                              updateLine(line.key, { product_id: val });
                            }}
                            options={productOptions}
                            footerOptions={[{ value: "__add_product__", label: "+ Add new Product" }]}
                            placeholder="Search product…"
                            searchPlaceholder="Search product…"
                            className="min-w-[200px]"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={line.qty}
                            onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                            className={inputClass}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unit_price}
                            onChange={(e) => updateLine(line.key, { unit_price: e.target.value })}
                            className={inputClass}
                          />
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{fmtMoney(lineTotal)}</td>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Remove product row"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">
              Grand Total: {fmtMoney(grandTotal)}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader icon={StickyNote} title="Notes" />
            <div className="p-5">
              <textarea
                value={form.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
                rows={4}
                placeholder="Production instructions, special requirements…"
                className={`${inputClass} resize-y`}
              />
            </div>
          </section>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Button type="submit" variant="primary" disabled={saving} loading={saving} className="w-full">
              <Check className="h-4 w-4" />
              Create Work Order
            </Button>
            <div className="mt-3 text-center">
              <Link to="/production/work-orders" className="text-sm font-medium text-slate-500 hover:text-slate-700">
                Cancel
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <SectionHeader
              icon={Search}
              title="Material Check"
              action={
                <button
                  type="button"
                  onClick={runMaterialCheck}
                  disabled={checkingMaterials}
                  className="rounded-lg bg-[var(--color-primary)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
                >
                  {checkingMaterials ? "Checking…" : "Check"}
                </button>
              }
            />
            <div className="space-y-3 p-4 text-sm text-slate-600">
              {!materialCheck ? (
                <p className="text-slate-500">Add products then click Check.</p>
              ) : (
                materialCheck.map((block) => (
                  <div key={block.product} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="font-semibold text-slate-800">{block.product}</p>
                    {block.status === "no_bom" ? (
                      <p className="mt-1 text-xs text-amber-700">No BOM defined for this product.</p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-xs">
                        {block.items.map((item) => (
                          <li
                            key={`${block.product}-${item.materialName}`}
                            className={
                              item.status === "short"
                                ? "text-rose-700"
                                : item.status === "ok"
                                  ? "text-emerald-700"
                                  : "text-slate-600"
                            }
                          >
                            {item.materialName}: need {item.required}
                            {item.available != null ? ` / have ${item.available}` : ""}
                            {item.unit ? ` ${item.unit}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </form>

      <AddNewItemModal
        open={showAddProductModal}
        placement="drawer"
        onClose={() => setShowAddProductModal(false)}
        onSaved={async (_line, product) => {
          setShowAddProductModal(false);
          try {
            const refreshed = await fetchProductsWithFallback();
            const list = Array.isArray(refreshed) ? refreshed : [];
            setProducts(list);
            const newId = String(product?.id || "");
            if (newId) {
              setLines((prev) => {
                const emptyIdx = prev.findIndex((l) => !l.product_id);
                if (emptyIdx >= 0) {
                  const next = [...prev];
                  next[emptyIdx] = { ...next[emptyIdx], product_id: newId };
                  return next;
                }
                return [...prev, { ...emptyLine(), product_id: newId }];
              });
            }
          } catch {
            // ignore
          }
        }}
      />

      <CreateMachineModal
        open={showAddMachineModal}
        placement="drawer"
        onClose={() => setShowAddMachineModal(false)}
        onSaved={async (createdMachine) => {
          setShowAddMachineModal(false);
          try {
            const mRes = await getMachines(tenantId).catch(() => ({ data: [] }));
            const list = mRes?.data || [];
            setMachines(list.length ? list : createdMachine ? [createdMachine] : []);
            if (createdMachine?.id) {
              handleFormChange("machine_id", String(createdMachine.id));
            }
          } catch {
            // ignore
          }
        }}
      />
    </ListPageShell>
  );
}
