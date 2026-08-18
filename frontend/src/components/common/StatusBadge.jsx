import { resolveStatusTone } from "../../design-system/statusTone";

const TONE_CLASS = {
  success: "ui-badge-success",
  info: "ui-badge-info",
  progress: "ui-badge-progress",
  pending: "ui-badge-pending",
  primary: "ui-badge-pending",
  warning: "ui-badge-warning",
  danger: "ui-badge-danger",
  error: "ui-badge-error",
  neutral: "ui-badge-neutral",
};

/**
 * Shared status pill — use instead of ad-hoc color chips per page.
 * Pass `tone` directly, or `status` for automatic semantic mapping.
 */
export default function StatusBadge({ tone, status, children, className = "" }) {
  const resolved = tone || (status != null ? resolveStatusTone(status) : "neutral");
  const toneClass = TONE_CLASS[resolved] || TONE_CLASS.neutral;
  return <span className={`ui-badge ${toneClass} ${className}`.trim()}>{children}</span>;
}

export { resolveStatusTone };
