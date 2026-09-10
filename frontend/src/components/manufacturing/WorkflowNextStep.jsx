import { AlertTriangle, ArrowRight, CheckCircle2, Info } from "lucide-react";

import Button from "../common/Button";
import CommonStatusBadge from "../common/StatusBadge";

const TONE_CONFIG = {
  success: {
    icon: CheckCircle2,
    border: "var(--color-success)",
    bg: "var(--color-success-soft)",
    text: "var(--color-success)",
  },
  warning: {
    icon: AlertTriangle,
    border: "var(--color-warning, #d97706)",
    bg: "color-mix(in srgb, var(--color-warning, #d97706) 12%, white)",
    text: "var(--color-warning, #b45309)",
  },
  info: {
    icon: Info,
    border: "var(--color-primary)",
    bg: "var(--color-primary-soft)",
    text: "var(--color-primary)",
  },
};

/**
 * Inline workflow guidance: what happened, current status, and what to do next.
 * Designed for ERP users — not decorative.
 */
export default function WorkflowNextStep({
  tone = "info",
  title,
  statusLabel,
  message,
  nextStep,
  actionLabel,
  onAction,
  scrollToId,
  className = "",
  compact = false,
}) {
  if (!title && !message && !nextStep) return null;

  const cfg = TONE_CONFIG[tone] || TONE_CONFIG.info;
  const Icon = cfg.icon;

  const handleAction = () => {
    if (scrollToId) {
      document.getElementById(scrollToId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    onAction?.();
  };

  return (
    <aside
      className={`workflow-next-step workflow-next-step--${tone} ${compact ? "workflow-next-step--compact" : ""} ${className}`}
      role="status"
      aria-live="polite"
      style={{
        borderColor: cfg.border,
        background: cfg.bg,
      }}
    >
      <div className="workflow-next-step__header">
        <Icon className="workflow-next-step__icon" style={{ color: cfg.text }} aria-hidden />
        <div className="workflow-next-step__titles">
          {title ? <h3 className="workflow-next-step__title">{title}</h3> : null}
          {statusLabel ? (
            <CommonStatusBadge tone={tone === "success" ? "success" : tone === "warning" ? "warning" : "info"}>
              {statusLabel}
            </CommonStatusBadge>
          ) : null}
        </div>
      </div>

      {message ? <p className="workflow-next-step__message">{message}</p> : null}

      {nextStep ? (
        <div className="workflow-next-step__next">
          <span className="workflow-next-step__next-label">Next step</span>
          <p className="workflow-next-step__next-text">{nextStep}</p>
        </div>
      ) : null}

      {actionLabel && (onAction || scrollToId) ? (
        <div className="workflow-next-step__actions">
          <Button variant="primary" size="sm" onClick={handleAction} rightIcon={<ArrowRight className="h-4 w-4" />}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
