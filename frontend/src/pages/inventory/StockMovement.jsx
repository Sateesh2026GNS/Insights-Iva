import { useEffect, useState } from "react";
import { Calendar, PackageMinus } from "lucide-react";

import Loader from "../../components/common/Loader";
import StoreManagerNav from "../../components/inventory/StoreManagerNav";
import { useToast } from "../../context/ToastContext";
import {
  getInventoryDashboard,
  getWarehouses,
  recordStockMovement,
} from "../../api/inventoryApi";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import { isStoreManager } from "../../config/permissions";
import useAuth from "../../hooks/useAuth";
import { todayIso } from "../../utils/dateUtils";

import Button from "../../components/common/Button";

function itemLabel(item) {
  const code = item.product_code || item.code || item.item_code;
  const name = item.name || "Item";
  const stock = item.total_quantity ?? item.current_stock ?? 0;
  return code ? `${code} — ${name} (Stock: ${stock})` : `${name} (Stock: ${stock})`;
}

export default function StockMovement() {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const { user } = useAuth();
  const storeMode = isStoreManager(user);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({
    date: todayIso(),
    warehouse_id: "",
    item_id: "",
    quantity: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const load = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [itemsRes, whRes] = await Promise.all([
        getInventoryDashboard(),
        getWarehouses(tenantId),
      ]);
      setItems(itemsRes.data || []);
      setWarehouses(whRes.data || []);
    } catch (err) {
      if (!isRefresh) {
        setItems([]);
        setWarehouses([]);
        addToast("Could not load stock data", "error");
      }
      if (isRefresh) throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  usePageRefresh(() => load(true));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await recordStockMovement({
        tenant_id: tenantId,
        warehouse_id: Number(form.warehouse_id),
        item_id: Number(form.item_id),
        quantity: Math.max(1, Math.round(Number(form.quantity))),
        movement_type: "out",
      });
      addToast("Material issued successfully");
      setForm({ date: todayIso(), warehouse_id: "", item_id: "", quantity: "", notes: "" });
      load();
    } catch {
      addToast("Failed to issue material", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {storeMode ? <StoreManagerNav /> : null}
        <Loader label="Loading stock out…" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {storeMode ? <StoreManagerNav /> : null}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ui-subtitle">
            Issue material from a warehouse to production or another department.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <PackageMinus className="h-4 w-4 text-[var(--color-primary)]" />
          Issue Material
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Issue Date *</span>
            <div className="relative mt-1 flex items-center">
              <input
                type="date"
                required
                value={form.date || todayIso()}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value || todayIso() }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-9 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
              <Calendar className="pointer-events-none absolute right-2.5 h-4 w-4 text-slate-400" />
            </div>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Warehouse</span>
            <select
              value={form.warehouse_id}
              onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            >
              <option value="">Select warehouse</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.code ? ` (${w.code})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Product</span>
            <select
              value={form.item_id}
              onChange={(e) => setForm((f) => ({ ...f, item_id: e.target.value }))}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            >
              <option value="">Select product</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {itemLabel(i)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Quantity to issue</span>
            <input
              type="number"
              min="1"
              step="any"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              required
              placeholder="e.g. 10"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Notes / remarks (optional)</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Job order #, department, operator name…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </label>

          <div className="flex justify-end pt-2">
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? "Issuing…" : "Issue Material"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
