import {
  Check,
  ClipboardList,
  FileText,
  Flag,
  Package,
  Settings,
  ShieldCheck,
  Truck,
  User,
  Warehouse,
} from "lucide-react";

const STEP_ICONS = {
  sales_order: ClipboardList,
  sales_orders: ClipboardList,
  inventory_check: Package,
  store_manager: Warehouse,
  production_manager: Settings,
  operator: User,
  quality_check: ShieldCheck,
  packing_dispatch: Truck,
  billing: FileText,
  completed: Flag,
};

const STATE_STYLES = {
  completed: "bg-[var(--color-primary-soft)] text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/30",
  current: "bg-[var(--color-primary)] text-white shadow-sm ring-2 ring-[var(--color-primary)]/20",
  pending: "bg-[var(--color-surface-muted)] text-[var(--color-text-faint)] ring-1 ring-[var(--color-border)]",
  blocked: "bg-[var(--color-warning-soft)] text-[var(--color-warning)] ring-1 ring-[var(--color-warning)]/30",
  rejected: "bg-[var(--color-danger-soft)] text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/30",
};

/** 9-step workflow tracker with completed / current / pending / blocked / rejected states. */
export default function WorkflowTracker({ steps = [], currentStage = null }) {
  const stageLabel = currentStage?.stage_label || steps.find((s) => s.status === "current")?.label || "—";
  const stageHint = currentStage?.stage_hint || "Track progress across manufacturing stages.";

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

      <div className="px-2 py-4 sm:px-3">
        <div className="flex items-start justify-between gap-0 overflow-x-auto pb-1">
          {steps.map((step, idx) => {
            const state = step.status || "pending";
            const isCompleted = state === "completed";
            const Icon = STEP_ICONS[step.key] || ClipboardList;
            return (
              <div key={step.key} className="flex min-w-[3.5rem] flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  {idx > 0 ? (
                    <div
                      className={`h-0.5 flex-1 ${isCompleted || state === "current" ? "bg-[var(--color-primary)]/70" : "bg-[var(--color-border)]"}`}
                    />
                  ) : (
                    <div className="flex-1" />
                  )}
                  <span
                    className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${STATE_STYLES[state] || STATE_STYLES.pending}`}
                    title={step.label}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Icon className="h-3.5 w-3.5" strokeWidth={2} />}
                  </span>
                  {idx < steps.length - 1 ? (
                    <div className={`h-0.5 flex-1 ${isCompleted ? "bg-[var(--color-primary)]/70" : "bg-[var(--color-border)]"}`} />
                  ) : (
                    <div className="flex-1" />
                  )}
                </div>
                <p
                  className={`mt-1.5 max-w-[3.75rem] text-center text-[8px] font-semibold leading-tight sm:text-[9px] ${
                    state === "current"
                      ? "text-[var(--color-primary)]"
                      : isCompleted
                        ? "text-[var(--color-text)]"
                        : state === "rejected"
                          ? "text-[var(--color-danger)]"
                          : state === "blocked"
                            ? "text-[var(--color-warning)]"
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
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{stageHint}</p>
        </div>
      </div>
    </article>
  );
}
