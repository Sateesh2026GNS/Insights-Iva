import { FormField, Input, Select, Textarea } from "../common/FormField";
import {
  CardSectionHeader,
  fmtDeliveryDisplay,
  NOTES_MAX,
  PriorityBadge,
} from "./jobCardUiShared";
import JobCardProductLines from "./JobCardProductLines";
import { DatePicker } from "../../design-system/dateControls";
import { formatInr } from "../../data/salesMasterData";

const UNITS = ["Nos", "nos", "pcs", "kg", "ltr", "box", "set", "mtr"];

function DetailField({ label, value, required = false }) {
  const display = value == null || value === "" ? "—" : value;
  return (
    <div className="rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface-muted)]/40 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
        {required ? " *" : ""}
      </p>
      <p className="mt-0.5 text-sm font-medium text-[var(--color-text)]">{display}</p>
    </div>
  );
}

function formatOrderDate(iso) {
  if (!iso) return "—";
  return fmtDeliveryDisplay(String(iso).slice(0, 10));
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
  showHeader = true,
  footer = null,
  bare = false,
}) {
  const uom = form?.unit || "pcs";
  const notesLen = (form?.notes || "").length;
  const orderTotal =
    salesOrder?.grand_total ?? salesOrder?.total_amount ?? salesOrder?.amount ?? null;
  const orderNo = form?.sales_order_no || salesOrder?.order_number || "";

  const body = (
    <div className="space-y-6 p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        {readOnly ? (
          <>
            <DetailField label="Customer" value={form?.customer_name} required />
            <DetailField label="Sales Person" value={form?.sales_person_name} />
            <DetailField label="Product" value={form?.product_name || selectedProduct?.name} required />
            <DetailField label="Product Code" value={productCode} />
            <DetailField
              label="Order Quantity"
              value={form?.quantity != null ? `${Number(form.quantity).toLocaleString("en-IN")} ${uom}` : "—"}
              required
            />
            <DetailField label="Unit" value={uom} />
            <DetailField
              label="Required Delivery Date"
              value={fmtDeliveryDisplay(form?.required_delivery_date)}
              required
            />
            <DetailField
              label="Priority"
              value={String(form?.priority || "medium").replace(/^./, (c) => c.toUpperCase())}
              required
            />
            <DetailField label="Order Number" value={orderNo} />
            <DetailField label="Reference Number" value={salesOrder?.reference_number} />
            <DetailField label="Order Date" value={formatOrderDate(salesOrder?.order_date)} />
            <DetailField label="Total" value={orderTotal != null ? formatInr(orderTotal) : "—"} />
          </>
        ) : (
          <>
            <Select
              label="Customer"
              required
              error={errors.customer_id}
              value={form?.customer_id ?? ""}
              onChange={(e) => onPatchField("customer_id", e.target.value)}
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.company_name}
                </option>
              ))}
            </Select>

            <Select
              label="Sales Person"
              value={form?.sales_person_id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                const sp = salesPeople.find((u) => String(u.id) === String(id));
                onPatchField("sales_person_id", id || null);
                onPatchField("sales_person_name", sp?.full_name || sp?.name || form?.sales_person_name);
              }}
            >
              <option value="">Select sales person</option>
              {salesPeople.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.name || u.email}
                </option>
              ))}
            </Select>

            <Select
              label="Product"
              required
              error={errors.product_id}
              value={form?.product_id ?? ""}
              onChange={(e) => onPatchField("product_id", e.target.value)}
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>

            <FormField label="Product Code">
              <Input value={productCode} readOnly className="!bg-[var(--color-surface-muted)]" />
            </FormField>

            <FormField label="Order Quantity" required error={errors.quantity}>
              <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)] focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)]">
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={form?.quantity ?? ""}
                  onChange={(e) => onPatchField("quantity", e.target.value)}
                  className="min-h-[42px] flex-1 border-0 bg-[var(--color-surface)] px-3 py-2 text-sm outline-none"
                />
                <span className="flex min-w-[3.5rem] items-center justify-center border-l border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 text-xs font-semibold lowercase text-[var(--color-text-muted)]">
                  {uom}
                </span>
              </div>
            </FormField>

            <Select
              label="Unit"
              value={form?.unit || "pcs"}
              onChange={(e) => onPatchField("unit", e.target.value)}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>

            <DatePicker
              label="Required Delivery Date"
              required
              error={errors.required_delivery_date}
              value={form?.required_delivery_date ? String(form.required_delivery_date).slice(0, 10) : ""}
              onChange={(value) => onPatchField("required_delivery_date", value)}
              min={new Date().toISOString().slice(0, 10)}
            />

            <FormField label="Priority" required error={errors.priority}>
              <div className="flex min-h-[42px] items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)]">
                <select
                  value={form?.priority || "medium"}
                  onChange={(e) => onPatchField("priority", e.target.value)}
                  className="flex-1 border-0 bg-transparent py-2 text-sm capitalize outline-none"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <PriorityBadge priority={form?.priority} />
              </div>
            </FormField>

            <FormField label="Order number">
              <Input
                value={orderNo}
                readOnly
                placeholder="Auto-generated if empty"
                className="!bg-[var(--color-surface-muted)]"
              />
            </FormField>

            <FormField label="Reference number">
              <Input
                value={salesOrder?.reference_number || ""}
                readOnly
                className="!bg-[var(--color-surface-muted)]"
              />
            </FormField>

            <FormField label="Order date">
              <Input
                value={formatOrderDate(salesOrder?.order_date)}
                readOnly
                className="!bg-[var(--color-surface-muted)]"
              />
            </FormField>

            <FormField label="Total">
              <Input
                value={orderTotal != null ? formatInr(orderTotal) : formatInr(0)}
                readOnly
                className="!bg-[var(--color-surface-muted)]"
              />
            </FormField>
          </>
        )}
      </div>

      <JobCardProductLines
        lines={productLines}
        products={products}
        readOnly={linesReadOnly}
        errors={errors}
        onAddLine={onAddLine}
        onRemoveLine={onRemoveLine}
        onUpdateLine={onUpdateLine}
      />

      {readOnly ? (
        <div>
          <p className="ui-label mb-1.5">Notes / Remarks</p>
          <p className="whitespace-pre-wrap rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface-muted)]/40 px-3 py-2.5 text-sm text-[var(--color-text)]">
            {form?.notes?.trim() ? form.notes : "—"}
          </p>
        </div>
      ) : (
        <div>
          <Textarea
            label="Notes / Remarks"
            placeholder="Enter notes or special instructions..."
            rows={4}
            maxLength={NOTES_MAX}
            value={form?.notes || ""}
            onChange={(e) => onPatchField("notes", e.target.value)}
          />
          <p className="-mt-1 text-right text-[11px] tabular-nums text-[var(--color-text-muted)]">
            {notesLen} / {NOTES_MAX}
          </p>
        </div>
      )}
    </div>
  );

  if (bare) {
    return body;
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-sm">
      {showHeader ? <CardSectionHeader title="JOB CARD DETAILS" /> : null}
      {body}
      {footer ? (
        <footer className="flex flex-col gap-3 border-t border-[var(--color-border-muted)] bg-[var(--color-surface-muted)]/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {footer}
        </footer>
      ) : null}
    </article>
  );
}
