import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Save } from "lucide-react";

import Button from "../common/Button";
import JobCardDetailsForm from "./JobCardDetailsForm";
import useAuth from "../../hooks/useAuth";
import useJobCardDetails from "../../hooks/useJobCardDetails";
import useTenantId from "../../hooks/useTenantId";
import { userHasWorkflowTeam } from "../../config/manufacturingWorkflow";
import { userCanAction } from "../../config/permissions";
import { jobCardEditUrl } from "../../utils/jobCardRoutes";

function emptyLine() {
  return {
    id: `local-${Date.now()}`,
    product_id: "",
    product_name: "",
    quantity: 1,
    unit: "pcs",
    unit_price: "",
    description: "",
  };
}

const PLACEHOLDER_FORM = {
  customer_id: "",
  sales_person_id: "",
  product_id: "",
  quantity: 1,
  unit: "pcs",
  priority: "medium",
  required_delivery_date: "",
  notes: "",
};

/**
 * Embeddable Job Card Details form — reference layout (screenshot) for My Job Cards.
 */
export default function JobCardDetailsPanel({
  orderId = null,
  mode = "view",
  onSaved,
}) {
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const isSalesTeam = userHasWorkflowTeam(user, "sales") || userHasWorkflowTeam(user, "admin");
  const canEditSales = userCanAction(user, "sales", "update") || isSalesTeam;

  const [draftForm, setDraftForm] = useState(PLACEHOLDER_FORM);
  const [draftLines, setDraftLines] = useState([emptyLine()]);

  const {
    loading,
    saving,
    creating,
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

  useEffect(() => {
    load();
  }, [load]);

  const isLive = Boolean(orderId && form);
  const isEdit = mode === "edit" && isLive;
  const readOnly = isLive ? !isEdit || isCreated || !canEditSales : false;
  const linesReadOnly = isLive ? !isEdit || isCreated : false;

  const displayForm = isLive ? form : draftForm;
  const displayLines = isLive ? productLines : draftLines;
  const displayOrder = isLive
    ? salesOrder
    : {
        order_date: new Date().toISOString(),
        reference_number: "",
        grand_total: 0,
        total_amount: 0,
      };

  const selectedProduct = products.find((p) => String(p.id) === String(displayForm?.product_id));
  const productCode = selectedProduct?.product_code || selectedProduct?.sku || displayForm?.product_code || "";

  const patchDraft = useCallback((key, value) => {
    setDraftForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onCreateClick = async () => {
    if (!orderId) {
      navigate("/sales/orders");
      return;
    }
    const ok = await handleCreate();
    if (ok) {
      onSaved?.();
      load();
    }
  };

  const onSaveClick = async () => {
    if (!orderId) return;
    const ok = await handleSave();
    if (ok) {
      onSaved?.();
      load();
    }
  };

  const footer = (
    <>
      <div className="flex flex-wrap gap-3">
        {isLive && canEditSales && isEdit ? (
          <>
            {!isCreated ? (
              <Button variant="primary" loading={creating} disabled={saving} onClick={onCreateClick}>
                <Plus className="mr-2 inline h-4 w-4" />
                Create Job Card
              </Button>
            ) : null}
            <Button variant="primary" loading={saving} disabled={creating || readOnly} onClick={onSaveClick}>
              <Save className="mr-2 inline h-4 w-4" />
              Save Job Card
            </Button>
          </>
        ) : (
          <Button variant="primary" to="/sales/orders">
            <Plus className="mr-2 inline h-4 w-4" />
            Create from Sales Order
          </Button>
        )}
        {isLive && !isEdit && canEditSales ? (
          <Button variant="secondary" to={jobCardEditUrl(orderId)}>
            Edit Job Card
          </Button>
        ) : null}
      </div>
      <Button variant="outline" to="/sales/orders">
        <ArrowLeft className="mr-2 inline h-4 w-4" />
        Back to Sales Orders
      </Button>
    </>
  );

  if (loading && orderId) {
    return (
      <article className="overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-8 text-center shadow-sm">
        <p className="text-sm text-[var(--color-text-muted)]">Loading job card details…</p>
      </article>
    );
  }

  return (
    <JobCardDetailsForm
      showHeader
      form={{
        ...displayForm,
        sales_order_no: displayForm?.sales_order_no || displayOrder?.order_number || "",
      }}
      salesOrder={displayOrder}
      productLines={displayLines.length ? displayLines : [emptyLine()]}
      customers={customers}
      products={products}
      salesPeople={salesPeople}
      errors={isLive ? errors : {}}
      readOnly={readOnly}
      linesReadOnly={linesReadOnly}
      selectedProduct={selectedProduct}
      productCode={productCode}
      onPatchField={isLive ? patchField : patchDraft}
      onAddLine={
        isLive
          ? addProductLine
          : () => setDraftLines((prev) => [...prev, emptyLine()])
      }
      onRemoveLine={
        isLive
          ? removeProductLine
          : (idx) => setDraftLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))
      }
      onUpdateLine={
        isLive
          ? updateProductLine
          : (idx, patch) =>
              setDraftLines((prev) =>
                prev.map((line, i) => {
                  if (i !== idx) return line;
                  const next = { ...line, ...patch };
                  if (patch.product_id != null) {
                    const prod = products.find((p) => String(p.id) === String(patch.product_id));
                    if (prod) next.product_name = prod.name;
                  }
                  return next;
                })
              )
      }
      footer={footer}
    />
  );
}
