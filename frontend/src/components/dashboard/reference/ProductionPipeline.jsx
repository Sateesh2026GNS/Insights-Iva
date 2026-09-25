import { useState } from "react";
import { useTranslation } from "react-i18next";

import ProductionPipelineDrawer from "./ProductionPipelineDrawer";
import "../../../styles/production-pipeline.css";

const STAGES = [
  {
    key: "pending",
    labelKey: "pipelinePending",
    defaultLabel: "Pending",
  },
  {
    key: "planned",
    labelKey: "pipelinePlanned",
    defaultLabel: "Planned",
  },
  {
    key: "in_production",
    labelKey: "pipelineInProduction",
    defaultLabel: "In Production",
  },
  {
    key: "qc",
    labelKey: "pipelineQc",
    defaultLabel: "QC",
  },
  {
    key: "completed",
    labelKey: "pipelineCompleted",
    defaultLabel: "Completed",
  },
];

function StageCount({ loading, unavailable, value }) {
  if (loading) {
    return <div className="production-pipeline__skeleton" aria-hidden />;
  }
  if (unavailable) {
    return <p className="production-pipeline__count production-pipeline__count--muted">—</p>;
  }
  return (
    <p className="production-pipeline__count tabular-nums">
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
          <h3 className="text-sm font-bold text-[#1e3a5f] sm:text-[15px] dark:text-[var(--color-text)]">
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
            <div className="production-pipeline">
              {STAGES.map((stage) => {
                const label = t(`refDashboard.${stage.labelKey}`, { defaultValue: stage.defaultLabel });
                const count = data?.[stage.key];
                const ariaLabel = unavailable
                  ? label
                  : `View ${count ?? 0} ${label} work orders`;

                return (
                  <button
                    key={stage.key}
                    type="button"
                    aria-label={ariaLabel}
                    disabled={unavailable}
                    onClick={() => setDrawerStage(stage.key)}
                    className={`production-pipeline__stage production-pipeline__stage--${stage.key}`}
                  >
                    <span className="production-pipeline__label">{label}</span>
                    <StageCount loading={loading} unavailable={unavailable} value={count} />
                  </button>
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
