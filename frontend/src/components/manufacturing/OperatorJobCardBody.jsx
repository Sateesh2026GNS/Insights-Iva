import { useMemo, useState } from "react";

import Button from "../common/Button";
import { FormField, Input, Textarea } from "../common/FormField";
import MaterialTable from "./MaterialTable";
import JobCardActions from "./JobCardActions";
import { CardSectionHeader, fmtDeliveryDisplay, NOTES_MAX } from "./jobCardUiShared";

function ReadOnlyField({ label, value, className = "" }) {
  return (
    <FormField label={label} className={className}>
      <Input value={value ?? "—"} readOnly />
    </FormField>
  );
}

function fmtQty(qty, unit = "Nos") {
  if (qty == null || qty === "") return "—";
  const n = Number(qty);
  if (Number.isNaN(n)) return String(qty);
  return `${n.toLocaleString("en-IN")} ${unit}`;
}

function mapMaterialStatus(status) {
  if (status === "Partial") return "Shortage";
  if (status === "Not Available") return "Shortage";
  return status || "—";
}

function toDateTimeLocalValue(display) {
  if (!display) return "";
  const d = new Date(display.includes("T") ? display : display.replace(/(\d{2})-(\w{3})-(\d{4})/, "$3-$2-$1"));
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function validateProductionForm({ produced, rejected, rework, target, remarks }) {
  const errors = {};
  const p = produced === "" ? null : Number(produced);
  const r = rejected === "" ? 0 : Number(rejected);
  const w = rework === "" ? 0 : Number(rework);
  if (produced !== "" && (Number.isNaN(p) || p < 0)) errors.produced_qty = "Enter a valid quantity";
  if (rejected !== "" && (Number.isNaN(r) || r < 0)) errors.rejected_qty = "Cannot be negative";
  if (rework !== "" && (Number.isNaN(w) || w < 0)) errors.rework_qty = "Cannot be negative";
  if (p != null && target > 0 && p > target) errors.produced_qty = `Cannot exceed target (${target})`;
  if (remarks && remarks.length > NOTES_MAX) errors.notes = `Maximum ${NOTES_MAX} characters`;
  return errors;
}

export default function OperatorJobCardBody({
  card,
  form,
  onChange,
  submitting,
  onAction,
  onSaveProgress,
}) {
  const [fieldErrors, setFieldErrors] = useState({});

  const product = card?.product_info || {};
  const instructions = card?.production_instructions || {};
  const execution = card?.execution || {};
  const header = card?.header_panel || {};
  const unit = product.unit || card?.summary_panel?.uom || "Nos";
  const targetQty = Number(execution.target_qty ?? execution.planned_qty ?? product.target_quantity ?? 0);
  const producedQty = Number(form.produced_qty || execution.produced_qty || 0);
  const rejectedQty = Number(form.rejected_qty || execution.rejected_qty || 0);
  const reworkQty = Number(form.rework_qty || execution.rework_qty || 0);
  const editable = Boolean(card?.editable);
  const completed = !editable && ["Completed", "Quality Check"].includes(card?.status_label);

  const progressPct = useMemo(() => {
    if (!targetQty || targetQty <= 0) return producedQty > 0 ? 100 : 0;
    return Math.min(100, Math.round((producedQty / targetQty) * 100));
  }, [producedQty, targetQty]);

  const materialColumns = useMemo(
    () => [
      { key: "material_name", label: "Material" },
      { key: "material_code", label: "Material Code" },
      { key: "required_qty", label: "Required Qty" },
      { key: "available_qty", label: "Available Qty" },
      { key: "unit", label: "Unit" },
      { key: "availability_status", label: "Status" },
    ],
    []
  );

  const materialRows = useMemo(
    () =>
      (card?.materials || []).map((row) => ({
        ...row,
        availability_status: mapMaterialStatus(row.availability_status),
      })),
    [card?.materials]
  );

  const handleField = (key, value) => {
    onChange?.(key, value);
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSaveProgress = async () => {
    const errors = validateProductionForm({
      produced: form.produced_qty,
      rejected: form.rejected_qty,
      rework: form.rework_qty,
      target: targetQty,
      remarks: form.notes,
    });
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    await onSaveProgress?.();
  };

  const handleComplete = async (action) => {
    const errors = validateProductionForm({
      produced: form.produced_qty,
      rejected: form.rejected_qty,
      rework: form.rework_qty,
      target: targetQty,
      remarks: form.notes,
    });
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    await onAction?.(action);
  };

  const operatorActions = (card?.allowed_actions || []).filter((a) => a !== "view");

  return (
    <div className="ui-stack">
      {/* Assignment header */}
      <article className="ui-card overflow-hidden">
        <CardSectionHeader title="Job Card Details" />
        <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <ReadOnlyField label="Job Card No." value={header.job_card_no || card?.card_number} />
          <ReadOnlyField label="Sales Order" value={header.sales_order_no || card?.sales_order_no} />
          <ReadOnlyField label="Assigned Operator" value={header.assigned_operator} />
          <ReadOnlyField label="Production Manager" value={header.production_manager || card?.assigned_by} />
          <ReadOnlyField
            label="Due Date"
            value={header.due_date ? fmtDeliveryDisplay(header.due_date) : fmtDeliveryDisplay(product.delivery_date)}
          />
          <ReadOnlyField label="Status" value={card?.status_label || header.status} />
        </div>
      </article>

      {/* Product information */}
      <article className="ui-card overflow-hidden">
        <CardSectionHeader title="Product Information" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <ReadOnlyField label="Product Name" value={product.product_name || card?.summary_panel?.product} />
          <ReadOnlyField label="Product Code / SKU" value={product.product_code} />
          <ReadOnlyField label="Customer" value={product.customer || card?.summary_panel?.customer} />
          <ReadOnlyField label="Required Quantity" value={fmtQty(product.required_quantity, unit)} />
          <ReadOnlyField label="Target Quantity" value={fmtQty(product.target_quantity ?? targetQty, unit)} />
          <ReadOnlyField label="Unit" value={unit} />
          <ReadOnlyField
            label="Delivery Date"
            value={fmtDeliveryDisplay(product.delivery_date)}
            className="sm:col-span-2"
          />
        </div>
      </article>

      {/* Materials */}
      <article className="ui-card overflow-hidden">
        <CardSectionHeader title="Material Information" />
        <MaterialTable columns={materialColumns} rows={materialRows} editable={false} />
      </article>

      {/* Production instructions */}
      <article className="ui-card overflow-hidden">
        <CardSectionHeader title="Production Instructions" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <ReadOnlyField label="Operation / Process" value={instructions.operation || card?.production_process} />
          <ReadOnlyField label="Machine" value={instructions.machine || card?.machine || execution.machine_name} />
          <ReadOnlyField label="Target Quantity" value={fmtQty(instructions.target_quantity ?? targetQty, unit)} />
          <ReadOnlyField label="Standard Production Time" value={instructions.standard_production_time || "—"} />
          <FormField label="Work Instructions" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={instructions.work_instructions || card?.work_instructions || "—"}
              readOnly
            />
          </FormField>
          <FormField label="Safety Instructions" className="sm:col-span-2">
            <Textarea rows={2} value={instructions.safety_instructions || "—"} readOnly />
          </FormField>
          <FormField label="Special Instructions" className="sm:col-span-2">
            <Textarea rows={2} value={instructions.special_instructions || "—"} readOnly />
          </FormField>
        </div>
      </article>

      {/* Progress */}
      <article className="ui-card overflow-hidden">
        <CardSectionHeader title="Production Progress" />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              Target: <strong className="ui-num">{targetQty.toLocaleString("en-IN")}</strong>
            </span>
            <span>
              Produced: <strong className="ui-num text-[var(--color-success)]">{producedQty.toLocaleString("en-IN")}</strong>
            </span>
            <span>
              Progress: <strong>{progressPct}%</strong>
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
            <span>Rejected: {rejectedQty.toLocaleString("en-IN")}</span>
            <span>Rework: {reworkQty.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </article>

      {/* Operator production */}
      <article className="ui-card overflow-hidden">
        <CardSectionHeader title="Operator Production" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <FormField label="Produced Quantity" error={fieldErrors.produced_qty}>
            <Input
              type="number"
              min={0}
              step="any"
              value={form.produced_qty}
              onChange={(e) => handleField("produced_qty", e.target.value)}
              disabled={!editable}
            />
          </FormField>
          <FormField label="Rejected Quantity" error={fieldErrors.rejected_qty}>
            <Input
              type="number"
              min={0}
              step="any"
              value={form.rejected_qty}
              onChange={(e) => handleField("rejected_qty", e.target.value)}
              disabled={!editable}
            />
          </FormField>
          <FormField label="Rework Quantity" error={fieldErrors.rework_qty}>
            <Input
              type="number"
              min={0}
              step="any"
              value={form.rework_qty}
              onChange={(e) => handleField("rework_qty", e.target.value)}
              disabled={!editable}
            />
          </FormField>
          <FormField label="Actual Start Time">
            <Input
              type="datetime-local"
              value={form.actual_start_time || toDateTimeLocalValue(execution.actual_start_time)}
              onChange={(e) => handleField("actual_start_time", e.target.value)}
              disabled={!editable}
            />
          </FormField>
          <FormField label="Actual End Time">
            <Input
              type="datetime-local"
              value={form.actual_end_time || toDateTimeLocalValue(execution.actual_end_time)}
              onChange={(e) => handleField("actual_end_time", e.target.value)}
              disabled={!editable}
            />
          </FormField>
          <FormField label="Operator Remarks" className="sm:col-span-2" error={fieldErrors.notes}>
            <Textarea
              rows={3}
              maxLength={NOTES_MAX}
              placeholder="Production notes, downtime, tool changes…"
              value={form.notes}
              onChange={(e) => handleField("notes", e.target.value)}
              disabled={!editable}
            />
          </FormField>
        </div>

        {editable ? (
          <div className="flex flex-wrap gap-2 border-t border-[var(--color-border-muted)] bg-[var(--color-surface-muted)]/50 px-4 py-3">
            <Button variant="outline" size="sm" loading={submitting} onClick={handleSaveProgress}>
              Save Progress
            </Button>
          </div>
        ) : null}

        {completed ? (
          <p className="border-t border-[var(--color-border-muted)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
            Production is complete. This job has been sent to Quality Check.
          </p>
        ) : (
          <JobCardActions
            actions={operatorActions}
            loading={submitting}
            onAction={handleComplete}
            labels={{
              start_work: "Start Production",
              pause: "Pause",
              resume: "Resume",
              complete_production: "Complete Production & Send to Quality",
            }}
          />
        )}
      </article>
    </div>
  );
}
