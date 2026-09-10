import { X } from "lucide-react";

export default function RecordDetailModal({ open, title, subtitle, fields = [], onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title || "Details"}</h2>
            {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
            <p className="mt-1 text-xs font-medium text-slate-400">View only</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          <dl className="grid gap-3 sm:grid-cols-2">
            {fields.map(({ label, value }) => (
              <div key={label} className="rounded-lg border bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="font-semibold text-slate-800">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
