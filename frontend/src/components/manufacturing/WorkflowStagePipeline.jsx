import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

/** Manufacturing workflow spine — aligned with backend workflow_status. */
export const WORKFLOW_PIPELINE_STEPS = [
  { key: "sales", label: "Sales Order", shortLabel: "Sales", status: "SALES_CONFIRMED", statuses: ["SALES_CONFIRMED"] },
  {
    key: "inventory",
    label: "Inventory Check",
    shortLabel: "Inventory",
    status: "MATERIAL_CHECK_PENDING",
    statuses: ["MATERIAL_CHECK_PENDING", "MATERIAL_SHORTAGE", "MATERIAL_PARTIAL"],
  },
  {
    key: "store",
    label: "Store Manager",
    shortLabel: "Store",
    status: "STORE_ISSUE_PENDING",
    statuses: ["MATERIAL_AVAILABLE", "STORE_ISSUE_PENDING", "STORE_ISSUE_PARTIAL"],
  },
  {
    key: "production",
    label: "Production Manager",
    shortLabel: "Prod. Mgr",
    status: "READY_FOR_PRODUCTION",
    statuses: ["READY_FOR_PRODUCTION", "PRODUCTION_REWORK", "WORKFLOW_ON_HOLD"],
  },
  {
    key: "operator",
    label: "Operator",
    shortLabel: "Operator",
    status: "PRODUCTION_ASSIGNED",
    statuses: ["PRODUCTION_ASSIGNED", "PRODUCTION_IN_PROGRESS", "PRODUCTION_COMPLETED"],
  },
  {
    key: "quality",
    label: "Quality",
    shortLabel: "Quality",
    status: "QUALITY_CHECK_PENDING",
    statuses: ["QUALITY_CHECK_PENDING", "QUALITY_ON_HOLD", "QUALITY_REJECTED", "QUALITY_APPROVED"],
  },
  {
    key: "packing",
    label: "Packing & Dispatch",
    shortLabel: "Packing",
    status: "PACKING_PENDING",
    statuses: ["PACKING_PENDING", "PACKING_IN_PROGRESS", "PACKED", "PACKING_ISSUE"],
  },
  {
    key: "billing",
    label: "Billing",
    shortLabel: "Billing",
    status: "BILLING_PENDING",
    statuses: ["BILLING_PENDING", "BILLING_HOLD", "INVOICED"],
  },
  { key: "completed", label: "Completed", shortLabel: "Done", status: "COMPLETED", statuses: ["COMPLETED"] },
];

function buildStatusMap() {
  const map = {};
  for (const stage of WORKFLOW_PIPELINE_STEPS) {
    map[stage.key] = stage.statuses || [stage.status];
  }
  return map;
}

const STAGE_STATUSES = buildStatusMap();
const STAGE_ORDER = WORKFLOW_PIPELINE_STEPS.map((s) => s.key);

function currentStageIndex(current) {
  if (!current) return 0;
  for (let i = 0; i < WORKFLOW_PIPELINE_STEPS.length; i += 1) {
    const stage = WORKFLOW_PIPELINE_STEPS[i];
    if ((STAGE_STATUSES[stage.key] || []).includes(current)) return i;
  }
  return 0;
}

export default function WorkflowStagePipeline({
  currentStatus,
  counts = {},
  countItems = [],
  onStageClick,
  compact = false,
}) {
  const current = (currentStatus || "").toUpperCase();
  const currentIdx = currentStageIndex(current);

  const countForStage = (stage) => {
    if (countItems?.length) {
      const match = countItems.find((c) => c.key === stage.key || c.statuses?.includes(stage.status));
      if (match) return match.count ?? 0;
    }
    let total = counts[stage.status] ?? counts[stage.key] ?? 0;
    for (const s of stage.statuses || []) {
      total += counts[s] ?? 0;
    }
    return total;
  };

  const stageState = (stage, index) => {
    if (index < currentIdx) return "completed";
    if (index === currentIdx) return "current";
    if (current === "MATERIAL_CHECK_PENDING" && stage.key === "store" && index === currentIdx + 1) {
      return "current";
    }
    return "upcoming";
  };

  const stageLinkClass = (state) => {
    if (state === "completed") {
      return "rounded-lg px-2 py-1.5 transition whitespace-nowrap bg-[var(--color-success-soft)]/60 ring-1 ring-[var(--color-success)]/20";
    }
    if (state === "current") {
      return "rounded-lg px-2 py-1.5 transition whitespace-nowrap bg-[var(--color-primary-soft)] ring-2 ring-[var(--color-primary)]/30 shadow-sm";
    }
    return "rounded-lg px-2 py-1.5 transition whitespace-nowrap text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]";
  };

  const labelClass = (state) => {
    if (state === "completed") return "font-semibold text-[var(--color-success)]";
    if (state === "current") return "font-bold text-[var(--color-primary)]";
    return "font-medium text-[var(--color-text-faint)]";
  };

  return (
    <div
      className={`overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] ${
        compact ? "px-2 py-2" : "px-3 py-2.5"
      }`}
    >
      <div className="flex min-w-max items-center gap-1 text-xs">
        {WORKFLOW_PIPELINE_STEPS.map((stage, idx) => {
          const state = stageState(stage, idx);
          const count = countForStage(stage);
          const label = compact ? stage.shortLabel : stage.label;
          const inner = (
            <span className={`inline-flex items-center gap-1 ${labelClass(state)}`}>
              {state === "completed" ? <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} /> : null}
              {label}
              {count > 0 ? (
                <span className="ml-0.5 rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {count}
                </span>
              ) : null}
            </span>
          );
          return (
            <span key={stage.key} className="inline-flex items-center gap-1">
              {onStageClick ? (
                <button type="button" onClick={() => onStageClick(stage.status)} className={stageLinkClass(state)}>
                  {inner}
                </button>
              ) : (
                <Link to={`/manufacturing/workflow?status=${stage.status}`} className={stageLinkClass(state)}>
                  {inner}
                </Link>
              )}
              {idx < WORKFLOW_PIPELINE_STEPS.length - 1 ? (
                <ArrowRight
                  className={`h-3 w-3 shrink-0 ${idx < currentIdx ? "text-[var(--color-success)]" : "text-[var(--color-text-faint)]"}`}
                  aria-hidden
                />
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export { STAGE_ORDER, STAGE_STATUSES };
