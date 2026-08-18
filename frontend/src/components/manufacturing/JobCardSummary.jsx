import { ClipboardList } from "lucide-react";

const PRIORITY_STYLES = {
  high: {
    label: "High",
    className: "border border-rose-400 bg-rose-50 text-rose-600",
  },
  medium: {
    label: "Medium",
    className: "border border-amber-400 bg-amber-50 text-amber-700",
  },
  low: {
    label: "Low",
    className: "border border-emerald-400 bg-emerald-50 text-emerald-700",
  },
};

function fmtQty(qty, uom = "Nos") {
  if (qty == null || qty === "") return "—";
  const n = Number(qty);
  if (Number.isNaN(n)) return String(qty);
  return `${n.toLocaleString("en-IN")} ${uom}`;
}

function dash(v) {
  return v == null || v === "" ? "—" : v;
}

function SummaryRow({ label, value, isLast = false, children }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3 ${
        isLast ? "" : "border-b border-[var(--color-border-muted)]"
      }`}
    >
      <span className="text-[13px] font-semibold text-[var(--color-text-muted)]">{label}</span>
      {children ?? (
        <span className="text-right text-[13px] font-semibold text-[var(--color-text)]">{dash(value)}</span>
      )}
    </div>
  );
}

/**
 * Job Card Summary — matches reference screenshot layout.
 * @param {{ jobCardNo?, salesOrderNo?, customer?, product?, orderQuantity?, requiredDelivery?, priority?, uom?, headerAction? }} props
 */
export default function JobCardSummary({
  jobCardNo,
  salesOrderNo,
  customer,
  product,
  orderQuantity,
  requiredDelivery,
  priority = "medium",
  uom = "Nos",
  workflowStatus,
  className = "",
  headerAction = null,
}) {
  const pKey = String(priority || "medium").toLowerCase();
  const pStyle = PRIORITY_STYLES[pKey] || PRIORITY_STYLES.medium;

  return (
    <article className={`ui-card overflow-hidden ${className}`.trim()}>
      <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border-muted)] bg-gradient-to-r from-[var(--color-primary-soft)] to-[var(--color-surface)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <ClipboardList className="h-4 w-4" strokeWidth={2} />
          </span>
          <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--color-primary)]">
            Job Card Summary
          </h3>
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </header>

      <div>
        <SummaryRow label="Job Card No." value={jobCardNo} />
        <SummaryRow label="Sales Order No." value={salesOrderNo} />
        <SummaryRow label="Customer" value={customer} />
        <SummaryRow label="Product" value={product} />
        <SummaryRow label="Order Quantity" value={fmtQty(orderQuantity, uom)} />
        <SummaryRow label="Required Delivery" value={requiredDelivery} />
        <SummaryRow label="Priority" isLast>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[11px] font-bold uppercase ${pStyle.className}`}
          >
            {pKey === "high" ? (
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />
            ) : null}
            {pStyle.label}
          </span>
        </SummaryRow>
      </div>
    </article>
  );
}

export { PRIORITY_STYLES, fmtQty as formatJobCardQty };
