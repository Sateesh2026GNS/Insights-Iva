import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import PageHeader from "../../components/common/PageHeader";
import InventoryLineItems from "../../components/common/InventoryLineItems";
import useTenantId from "../../hooks/useTenantId";
import { createGoodsReceipt, getPurchaseOrders } from "../../api/procurementApi";
import { getWarehouses, getInventoryDashboard } from "../../api/inventoryApi";
import Button from "../../components/common/Button";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";

import { inputMtClass as inputClass } from "../../design-system/classes";

export default function CreateGoodsReceipt() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = useTenantId();
  const [warehouses, setWarehouses] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [lineItems, setLineItems] = useState([
    { item_id: "", quantity_received: "", quantity_rejected: "0" },
  ]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    grn_number: "",
    receipt_date: new Date().toISOString().slice(0, 10),
    warehouse_id: "",
    purchase_order_id: searchParams.get("po_id") || "",
    qc_status: "pending",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getWarehouses().then((r) => setWarehouses(r.data || [])),
      getPurchaseOrders().then((r) => setPurchaseOrders(r.data || [])),
      getInventoryDashboard().then((r) => setInventoryItems(r.data || [])),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validLines = lineItems.filter(
      (l) => l.item_id && Number(l.quantity_received) > 0
    );
    if (validLines.length === 0) {
      setError("Add at least one line with received quantity.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const qc = form.qc_status || "pending";
      const res = await createGoodsReceipt({
        tenant_id: tenantId,
        grn_number: form.grn_number || `GRN-${Date.now()}`,
        receipt_date: form.receipt_date,
        warehouse_id: Number(form.warehouse_id),
        purchase_order_id: form.purchase_order_id
          ? Number(form.purchase_order_id)
          : null,
        status: qc === "pass" ? "received" : "pending_qc",
        qc_status: qc,
        notes: form.notes || null,
        line_items: validLines.map((l) => ({
          item_id: Number(l.item_id),
          quantity_received: Number(l.quantity_received),
          quantity_rejected: Number(l.quantity_rejected) || 0,
        })),
      });
      notifyManufacturingSpine(MANUFACTURING_EVENTS.GRN_RECEIVED, {
        grn_id: res.data?.id,
        qc_status: qc,
      });
      if (qc === "pass") {
        notifyManufacturingSpine(MANUFACTURING_EVENTS.GRN_QC_PASSED, {
          grn_id: res.data?.id,
        });
      }
      navigate("/procurement/goods-receipt");
    } catch (err) {
      setError(
        err.response?.data?.detail || err.message || "Failed to create goods receipt."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/procurement/goods-receipt"
        className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-[var(--color-success)] dark:text-teal-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to goods receipts
      </Link>
      <PageHeader
        title="New goods receipt (GRN)"
        subtitle="Default: pending QC (no stock). Pass QC later, or mark Pass now to post inventory immediately."
      />
      <form onSubmit={handleSubmit} className="ui-card space-y-4 p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}
        {warehouses.length === 0 && (
          <p className="text-sm text-slate-500">
            No warehouses yet.{" "}
            <Link
              to="/inventory/warehouses/create"
              className="font-medium text-teal-600 hover:underline"
            >
              Add a warehouse first
            </Link>
            .
          </p>
        )}
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          GRN number
          <input
            type="text"
            value={form.grn_number}
            onChange={(e) => setForm((f) => ({ ...f, grn_number: e.target.value }))}
            placeholder="Auto-generated if empty"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Receipt date *
          <input
            type="date"
            required
            value={form.receipt_date}
            onChange={(e) => setForm((f) => ({ ...f, receipt_date: e.target.value }))}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Warehouse *
          <select
            required
            value={form.warehouse_id}
            onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
            className={inputClass}
          >
            <option value="">Select warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Purchase order (optional)
          <select
            value={form.purchase_order_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, purchase_order_id: e.target.value }))
            }
            className={inputClass}
          >
            <option value="">— None —</option>
            {purchaseOrders.map((po) => (
              <option key={po.id} value={po.id}>
                {po.po_number || `PO-${po.id}`}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Incoming QC
          <select
            value={form.qc_status}
            onChange={(e) => setForm((f) => ({ ...f, qc_status: e.target.value }))}
            className={inputClass}
          >
            <option value="pending">Pending — hold stock until QC pass</option>
            <option value="pass">Pass — post stock to inventory now</option>
          </select>
        </label>
        <InventoryLineItems
          items={inventoryItems}
          lines={lineItems}
          onChange={setLineItems}
          mode="grn"
        />
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Notes
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className={inputClass}
          />
        </label>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="primary" type="submit" disabled={saving || !form.warehouse_id} className="disabled:opacity-50">
            {saving ? "Saving…" : "Create goods receipt"}
          </Button>
          <Button variant="secondary" to="/procurement/goods-receipt">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
