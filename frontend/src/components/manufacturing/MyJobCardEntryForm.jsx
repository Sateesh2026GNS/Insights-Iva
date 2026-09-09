import { useCallback, useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";

import Button from "../common/Button";
import { Input, Select, Textarea } from "../common/FormField";
import { DatePicker } from "../../design-system/dateControls";
import { getSalesOrderDetail, getSalesOrdersEnriched } from "../../api/salesApi";
import {
  createSalesJobCard,
  getSalesJobCard,
  saveSalesJobCard,
} from "../../api/workflowApi";
import { fetchCustomersWithFallback } from "../../utils/customerOptions";
import { fetchProductsWithFallback } from "../../utils/productOptions";
import { apiErrorMessage, asArray, extractApiErrorDetail } from "../../utils/apiError";
import { withTransientRetry } from "../../utils/transientNetworkRetry";
import { NOTES_MAX } from "./jobCardUiShared";
import useTenantId from "../../hooks/useTenantId";
import { useToast } from "../../context/ToastContext";

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "created", label: "Created" },
];

const EMPTY_FORM = {
  sales_order_id: "",
  job_card_no: "",
  customer_id: "",
  product_id: "",
  quantity: "",
  unit: "Nos",
  start_date: "",
  required_delivery_date: "",
  priority: "medium",
  status: "created",
  notes: "",
};

function isEligibleSalesOrder(row) {
  const status = String(row?.status || "").toLowerCase();
  return ["confirmed", "approved"].includes(status) || Boolean(row?.workflow_status);
}

function applyApiFieldErrors(detail, setErrors) {
  if (detail && typeof detail === "object" && detail.errors && typeof detail.errors === "object") {
    setErrors(detail.errors);
    return detail.message || "Please fix the highlighted fields.";
  }
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail?.message) return detail.message;
  return null;
}

