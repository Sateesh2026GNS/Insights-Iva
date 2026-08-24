import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  IndianRupee,
  Package,
  ShoppingCart,
  X,
} from "lucide-react";

import { starRating } from "../../data/vendorsMasterData";

import Button from "../common/Button";
import { inputClass as dsInput } from "../../design-system/classes";

const inputClass = `${dsInput} mt-1`;
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "purchase_orders", label: "Purchase Orders" },
  { id: "grn", label: "Goods Receipt Note (GRN)" },
  { id: "bills", label: "Bills" },
  { id: "payments", label: "Payments" },
  { id: "ledger", label: "Ledger" },
  { id: "documents", label: "Documents" },
  { id: "performance", label: "Performance" },
  { id: "audit", label: "Audit Logs" },
];

function Field({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value ?? "—"}</p>
    </div>
  );
}

function formatInr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function TabPlaceholder({ title, link, linkLabel }) {
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        {title}
      </div>
      {link && (
        <Link to={link} className="text-sm font-semibold text-[#2563EB] hover:underline">
          {linkLabel || "View all"} →
        </Link>
      )}
    </div>
  );
}

export default function VendorDetailModal({
  vendor,
  detail,
  onClose,
  onEdit,
  onDeactivate,
  onApprove,
}) {
  const [tab, setTab] = useState("overview");
  if (!vendor) return null;

  const v = { ...vendor, ...(detail || {}) };
  const dashboard = [
    { label: "Total POs", value: v.total_purchase_orders ?? 0 },
    { label: "Purchase Value", value: formatInr(v.total_purchase_value) },
    { label: "Pending POs", value: v.pending_orders ?? 0 },
    { label: "Outstanding", value: formatInr(v.outstanding) },
    { label: "Last Purchase", value: v.last_purchase_date || "—" },
    { label: "Rating", value: starRating(v.rating) },
  ];

  const pos = detail?.purchase_orders || [];
  const payments = detail?.payments || [];
  const ledger = detail?.ledger || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#2563EB]">{v.vendor_code}</p>
            <h2 className="text-xl font-bold text-slate-900">{v.name}</h2>
            <p className="text-sm text-slate-500">
              {v.contact} · {v.city}, {v.state}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3 sm:grid-cols-6">
          {dashboard.map((d) => (
            <div key={d.label} className="text-center">
              <p className="text-[10px] font-medium text-slate-500">{d.label}</p>
              <p className="text-sm font-bold text-slate-800">{d.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 border-b border-slate-100 px-5 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                tab === t.id ? "bg-[var(--color-primary)] text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "overview" && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">General Information</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Vendor Code" value={v.vendor_code} />
                  <Field label="Company Name" value={v.name} />
                  <Field label="Vendor Type" value={v.vendor_type} />
                  <Field label="GSTIN" value={v.gstin} />
                  <Field label="Status" value={v.status} />
                  <Field label="Approval" value={v.approval_status} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Contact Information</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Contact Person" value={v.contact} />
                  <Field label="Mobile" value={v.phone} />
                  <Field label="Email" value={v.email} />
                  <Field label="Alternate Contact" value={v.alternate_contact} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Address</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Billing Address" value={v.billing_address} />
                  <Field label="Factory Address" value={v.factory_address} />
                  <Field label="City" value={v.city} />
                  <Field label="State" value={v.state} />
                  <Field label="Country" value={v.country} />
                  <Field label="Pincode" value={v.pincode} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Financial Information</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Bank Name" value={v.bank_name} />
                  <Field label="Account Number" value={v.account_number} />
                  <Field label="IFSC" value={v.ifsc} />
                  <Field label="Payment Terms" value={v.payment_terms} />
                  <Field label="Credit Days" value={v.credit_days} />
                  <Field label="Outstanding Balance" value={formatInr(v.outstanding)} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Procurement Summary</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field label="Total Purchase Orders" value={v.total_purchase_orders} />
                  <Field label="Completed Orders" value={v.completed_orders} />
                  <Field label="Pending Orders" value={v.pending_orders} />
                  <Field label="Total Purchase Value" value={formatInr(v.total_purchase_value)} />
                  <Field label="Last Purchase Date" value={v.last_purchase_date} />
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-800">Vendor Rating</h3>
                <p className="mb-2 text-lg text-amber-500">{starRating(v.rating)}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Quality Score" value={v.quality_score != null ? `${v.quality_score}%` : "—"} />
                  <Field label="Delivery Score" value={v.delivery_score != null ? `${v.delivery_score}%` : "—"} />
                  <Field label="Price Score" value={v.price_score != null ? `${v.price_score}%` : "—"} />
                  <Field label="Service Score" value={v.service_score != null ? `${v.service_score}%` : "—"} />
                </div>
              </div>
            </div>
          )}

          {tab === "purchase_orders" && (
            pos.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-400">
                    <th className="py-2">PO Number</th>
                    <th className="py-2">Date</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po) => (
                    <tr key={po.id} className="border-b border-slate-50">
                      <td className="py-2 font-medium text-[#2563EB]">{po.po_number}</td>
                      <td className="py-2">{po.order_date}</td>
                      <td className="py-2 capitalize">{po.status}</td>
                      <td className="py-2 text-right">{formatInr(po.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <TabPlaceholder title="No purchase orders linked yet" link="/procurement/purchase-orders" linkLabel="View purchase orders" />
            )
          )}

          {tab === "grn" && (
            <TabPlaceholder title="Goods Receipt Note (GRN) records for this vendor" link="/procurement/goods-receipt" linkLabel="View goods receipts" />
          )}

          {tab === "bills" && (
            <TabPlaceholder title="Vendor bills and invoices" link="/procurement/supplier-payments" linkLabel="View vendor bills" />
          )}

          {tab === "payments" && (
            payments.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-400">
                    <th className="py-2">Date</th>
                    <th className="py-2">Reference</th>
                    <th className="py-2">Method</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50">
                      <td className="py-2">{p.payment_date}</td>
                      <td className="py-2">{p.reference || `PAY-${p.id}`}</td>
                      <td className="py-2 capitalize">{p.payment_method}</td>
                      <td className="py-2 text-right">{formatInr(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <TabPlaceholder title="No payments recorded" link="/procurement/supplier-payments/create" linkLabel="Record payment" />
            )
          )}

          {tab === "ledger" && (
            ledger.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-400">
                    <th className="py-2">Date</th>
                    <th className="py-2">Reference</th>
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right">Debit</th>
                    <th className="py-2 text-right">Credit</th>
                    <th className="py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="py-2">{e.date}</td>
                      <td className="py-2">{e.reference}</td>
                      <td className="py-2">{e.description}</td>
                      <td className="py-2 text-right">{e.debit ? formatInr(e.debit) : "—"}</td>
                      <td className="py-2 text-right">{e.credit ? formatInr(e.credit) : "—"}</td>
                      <td className="py-2 text-right font-medium">{formatInr(e.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <TabPlaceholder title="Ledger entries will appear after purchase orders and payments" />
            )
          )}

          {tab === "documents" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {(v.documents || []).map((doc) => (
                <div key={doc.name} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                  <FileText className="h-5 w-5 text-[#2563EB]" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                    <p className="text-xs text-slate-400">{doc.type}</p>
                  </div>
                </div>
              ))}
              {!(v.documents || []).length && (
                <TabPlaceholder title="No documents uploaded for this vendor" link="/documents" linkLabel="Document management" />
              )}
            </div>
          )}

          {tab === "performance" && (
            <div className="space-y-4">
              <p className="text-2xl text-amber-500">{starRating(v.rating)}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Quality", score: v.quality_score, color: "bg-blue-500" },
                  { label: "Delivery", score: v.delivery_score, color: "bg-green-500" },
                  { label: "Price", score: v.price_score, color: "bg-orange-500" },
                  { label: "Service", score: v.service_score, color: "bg-purple-500" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{s.label}</span>
                      <span className="font-bold">{s.score ?? "—"}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full ${s.color}`} style={{ width: `${s.score || 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "audit" && (
            <TabPlaceholder title="Vendor audit trail" link="/admin/access-logs" linkLabel="View access logs" />
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">
          <Button variant="primary" size="sm" to="/procurement/purchase-orders/create" leftIcon={<ShoppingCart className="h-3.5 w-3.5" aria-hidden />}>
            Create PO
          </Button>
          <Link to="/procurement/goods-receipt/create" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Package className="h-3.5 w-3.5" /> Receive Goods
          </Link>
          <Link to="/procurement/supplier-payments/create" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <IndianRupee className="h-3.5 w-3.5" /> Make Payment
          </Link>
          <button type="button" onClick={() => onEdit?.(v)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Edit Vendor
          </button>
          {v.approval_status === "pending" && onApprove && (
            <button type="button" onClick={() => onApprove(v, "approved")} className="rounded-lg border border-teal-200 px-3 py-2 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success-soft)]">
              Approve
            </button>
          )}
          {v.status === "active" && (
            <button type="button" onClick={() => onDeactivate?.(v)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
              Deactivate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


export function VendorFormModal({ vendor, onClose, onSave }) {
  const [form, setForm] = useState({
    vendor_code: vendor?.vendor_code || "",
    name: vendor?.name || "",
    contact: vendor?.contact || vendor?.contact_name || "",
    phone: vendor?.phone || "",
    email: vendor?.email || "",
    gstin: vendor?.gstin || "",
    city: vendor?.city || "",
    state: vendor?.state || "",
    payment_terms: vendor?.payment_terms || "Net 30",
    outstanding: vendor?.outstanding ?? "",
    rating: vendor?.rating ?? 4.0,
    category: vendor?.category || "General",
    material_type: vendor?.material_type || "General",
    vendor_type: vendor?.vendor_type || "Manufacturer",
    billing_address: vendor?.billing_address || "",
    status: vendor?.status || "active",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900">{vendor?.id ? "Edit Vendor" : "Add Vendor"}</h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Vendor Code
              <input
                type="text"
                placeholder="e.g. VEND-001"
                value={form.vendor_code}
                onChange={(e) => set("vendor_code", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Status
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="block sm:col-span-2 text-sm font-medium text-slate-700">
              Company Name *
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Contact Person
              <input
                type="text"
                value={form.contact}
                onChange={(e) => set("contact", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Mobile
              <input
                type="text"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              GSTIN
              <input
                type="text"
                value={form.gstin}
                onChange={(e) => set("gstin", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              City
              <input
                type="text"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              State
              <input
                type="text"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Payment Terms
              <select
                value={form.payment_terms}
                onChange={(e) => set("payment_terms", e.target.value)}
                className={`${inputClass} bg-white`}
              >
                {["Net 15", "Net 30", "Net 45", "Net 60", "Advance", "COD"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Outstanding (₹)
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 25000"
                value={form.outstanding}
                onChange={(e) => set("outstanding", e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block sm:col-span-2 text-sm font-medium text-slate-700">
              Rating
              <select
                value={form.rating}
                onChange={(e) => set("rating", e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="5.0">5.0 ★ (Excellent)</option>
                <option value="4.5">4.5 ★ (Very Good)</option>
                <option value="4.0">4.0 ★ (Good)</option>
                <option value="3.5">3.5 ★ (Average)</option>
                <option value="3.0">3.0 ★ (Fair)</option>
                <option value="2.0">2.0 ★ (Poor)</option>
              </select>
            </label>
            <label className="block sm:col-span-2 text-sm font-medium text-slate-700">
              Billing Address
              <textarea
                value={form.billing_address}
                onChange={(e) => set("billing_address", e.target.value)}
                rows={2}
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="primary" type="submit" >Save Vendor</Button>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
