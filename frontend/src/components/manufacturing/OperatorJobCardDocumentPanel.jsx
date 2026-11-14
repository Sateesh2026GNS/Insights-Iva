import { useCallback, useEffect, useState } from "react";
import { Printer } from "lucide-react";

import Button from "../common/Button";
import CommonStatusBadge from "../common/StatusBadge";
import { ErrorState, LoadingState } from "../common/states";
import OperatorJobCardDocument from "./OperatorJobCardDocument";
import OperatorJobCardBody from "./OperatorJobCardBody";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";
import {
  completeProduction,
  getStageJobCard,
  pauseProduction,
  resumeProduction,
  startProduction,
  updateProductionProgress,
} from "../../api/workflowApi";
import { apiErrorMessage } from "../../utils/apiError";
import { erpListStatus } from "../../utils/jobCardListStatus";
import { getJobCardWorkflowGuidance } from "../../utils/jobCardWorkflowUx";
import WorkflowNextStep from "./WorkflowNextStep";

function emptyProductionForm(card) {
  const ex = card?.execution || {};
  return {
    produced_qty: ex.produced_qty ?? ex.completed_qty ?? "",
    rejected_qty: ex.rejected_qty ?? "",
    rework_qty: ex.rework_qty ?? "",
    notes: ex.operator_remarks ?? "",
    actual_start_time: "",
    actual_end_time: "",
  };
}

