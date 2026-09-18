import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";

import ProductionPipelineDrawer from "./ProductionPipelineDrawer";

const STAGES = [
  {
    key: "pending",
    labelKey: "pipelinePending",
    defaultLabel: "Pending",
    dotClass: "bg-[#cbd5e1]",
  },
  {
    key: "planned",
    labelKey: "pipelinePlanned",
    defaultLabel: "Planned",
    dotClass: "bg-[#cbd5e1]",
  },
  {
    key: "in_production",
    labelKey: "pipelineInProduction",
    defaultLabel: "In Production",
    dotClass: "bg-[#f59e0b]",
  },
  {
    key: "qc",
    labelKey: "pipelineQc",
    defaultLabel: "QC",
    dotClass: "bg-[#8b5cf6]",
  },
  {
    key: "completed",
    labelKey: "pipelineCompleted",
    defaultLabel: "Completed",
    dotClass: "bg-[#22c55e]",
  },
];

function StageCount({ loading, unavailable, value }) {
  if (loading) {
    return <div className="mx-auto mt-2 h-8 w-8 animate-pulse rounded bg-[var(--color-surface-muted)]" />;
  }
  if (unavailable) {
    return <p className="mt-1.5 text-lg font-bold text-[var(--color-text-muted)]">—</p>;
  }
  return (
    <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-[var(--color-text)] sm:text-[26px]">
      {value ?? 0}
    </p>
  );
}

/**
 * Horizontal work-order pipeline — live counts from GET /api/erp/dashboard → production_pipeline.
 */
export default function ProductionPipeline({
  data = null,
  loading = false,
  error = null,
  onRetry,
  refreshKey = 0,
}) {
  const { t } = useTranslation();
  const [drawerStage, setDrawerStage] = useState(null);
  const unavailable = Boolean(error) && !loading;

  return (
    <>
      <section className="ui-card overflow-hidden p-0">
        <div className="border-b border-[var(--color-border-soft)] px-4 py-3 sm:px-5">
          <h3 className="text-sm font-bold text-[#1e3a5f] sm:text-[15px]">
            {t("refDashboard.productionPipeline", { defaultValue: "Production Pipeline" })}
          </h3>
        </div>
        {unavailable ? (
          <div className="px-4 py-4 text-center sm:px-5">
            <p className="text-sm text-[var(--color-danger)]">
              {t("refDashboard.pipelineLoadError", {
                defaultValue: "Unable to load production pipeline.",
              })}
            </p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 text-sm font-semibold text-[var(--color-primary)] underline hover:no-underline"
              >
                {t("common.retry", { defaultValue: "Try Again" })}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto px-3 py-4 sm:px-5 sm:py-5">
            <div className="flex min-w-[520px] items-start justify-between">
              {STAGES.map((stage, index) => {
                const label = t(`refDashboard.${stage.labelKey}`, { defaultValue: stage.defaultLabel });
                const count = data?.[stage.key];
                const ariaLabel = unavailable
                  ? label
                  : `View ${count ?? 0} ${label} work orders`;

                return (
                  <div key={stage.key} className="flex min-w-0 flex-1 items-start justify-center">
                    <button
                      type="button"
                      aria-label={ariaLabel}
                      disabled={unavailable}
                      onClick={() => setDrawerStage(stage.key)}
                      className="group flex min-w-[4.5rem] cursor-pointer flex-col items-center rounded-lg px-1 text-center transition hover:bg-[var(--color-surface-muted)]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-muted)] sm:text-xs">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${stage.dotClass}`} aria-hidden />
                        {label}
                      </span>
                      <StageCount loading={loading} unavailable={unavailable} value={count} />
                    </button>
                    {index < STAGES.length - 1 ? (
                      <ChevronRight
                        className="mx-0.5 mt-1 h-4 w-4 shrink-0 text-[#cbd5e1] sm:mx-1"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <ProductionPipelineDrawer
        stage={drawerStage}
        open={Boolean(drawerStage)}
        onClose={() => setDrawerStage(null)}
        refreshKey={refreshKey}
      />
    </>
  );
}
