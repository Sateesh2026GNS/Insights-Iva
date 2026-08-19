import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Cpu, X } from "lucide-react";

import { SHIFTS } from "../../data/productionPlanningMasterData";
import { getMachines, quickCreateWorkOrder } from "../../api/productionApi";
import { fetchFinishedGoodsWithFallback } from "../../utils/productOptions";
import { fetchCustomersWithFallback } from "../../utils/customerOptions";
import { apiErrorMessage } from "../../utils/apiError";
import Button from "../common/Button";

function toDateTimeLocal(value) {
  if (!value) return "";
  const s = String(value);
  if (s.length >= 16 && s[10] === "T") return s.slice(0, 16);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function QuickWorkOrderModal({ order, onClose, onSuccess, addToast }) {
  const [machines, setMachines] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customCustomerMode, setCustomCustomerMode] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);

  const poNumber = order?.order_number || order?.id || "";
  const initialWoNumber = poNumber ? `WO-${poNumber}` : `WO-${Date.now().toString().slice(-6)}`;

  const [form, setForm] = useState({
    work_order_number: initialWoNumber,
    product_name: order?.product_name || "",
    product_id: order?.product_id ? String(order.product_id) : "",
    planned_quantity: order?.planned_quantity || 100,
    customer_id: order?.customer_id ? String(order.customer_id) : "",
    customer_name: order?.buyer_company || order?.customer_name || "",
    machine_id: order?.machine_id ? String(order.machine_id) : "",
    operator_name: order?.operator_name || "",
    shift: typeof order?.shift === "object" ? order?.shift?.id || "General" : order?.shift || "General",
    priority: order?.priority || "medium",
    start_date: toDateTimeLocal(order?.start_date),
    due_date: toDateTimeLocal(order?.due_date),
  });

  useEffect(() => {
    let cancelled = false;
    setLoadingOptions(true);
    Promise.all([
      getMachines().catch(() => ({ data: [] })),
      fetchFinishedGoodsWithFallback().catch(() => []),
      fetchCustomersWithFallback().catch(() => []),
    ])
      .then(([mRes, pRes, cRes]) => {
        if (cancelled) return;
        setMachines(Array.isArray(mRes?.data) ? mRes.data : []);
        const prods = Array.isArray(pRes) ? pRes : [];
        setProducts(prods);
        const custs = Array.isArray(cRes) ? cRes : [];
        setCustomers(custs);

        if (order?.product_id) {
          const selected = prods.find((p) => String(p.id) === String(order.product_id));
          setForm((prev) => ({
            ...prev,
            product_id: String(order.product_id),
            product_name: selected?.name || order.product_name || prev.product_name,
          }));
        }

        const prefilledCustomer = order?.buyer_company || order?.customer_name;
        if (prefilledCustomer) {
          const cName = String(prefilledCustomer).toLowerCase().trim();
          const matched = custs.find(
            (c) =>
              (c.name || c.company || "").toLowerCase().trim() === cName ||
              (order.customer_id && String(c.id) === String(order.customer_id))
          );
          if (matched) {
            setForm((prev) => ({
              ...prev,
              customer_id: String(matched.id),
              customer_name: matched.name || matched.company || prev.customer_name,
            }));
          } else {
            setCustomCustomerMode(true);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [order?.product_id, order?.product_name, order?.customer_id, order?.customer_name, order?.buyer_company]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "product_id") {
      const selected = products.find((p) => String(p.id) === String(value));
      setForm((prev) => ({
        ...prev,
        product_id: value,
        product_name: selected?.name || selected?.sku || prev.product_name,
      }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.product_id) {
      addToast?.("Select a product to create the work order", "error");
      return;
    }
    setSaving(true);
    const woNum = form.work_order_number?.trim() || `WO-${Date.now().toString().slice(-6)}`;
    const shiftVal =
      typeof form.shift === "object" ? form.shift?.label || form.shift?.id || "General" : form.shift || "General";

    try {
      const res = await quickCreateWorkOrder({
        production_order_id: order?.id ? Number(order.id) : null,
        work_order_number: woNum,
        product_id: Number(form.product_id),
        planned_quantity: Number(form.planned_quantity || 0),
        customer_name: form.customer_name || null,
        machine_id: form.machine_id ? Number(form.machine_id) : null,
        shift: shiftVal,
        operator_name: form.operator_name || null,
        priority: form.priority || "medium",
        planned_start: form.start_date || null,
        planned_end: form.due_date || null,
      });
      const created = res?.data || {};
      addToast?.(`Work Order ${created.work_order_number || woNum} created successfully`, "success");
      onSuccess?.({
        id: created.id,
        work_order_number: created.work_order_number || woNum,
        status: created.status || "planned",
      });
      onClose?.();
    } catch (err) {
      addToast?.(apiErrorMessage(err, "Failed to create work order"), "error");
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-wo-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-action-teal)]/15 text-[var(--color-action-teal)]">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 id="quick-wo-title" className="text-base font-bold text-[var(--color-text)]">
              New Work Order
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="ui-label">Work Order Number</span>
              <input
                name="work_order_number"
                value={form.work_order_number}
                onChange={handleChange}
                required
                className="ui-input"
              />
            </label>
            <label className="block space-y-1">
              <span className="ui-label">Product</span>
              {order?.product_id ? (
                <input value={form.product_name} readOnly className="ui-input bg-[var(--color-surface-muted)]" />
              ) : (
                <select
                  name="product_id"
                  value={form.product_id}
                  onChange={handleChange}
                  required
                  disabled={loadingOptions}
                  className="ui-select"
                >
                  <option value="">{loadingOptions ? "Loading products…" : "Select product…"}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.sku}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="ui-label">Planned Quantity</span>
              <input
                type="number"
                name="planned_quantity"
                min="1"
                value={form.planned_quantity}
                onChange={handleChange}
                required
                className="ui-input"
              />
            </label>
            <label className="block space-y-1">
              <span className="ui-label">Machine</span>
              <select name="machine_id" value={form.machine_id} onChange={handleChange} className="ui-select">
                <option value="">Select Machine…</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.code}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="ui-label">Customer</span>
              {order?.customer_name && order?.customer_id ? (
                <input value={form.customer_name} readOnly className="ui-input bg-[var(--color-surface-muted)]" />
              ) : customCustomerMode ? (
                <div className="flex gap-1.5">
                  <input
                    name="customer_name"
                    value={form.customer_name}
                    onChange={handleChange}
                    placeholder="Enter customer name…"
                    className="ui-input flex-1"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCustomCustomerMode(false);
                      setForm((prev) => ({ ...prev, customer_id: "", customer_name: "" }));
                    }}
                    className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)]"
                  >
                    Select
                  </button>
                </div>
              ) : (
                <select
                  name="customer_id"
                  value={form.customer_id}
                  onChange={handleCustomerChange}
                  disabled={loadingOptions}
                  className="ui-select"
                >
                  <option value="">{loadingOptions ? "Loading customers…" : "Select customer…"}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.company}{c.customer_code ? ` (${c.customer_code})` : ""}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter new / custom customer…</option>
                </select>
              )}
            </label>
            <label className="block space-y-1">
              <span className="ui-label">Operator</span>
              <input name="operator_name" value={form.operator_name} onChange={handleChange} className="ui-input" />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="ui-label">Shift</span>
              <select name="shift" value={form.shift} onChange={handleChange} className="ui-select">
                {SHIFTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="ui-label">Priority</span>
              <select name="priority" value={form.priority} onChange={handleChange} className="ui-select">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="ui-label">Start</span>
              <input
                type="datetime-local"
                name="start_date"
                value={form.start_date}
                onChange={handleChange}
                className="ui-input"
              />
            </label>
            <label className="block space-y-1">
              <span className="ui-label">Due</span>
              <input
                type="datetime-local"
                name="due_date"
                value={form.due_date}
                onChange={handleChange}
                className="ui-input"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button variant="secondary" type="button" onClick={onClose}  disabled={saving}>
              Cancel
            </Button>
            <Button variant="success" type="submit" disabled={saving || loadingOptions}>
              {saving ? "Creating…" : "Create Work Order"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
