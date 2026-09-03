import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Edit3, Play, Plus, Printer, Save } from "lucide-react";

import Button from "../common/Button";
import CompletedJobCardAllStagesReport from "./CompletedJobCardAllStagesReport";
import JobCardDetailsForm from "./JobCardDetailsForm";
import JobCardTimeline from "./JobCardTimeline";
import StoreManagerJobCardPanel from "./StoreManagerJobCardPanel";
import WorkflowTracker from "./WorkflowTracker";
import { PriorityBadge, WorkflowStatusBadge } from "./jobCardUiShared";
import { getProductionOrderDetail, getProductionOrders } from "../../api/productionApi";
import { PRIORITY_COLORS, enrichApiOrder } from "../../data/productionPlanningMasterData";
import { getWorkflowStatusLabel } from "../../config/workflowStages";
import { isStoreManager } from "../../config/permissions";
import { downloadJobCardPdf, printProductionOrder } from "../../utils/printUtils";
import { storeRowMenuItems } from "../../utils/storeJobCardQueue";
import useAuth from "../../hooks/useAuth";

/**
 * Unified Job Card Details shell — two-column ERP form layout (view + edit).
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

  const storeActionItems = storeMode
    ? storeRowMenuItems({
        ...storeContext,
        sales_order_id: orderId,
        id: orderId,
      }).filter((item) => item.key !== "view" && item.to)
    : [];

  const footer = isEdit ? (
    <>
      <div className="flex flex-wrap gap-3">
        {canEditSales ? (
          <>
            {!isCreated ? (
              <Button variant="primary" loading={creating} disabled={saving} onClick={onCreate}>
                <Plus className="mr-2 inline h-4 w-4" />
                Create Job Card
              </Button>
            ) : null}
            <Button variant="primary" loading={saving} disabled={creating || readOnly} onClick={onSave}>
              <Save className="mr-2 inline h-4 w-4" />
              Save Job Card
            </Button>
          </>
        ) : null}
      </div>
      <Button variant="outline" onClick={() => navigate(backTo)} to={backTo}>
        <ArrowLeft className="mr-2 inline h-4 w-4" />
        Back to Sales Orders
      </Button>
    </>
  ) : (
    <>
      {canEditSales && onEdit ? (
        <Button variant="primary" size="sm" onClick={onEdit}>
          <Edit3 className="mr-1.5 inline h-4 w-4" />
          Edit
        </Button>
      ) : null}
      {storeMode
        ? storeActionItems.map((item) => (
            <Button
              key={item.key}
              variant={item.key === "send_to_production" ? "primary" : "secondary"}
              size="sm"
              to={item.to}
            >
              {item.label}
            </Button>
          ))
        : null}
      {!storeMode && isCreated && onOpenWorkflow ? (
        <Button variant="secondary" size="sm" onClick={onOpenWorkflow}>
          <Play className="mr-1.5 inline h-4 w-4" />
          Open Workflow
        </Button>
      ) : null}
      <Button variant="outline" size="sm" onClick={handlePrint}>
        <Printer className="mr-1.5 inline h-4 w-4" />
        Print
      </Button>
      <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
        <Download className="mr-1.5 inline h-4 w-4" />
        Download PDF
      </Button>
      <Button variant="outline" size="sm" to={`/sales/orders/${orderId}`}>
        Sales Order
      </Button>
      <Button variant="ghost" size="sm" onClick={() => navigate(backTo)} to={backTo}>
        <ArrowLeft className="mr-1.5 inline h-4 w-4" />
        Back
      </Button>
    </>
  );

  return (
    <div className="ui-page pb-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {!isEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(backTo)} to={backTo}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Button>
            <span className="rounded-md bg-[var(--color-primary)] px-2.5 py-1 text-xs font-bold text-white">
              {jobCardNo}
            </span>
            {stageTitle ? (
              <span className="rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-text)]">
                {stageTitle}
              </span>
            ) : null}
            <WorkflowStatusBadge status={ws} label={getWorkflowStatusLabel(ws)} />
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityStyle.bg} ${priorityStyle.text}`}
            >
              {priorityStyle.dot} {priorityStyle.label}
            </span>
          </div>
        ) : null}

        <JobCardDetailsForm
          showHeader
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
        />

        {stageActions}

        {!isEdit && !stageActions && (String(ws || "").toUpperCase() === "COMPLETED" || card?.workflow_status === "completed" || form?.workflow_status === "completed") ? (
          <CompletedJobCardAllStagesReport
            card={card}
            form={form}
            salesOrder={salesOrder}
            orderId={orderId}
          />
        ) : null}

        {storeMode && storeContext?.material_requirements?.length ? (
          <StoreManagerJobCardPanel
            orderId={orderId}
            storeContext={storeContext}
            summary={summary}
            form={form}
            productCode={productCode}
            onRefresh={onRefreshStoreContext}
            refreshing={refreshingStoreContext}
          />
        ) : null}

        {!isEdit && showWorkflowTracker && (card?.workflow_tracker?.length || card?.workflow_steps?.length || card?.workflow?.length) ? (
          <article className="ui-card overflow-hidden p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              Workflow Timeline
            </h2>
            <WorkflowTracker
              embedded
              steps={card?.workflow_tracker || card?.workflow_steps || card?.workflow || []}
              currentStage={card?.workflow_current_stage}
            />
          </article>
        ) : null}

        {!isEdit && card?.timeline?.length ? (
          <JobCardTimeline embedded events={card.timeline} />
        ) : null}
      </div>
    </div>
  );
}