export default function MyJobCardEntryForm({
  editingOrderId = null,
  existingOrderIdsWithCards = [],
  onSaved,
  onCancelEdit,
  canCreate = false,
  canUpdate = false,
}) {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [salesOrders, setSalesOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [isCreated, setIsCreated] = useState(false);

  const isEditMode = Boolean(editingOrderId);
  const readOnlyCore = isEditMode && isCreated;

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [ordersRes, custList, prodList] = await Promise.all([
        withTransientRetry(() => getSalesOrdersEnriched()),
        fetchCustomersWithFallback(tenantId),
        fetchProductsWithFallback(tenantId),
      ]);
      const list = asArray(ordersRes?.data?.items ?? ordersRes?.data);
      setSalesOrders(list.filter(isEligibleSalesOrder));
      setCustomers(Array.isArray(custList) ? custList : []);
      setProducts(Array.isArray(prodList) ? prodList : []);
    } catch (err) {
      setSalesOrders([]);
      setCustomers([]);
      setProducts([]);
      addToast(apiErrorMessage(err, "Could not load job card form data."), "error");
    } finally {
      setLoadingMeta(false);
    }
  }, [tenantId, addToast]);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setErrors({});
    setIsCreated(false);
  }, []);

  const loadForEdit = useCallback(
    async (orderId) => {
      if (!orderId) return;
      setLoadingEdit(true);
      setErrors({});
      try {
        const [cardRes, soRes] = await Promise.all([
          getSalesJobCard(orderId),
          getSalesOrderDetail(orderId).catch(() => null),
        ]);
        const data = cardRes?.data ?? cardRes;
        const f = data?.form || {};
        const so = soRes?.data?.order ?? soRes?.data ?? null;
        const line = soRes?.data?.line_items?.[0];
        setIsCreated(Boolean(f.is_created || data?.job_card_created));
        setForm({
          sales_order_id: String(orderId),
          job_card_no: f.job_card_no || "",
          customer_id: f.customer_id ? String(f.customer_id) : "",
          product_id: f.product_id ? String(f.product_id) : line?.product_id ? String(line.product_id) : "",
          quantity: f.quantity != null ? String(f.quantity) : line?.quantity != null ? String(line.quantity) : "",
          unit: f.unit || line?.unit || "Nos",
          start_date: String(so?.order_date || "").slice(0, 10),
          required_delivery_date: String(f.required_delivery_date || so?.delivery_date || "").slice(0, 10),
          priority: f.priority || so?.priority || "medium",
          status: f.status || "draft",
          notes: f.notes || "",
        });
      } catch (err) {
        addToast(apiErrorMessage(err, "Could not load job card for editing."), "error");
        onCancelEdit?.();
      } finally {
        setLoadingEdit(false);
      }
    },
    [addToast, onCancelEdit]
  );

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (editingOrderId) {
      loadForEdit(editingOrderId);
    } else {
      resetForm();
    }
  }, [editingOrderId, loadForEdit, resetForm]);

  const salesOrderOptions = useMemo(() => {
    const blocked = new Set(
      (existingOrderIdsWithCards || [])
        .map((id) => String(id))
        .filter((id) => id && id !== String(editingOrderId))
    );
    return salesOrders
      .filter((o) => {
        const id = String(o.id);
        if (isEditMode) return id === String(editingOrderId);
        return !blocked.has(id);
      })
      .map((o) => ({
        id: String(o.id),
        label: `${o.order_number || `SO-${o.id}`}${o.customer_name ? ` · ${o.customer_name}` : ""}`,
      }));
  }, [salesOrders, existingOrderIdsWithCards, editingOrderId, isEditMode]);

  const patch = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const populateFromSalesOrder = async (orderId) => {
    if (!orderId) return;
    try {
      const [soRes, cardRes] = await Promise.all([
        getSalesOrderDetail(orderId),
        getSalesJobCard(orderId).catch(() => null),
      ]);
      const so = soRes?.data?.order ?? soRes?.data;
      const line = soRes?.data?.line_items?.[0];
      const cardData = cardRes?.data ?? cardRes;
      const f = cardData?.form;
      setForm((prev) => ({
        ...prev,
        sales_order_id: String(orderId),
        job_card_no: f?.job_card_no || prev.job_card_no || "",
        customer_id: so?.customer_id ? String(so.customer_id) : prev.customer_id,
        product_id: line?.product_id ? String(line.product_id) : prev.product_id,
        quantity: line?.quantity != null ? String(line.quantity) : prev.quantity,
        unit: line?.unit || prev.unit || "Nos",
        start_date: String(so?.order_date || "").slice(0, 10),
        required_delivery_date: String(so?.delivery_date || "").slice(0, 10),
        priority: so?.priority || prev.priority || "medium",
        notes: f?.notes || prev.notes || "",
        status: f?.status || prev.status || "draft",
      }));
      setIsCreated(Boolean(f?.is_created || cardData?.job_card_created));
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not load sales order details."), "error");
    }
  };

  const handleSalesOrderChange = (orderId) => {
    patch("sales_order_id", orderId);
    if (orderId) populateFromSalesOrder(orderId);
  };

  const validate = () => {
    const next = {};
    if (!form.sales_order_id) next.sales_order_id = "Sales order is required";
    if (!form.customer_id) next.customer_id = "Customer is required";
    if (!form.product_id) next.product_id = "Product is required";
    const qty = Number(form.quantity);
    if (!form.quantity || Number.isNaN(qty) || qty <= 0) {
      next.quantity = "Planned quantity must be greater than 0";
    }
    if (!form.required_delivery_date) next.required_delivery_date = "Due date is required";
    if (!form.priority) next.priority = "Priority is required";
    if (form.start_date && form.required_delivery_date && form.start_date > form.required_delivery_date) {
      next.required_delivery_date = "Due date must be on or after start date";
    }
    if ((form.notes || "").length > NOTES_MAX) {
      next.notes = `Notes must be ${NOTES_MAX} characters or fewer`;
    }
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
    notes: (form.notes || "").slice(0, NOTES_MAX),
  });

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!validate()) return;
    if (isEditMode && !canUpdate) {
      addToast("You don't have permission to update job cards.", "error");
      return;
    }
    if (!isEditMode && !canCreate) {
      addToast("You don't have permission to create job cards.", "error");
      return;
    }

    const orderId = Number(form.sales_order_id);
    if (!orderId) return;

    setSaving(true);
    try {
      let res;
      const payload = buildPayload();
      const finalize = form.status === "created";

      if (isEditMode && isCreated) {
        res = await saveSalesJobCard(orderId, payload);
      } else if (finalize) {
        res = await createSalesJobCard(orderId, payload);
      } else {
        res = await saveSalesJobCard(orderId, payload);
      }
      const data = res?.data ?? res;
      const f = data?.form || {};
      addToast(isEditMode ? "Job card updated successfully." : "Job card created successfully.", "success");
      resetForm();
      onSaved?.(data);
      if (f.job_card_no) {
        setForm((prev) => ({ ...prev, job_card_no: f.job_card_no }));
      }
    } catch (err) {
      const detail = extractApiErrorDetail(err);
      const message = applyApiFieldErrors(detail, setErrors);
      addToast(message || apiErrorMessage(err, "Failed to save job card."), "error");
    } finally {
      setSaving(false);
    }
  };

  if (!canCreate && !canUpdate) return null;

  const disabled = loadingMeta || loadingEdit || saving;
  const previewJobCardNo = form.job_card_no || (isEditMode ? "" : "Auto-generated");

  return (
    <form className="my-job-card-entry" onSubmit={handleSubmit} noValidate>
      <div className="my-job-card-entry__grid">
        <div className="my-job-card-entry__field">
          <Input
            label="Job Card No."
            value={previewJobCardNo}
            disabled
            readOnly
            className="w-full"
            aria-label="Job card number"
          />
        </div>
        <div className="my-job-card-entry__field">
          <Select
            label="Sales Order"
            required
            error={errors.sales_order_id}
            value={form.sales_order_id}
            onChange={(e) => handleSalesOrderChange(e.target.value)}
            disabled={disabled || isEditMode}
            className="w-full"
          >
            <option value="">Select Sales Order</option>
            {salesOrderOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="my-job-card-entry__field">
          <Select
            label="Customer"
            required
            error={errors.customer_id}
            value={form.customer_id}
            onChange={(e) => patch("customer_id", e.target.value)}
            disabled={disabled || readOnlyCore}
            className="w-full"
          >
            <option value="">Select Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="my-job-card-entry__field">
          <Select
            label="Product"
            required
            error={errors.product_id}
            value={form.product_id}
            onChange={(e) => patch("product_id", e.target.value)}
            disabled={disabled || readOnlyCore}
            className="w-full"
          >
            <option value="">Select Product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.sku}
              </option>
            ))}
          </Select>
        </div>
        <div className="my-job-card-entry__field">
          <Input
            label="Planned Qty"
            type="number"
            min="0"
            step="any"
            required
            error={errors.quantity}
            value={form.quantity}
            onChange={(e) => patch("quantity", e.target.value)}
            disabled={disabled || readOnlyCore}
            className="w-full"
          />
        </div>
        <div className="my-job-card-entry__field">
          <Select
            label="Priority"
            required
            error={errors.priority}
            value={form.priority}
            onChange={(e) => patch("priority", e.target.value)}
            disabled={disabled}
            className="w-full"
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="my-job-card-entry__field">
          <DatePicker
            label="Start Date"
            value={form.start_date}
            onChange={(v) => patch("start_date", v)}
            disabled={disabled || readOnlyCore}
            error={errors.start_date}
          />
        </div>
        <div className="my-job-card-entry__field">
          <DatePicker
            label="Due Date"
            required
            value={form.required_delivery_date}
            onChange={(v) => patch("required_delivery_date", v)}
            disabled={disabled || readOnlyCore}
            error={errors.required_delivery_date}
            min={form.start_date || undefined}
          />
        </div>
        <div className="my-job-card-entry__field">
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => patch("status", e.target.value)}
            disabled={disabled || readOnlyCore}
            className="w-full"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="my-job-card-entry__notes">
        <Textarea
          label="Remarks / Notes"
          value={form.notes}
          onChange={(e) => patch("notes", e.target.value)}
          disabled={disabled}
          error={errors.notes}
          rows={3}
          maxLength={NOTES_MAX}
          className="w-full"
          placeholder="Optional notes for this job card"
        />
      </div>

      <div className="my-job-card-entry__actions">
        {isEditMode ? (
          <Button type="button" variant="outline" disabled={saving} onClick={() => onCancelEdit?.()}>
            Cancel Edit
          </Button>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          disabled={disabled}
          leftIcon={<Save className="h-4 w-4" aria-hidden />}
        >
          Save Job Card
        </Button>
      </div>
    </form>
  );
}
