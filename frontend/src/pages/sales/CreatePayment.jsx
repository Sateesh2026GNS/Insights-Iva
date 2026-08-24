import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText, Wallet } from "lucide-react";

import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import Button from "../../components/common/Button";
import { Input, Select, Textarea, FormRow } from "../../components/common/FormField";
import { DatePicker } from "../../design-system/dateControls";
import { getInvoices, createPayment } from "../../api/salesApi";
import useTenantId from "../../hooks/useTenantId";
import { useToast } from "../../context/ToastContext";
import { formatInr } from "../../data/salesMasterData";
import { todayIso } from "../../utils/dateUtils";
import { apiErrorMessage } from "../../utils/apiError";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank transfer" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "neft", label: "NEFT / RTGS" },
];

function invoiceTotal(inv) {
  return Number(inv?.grand_total ?? inv?.total_amount ?? 0);
}

function invoiceBalance(inv) {
  const paid = Number(inv?.amount_paid ?? inv?.paid_amount ?? 0);
  const total = invoiceTotal(inv);
  const balance = Number(inv?.balance_due ?? inv?.balance ?? total - paid);
  return balance > 0 ? balance : total;
}

function invoiceLabel(inv) {
  const no = inv.invoice_number || `INV-${inv.id}`;
  const customer = inv.customer_name || "Customer";
  return `${no} · ${customer} · ${formatInr(invoiceTotal(inv))}`;
}

export default function CreatePayment() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const preselectedInvoice = searchParams.get("invoice_id");
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState({
    tenant_id: tenantId,
    invoice_id: preselectedInvoice || "",
    amount: "",
    payment_date: todayIso(),
    method: "bank",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getInvoices(tenantId)
      .then((r) => {
        const d = r?.data;
        setInvoices(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []);
      })
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const selectedInvoice = useMemo(
    () => invoices.find((inv) => String(inv.id) === String(form.invoice_id)),
    [invoices, form.invoice_id]
  );

  useEffect(() => {
    if (!preselectedInvoice || !invoices.length) return;
    const inv = invoices.find((i) => String(i.id) === String(preselectedInvoice));
    if (inv && !form.amount) {
      setForm((f) => ({
        ...f,
        invoice_id: String(inv.id),
        amount: String(invoiceBalance(inv).toFixed(2)),
      }));
    }
  }, [preselectedInvoice, invoices, form.amount]);

  const handleInvoiceChange = (invoiceId) => {
    const inv = invoices.find((i) => String(i.id) === String(invoiceId));
    setForm((f) => ({
      ...f,
      invoice_id: invoiceId,
      amount: inv ? String(invoiceBalance(inv).toFixed(2)) : f.amount,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.invoice_id || !form.amount || !form.payment_date) return;
    setSaving(true);
    try {
      const res = await createPayment({
        ...form,
        tenant_id: tenantId,
        invoice_id: Number(form.invoice_id),
        amount: Number(form.amount),
        notes: form.notes.trim() || null,
      });
      notifyManufacturingSpine(MANUFACTURING_EVENTS.PAYMENT_RECORDED, {
        payment_id: res.data?.id,
        invoice_id: Number(form.invoice_id),
      });
      addToast("Payment recorded — AR journal posted");
      navigate("/sales/payments");
    } catch (err) {
      addToast(apiErrorMessage(err, "Payment failed"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loader label="Loading invoices…" />;
  }

  return (
    <div className="ui-page mx-auto max-w-2xl">
      <Link
        to="/sales/payments"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)] hover:underline"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to payment tracking
      </Link>

      <PageHeader
        title="Record payment"
        subtitle="Apply a customer payment against an invoice — cash, bank, UPI, or card."
      />

      {invoices.length === 0 ? (
        <div className="ui-card flex flex-col items-center gap-4 p-8 text-center sm:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <FileText className="h-7 w-7" aria-hidden />
          </div>
          <div className="max-w-sm space-y-1">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">No invoices yet</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Create and post an invoice before recording a customer payment.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button variant="primary" to="/sales/invoices/create">
              Create invoice
            </Button>
            <Button variant="outline" to="/sales/payments">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="ui-card space-y-5 p-6 sm:p-8">
          <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-4 py-3">
            <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden />
            <p className="text-sm text-[var(--color-text-secondary)]">
              Payment is posted to accounts receivable for the selected invoice. Amount defaults to the
              outstanding balance when you pick an invoice.
            </p>
          </div>

          <Select
            label="Invoice"
            required
            value={form.invoice_id}
            onChange={(e) => handleInvoiceChange(e.target.value)}
            placeholder="Select invoice"
            options={invoices.map((inv) => ({
              value: String(inv.id),
              label: invoiceLabel(inv),
            }))}
          />

          {selectedInvoice ? (
            <div className="rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm">
              <p className="font-medium text-[var(--color-text)]">
                {selectedInvoice.customer_name || "Customer"}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[var(--color-text-muted)]">
                <span>
                  Invoice total:{" "}
                  <strong className="text-[var(--color-text)]">{formatInr(invoiceTotal(selectedInvoice))}</strong>
                </span>
                <span>
                  Balance due:{" "}
                  <strong className="text-[var(--color-primary)]">
                    {formatInr(invoiceBalance(selectedInvoice))}
                  </strong>
                </span>
              </div>
            </div>
          ) : null}

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
              placeholder="e.g. 118000.00"
            />
          </FormRow>

          <Select
            label="Payment method"
            value={form.method}
            onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
            options={PAYMENT_METHODS}
          />

          <Textarea
            label="Notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional — reference number, bank details, or internal note"
          />

          <div className="flex flex-wrap gap-3 border-t border-[var(--color-border-soft)] pt-5">
            <Button
              variant="primary"
              type="submit"
              loading={saving}
              disabled={!form.invoice_id || !form.amount || !form.payment_date}
            >
              Save payment
            </Button>
            <Button variant="outline" to="/sales/payments">
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
