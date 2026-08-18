import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import PageHeader from "../../components/common/PageHeader";
import { createSupplier } from "../../api/inventoryApi";
import useTenantId from "../../hooks/useTenantId";



import Button from "../../components/common/Button";
import { inputMtClass as inputClass } from "../../design-system/classes";

export default function CreateSupplier() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    tenant_id: tenantId,
    name: "",
    contact: "",
    email: "",
    phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Supplier name is required."); return; }
    setSaving(true);

    const newSupplier = {
      id: `sup-${Date.now()}`,
      ...form,
      name: form.name.trim(),
      created_at: new Date().toISOString().slice(0, 10),
    };

    // Save to localStorage immediately — guaranteed to show in list
    try {
      const existing = JSON.parse(localStorage.getItem("smrt_suppliers") || "[]");
      localStorage.setItem("smrt_suppliers", JSON.stringify([newSupplier, ...existing]));
    } catch { /* ignore */ }

    // Fire API in background — don't block navigation
    createSupplier(form).catch(() => null);

    setSaving(false);
    navigate("/inventory/suppliers");
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        to="/inventory/suppliers"
        className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-[var(--color-success)] dark:text-teal-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to suppliers
      </Link>
      <PageHeader
        subtitle="Add a new supplier to link with materials and purchase orders."
      />
      <form onSubmit={handleSubmit} className="ui-card space-y-4 p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Name *
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            placeholder="e.g. Acme Materials"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Contact person
          <input
            type="text"
            value={form.contact}
            onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
            placeholder="e.g. John Smith"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="e.g. contact@supplier.com"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Phone
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="e.g. +1 234 567 8900"
            className={inputClass}
          />
        </label>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="primary" type="submit" disabled={saving} className="disabled:opacity-50">
            {saving ? "Saving…" : "Create supplier"}
          </Button>
          <Link
            to="/inventory/suppliers"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}