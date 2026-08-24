import { Link } from "react-router-dom";

import Button from "../common/Button";
import JobCardHeader from "./JobCardHeader";
import JobCardSummary from "./JobCardSummary";
import JobCardTimeline from "./JobCardTimeline";
import WorkflowTracker from "./WorkflowTracker";
import { getStageNavLinks } from "../../config/workflowStages";
import { getWorkflowStatusLabel } from "../../config/workflowStages";

/**
 * Shared shell for all workflow stage job cards.
 */
export default function JobCardLayout({
  title,
  stageLabel,
  card,
  loading,
  saving,
  editable,
  onSave,
  onBack,
  backTo = "/manufacturing/workflow",
  statusLabel,
  statusVariant,
  headerActions,
  children,
  sidebarExtra,
  hideSummary = false,
  currentStage,
  variant = "stage",
  showStageNav = true,
  summaryOverrides = null,
}) {
  if (loading) {
    return (
      <div className="ui-page flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-muted)]">Loading job card…</p>
      </div>
    );
  }
  if (!card) {
    return (
      <div className="ui-page ui-stack">
        <p className="text-sm text-[var(--color-danger)]">Job card not found.</p>
        <Button variant="outline" to={backTo}>
          Back to workflow
        </Button>
      </div>
    );
  }

  const summary = { ...(card.summary_panel || {}), ...(summaryOverrides || {}) };
  const tracker = card.workflow_tracker || card.workflow_steps || [];
  const timeline = card.timeline || [];
  const ws = summary.workflow_status || card.workflow_status;
  const isSales = variant === "sales";

  return (
    <div className="ui-page ui-stack pb-8">
      <JobCardHeader
        title={title || stageLabel || "Job Card"}
        jobCardNo={summary.job_card_no}
        salesOrderNo={summary.sales_order_no}
        priority={summary.priority || card.priority}
        workflowStatus={ws}
        statusLabel={statusLabel || getWorkflowStatusLabel(ws)}
        statusVariant={statusVariant}
        backTo={backTo}
        onBack={onBack}
        actions={
          headerActions ?? (
            <>
              {editable && onSave ? (
                <Button variant="primary" size="sm" loading={saving} onClick={onSave}>
                  Save
                </Button>
              ) : null}
              {!isSales && card.sales_order_id ? (
                <Button variant="outline" size="sm" to={`/sales/orders/${card.sales_order_id}/job-card`}>
                  Sales Job Card
                </Button>
              ) : null}
            </>
          )
        }
      />

      {showStageNav && currentStage && card.sales_order_id ? (
        <StageNavLinks orderId={card.sales_order_id} currentStage={currentStage} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        <div className="ui-stack min-w-0">
          {!hideSummary ? (
            <JobCardSummary
              jobCardNo={summary.job_card_no}
              salesOrderNo={summary.sales_order_no}
              customer={summary.customer}
              product={summary.product}
              orderQuantity={summary.order_quantity}
              requiredDelivery={summary.required_delivery}
              priority={summary.priority}
              uom={summary.uom}
              workflowStatus={ws}
            />
          ) : null}
          {children}
        </div>
        <aside className="ui-stack">
          <WorkflowTracker steps={tracker} currentStage={card.workflow_current_stage} />
          {sidebarExtra}
          {timeline.length > 0 ? <JobCardTimeline events={timeline} /> : null}
        </aside>
      </div>
    </div>
  );
}

export function StageNavLinks({ orderId, currentStage }) {
  const stages = getStageNavLinks(orderId);
  return (
    <nav className="flex flex-wrap gap-1.5 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/30 p-2" aria-label="Stage navigation">
      {stages.map((s) => (
        <Link
          key={s.key}
          to={s.path}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            currentStage === s.key
              ? "bg-[var(--color-primary)] text-white shadow-sm"
              : "bg-white text-[var(--color-text-muted)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
          }`}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
