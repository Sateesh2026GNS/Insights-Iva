import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Download, Printer } from "lucide-react";

import Button from "../common/Button";
import CommonStatusBadge from "../common/StatusBadge";
import { ErrorState, LoadingState } from "../common/states";
import { FormField, Select, Textarea } from "../common/FormField";
import QualityControlJobCardDocument from "./QualityControlJobCardDocument";
import SalesJobCardDocument from "./SalesJobCardDocument";
import JobCardActions from "./JobCardActions";
import useSalesJobCardDocumentLoader from "../../hooks/useSalesJobCardDocumentLoader";
import useAuth from "../../hooks/useAuth";
import useTenantId from "../../hooks/useTenantId";
import { useToast } from "../../context/ToastContext";
import { getCompanySettings } from "../../api/settingsApi";
import { getStageJobCard, submitQualityCheck } from "../../api/workflowApi";
import { apiErrorMessage } from "../../utils/apiError";
import { erpListStatus } from "../../utils/jobCardListStatus";
import { printSalesJobCardLandscape } from "../../utils/printUtils";

export default function QualityControlJobCardDocumentPanel({
  orderId = null,
  row = null,
  showEmptyShell = false,
  emptyMessage = "Select a job card from the list below to open the Quality Control Job Card.",
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const tenantId = useTenantId();
  const resolvedOrderId = orderId ?? row?.sales_order_id ?? null;

  const [shellCompany, setShellCompany] = useState(null);
  const [qualityContext, setQualityContext] = useState(null);
  const [operatorContext, setOperatorContext] = useState(null);
  const [stageLoading, setStageLoading] = useState(false);
  const [stageError, setStageError] = useState("");
  const [qualityForm, setQualityForm] = useState({ result: "pass", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [salesRefOpen, setSalesRefOpen] = useState(false);
  const [inspectionOpen, setInspectionOpen] = useState(true);

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

  const loadStages = useCallback(async () => {
    if (!resolvedOrderId) {
      setQualityContext(null);
      setOperatorContext(null);
      return;
    }
    setStageLoading(true);
    setStageError("");
    try {
      const [qualityRes, operatorRes] = await Promise.all([
        getStageJobCard(resolvedOrderId, "quality"),
        getStageJobCard(resolvedOrderId, "operator").catch(() => null),
      ]);
      const qualityData = qualityRes?.data ?? qualityRes;
      setQualityContext(qualityData);
      setOperatorContext(operatorRes?.data ?? operatorRes ?? null);
      setQualityForm({
        result: qualityData?.quality_result === "fail" ? "fail" : qualityData?.quality_result === "hold" ? "hold" : "pass",
        notes: qualityData?.inspection_parameters?.[0]?.remarks || "",
      });
    } catch (err) {
      setQualityContext(null);
      setOperatorContext(null);
      setStageError(apiErrorMessage(err, "Could not load quality job card."));
    } finally {
      setStageLoading(false);
    }
  }, [resolvedOrderId]);

  useEffect(() => {
    loadStages();
  }, [loadStages]);

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
    await Promise.all([reloadSo(), loadStages()]);
  }, [reloadSo, loadStages]);

  const profile = companyProfile || shellCompany;
  const hasSelection = Boolean(resolvedOrderId);
  const loading = soLoading || stageLoading;
  const error = soError || stageError;
  const showDocument = Boolean(hasSelection && qualityContext && !loading && !error);
  const showEmptyLayout = showEmptyShell && !hasSelection;
  const workflowStatus = erpListStatus(qualityContext || row || {});

  const title =
    qualityContext?.card_number ||
    row?.job_card_no?.replace(/^JC-/i, "QC-") ||
    (resolvedOrderId ? `QC #${resolvedOrderId}` : "Quality Control Job Card");

  const inspectionId = qualityContext?.inspection_id;

  const runQualityAction = async (action) => {
    if (!inspectionId) {
      addToast("Quality inspection record not found for this order.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const resultMap = {
        approve: "pass",
        reject: "fail",
        hold: "hold",
        send_back_to_production: "fail",
      };
      await submitQualityCheck(inspectionId, {
        result: resultMap[action] || qualityForm.result,
        notes: qualityForm.notes,
      });
      if (action === "approve") {
        addToast("Quality approved. Advanced to Packing & Dispatch.", "success");
      } else if (action === "reject") {
        addToast("Quality rejected.", "success");
      } else if (action === "send_back_to_production") {
        addToast("Sent back to production for rework.", "success");
      } else {
        addToast("Quality check updated.", "success");
      }
      await reload();
    } catch (err) {
      addToast(apiErrorMessage(err, "Quality action failed."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    const el = document.getElementById("quality-control-job-card-document");
    if (!el) return;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Quality Control Job Card</title>
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
        className="ui-card my-job-cards-page__document-panel my-job-cards-page__document-panel--quality"
        id="quality-control-job-card-panel"
      >
        <div className="my-job-cards-page__document-toolbar">
          <div className="my-job-cards-page__document-toolbar-main">
            <div className="my-job-cards-page__document-toolbar-titles">
              <h2 className="my-job-cards-page__document-title">Quality Control Job Card</h2>
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
              <QualityControlJobCardDocument companyProfile={profile} assignedUser={user} />
              <p className="my-job-cards-page__document-empty-msg" role="status">{emptyMessage}</p>
            </>
          ) : null}

          {hasSelection && loading ? (
            <LoadingState label="Loading quality job card…" description="" compact className="py-12" />
          ) : null}

          {hasSelection && error ? (
            <ErrorState title="Could not load job card" description={error} onRetry={reload} className="py-10" />
          ) : null}

          {showDocument ? (
            <>
              <QualityControlJobCardDocument
                qualityContext={qualityContext}
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
                  onClick={() => setInspectionOpen((o) => !o)}
                  aria-expanded={inspectionOpen}
                >
                  <span>Quality Inspection</span>
                  {inspectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {inspectionOpen ? (
                  <div className="my-job-cards-page__execution-body">
                    <div className="grid gap-4 p-4 sm:grid-cols-2">
                      <FormField label="Result">
                        <Select
                          value={qualityForm.result}
                          onChange={(e) => setQualityForm((f) => ({ ...f, result: e.target.value }))}
                          disabled={!qualityContext?.editable}
                        >
                          <option value="pass">Pass</option>
                          <option value="fail">Fail</option>
                          <option value="hold">Hold</option>
                        </Select>
                      </FormField>
                      <FormField label="Remarks" className="sm:col-span-2">
                        <Textarea
                          rows={3}
                          value={qualityForm.notes}
                          onChange={(e) => setQualityForm((f) => ({ ...f, notes: e.target.value }))}
                          disabled={!qualityContext?.editable}
                        />
                      </FormField>
                    </div>
                    <JobCardActions
                      actions={qualityContext?.allowed_actions}
                      loading={submitting}
                      onAction={runQualityAction}
                      labels={{
                        approve: "Approve Quality",
                        reject: "Reject",
                        send_back_to_production: "Send for Rework",
                      }}
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
