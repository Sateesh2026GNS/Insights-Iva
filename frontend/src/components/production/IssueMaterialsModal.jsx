import { useState, useEffect } from "react";
import { X, Package, Cpu, Layers, Warehouse, CheckCircle } from "lucide-react";
import { getMachines, getWorkOrderDetail, issueWorkOrderMaterials, updateProductionOrderMachine } from "../../api/productionApi";
import { notifyManufacturingSpine, MANUFACTURING_EVENTS } from "../../utils/manufacturingEvents";
import ShorthandQuantityInput from "../common/ShorthandQuantityInput";

const WAREHOUSES = [
  { id: "WH-MAIN", name: "Main Store (WH-MAIN)" },
  { id: "WH-PROD", name: "Production Store (WH-PROD)" },
  { id: "WH-FG", name: "FG Warehouse (WH-FG)" },
];

export default function IssueMaterialsModal({ workOrder, onClose, onSuccess, addToast }) {
  const [machines, setMachines] = useState([]);
  const [materials, setMaterials] = useState(workOrder?.materials || []);
  const [materialsError, setMaterialsError] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const woNumber = workOrder?.work_order_number || `WO-${Date.now().toString().slice(-6)}`;
  const prodName = workOrder?.product_name || "Product";
  const serverWorkOrder = typeof workOrder?.id === "number";
  const canIssueMaterials = !serverWorkOrder || (!loadingOptions && !materialsError && materials.length > 0);

  const [form, setForm] = useState({
    work_order_number: woNumber,
    product_name: prodName,
    quantity: workOrder?.planned_quantity || 100,
    machine_id: workOrder?.machine_id || "",
    warehouse_id: "WH-MAIN",
    operator_name: workOrder?.operator_name || "",
    remarks: "",
  });

  useEffect(() => {
    let active = true;
    setLoadingOptions(true);
    const loadMaterials = typeof workOrder?.id === "number"
      ? getWorkOrderDetail(workOrder.id).then((res) => res?.data?.materials || [])
      : Promise.resolve(workOrder?.materials || []);
    Promise.all([
      getMachines().catch(() => ({ data: [] })),
      loadMaterials.catch((err) => {
        if (active) {
          const detail = err?.response?.data?.detail;
          setMaterialsError(typeof detail === "string" ? detail : "Could not load this work order's BOM materials.");
        }
        return [];
      }),
    ]).then(([mRes, materialRows]) => {
      if (!active) return;
      setMachines(mRes?.data || []);
      setMaterials(Array.isArray(materialRows) ? materialRows : []);
    }).finally(() => {
      if (active) setLoadingOptions(false);
    });
    return () => { active = false; };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!canIssueMaterials) {
      addToast?.(materialsError || "This work order has no BOM components to issue.", "error");
      return;
    }
    setSubmitting(true);

    const selectedMachine = machines.find((m) => String(m.id) === String(form.machine_id));
    const machineName = selectedMachine
      ? selectedMachine.name || selectedMachine.code || `Machine #${selectedMachine.id}`
      : form.machine_id
        ? `Machine #${form.machine_id}`
        : "";
    const plannedQty = Number(form.quantity) || workOrder?.planned_quantity || 100;

    // Server work orders: issue via API only (inventory must update)
    if (workOrder && typeof workOrder.id === "number") {
      try {
        const warehouseId =
          form.warehouse_id && /^\d+$/.test(String(form.warehouse_id))
            ? Number(form.warehouse_id)
            : undefined;
        await issueWorkOrderMaterials(workOrder.id, warehouseId);
        if (form.machine_id) {
          const poId = workOrder.production_order_id;
          if (poId) {
            await updateProductionOrderMachine(poId, Number(form.machine_id)).catch(() => null);
          }
        }
        notifyManufacturingSpine(MANUFACTURING_EVENTS.WORK_ORDER_UPDATED, { workOrderId: workOrder.id });
        addToast?.(`Materials issued for ${woNumber}`, "success");
        onSuccess?.(workOrder);
        onClose?.();
      } catch (err) {
        const detail = err?.response?.data?.detail;
        addToast?.(
          typeof detail === "string"
            ? detail
            : detail?.message || "Failed to issue materials — inventory was not updated",
          "error"
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Local-only demo rows (non-numeric ids)
    try {
      const storedWOs = localStorage.getItem("smrt_local_work_orders") || localStorage.getItem("smrt_work_orders");
      const localWOs = storedWOs ? JSON.parse(storedWOs) : [];
      let updatedWOs = localWOs.map((w) => {
        if (w.id === workOrder?.id || w.work_order_number === woNumber || (workOrder?.id && String(w.id) === String(workOrder.id))) {
          return {
            ...w,
            materials_issued: true,
            machine_id: form.machine_id || w.machine_id || "",
            machine_name: machineName || w.machine_name || "Unassigned",
            operator_name: form.operator_name || w.operator_name || "",
            planned_quantity: plannedQty,
            warehouse_id: form.warehouse_id,
            status: w.status === "planned" || w.status === "draft" ? "material_ready" : w.status,
          };
        }
        return w;
      });
      localStorage.setItem("smrt_local_work_orders", JSON.stringify(updatedWOs));
      localStorage.setItem("smrt_work_orders", JSON.stringify(updatedWOs));
      addToast?.(`Materials marked issued locally for ${woNumber}`, "success");
      onSuccess?.(workOrder);
      onClose?.();
    } catch {
      addToast?.("Failed to update local work order", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Issue Materials Form</h3>
              <p className="text-xs text-slate-500">{woNumber} · {prodName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Work Order Number
              </label>
              <input
                type="text"
                name="work_order_number"
                value={form.work_order_number}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                readOnly
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Target Quantity
              </label>
              <ShorthandQuantityInput
                value={form.quantity}
                onChange={(val) => setForm((prev) => ({ ...prev, quantity: val }))}
                placeholder="e.g. 100"
              />
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Layers className="h-4 w-4 text-cyan-600" /> BOM materials to issue
              </h4>
              <span className="text-[10px] text-slate-500">All listed components issue together</span>
            </div>
            {loadingOptions ? (
              <p className="px-3 py-3 text-sm text-slate-500">Loading work order materials…</p>
            ) : materialsError ? (
              <p className="px-3 py-3 text-sm text-red-600">{materialsError}</p>
            ) : materials.length === 0 ? (
              <p className="px-3 py-3 text-sm text-amber-700">No BOM components are linked to this work order.</p>
            ) : (
              <div className="max-h-48 overflow-auto">
                {materials.map((material, index) => (
                  <div key={`${material.item_id || material.sku || material.component_name}-${index}`} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-0 dark:border-slate-800">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{material.component_name}</p>
                      {material.sku && <p className="text-xs text-slate-500">{material.sku}</p>}
                    </div>
                    <div className="shrink-0 text-right text-xs text-slate-600 dark:text-slate-300">
                      <p>Required: {material.required_qty} {material.unit || "pcs"}</p>
                      {material.available_qty != null && <p>Available: {material.available_qty} {material.unit || "pcs"}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Machine Selector Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Cpu className="h-3.5 w-3.5 text-blue-600" /> Machine Allocation
            </label>
            <select
              name="machine_id"
              value={form.machine_id}
              onChange={handleChange}
              disabled={loadingOptions}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Select Machine (Optional)</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.code}) — {m.status || "idle"}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Warehouse className="h-3.5 w-3.5 text-amber-600" /> Issue From Warehouse
            </label>
            <select
              name="warehouse_id"
              value={form.warehouse_id}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {WAREHOUSES.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Operator Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Assigned Operator Name
            </label>
            <input
              type="text"
              name="operator_name"
              placeholder="e.g. Ravi Kumar"
              value={form.operator_name}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Submit Actions */}
          <div className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !canIssueMaterials}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60"
            >
              {submitting ? "Issuing..." : (
                <>
                  <CheckCircle className="h-4 w-4" /> Issue Materials
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
