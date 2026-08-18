import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const PIPELINE = [
  { key: "sales", label: "Sales Orders", status: "SALES_CONFIRMED" },
  { key: "material", label: "Material Check", status: "MATERIAL_CHECK_PENDING" },
  { key: "production", label: "Production", status: "READY_FOR_PRODUCTION" },
  { key: "qc", label: "QC Pending", status: "QUALITY_CHECK_PENDING" },
  { key: "packing", label: "Packing & Dispatch", status: "PACKING_PENDING" },
  { key: "billing", label: "Billing", status: "BILLING_PENDING" },
  { key: "completed", label: "Completed", status: "COMPLETED" },
];

export default function WorkflowStagePipeline({ currentStatus, counts = {}, onStageClick }) {
  const current = (currentStatus || "").toUpperCase();

  const isActive = (stage) => {
    if (!current) return stage.key === "sales";
    const stageStatuses = {
      sales: ["SALES_CONFIRMED", "DRAFT"],
      material: ["MATERIAL_CHECK_PENDING", "MATERIAL_AVAILABLE", "MATERIAL_SHORTAGE", "MATERIAL_PARTIAL"],
      production: [
        "READY_FOR_PRODUCTION",
        "PRODUCTION_ASSIGNED",
        "PRODUCTION_IN_PROGRESS",
        "PRODUCTION_COMPLETED",
        "PRODUCTION_REWORK",
      ],
      qc: ["QUALITY_CHECK_PENDING", "QUALITY_APPROVED", "QUALITY_REJECTED"],
      packing: ["PACKING_PENDING", "PACKING_IN_PROGRESS", "PACKED", "PACKING_ISSUE"],
      billing: ["BILLING_PENDING", "BILLING_HOLD", "INVOICED"],
      completed: ["COMPLETED"],
    };
    return (stageStatuses[stage.key] || []).includes(current);
  };

  const stageLinkClass = (active) =>
    `rounded-lg px-2 py-1 transition hover:bg-[var(--color-primary-soft)] ${
      active ? "bg-[var(--color-primary-soft)]" : ""
    }`;

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-xs">
      {PIPELINE.map((stage, idx) => {
        const active = isActive(stage);
        const count = counts[stage.status] ?? counts[stage.key] ?? 0;
        const inner = (
          <>
            <span
              className={
                active ? "font-bold text-[var(--color-primary)]" : "font-medium text-[var(--color-text-muted)]"
              }
            >
              {stage.label}
            </span>
            {count > 0 ? (
              <span className="ml-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {count}
              </span>
            ) : null}
          </>
        );
        return (
          <span key={stage.key} className="inline-flex items-center gap-1">
            {onStageClick ? (
              <button type="button" onClick={() => onStageClick(stage.status)} className={stageLinkClass(active)}>
                {inner}
              </button>
            ) : (
              <Link to={`/manufacturing/workflow?status=${stage.status}`} className={stageLinkClass(active)}>
                {inner}
              </Link>
            )}
            {idx < PIPELINE.length - 1 ? (
              <ArrowRight className="h-3 w-3 text-[var(--color-text-faint)]" aria-hidden />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
