import { useEffect, useState, useMemo } from "react";
import { X, Save } from "lucide-react";
import { createSalesOrder } from "../../api/salesApi";
import { fetchCustomersWithFallback, resolveCustomerId } from "../../utils/customerOptions";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import useAuth from "../../hooks/useAuth";
import Loader from "../common/Loader";
import Button from "../common/Button";
import { inputMtClass as inputClass } from "../../design-system/classes";

export default function SalesOrderFormModal({ onClose, onSave }) {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    tenant_id: tenantId,
    customer_id: "",
    order_number: "",
    reference_number: "",
    order_date: new Date().toISOString().slice(0, 10),
    status: "draft",
    sales_person: "",
    total_amount: "",
  });

  useEffect(() => {
    if (user && !form.sales_person) {
      const name = user.full_name || user.name || user.email || "";
      if (name) setForm((f) => ({ ...f, sales_person: name }));
    }
  }, [user, form.sales_person]);

  const uniqueCustomers = useMemo(() => {
    const map = new Map();
    (customers || []).forEach((c) => {
      const displayName = c.company || c.name || c.customer_name;
      const cleanName = String(displayName || "").trim();
      const lower = cleanName.toLowerCase();
      if (cleanName && cleanName.length >= 2 && !map.has(lower)) {
        map.set(lower, { ...c, id: c.id || cleanName, name: cleanName });
      }
    });
    return Array.from(map.values());
  }, [customers]);

  useEffect(() => {
    fetchCustomersWithFallback()
      .then(setCustomers)
      .catch(() => setError("Could not load customers."))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const customerId = await resolveCustomerId(form.customer_id, uniqueCustomers, tenantId);
      await createSalesOrder({
        ...form,
        customer_id: customerId,
        order_number: form.order_number || `SO-${Date.now()}`,
        sales_person: form.sales_person?.trim() || null,
        total_amount: Number(form.total_amount) || 0,
      });
      addToast("Sales order created successfully", "success");
      onSave?.();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="rounded-2xl bg-white p-6 shadow-2xl">
        <Loader label="Loading customers..." />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b px-5 py-4">
          <h2 className="text-xl font-bold text-slate-900">Create New Sales Order</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase">Customer *</label>
            <select
              required
              value={form.customer_id}
              onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
              className={inputClass}
            >
              <option value="">Select customer</option>
              {uniqueCustomers.map((c) => (
                <option key={c.id || c.name} value={c.id || c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase">Order Number</label>
              <input
                type="text"
                value={form.order_number}
                onChange={(e) => setForm((f) => ({ ...f, order_number: e.target.value }))}
                placeholder="Auto-generated if empty"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase">Reference Number</label>
              <input
                type="text"
                value={form.reference_number}
                onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
                placeholder="e.g. PO-8921"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase">Sales Person</label>
            <input
              type="text"
              value={form.sales_person}
              onChange={(e) => setForm((f) => ({ ...f, sales_person: e.target.value }))}
              placeholder="Assigned salesperson"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase">Order Date</label>
              <input
                type="date"
                value={form.order_date}
                onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase">Total Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.total_amount}
                onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))}
                placeholder="0.00"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className={inputClass}
            >
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving || !form.customer_id} loading={saving} leftIcon={!saving ? <Save className="h-4 w-4" aria-hidden /> : undefined}>
              {saving ? "Saving…" : "Save Order"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
