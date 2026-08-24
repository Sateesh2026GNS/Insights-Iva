import { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, Save } from "lucide-react";
import { createInvoice } from "../../api/salesApi";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";

const SELLER_STATE_CODE = "36";
const DEFAULT_CGST = 9;
const DEFAULT_SGST = 9;
const DEFAULT_IGST = 18;

const cls = "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)]";
const genBillNumber = () => `BILL-${Date.now().toString().slice(-6)}`;
const EMPTY_ITEM = () => ({ item_description: "", qty: "1", unit: "pcs", rate: "0", amount: 0 });

const isInterState = (c) => {
  const code = String(c?.state_code || "").trim();
  return code !== "" && code !== SELLER_STATE_CODE;
};

export default function BillFormModal({ invoice, onClose, onSave }) {
  const { addToast } = useToast();
  const tenantId = useTenantId();
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([EMPTY_ITEM()]);
  const [form, setForm] = useState({
    invoice_number: genBillNumber(),
    customer_id: "",
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    cgst_pct: String(DEFAULT_CGST),
    sgst_pct: String(DEFAULT_SGST),
    igst_pct: "0",
    discount: "0",
    round_off: "0",
    declaration: "",
    billing_address: "",
    shipping_address: "",
  });

  // Load customers from localStorage instantly — no API
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("smrt_customers") || "[]");
      setCustomers(stored);
    } catch {
      setCustomers([]);
    }
  }, []);

  const uniqueCustomers = useMemo(() => {
    const map = new Map();
    customers.forEach((c) => {
      const name = String(c.company || c.name || c.customer_name || "").trim();
      if (name.length >= 2 && !map.has(name.toLowerCase()))
        map.set(name.toLowerCase(), { ...c, name });
    });
    return Array.from(map.values());
  }, [customers]);

  const selectedCustomer = uniqueCustomers.find(
    (c) => String(c.id) === String(form.customer_id) || c.name === form.customer_id
  );

  useEffect(() => {
    if (!selectedCustomer) return;
    const addr = [selectedCustomer.address_line1, selectedCustomer.address_line2, selectedCustomer.state]
      .filter(Boolean).join(", ");
    setForm((f) => ({
      ...f,
      billing_address: f.billing_address || addr,
      shipping_address: f.shipping_address || addr,
      cgst_pct: isInterState(selectedCustomer) ? "0" : String(DEFAULT_CGST),
      sgst_pct: isInterState(selectedCustomer) ? "0" : String(DEFAULT_SGST),
      igst_pct: isInterState(selectedCustomer) ? String(DEFAULT_IGST) : "0",
    }));
  }, [selectedCustomer?.id]); // eslint-disable-line

  const updateItem = (idx, field, val) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: val };
      if (field === "qty" || field === "rate")
        updated.amount = Math.round((Number(updated.qty) || 0) * (Number(updated.rate) || 0) * 100) / 100;
      return updated;
    }));
  };

  const subtotal = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const discount = Number(form.discount) || 0;
  const cgst = Math.round(subtotal * (Number(form.cgst_pct) / 100) * 100) / 100;
  const sgst = Math.round(subtotal * (Number(form.sgst_pct) / 100) * 100) / 100;
  const igst = Math.round(subtotal * (Number(form.igst_pct) / 100) * 100) / 100;
  const roundOff = Number(form.round_off) || 0;
  const grandTotal = Math.round((subtotal - discount + cgst + sgst + igst + roundOff) * 100) / 100;

  const handleSave = () => {
    setError("");
    const validItems = items.filter((i) => String(i.item_description || "").trim());
    if (validItems.length === 0) {
      setError("Add at least one item description.");
      return;
    }

    setSaving(true);
    const billNo = (form.invoice_number || "").trim() || genBillNumber();
    const custName = selectedCustomer?.company || selectedCustomer?.name || form.customer_id || "Walk-in Customer";

    const payload = {
      id: billNo,
      invoice_number: billNo,
      bill_number: billNo,
      tenant_id: tenantId || 1,
      customer_id: form.customer_id || "",
      customer_name: custName,
      issue_date: form.issue_date,
      due_date: form.due_date || new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10),
      billing_address: form.billing_address,
      shipping_address: form.shipping_address,
      subtotal,
      discount,
      cgst_pct: Number(form.cgst_pct) || 0,
      sgst_pct: Number(form.sgst_pct) || 0,
      igst_pct: Number(form.igst_pct) || 0,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      round_off: roundOff,
      grand_total: grandTotal,
      amount: grandTotal,
      amount_paid: 0,
      status: "draft",
      document_type: "bill",
      type: "bill",
      notes: form.notes,
      items: validItems.map((i) => ({
        item_description: String(i.item_description).trim(),
        qty: Number(i.qty) || 1,
        unit: i.unit || "pcs",
        rate: Number(i.rate) || 0,
        amount: Number(i.amount) || 0,
      })),
    };

    try {
      const existingBills = JSON.parse(localStorage.getItem("smrt_sales_bills") || "[]");
      const existingInvoices = JSON.parse(localStorage.getItem("smrt_invoices") || "[]");
      localStorage.setItem("smrt_sales_bills", JSON.stringify([payload, ...existingBills.filter((b) => b.invoice_number !== billNo)]));
      localStorage.setItem("smrt_invoices", JSON.stringify([payload, ...existingInvoices.filter((b) => b.invoice_number !== billNo)]));
    } catch { /* ignore */ }

    createInvoice(payload).catch(() => null);

    addToast("Bill created successfully!", "success");
    setSaving(false);
    onSave?.(payload);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-xl font-bold text-slate-900">Create New Bill</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-5">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* Bill Info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500">Bill Number</label>
              <input type="text" value={form.invoice_number}
                onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
                className={cls} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500">Customer</label>
              <select value={form.customer_id}
                onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                className={cls}>
                <option value="">— Select customer —</option>
                {uniqueCustomers.map((c) => (
                  <option key={c.id || c.name} value={c.id || c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500">Issue Date</label>
              <input type="date" value={form.issue_date}
                onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))}
                className={cls} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500">Due Date</label>
              <input type="date" value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className={cls} />
            </div>
          </div>

          <hr />

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase text-slate-400">Line Items ({items.length})</h3>
              <button type="button" onClick={() => setItems((p) => [...p, EMPTY_ITEM()])}
                className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-primary)] hover:underline">
                <Plus className="h-3 w-3" /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:bg-transparent sm:p-0">
                  <input type="text" placeholder="Description" value={item.item_description}
                    onChange={(e) => updateItem(idx, "item_description", e.target.value)}
                    className={`${cls} flex-1`} />
                  <input type="text" inputMode="decimal" placeholder="Qty" value={item.qty}
                    onChange={(e) => updateItem(idx, "qty", e.target.value)}
                    className={`${cls} sm:w-16`} />
                  <select value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)}
                    className={`${cls} sm:w-20`}>
                    {["pcs", "kg", "ltr", "box", "set", "hr", "KGS", "MTR", "nos"].map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                  <input type="text" inputMode="decimal" placeholder="Rate" value={item.rate}
                    onChange={(e) => updateItem(idx, "rate", e.target.value)}
                    className={`${cls} sm:w-24`} />
                  <div className="sm:w-28 rounded-lg border border-slate-100 bg-slate-100 px-3 py-2.5 text-right text-sm font-semibold text-slate-700">
                    ₹{Number(item.amount).toLocaleString("en-IN")}
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <hr />

          {/* Tax & Summary */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-slate-100 p-3">
              <h4 className="text-[10px] font-bold uppercase text-slate-400">Taxes & Adjustments</h4>
              {[
                { label: "CGST %", key: "cgst_pct" },
                { label: "SGST %", key: "sgst_pct" },
                { label: "IGST %", key: "igst_pct" },
                { label: "Discount (₹)", key: "discount" },
                { label: "Round Off (₹)", key: "round_off" },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{label}</span>
                  <input type="text" inputMode="decimal" value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm focus:outline-none" />
                </div>
              ))}
            </div>
            <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
              <h4 className="text-[10px] font-bold uppercase text-slate-400">Summary</h4>
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
              {discount > 0 && <div className="flex justify-between text-rose-600"><span>Discount</span><span>-₹{discount.toLocaleString("en-IN")}</span></div>}
              {cgst > 0 && <div className="flex justify-between text-slate-600"><span>CGST ({form.cgst_pct}%)</span><span>+₹{cgst.toLocaleString("en-IN")}</span></div>}
              {sgst > 0 && <div className="flex justify-between text-slate-600"><span>SGST ({form.sgst_pct}%)</span><span>+₹{sgst.toLocaleString("en-IN")}</span></div>}
              {igst > 0 && <div className="flex justify-between text-slate-600"><span>IGST ({form.igst_pct}%)</span><span>+₹{igst.toLocaleString("en-IN")}</span></div>}
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>Grand Total</span>
                <span className="text-[var(--color-primary)]">₹{grandTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500">Notes</label>
            <textarea rows={2} value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Internal notes or terms" className={cls} />
          </div>
        </div>

        {/* Footer — type="button" only, no form/submit */}
        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 cursor-pointer shadow-sm">
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Bill"}
          </button>
        </div>
      </div>
    </div>
  );
}
