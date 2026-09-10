import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";

const STAGES = [
  {
    key: "pending",
    labelKey: "pipelinePending",
    defaultLabel: "Pending",
    dotClass: "bg-[#cbd5e1]",
    to: "/production/work-orders?view=pending",
  },
  {
    key: "planned",
    labelKey: "pipelinePlanned",
    defaultLabel: "Planned",
    dotClass: "bg-[#cbd5e1]",
    to: "/production/work-orders",
  },
  {
    key: "released",
    labelKey: "pipelineReleased",
    defaultLabel: "Released",
    dotClass: "bg-[#3b82f6]",
    to: "/production/work-orders",
  },
  {
    key: "in_production",
    labelKey: "pipelineInProduction",
    defaultLabel: "In Production",
    dotClass: "bg-[#f59e0b]",
    to: "/production/work-orders",
  },
  {
    key: "completed",
    labelKey: "pipelineCompleted",
    defaultLabel: "Completed",
    dotClass: "bg-[#22c55e]",
    to: "/production/work-orders",
  },
];

function StageCount({ loading, value }) {
  if (loading) {
    return <div className="mx-auto mt-2 h-8 w-8 animate-pulse rounded bg-[var(--color-surface-muted)]" />;
  }
  return (
    <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-[var(--color-text)] sm:text-[26px]">
      {value ?? 0}
    </p>
  );
}

/**
 * Horizontal work-order pipeline — live counts from GET /api/erp/dashboard.
 */
export default function ProductionPipeline({ data = null, loading = false }) {
  const { t } = useTranslation();

  return (
    <section className="ui-card overflow-hidden p-0">
      <div className="border-b border-[var(--color-border-soft)] px-4 py-3 sm:px-5">
        <h3 className="text-sm font-bold text-[#1e3a5f] sm:text-[15px]">
          {t("refDashboard.productionPipeline", { defaultValue: "Production Pipeline" })}
        </h3>
      </div>
      <div className="overflow-x-auto px-3 py-4 sm:px-5 sm:py-5">
        <div className="flex min-w-[520px] items-start justify-between">
          {STAGES.map((stage, index) => (
            <div key={stage.key} className="flex min-w-0 flex-1 items-start justify-center">
              <Link
                to={stage.to}
                className="group flex min-w-[4.5rem] flex-col items-center text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 rounded-lg px-1"
              >
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-muted)] sm:text-xs">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${stage.dotClass}`}
                    aria-hidden
                  />
                  {t(`refDashboard.${stage.labelKey}`, {
                    defaultValue: stage.defaultLabel,
                  })}
                </span>
                <StageCount loading={loading} value={data?.[stage.key]} />
              </Link>
              {index < STAGES.length - 1 ? (
                <ChevronRight
                  className="mx-0.5 mt-1 h-4 w-4 shrink-0 text-[#cbd5e1] sm:mx-1"
                  aria-hidden
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
