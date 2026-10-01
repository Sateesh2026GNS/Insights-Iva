import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Printer, X } from "lucide-react";

import { getPurchaseOrder } from "../../api/procurementApi";
import useAuth from "../../hooks/useAuth";
import { hasRole, isAdmin } from "../../config/permissions";
import { formatInr, statusColor } from "../../data/procurementMasterData";

export default function PODetailModal({ po, onClose, onApprove, onReject }) {
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (!po || typeof po.id !== "number") return undefined;
    let cancelled = false;
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    getPurchaseOrder(po.id)
      .then((response) => {
        if (!cancelled) setDetail(response.data || null);
      })
      .catch((error) => {
        if (!cancelled) setDetailError(error.response?.data?.detail || "Could not load purchase order details.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => { cancelled = true; };
  }, [po?.id]);

  if (!po) return null;

  const order = { ...po, ...(detail || {}) };
  const sellerName = order.vendor_name || order.supplier_name || detail?.supplier?.name || "—";
  const items = (detail?.line_items || []).map((line) => {
    const qty = Number(line.quantity || 0);
    const rate = Number(line.unit_price || 0);
    return {
      id: line.id,
      name: line.item_name || `Inventory item #${line.item_id}`,
      sku: line.item_sku,
      qty,
      ordered: Number(line.quantity || 0),
      received: Number(line.received_quantity || 0),
      remaining: Number(line.remaining_quantity ?? line.quantity ?? 0),
      uom: line.item_unit || "—",
      rate,
      amount: line.line_total == null ? qty * rate : Number(line.line_total),
    };
  });
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const gst = Number(order.gst_amount || 0);
  const discount = Number(order.discount || 0);
  const total = order.total_amount == null ? subtotal + gst - discount : Number(order.total_amount);
  const pendingLines = items.filter((item) => item.remaining > 0.000001);
  const canApprove = isAdmin(user) || hasRole(user, "Purchase Manager");
  const approvalPending = ["draft", "pending"].includes(String(po.status || "").toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#2563EB]">{order.po_number}</p>
            <h2 className="text-xl font-bold text-slate-900">{sellerName}</h2>
            <p className="text-sm text-slate-500">Seller / Supplier · PO date: {String(order.order_date || "").slice(0, 10) || "—"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">Delivery Date</p><p className="font-medium">{order.expected_date || "—"}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">Payment Terms</p><p className="font-medium">{order.payment_terms || "Not specified"}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">Warehouse</p><p className="font-medium">{order.warehouse_name || "—"}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-400">Status</p><span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(po.status)}`}>{po.status}</span></div>
          </div>

          {approvalPending ? (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Purchase Manager approval is required before this order proceeds to the supplier.
            </p>
          ) : null}
          {detailError ? <p className="mb-3 text-sm text-red-600">{detailError}</p> : null}
          {pendingLines.length > 0 ? (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <strong>Pending delivery:</strong>{" "}
              {pendingLines.map((item) => `${item.name}: ${item.remaining} ${item.uom}`).join(" · ")}
              {" "}remaining on this purchase order.
            </div>
          ) : null}
          <table className="mb-4 w-full text-left text-sm">
            <thead className="ui-table-head"><tr><th className="py-2">Item</th><th>Ordered</th><th>Received</th><th>Remaining</th><th>UOM</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>
              {detailLoading ? <tr><td colSpan={7} className="py-4 text-center text-slate-500">Loading purchase order lines…</td></tr> : null}
              {!detailLoading && items.length === 0 ? <tr><td colSpan={7} className="py-4 text-center text-slate-500">No purchase order lines were returned.</td></tr> : null}
              {!detailLoading && items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.name}{item.sku ? <span className="block text-xs text-slate-500">{item.sku}</span> : null}</td>
                  <td>{item.ordered}</td><td>{item.received}</td><td className={item.remaining > 0 ? "font-semibold text-amber-700" : ""}>{item.remaining}</td><td>{item.uom}</td><td>{formatInr(item.rate)}</td><td>{formatInr(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatInr(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">GST</span><span>{formatInr(gst)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>-{formatInr(discount)}</span></div>
            <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{formatInr(total)}</span></div>
          </div>

          <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Approval History: Draft → Submitted → {po.status === "approved" ? "Approved by Manager" : "Pending Manager Approval"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t px-5 py-4">
          {approvalPending && canApprove ? (
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