export default function OperatorJobCardDocumentPanel({
  orderId = null,
  row = null,
  onQueueRefresh,
  showEmptyShell = false,
  emptyMessage = "Select a job card from the list below to open the Operator Job Card.",
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const resolvedOrderId = orderId ?? row?.sales_order_id ?? null;

  const [operatorContext, setOperatorContext] = useState(null);
  const [operatorLoading, setOperatorLoading] = useState(false);
  const [operatorError, setOperatorError] = useState("");
  const [productionForm, setProductionForm] = useState(emptyProductionForm(null));
  const [submitting, setSubmitting] = useState(false);

  const loadOperator = useCallback(async () => {
    if (!resolvedOrderId) {
      setOperatorContext(null);
      return;
    }
    setOperatorLoading(true);
    setOperatorError("");
    try {
      const res = await getStageJobCard(resolvedOrderId, "operator");
      const data = res?.data ?? res;
      setOperatorContext(data);
      setProductionForm(emptyProductionForm(data));
    } catch (err) {
      setOperatorContext(null);
      setOperatorError(apiErrorMessage(err, "Could not load operator job card."));
    } finally {
      setOperatorLoading(false);
    }
  }, [resolvedOrderId]);

  useEffect(() => {
    loadOperator();
  }, [loadOperator]);

  const reload = useCallback(async () => {
    await loadOperator();
  }, [loadOperator]);

  const profile = user?.tenant_name || user?.company_name
    ? { company_name: user.tenant_name || user.company_name }
    : null;
  const hasSelection = Boolean(resolvedOrderId);
  const loading = operatorLoading;
  const error = operatorError;
  const showDocument = Boolean(hasSelection && operatorContext && !loading && !error);
  const showEmptyLayout = showEmptyShell && !hasSelection;
  const workflowStatus = erpListStatus(operatorContext || row || {});
  const guidance = getJobCardWorkflowGuidance({
    card: operatorContext,
    row,
    operatorMode: true,
  });

  const title =
    operatorContext?.card_number ||
    row?.job_card_no?.replace(/^JC-/i, "OP-") ||
    (resolvedOrderId ? `OP #${resolvedOrderId}` : "Operator Job Card");

  const woId = operatorContext?.execution?.work_order_id || operatorContext?.production_plan?.work_order_id;

  const saveOperatorProgress = async () => {
    if (!woId || submitting) return;
    setSubmitting(true);
    try {
      await updateProductionProgress(woId, {
        produced_qty: productionForm.produced_qty ? Number(productionForm.produced_qty) : undefined,
        rejected_qty: productionForm.rejected_qty ? Number(productionForm.rejected_qty) : undefined,
        rework_qty: productionForm.rework_qty ? Number(productionForm.rework_qty) : undefined,
        notes: productionForm.notes,
        actual_start_time: productionForm.actual_start_time || undefined,
        actual_end_time: productionForm.actual_end_time || undefined,
      });
      addToast("Production progress saved", "success");
      await reload();
      await onQueueRefresh?.();
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not save progress"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (action) => {
    if (!woId || submitting) return;
    const allowed = new Set(operatorContext?.allowed_actions || []);
    if (!allowed.has(action)) return;
    setSubmitting(true);
    try {
      if (action === "start_work") {
        await startProduction(woId);
        addToast("Production started", "success");
      } else if (action === "pause") {
        await pauseProduction(woId);
        addToast("Production paused", "success");
      } else if (action === "resume") {
        await resumeProduction(woId);
        addToast("Production resumed", "success");
      } else if (action === "complete_production") {
        await completeProduction(woId, {
          produced_qty: productionForm.produced_qty ? Number(productionForm.produced_qty) : undefined,
          rejected_qty: productionForm.rejected_qty ? Number(productionForm.rejected_qty) : undefined,
          rework_qty: productionForm.rework_qty ? Number(productionForm.rework_qty) : undefined,
          notes: productionForm.notes,
        });
        addToast("Production completed. Sent to Quality Check.", "success");
      }
      await reload();
      await onQueueRefresh?.();
    } catch (err) {
      addToast(apiErrorMessage(err, "Action failed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    const el = document.getElementById("operator-job-card-document");
    if (!el) return;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Operator Job Card</title>
      ${Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((node) => node.outerHTML).join('\n')}
      <style>body{margin:0;padding:12px;} @page{size:landscape;margin:10mm;}</style>
      </head><body>${el.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="my-job-cards-page__store-panels">
      <section
        className="ui-card my-job-cards-page__document-panel my-job-cards-page__document-panel--operator"
        id="operator-job-card-panel"
      >
        <div className="my-job-cards-page__document-toolbar">
          <div className="my-job-cards-page__document-toolbar-main">
            <div className="my-job-cards-page__document-toolbar-titles">
              <h2 className="my-job-cards-page__document-title">Operator Job Card</h2>
              {hasSelection ? (
                <p className="my-job-cards-page__document-subtitle">
                  <span className="my-job-cards-page__document-jc-no">{title}</span>
                  {row?.customer_name ? <span> · {row.customer_name}</span> : null}
                </p>
              ) : null}
            </div>
            {hasSelection && workflowStatus?.label ? (
              <CommonStatusBadge tone={workflowStatus.tone} className="my-job-cards-page__document-status">
                {workflowStatus.label}
              </CommonStatusBadge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!showDocument}
              onClick={handlePrint}
              leftIcon={<Printer className="h-4 w-4" aria-hidden />}
            >
              Print
            </Button>
          </div>
        </div>

        <div className="my-job-cards-page__document-body">
          {showEmptyLayout ? (
            <>
              <OperatorJobCardDocument companyProfile={profile} assignedUser={user} />
              <p className="my-job-cards-page__document-empty-msg" role="status">{emptyMessage}</p>
            </>
          ) : null}

          {hasSelection && loading ? (
            <LoadingState label="Loading operator job card…" description="" compact className="py-12" />
          ) : null}

          {hasSelection && error ? (
            <ErrorState title="Could not load job card" description={error} onRetry={reload} className="py-10" />
          ) : null}

          {showDocument ? (
            <>
              {guidance ? (
                <WorkflowNextStep
                  tone={guidance.tone}
                  title={guidance.title}
                  statusLabel={guidance.statusLabel}
                  message={guidance.message}
                  nextStep={guidance.nextStep}
                  actionLabel={guidance.actionLabel}
                  scrollToId={guidance.scrollToId}
                  className="mb-4"
                />
              ) : null}
              <OperatorJobCardBody
                card={operatorContext}
                form={productionForm}
                onChange={(key, value) => setProductionForm((f) => ({ ...f, [key]: value }))}
                submitting={submitting}
                onAction={runAction}
                onSaveProgress={saveOperatorProgress}
              />

              <details className="op-job-print">
                <summary>Printable job card</summary>
                <OperatorJobCardDocument
                  operatorContext={operatorContext}
                  row={row}
                  companyProfile={profile}
                  assignedUser={user}
                />
              </details>
            </>
          ) : null}
        </div>
      </section>

    </div>
  );
}
