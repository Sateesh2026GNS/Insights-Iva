import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Button from "../common/Button";
import { Textarea } from "../common/FormField";
import MaterialRequirementsTable from "./MaterialRequirementsTable";
import { WorkflowStatusBadge, fmtDeliveryDisplay } from "./jobCardUiShared";
import { holdWorkflowOrder, submitMaterialCheck } from "../../api/workflowApi";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";
import {
  storeQueueStatusLabel,
  storeRowMenuItems,
  storeStatusVariant,
} from "../../utils/storeJobCardQueue";

function DetailField({ label, value }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface-muted)]/40 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[var(--color-text)]">{value ?? "—"}</p>
    </div>
  );
}

function fmtQty(value, unit) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `${n.toLocaleString("en-IN")}${unit ? ` ${unit}` : ""}`;
}

/**
 * Store Manager sections on unified job card detail — inventory, materials, actions.
 */
export default function StoreManagerJobCardPanel({
  orderId,
  storeContext,
  summary = {},
  form = {},
  productCode = "",
  onRefresh,
  refreshing = false,
}) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [holding, setHolding] = useState(false);
  const [remarksOpen, setRemarksOpen] = useState(false);
  const [remarks, setRemarks] = useState(storeContext?.notes || "");
  const [savingRemarks, setSavingRemarks] = useState(false);

  if (!storeContext) return null;

  const row = {
    ...storeContext,
    sales_order_id: storeContext.sales_order_id ?? orderId,
    id: storeContext.sales_order_id ?? orderId,
  };
  const statusLabel = storeQueueStatusLabel(row);
  const actionItems = storeRowMenuItems(row).filter((item) => !["view", "hold", "add_remarks"].includes(item.key));

  const handleHold = async () => {
    setHolding(true);
    try {
      await holdWorkflowOrder(orderId, { reason: "On hold by Store Manager" });
      addToast("Job card placed on hold", "success");
      onRefresh?.();
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not place job card on hold"), "error");
    } finally {
      setHolding(false);
    }
  };

  const handleSaveRemarks = async () => {
    setSavingRemarks(true);
    try {
      await submitMaterialCheck(orderId, { notes: remarks, lines: [] });
      addToast("Remarks saved", "success");
      setRemarksOpen(false);
      onRefresh?.();
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not save remarks"), "error");
    } finally {
      setSavingRemarks(false);
    }
  };

  const priorityLabel = String(storeContext.priority || summary.priority || "medium").replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="space-y-4">
      <article className="ui-card overflow-hidden">
        <div className="border-b border-[var(--color-border-soft)] px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Job Card Details</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Job Card Number" value={storeContext.job_card_no || summary.job_card_no} />
          <DetailField label="Sales Order Number" value={storeContext.order_number || summary.sales_order_no} />
          <DetailField label="Current Stage" value={storeContext.responsible_role || "Store Manager"} />
          <DetailField label="Status" value={statusLabel} />
          <DetailField label="Priority" value={priorityLabel} />
          {storeContext.needed_action ? (
            <DetailField label="Needed Action" value={storeContext.needed_action} />
          ) : null}
        </div>
      </article>

      <article className="ui-card overflow-hidden">
        <div className="border-b border-[var(--color-border-soft)] px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Customer &amp; Order</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <DetailField label="Customer" value={storeContext.customer_name || form.customer_name} />
          <DetailField label="Sales Person" value={storeContext.sales_person || form.sales_person_name} />
          <DetailField label="Order Date" value={fmtDeliveryDisplay(storeContext.order_date || form.order_date)} />
          <DetailField
            label="Required Delivery Date"
            value={fmtDeliveryDisplay(storeContext.delivery_date || summary.required_delivery)}
          />
        </div>
      </article>

      <article className="ui-card overflow-hidden">
        <div className="border-b border-[var(--color-border-soft)] px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Product</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Product" value={storeContext.product_name || form.product_name} />
          <DetailField label="Product Code" value={storeContext.product_code || productCode} />
          <DetailField label="Quantity" value={fmtQty(storeContext.quantity || summary.order_quantity, storeContext.unit)} />
          <DetailField label="Unit" value={storeContext.unit || summary.uom || "Nos"} />
        </div>
      </article>

      <article className="ui-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-soft)] px-4 py-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Material Requirements</h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              Warehouse: <span className="font-medium text-[var(--color-text)]">{storeContext.warehouse || "—"}</span>
              {" · "}
              Next: <span className="font-medium text-[var(--color-primary)]">{storeContext.next_stage || "Production Manager"}</span>
            </p>
          </div>
          <WorkflowStatusBadge
            status={storeContext.workflow_status}
            label={statusLabel}
            variant={storeStatusVariant(row)}
          />
        </div>
        <MaterialRequirementsTable materials={storeContext.material_requirements || []} />
      </article>

      <article className="ui-card overflow-hidden">
        <div className="border-b border-[var(--color-border-soft)] px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Store Manager Actions</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          {actionItems.map((item) => (
            <Button
              key={item.key}
              variant={item.key === "send_to_production" ? "primary" : "outline"}
              size="sm"
              to={item.to}
            >
              {item.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" loading={holding} onClick={handleHold}>
            Hold
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRemarksOpen((v) => !v)}>
            Add Remarks
          </Button>
          {onRefresh ? (
            <Button variant="ghost" size="sm" loading={refreshing} onClick={onRefresh}>
              Refresh Stock
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => navigate("/my-job-cards")}>
            Back to Queue
          </Button>
        </div>
        {remarksOpen ? (
          <div className="space-y-2 border-t border-[var(--color-border-soft)] px-4 py-3">
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              placeholder="Add store remarks for this job card…"
              aria-label="Store remarks"
            />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" loading={savingRemarks} onClick={handleSaveRemarks}>
                Save Remarks
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRemarksOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        {storeContext.notes && !remarksOpen ? (
          <p className="border-t border-[var(--color-border-soft)] px-4 py-2 text-xs text-[var(--color-text-muted)]">
            <span className="font-semibold text-[var(--color-text)]">Remarks:</span> {storeContext.notes}
          </p>
        ) : null}
      </article>
    </div>
  );
}
