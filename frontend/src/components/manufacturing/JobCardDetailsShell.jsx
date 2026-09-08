import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Edit3, Play, Plus, Printer, Save } from "lucide-react";

import Button from "../common/Button";
import CompletedJobCardAllStagesReport from "./CompletedJobCardAllStagesReport";
import JobCardDetailsForm from "./JobCardDetailsForm";
import JobCardTimeline from "./JobCardTimeline";
import StoreManagerJobCardPanel from "./StoreManagerJobCardPanel";
import WorkflowTracker from "./WorkflowTracker";
import { WorkflowStatusBadge } from "./jobCardUiShared";
import { getProductionOrderDetail, getProductionOrders } from "../../api/productionApi";
import { PRIORITY_COLORS, enrichApiOrder } from "../../data/productionPlanningMasterData";
import { getWorkflowStatusLabel } from "../../config/workflowStages";
import { isStoreManager } from "../../config/permissions";
import { downloadJobCardPdf, printProductionOrder } from "../../utils/printUtils";
import { storeRowMenuItems } from "../../utils/storeJobCardQueue";
import useAuth from "../../hooks/useAuth";
import "../../styles/job-card-page.css";

/**
 * Unified Job Card Details shell — reference government-form layout (view + edit).
 */
export default function JobCardDetailsShell({
  orderId,
  card,
  form,
  salesOrder,
  productLines,
  customers,
  products,
  salesPeople,
  errors,
  mode,
  readOnly,
  linesReadOnly,
  selectedProduct,
  productCode,
  onPatchField,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
  onSave,
  onCreate,
  saving,
  creating,
  isCreated,
  canEditSales,
  backTo,
  onCancel = null,
  productionOrderId: initialPoId,
  onEdit,
  onOpenWorkflow,
  stageActions = null,
  stageTitle = null,
  showWorkflowTracker = true,
  onRefreshStoreContext = null,
  refreshingStoreContext = false,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [productionOrder, setProductionOrder] = useState(null);

  const summary = card?.summary_panel || {};
  const storeContext = card?.store_context;
  const storeMode = isStoreManager(user) && Boolean(storeContext);
  const ws = card?.workflow_status || form?.workflow_status || summary.workflow_status;
  const priority = form?.priority || summary.priority || card?.priority || "medium";
  const priorityStyle = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
  const jobCardNo = summary.job_card_no || form?.job_card_no || `JC-${form?.sales_order_no || orderId}`;

  useEffect(() => {
    let cancelled = false;
    async function loadPo() {
      try {
        let poId = initialPoId || card?.header?.production_order_id;
        if (!poId) {
          const listRes = await getProductionOrders();
          const list = Array.isArray(listRes?.data) ? listRes.data : [];
          const match = list.find((o) => Number(o.sales_order_id) === Number(orderId));
          poId = match?.id;
        }
        if (!poId) {
          if (!cancelled) setProductionOrder(null);
          return;
        }
        const res = await getProductionOrderDetail(poId);
        if (!cancelled) setProductionOrder(enrichApiOrder(res.data));
      } catch {
        if (!cancelled) setProductionOrder(null);
      }
    }
    if (orderId) loadPo();
    return () => {
      cancelled = true;
    };
  }, [orderId, initialPoId, card?.header?.production_order_id]);

  const getJobCardPrintPayload = () => ({
    ...(productionOrder || {}),
    ...(card || {}),
    ...(form || {}),
    card,
    form,
    salesOrder,
    productLines,
    selectedProduct,
    product_code: productCode,
    productionOrder,
    orderId,
    sales_order_id: orderId,
    id: orderId,
  });

  const handlePrint = () => {
    printProductionOrder(getJobCardPrintPayload(), user);
  };

  const handleDownloadPdf = () => {
    downloadJobCardPdf(getJobCardPrintPayload(), user);
  };

  const isEdit = mode === "edit";

  const headerTitle = isEdit
    ? isCreated
      ? "Edit Job Card"
      : "Create Job Card"
    : "Job Card Details";

  const headerSubtitle = isEdit
    ? "Create and manage manufacturing job card details."
    : "View manufacturing job card and workflow status.";

  const storeActionItems = storeMode
    ? storeRowMenuItems({
        ...storeContext,
        sales_order_id: orderId,
        id: orderId,
      }).filter((item) => item.key !== "view" && item.to)
    : [];

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    navigate(backTo);
  };

  const footer = isEdit ? (
    <footer className="job-card-page__footer">
      <Button variant="secondary" onClick={handleCancel} to={onCancel ? undefined : backTo}>
        Cancel
      </Button>
      {canEditSales ? (
        !isCreated ? (
          <Button variant="add" loading={creating} disabled={saving} onClick={onCreate} leftIcon={<Plus className="h-4 w-4" aria-hidden />}>
            Create Job Card
          </Button>
        ) : (
          <Button variant="add" loading={saving} disabled={creating || readOnly} onClick={onSave} leftIcon={<Save className="h-4 w-4" aria-hidden />}>
            Save Job Card
          </Button>
        )
      ) : null}
    </footer>
  ) : (
    <footer className="job-card-page__footer">
      <Button variant="secondary" onClick={() => navigate(backTo)} to={backTo} leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}>
        Back to Job Cards
      </Button>
    </footer>
  );

  const headerActions = !isEdit ? (
    <div className="flex flex-wrap items-center gap-2">
      {canEditSales && onEdit ? (
        <Button variant="add" size="sm" onClick={onEdit} leftIcon={<Edit3 className="h-4 w-4" aria-hidden />}>
          Edit
        </Button>
      ) : null}
      {storeMode
        ? storeActionItems.map((item) => (
            <Button
              key={item.key}
              variant={item.key === "send_to_production" ? "add" : "secondary"}
              size="sm"
              to={item.to}
            >
              {item.label}
            </Button>
          ))
        : null}
      {!storeMode && isCreated && onOpenWorkflow ? (
        <Button variant="secondary" size="sm" onClick={onOpenWorkflow} leftIcon={<Play className="h-4 w-4" aria-hidden />}>
          Open Workflow
        </Button>
      ) : null}
      <Button variant="secondary" size="sm" onClick={handlePrint} leftIcon={<Printer className="h-4 w-4" aria-hidden />}>
        Print
      </Button>
      <Button variant="secondary" size="sm" onClick={handleDownloadPdf} leftIcon={<Download className="h-4 w-4" aria-hidden />}>
        Download PDF
      </Button>
    </div>
  ) : null;

  return (
    <div className="job-card-page ui-page ui-stack">
      <div className="ui-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Sales &amp; Manufacturing
            </p>
            <h1 className="mt-0 text-base font-semibold text-[var(--color-text)] sm:text-lg">{headerTitle}</h1>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{headerSubtitle}</p>
          </div>
          {headerActions}
        </div>

        {!isEdit ? (
          <div className="job-card-page__meta">
            <span className="job-card-page__meta-chip">{jobCardNo}</span>
            {orderNoLabel(form, salesOrder) ? (
              <span className="job-card-page__meta-chip">SO {orderNoLabel(form, salesOrder)}</span>
            ) : null}
            {stageTitle ? <span className="job-card-page__meta-chip">{stageTitle}</span> : null}
            <WorkflowStatusBadge status={ws} label={getWorkflowStatusLabel(ws)} />
            <span
              className={`job-card-page__meta-chip ${priorityStyle.bg} ${priorityStyle.text}`}
            >
              {priorityStyle.label}
            </span>
          </div>
        ) : null}

        <JobCardDetailsForm
          form={form}
          salesOrder={salesOrder}
          productLines={productLines}
          customers={customers}
          products={products}
          salesPeople={salesPeople}
          errors={errors}
          readOnly={isEdit ? readOnly : true}
          linesReadOnly={isEdit ? linesReadOnly : true}
          selectedProduct={selectedProduct}
          productCode={productCode}
          onPatchField={onPatchField}
          onAddLine={onAddLine}
          onRemoveLine={onRemoveLine}
          onUpdateLine={onUpdateLine}
          footer={footer}
          jobCardNo={jobCardNo}
          productionOrder={productionOrder}
          workflowStatus={ws}
        />

        {stageActions ? <div className="border-t border-[var(--color-border-soft)] p-4 sm:p-5">{stageActions}</div> : null}
      </div>

      {!isEdit && !stageActions && (String(ws || "").toUpperCase() === "COMPLETED" || card?.workflow_status === "completed" || form?.workflow_status === "completed") ? (
        <div className="job-card-page__below">
          <CompletedJobCardAllStagesReport
            card={card}
            form={form}
            salesOrder={salesOrder}
            orderId={orderId}
          />
        </div>
      ) : null}

      {storeMode && storeContext?.material_requirements?.length ? (
        <div className="job-card-page__below">
          <StoreManagerJobCardPanel
            orderId={orderId}
            storeContext={storeContext}
            summary={summary}
            form={form}
            productCode={productCode}
            onRefresh={onRefreshStoreContext}
            refreshing={refreshingStoreContext}
          />
        </div>
      ) : null}

      {!isEdit && showWorkflowTracker && (card?.workflow_tracker?.length || card?.workflow_steps?.length || card?.workflow?.length) ? (
        <article className="ui-card overflow-hidden">
          <h2 className="ui-section-title !rounded-none">Workflow Timeline</h2>
          <div className="p-4 sm:p-5">
            <WorkflowTracker
              embedded
              steps={card?.workflow_tracker || card?.workflow_steps || card?.workflow || []}
              currentStage={card?.workflow_current_stage}
            />
          </div>
        </article>
      ) : null}

      {!isEdit && card?.timeline?.length ? (
        <div className="job-card-page__below">
          <JobCardTimeline embedded events={card.timeline} />
        </div>
      ) : null}
    </div>
  );
}

function orderNoLabel(form, salesOrder) {
  return form?.sales_order_no || salesOrder?.order_number || "";
}
