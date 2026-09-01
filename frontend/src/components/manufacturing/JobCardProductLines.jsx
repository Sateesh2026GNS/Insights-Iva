import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";

import { inputClass } from "../../design-system/classes";
import { formatInr } from "../../data/salesMasterData";

const UNITS = ["Nos", "nos", "pcs", "kg", "ltr", "box", "set", "mtr"];

const COL_LABEL =
  "mb-1 block text-[11px] font-semibold text-[var(--color-text-muted)]";

/**
 * Product lines — single-row grid matching Job Card Details reference.
 */
export default function JobCardProductLines({
  lines,
  products,
  readOnly,
  errors,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
}) {
  if (readOnly) {
    if (!lines?.length) {
      return <p className="text-sm text-[var(--color-text-muted)]">No product lines.</p>;
    }
    return (
      <div className="space-y-2">
        <div className="hidden gap-2 px-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-faint)] sm:grid sm:grid-cols-[minmax(0,1.4fr)_72px_72px_96px_minmax(0,1fr)_40px]">
          <span>Product</span>
          <span>Qty</span>
          <span>Unit</span>
          <span>Unit price</span>
          <span>Description</span>
          <span />
        </div>
        {lines.map((line, idx) => (
          <div
            key={line.id ?? idx}
            className="grid gap-2 rounded-xl border border-[var(--color-border-muted)] bg-[var(--color-surface-muted)]/30 p-3 text-sm sm:grid-cols-[minmax(0,1.4fr)_72px_72px_96px_minmax(0,1fr)_40px] sm:items-center"
          >
            <span className="font-medium text-[var(--color-text)]">{line.product_name || "—"}</span>
            <span className="tabular-nums">{line.quantity ?? "—"}</span>
            <span>{line.unit || "pcs"}</span>
            <span className="tabular-nums">
              {line.unit_price != null && line.unit_price !== "" ? formatInr(line.unit_price) : "—"}
            </span>
            <span className="truncate text-[var(--color-text-secondary)]">{line.description || "—"}</span>
            <span />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--color-primary)]">
          Product lines <span className="text-[var(--color-danger)]">*</span>
        </span>
        <button
          type="button"
          onClick={onAddLine}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)] hover:underline"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add line
        </button>
      </div>
      {errors?.product_lines ? (
        <p className="text-xs text-[var(--color-danger)]">{errors.product_lines}</p>
      ) : null}

      <div className="hidden gap-2 px-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-faint)] sm:grid sm:grid-cols-[minmax(0,1.4fr)_72px_72px_96px_minmax(0,1fr)_40px]">
        <span>Product</span>
        <span>Qty</span>
        <span>Unit</span>
        <span>Unit price</span>
        <span>Description</span>
        <span />
      </div>

      {(lines.length ? lines : [{ id: "empty", product_id: "", quantity: 1, unit: "pcs" }]).map((line, idx) => (
        <div
          key={line.id ?? idx}
          className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_72px_72px_96px_minmax(0,1fr)_40px] sm:items-end"
        >
          <div>
            <label className={`${COL_LABEL} sm:sr-only`}>Product</label>
            <select
              value={line.product_id ?? ""}
              onChange={(e) => onUpdateLine(idx, { product_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Select</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={`${COL_LABEL} sm:sr-only`}>Qty</label>
            <input
              type="number"
              min="0"
              step="any"
              value={line.quantity ?? ""}
              onChange={(e) => onUpdateLine(idx, { quantity: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={`${COL_LABEL} sm:sr-only`}>Unit</label>
            <select
              value={line.unit || "pcs"}
              onChange={(e) => onUpdateLine(idx, { unit: e.target.value })}
              className={inputClass}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={`${COL_LABEL} sm:sr-only`}>Unit price</label>
            <input
              type="number"
              min="0"
              step="any"
              value={line.unit_price ?? ""}
              onChange={(e) => onUpdateLine(idx, { unit_price: e.target.value })}
              className={inputClass}
              placeholder=""
            />
          </div>
          <div>
            <label className={`${COL_LABEL} sm:sr-only`}>Description</label>
            <input
              type="text"
              value={line.description ?? ""}
              onChange={(e) => onUpdateLine(idx, { description: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex items-end justify-end pb-0.5">
            <button
              type="button"
              disabled={lines.length <= 1}
              onClick={() => onRemoveLine(idx)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[var(--color-danger-soft)] text-[var(--color-danger)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Remove line"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      <Link
        to="/masters/products/create"
        className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)] hover:underline"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add New Product
      </Link>
    </div>
  );
}
