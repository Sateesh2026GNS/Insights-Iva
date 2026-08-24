import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, Mail, Printer, X } from "lucide-react";

import { convertQuotationToSalesOrder } from "../../api/salesApi";
import { getProducts } from "../../api/productionApi";
import { formatInr, statusColor } from "../../data/salesMasterData";
import { useToast } from "../../context/ToastContext";
import { exportToPdf } from "../../utils/exportUtils";

export default function QuoteDetailModal({ quote, onClose, onStatusChange, onConverted }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [products, setProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  if (!quote) return null;

  const amount = quote.amount ?? quote.total_amount;

  const handlePreview = () => {
    addToast(
      `${quote.quote_number}: ${quote.customer_name || "Customer"} — ${formatInr(amount)} (${quote.status})`,
      "info"
    );
    window.print();
  };

  const handlePdf = () => {
    try {
      exportToPdf(
        [
          {
            quote_number: quote.quote_number,
            customer_name: quote.customer_name,
            quote_date: quote.quote_date,
            valid_until: quote.valid_until,
            amount,
            status: quote.status,
            sales_person: quote.sales_person,
          },
        ],
        [
          { key: "quote_number", label: "Quote No" },
          { key: "customer_name", label: "Customer" },
          { key: "quote_date", label: "Date" },
          { key: "valid_until", label: "Valid Until" },
          { key: "amount", label: "Amount" },
          { key: "status", label: "Status" },
          { key: "sales_person", label: "Sales Person" },
        ],
        `Quotation ${quote.quote_number}`,
        `quote-${quote.quote_number || "export"}`
      );
      addToast("Quote PDF downloaded");
    } catch {
      addToast(
        `PDF unavailable — ${quote.quote_number}: ${quote.customer_name || "Customer"} ${formatInr(amount)}`,
        "info"
      );
    }
  };

  const handleSendEmail = () => {
    const companyEmail = "sales@gnsinsights.com";
    const customerEmail = `${(quote.customer_name || "client").toLowerCase().replace(/[^a-z0-9]/g, "")}@company.com`;
    const subject = encodeURIComponent(`Commercial Quotation ${quote.quote_number} - Insights Iva`);
    const body = encodeURIComponent(
      `Dear ${quote.customer_name || "Customer"},\n\nPlease find attached Commercial Quotation ${quote.quote_number} for total amount ${formatInr(amount)}.\n\nQuote Date: ${quote.quote_date || "—"}\nValid Until: ${quote.valid_until || "—"}\nSales Representative: ${quote.sales_person || "Vikram Sharma"}\n\nTerms & Notes:\n${quote.notes || "30% advance deposit, 70% upon dispatch. Validity: 30 days."}\n\nBest regards,\nInsights Iva Sales Team\nCompany Email: ${companyEmail}`
    );

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=${customerEmail}&cc=${companyEmail}&su=${subject}&body=${body}`;
    window.open(gmailUrl, "_blank");

    if (addToast) addToast(`Opening Gmail compose from Company Mail (${companyEmail}) to ${quote.customer_name}!`, "success");
  };

  const loadProducts = async () => {
    if (productsLoaded) return;
    try {
      const res = await getProducts();
      setProducts(res.data || []);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoaded(true);
    }
  };

  const handleConvert = async () => {
    if (typeof quote.id !== "number") {
      setError("Demo quotation cannot be converted.");
      return;
    }
    setConverting(true);
    setError("");
    try {
      const payload = {};
      if (productId) {
        const product = products.find((p) => String(p.id) === String(productId));
        payload.product_id = Number(productId);
        payload.quantity = Number(quantity) || 1;
        payload.item_description = product?.name;
        payload.unit_price = product?.unit_price != null ? Number(product.unit_price) : 0;
      }
      const res = await convertQuotationToSalesOrder(quote.id, payload);
      const so = res.data;
      onConverted?.(so);
      onClose?.();
      if (so?.id) navigate(`/sales/orders/${so.id}`);
      else navigate("/sales/orders");
    } catch (err) {
      const msg = err.response?.data?.detail || "Convert failed";
      setError(typeof msg === "string" ? msg : "Convert failed");
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[var(--color-primary)]">{quote.quote_number}</p>
            <h2 className="text-xl font-bold text-slate-900">{quote.customer_name || "Customer"}</h2>
            <p className="text-sm text-slate-500">
              Sales Person: {quote.sales_person || "—"} · Valid until {quote.valid_until || "—"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 print:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase text-slate-400">Quote date</dt>
              <dd className="font-medium">{quote.quote_date || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Amount</dt>
              <dd className="font-medium">{formatInr(quote.amount ?? quote.total_amount)}</dd>
            </div>
          </dl>

          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs text-slate-400">Status:</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(quote.status)}`}>
              {quote.status}
            </span>
          </div>

          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 print:hidden">
            <p className="mb-2 text-sm font-semibold text-slate-800">Convert to Sales Order</p>
            <p className="mb-3 text-xs text-slate-500">
              Creates a draft SO linked to this quotation. Optionally attach a product line for MRP / production.
            </p>
            <div className="grid gap-3 sm:grid-cols-2" onFocus={loadProducts}>
              <label className="block text-xs font-medium text-slate-600">
                Product (optional)
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  onClick={loadProducts}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Header only</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Quantity
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  disabled={!productId}
                />
              </label>
            </div>
            {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t px-5 py-4 print:hidden">
          <button type="button" onClick={handlePreview} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Printer className="h-4 w-4" /> Preview
          </button>
          <button type="button" onClick={handlePdf} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Download className="h-4 w-4" /> PDF
          </button>
          <button type="button" onClick={handleSendEmail} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Mail className="h-4 w-4" /> Email
          </button>
          <button
            type="button"
            disabled={converting}
            onClick={handleConvert}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {converting ? "Converting…" : "Convert to Sales Order"}
          </button>
          <Link
            to={`/sales/orders/create?reference=${encodeURIComponent(quote.quote_number || "")}${
              quote.customer_id ? `&customer_id=${quote.customer_id}` : ""
            }`}
            className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Create SO manually
          </Link>
          {quote.status === "draft" && (
            <button
              type="button"
              onClick={() => onStatusChange?.(quote, "pending_approval")}
              className="rounded-lg border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800"
            >
              Submit for Approval
            </button>
          )}
          {quote.status === "pending_approval" && (
            <>
              <button
                type="button"
                onClick={() => onStatusChange?.(quote, "approved")}
                className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-800"
              >
                Approve Quote
              </button>
              <button
                type="button"
                onClick={() => onStatusChange?.(quote, "rejected")}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
              >
                Reject
              </button>
            </>
          )}
          {(quote.status === "approved" || quote.status === "draft") && (
            <button
              type="button"
              onClick={() => onStatusChange?.(quote, "sent")}
              className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700"
            >
              Send to Customer
            </button>
          )}
          {quote.status === "sent" && (
            <button
              type="button"
              onClick={() => onStatusChange?.(quote, "accepted")}
              className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-800"
            >
              Customer Confirmed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
