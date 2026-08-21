import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, AlertTriangle, ArrowRight, BadgeCheck, Building2, Calendar, CheckCircle2, ChevronRight, Clock, CreditCard, Edit2, Eye, FileText, IndianRupee, Landmark, LayoutDashboard, Package, Plus, Receipt, Search, TrendingDown, TrendingUp, X, XCircle } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import DataTable from "../../components/common/DataTable";
import RowActionMenu from "../../components/common/RowActionMenu";
import FinanceFilters from "../../components/finance/FinanceFilters";
import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { getAPEnriched, getAPSummary } from "../../api/accountsApi";
import {
  getVendors, getVendorBills, createVendorBill, updateVendorBill,
  updateVendorBillStatus, createSupplierPayment, getSupplierPayments,
} from "../../api/procurementApi";
import { FINANCE_FLOW, formatInr, statusColor } from "../../data/financeMasterData";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";

import Button from "../../components/common/Button";

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  return payload.data ?? payload.results ?? payload.items ?? [];
}

function agingBucket(dueDateStr) {
  if (!dueDateStr) return null;
  const dueDate = new Date(dueDateStr);
  if (isNaN(dueDate)) return null;
  const diff = Math.floor((Date.now() - dueDate) / 86400000);
  if (diff <= 0) return { label: "Not Due", cls: "bg-emerald-100 text-emerald-800" };
  if (diff <= 30) return { label: "1–30 days", cls: "bg-amber-100 text-amber-800" };
  if (diff <= 60) return { label: "31–60 days", cls: "bg-orange-100 text-orange-800" };
  if (diff <= 90) return { label: "61–90 days", cls: "bg-red-100 text-red-700" };
  return { label: "90+ days", cls: "bg-red-200 text-red-900 font-bold" };
}

function daysDiff(dueDateStr) {
  if (!dueDateStr) return null;
  const d = new Date(dueDateStr);
  return isNaN(d) ? null : Math.floor((Date.now() - d) / 86400000);
}

// ─── Sub-components ──────────────────────────────────────────────────────────


