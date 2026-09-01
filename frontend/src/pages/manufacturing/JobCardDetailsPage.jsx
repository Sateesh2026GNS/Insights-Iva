import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import Button from "../../components/common/Button";
import JobCardDetailsShell from "../../components/manufacturing/JobCardDetailsShell";
import useAuth from "../../hooks/useAuth";
import useJobCardDetails from "../../hooks/useJobCardDetails";
import usePageRefresh from "../../hooks/usePageRefresh";
import useTenantId from "../../hooks/useTenantId";
import { userHasWorkflowTeam } from "../../config/manufacturingWorkflow";
import { userCanAction } from "../../config/permissions";
import { jobCardEditUrl } from "../../utils/jobCardRoutes";
import { stageJobCardUrl } from "../../utils/workflowStageRoutes";

/**
 * Unified Job Card Details — reference layout with view and edit modes.
 */
export default function JobCardDetailsPage({ initialMode = null }) {
  const { orderId: paramOrderId, id } = useParams();
  const orderId = paramOrderId || id;
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const [refreshingStore, setRefreshingStore] = useState(false);

  const isSalesTeam = userHasWorkflowTeam(user, "sales") || userHasWorkflowTeam(user, "admin");
  const canEditSales = userCanAction(user, "sales", "update") || isSalesTeam;

  const queryEdit = searchParams.get("edit") === "1";
  const mode = initialMode === "edit" || (queryEdit && canEditSales) ? "edit" : "view";

  const backTo = location.state?.from || (mode === "edit" ? `/sales/orders/${orderId}` : "/my-job-cards");
  const productionOrderId = location.state?.productionOrderId ?? null;

  const {
    loading,
    saving,
    creating,
    card,
    form,
    salesOrder,
    productLines,
    customers,
    products,
    salesPeople,
    errors,
    isCreated,
    load,
    patchField,
    handleSave,
    handleCreate,
    addProductLine,
    removeProductLine,
    updateProductLine,
  } = useJobCardDetails(orderId, tenantId);

  usePageRefresh(load);
  useEffect(() => {
    load();
  }, [load]);

  const selectedProduct = products.find((p) => String(p.id) === String(form?.product_id));
  const productCode = selectedProduct?.product_code || selectedProduct?.sku || form?.product_code || "";
  const formReadOnly = mode === "view" || isCreated || !canEditSales;
  const linesReadOnly = mode === "view" || isCreated;

  const openStageWorkflow = () => {
    navigate(stageJobCardUrl(orderId, card?.workflow_status));
  };

  const refreshStoreContext = async () => {
    setRefreshingStore(true);
    try {
      await load();
    } finally {
      setRefreshingStore(false);
    }
  };

  if (loading) {
    return (
      <div className="ui-page flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-muted)]">Loading job card…</p>
      </div>
    );
  }

  if (!card || !form) {
    return (
      <div className="ui-page ui-stack">
        <p className="text-sm text-[var(--color-text-muted)]">Job card not found for this sales order.</p>
        <Button variant="primary" to={backTo}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <JobCardDetailsShell
      orderId={orderId}
      card={card}
      form={form}
      salesOrder={salesOrder}
      productLines={productLines}
      customers={customers}
      products={products}
      salesPeople={salesPeople}
      errors={errors}
      mode={mode}
      readOnly={formReadOnly}
      linesReadOnly={linesReadOnly}
      selectedProduct={selectedProduct}
      productCode={productCode}
      onPatchField={patchField}
      onAddLine={addProductLine}
      onRemoveLine={removeProductLine}
      onUpdateLine={updateProductLine}
      onSave={handleSave}
      onCreate={handleCreate}
      saving={saving}
      creating={creating}
      isCreated={isCreated}
      canEditSales={canEditSales}
      backTo={backTo}
      productionOrderId={productionOrderId}
      onEdit={() => navigate(jobCardEditUrl(orderId))}
      onOpenWorkflow={isCreated ? openStageWorkflow : null}
      onRefreshStoreContext={refreshStoreContext}
      refreshingStoreContext={refreshingStore}
    />
  );
}
