import { ArrowLeft } from "lucide-react";

import Button from "../common/Button";
import { PriorityBadge, WorkflowStatusBadge } from "./jobCardUiShared";

/**
 * Unified job card page header — used across all stage and sales job cards.
 */
export default function JobCardHeader({
  title,
  jobCardNo,
  salesOrderNo,
  priority,
  workflowStatus,
  statusLabel,
  statusVariant,
  backTo = "/production/work-orders",
  onBack,
  actions,
}) {
  const displayStatus = statusLabel || workflowStatus;

  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border-soft)] pb-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Button variant="ghost" size="sm" className="mt-0.5 shrink-0" onClick={onBack} to={backTo}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="ui-page-title">{title}</h1>
            <PriorityBadge priority={priority} />
            {displayStatus ? (
              <WorkflowStatusBadge status={workflowStatus} label={statusLabel} variant={statusVariant} />
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {jobCardNo ? `${jobCardNo}` : "Job Card"}
            {salesOrderNo ? ` · SO ${salesOrderNo}` : ""}
          </p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