function SectionTab({ id, label, icon: Icon, active, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-semibold transition-all whitespace-nowrap ${
        active
          ? "border-teal-700 text-[var(--color-primary)]"
          : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {badge != null && (
        <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
          active ? "bg-[var(--color-success-soft)] text-[var(--color-primary)]" : "bg-slate-100 text-slate-600"
        }`}>{badge}</span>
      )}
    </button>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusColor(status)}`}>
      {status || "—"}
    </span>
  );
}

function FieldRow({ label, value, mono }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-sm font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}

// ─── Modal: Create Vendor Bill ────────────────────────────────────────────────

function CreateBillModal({ vendors, onClose, onSuccess }) {
  const { addToast } = useToast();
  const tenantId = useTenantId();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier_id: "",
    bill_number: "",
    bill_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    amount: "",
    gst_amount: "",
    notes: "",
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const grandTotal = useMemo(
    () => (Number(form.amount) || 0) + (Number(form.gst_amount) || 0),
    [form.amount, form.gst_amount]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier_id) { addToast("Select a supplier", "error"); return; }
    setSaving(true);
    try {
      await createVendorBill({
        tenant_id: tenantId,
        supplier_id: Number(form.supplier_id),
        bill_number: form.bill_number,
        bill_date: form.bill_date,
        due_date: form.due_date || null,
        amount: Number(form.amount),
        gst_amount: form.gst_amount ? Number(form.gst_amount) : null,
        notes: form.notes || null,
      });
      addToast("Vendor bill created successfully", "success");
      onSuccess();
    } catch (err) {
      addToast(err?.response?.data?.detail || "Failed to create vendor bill", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Create Vendor Bill" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div>
          <label className="field-label">Supplier / Vendor *</label>
          {vendors.length === 0 ? (
            <div className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              No vendors found.{" "}
              <Link to="/procurement/vendors/create" className="underline font-semibold">Create a vendor first.</Link>
            </div>
          ) : (
            <select required value={form.supplier_id} onChange={(e) => set("supplier_id", e.target.value)} className="field-input">
              <option value="">— Select vendor —</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}{v.vendor_code ? ` (${v.vendor_code})` : ""}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="field-label">Vendor Invoice / Bill Number *</label>
          <input required type="text" value={form.bill_number} onChange={(e) => set("bill_number", e.target.value)}
            className="field-input" placeholder="e.g. INV-2025-0312" />
          <p className="mt-1 text-[11px] text-slate-400">This is the supplier's own invoice number, not your PO number.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Invoice Date *</label>
            <input required type="date" value={form.bill_date} onChange={(e) => set("bill_date", e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label">Due Date</label>
            <input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} className="field-input" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Taxable Amount (₹) *</label>
            <input required type="number" min="0" step="0.01" value={form.amount}
              onChange={(e) => set("amount", e.target.value)} className="field-input" placeholder="e.g. 50000" />
          </div>
          <div>
            <label className="field-label">GST Amount (₹)</label>
            <input type="number" min="0" step="0.01" value={form.gst_amount}
              onChange={(e) => set("gst_amount", e.target.value)} className="field-input" placeholder="e.g. 9000" />
          </div>
        </div>

        {(Number(form.amount) > 0 || Number(form.gst_amount) > 0) && (
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Taxable Amount</span><span>{formatInr(form.amount)}</span>
            </div>
            <div className="flex justify-between text-slate-600 mt-1">
              <span>GST Amount</span><span>{formatInr(form.gst_amount)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-blue-200 pt-2 font-bold text-blue-700">
              <span>Grand Total</span><span>{formatInr(grandTotal)}</span>
            </div>
          </div>
        )}

        <div>
          <label className="field-label">Notes</label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
            className="field-input min-h-[70px] resize-none" placeholder="PO reference, GRN note, terms..." />
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Create Bill"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Modal: Record Payment ────────────────────────────────────────────────────

function RecordPaymentModal({ vendors, pendingBills, onClose, onSuccess, prefillSupplierId }) {
  const { addToast } = useToast();
  const tenantId = useTenantId();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier_id: prefillSupplierId || "",
    bill_id: "",
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: "bank",
    reference: "",
    notes: "",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Auto-fill amount when bill selected
  const handleBillSelect = (billId) => {
    const bill = pendingBills.find((b) => String(b.id) === String(billId));
    set("bill_id", billId);
    if (bill) set("amount", String(bill.balance || bill.amount || ""));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplier_id) { addToast("Select a supplier", "error"); return; }
    setSaving(true);
    try {
      await createSupplierPayment({
        tenant_id: tenantId,
        supplier_id: Number(form.supplier_id),
        amount: Number(form.amount),
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        reference: form.reference || null,
        notes: form.notes || null,
      });
      addToast("Payment recorded successfully", "success");
      onSuccess();
    } catch (err) {
      addToast(err?.response?.data?.detail || "Failed to record payment", "error");
    } finally {
      setSaving(false);
    }
  };

  const filteredBills = pendingBills.filter(
    (b) => !form.supplier_id || String(b.supplier_id) === String(form.supplier_id)
  );

  return (
    <ModalShell title="Record Supplier Payment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div>
          <label className="field-label">Supplier *</label>
          <select required value={form.supplier_id} onChange={(e) => { set("supplier_id", e.target.value); set("bill_id", ""); set("amount", ""); }} className="field-input">
            <option value="">— Select supplier —</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        {filteredBills.length > 0 && (
          <div>
            <label className="field-label">Against Bill (optional)</label>
            <select value={form.bill_id} onChange={(e) => handleBillSelect(e.target.value)} className="field-input">
              <option value="">— No specific bill —</option>
              {filteredBills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bill_number} — Balance: {formatInr(b.balance ?? b.amount)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Amount (₹) *</label>
            <input required type="number" min="0.01" step="0.01" value={form.amount}
              onChange={(e) => set("amount", e.target.value)} className="field-input" placeholder="e.g. 50000" />
          </div>
          <div>
            <label className="field-label">Payment Date *</label>
            <input required type="date" value={form.payment_date}
              onChange={(e) => set("payment_date", e.target.value)} className="field-input" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Payment Method</label>
            <select value={form.payment_method} onChange={(e) => set("payment_method", e.target.value)} className="field-input">
              {["bank", "cash", "cheque", "upi", "rtgs", "neft", "other"].map((m) => (
                <option key={m} value={m}>{m.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">UTR / Cheque No. / Ref</label>
            <input type="text" value={form.reference} onChange={(e) => set("reference", e.target.value)}
              className="field-input" placeholder="Bank reference / UTR" />
          </div>
        </div>

        <div>
          <label className="field-label">Notes</label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
            rows={2} className="field-input resize-none" placeholder="Payment remarks..." />
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Record Payment"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Modal: Edit Vendor Bill ──────────────────────────────────────────────────

function EditBillModal({ bill, onClose, onSuccess }) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    bill_number: bill.bill_number || "",
    amount: String(bill.amount || ""),
    gst_amount: String(bill.gst ?? ""),
    bill_date: String(bill.invoice_date || bill.bill_date || "").slice(0, 10),
    due_date: String(bill.due_date || "").slice(0, 10),
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateVendorBill(bill.id, {
        bill_number: form.bill_number,
        amount: Number(form.amount),
        gst_amount: form.gst_amount ? Number(form.gst_amount) : null,
        bill_date: form.bill_date,
        due_date: form.due_date || null,
      });
      addToast("Vendor bill updated", "success");
      onSuccess();
    } catch (err) {
      addToast(err?.response?.data?.detail || "Failed to update vendor bill", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Edit Vendor Bill" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div>
          <label className="field-label">Bill Number *</label>
          <input required type="text" value={form.bill_number} onChange={(e) => set("bill_number", e.target.value)} className="field-input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Taxable Amount (₹) *</label>
            <input required type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label">GST Amount (₹)</label>
            <input type="number" step="0.01" value={form.gst_amount} onChange={(e) => set("gst_amount", e.target.value)} className="field-input" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Invoice Date *</label>
            <input required type="date" value={form.bill_date} onChange={(e) => set("bill_date", e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label">Due Date</label>
            <input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} className="field-input" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save Changes"}</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Modal: View Vendor Bill ──────────────────────────────────────────────────

function ViewBillModal({ bill, vendors, onClose, onPay }) {
  const vendor = vendors.find((v) => v.id === bill.supplier_id);
  const aging = agingBucket(bill.due_date);
  const overdueDays = daysDiff(bill.due_date);
  const grandTotal = Number(bill.amount || 0) + Number(bill.gst ?? 0);

  return (
    <ModalShell title="Vendor Bill Details" onClose={onClose} wide>
      <div className="overflow-y-auto p-6 space-y-6">
        {/* Header Row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Bill Number</span>
            <span className="mt-1 inline-block font-mono text-xl font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
              {bill.bill_number}
            </span>
          </div>
          <StatusBadge status={bill.status} />
        </div>

        {/* Aging Warning */}
        {aging && overdueDays > 0 && (
          <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${
            overdueDays > 60 ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"
          }`}>
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Overdue by {overdueDays} days — {aging.label}</span>
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          <FieldRow label="Vendor / Supplier" value={vendor?.name || bill.vendor_name || `ID #${bill.supplier_id}`} />
          <FieldRow label="PO Reference" value={bill.po_reference} />
          <FieldRow label="Invoice Number" value={bill.invoice_no || bill.bill_number} mono />
          <FieldRow label="Invoice Date" value={String(bill.invoice_date || bill.bill_date || "").slice(0, 10)} />
          <FieldRow label="Due Date" value={String(bill.due_date || "").slice(0, 10)} />
          <FieldRow label="Aging Bucket" value={aging?.label} />
        </div>

        {/* Financial Summary */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-2.5 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Taxable Amount</span><span className="font-medium">{formatInr(bill.amount)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>GST Amount</span><span className="font-medium">{formatInr(bill.gst)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-300 pt-2.5 font-bold text-slate-900 text-base">
            <span>Grand Total</span><span>{formatInr(grandTotal)}</span>
          </div>
          <div className="flex justify-between text-emerald-700 border-t border-slate-200 pt-2.5">
            <span className="font-medium">Amount Paid</span><span className="font-semibold">{formatInr(bill.paid ?? 0)}</span>
          </div>
          <div className="flex justify-between font-bold text-blue-700 text-base">
            <span>Outstanding Balance</span>
            <span className={Number(bill.balance ?? 0) > 0 ? "text-red-600" : "text-emerald-600"}>
              {formatInr(bill.balance ?? grandTotal)}
            </span>
          </div>
        </div>

        {bill.notes && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</span>
            <p className="mt-1 text-sm text-slate-700 rounded-xl bg-slate-50 border px-4 py-3">{bill.notes}</p>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t px-6 py-4">
        <button type="button" onClick={onClose} className="btn-outline">Close</button>
        {bill.status !== "paid" && Number(bill.balance ?? bill.amount) > 0 && (
          <button type="button" onClick={() => { onClose(); onPay(bill); }} className="btn-primary">
            <CreditCard className="h-4 w-4" /> Pay Now
          </button>
        )}
      </div>
    </ModalShell>
  );
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className={`flex max-h-[94vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${wide ? "max-w-2xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b px-6 py-4 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ─── Date filter helpers ──────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function matchesDateFilters(dateStr, financialYear, month) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (isNaN(d)) return true;

  if (financialYear && financialYear !== "All Years") {
    const [startYear] = financialYear.split("-").map(Number);
    const fyStart = new Date(startYear, 3, 1);
    const fyEnd = new Date(startYear + 1, 2, 31, 23, 59, 59);
    if (d < fyStart || d > fyEnd) return false;
  }

  if (month && month !== "All Months") {
    const mi = MONTH_NAMES.indexOf(month);
    if (mi !== -1 && d.getMonth() !== mi) return false;
  }

  return true;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

const INITIAL_SUMMARY = {
  outstanding_payables: 0, due_this_week: 0, overdue_bills: 0,
  paid_this_month: 0, pending_approvals: 0, vendor_count: 0,
};

export default function AccountsPayable() {
  const tenantId = useTenantId();
  const { addToast } = useToast();

  // ── State ──
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(INITIAL_SUMMARY);
  const [bills, setBills] = useState([]);          // enriched AP bills
  const [rawBills, setRawBills] = useState([]);    // raw vendor bills for create-bill reference
  const [payments, setPayments] = useState([]);
  const [vendors, setVendors] = useState([]);

  // UI State
  const [activeSection, setActiveSection] = useState("overview"); // overview | bills | payments | aging
  const [billsTab, setBillsTab] = useState("all");    // all | pending | overdue | paid

  // Modals
  const [showCreateBill, setShowCreateBill] = useState(false);
  const [showCreatePayment, setShowCreatePayment] = useState(false);
  const [viewBill, setViewBill] = useState(null);
  const [editBill, setEditBill] = useState(null);
  const [payBill, setPayBill] = useState(null);     // prefill payment for specific bill
  const [openMenu, setOpenMenu] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [vendorFilter, setVendorFilter] = useState("");
  const [financialYear, setFinancialYear] = useState("All Years");
  const [month, setMonth] = useState("All Months");
  const [branch, setBranch] = useState("");

  // ── Data Loading ──
  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, apRes, vendorRes, payRes, billRes] = await Promise.allSettled([
        getAPSummary(),
        getAPEnriched(),
        getVendors(),
        getSupplierPayments(),
        getVendorBills(),
      ]);


      if (sumRes.status === "fulfilled" && sumRes.value?.data) setSummary(sumRes.value.data);

      if (apRes.status === "fulfilled") {
        const list = normalizeList(apRes.value?.data);
        setBills(list);
      }

      if (vendorRes.status === "fulfilled") {
        const list = normalizeList(vendorRes.value?.data ?? []);
        setVendors(list.filter((v) => v?.name || v?.vendor_code));
      }

      if (payRes.status === "fulfilled") {
        setPayments(normalizeList(payRes.value?.data ?? []));
      }

      if (billRes.status === "fulfilled") {
        setRawBills(normalizeList(billRes.value?.data ?? []));
      }
    } catch {
      addToast("Failed to load accounts payable data", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => { load(); }, [load]);

  // ── Filtered Bills ──
  const filteredBills = useMemo(() => {
    const q = search.toLowerCase();
    return bills.filter((r) => {
      if (q && !["bill_number","vendor_name","po_reference","invoice_no"].some(
        (k) => String(r[k] || "").toLowerCase().includes(q)
      )) return false;

      if (statusFilter !== "All" && r.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (vendorFilter && r.vendor_name !== vendorFilter) return false;
      if (!matchesDateFilters(r.invoice_date || r.bill_date, financialYear, month)) return false;

      if (billsTab === "pending" && r.status !== "pending") return false;
      if (billsTab === "overdue" && (daysDiff(r.due_date) ?? 0) <= 0) return false;
      if (billsTab === "paid" && r.status !== "paid") return false;

      return true;
    });
  }, [bills, search, statusFilter, vendorFilter, financialYear, month, billsTab]);

  // ── Filtered Payments ──
  const filteredPayments = useMemo(() => {
    const q = search.toLowerCase();
    return payments.filter((p) => {
      const supplierName = vendors.find((v) => v.id === p.supplier_id)?.name || "";
      if (q && ![String(p.id), supplierName, p.payment_method, p.reference, p.notes].some(
        (v) => String(v || "").toLowerCase().includes(q)
      )) return false;
      if (!matchesDateFilters(p.payment_date, financialYear, month)) return false;
      return true;
    });
  }, [payments, search, vendors, financialYear, month]);

  // ── Aging Analysis ──
  const agingAnalysis = useMemo(() => {
    const buckets = { current: [], "1-30": [], "31-60": [], "61-90": [], "90+": [] };
    bills.forEach((b) => {
      if (b.status === "paid") return;
      const d = daysDiff(b.due_date);
      if (d === null || d <= 0) buckets.current.push(b);
      else if (d <= 30) buckets["1-30"].push(b);
      else if (d <= 60) buckets["31-60"].push(b);
      else if (d <= 90) buckets["61-90"].push(b);
      else buckets["90+"].push(b);
    });
    return buckets;
  }, [bills]);

  // ── Pending bills for "pay now" prefill ──
  const pendingBills = useMemo(
    () => bills.filter((b) => b.status !== "paid" && Number(b.balance ?? b.amount) > 0),
    [bills]
  );

  // ── Handle Pay from View Modal ──
  const handlePayFromView = (bill) => {
    setPayBill(bill);
    setShowCreatePayment(true);
  };

  // ── Bill Table Columns ──
  const billColumns = [
    {
      key: "bill_number", label: "Bill No.",
      render: (r) => (
        <button type="button" onClick={() => setViewBill(r)}
          className="font-mono text-blue-600 hover:text-blue-800 hover:underline font-semibold text-sm">
          {r.bill_number}
        </button>
      )
    },
    { key: "vendor_name", label: "Vendor / Supplier" },
    { key: "po_reference", label: "PO Reference", render: (r) => r.po_reference || "—" },
    { key: "invoice_date", label: "Invoice Date", render: (r) => String(r.invoice_date || "").slice(0, 10) || "—" },
    {
      key: "due_date", label: "Due Date",
      render: (r) => {
        const dt = String(r.due_date || "").slice(0, 10);
        const d = daysDiff(r.due_date);
        const isOverdue = (d ?? 0) > 0 && r.status !== "paid";
        return (
          <span className={isOverdue ? "text-red-600 font-semibold" : "text-slate-700"}>
            {dt || "—"}
            {isOverdue && <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{d}d overdue</span>}
          </span>
        );
      }
    },
    { key: "amount", label: "Taxable Amt", render: (r) => formatInr(r.amount) },
    { key: "gst", label: "GST", render: (r) => formatInr(r.gst) },
    {
      key: "balance", label: "Outstanding",
      render: (r) => (
        <span className={`font-bold ${Number(r.balance ?? 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>
          {formatInr(r.balance ?? 0)}
        </span>
      )
    },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions", label: "", sortable: false,
      render: (r) => (
        <RowActionMenu
          rowId={r.id}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          items={[
            { label: "View Details", icon: <Eye className="h-4 w-4" />, onClick: () => setViewBill(r) },
            { label: "Edit Bill", icon: <Edit2 className="h-4 w-4" />, onClick: () => setEditBill(r) },
            ...(r.status !== "paid"
              ? [{ label: "Record Payment", icon: <CreditCard className="h-4 w-4" />, onClick: () => { setPayBill(r); setShowCreatePayment(true); } }]
              : []
            ),
          ]}
        />
      ),
    },
  ];

  // ── Payment Table Columns ──
  const paymentColumns = [
    {
      key: "id", label: "Payment Ref",
      render: (r) => <span className="font-mono text-slate-700 font-semibold">VPY-{String(r.id).padStart(5, "0")}</span>
    },
    { key: "payment_date", label: "Date", render: (r) => String(r.payment_date || "").slice(0, 10) },
    { key: "supplier_id", label: "Vendor", render: (r) => vendors.find((v) => v.id === r.supplier_id)?.name || `Vendor #${r.supplier_id}` },
    { key: "amount", label: "Amount", render: (r) => <span className="font-semibold text-emerald-700">{formatInr(r.amount)}</span> },
    {
      key: "payment_method", label: "Method",
      render: (r) => (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 uppercase">
          {r.payment_method || "—"}
        </span>
      )
    },
    { key: "reference", label: "UTR / Reference", render: (r) => r.reference || "—" },
    { key: "notes", label: "Notes", render: (r) => r.notes || "—" },
  ];

  if (loading) return <Loader label="Loading Accounts Payable…" />;

  const overdueCount = agingAnalysis["1-30"].length + agingAnalysis["31-60"].length +
    agingAnalysis["61-90"].length + agingAnalysis["90+"].length;

  return (
    <>
      {/* ── Global CSS utilities (injected once) ── */}
      <style>{`
        .field-label { display:block; font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.05em; margin-bottom:4px; }
        .field-input { width:100%; border-radius:12px; border:1px solid #e2e8f0; background:#fff; padding:10px 14px; font-size:14px; color:#1e293b; transition:border-color .15s,box-shadow .15s; }
        .field-input:focus { outline:none; border-color:#0f6d84; box-shadow:0 0 0 3px rgba(15,109,132,.12); }
        .btn-primary { display:inline-flex; align-items:center; gap:6px; border-radius:10px; background:#0f6d84; color:#fff; padding:9px 18px; font-size:14px; font-weight:600; transition:background .15s; cursor:pointer; border:none; }
        .btn-primary:hover { background:#0c5a6e; }
        .btn-primary:disabled { opacity:.6; cursor:not-allowed; }
        .btn-outline { display:inline-flex; align-items:center; gap:6px; border-radius:10px; border:1px solid #e2e8f0; background:#fff; color:#374151; padding:9px 18px; font-size:14px; font-weight:600; transition:background .15s; cursor:pointer; }
        .btn-outline:hover { background:#f8fafc; }
      `}</style>

      <div className="space-y-5 pb-4">
        {/* ── Page Header ── */}
        <PageHeader
        subtitle="Manage vendor bills, supplier payments, and outstanding payables."
        action={
          <>
            <Button variant="secondary" type="button" onClick={() => setShowCreateBill(true)}>
              <FileText className="h-4 w-4" /> New Vendor Bill
            </Button>
            <Button variant="primary" type="button" onClick={() => { setPayBill(null); setShowCreatePayment(true); }}>
              <CreditCard className="h-4 w-4" /> Record Payment
            </Button>
          </>
        }
      />

        {/* ── Finance Workflow Bar ── */}
        <div className="flex flex-wrap items-center gap-1 ui-card px-4 py-3 text-[10px] font-medium text-slate-600 sm:text-xs">
          {FINANCE_FLOW.map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`rounded-lg px-2.5 py-1 ${
                ["Vendor Bill","Accounts Payable","Payment"].includes(s)
                  ? "bg-[var(--color-success)] text-white font-semibold"
                  : "bg-slate-50 text-slate-600 ring-1 ring-slate-200/80"
              }`}>{s}</span>
              {i < FINANCE_FLOW.length - 1 && <ChevronRight className="h-3 w-3 text-slate-400" />}
            </span>
          ))}
        </div>

        {/* ── KPI Summary Cards ── */}
        <div className="ui-grid-kpi">
          <KpiCard label="Outstanding Payables" value={formatInr(summary.outstanding_payables)} icon={IndianRupee} color="bg-rose-600" />
          <KpiCard label="Due This Week" value={summary.due_this_week} sub="bills" icon={Clock} color="bg-amber-500" />
          <KpiCard label="Overdue Bills" value={summary.overdue_bills} icon={AlertCircle} color="bg-orange-500" />
          <KpiCard label="Paid This Month" value={formatInr(summary.paid_this_month)} icon={CheckCircle2} color="bg-[var(--color-success)]" />
          <KpiCard label="Pending Approvals" value={summary.pending_approvals} icon={FileText} color="bg-indigo-600" />
          <KpiCard label="Active Vendors" value={summary.vendor_count} icon={Building2} color="bg-[var(--color-success)]" />
        </div>

        {/* ── Section Navigation ── */}
        <div className="flex overflow-x-auto border-b border-slate-200 scrollbar-hide">
          <SectionTab id="overview"  label="Overview"      icon={LayoutDashboard} active={activeSection === "overview"}  onClick={setActiveSection} />
          <SectionTab id="bills"     label="Vendor Bills"  icon={Receipt}         active={activeSection === "bills"}     onClick={setActiveSection} badge={bills.length} />
          <SectionTab id="payments"  label="Payments"      icon={CreditCard}      active={activeSection === "payments"}  onClick={setActiveSection} badge={payments.length} />
          <SectionTab id="aging"     label="AP Aging"      icon={Calendar}        active={activeSection === "aging"}     onClick={setActiveSection} badge={overdueCount || null} />
        </div>

        {/* ════════════════════════════════════════════
            SECTION: OVERVIEW
        ════════════════════════════════════════════ */}
        {activeSection === "overview" && (
          <div className="space-y-5 pb-4">
            {/* Quick Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Aging Summary Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm col-span-full lg:col-span-2">
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" /> AP Aging Summary
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    { key: "current", label: "Current", cls: "bg-emerald-50 border-emerald-200 text-emerald-800" },
                    { key: "1-30",    label: "1–30 Days", cls: "bg-amber-50 border-amber-200 text-amber-800" },
                    { key: "31-60",   label: "31–60 Days", cls: "bg-orange-50 border-orange-200 text-orange-800" },
                    { key: "61-90",   label: "61–90 Days", cls: "bg-red-50 border-red-200 text-red-700" },
                    { key: "90+",     label: "90+ Days", cls: "bg-red-100 border-red-300 text-red-900" },
                  ].map(({ key, label, cls }) => (
                    <div key={key} className={`rounded-xl border p-3 text-center ${cls}`}>
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
                      <p className="mt-1.5 text-2xl font-bold">{agingAnalysis[key].length}</p>
                      <p className="text-[11px] opacity-70 mt-0.5">
                        {formatInr(agingAnalysis[key].reduce((s, b) => s + Number(b.balance ?? b.amount ?? 0), 0))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="ui-card p-5">
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" /> Quick Actions
                </h3>
                <div className="space-y-2.5">
                  <button onClick={() => setShowCreateBill(true)}
                    className="w-full flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors text-left">
                    <Receipt className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>Enter Vendor Invoice / Bill</span>
                    <ArrowRight className="h-4 w-4 ml-auto opacity-40" />
                  </button>
                  <button onClick={() => { setPayBill(null); setShowCreatePayment(true); }}
                    className="w-full flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors text-left">
                    <CreditCard className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Record Supplier Payment</span>
                    <ArrowRight className="h-4 w-4 ml-auto opacity-40" />
                  </button>
                  <button onClick={() => setActiveSection("aging")}
                    className="w-full flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-colors text-left">
                    <Calendar className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>View AP Aging Report</span>
                    <ArrowRight className="h-4 w-4 ml-auto opacity-40" />
                  </button>
                  <Link to="/procurement/vendors"
                    className="w-full flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <Building2 className="h-4 w-4 text-slate-500 shrink-0" />
                    <span>Manage Vendors</span>
                    <ArrowRight className="h-4 w-4 ml-auto opacity-40" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Recent Overdue Bills */}
            {agingAnalysis["90+"].length + agingAnalysis["61-90"].length > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Critically Overdue Bills (60+ days)
                </h3>
                <div className="space-y-2">
                  {[...agingAnalysis["90+"], ...agingAnalysis["61-90"]].slice(0, 5).map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-xl bg-white border border-red-100 px-4 py-2.5 text-sm">
                      <div>
                        <span className="font-semibold font-mono text-red-700">{b.bill_number}</span>
                        <span className="ml-2 text-slate-500">{b.vendor_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-red-700">{formatInr(b.balance ?? b.amount)}</span>
                        <button onClick={() => setViewBill(b)} className="text-blue-600 hover:underline text-xs">View</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            SECTION: VENDOR BILLS
        ════════════════════════════════════════════ */}
        {activeSection === "bills" && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: "all",     label: "All Bills",      count: bills.length },
                { id: "pending", label: "Pending",        count: bills.filter((b) => b.status === "pending").length },
                { id: "overdue", label: "Overdue",        count: bills.filter((b) => (daysDiff(b.due_date) ?? 0) > 0 && b.status !== "paid").length },
                { id: "paid",    label: "Paid",           count: bills.filter((b) => b.status === "paid").length },
              ].map(({ id, label, count }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBillsTab(id)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all border ${
                    billsTab === id
                      ? id === "overdue"
                        ? "bg-red-600 border-red-600 text-white"
                        : "bg-[var(--color-primary)] border-blue-600 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    billsTab === id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}>{count}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowCreateBill(true)}
                className="ml-auto btn-outline text-sm"
              >
                <Plus className="h-4 w-4" /> New Bill
              </button>
            </div>

            <FinanceFilters
              search={search}
              onSearchChange={setSearch}
              status={statusFilter}
              onStatusChange={setStatusFilter}
              statusOptions={["All", "Pending", "Paid", "Overdue", "Partial"]}
              vendorFilter={vendorFilter}
              onVendorFilterChange={setVendorFilter}
              vendors={vendors}
              financialYear={financialYear}
              onFinancialYearChange={setFinancialYear}
              month={month}
              onMonthChange={setMonth}
              branch={branch}
              onBranchChange={setBranch}
              searchPlaceholder="Search"
            />

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {filteredBills.length === 0 ? (
                <div className="py-16 text-center">
                  <Receipt className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-500">No vendor bills found</p>
                  <p className="text-xs text-slate-400 mt-1">Enter a vendor invoice to get started</p>
                  <button type="button" onClick={() => setShowCreateBill(true)} className="btn-primary mt-4 mx-auto">
                    <Plus className="h-4 w-4" /> Enter Vendor Bill
                  </button>
                </div>
              ) : (
                <DataTable columns={billColumns} data={filteredBills} searchPlaceholder="" searchKeys={[]} />
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════
            SECTION: PAYMENTS
        ════════════════════════════════════════════ */}
        {activeSection === "payments" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Payment History</h2>
              <button type="button" onClick={() => { setPayBill(null); setShowCreatePayment(true); }} className="btn-primary text-sm">
                <Plus className="h-4 w-4" /> Record Payment
              </button>
            </div>

            <FinanceFilters
              search={search}
              onSearchChange={setSearch}
              financialYear={financialYear}
              onFinancialYearChange={setFinancialYear}
              month={month}
              onMonthChange={setMonth}
              searchPlaceholder="Search"
            />

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {filteredPayments.length === 0 ? (
                <div className="py-16 text-center">
                  <CreditCard className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-500">No payments recorded yet</p>
                  <button type="button" onClick={() => { setPayBill(null); setShowCreatePayment(true); }} className="btn-primary mt-4 mx-auto">
                    <Plus className="h-4 w-4" /> Record First Payment
                  </button>
                </div>
              ) : (
                <DataTable columns={paymentColumns} data={filteredPayments} searchPlaceholder="" searchKeys={[]} />
              )}
            </div>

            {/* Payment Summary Strip */}
            {filteredPayments.length > 0 && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-3 flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="text-emerald-700 font-semibold">Total Paid: </span>
                  <span className="font-bold text-emerald-800">
                    {formatInr(filteredPayments.reduce((s, p) => s + Number(p.amount || 0), 0))}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-700 font-semibold">Transactions: </span>
                  <span className="font-bold text-emerald-800">{filteredPayments.length}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════
            SECTION: AP AGING
        ════════════════════════════════════════════ */}
        {activeSection === "aging" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">AP Aging Analysis</h2>
              <p className="text-xs text-slate-400">Outstanding payables by overdue days</p>
            </div>

            {/* Aging Buckets */}
            {[
              { key: "current", label: "Current (Not Yet Due)", th: "bg-emerald-500", card: "border-emerald-200 bg-emerald-50" },
              { key: "1-30",    label: "1–30 Days Overdue",    th: "bg-amber-500",   card: "border-amber-200 bg-amber-50" },
              { key: "31-60",   label: "31–60 Days Overdue",   th: "bg-orange-500",  card: "border-orange-200 bg-orange-50" },
              { key: "61-90",   label: "61–90 Days Overdue",   th: "bg-red-500",     card: "border-red-200 bg-red-50" },
              { key: "90+",     label: "90+ Days Overdue",     th: "bg-red-800",     card: "border-red-300 bg-red-100" },
            ].map(({ key, label, th, card }) => {
              const bucketBills = agingAnalysis[key];
              if (bucketBills.length === 0) return null;
              const total = bucketBills.reduce((s, b) => s + Number(b.balance ?? b.amount ?? 0), 0);
              return (
                <div key={key} className={`rounded-2xl border ${card} overflow-hidden shadow-sm`}>
                  <div className={`${th} px-5 py-3 flex items-center justify-between`}>
                    <span className="text-sm font-bold text-white">{label}</span>
                    <div className="flex items-center gap-4 text-white text-sm">
                      <span>{bucketBills.length} bills</span>
                      <span className="font-bold">{formatInr(total)}</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white/60 text-[11px] font-bold uppercase text-slate-500 tracking-wide">
                          <SerialNumberHeader className="px-2 py-2" />
                          <th className="px-4 py-2 text-left">Bill No.</th>
                          <th className="px-4 py-2 text-left">Vendor</th>
                          <th className="px-4 py-2 text-left">Invoice Date</th>
                          <th className="px-4 py-2 text-left">Due Date</th>
                          <th className="px-4 py-2 text-right">Outstanding</th>
                          <th className="px-4 py-2 text-left">Status</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {bucketBills.map((b, rowIndex) => (
                          <tr key={b.id} className="hover:bg-slate-50">
                            <SerialNumberCell rowIndex={rowIndex} className="px-2 py-2.5" />
                            <td className="px-4 py-2.5">
                              <button onClick={() => setViewBill(b)} className="font-mono text-blue-600 hover:underline font-semibold">
                                {b.bill_number}
                              </button>
                            </td>
                            <td className="px-4 py-2.5 text-slate-700">{b.vendor_name}</td>
                            <td className="px-4 py-2.5 text-slate-500">{String(b.invoice_date || "").slice(0, 10)}</td>
                            <td className="px-4 py-2.5 text-slate-500">{String(b.due_date || "").slice(0, 10)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-red-700">{formatInr(b.balance ?? b.amount)}</td>
                            <td className="px-4 py-2.5"><StatusBadge status={b.status} /></td>
                            <td className="px-4 py-2.5">
                              <button
                                onClick={() => { setPayBill(b); setShowCreatePayment(true); }}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                Pay
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {bills.filter((b) => b.status !== "paid").length === 0 && (
              <div className="py-16 text-center rounded-2xl border border-slate-200 bg-white">
                <BadgeCheck className="mx-auto h-12 w-12 text-emerald-400" />
                <p className="mt-3 text-sm font-semibold text-emerald-700">All bills are paid — No outstanding payables</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showCreateBill && (
        <CreateBillModal
          vendors={vendors}
          onClose={() => setShowCreateBill(false)}
          onSuccess={() => { setShowCreateBill(false); load(); setActiveSection("bills"); }}
        />
      )}

      {showCreatePayment && (
        <RecordPaymentModal
          vendors={vendors}
          pendingBills={pendingBills}
          prefillSupplierId={payBill?.supplier_id}
          onClose={() => { setShowCreatePayment(false); setPayBill(null); }}
          onSuccess={() => { setShowCreatePayment(false); setPayBill(null); load(); }}
        />
      )}

      {viewBill && (
        <ViewBillModal
          bill={viewBill}
          vendors={vendors}
          onClose={() => setViewBill(null)}
          onPay={handlePayFromView}
        />
      )}

      {editBill && (
        <EditBillModal
          bill={editBill}
          onClose={() => setEditBill(null)}
          onSuccess={() => { setEditBill(null); load(); }}
        />
      )}
    </>
  );
}
