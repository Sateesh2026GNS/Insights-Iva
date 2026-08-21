import { useCallback, useEffect, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { CheckCircle2, FileText, IndianRupee, Plus, X, XCircle } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import DataTable from "../../components/common/DataTable";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import {
  createVendorBill,
  deleteVendorBill,
  getGRNEnriched,
  getPurchaseOrdersEnriched,
  getVendors,
  getVendorBills,
  getVendorBillSummary,
  updateVendorBillStatus,
} from "../../api/procurementApi";
import { formatInr, statusColor } from "../../data/procurementMasterData";


import Button from "../../components/common/Button";
function WorkflowStrip() {
  const steps = ["Purchase Order (PO)", "Goods Receipt Note (GRN)", "Vendor Invoice", "Finance Approval", "Payment"];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
      {steps.map((s, i) => (
        <span key={s} className="flex items-center gap-2">
          <span className="rounded-lg bg-white px-2.5 py-1 shadow-2xs font-semibold">{s}</span>
          {i < steps.length - 1 && <span className="text-slate-400">→</span>}
        </span>
      ))}
    </div>
  );
}

function CreateBillModal({ isOpen, onClose, onCreated, suppliers, purchaseOrders, goodsReceipts }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({
    bill_number: "",
    supplier_id: "",
    purchase_order_id: "",
    goods_receipt_id: "",
    amount: "",
    gst_amount: "",
    bill_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createVendorBill({
        bill_number: form.bill_number || null,
        supplier_id: Number(form.supplier_id),
        purchase_order_id: form.purchase_order_id ? Number(form.purchase_order_id) : null,
        goods_receipt_id: form.goods_receipt_id ? Number(form.goods_receipt_id) : null,
        amount: Number(form.amount),
        gst_amount: form.gst_amount ? Number(form.gst_amount) : null,
        bill_date: form.bill_date || null,
        due_date: form.due_date || null,
      });
      addToast("Vendor bill created successfully");
      onCreated();
      onClose();
    } catch {
      addToast("Failed to create vendor bill", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Create Vendor Bill</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Bill Number <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              placeholder="Auto-generated (e.g. V-BILL-2026-0001)"
              value={form.bill_number}
              onChange={(e) => setForm((f) => ({ ...f, bill_number: e.target.value }))}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Vendor / Supplier</label>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">Select Vendor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code || "Supplier"})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Purchase Order</label>
              <select
                value={form.purchase_order_id}
                onChange={(e) => setForm((f) => ({ ...f, purchase_order_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Select PO (Opt)</option>
                {purchaseOrders.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.po_number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Goods Receipt Note (GRN)</label>
              <select
                value={form.goods_receipt_id}
                onChange={(e) => setForm((f) => ({ ...f, goods_receipt_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Select Goods Receipt Note (GRN) (Opt)</option>
                {goodsReceipts.map((grn) => (
                  <option key={grn.id} value={grn.id}>
                    {grn.grn_number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Bill Amount (₹)</label>
              <input
                type="number"
                min="0"
                required
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">GST Amount (₹)</label>
              <input
                type="number"
                min="0"
                value={form.gst_amount}
                onChange={(e) => setForm((f) => ({ ...f, gst_amount: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Bill Date</label>
              <input
                type="date"
                required
                value={form.bill_date}
                onChange={(e) => setForm((f) => ({ ...f, bill_date: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Due Date</label>
              <input
                type="date"
                required
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="w-1/2">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting} className="w-1/2">
              {submitting ? "Saving..." : "Create Bill"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VendorBills() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total_bills: 0, due_bills: 0, paid: 0, outstanding: 0 });
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes, supRes, poRes, grnRes] = await Promise.allSettled([
        getVendorBillSummary(),
        getVendorBills(),
        getVendors(),
        getPurchaseOrdersEnriched(),
        getGRNEnriched(),
      ]);


      if (sumRes.status === "fulfilled" && sumRes.value?.data) {
        setSummary(sumRes.value.data);
      }
      if (listRes.status === "fulfilled" && listRes.value?.data) {
        setRows(listRes.value.data);
      } else {
        setRows([]);
      }
      if (supRes.status === "fulfilled" && supRes.value?.data) setSuppliers(supRes.value.data);
      if (poRes.status === "fulfilled" && poRes.value?.data) setPurchaseOrders(poRes.value.data);
      if (grnRes.status === "fulfilled" && grnRes.value?.data) setGoodsReceipts(grnRes.value.data);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (billId, newStatus) => {
    setUpdatingId(billId);
    try {
      await updateVendorBillStatus(billId, newStatus);
      addToast(`Vendor bill status updated to ${newStatus}`);
      await load();
    } catch {
      addToast("Failed to update bill status", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete vendor bill ${row.bill_number || row.id}?`)) return;
    try {
      await deleteVendorBill(row.id);
      addToast("Vendor bill deleted", "success");
      await load();
    } catch (err) {
      addToast(err.response?.data?.detail || "Failed to delete bill", "error");
    }
  };

  const columns = [
    { key: "bill_number", label: "Bill Number" },
    { key: "vendor_name", label: "Vendor" },
    { key: "po_number", label: "Purchase Order Number", render: (r) => r.po_number || "—" },
    { key: "grn_number", label: "Goods Receipt Note (GRN) Number", render: (r) => r.grn_number || "—" },
    { key: "amount", label: "Amount", render: (r) => formatInr(r.amount) },
    { key: "gst_amount", label: "Goods & Services Tax (GST)", render: (r) => formatInr(r.gst_amount) },
    { key: "due_date", label: "Due Date", render: (r) => (r.due_date ? String(r.due_date).slice(0, 10) : "—") },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusColor(r.status)}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => {
        const isBusy = updatingId === r.id;
        const deleteBtn = (
          <button
            type="button"
            onClick={() => handleDelete(r)}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            Delete
          </button>
        );
        if (r.status === "pending" || r.status === "due") {
          return (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleStatusChange(r.id, "approved")}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--color-success-hover)] disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleStatusChange(r.id, "rejected")}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </button>
              {deleteBtn}
            </div>
          );
        }
        if (r.status === "approved") {
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleStatusChange(r.id, "paid")}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark Paid
              </button>
              {deleteBtn}
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-700">Paid ✓</span>
            {deleteBtn}
          </div>
        );
      },
    },
  ];

  if (loading) return <Loader label="Loading vendor bills..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="Invoice module with three-way matching (Purchase Order (PO) ↔ Goods Receipt Note (GRN) ↔ Vendor Invoice) and finance approval."
        action={
          <>
            <Button
            variant="primary"
            type="button"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> Create Vendor Bill
          </Button>
          </>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Bills" value={summary.total_bills} icon={FileText} color="bg-[var(--color-primary)]" />
        <KpiCard label="Due Bills" value={summary.due_bills} icon={FileText} color="bg-amber-500" />
        <KpiCard label="Paid" value={summary.paid} icon={FileText} color="bg-[var(--color-success)]" />
        <KpiCard label="Outstanding" value={formatInr(summary.outstanding)} icon={IndianRupee} color="bg-red-500" />
      </div>

      <WorkflowStrip />

      <div className="ui-card p-4">
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search"
          searchKeys={["bill_number", "vendor_name", "po_number"]}
        />
      </div>

      <CreateBillModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={load}
        suppliers={suppliers}
        purchaseOrders={purchaseOrders}
        goodsReceipts={goodsReceipts}
      />
    </div>
  );
}
