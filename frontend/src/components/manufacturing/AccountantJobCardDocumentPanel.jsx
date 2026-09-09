import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Download, Printer } from "lucide-react";

import Button from "../common/Button";
import CommonStatusBadge from "../common/StatusBadge";
import { ErrorState, LoadingState } from "../common/states";
import AccountantJobCardDocument from "./AccountantJobCardDocument";
import SalesJobCardDocument from "./SalesJobCardDocument";
import JobCardActions from "./JobCardActions";
import useSalesJobCardDocumentLoader from "../../hooks/useSalesJobCardDocumentLoader";
import useAuth from "../../hooks/useAuth";
import useTenantId from "../../hooks/useTenantId";
import { useToast } from "../../context/ToastContext";
import { getCompanySettings } from "../../api/settingsApi";
import { createBillingInvoice, getManualJobCard, getStageJobCard } from "../../api/workflowApi";
import { apiErrorMessage } from "../../utils/apiError";
import { erpListStatus } from "../../utils/jobCardListStatus";
import { printSalesJobCardLandscape } from "../../utils/printUtils";

export default function AccountantJobCardDocumentPanel({
  orderId = null,
  jobCardId = null,
  row = null,
  showEmptyShell = false,
  emptyMessage = "Select a job card from the list below to open the Accountant Department Job Card.",
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const tenantId = useTenantId();
  const isManual = Boolean(jobCardId || row?.is_manual);
  const resolvedJobCardId = jobCardId || (row?.is_manual ? row?.job_card_id : null);
  const resolvedOrderId = !isManual ? (orderId ?? row?.sales_order_id ?? null) : null;

  const [shellCompany, setShellCompany] = useState(null);
  const [manualCard, setManualCard] = useState(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");
  const [billingContext, setBillingContext] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [salesRefOpen, setSalesRefOpen] = useState(true);

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
  } = useSalesJobCardDocumentLoader(resolvedOrderId, tenantId, Boolean(resolvedOrderId) && !isManual);

  const loadManual = useCallback(async () => {
    if (!resolvedJobCardId) return;
    setManualLoading(true);
    setManualError("");
    try {
      const res = await getManualJobCard(resolvedJobCardId);
      setManualCard(res?.data ?? res);
    } catch (err) {
      setManualCard(null);
      setManualError(apiErrorMessage(err, "Could not load job card."));
    } finally {
      setManualLoading(false);
    }
  }, [resolvedJobCardId]);

  const loadBilling = useCallback(async () => {
    if (!resolvedOrderId) {
      setBillingContext(null);
      return;
    }
    setBillingLoading(true);
    setBillingError("");
    try {
      const res = await getStageJobCard(resolvedOrderId, "billing");
      setBillingContext(res?.data ?? res);
    } catch (err) {
      setBillingContext(null);
      setBillingError(apiErrorMessage(err, "Could not load billing details."));
    } finally {
      setBillingLoading(false);
    }
  }, [resolvedOrderId]);

  useEffect(() => {
    if (resolvedJobCardId) loadManual();
    else setManualCard(null);
  }, [resolvedJobCardId, loadManual]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

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

  const card = isManual ? manualCard : soCard;
  const loading = isManual ? manualLoading : soLoading || billingLoading;
  const error = isManual ? manualError : soError || billingError;
  const reload = useCallback(async () => {
    if (isManual) await loadManual();
    else {
      await Promise.all([reloadSo(), loadBilling()]);
    }
  }, [isManual, loadManual, reloadSo, loadBilling]);

  const profile = companyProfile || shellCompany;
  const hasSelection = Boolean(resolvedOrderId || resolvedJobCardId);
  const showDocument = Boolean(hasSelection && card && !loading && !error);
  const showEmptyLayout = showEmptyShell && !hasSelection;
  const workflowStatus = erpListStatus(billingContext || card || row || {});

  const title =
    row?.job_card_no?.replace(/^JC-/i, "ACC-") ||
    card?.job_card_no?.replace(/^JC-/i, "ACC-") ||
    billingContext?.card_number?.replace(/^BL-/i, "ACC-") ||
    (resolvedOrderId ? `ACC #${resolvedOrderId}` : "Accountant Job Card");

  const manualCustomer = card?.sales_document?.customer_details
    ? {
        name: card.sales_document.customer_details.customer_name,
        contact_name: card.sales_document.customer_details.contact_person,
        phone: card.sales_document.customer_details.phone,
        email: card.sales_document.customer_details.email,
        address_line1: card.sales_document.customer_details.billing_address,
      }
    : null;

  const manualProductLines = (card?.sales_document?.product_lines || []).map((l) => ({
    product_name: l.product_name,
    product_code: l.product_code,
    quantity: l.quantity,
    unit: l.uom,
    description: l.description,
  }));

  const handlePrint = () => {
    const el = document.getElementById("accountant-job-card-document");
    if (!el) return;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Accountant Job Card</title>
      <link rel="stylesheet" href="${window.location.origin}/assets/index.css" />
      <style>body{margin:0;padding:12px;} @page{size:landscape;margin:10mm;}</style>
      </head><body>${el.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const runBillingAction = async (action) => {
    if (!resolvedOrderId) return;
    setSubmitting(true);
    try {
      if (action === "create_invoice" || action === "confirm_billing") {
        await createBillingInvoice(resolvedOrderId, {});
        addToast("GST Tax Invoice generated successfully.", "success");
      }
      await reload();
    } catch (err) {
      addToast(apiErrorMessage(err, "Billing action failed."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const billingActions = billingContext?.allowed_actions || [];

  return (
    <div className="my-job-cards-page__store-panels">
      <section
        className="ui-card my-job-cards-page__document-panel my-job-cards-page__document-panel--accounts"
        id="accountant-job-card-panel"
      >
        <div className="my-job-cards-page__document-toolbar">
          <div className="my-job-cards-page__document-toolbar-main">
            <div className="my-job-cards-page__document-toolbar-titles">
              <h2 className="my-job-cards-page__document-title">Accountant Department Job Card</h2>
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
              <AccountantJobCardDocument companyProfile={profile} assignedUser={user} />
              <p className="my-job-cards-page__document-empty-msg" role="status">{emptyMessage}</p>
            </>
          ) : null}

          {hasSelection && loading ? (
            <LoadingState label="Loading accountant job card…" description="" compact className="py-12" />
          ) : null}

          {hasSelection && error ? (
            <ErrorState title="Could not load job card" description={error} onRetry={reload} className="py-10" />
          ) : null}

          {showDocument ? (
            <AccountantJobCardDocument
              manualCard={isManual ? manualCard : null}
              soCard={!isManual ? soCard : null}
              row={row}
              billingContext={billingContext}
              companyProfile={profile}
              assignedUser={user}
            />
          ) : null}

          {showDocument && resolvedOrderId && billingActions.length ? (
            <JobCardActions
              actions={billingActions}
              loading={submitting}
              onAction={runBillingAction}
              labels={{ confirm_billing: "Mark as Billed" }}
            />
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
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      printSalesJobCardLandscape(
                        isManual
                          ? {
                              card: manualCard,
                              salesDocument: manualCard?.sales_document,
                              companyProfile: profile,
                            }
                          : soPrintPayload(),
                        user
                      )
                    }
                    leftIcon={<Printer className="h-4 w-4" aria-hidden />}
                  >
                    Print Sales JC
                  </Button>
                </div>
              </div>
              <SalesJobCardDocument
                card={card}
                form={isManual ? card?.form || {} : soForm || soCard?.form || {}}
                salesOrder={isManual ? null : salesOrder}
                customer={isManual ? manualCustomer : customer}
                productLines={isManual ? manualProductLines : productLines}
                products={isManual ? [] : products}
                details={isManual ? { approval: card?.sales_document?.approval } : card?.details}
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
