import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

import { fetchCustomersWithFallback } from "../../utils/customerOptions";

import Button from "../common/Button";
import { DatePicker, TimePicker } from "../../design-system/dateControls";
import { addDaysIso, todayIso } from "../../utils/dateUtils";

const EMPTY = {
  customer_id: "",
  customer_name: "",
  quote_date: todayIso(),
  valid_until: addDaysIso(todayIso(), 30),
  total_amount: "",
  sales_person: "",
  notes: "",
  status: "draft",
};

export default function CreateQuotationModal({ open, onClose, onSubmit, saving }) {
  const [form, setForm] = useState(EMPTY);
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({
      ...EMPTY,
      quote_date: todayIso(),
      valid_until: addDaysIso(todayIso(), 30),
    });
    setError("");
    setLoadingCustomers(true);
    fetchCustomersWithFallback()
      .then((list) => setCustomers(Array.isArray(list) ? list : []))
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [open]);

  if (!open) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onCustomerChange = (customerId) => {
    const customer = customers.find((c) => String(c.id) === String(customerId));
    setForm((prev) => ({
      ...prev,
      customer_id: customerId,
      customer_name: customer?.name || prev.customer_name,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.customer_id && !form.customer_name.trim()) {
      setError("Select a customer or enter a customer name.");
      return;
    }
    if (!form.quote_date) {
      setError("Quote date is required.");
      return;
    }
    const payload = {
      customer_id: form.customer_id ? Number(form.customer_id) : null,
      customer_name: form.customer_name.trim() || null,
      quote_date: form.quote_date,
      valid_until: form.valid_until || null,
      total_amount: form.total_amount ? Number(form.total_amount) : 0,
      sales_person: form.sales_person.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status || "draft",
    };
    try {
      await onSubmit?.(payload);
      setForm(EMPTY);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not create quotation.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">New Quotation</h2>
            <p className="text-sm text-slate-500">Prepare a quote for a customer. Quote number is assigned automatically.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4">
          {error ? (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Customer" className="sm:col-span-2">
              <select
                value={form.customer_id}
                onChange={(e) => onCustomerChange(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                disabled={loadingCustomers}
              >
                <option value="">{loadingCustomers ? "Loading customers…" : "Select customer (optional)"}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.gstin ? ` · ${c.gstin}` : ""}
                  </option>
                ))}
              </select>
              {!loadingCustomers && customers.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">
                  No customers yet.{" "}
                  <Link to="/masters/customers?create=1" className="font-semibold text-[var(--color-success)] hover:underline">
                    Add a customer
                  </Link>{" "}
                  or type a name below.
                </p>
              ) : null}
            </Field>

            <Field label="Customer name *" className="sm:col-span-2">
              <input
                required
                value={form.customer_name}
                onChange={(e) => set("customer_name", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Shown on the quotation"
              />
            </Field>

            <Field label="Quote date *">
              <input
                type="date"
                required
                value={form.quote_date}
                onChange={(e) => set("quote_date", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Valid until">
              <input
                type="date"
                value={form.valid_until}
                onChange={(e) => set("valid_until", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Amount (₹)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.total_amount}
                onChange={(e) => set("total_amount", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </Field>

            <Field label="Sales person">
              <input
                value={form.sales_person}
                onChange={(e) => set("sales_person", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Sales executive"
              />
            </Field>

            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                {["draft", "sent"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Notes" className="sm:col-span-2">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Scope, terms, or follow-up notes"
              />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700">
              Cancel
            </button>
            <Button variant="primary" type="submit" disabled={saving} className="disabled:opacity-60">
              {saving ? "Saving…" : "Create Quotation"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
