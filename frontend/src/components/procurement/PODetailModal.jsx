import { Link } from "react-router-dom";
import { Mail, Printer, X } from "lucide-react";

import { formatInr, statusColor } from "../../data/procurementMasterData";

export default function PODetailModal({ po, onClose, onApprove, onReject }) {
  if (!po) return null;

  const items = po.items || [
    { name: "Steel Sheet 2mm", qty: 500, uom: "KG", rate: 85, amount: 42500 },
    { name: "Bearing SKF-6205", qty: 100, uom: "PCS", rate: 320, amount: 32000 },
  ];
  const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0);
  const gst = po.gst_amount ?? subtotal * 0.18;
  const discount = po.discount ?? 0;
  const total = po.total_amount ?? subtotal + gst - discount;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#2563EB]">{po.po_number}</p>
            <h2 className="text-xl font-bold text-slate-900">{po.vendor_name || po.supplier_name}</h2>
            <p className="text-sm text-slate-500">Buyer: {po.buyer || "—"} · {String(po.order_date || "").slice(0, 10)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">Delivery Date</p><p className="font-medium">{po.expected_date || "—"}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">Payment Terms</p><p className="font-medium">{po.payment_terms || "Net 30"}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">Warehouse</p><p className="font-medium">{po.warehouse_name || "Main Warehouse"}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">Status</p><span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(po.status)}`}>{po.status}</span></div>
          </div>

          <table className="mb-4 w-full text-left text-sm">
            <thead className="ui-table-head"><tr><th className="py-2">Item</th><th>Qty</th><th>UOM</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b"><td className="py-2">{it.name}</td><td>{it.qty}</td><td>{it.uom}</td><td>₹{it.rate}</td><td>₹{Number(it.amount).toLocaleString("en-IN")}</td></tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatInr(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">GST (18%)</span><span>{formatInr(gst)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>-{formatInr(discount)}</span></div>
            <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{formatInr(total)}</span></div>
          </div>

          <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Approval History: Draft → Submitted → {po.status === "approved" ? "Approved" : "Pending Manager Approval"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t px-5 py-4">
          {po.status === "pending" || po.status === "draft" ? (
            <>
              <button type="button" onClick={() => onApprove?.(po)} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white">Approve</button>
              <button type="button" onClick={() => onReject?.(po)} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700">Reject</button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <Printer className="h-4 w-4" /> Print PO
          </button>
          <button
            type="button"
            onClick={() => {
              const vendor = po.vendor_name || po.supplier_name || "Vendor";
              const subject = encodeURIComponent(`Purchase Order ${po.po_number || ""}`);
              const body = encodeURIComponent(
                `Dear ${vendor},\n\nPlease find Purchase Order ${po.po_number} totaling ${formatInr(total)}.\nExpected delivery: ${po.expected_date || "—"}.\n\nRegards`
              );
              window.location.href = `mailto:?subject=${subject}&body=${body}`;
            }}
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <Mail className="h-4 w-4" /> Email Vendor
          </button>
          <LinkClone po={po} />
        </div>
      </div>
    </div>
  );
}

function LinkClone({ po }) {
  return (
    <a href={`/procurement/purchase-orders/create?clone=${po.id || po.po_number}`} className="rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700">
      Clone PO
    </a>
  );
}
