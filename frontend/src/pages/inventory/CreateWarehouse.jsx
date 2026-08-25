import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar } from "lucide-react";

import PageHeader from "../../components/common/PageHeader";
import { createWarehouse } from "../../api/inventoryApi";
import useTenantId from "../../hooks/useTenantId";
import { todayIso } from "../../utils/dateUtils";

import Button from "../../components/common/Button";
import { inputMtClass as inputClass } from "../../design-system/classes";

export default function CreateWarehouse() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    tenant_id: tenantId,
    date: todayIso(),
    name: "",
    code: "",
    capacity: "",
    is_primary: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await createWarehouse({
        ...form,
        capacity: form.capacity ? Number(form.capacity) : null,
      });
      navigate("/inventory/warehouses");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to create warehouse.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        to="/inventory/warehouses"
        className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-[var(--color-success)] dark:text-teal-400"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to warehouses
      </Link>
      <PageHeader
        subtitle="Add a new warehouse to organize and track stock by location."
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
            placeholder="e.g. Main Store"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Code *
          <input
            type="text"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            required
            placeholder="e.g. WH-01"
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Capacity (optional)
          <input
            type="number"
            min="0"
            value={form.capacity}
            onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            placeholder="e.g. 1000"
            className={inputClass}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.is_primary}
            onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Set as primary warehouse
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" to="/inventory/warehouses">
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create warehouse"}
          </Button>
        </div>
      </form>
    </div>
  );
}