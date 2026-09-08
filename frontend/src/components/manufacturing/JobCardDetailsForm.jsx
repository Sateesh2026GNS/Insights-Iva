import { Input, Select, Textarea } from "../common/FormField";
import { fmtDeliveryDisplay, NOTES_MAX } from "./jobCardUiShared";
import JobCardProductLines from "./JobCardProductLines";
import { DatePicker } from "../../design-system/dateControls";
import { getWorkflowStatusLabel } from "../../config/workflowStages";

const UNITS = ["Nos", "nos", "pcs", "kg", "ltr", "box", "set", "mtr"];
const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function formatOrderDate(iso) {
  if (!iso) return "";
  return fmtDeliveryDisplay(String(iso).slice(0, 10));
}

function JobCardSection({ title, children }) {
  return (
    <section className="job-card-page__section">
      <h2 className="ui-section-title !rounded-none">{title}</h2>
      <div className="job-card-page__section-body">{children}</div>
    </section>
  );
}

function StaticField({ label, value, required = false, className = "" }) {
  const display = value == null || value === "" ? "—" : String(value);
  return (
    <div className={`job-card-page__field ${className}`.trim()}>
      <Input label={label} required={required} value={display} disabled readOnly className="w-full" />
    </div>
  );
}

function PriorityField({ value, onChange, readOnly, error, className = "" }) {
  if (readOnly) {
    const label = String(value || "medium").replace(/^./, (c) => c.toUpperCase());
    return <StaticField label="Priority" value={label} required className={className} />;
  }
  return (
    <div className={`job-card-page__field ${className}`.trim()}>
      <Select
        label="Priority"
        required
        error={error}
        value={value || "medium"}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      >
        {PRIORITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export default function JobCardDetailsForm({
  form,
  salesOrder,
  productLines,
  customers,
  products,
  salesPeople,
  errors,
  readOnly,
  linesReadOnly,
  selectedProduct,
  productCode,
  onPatchField,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
  footer = null,
  jobCardNo,
  productionOrder = null,
  workflowStatus,
}) {
  const uom = form?.unit || "pcs";
  const notesLen = (form?.notes || "").length;
  const orderNo = form?.sales_order_no || salesOrder?.order_number || "";
  const workOrderNo =
    productionOrder?.work_order_number ||
    productionOrder?.order_number ||
    form?.production_order_no ||
    "";
  const jobCardDate = formatOrderDate(form?.job_card_date || salesOrder?.order_date || form?.created_at);
  const startDate = formatOrderDate(
    productionOrder?.start_date ||
      productionOrder?.planned_start ||
      productionOrder?.planned_start_date ||
      form?.start_date
  );
  const statusLabel = getWorkflowStatusLabel(workflowStatus || form?.workflow_status || form?.status);
  const assignedPerson = salesPeople.find((u) => String(u.id) === String(form?.sales_person_id));
  const department =
    assignedPerson?.department ||
    assignedPerson?.designation ||
    form?.department ||
    salesOrder?.department ||
    "";

  const showProductLinesTable = readOnly && (productLines?.length ?? 0) > 1;

  const section1 = (
    <div className="job-card-page__grid">
      <StaticField
        label="Job Card Number"
        value={jobCardNo || form?.job_card_no || (readOnly ? "" : "Auto-generated")}
      />
      <StaticField label="Job Card Date" value={jobCardDate || "—"} />
      <StaticField label="Status" value={statusLabel} />
      <PriorityField
        value={form?.priority}
        onChange={(v) => onPatchField("priority", v)}
        readOnly={readOnly}
        error={errors.priority}
      />
    </div>
  );

  const section2 = readOnly ? (
    <div className="job-card-page__grid">
      <StaticField label="Customer" value={form?.customer_name} required />
      <StaticField label="Sales Order" value={orderNo} />
      <StaticField label="Product / Item" value={form?.product_name || selectedProduct?.name} required />
      <StaticField
        label="Quantity"
        value={form?.quantity != null ? `${Number(form.quantity).toLocaleString("en-IN")} ${uom}` : ""}
        required
      />
      <StaticField label="Unit" value={uom} />
      {productCode ? <StaticField label="Product Code" value={productCode} /> : null}
    </div>
  ) : (
    <div className="job-card-page__grid">
      <div className="job-card-page__field">
        <Select
          label="Customer"
          required
          error={errors.customer_id}
          value={form?.customer_id ?? ""}
          onChange={(e) => onPatchField("customer_id", e.target.value)}
          className="w-full"
        >
          <option value="">Please Select</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || c.company_name}
            </option>
          ))}
        </Select>
      </div>

      <StaticField label="Sales Order" value={orderNo} />

      <div className="job-card-page__field">
        <Select
          label="Product / Item"
          required
          error={errors.product_id}
          value={form?.product_id ?? ""}
          onChange={(e) => onPatchField("product_id", e.target.value)}
          className="w-full"
        >
          <option value="">Please Select</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="job-card-page__field">
        <Input
          label="Quantity"
          required
          type="number"
          min="0.001"
          step="any"
          error={errors.quantity}
          value={form?.quantity ?? ""}
          onChange={(e) => onPatchField("quantity", e.target.value)}
          className="w-full"
        />
      </div>

      <div className="job-card-page__field">
        <Select
          label="Unit"
          value={form?.unit || "pcs"}
          onChange={(e) => onPatchField("unit", e.target.value)}
          className="w-full"
        >
          {UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </Select>
      </div>

      {productCode ? <StaticField label="Product Code" value={productCode} /> : null}
    </div>
  );

  const section3 = readOnly ? (
    <div className="job-card-page__grid">
      <StaticField label="Work Order / Production Order" value={workOrderNo} />
      <StaticField label="Department" value={department} />
      <StaticField label="Assigned Employee / Operator" value={form?.sales_person_name} />
      <StaticField label="Start Date" value={startDate} />
      <StaticField
        label="Expected Completion Date"
        value={fmtDeliveryDisplay(form?.required_delivery_date)}
        required
      />
    </div>
  ) : (
    <div className="job-card-page__grid">
      <StaticField label="Work Order / Production Order" value={workOrderNo} />
      <StaticField label="Department" value={department} />

      <div className="job-card-page__field">
        <Select
          label="Assigned Employee / Operator"
          value={form?.sales_person_id ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            const sp = salesPeople.find((u) => String(u.id) === String(id));
            onPatchField("sales_person_id", id || null);
            onPatchField("sales_person_name", sp?.full_name || sp?.name || form?.sales_person_name);
          }}
          className="w-full"
        >
          <option value="">Please Select</option>
          {salesPeople.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name || u.name || u.email}
            </option>
          ))}
        </Select>
      </div>

      <StaticField label="Start Date" value={startDate} />

      <div className="job-card-page__field">
        <DatePicker
          label="Expected Completion Date"
          required
          error={errors.required_delivery_date}
          value={form?.required_delivery_date ? String(form.required_delivery_date).slice(0, 10) : ""}
          onChange={(value) => onPatchField("required_delivery_date", value)}
          min={new Date().toISOString().slice(0, 10)}
        />
      </div>
    </div>
  );

  const section4 = (
    <div className="job-card-page__grid">
      {readOnly ? (
        <StaticField
          label="Remarks"
          value={form?.notes?.trim() ? form.notes : "—"}
          className="job-card-page__field--span-full"
        />
      ) : (
        <div className="job-card-page__field job-card-page__field--span-full">
          <Textarea
            label="Remarks"
            placeholder="Enter remarks or special instructions..."
            rows={3}
            maxLength={NOTES_MAX}
            value={form?.notes || ""}
            onChange={(e) => onPatchField("notes", e.target.value)}
            className="w-full"
          />
          <p className="mt-1 text-right text-[11px] tabular-nums text-[var(--color-text-muted)]">
            {notesLen} / {NOTES_MAX}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="job-card-page__form">
      <JobCardSection title="Job Card Information">{section1}</JobCardSection>

      <JobCardSection title="Customer & Order Information">
        {section2}
        {showProductLinesTable ? (
          <div className="job-card-page__lines-block">
            <JobCardProductLines
              lines={productLines}
              products={products}
              readOnly
              errors={errors}
              onAddLine={onAddLine}
              onRemoveLine={onRemoveLine}
              onUpdateLine={onUpdateLine}
            />
          </div>
        ) : null}
      </JobCardSection>

      <JobCardSection title="Manufacturing Details">{section3}</JobCardSection>

      <JobCardSection title="Additional Information">{section4}</JobCardSection>

      {footer}
    </div>
  );
}
