/** Infer action tone from menu item label for consistent row-action coloring. */
export function resolveRowActionTone(label, { danger = false } = {}) {
  const lower = String(label || "").toLowerCase();
  if (
    danger ||
    lower.includes("delete") ||
    lower.includes("remove") ||
    lower.includes("reject") ||
    lower.includes("sign out") ||
    lower.includes("cancelled")
  ) {
    return "danger";
  }
  if (
    lower.includes("edit") ||
    lower.includes("update") ||
    lower.includes("modify")
  ) {
    return "edit";
  }
  if (
    lower.includes("view") ||
    lower.includes("open") ||
    lower.includes("approve") ||
    lower.includes("confirm") ||
    lower.includes("details")
  ) {
    return "view";
  }
  if (
    lower.includes("warning") ||
    lower.includes("pending") ||
    lower.includes("hold") ||
    lower.includes("review")
  ) {
    return "warning";
  }
  return "neutral";
}

const TONE_CLASS = {
  view: "text-[var(--color-action-view)] hover:bg-[var(--color-action-view-soft)]",
  edit: "text-[var(--color-action-edit)] hover:bg-[var(--color-action-edit-soft)]",
  danger: "text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]",
  warning: "text-[var(--color-warning)] hover:bg-[var(--color-warning-soft)]",
  neutral: "text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]",
};

export function rowActionMenuItemClass(label, options = {}) {
  const tone = resolveRowActionTone(label, options);
  return `flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)] ${TONE_CLASS[tone]}`;
}
