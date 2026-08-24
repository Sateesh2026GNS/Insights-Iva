import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, FileText, User, Calendar, Hash } from "lucide-react";
import Loader from "../../components/common/Loader";
import { getInvoiceDetail } from "../../api/salesApi";

const fmt = (v) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);

const STATUS_STYLES = {
  paid:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  issued:   "bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--color-primary-soft)]",
  draft:    "bg-slate-100 text-slate-600 border-slate-200",
  pending_approval: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-teal-50 text-teal-700 border-teal-200",
  sent:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  partial:  "bg-orange-100 text-orange-700 border-orange-200",
};
const STATUS_LABEL = {
  paid: "Paid", issued: "Issued", draft: "Draft",
  pending_approval: "Pending", approved: "Approved",
  sent: "Sent", partial: "Partial",
};

function InfoCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      </div>
      <p className="text-sm font-semibold text-slate-900">{value || "—"}</p>
    </div>
  );
}

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [billData, setBillData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }

    // Always try API first — bills are saved to the database with numeric IDs
    getInvoiceDetail(id)
      .then((r) => {
        // Backend returns: { found: bool, invoice: {...}, items: [...], customer: {...} }
        const payload = r?.data ?? null;
        if (!payload || payload.found === false || !payload.invoice) {
          // API didn't find it — check localStorage (for unsynced/locally created bills)
          return tryLocalStorage(id);
        }
        setBillData({
          invoice: payload.invoice,
          items: Array.isArray(payload.items) ? payload.items : [],
          customer: payload.customer || null,
        });
      })
      .catch(() => {
        // API failed — try localStorage fallback
        const local = tryLocalStorage(id);
        if (!local) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  function tryLocalStorage(id) {
    try {
      const allLocal = [
        ...JSON.parse(localStorage.getItem("smrt_sales_bills") || "[]"),
        ...JSON.parse(localStorage.getItem("smrt_invoices") || "[]"),
      ];
      const match = allLocal.find(
        (b) => String(b.id) === String(id) ||
               String(b.invoice_number) === String(id) ||
               String(b.bill_number) === String(id)
      );
      if (match) {
        setBillData({
          invoice: match,
          items: match.items || [],
          customer: {
            name: match.customer_name || "Customer",
            address_line1: match.billing_address || "",
            gstin: match.gstin || "",
            phone: match.phone || "",
            email: match.email || "",
          },
        });
        return true;
      }
    } catch { /* ignore */ }
    setNotFound(true);
    return false;
  }

  if (loading) return <Loader label="Loading bill details…" />;

  if (notFound || !billData) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <FileText className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Bill not found</h1>
        <p className="text-sm text-slate-500">This bill may have been deleted or doesn't exist.</p>
        <button onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4" /> Go back
        </button>
      </div>
    );
  }

  const { invoice, items = [], customer } = billData;
  const billNumber = invoice.invoice_number || invoice.bill_number || `BILL-${String(invoice.id).padStart(4, "0")}`;
  const statusKey = String(invoice.status || "draft").toLowerCase();
  const isPaid = statusKey === "paid";

  const subtotal    = Number(invoice.subtotal)    || items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const discount    = Number(invoice.discount)    || 0;
  const sgstAmt     = Number(invoice.sgst_amount) || 0;
  const cgstAmt     = Number(invoice.cgst_amount) || 0;
  const igstAmt     = Number(invoice.igst_amount) || 0;
  const roundOff    = Number(invoice.round_off)   || 0;
  const grandTotal  = Number(invoice.grand_total) || 0;
  const amountPaid  = Number(invoice.amount_paid) || 0;
  const balanceDue  = Math.max(grandTotal - amountPaid, 0);

  const customerName = customer?.name || invoice.customer_name || "Customer";
  const billingAddr  = customer?.address_line1 || invoice.billing_address || "";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between print:hidden">
        <div>
          <button onClick={() => navigate("/sales/bills")}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> Back to Bills
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Bill {billNumber}</h1>
          <p className="mt-0.5 text-sm text-slate-500">Details for {customerName}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]">
            <Download className="h-4 w-4" /> Print / Download
          </button>
        </div>
      </header>

      {/* Main Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Colour bar */}
        <div className={`h-1.5 w-full ${isPaid ? "bg-emerald-500" : "bg-[var(--color-primary)]"}`} />

        <div className="space-y-6 p-6">

          {/* Top meta row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoCard label="Bill No." value={billNumber} icon={Hash} />
            <InfoCard label="Bill Date" value={String(invoice.issue_date || "").slice(0, 10)} icon={Calendar} />
            <InfoCard label="Due Date"  value={String(invoice.due_date  || "").slice(0, 10)} icon={Calendar} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Status</p>
              <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[statusKey] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                {STATUS_LABEL[statusKey] || invoice.status || "Draft"}
              </span>
            </div>
          </div>

          {/* Bill To */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-slate-400" />
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Bill To</p>
            </div>
            <h3 className="text-base font-bold text-slate-900">{customerName}</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 text-sm text-slate-600">
              <div>
                {billingAddr && <p className="mt-1">{billingAddr}</p>}
                {customer?.state && <p>{customer.state}</p>}
              </div>
              <div className="space-y-1">
                {customer?.gstin  && <p><span className="font-medium text-slate-500">GSTIN:</span> {customer.gstin}</p>}
                {customer?.phone  && <p><span className="font-medium text-slate-500">Phone:</span> {customer.phone}</p>}
                {customer?.email  && <p><span className="font-medium text-slate-500">Email:</span> {customer.email}</p>}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["#", "Product / Description", "Qty", "Unit", "Unit Price", "Amount"].map((h, i) => (
                    <th key={h}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${i >= 2 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      No line items found for this bill.
                    </td>
                  </tr>
                ) : items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.item_description || "—"}</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {Number(item.qty || item.quantity || 0) % 1 === 0
                        ? Number(item.qty || item.quantity || 0)
                        : Number(item.qty || item.quantity || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{item.unit || "pcs"}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(item.rate)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Amount</span><span className="font-medium">{fmt(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount</span><span>−{fmt(discount)}</span>
                </div>
              )}
              {sgstAmt > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>SGST ({invoice.sgst_pct}%)</span><span>{fmt(sgstAmt)}</span>
                </div>
              )}
              {cgstAmt > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>CGST ({invoice.cgst_pct}%)</span><span>{fmt(cgstAmt)}</span>
                </div>
              )}
              {igstAmt > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>IGST ({invoice.igst_pct}%)</span><span>{fmt(igstAmt)}</span>
                </div>
              )}
              {roundOff !== 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Round Off</span><span>{fmt(roundOff)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-slate-900">
                <span>Grand Total</span>
                <span className="text-[var(--color-primary)]">{fmt(grandTotal)}</span>
              </div>
              {amountPaid > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Amount Paid</span><span>{fmt(amountPaid)}</span>
                </div>
              )}
              <div className={`flex justify-between font-semibold ${balanceDue > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                <span>Balance Due</span><span>{fmt(balanceDue)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">Notes</p>
              <p className="text-sm text-slate-700">{invoice.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 print:hidden">
            <Link to="/sales/bills"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <FileText className="h-4 w-4" /> All Bills
            </Link>
            <p className="text-xs text-slate-400">This bill is computer generated and does not require a signature.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
