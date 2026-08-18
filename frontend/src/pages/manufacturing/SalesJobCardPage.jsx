import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  Plus,
  Save,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import { FormField, Input, Select, Textarea } from "../../components/common/FormField";
import JobCardSummary from "../../components/manufacturing/JobCardSummary";
import JobCardWorkflowStatus from "../../components/manufacturing/JobCardWorkflowStatus";
import JobCardTimeline from "../../components/manufacturing/JobCardTimeline";
import {
  CardSectionHeader,
  fmtDeliveryDisplay,
  JOB_CARD_WORKFLOW_STEPS,
  JobCardPageMoreMenu,
  NOTES_MAX,
  PriorityBadge,
  StatusBadge,
} from "../../components/manufacturing/jobCardUiShared";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import useTenantId from "../../hooks/useTenantId";
import { getUsers } from "../../api/adminApi";
import { createSalesJobCard, getSalesJobCard, saveSalesJobCard } from "../../api/workflowApi";
import { fetchCustomersWithFallback } from "../../utils/customerOptions";
import { fetchProductsWithFallback } from "../../utils/productOptions";
import { userHasWorkflowTeam } from "../../config/manufacturingWorkflow";

const UNITS = ["Nos", "nos", "pcs", "kg", "ltr", "box", "set", "mtr"];

const DEFAULT_STEPS = JOB_CARD_WORKFLOW_STEPS;

