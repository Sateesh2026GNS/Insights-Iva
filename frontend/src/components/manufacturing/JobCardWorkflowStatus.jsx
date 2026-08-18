import {
  Check,
  ClipboardList,
  FileText,
  Flag,
  Package,
  Settings,
  ShieldCheck,
  Truck,
} from "lucide-react";

const STEP_ICONS = {
  sales_orders: ClipboardList,
  inventory_check: Package,
  production: Settings,
  quality_check: ShieldCheck,
  packing_dispatch: Truck,
  billing: FileText,
  completed: Flag,
};

/**
 * Horizontal workflow progress — matches Sales Order Job Card reference screenshot.
 */
export default function JobCardWorkflowStatus({
  steps = [],
  currentStage = null,
}) {
  const stageLabel = currentStage?.stage_label || "Sales Orders";
  const stageHint = currentStage?.stage_hint || "Waiting for inventory check.";

  return (
    <article className="ui-card overflow-hidden">
      <header className="flex items-center gap-2.5 border-b border-[var(--color-border-muted)] bg-gradient-to-r from-[var(--color-primary-soft)] to-[var(--color-surface)] px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <ClipboardList className="h-4 w-4" strokeWidth={2} />
        </span>
        <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--color-primary)]">
          Workflow Status
        </h3>
      </header>

      <div className="px-3 py-4 sm:px-4">
        <div className="flex items-start justify-between gap-0.5 overflow-x-auto pb-1">
          {steps.map((step, idx) => {
            const isCurrent = step.status === "current";
            const isCompleted = step.status === "completed";
            const Icon = STEP_ICONS[step.key] || ClipboardList;
            return (
              <div key={step.key} className="flex min-w-[4.25rem] flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  {idx > 0 ? (
                    <div
                      className={`h-0.5 flex-1 ${
                        isCompleted || isCurrent ? "bg-[var(--color-primary)]/70" : "bg-[var(--color-border)]"
                      }`}
                    />
                  ) : (
                    <div className="flex-1" />
                  )}
                  <span
                    className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      isCurrent
                        ? "bg-[var(--color-primary)] text-white shadow-sm ring-2 ring-[var(--color-primary)]/20"
                        : isCompleted
                          ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/30"
                          : "bg-[var(--color-surface-muted)] text-[var(--color-text-faint)] ring-1 ring-[var(--color-border)]"
                    }`}
                  >
                    {isCompleted && !isCurrent ? (
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                    ) : (
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    )}
                  </span>
                  {idx < steps.length - 1 ? (
                    <div
                      className={`h-0.5 flex-1 ${
                        isCompleted ? "bg-[var(--color-primary)]/70" : "bg-[var(--color-border)]"
                      }`}
                    />
                  ) : (
                    <div className="flex-1" />
                  )}
                </div>
                <p
                  className={`mt-2 max-w-[4.5rem] text-center text-[9px] font-semibold leading-tight sm:text-[10px] ${
                    isCurrent
                      ? "text-[var(--color-primary)]"
                      : isCompleted
                        ? "text-[var(--color-text)]"
                        : "text-[var(--color-text-faint)]"
                  }`}
                >
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--color-primary)_15%,transparent)] bg-[var(--color-primary-soft)]/80 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)]">Current Stage</p>
          <p className="mt-0.5 text-sm font-bold text-[var(--color-text)]">{stageLabel}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary)]" aria-hidden />
            {stageHint.replace(/\.$/, "")}
          </p>
        </div>
      </div>
    </article>
  );
}
