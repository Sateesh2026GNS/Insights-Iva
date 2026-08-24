import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Save } from "lucide-react";

import Button from "../../components/common/Button";
import { FormField, Input, Select, Textarea } from "../../components/common/FormField";
import JobCardLayout from "../../components/manufacturing/JobCardLayout";
import {
  CardSectionHeader,
  fmtDeliveryDisplay,
  JobCardPageMoreMenu,
  NOTES_MAX,
  PriorityBadge,
} from "../../components/manufacturing/jobCardUiShared";
import { DatePicker } from "../../design-system/dateControls";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import useTenantId from "../../hooks/useTenantId";
import { getTeamDirectory } from "../../api/adminApi";
import { createSalesJobCard, getSalesJobCard, saveSalesJobCard } from "../../api/workflowApi";
import { fetchCustomersWithFallback } from "../../utils/customerOptions";
import { fetchProductsWithFallback } from "../../utils/productOptions";
import { userHasWorkflowTeam } from "../../config/manufacturingWorkflow";
import { getWorkflowStatusLabel } from "../../config/workflowStages";

const UNITS = ["Nos", "nos", "pcs", "kg", "ltr", "box", "set", "mtr"];

export default function SalesJobCardPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [card, setCard] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesPeople, setSalesPeople] = useState([]);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  const isSalesTeam = userHasWorkflowTeam(user, "sales") || userHasWorkflowTeam(user, "admin");
  const isCreated = Boolean(form?.is_created || card?.job_card_created);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const [cardRes, custList, prodList, usersRes] = await Promise.all([
        getSalesJobCard(orderId),
        fetchCustomersWithFallback(tenantId),
        fetchProductsWithFallback(tenantId),
        getTeamDirectory().catch(() => ({ data: [] })),
      ]);
      const data = cardRes?.data ?? cardRes;
      setCard(data);
      setForm({ ...(data?.form || {}), notes: data?.form?.notes || "" });
      setCustomers(Array.isArray(custList) ? custList : []);
      setProducts(Array.isArray(prodList) ? prodList : []);
      const users = usersRes?.data?.items ?? usersRes?.data ?? [];
      setSalesPeople(Array.isArray(users) ? users : []);
      setErrors({});
    } catch (err) {
      addToast(err?.response?.data?.detail || "Could not load job card", "error");
      setCard(null);
      setForm(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, tenantId, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(form?.product_id)),
    [products, form?.product_id]
  );

  const productCode = selectedProduct?.product_code || selectedProduct?.sku || form?.product_code || "";
  const formReadOnly = isCreated || !isSalesTeam;

  const patchField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form?.customer_id) next.customer_id = "Customer is required";
    if (!form?.product_id) next.product_id = "Product is required";
    if (!form?.quantity || Number(form.quantity) <= 0) next.quantity = "Quantity must be greater than 0";
    if (!form?.required_delivery_date) next.required_delivery_date = "Required delivery date is required";
    if (!form?.priority) next.priority = "Priority is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = () => ({
    customer_id: form.customer_id ? Number(form.customer_id) : null,
    product_id: form.product_id ? Number(form.product_id) : null,
    quantity: Number(form.quantity),
    unit: form.unit || "Nos",
    required_delivery_date: form.required_delivery_date || null,
    priority: form.priority || "medium",
    sales_person_id: form.sales_person_id ? Number(form.sales_person_id) : null,
    sales_person_name: form.sales_person_name || null,
    notes: (form.notes || "").slice(0, NOTES_MAX),
  });

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await saveSalesJobCard(orderId, buildPayload());
      const data = res?.data ?? res;
      setCard(data);
      setForm({ ...(data?.form || {}), notes: data?.form?.notes || "" });
      addToast("Job card saved.", "success");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail?.errors) setErrors(detail.errors);
      addToast(typeof detail === "string" ? detail : detail?.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setCreating(true);
    try {
      const res = await createSalesJobCard(orderId, buildPayload());
      const data = res?.data ?? res;
      setCard(data);
      setForm({ ...(data?.form || {}), notes: data?.form?.notes || "" });
      addToast("Job card created successfully.", "success");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail?.errors) setErrors(detail.errors);
      addToast(typeof detail === "string" ? detail : detail?.message || "Create failed", "error");
    } finally {
      setCreating(false);
    }
  };

  const layoutCard = useMemo(() => {
    if (!card || !form) return null;
    const summaryPanel = card.summary_panel || {};
    const uom = form.unit || summaryPanel.uom || "Nos";
    const ws = card.workflow_status || form.workflow_status || summaryPanel.workflow_status;
    return {
      sales_order_id: Number(orderId),
      workflow_status: ws,
      workflow_tracker: card.workflow_tracker || card.workflow_steps,
      workflow_current_stage: card.workflow_current_stage || {
        stage_label: "Sales Order",
        stage_hint: "Awaiting inventory check by Store Manager.",
      },
      timeline: card.timeline || [],
      summary_panel: {
        job_card_no: summaryPanel.job_card_no || form.job_card_no,
        sales_order_no: summaryPanel.sales_order_no || form.sales_order_no,
        customer: summaryPanel.customer || form.customer_name,
        product: summaryPanel.product || form.product_name || selectedProduct?.name,
        order_quantity: form.quantity ?? summaryPanel.order_quantity,
        required_delivery: fmtDeliveryDisplay(form.required_delivery_date) || summaryPanel.required_delivery,
        priority: form.priority || summaryPanel.priority,
        uom,
        workflow_status: ws,
      },
    };
  }, [card, form, orderId, selectedProduct?.name]);

  const statusLabel = card?.status_badge?.label || getWorkflowStatusLabel(layoutCard?.workflow_status) || "Sales Confirmed";

  if (!loading && (!card || !form)) {
    return (
      <div className="ui-page ui-stack">
        <p className="text-sm text-[var(--color-text-muted)]">Job card not found for this sales order.</p>
        <Button variant="primary" to="/sales/orders">
          Back to Sales Orders
        </Button>
      </div>
    );
  }

  const notesLen = (form?.notes || "").length;
  const uom = form?.unit || layoutCard?.summary_panel?.uom || "Nos";

  const headerActions = (
    <>
      {isSalesTeam ? (
        <>
          <Button variant="primary" size="sm" loading={saving} disabled={creating || formReadOnly} onClick={handleSave}>
            <Save className="mr-1.5 inline h-4 w-4" />
            Save Job Card
          </Button>
          {!isCreated ? (
            <Button variant="secondary" size="sm" loading={creating} disabled={saving} onClick={handleCreate}>
              <Plus className="mr-1.5 inline h-4 w-4" />
              Create Job Card
            </Button>
          ) : null}
        </>
      ) : null}
      <Button variant="outline" size="sm" to={`/sales/orders/${orderId}`}>
        View Sales Order
      </Button>
      <JobCardPageMoreMenu
        items={[
          { label: "Open Workflow Board", onClick: () => navigate(`/manufacturing/workflow?order=${orderId}`) },
          { label: "Back to Sales Orders", onClick: () => navigate("/sales/orders") },
        ]}
      />
    </>
  );

  return (
    <JobCardLayout
      title="Sales Job Card"
      card={layoutCard}
      loading={loading}
      saving={saving}
      editable={isSalesTeam && !formReadOnly}
      onSave={handleSave}
      backTo={`/sales/orders/${orderId}`}
      statusLabel={statusLabel}
      statusVariant="success"
      variant="sales"
      showStageNav={false}
      headerActions={headerActions}
    >
      <article className="ui-card overflow-hidden">
        <CardSectionHeader title="Job Card Details" />
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Customer"
              required
              error={errors.customer_id}
              value={form?.customer_id ?? ""}
              disabled={formReadOnly}
              onChange={(e) => patchField("customer_id", e.target.value)}
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
              disabled={formReadOnly}
              onChange={(e) => {
                const id = e.target.value;
                const sp = salesPeople.find((u) => String(u.id) === String(id));
                patchField("sales_person_id", id || null);
                patchField("sales_person_name", sp?.full_name || sp?.name || form?.sales_person_name);
              }}
            >
              <option value="">{form?.sales_person_name || "Select sales person"}</option>
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
              disabled={formReadOnly}
              onChange={(e) => patchField("product_id", e.target.value)}
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
                  disabled={formReadOnly}
                  value={form?.quantity ?? ""}
                  onChange={(e) => patchField("quantity", e.target.value)}
                  className="min-h-[42px] flex-1 border-0 bg-white px-3 py-2 text-sm outline-none disabled:bg-[var(--color-surface-muted)]"
                />
                <span className="flex min-w-[3.5rem] items-center justify-center border-l border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 text-xs font-semibold text-[var(--color-text-muted)]">
                  {uom}
                </span>
              </div>
            </FormField>

            <Select
              label="Unit"
              value={form?.unit || "Nos"}
              disabled={formReadOnly}
              onChange={(e) => patchField("unit", e.target.value)}
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
              disabled={formReadOnly}
              onChange={(value) => patchField("required_delivery_date", value)}
              min={new Date().toISOString().slice(0, 10)}
            />

            <FormField label="Priority" required error={errors.priority}>
              {formReadOnly ? (
                <div className="ui-input flex min-h-[42px] items-center !bg-[var(--color-surface-muted)]">
                  <PriorityBadge priority={form?.priority} />
                </div>
              ) : (
                <div className="flex min-h-[42px] items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)]">
                  <select
                    value={form?.priority || "medium"}
                    onChange={(e) => patchField("priority", e.target.value)}
                    className="flex-1 border-0 bg-transparent py-2 text-sm outline-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <PriorityBadge priority={form?.priority} />
                </div>
              )}
            </FormField>
          </div>

          <Textarea
            label="Notes / Remarks"
            placeholder="Enter notes or special instructions…"
            rows={4}
            maxLength={NOTES_MAX}
            value={form?.notes || ""}
            disabled={!isSalesTeam}
            onChange={(e) => patchField("notes", e.target.value)}
          />
          <p className="text-right text-[11px] tabular-nums text-[var(--color-text-muted)]">
            {notesLen} / {NOTES_MAX}
          </p>
        </div>
      </article>
    </JobCardLayout>
  );
}
