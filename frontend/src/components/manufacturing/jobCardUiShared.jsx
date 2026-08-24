import { CheckCircle2, ClipboardList } from "lucide-react";

import RowActionMenu from "../common/RowActionMenu";
import CommonStatusBadge from "../common/StatusBadge";
import { PRIORITY_STYLES } from "./JobCardSummary";
import { getWorkflowStatusLabel, getWorkflowStatusVariant } from "../../config/workflowStages";

export const PAGE_BG = "var(--color-bg)";
export const NOTES_MAX = 500;

export const JOB_CARD_WORKFLOW_STEPS = [
  { key: "sales_orders", label: "Sales Order", status: "current" },
  { key: "inventory_check", label: "Inventory Check", status: "pending" },
  { key: "store_manager", label: "Store Manager", status: "pending" },
  { key: "production_manager", label: "Production Manager", status: "pending" },
  { key: "operator", label: "Operator", status: "pending" },
  { key: "quality_check", label: "Quality Check", status: "pending" },
  { key: "packing_dispatch", label: "Packing & Dispatch", status: "pending" },
  { key: "billing", label: "Billing", status: "pending" },
  { key: "completed", label: "Completed", status: "pending" },
];

export function fmtDeliveryDisplay(iso) {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function CardSectionHeader({ title }) {
  return (
    <header className="flex items-center gap-2.5 border-b border-[var(--color-border-muted)] bg-gradient-to-r from-[var(--color-primary-soft)] to-[var(--color-surface)] px-4 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
        <ClipboardList className="h-4 w-4" strokeWidth={2} />
      </span>
      <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--color-primary)]">{title}</h3>
    </header>
  );
}

export function StatusBadgeLegacy({ label = "Draft", variant = "draft" }) {
  const styles =
    variant === "confirmed"
      ? "border-[color-mix(in_srgb,var(--color-success)_25%,transparent)] bg-[var(--color-success-soft)] text-[var(--color-success)]"
      : "border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]";
  const iconClass = variant === "confirmed" ? "text-[var(--color-success)]" : "text-[var(--color-text-faint)]";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${styles}`}>
      <CheckCircle2 className={`h-3.5 w-3.5 ${iconClass}`} aria-hidden />
      {label}
    </span>
  );
}

/** Legacy pill badge for sales job card pages. */
export { StatusBadgeLegacy as StatusBadge };

export function WorkflowStatusBadge({ status, label, variant }) {
  const resolvedLabel = label || getWorkflowStatusLabel(status);
  const tone = variant || getWorkflowStatusVariant(status);
  return <CommonStatusBadge tone={tone}>{resolvedLabel}</CommonStatusBadge>;
}

export function PriorityBadge({ priority, showDot = true }) {
  const key = String(priority || "medium").toLowerCase();
  const style = PRIORITY_STYLES[key] || PRIORITY_STYLES.medium;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${style.className}`}
    >
      {showDot && key === "high" ? (
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />
      ) : null}
      {style.label}
    </span>
  );
}

/** Three-dot header menu — matches reference (circular trigger, icon menu items). */
export function JobCardPageMoreMenu({ items = [], menuId = "job-card-page-more", variant = "pill" }) {
  const visible = (items || []).filter(Boolean);
  if (!visible.length) return null;

  const wrapClass =
    variant === "pill"
      ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-hover)]"
      : "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm";

  return (
    <div className={wrapClass}>
      <RowActionMenu rowId={menuId} items={visible} />
    </div>
  );
}
