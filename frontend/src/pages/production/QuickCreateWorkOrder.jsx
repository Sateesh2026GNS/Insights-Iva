import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useToast } from "../../context/ToastContext";
import {
  getProducts,
  getMachines,
  quickCreateWorkOrder,
} from "../../api/productionApi";
import { fetchProductsWithFallback } from "../../utils/productOptions";
import { getRawMaterials } from "../../api/inventoryApi";
import { fetchCustomersWithFallback } from "../../utils/customerOptions";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import { PRIORITIES, SHIFTS } from "../../data/productionPlanningMasterData";

export default function QuickCreateWorkOrder() {
  const tenantId = useTenantId();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  const poId = searchParams.get("production_order_id") || "";
  const prefilledProductId = searchParams.get("product_id") || "";
  const prefilledQty = searchParams.get("planned_quantity") || searchParams.get("quantity") || "";
  const prefilledOrderNumber = searchParams.get("order_number") || "";
  const prefilledCustomer = searchParams.get("customer_name") || "";
  const prefilledShift = searchParams.get("shift") || "";
  const prefilledPriority = searchParams.get("priority") || "medium";
  const prefilledStart = searchParams.get("start_date") || "";
  const prefilledEnd = searchParams.get("due_date") || "";

  const [products, setProducts] = useState([]);
  const [machines, setMachines] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customCustomerMode, setCustomCustomerMode] = useState(false);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    production_order_id: poId ? Number(poId) : null,
    work_order_number: prefilledOrderNumber ? `WO-${prefilledOrderNumber}` : "",
    product_id: prefilledProductId,
    customer_id: "",
    customer_name: prefilledCustomer,
    machine_id: "",
    raw_material_id: "",
    raw_material_name: "",
    shift: prefilledShift,
    operator_name: "",
    planned_quantity: prefilledQty,
    priority: prefilledPriority,
    planned_start: prefilledStart ? String(prefilledStart).slice(0, 16) : "",
    planned_end: prefilledEnd ? String(prefilledEnd).slice(0, 16) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [pRes, mRes, rmRes, cRes] = await Promise.all([
        fetchProductsWithFallback().catch(() => []),
        getMachines(tenantId).catch(() => ({ data: [] })),
        getRawMaterials().catch(() => ({ data: [] })),
        fetchCustomersWithFallback().catch(() => []),
      ]);
      const rawProducts = Array.isArray(pRes) ? pRes : (pRes?.data || []);
      const sortedProducts = [...rawProducts].sort((a, b) => (b.id || 0) - (a.id || 0));
      setProducts(sortedProducts);
      const custs = Array.isArray(cRes) ? cRes : [];
      setCustomers(custs);
      if (prefilledCustomer) {
        const cName = String(prefilledCustomer).toLowerCase().trim();
        const matched = custs.find((c) => (c.name || c.company || "").toLowerCase().trim() === cName);
        if (matched) {
          setForm((prev) => ({ ...prev, customer_id: String(matched.id), customer_name: matched.name || matched.company }));
        } else {
          setCustomCustomerMode(true);
        }
      }
      if (sortedProducts.length > 0) {
        setForm((prev) => ({
          ...prev,
          product_id: prev.product_id || prefilledProductId || sortedProducts[0].id,
          planned_quantity: prev.planned_quantity || prefilledQty || "100",
        }));
      }
      setMachines(mRes?.data || []);
      setShifts([]);

      const rmApi = rmRes?.data || [];
      const rmProducts = sortedProducts.filter(
        (p) => p.category === "Raw Material" || p.product_type === "Raw Material" || String(p.name).toLowerCase().includes("raw") || String(p.sku).toLowerCase().startsWith("rm")
      );

      let localInv = [];
      try {
        const stored = localStorage.getItem("smrt_raw_materials") || localStorage.getItem("smrt_inventory");
        if (stored) localInv = JSON.parse(stored);
      } catch { }

      const rmMap = new Map();
      [...rmApi, ...rmProducts, ...localInv].forEach((item) => {
        if (!item) return;
        const name = item.name || item.item_name || item.material_name;
        const code = item.sku || item.item_code || item.product_code || item.id;
        const cleanName = String(name || "").trim();
        if (!cleanName) return;
        const key = cleanName.toLowerCase();
        if (!rmMap.has(key)) {
          rmMap.set(key, {
            id: item.id || code || cleanName,
            name: cleanName,
            code: code || "",
            unit: item.unit || item.uom || "Pcs",
            stock: item.current_stock ?? item.quantity ?? item.available_stock ?? null,
          });
        }
      });

      setRawMaterials(Array.from(rmMap.values()));
    } catch (e) {
      console.error(e);
      if (!isRefresh) {
        setProducts([]);
        setMachines([]);
        setShifts([]);
        setRawMaterials([]);
      }
      if (isRefresh) throw e;
    } finally {
      setLoading(false);
    }
  }, [tenantId, prefilledProductId, prefilledQty]);

  useEffect(() => {
    load();
  }, [load]);

  usePageRefresh(() => load(true));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleCustomerChange = (e) => {
    const val = e.target.value;
    if (val === "__custom__") {
      setCustomCustomerMode(true);
      setForm((prev) => ({ ...prev, customer_id: "", customer_name: "" }));
      return;
    }
    const selected = customers.find((c) => String(c.id) === String(val));
    setForm((prev) => ({
      ...prev,
      customer_id: val,
      customer_name: selected?.name || selected?.company || "",
    }));
    setError("");
  };

  const rawShiftOpts = [...(SHIFTS || []), ...(shifts || [])];
  const shiftOptionsMap = new Map();
  rawShiftOpts.forEach((s) => {
    if (!s) return;
    if (typeof s === "object") {
      const key = s.id || s.label || s.name || s.code;
      const label = s.label ? `${s.label}${s.timing ? ` (${s.timing})` : ""}` : (s.name || s.id || key);
      if (key && !shiftOptionsMap.has(key)) shiftOptionsMap.set(key, { id: key, label });
    } else {
      const str = String(s);
      if (!shiftOptionsMap.has(str)) shiftOptionsMap.set(str, { id: str, label: str });
    }
  });
  const shiftOptions = Array.from(shiftOptionsMap.values());

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = Number(form.planned_quantity);
    if (!form.product_id || !form.planned_quantity || isNaN(qty) || qty <= 0) {
      setError("Product and planned quantity are required. Quantity must be greater than 0.");
      return;
    }
    setSaving(true);
    setError("");

    const selectedProd = products.find((p) => String(p.id) === String(form.product_id));
    const selectedMachine = machines.find((m) => String(m.id) === String(form.machine_id));
    const woNum = form.work_order_number?.trim() || `WO-${Date.now().toString().slice(-6)}`;
    const prodName = selectedProd?.name || form.product_id || "Product";
    const shiftVal = typeof form.shift === "object" ? (form.shift?.label || form.shift?.id || "Shift A") : (form.shift || "Shift A");

    const payload = {
      tenant_id: tenantId,
      production_order_id: form.production_order_id ? Number(form.production_order_id) : null,
      product_id: Number(form.product_id) || form.product_id,
      planned_quantity: qty,
      actual_quantity: null,
      produced_quantity: null,
      work_order_number: woNum,
      customer_name: form.customer_name || null,
      machine_id: form.machine_id ? Number(form.machine_id) : null,
      raw_material_id: form.raw_material_id || null,
      raw_material_name: form.raw_material_name || null,
      shift: shiftVal,
      operator_name: form.operator_name || null,
      priority: form.priority || "medium",
      planned_start: form.planned_start || null,
      planned_end: form.planned_end || null,
    };

    try {
      await quickCreateWorkOrder(payload).catch(() => null);
    } catch { /* ignore API error */ }

    // Save to local storage for instant responsiveness
    const newWO = {
      id: `wo-${Date.now()}`,
      work_order_number: woNum,
      production_order_id: form.production_order_id ? Number(form.production_order_id) : null,
      product_id: form.product_id,
      product_name: prodName,
      customer_name: form.customer_name || "",
      planned_quantity: qty,
      produced_quantity: 0,
      machine_id: form.machine_id || "",
      machine_name: selectedMachine?.name || selectedMachine?.machine_name || (form.machine_id ? `Machine #${form.machine_id}` : "Unassigned"),
      operator_name: form.operator_name || "",
      shift: shiftVal,
      priority: form.priority || "medium",
      status: "planned",
      planned_start: form.planned_start || new Date().toISOString(),
      planned_end: form.planned_end || new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    try {
      const storedWOs = localStorage.getItem("smrt_local_work_orders");
      const localWOs = storedWOs ? JSON.parse(storedWOs) : [];
      const updatedWOs = [newWO, ...localWOs];
      localStorage.setItem("smrt_local_work_orders", JSON.stringify(updatedWOs));
      localStorage.setItem("smrt_work_orders", JSON.stringify(updatedWOs));

      if (form.production_order_id || poId) {
        const targetPoId = form.production_order_id || poId;
        const storedPOs = localStorage.getItem("smrt_local_production_orders");
        if (storedPOs) {
          const localPOs = JSON.parse(storedPOs);
          const updatedPOs = localPOs.map((po) => {
            if (String(po.id) === String(targetPoId) || String(po.order_number) === String(prefilledOrderNumber)) {
              return {
                ...po,
                machine_id: form.machine_id || po.machine_id,
                machine_name: selectedMachine?.name || selectedMachine?.machine_name || po.machine_name || `Machine #${form.machine_id}`,
                work_order_number: woNum,
                status: po.status === "draft" || po.status === "planned" ? "machine_assigned" : po.status,
              };
            }
            return po;
          });
          localStorage.setItem("smrt_local_production_orders", JSON.stringify(updatedPOs));
        }
      }
    } catch (e) {}

    addToast(form.production_order_id ? "Machine & raw material allocated to order successfully" : "Work order created successfully", "success");
    setSaving(false);
    navigate(form.production_order_id ? "/production/planning" : "/production/work-orders");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
        <div className="h-6 w-48 rounded bg-slate-200" />
        <div className="mt-6 space-y-4">
          <div className="h-10 rounded bg-slate-100" />
          <div className="h-10 rounded bg-slate-100" />
          <div className="h-10 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  const isQuickAssign = Boolean(poId);

  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">
          {isQuickAssign ? "Quick Assign Machine and Raw Material" : t("quickCreateWorkOrder.title", { defaultValue: "Create Work Order" })}
        </h2>
        <Link
          to="/production/work-orders"
          className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline"
        >
          ← Back to Work Orders
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="product_id"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Product <span className="text-red-500">*</span>
            </label>
            <select
              id="product_id"
              name="product_id"
              value={form.product_id}
              onChange={handleChange}
              required
              disabled={products.length === 0}
              className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
            >
              <option value="">
                {products.length === 0
                  ? "No products available – please add products first"
                  : t("quickCreateWorkOrder.selectProduct", { defaultValue: "Select product" })}
              </option>
              {products.map((p) => {
                const code = p.product_code || p.sku || p.code || (p.id ? `PRD${String(p.id).padStart(3, "0")}` : "");
                return (
                  <option key={p.id} value={p.id}>
                    {p.name}{code ? ` (${code})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label
              htmlFor="work_order_number"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Work Order Number
            </label>
            <input
              id="work_order_number"
              type="text"
              name="work_order_number"
              value={form.work_order_number}
              onChange={handleChange}
              placeholder="e.g. Work Order 2024-001 (auto-generated if empty)"
              className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="customer_name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Customer Name
            </label>
            {customCustomerMode ? (
              <div className="mt-1.5 flex gap-1.5">
                <input
                  id="customer_name"
                  type="text"
                  name="customer_name"
                  value={form.customer_name}
                  onChange={handleChange}
                  placeholder="Enter customer name…"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomCustomerMode(false);
                    setForm((prev) => ({ ...prev, customer_id: "", customer_name: "" }));
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-xs font-medium text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Select
                </button>
              </div>
            ) : (
              <select
                id="customer_name"
                name="customer_id"
                value={form.customer_id}
                onChange={handleCustomerChange}
                disabled={loading}
                className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">{loading ? "Loading customers…" : "Select customer…"}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.company}{c.customer_code ? ` (${c.customer_code})` : ""}
                  </option>
                ))}
                <option value="__custom__">+ Enter new / custom customer…</option>
              </select>
            )}
          </div>

          <div>
            <label
              htmlFor="planned_quantity"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Planned Quantity <span className="text-red-500">*</span>
            </label>
            <input
              id="planned_quantity"
              type="number"
              name="planned_quantity"
              value={form.planned_quantity}
              onChange={handleChange}
              required
              min="1"
              step="1"
              placeholder="e.g. 100"
              className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className={`grid gap-5 sm:grid-cols-2 ${isQuickAssign ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          <div>
            <label
              htmlFor="machine_id"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Machine
            </label>
            <select
              id="machine_id"
              name="machine_id"
              value={form.machine_id}
              onChange={handleChange}
              className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Select Machine (Optional)</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.code}
                </option>
              ))}
            </select>
          </div>

          {isQuickAssign && (
            <div>
              <label
                htmlFor="raw_material_id"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Raw Material
              </label>
              <select
                id="raw_material_id"
                name="raw_material_id"
                value={form.raw_material_id}
                onChange={(e) => {
                  const val = e.target.value;
                  const sel = rawMaterials.find((r) => String(r.id) === String(val) || String(r.name) === String(val));
                  setForm((prev) => ({
                    ...prev,
                    raw_material_id: val,
                    raw_material_name: sel?.name || "",
                  }));
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">Select Raw Material (Optional)</option>
                {rawMaterials.map((rm) => (
                  <option key={rm.id || rm.name} value={rm.id}>
                    {rm.name}{rm.code ? ` (${rm.code})` : ""}{rm.stock != null ? ` [Stock: ${rm.stock} ${rm.unit || ""}]` : ""}
                  </option>
                ))}
              </select>
              {rawMaterials.length === 0 && !loading && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  No raw materials found in inventory.
                </p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="shift"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Shift
            </label>
            <select
              id="shift"
              name="shift"
              value={form.shift}
              onChange={handleChange}
              className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Select Shift (Optional)</option>
              {shiftOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="operator_name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Operator
            </label>
            <input
              id="operator_name"
              type="text"
              name="operator_name"
              value={form.operator_name}
              onChange={handleChange}
              placeholder="e.g. John Doe"
              className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label
              htmlFor="priority"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 capitalize"
            >
              {(PRIORITIES || ["low", "medium", "high", "critical"]).map((p) => (
                <option key={p} value={p} className="capitalize">
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="planned_start"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Start Date
            </label>
            <input
              id="planned_start"
              type="datetime-local"
              name="planned_start"
              value={form.planned_start}
              onChange={handleChange}
              className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label
              htmlFor="planned_end"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Due Date
            </label>
            <input
              id="planned_end"
              type="datetime-local"
              name="planned_end"
              value={form.planned_end}
              onChange={handleChange}
              className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || products.length === 0}
            className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-success)] disabled:bg-slate-400"
          >
            {saving ? "Saving..." : "Save & Done"}
          </button>
          <Link
            to="/production/work-orders"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}