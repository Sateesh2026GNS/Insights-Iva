import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2,
  Plus,
  MapPin,
  Warehouse,
  X,
  Building2,
  CheckCircle2,
} from "lucide-react";

import { createWarehouse, getWarehouses } from "../../api/inventoryApi";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";

import { inputMtClass as inputClass } from "../../design-system/classes";

const emptyForm = {
  name: "",
  code: "",
  capacity: "",
  is_primary: false,
};

export default function SettingsDeliveryLocation() {
  const { addToast } = useToast();
  const tenantId = useTenantId();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getWarehouses();
      setLocations(Array.isArray(res.data) ? res.data : []);


    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to load delivery locations", "error");
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const openForm = () => {
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      setFormError("Name and code are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await createWarehouse({
        tenant_id: tenantId,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        capacity: form.capacity ? Number(form.capacity) : null,
        is_primary: Boolean(form.is_primary),
      });
      addToast("Delivery location created successfully.", "success");
      setShowForm(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.message;
      setFormError(
        typeof detail === "string" ? detail : "Failed to create delivery location."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Delivery Locations
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Warehouses and storage sites used as delivery destinations for dispatch and inventory.
          </p>
        </div>
        <button
          type="button"
          onClick={openForm}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-success)]"
        >
          <Plus className="h-4 w-4" />
          Add Warehouse
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/50 sm:p-6"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                New delivery location
              </h2>
              <p className="text-xs text-slate-500">
                This creates a warehouse used across inventory and dispatch.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {formError && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {formError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Warehouse name <span className="text-red-500">*</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Main Plant Store"
                required
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Code <span className="text-red-500">*</span>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. WH-01"
                required
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
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.is_primary}
                onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              Set as primary warehouse
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-success)] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? "Saving…" : "Create location"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {locations.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-gradient-to-b from-slate-50 to-white px-6 py-14 text-center dark:border-slate-600 dark:from-slate-800/40 dark:to-slate-800/20">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-success-soft)] text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
            <Warehouse className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            No delivery locations yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Add a warehouse to define where goods are stored and delivered from. You can also manage
            warehouses under Inventory.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={openForm}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-success)]"
            >
              <Plus className="h-4 w-4" />
              Add first warehouse
            </button>
            <Link
              to="/inventory/warehouses"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              Open Inventory Warehouses
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {locations.map((loc) => (
            <article
              key={loc.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[var(--color-primary-light)] hover:shadow-md dark:border-slate-700 dark:bg-slate-800/50"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-success-soft)] text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">
                      {loc.name || `Warehouse #${loc.id}`}
                    </h3>
                    {loc.is_primary && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Primary
                      </span>
                    )}
                  </div>
                  {loc.code && (
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Code: {loc.code}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    {loc.capacity != null && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        Capacity: {loc.capacity}
                      </span>
                    )}
                    {loc.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {loc.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
