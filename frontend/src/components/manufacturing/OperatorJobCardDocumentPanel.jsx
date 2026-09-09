import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Download, Printer } from "lucide-react";

import Button from "../common/Button";
import CommonStatusBadge from "../common/StatusBadge";
import { ErrorState, LoadingState } from "../common/states";
import OperatorJobCardDocument from "./OperatorJobCardDocument";
import OperatorJobCardBody from "./OperatorJobCardBody";
import SalesJobCardDocument from "./SalesJobCardDocument";
import useSalesJobCardDocumentLoader from "../../hooks/useSalesJobCardDocumentLoader";
import useAuth from "../../hooks/useAuth";
import useTenantId from "../../hooks/useTenantId";
import { useToast } from "../../context/ToastContext";
import { getCompanySettings } from "../../api/settingsApi";
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
import { printSalesJobCardLandscape } from "../../utils/printUtils";

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
  showEmptyShell = false,
  emptyMessage = "Select a job card from the list below to open the Operator Job Card.",
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const tenantId = useTenantId();
  const resolvedOrderId = orderId ?? row?.sales_order_id ?? null;

  const [shellCompany, setShellCompany] = useState(null);
  const [operatorContext, setOperatorContext] = useState(null);
  const [operatorLoading, setOperatorLoading] = useState(false);
  const [operatorError, setOperatorError] = useState("");
  const [productionForm, setProductionForm] = useState(emptyProductionForm(null));
  const [submitting, setSubmitting] = useState(false);
  const [salesRefOpen, setSalesRefOpen] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(true);

  const {
    loading: soLoading,
    error: soError,
    card: soCard,
    form: soForm,
    salesOrder,
    customer,
    productLines,
    products,
    companyProfile,
    load: reloadSo,
    printPayload: soPrintPayload,
  } = useSalesJobCardDocumentLoader(resolvedOrderId, tenantId, Boolean(resolvedOrderId));

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

  useEffect(() => {
    let cancelled = false;
    getCompanySettings()
      .then((res) => {
        if (!cancelled) setShellCompany(res?.data?.data ?? res?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setShellCompany(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    await Promise.all([reloadSo(), loadOperator()]);
  }, [reloadSo, loadOperator]);

  const profile = companyProfile || shellCompany;
  const hasSelection = Boolean(resolvedOrderId);
  const loading = soLoading || operatorLoading;
  const error = soError || operatorError;
  const showDocument = Boolean(hasSelection && operatorContext && !loading && !error);
  const showEmptyLayout = showEmptyShell && !hasSelection;
  const workflowStatus = erpListStatus(operatorContext || row || {});

  const title =
    operatorContext?.card_number ||
    row?.job_card_no?.replace(/^JC-/i, "OP-") ||
    (resolvedOrderId ? `OP #${resolvedOrderId}` : "Operator Job Card");

  const woId = operatorContext?.execution?.work_order_id || operatorContext?.production_plan?.work_order_id;

  const saveOperatorProgress = async () => {
    if (!woId) return;
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
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not save progress"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (action) => {
    if (!woId) return;
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
      <link rel="stylesheet" href="${window.location.origin}/assets/index.css" />
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
            <Button
              variant="secondary"
              size="sm"
              disabled={!showDocument}
              onClick={handlePrint}
              leftIcon={<Download className="h-4 w-4" aria-hidden />}
            >
              Download PDF
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
              <OperatorJobCardDocument
                operatorContext={operatorContext}
                soCard={soCard}
                row={row}
                companyProfile={profile}
                assignedUser={user}
              />

              <section className="ui-card my-job-cards-page__execution-panel">
                <button
                  type="button"
                  className="my-job-cards-page__sales-ref-toggle"
                  onClick={() => setExecutionOpen((o) => !o)}
                  aria-expanded={executionOpen}
                >
                  <span>Production Execution</span>
                  {executionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {executionOpen ? (
                  <div className="my-job-cards-page__execution-body">
                    <OperatorJobCardBody
                      card={operatorContext}
                      form={productionForm}
                      onChange={(key, value) => setProductionForm((f) => ({ ...f, [key]: value }))}
                      submitting={submitting}
                      onAction={runAction}
                      onSaveProgress={saveOperatorProgress}
                    />
                  </div>
                ) : null}
              </section>
            </>
          ) : null}
        </div>
      </section>

      {showDocument ? (
        <section className="ui-card my-job-cards-page__sales-ref-panel">
          <button
            type="button"
            className="my-job-cards-page__sales-ref-toggle"
            onClick={() => setSalesRefOpen((o) => !o)}
            aria-expanded={salesRefOpen}
          >
            <span>Sales Job Card (Reference — Read Only)</span>
            {salesRefOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {salesRefOpen ? (
            <div className="my-job-cards-page__sales-ref-body">
              <div className="my-job-cards-page__sales-ref-toolbar">
                <span className="my-job-cards-page__read-only-badge">Sales information — read only</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => printSalesJobCardLandscape(soPrintPayload(), user)}
                  leftIcon={<Printer className="h-4 w-4" aria-hidden />}
                >
                  Print Sales JC
                </Button>
              </div>
              <SalesJobCardDocument
                card={soCard}
                form={soForm || soCard?.form || {}}
                salesOrder={salesOrder}
                customer={customer}
                productLines={productLines}
                products={products}
                details={soCard?.details}
                companyProfile={profile}
                editable={false}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
