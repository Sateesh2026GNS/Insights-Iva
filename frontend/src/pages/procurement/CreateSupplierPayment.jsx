import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import PageHeader from "../../components/common/PageHeader";
import { createSupplierPayment, getVendors } from "../../api/procurementApi";
import useTenantId from "../../hooks/useTenantId";



import Button from "../../components/common/Button";
import { inputMtClass as inputClass } from "../../design-system/classes";

const PAYMENT_METHODS = ["bank", "cash", "cheque", "upi", "other"];

export default function CreateSupplierPayment() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    tenant_id: tenantId,
    supplier_id: "",
    payment_date: new Date().toISOString().slice(0, 10),
    amount: "",
    payment_method: "bank",
    reference: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getVendors(tenantId)
      .then((r) => setVendors(r.data || []))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await createSupplierPayment({
        ...form,
        supplier_id: Number(form.supplier_id),
        amount: Number(form.amount),
        reference: form.reference || null,
        notes: form.notes || null,
      });
      navigate("/procurement/supplier-payments");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center">
        <p className="text-sm text-slate-500">Loading vendors…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        to="/procurement/supplier-payments"
        className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-[var(--color-success)] dark:text-teal-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to supplier payments
      </Link>
      <PageHeader
        title="Record supplier payment"
        subtitle="Record a payment made to a vendor."
      />
      <form onSubmit={handleSubmit} className="ui-card space-y-4 p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}
        {vendors.length === 0 && (
          <p className="text-sm text-slate-500">
            No vendors yet.{" "}
            <Link to="/procurement/vendors/create" className="font-medium text-teal-600 hover:underline">
              Add a vendor first
            </Link>
            .
          </p>
        )}
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Supplier *
          <select
            required
            value={form.supplier_id}
            onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
            className={inputClass}
          >
            <option value="">Select supplier</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Payment date *
          <input
            type="date"
            required
            value={form.payment_date}
            onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Amount *
          <input
            type="number"
            required
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="e.g. 5000.00"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Payment method
          <select
            value={form.payment_method}
            onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
            className={inputClass}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Reference
          <input
            type="text"
            value={form.reference}
            onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
            placeholder="e.g. Bank ref, cheque no."
            className={inputClass}
          />
        </label>
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
          <Button variant="primary" type="submit" disabled={saving || !form.supplier_id || !form.amount} className="disabled:opacity-50">
            {saving ? "Saving…" : "Record payment"}
          </Button>
          <Link
            to="/procurement/supplier-payments"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}