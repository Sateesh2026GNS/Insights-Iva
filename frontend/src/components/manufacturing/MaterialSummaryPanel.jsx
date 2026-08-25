import { Package } from "lucide-react";

import CommonStatusBadge from "../common/StatusBadge";

function availabilityTone(line) {
  if (line?.is_available === false || Number(line?.shortage_qty) > 0) return "danger";
  if (line?.is_available === true) return "success";
  return "neutral";
}

function availabilityLabel(line) {
  if (line?.is_available === false || Number(line?.shortage_qty) > 0) return "Shortage";
  if (line?.is_available === true) return "Available";
  return "Pending";
}

/** Material lines from GET /material-check for queue preview. */
export default function MaterialSummaryPanel({ lines = [], loading = false }) {
  return (
    <article className="ui-card overflow-hidden">
      <header className="flex items-center gap-2.5 border-b border-[var(--color-border-muted)] bg-gradient-to-r from-[var(--color-primary-soft)] to-[var(--color-surface)] px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <Package className="h-4 w-4" strokeWidth={2} />
        </span>
        <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--color-primary)]">
          Material Summary
        </h3>
      </header>

      {loading ? (
        <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">Loading materials…</p>
      ) : !lines.length ? (
        <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
          No material requirements loaded yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="ui-table-head">
              <tr>
                <th className="px-3 py-2">Material</th>
                <th className="px-2 py-2 text-right">Required</th>
                <th className="px-2 py-2 text-right">Available</th>
                <th className="px-2 py-2 text-right">Shortage</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((ln) => (
                <tr key={ln.id} className="border-t border-[var(--color-border-soft)]">
                  <td className="max-w-[120px] truncate px-3 py-2 font-medium text-[var(--color-text)]" title={ln.material_name}>
                    {ln.material_name || "—"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{Number(ln.required_qty || 0).toLocaleString("en-IN")}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{Number(ln.available_qty || 0).toLocaleString("en-IN")}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-[var(--color-danger)]">
                    {Number(ln.shortage_qty || 0) > 0 ? Number(ln.shortage_qty).toLocaleString("en-IN") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <CommonStatusBadge tone={availabilityTone(ln)}>{availabilityLabel(ln)}</CommonStatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