function toDateInputValue(iso) {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

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
        getUsers().catch(() => ({ data: [] })),
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

  const summaryPanel = card?.summary_panel || {};
  const workflowSteps = card?.workflow_steps?.length ? card.workflow_steps : DEFAULT_STEPS;
  const workflowCurrentStage = card?.workflow_current_stage || {
    stage_label: "Sales Orders",
    stage_hint: "Waiting for inventory check.",
  };
  const timeline = card?.timeline || [];
  const statusLabel = card?.status_badge?.label || "Sales Confirmed";

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

  if (loading) return <Loader label="Loading job card..." />;

  if (!card || !form) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Job card not found for this sales order.</p>
        <Button variant="primary" className="mt-4" to="/sales/orders">
          Back to Sales Orders
        </Button>
      </div>
    );
  }

  const notesLen = (form.notes || "").length;
  const uom = form.unit || summaryPanel.uom || "Nos";

  return (
    <div className="min-h-full bg-[var(--color-bg)]">
      <div className="ui-page mx-auto max-w-[1280px] ui-stack pb-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <ClipboardList className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <h1 className="ui-page-title">Sales Order Job Card</h1>
              <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
                Create and manage job card from sales order
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isSalesTeam ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  loading={saving}
                  disabled={creating}
                  onClick={handleSave}
                >
                  <Save className="mr-1.5 inline h-4 w-4" />
                  Save Job Card
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate(`/sales/orders/${orderId}`)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate(`/sales/orders/${orderId}`)}>
                Back
              </Button>
            )}
            <JobCardPageMoreMenu
              items={[
                { label: "View Sales Order", onClick: () => navigate(`/sales/orders/${orderId}`) },
                {
                  label: "Open Workflow Board",
                  onClick: () => navigate(`/manufacturing/workflow?order=${orderId}`),
                },
                { label: "Back to Sales Orders", onClick: () => navigate("/sales/orders") },
              ]}
            />
            <StatusBadge label={statusLabel} variant="confirmed" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left column — Summary + Details */}
          <div className="space-y-5 lg:col-span-2">
            <JobCardSummary
              jobCardNo={summaryPanel.job_card_no || form.job_card_no}
              salesOrderNo={summaryPanel.sales_order_no || form.sales_order_no}
              customer={summaryPanel.customer || form.customer_name}
              product={summaryPanel.product || form.product_name || selectedProduct?.name}
              orderQuantity={form.quantity ?? summaryPanel.order_quantity}
              requiredDelivery={fmtDeliveryDisplay(form.required_delivery_date) || summaryPanel.required_delivery}
              priority={form.priority || summaryPanel.priority}
              uom={uom}
            />

            <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <CardSectionHeader title="Job Card Details" />

              <div className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select
                    label="Customer"
                    required
                    error={errors.customer_id}
                    value={form.customer_id ?? ""}
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
                    value={form.sales_person_id ?? ""}
                    disabled={formReadOnly}
                    onChange={(e) => {
                      const id = e.target.value;
                      const sp = salesPeople.find((u) => String(u.id) === String(id));
                      patchField("sales_person_id", id || null);
                      patchField("sales_person_name", sp?.full_name || sp?.name || form.sales_person_name);
                    }}
                  >
                    <option value="">{form.sales_person_name || "Select sales person"}</option>
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
                    value={form.product_id ?? ""}
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
                    <Input value={productCode} readOnly className="!bg-slate-50 !text-slate-600" />
                  </FormField>

                  <FormField label="Order Quantity" required error={errors.quantity}>
                    <div className="flex overflow-hidden rounded-lg border border-slate-200 focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)]">
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        disabled={formReadOnly}
                        value={form.quantity ?? ""}
                        onChange={(e) => patchField("quantity", e.target.value)}
                        className="min-h-[42px] flex-1 border-0 bg-white px-3 py-2 text-sm text-slate-900 outline-none disabled:bg-slate-50"
                      />
                      <span className="flex min-w-[3.5rem] items-center justify-center border-l border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-500">
                        {uom}
                      </span>
                    </div>
                  </FormField>

                  <Select
                    label="Unit"
                    value={form.unit || "Nos"}
                    disabled={formReadOnly}
                    onChange={(e) => patchField("unit", e.target.value)}
                  >
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </Select>

                  <FormField label="Required Delivery Date" required error={errors.required_delivery_date}>
                    <div className="relative">
                      <Input
                        type="date"
                        value={toDateInputValue(form.required_delivery_date)}
                        disabled={formReadOnly}
                        onChange={(e) => patchField("required_delivery_date", e.target.value)}
                        className="pr-10"
                      />
                      <Calendar
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden
                      />
                    </div>
                  </FormField>

                  <FormField label="Priority" required error={errors.priority}>
                    {formReadOnly ? (
                      <div className="ui-input flex min-h-[42px] items-center !bg-slate-50">
                        <PriorityBadge priority={form.priority} />
                      </div>
                    ) : (
                      <div className="flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)]">
                        <select
                          value={form.priority || "medium"}
                          onChange={(e) => patchField("priority", e.target.value)}
                          className="flex-1 border-0 bg-transparent py-2 text-sm text-slate-900 outline-none"
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        <PriorityBadge priority={form.priority} />
                      </div>
                    )}
                  </FormField>
                </div>

                <div>
                  <Textarea
                    label="Notes / Remarks"
                    placeholder="Enter notes or special instructions..."
                    rows={4}
                    maxLength={NOTES_MAX}
                    value={form.notes || ""}
                    disabled={!isSalesTeam}
                    onChange={(e) => patchField("notes", e.target.value)}
                  />
                  <p className="mt-1 text-right text-[11px] tabular-nums text-slate-400">
                    {notesLen} / {NOTES_MAX}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                  {isSalesTeam && !isCreated ? (
                    <Button
                      variant="primary"
                      loading={creating}
                      disabled={saving}
                      onClick={handleCreate}
                    >
                      <Plus className="mr-1.5 inline h-4 w-4" />
                      Create Job Card
                    </Button>
                  ) : null}
                  <Button variant="outline" to="/sales/orders">
                    <ArrowLeft className="mr-1.5 inline h-4 w-4" />
                    Back to Sales Orders
                  </Button>
                </div>
              </div>
            </article>
          </div>

          {/* Right column — Workflow + Timeline */}
          <div className="space-y-4">
            <JobCardWorkflowStatus steps={workflowSteps} currentStage={workflowCurrentStage} />
            <JobCardTimeline events={timeline} />
          </div>
        </div>
      </div>
    </div>
  );
}
