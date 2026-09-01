import { WorkflowStatusBadge } from "./jobCardUiShared";

function fmtQty(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("en-IN");
}

function stockStatusVariant(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("out of stock")) return "danger";
  if (s.includes("shortage")) return "warning";
  if (s.includes("ready")) return "success";
  return "info";
}

export default function MaterialRequirementsTable({ materials = [] }) {
  if (!materials.length) {
    return (
      <p className="px-4 py-6 text-sm text-[var(--color-text-muted)]">
        No material requirements found. Confirm the sales order and run inventory check first.
      </p>
    );
  }

  return (
    <div className="ui-table-wrap ui-table-wrap--scroll">
      <table className="ui-table min-w-full text-left text-[13px]">
        <thead className="ui-table-head">
          <tr>
            <th className="px-3 py-2.5">Material</th>
            <th className="px-3 py-2.5">Material Code</th>
            <th className="px-2 py-2.5 text-right">Required Qty</th>
            <th className="px-2 py-2.5 text-right">Available Qty</th>
            <th className="px-2 py-2.5 text-right">Reserved Qty</th>
            <th className="px-2 py-2.5 text-right">Shortage Qty</th>
            <th className="px-2 py-2.5">Unit</th>
            <th className="px-3 py-2.5">Stock Status</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((row) => (
            <tr key={row.id || `${row.material_code}-${row.material_name}`} className="border-t border-[var(--color-border-soft)]">
              <td className="px-3 py-2.5 font-medium text-[var(--color-text)]">{row.material || row.material_name || "—"}</td>
              <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{row.material_code || "—"}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{fmtQty(row.required_qty)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums text-[var(--color-text-secondary)]">{fmtQty(row.available_qty)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums text-[var(--color-text-secondary)]">{fmtQty(row.reserved_qty)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">
                {Number(row.shortage_qty) > 0 ? (
                  <span className="font-semibold text-[var(--color-danger)]">{fmtQty(row.shortage_qty)}</span>
                ) : (
                  <span className="text-[var(--color-success)]">0</span>
                )}
              </td>
              <td className="px-2 py-2.5 text-[var(--color-text-muted)]">{row.unit || "Nos"}</td>
              <td className="px-3 py-2.5">
                <WorkflowStatusBadge
                  status={row.stock_status}
                  label={row.stock_status || "—"}
                  variant={stockStatusVariant(row.stock_status)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
