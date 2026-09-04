import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

import { useToast } from "../../context/ToastContext";
import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import { inputMtClass as inputClass } from "../../design-system/classes";
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
import AddNewItemModal from "../../components/sales/AddNewItemModal";
import CreateMachineModal from "../../components/production/CreateMachineModal";
import { apiErrorMessage } from "../../utils/apiError";

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
  const [customProductMode, setCustomProductMode] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddMachineModal, setShowAddMachineModal] = useState(false);
  const [customMachineMode, setCustomMachineMode] = useState(false);
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

  const handleProductChange = (e) => {
    const val = e.target.value;
    if (val === "__custom__" || val === "__add_product__") {
      setShowAddProductModal(true);
      return;
    }
    const selected = products.find((p) => String(p.id) === String(val));
    setForm((prev) => ({
      ...prev,
      product_id: val,
      product_name: selected?.name || selected?.sku || "",
    }));
    setError("");
  };

  const handleMachineChange = (e) => {
    const val = e.target.value;
    if (val === "__custom__" || val === "__add_machine__") {
      setShowAddMachineModal(true);
      return;
    }
    setForm((prev) => ({ ...prev, machine_id: val }));
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
      await quickCreateWorkOrder(payload);
      addToast(
        form.production_order_id
          ? "Machine & raw material allocated to order successfully"
          : "Work order created successfully",
        "success"
      );
      navigate(form.production_order_id ? "/production/planning" : "/production/work-orders");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create work order."));
      addToast(apiErrorMessage(err, "Failed to create work order."), "error");
    } finally {
      setSaving(false);
    }
  };

  const isQuickAssign = Boolean(poId);
  const pageTitle = isQuickAssign
    ? "Quick Assign Machine and Raw Material"
    : t("quickCreateWorkOrder.title", { defaultValue: "Create Work Order" });

  if (loading) {
    return (
      <ListPageShell>
        <div className="mx-auto flex max-w-3xl justify-center py-16">
          <Loader />
        </div>
      </ListPageShell>
    );
  }

  return (
    <ListPageShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          to="/production/work-orders"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("quickCreateWorkOrder.backToWorkOrders", { defaultValue: "Back to Work Orders" })}
        </Link>
        <PageHeader
          title={pageTitle}
          subtitle={t("quickCreateWorkOrder.subtitle", {
            defaultValue: "Allocate product, machine, and schedule details for a new work order.",
          })}
        />
        <ListPageCard>
          <ListPageCardBody>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="product_id"
              className="ui-label"
            >
              Product <span className="text-[var(--color-danger)]">*</span>
            </label>
            {customProductMode ? (
              <div className="mt-1.5 flex gap-1.5">
                <input
                  type="text"
                  name="product_name"
                  value={form.product_name || ""}
                  onChange={handleChange}
                  placeholder="Enter product name…"
                  className={inputClass}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomProductMode(false);
                    setForm((prev) => ({ ...prev, product_id: "", product_name: "" }));
                  }}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]"
                >
                  Select
                </button>
              </div>
            ) : (
              <select
                id="product_id"
                name="product_id"
                value={form.product_id}
                onChange={handleProductChange}
                required={!customProductMode}
                disabled={products.length === 0}
                className={`${inputClass} disabled:opacity-50`}
              >
                <option value="">
                  {products.length === 0
                    ? "No products available – please add products first"
                    : t("quickCreateWorkOrder.selectProduct", { defaultValue: "Select product" })}
                </option>
                <option
                  value="__add_product__"
                  className="add-new-option"
                >
                  + Add new Product
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
            )}
          </div>

          <div>
            <label
              htmlFor="work_order_number"
              className="ui-label"
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
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="customer_name"
              className="ui-label"
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
                  className={inputClass}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomCustomerMode(false);
                    setForm((prev) => ({ ...prev, customer_id: "", customer_name: "" }));
                  }}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]"
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
                className={inputClass}
              >
                <option value="">{loading ? "Loading customers…" : "Select customer…"}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.company}{c.customer_code ? ` (${c.customer_code})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label
              htmlFor="planned_quantity"
              className="ui-label"
            >
              Planned Quantity <span className="text-[var(--color-danger)]">*</span>
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
              className={inputClass}
            />
          </div>
        </div>

        <div className={`grid gap-5 sm:grid-cols-2 ${isQuickAssign ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          <div>
            <label
              htmlFor="machine_id"
              className="ui-label"
            >
              Machine
            </label>
            {customMachineMode ? (
              <div className="mt-1.5 flex gap-1.5">
                <input
                  type="text"
                  name="machine_name"
                  value={form.machine_name || ""}
                  onChange={handleChange}
                  placeholder="Enter machine name…"
                  className={inputClass}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setCustomMachineMode(false);
                    setForm((prev) => ({ ...prev, machine_id: "", machine_name: "" }));
                  }}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]"
                >
                  Select
                </button>
              </div>
            ) : (
              <select
                id="machine_id"
                name="machine_id"
                value={form.machine_id}
                onChange={handleMachineChange}
                className={inputClass}
              >
                <option value="">Select Machine (Optional)</option>
                <option
                  value="__custom__"
                  className="add-new-option"
                >
                  + Add new Machine
                </option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.code}
                  </option>
                ))}
              </select>
            )}
          </div>

          {isQuickAssign && (
            <div>
              <label
                htmlFor="raw_material_id"
                className="ui-label"
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
                className={inputClass}
              >
                <option value="">Select Raw Material (Optional)</option>
                {rawMaterials.map((rm) => (
                  <option key={rm.id || rm.name} value={rm.id}>
                    {rm.name}{rm.code ? ` (${rm.code})` : ""}{rm.stock != null ? ` [Stock: ${rm.stock} ${rm.unit || ""}]` : ""}
                  </option>
                ))}
              </select>
              {rawMaterials.length === 0 && !loading && (
                <p className="mt-1 text-xs text-[var(--color-warning)]">
                  No raw materials found in inventory.
                </p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="shift"
              className="ui-label"
            >
              Shift
            </label>
            <select
              id="shift"
              name="shift"
              value={form.shift}
              onChange={handleChange}
              className={inputClass}
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
              className="ui-label"
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
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="priority"
              className="ui-label"
            >
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className={`${inputClass} capitalize`}
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
              className="ui-label"
            >
              Start Date
            </label>
            <input
              id="planned_start"
              type="datetime-local"
              name="planned_start"
              value={form.planned_start}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="planned_end"
              className="ui-label"
            >
              Due Date
            </label>
            <input
              id="planned_end"
              type="datetime-local"
              name="planned_end"
              value={form.planned_end}
              onChange={handleChange}
              className={inputClass}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" variant="primary" disabled={saving || products.length === 0} loading={saving}>
            {saving ? t("common.saving", { defaultValue: "Saving…" }) : t("common.saveAndDone", { defaultValue: "Save & Done" })}
          </Button>
          <Button variant="cancel" to="/production/work-orders">
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
        </div>
      </form>
          </ListPageCardBody>
        </ListPageCard>
      </div>

      <AddNewItemModal
        open={showAddProductModal}
        placement="drawer"
        onClose={() => setShowAddProductModal(false)}
        onSaved={async (line, product) => {
          setShowAddProductModal(false);
          try {
            const refreshed = await fetchProductsWithFallback();
            setProducts(Array.isArray(refreshed) ? refreshed : []);
            const newId = String(product?.id || line?.product_id || "");
            if (newId) {
              setForm((prev) => ({
                ...prev,
                product_id: newId,
                product_name: product?.name || line?.item_description || prev.product_name,
              }));
            }
          } catch {
            // fallback
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
            const mRes = await getMachines().catch(() => ({ data: [] }));
            const refreshed = Array.isArray(mRes?.data) ? mRes.data : Array.isArray(mRes) ? mRes : [];
            const list = refreshed.length > 0 ? refreshed : (createdMachine ? [createdMachine] : []);
            setMachines(list);
            const mId = String(createdMachine?.id || list[0]?.id || "");
            if (mId) {
              setForm((prev) => ({ ...prev, machine_id: mId }));
            }
          } catch {
            // fallback
          }
        }}
      />
    </ListPageShell>
  );
}