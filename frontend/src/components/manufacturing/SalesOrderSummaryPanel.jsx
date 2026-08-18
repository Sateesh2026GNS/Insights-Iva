import { ClipboardList } from "lucide-react";
import { PRIORITY_STYLES, formatJobCardQty } from "./JobCardSummary";

function SummaryRow({ label, value, isLast = false, children }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-4 py-3 ${
        isLast ? "" : "border-b border-[var(--color-border-muted)]"
      }`}
    >
      <span className="text-[13px] font-semibold text-[var(--color-text-muted)]">{label}</span>
      {children ?? (
        <span className="text-right text-[13px] font-semibold text-[var(--color-text)]">
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}

/** Right-column Sales Order Summary card (reference screenshot). */
export default function SalesOrderSummaryPanel({
  salesOrderNo,
  customer,
  product,
  orderQuantity,
  requiredDelivery,
  priority = "medium",
  uom = "Nos",
}) {
  const pKey = String(priority || "medium").toLowerCase();
  const pStyle = PRIORITY_STYLES[pKey] || PRIORITY_STYLES.medium;

  return (
    <article className="ui-card overflow-hidden">
      <header className="flex items-center gap-2.5 border-b border-[var(--color-border-muted)] bg-gradient-to-r from-[var(--color-primary-soft)] to-[var(--color-surface)] px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <ClipboardList className="h-4 w-4" strokeWidth={2} />
        </span>
        <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--color-primary)]">
          Sales Order Summary
        </h3>
      </header>
      <div>
        <SummaryRow label="Sales Order No." value={salesOrderNo} />
        <SummaryRow label="Customer" value={customer} />
        <SummaryRow label="Product" value={product} />
        <SummaryRow label="Order Quantity" value={formatJobCardQty(orderQuantity, uom)} />
        <SummaryRow label="Required Delivery" value={requiredDelivery} />
        <SummaryRow label="Priority" isLast>
          <span
            className={`rounded-full px-3 py-0.5 text-[11px] font-bold uppercase ${pStyle.className}`}
          >
            {pStyle.label}
          </span>
        </SummaryRow>
      </div>
    </article>
  );
}
