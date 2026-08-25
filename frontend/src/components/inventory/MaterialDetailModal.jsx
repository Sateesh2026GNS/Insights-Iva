import { useState } from "react";
import { X } from "lucide-react";

const TABS = ["General", "Vendor", "Stock History", "Purchase", "Consumption", "Batches", "Barcode", "Documents"];

export default function MaterialDetailModal({ material, onClose, readOnly = true, nameLabel = "Material Name" }) {
  const [tab, setTab] = useState("General");
  if (!material) return null;

  const available =
    material.available ??
    Math.max((Number(material.quantity) || 0) - (Number(material.reserved) || 0), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{material.name}</h2>
            <p className="text-sm text-slate-500">{material.sku}</p>
            {readOnly ? <p className="mt-1 text-xs font-medium text-slate-400">View only</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b px-4 py-2">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t ? "bg-[var(--color-primary)] text-white" : "text-slate-600 hover:bg-slate-100"}`}>{t}</button>
          ))}
        </div>
        <div className="overflow-y-auto p-6">
          {tab === "General" && (
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                [nameLabel, material.name],
                ["Stock Keeping Unit (SKU)", material.sku],
                ["Unit", material.unit],
                ["Required Quantity", material.reorder_level],
                ["Available Quantity", available],
                ["Total Quantity", material.quantity],
                ["Barcode", material.barcode],
                ["Category", material.category],
                ["Unit Cost", material.unit_cost],
                ["Description", material.description],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border bg-slate-50 p-3"><dt className="text-xs text-slate-500">{k}</dt><dd className="font-semibold text-slate-800">{v ?? "—"}</dd></div>
              ))}
            </dl>
          )}
          {tab === "Vendor" && (
            <dl className="grid gap-3 sm:grid-cols-2">
              {[["Vendor", material.vendor_name], ["Contact", material.vendor_contact], ["Email", material.vendor_email]].map(([k, v]) => (
                <div key={k} className="rounded-lg border bg-slate-50 p-3"><dt className="text-xs text-slate-500">{k}</dt><dd className="font-semibold">{v ?? "—"}</dd></div>
              ))}
            </dl>
          )}
          {tab === "Stock History" && (
            <table className="ui-table w-full text-sm"><thead className="ui-table-head"><tr><th className="pb-2">Date</th><th>Warehouse</th><th>Type</th><th>Qty</th><th>Ref</th></tr></thead><tbody>
              {(material.stock_history || []).map((h, i) => (
                <tr key={i} className="border-t"><td className="py-2">{h.date?.slice?.(0, 10) || h.date}</td><td>{h.warehouse}</td><td className="capitalize">{h.type}</td><td>{h.quantity}</td><td>{h.reference}</td></tr>
              ))}
            </tbody></table>
          )}
          {tab === "Purchase" && (
            <ul className="space-y-2">{(material.purchase_history || []).map((p, i) => (
              <li key={i} className="rounded-lg border p-3 text-sm">{p.po} — {p.qty} units on {p.date}</li>
            ))}</ul>
          )}
          {tab === "Consumption" && (
            <ul className="space-y-2">{(material.consumption_history || []).map((c, i) => (
              <li key={i} className="rounded-lg border p-3 text-sm">{c.wo} — {c.qty} units on {c.date}</li>
            ))}</ul>
          )}
          {tab === "Batches" && (
            <ul className="space-y-2">{(material.batches || []).map((b, i) => (
              <li key={i} className="rounded-lg border p-3 text-sm font-semibold">{b.batch}: {b.qty} units</li>
            ))}</ul>
          )}
          {tab === "Barcode" && (
            <div className="text-center"><p className="font-mono text-2xl font-bold">{material.barcode || "—"}</p><p className="mt-2 text-sm text-slate-500">Scan to lookup material</p></div>
          )}
          {tab === "Documents" && <p className="text-sm text-slate-500">MSDS, COA, and supplier certificates attached here.</p>}
        </div>
      </div>
    </div>
  );
}
