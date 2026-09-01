import { useCallback, useState } from "react";

import { getTeamDirectory } from "../api/adminApi";
import { getSalesOrderDetail } from "../api/salesApi";
import {
  createSalesJobCard,
  getSalesJobCard,
  saveSalesJobCard,
} from "../api/workflowApi";
import { useToast } from "../context/ToastContext";
import { fetchCustomersWithFallback } from "../utils/customerOptions";
import { fetchProductsWithFallback } from "../utils/productOptions";
import { NOTES_MAX } from "../components/manufacturing/jobCardUiShared";

const EMPTY_LINE = () => ({
  id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  product_id: "",
  product_name: "",
  quantity: "",
  unit: "Nos",
  unit_price: "",
  description: "",
});

function mapSoLine(line) {
  return {
    id: line.id ?? line.line_id ?? `so-${line.product_id}-${line.quantity}`,
    product_id: line.product_id ?? "",
    product_name: line.item_description || line.product_name || "",
    quantity: line.quantity ?? "",
    unit: line.unit || "Nos",
    unit_price: line.unit_price ?? line.rate ?? "",
    description: line.description || line.item_description || "",
    fromSalesOrder: true,
  };
}

export function useJobCardDetails(orderId, tenantId) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [card, setCard] = useState(null);
  const [form, setForm] = useState(null);
  const [salesOrder, setSalesOrder] = useState(null);
  const [productLines, setProductLines] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesPeople, setSalesPeople] = useState([]);
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const catalogTasks = [
        fetchCustomersWithFallback(tenantId),
        fetchProductsWithFallback(tenantId),
        getTeamDirectory().catch(() => ({ data: [] })),
      ];
      const cardTasks = orderId
        ? [getSalesJobCard(orderId), getSalesOrderDetail(orderId).catch(() => null)]
        : [];

      const results = await Promise.all([...cardTasks, ...catalogTasks]);
      const custList = results[cardTasks.length];
      const prodList = results[cardTasks.length + 1];
      const usersRes = results[cardTasks.length + 2];

      if (orderId) {
        const cardRes = results[0];
        const soRes = results[1];
        const data = cardRes?.data ?? cardRes;
        setCard(data);
        setForm({ ...(data?.form || {}), notes: data?.form?.notes || "" });

        const soData = soRes?.data ?? soRes;
        const order = soData?.order ?? null;
        const lines = Array.isArray(soData?.line_items) ? soData.line_items : [];
        setSalesOrder(order);
        setProductLines(lines.length ? lines.map(mapSoLine) : [{ ...EMPTY_LINE(), quantity: 1 }]);
      } else {
        setCard(null);
        setForm(null);
        setSalesOrder(null);
        setProductLines([{ ...EMPTY_LINE(), quantity: 1, unit: "pcs" }]);
      }

      setCustomers(Array.isArray(custList) ? custList : []);
      setProducts(Array.isArray(prodList) ? prodList : []);
      const users = usersRes?.data?.items ?? usersRes?.data ?? [];
      setSalesPeople(Array.isArray(users) ? users : []);
      setErrors({});
    } catch (err) {
      if (orderId) {
        addToast(err?.response?.data?.detail || "Could not load job card", "error");
        setCard(null);
        setForm(null);
        setSalesOrder(null);
        setProductLines([]);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId, tenantId, addToast]);

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
    if (!productLines.length) next.product_lines = "At least one product line is required";
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
    if (!validate()) return false;
    setSaving(true);
    try {
      const res = await saveSalesJobCard(orderId, buildPayload());
      const data = res?.data ?? res;
      setCard(data);
      setForm({ ...(data?.form || {}), notes: data?.form?.notes || "" });
      addToast("Job card saved.", "success");
      return true;
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail?.errors) setErrors(detail.errors);
      addToast(typeof detail === "string" ? detail : detail?.message || "Save failed", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!validate()) return false;
    setCreating(true);
    try {
      const res = await createSalesJobCard(orderId, buildPayload());
      const data = res?.data ?? res;
      setCard(data);
      setForm({ ...(data?.form || {}), notes: data?.form?.notes || "" });
      addToast("Job card created successfully.", "success");
      return true;
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail?.errors) setErrors(detail.errors);
      addToast(typeof detail === "string" ? detail : detail?.message || "Create failed", "error");
      return false;
    } finally {
      setCreating(false);
    }
  };

  const addProductLine = () => {
    setProductLines((prev) => [...prev, EMPTY_LINE()]);
    setErrors((prev) => ({ ...prev, product_lines: undefined }));
  };

  const removeProductLine = (index) => {
    setProductLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateProductLine = (index, patch) => {
    setProductLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if (patch.product_id != null) {
          const prod = products.find((p) => String(p.id) === String(patch.product_id));
          if (prod) next.product_name = prod.name || next.product_name;
        }
        return next;
      })
    );
    if (index === 0) {
      if (patch.product_id != null) patchField("product_id", patch.product_id);
      if (patch.quantity != null) patchField("quantity", patch.quantity);
      if (patch.unit != null) patchField("unit", patch.unit);
    }
  };

  const isCreated = Boolean(form?.is_created || card?.job_card_created);

  return {
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
    setProductLines,
  };
}

export default useJobCardDetails;
