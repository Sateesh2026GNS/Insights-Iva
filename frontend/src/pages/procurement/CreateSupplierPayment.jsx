import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Wallet } from "lucide-react";

import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import Button from "../../components/common/Button";
import { Input, Select, Textarea, FormRow } from "../../components/common/FormField";
import { DatePicker } from "../../design-system/dateControls";
import { createSupplierPayment, getVendors } from "../../api/procurementApi";
import useTenantId from "../../hooks/useTenantId";
import { useToast } from "../../context/ToastContext";
import { todayIso } from "../../utils/dateUtils";
import { apiErrorMessage } from "../../utils/apiError";

const PAYMENT_METHODS = [
  { value: "bank", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "upi", label: "UPI" },
  { value: "other", label: "Other" },
];

export default function CreateSupplierPayment() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    tenant_id: tenantId,
    supplier_id: "",
    payment_date: todayIso(),
    amount: "",
    payment_method: "bank",
    reference: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getVendors(tenantId)
      .then((r) => setVendors(Array.isArray(r.data) ? r.data : []))
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier_id || !form.amount) return;
    setSaving(true);
    try {
      await createSupplierPayment({
        ...form,
        tenant_id: tenantId,
        supplier_id: Number(form.supplier_id),
        amount: Number(form.amount),
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
      });
      addToast("Supplier payment recorded");
      navigate("/procurement/supplier-payments");
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to record payment."), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loader label="Loading suppliers…" />;
  }

  return (
    <div className="ui-page mx-auto max-w-2xl">
      <Link
        to="/procurement/supplier-payments"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)] hover:underline"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to supplier payments
      </Link>

      <PageHeader
        title="Record supplier payment"
        subtitle="Log a payment made to a vendor — bank, cash, cheque, or UPI."
      />

      {vendors.length === 0 ? (
        <div className="ui-card flex flex-col items-center gap-4 p-8 text-center sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Building2 className="h-7 w-7" aria-hidden />
          </div>
          <div className="max-w-sm space-y-1">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">No suppliers yet</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Add a vendor before recording a supplier payment.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button variant="primary" to="/procurement/vendors/create">
              Add vendor
            </Button>
            <Button variant="outline" to="/procurement/supplier-payments">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="ui-card space-y-5 p-6 sm:p-8">
          <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-4 py-3">
            <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
            <p className="text-sm text-[var(--color-text-secondary)]">
              Payment will be linked to the selected supplier. Reference and notes are optional but help with reconciliation.
            </p>
          </div>

          <Select
            label="Supplier"
            required
            value={form.supplier_id}
            onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
            placeholder="Select supplier"
            options={vendors.map((v) => ({ value: String(v.id), label: v.name }))}
          />

          <FormRow>
            <DatePicker
              label="Payment date"
              required
              value={form.payment_date}
              onChange={(value) => setForm((f) => ({ ...f, payment_date: value }))}
              max={todayIso()}
            />
            <Input
              label="Amount"
              type="number"
              required
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="e.g. 5000.00"
            />
          </FormRow>

          <Select
            label="Payment method"
            value={form.payment_method}
            onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
            options={PAYMENT_METHODS}
          />

          <Input
            label="Reference"
            value={form.reference}
            onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
            placeholder="e.g. Bank ref, cheque no."
          />

          <Textarea
            label="Notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional payment notes"
          />

          <div className="flex flex-wrap gap-3 border-t border-[var(--color-border-soft)] pt-5">
            <Button
              variant="primary"
              type="submit"
              loading={saving}
              disabled={!form.supplier_id || !form.amount || !form.payment_date}
            >
              Record payment
            </Button>
            <Button variant="outline" to="/procurement/supplier-payments">
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
