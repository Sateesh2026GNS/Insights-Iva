import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  Eye,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
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
import { createProduct } from "../../api/productsApi";
import { createSalesOrder } from "../../api/salesApi";
import { getUsers } from "../../api/adminApi";
import { fetchCustomersWithFallback, resolveCustomerId } from "../../utils/customerOptions";
import { fetchProductsWithFallback } from "../../utils/productOptions";
import AddNewPartyModal from "../../components/sales/AddNewPartyModal";
import useTenantId from "../../hooks/useTenantId";
import useAuth from "../../hooks/useAuth";

const UNITS = ["Nos", "nos", "pcs", "kg", "ltr", "box", "set", "mtr"];

import { inputMtClass as inputClass } from "../../design-system/classes";

function emptyLine() {
  return { product_id: "", item_description: "", quantity: "1", unit: "pcs", unit_price: "" };
}

function QuickAddProductModal({ onClose, onAdded }) {
  const tenantId = useTenantId();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit_price, setUnitPrice] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    if (unit_price !== "" && !isNaN(Number(unit_price)) && Number(unit_price) < 0) {
      alert("Price cannot be negative.");
      return;
    }
    setSaving(true);
    try {
      const generatedSku = sku.trim() || `SKU-${Date.now()}`;
      const res = await createProduct({
        tenant_id: Number(tenantId) || 1,
        name: name.trim(),
        sku: generatedSku,
        product_code: generatedSku,
        unit_price: Number(unit_price) || 0,
        unit,
      }).catch(() => null);

      const newProduct = res?.data || {
        id: `local-${Date.now()}`,
        name: name.trim(),
        sku: generatedSku,
        product_code: generatedSku,
        unit_price: Number(unit_price) || 0,
        unit,
        quantity: Number(quantity) || 1,
      };
      onAdded(newProduct);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Quick Add Product</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="block text-xs font-semibold text-slate-600">
          Product Name *
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Steel Rod 10mm" className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          SKU / Code
          <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. SR-10MM" className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-slate-600">
            Unit Price (₹)
            <input type="number" min="0" value={unit_price} onChange={(e) => setUnitPrice(e.target.value)} className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Unit
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Quantity
            <input type="number" min="0.001" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim()}
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          >
            Add Product
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CreateSalesOrder() {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editKey = searchParams.get("edit") || "";
  const isEdit = Boolean(editKey);

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesPeople, setSalesPeople] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddSalesPerson, setShowAddSalesPerson] = useState(false);
  const [newSpName, setNewSpName] = useState("");
  const [newSpEmail, setNewSpEmail] = useState("");
  const [form, setForm] = useState({
    tenant_id: tenantId,
    customer_id: searchParams.get("customer_id") || "",
    order_number: "",
    reference_number: searchParams.get("reference") || "",
    order_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    sales_person: "",
    sales_person_id: "",
    priority: "medium",
    notes: "",
    status: "draft",
  });
  const [lines, setLines] = useState([emptyLine()]);
  const detailsRef = useRef(null);

  const resetForm = () => {
    setForm({
      tenant_id: tenantId,
      customer_id: searchParams.get("customer_id") || "",
      order_number: "",
      reference_number: searchParams.get("reference") || "",
      order_date: new Date().toISOString().slice(0, 10),
      due_date: "",
      sales_person: user?.full_name || user?.name || user?.email || "",
      sales_person_id: user?.id ? String(user.id) : "",
      priority: "medium",
      notes: "",
      status: "draft",
    });
    setLines([emptyLine()]);
    setError("");
  };

  const handleViewOrder = () => {
    if (isEdit && editKey) {
      const stored = localStorage.getItem("smrt_sales_orders");
      const localOrders = stored ? JSON.parse(stored) : [];
      const so = localOrders.find(
        (o) => String(o.order_number || o.so_number).toLowerCase() === editKey.toLowerCase()
      );
      if (so?.id) {
        navigate(`/sales/orders/${so.id}`);
        return;
      }
    }
    navigate("/sales/orders");
  };

  const handleEditOrder = () => {
    detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleAddLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
  };

  const handleDeleteDraft = () => {
    if (!window.confirm("Discard this sales order draft? Unsaved changes will be lost.")) return;
    if (isEdit) {
      navigate("/sales/orders");
      return;
    }
    resetForm();
  };

  useEffect(() => {
    if (!editKey && user && !form.sales_person) {
      const name = user.full_name || user.name || user.email || "";
      const id = user.id ? String(user.id) : "";
      if (name) {
        setForm((f) => ({
          ...f,
          sales_person: name,
          sales_person_id: id || f.sales_person_id,
        }));
      }
    }
  }, [user, editKey, form.sales_person]);

  useEffect(() => {
    Promise.all([
      fetchCustomersWithFallback().catch(() => []),
      fetchProductsWithFallback().catch(() => []),
      getUsers().catch(() => ({ data: [] })),
    ])
      .then(([custs, prods, usersRes]) => {
        setCustomers(custs);
        setProducts(Array.isArray(prods) ? prods : []);
        const users = usersRes?.data?.items ?? usersRes?.data ?? [];
        setSalesPeople(Array.isArray(users) ? users : []);

        if (editKey) {
          const stored = localStorage.getItem("smrt_sales_orders");
          const localOrders = stored ? JSON.parse(stored) : [];
          const so = localOrders.find(
            (o) => String(o.order_number || o.so_number).toLowerCase() === editKey.toLowerCase()
          );
          if (so) {
            const matchedCust = custs.find(
              (c) =>
                String(c.id) === String(so.customer_id) ||
                String(c.name).toLowerCase() === String(so.customer_name || "").toLowerCase()
            );
            setForm({
              tenant_id: tenantId,
              customer_id: matchedCust ? String(matchedCust.id) : so.customer_id || "",
              order_number: so.order_number || so.so_number || "",
              reference_number: so.reference_number || "",
              order_date: String(so.order_date || so.so_date || "").slice(0, 10),
              due_date: String(so.due_date || "").slice(0, 10),
              sales_person: so.sales_person || "",
              sales_person_id: so.sales_person_id || "",
              priority: so.priority || "medium",
              notes: so.notes || "",
              status: so.status || "draft",
            });
            if (so.line_items?.length) {
              setLines(
                so.line_items.map((l) => ({
                  product_id: String(l.product_id || ""),
                  item_description: l.item_description || "",
                  quantity: String(l.quantity || "1"),
                  unit: l.unit || "pcs",
                  unit_price: String(l.unit_price || ""),
                }))
              );
            }
          }
        }
      })
      .catch(() => setError("Could not load customers/products."))
      .finally(() => setLoading(false));
  }, [editKey, tenantId]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === String(form.customer_id)),
    [customers, form.customer_id]
  );

  const primaryLine = lines[0] || emptyLine();
  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(primaryLine.product_id)),
    [products, primaryLine.product_id]
  );

  const productCode = selectedProduct?.product_code || selectedProduct?.sku || "";
  const customerName = selectedCustomer?.name || selectedCustomer?.company || "";
  const soPreview = form.order_number?.trim() || "Auto-generated";
  const uom = primaryLine.unit || "Nos";

  const totalAmount = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0),
    [lines]
  );

  const workflowCurrentStage = {
    stage_label: "Sales Orders",
    stage_hint: isEdit ? "Update order details and product lines" : "Add product lines and create order",
  };

  const timeline = useMemo(() => {
    const actor = form.sales_person || user?.full_name || user?.name || "Sales Team";
    const now = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (isEdit && form.status === "confirmed") {
      return [
        {
          key: "so-confirmed",
          title: "Sales Order Confirmed",
          status: "completed",
          display_time: now,
          actor: "Sales Team",
        },
        {
          key: "jc-pending",
          title: "Job Card Created",
          status: "pending",
          actor: "System",
        },
      ];
    }
    return [
      {
        key: "so-draft",
        title: isEdit ? "Sales Order Updated" : "Sales Order Draft",
        status: "completed",
        display_time: now,
        actor,
      },
    ];
  }, [form.sales_person, form.status, isEdit, user]);

  const statusBadge = useMemo(() => {
    if (form.status === "confirmed") return { label: "Sales Confirmed", variant: "confirmed" };
    if (isEdit) return { label: "Draft", variant: "draft" };
    return { label: "Draft", variant: "draft" };
  }, [form.status, isEdit]);

  const patchField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateLine = (index, patch) => {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        if (patch.product_id !== undefined) {
          const product = products.find((p) => String(p.id) === String(patch.product_id));
          if (product) {
            next.item_description = product.name || product.title || "";
            const price = product.unit_price ?? product.price_per_unit ?? product.selling_price ?? product.price;
            if (price != null && price !== "") next.unit_price = String(price);
            if (product.unit || product.unit_of_measure) {
              next.unit = product.unit || product.unit_of_measure;
            }
          }
        }
        return next;
      })
    );
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError("");
    const validLines = lines.filter((l) => l.item_description && Number(l.quantity) > 0);
    if (!validLines.length) {
      setError("Add at least one product line.");
      return;
    }
    if (!form.customer_id) {
      setError("Customer is required.");
      return;
    }
    setSaving(true);

    const custName = customerName || "Customer";
    const soNo = form.order_number?.trim() || `SO-${Date.now()}`;
    const soDate = form.order_date || new Date().toISOString().slice(0, 10);

    let createdId = `so-${Date.now()}`;

    if (!isEdit) {
      try {
        const customerId = await resolveCustomerId(form.customer_id, customers, tenantId);
        const res = await createSalesOrder({
          ...form,
          customer_id: customerId,
          order_number: soNo,
          delivery_date: form.due_date || null,
          sales_person: form.sales_person?.trim() || null,
          total_amount: totalAmount,
          line_items: validLines.map((l) => {
            const qty = Number(l.quantity);
            const price = Number(l.unit_price) || 0;
            return {
              product_id: Number(l.product_id) || null,
              item_description: l.item_description,
              quantity: qty,
              unit: l.unit || "pcs",
              unit_price: price,
              line_total: Math.round(qty * price * 100) / 100,
            };
          }),
        });
        if (res?.data?.id) createdId = res.data.id;
      } catch {
        /* local fallback */
      }
    }

    const newSO = {
      id: createdId,
      order_number: soNo,
      so_number: soNo,
      customer_name: custName,
      customer_id: form.customer_id,
      order_date: soDate,
      so_date: soDate,
      due_date: form.due_date || "",
      sales_person: form.sales_person?.trim() || "",
      sales_person_id: form.sales_person_id || "",
      reference_number: form.reference_number || "",
      priority: form.priority || "medium",
      notes: form.notes || "",
      total_amount: totalAmount,
      amount: totalAmount,
      status: isEdit ? form.status || "draft" : "pending",
      line_items: validLines.map((l) => ({
        product_id: l.product_id,
        item_description: l.item_description,
        quantity: Number(l.quantity),
        unit: l.unit || "pcs",
        unit_price: Number(l.unit_price) || 0,
        line_total: (Number(l.quantity) || 0) * (Number(l.unit_price) || 0),
      })),
      items_count: validLines.length,
      created_at: new Date().toISOString(),
    };

    const stored = localStorage.getItem("smrt_sales_orders");
    const localOrders = stored ? JSON.parse(stored) : [];
    const updated = isEdit
      ? localOrders.map((o) =>
          String(o.order_number || o.so_number).toLowerCase() === editKey.toLowerCase() ? newSO : o
        )
      : [newSO, ...localOrders.filter((o) => String(o.order_number || o.so_number) !== soNo)];
    localStorage.setItem("smrt_sales_orders", JSON.stringify(updated));

    setSaving(false);
    navigate("/sales/orders");
  };

  if (loading) return <Loader label="Loading..." />;

  const notesLen = (form.notes || "").length;

  return (
    <>
      <div className="min-h-full bg-[var(--color-bg)]">
        <form onSubmit={handleSubmit} className="ui-page mx-auto max-w-[1280px] ui-stack pb-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <ClipboardList className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <h1 className="ui-page-title">Sales Order Job Card</h1>
                <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">Create and manage job card from sales order</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm" type="submit" loading={saving} disabled={!form.customer_id}>
                <Save className="mr-1.5 inline h-4 w-4" />
                {isEdit ? "Update Sales Order" : "Create Sales Order"}
              </Button>
              <Button variant="outline" size="sm" to="/sales/orders">
                Cancel
              </Button>
              <StatusBadge label={statusBadge.label} variant={statusBadge.variant} />
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          ) : null}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <JobCardSummary
                jobCardNo="—"
                salesOrderNo={soPreview}
                customer={customerName || "—"}
                product={primaryLine.item_description || selectedProduct?.name || "—"}
                orderQuantity={primaryLine.quantity || "—"}
                requiredDelivery={fmtDeliveryDisplay(form.due_date)}
                priority={form.priority}
                uom={uom}
                headerAction={
                  <JobCardPageMoreMenu
                    menuId="create-so-summary-more"
                    items={[
                      {
                        label: "View",
                        icon: <Eye className="h-4 w-4" strokeWidth={2} />,
                        onClick: handleViewOrder,
                      },
                      {
                        label: "Edit",
                        icon: <Pencil className="h-4 w-4" strokeWidth={2} />,
                        onClick: handleEditOrder,
                      },
                      {
                        label: "Add",
                        icon: <Plus className="h-4 w-4" strokeWidth={2} />,
                        onClick: handleAddLine,
                      },
                      {
                        label: "Delete",
                        icon: <Trash2 className="h-4 w-4" strokeWidth={2} />,
                        danger: true,
                        onClick: handleDeleteDraft,
                      },
                    ]}
                  />
                }
              />

              <article
                ref={detailsRef}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <CardSectionHeader title="Job Card Details" />

                <div className="space-y-4 p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <span className="ui-label mb-1 block">Customer <span className="text-[var(--color-danger)]">*</span></span>
                      <Select
                        required
                        value={form.customer_id}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__add_customer__") {
                            setShowAddCustomer(true);
                            return;
                          }
                          patchField("customer_id", val);
                        }}
                      >
                        <option value="">Select customer</option>
                        <option value="__add_customer__">+ Add New Customer</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name || c.company || c.company_name || c.customer_name || `Customer #${c.id}`}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <span className="ui-label mb-1 block">Sales Person</span>
                      <Select
                        value={form.sales_person_id ?? ""}
                        onChange={(e) => {
                          const id = e.target.value;
                          if (id === "__add_sp__") {
                            setNewSpName(""); setNewSpEmail(""); setShowAddSalesPerson(true);
                            return;
                          }
                          const sp = salesPeople.find((u) => String(u.id) === String(id));
                          patchField("sales_person_id", id);
                          patchField("sales_person", sp?.full_name || sp?.name || form.sales_person);
                        }}
                      >
                        <option value="">Select sales person</option>
                        <option value="__add_sp__">+ Add New Sales Person</option>
                        {salesPeople.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name || u.name || u.email}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <span className="ui-label mb-1 block">Product <span className="text-[var(--color-danger)]">*</span></span>
                      <Select
                        required
                        value={primaryLine.product_id}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__add_product__") {
                            setShowQuickAdd(true);
                            return;
                          }
                          updateLine(0, { product_id: val });
                        }}
                      >
                        <option value="">Select product</option>
                        <option value="__add_product__">+ Add New Product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name || p.title || p.product_code || `Product #${p.id}`} {p.sku || p.product_code ? `(${p.sku || p.product_code})` : ""}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <FormField label="Product Code">
                      <Input value={productCode} readOnly className="!bg-slate-50 !text-slate-600" />
                    </FormField>

                    <FormField label="Order Quantity" required>
                      <div className="flex overflow-hidden rounded-lg border border-slate-200 focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)]">
                        <input
                          type="number"
                          min="0.001"
                          step="any"
                          required
                          value={primaryLine.quantity}
                          onChange={(e) => updateLine(0, { quantity: e.target.value })}
                          className="min-h-[42px] flex-1 border-0 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                        />
                        <span className="flex min-w-[3.5rem] items-center justify-center border-l border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-500">
                          {uom}
                        </span>
                      </div>
                    </FormField>

                    <Select
                      label="Unit"
                      value={primaryLine.unit || "Nos"}
                      onChange={(e) => updateLine(0, { unit: e.target.value })}
                    >
                      {UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </Select>

                    <FormField label="Required Delivery Date" required>
                      <div className="relative">
                        <Input
                          type="date"
                          required
                          value={form.due_date}
                          onChange={(e) => patchField("due_date", e.target.value)}
                          className="pr-10"
                        />
                        <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                      </div>
                    </FormField>

                    <FormField label="Priority" required>
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
                    </FormField>

                    <FormField label="Order number">
                      <Input
                        value={form.order_number}
                        onChange={(e) => patchField("order_number", e.target.value)}
                        placeholder="Auto-generated if empty"
                      />
                    </FormField>

                    <FormField label="Reference number">
                      <Input
                        value={form.reference_number}
                        onChange={(e) => patchField("reference_number", e.target.value)}
                      />
                    </FormField>

                    <FormField label="Order date">
                      <Input
                        type="date"
                        value={form.order_date}
                        onChange={(e) => patchField("order_date", e.target.value)}
                      />
                    </FormField>

                    <FormField label="Total">
                      <Input value={`₹${totalAmount.toLocaleString("en-IN")}`} readOnly className="!bg-slate-50 !font-semibold" />
                    </FormField>
                  </div>

                  {customers.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No customers yet.{" "}
                      <Link to="/masters/customers" className="font-medium text-[var(--color-primary)] hover:underline">
                        Add a customer first
                      </Link>
                      .
                    </p>
                  ) : null}

                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-800">Product lines *</h4>
                      <button
                        type="button"
                        onClick={() => setLines((prev) => [...prev, emptyLine()])}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)]"
                      >
                        <Plus className="h-4 w-4" /> Add line
                      </button>
                    </div>
                    {lines.map((line, index) => (
                      <div
                        key={index}
                        className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-12"
                      >
                        <label className="block text-xs font-medium text-slate-600 sm:col-span-4">
                          Product
                          <select
                            value={line.product_id}
                            onChange={(e) => updateLine(index, { product_id: e.target.value })}
                            className={inputClass}
                          >
                            <option value="">Select</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.product_code || p.sku ? `${p.product_code || p.sku} — ` : ""}
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                          Qty
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            required
                            value={line.quantity}
                            onChange={(e) => updateLine(index, { quantity: e.target.value })}
                            className={inputClass}
                          />
                        </label>
                        <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                          Unit
                          <select value={line.unit} onChange={(e) => updateLine(index, { unit: e.target.value })} className={inputClass}>
                            {UNITS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                          Unit price
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unit_price}
                            onChange={(e) => updateLine(index, { unit_price: e.target.value })}
                            className={inputClass}
                          />
                        </label>
                        <label className="block text-xs font-medium text-slate-600 sm:col-span-1">
                          Description
                          <input
                            type="text"
                            required
                            value={line.item_description}
                            onChange={(e) => updateLine(index, { item_description: e.target.value })}
                            className={inputClass}
                          />
                        </label>
                        <div className="flex items-end sm:col-span-1">
                          <button
                            type="button"
                            disabled={lines.length === 1}
                            onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                            className="rounded-lg border border-rose-200 p-2.5 text-rose-600 disabled:opacity-40"
                            title="Remove line"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {!products.length ? (
                      <p className="text-sm text-amber-700">
                        No products yet.{" "}
                        <button type="button" onClick={() => setShowQuickAdd(true)} className="font-semibold text-[var(--color-primary)] underline">
                          Add a product
                        </button>{" "}
                        to get started.
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setShowQuickAdd(true)}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add New Product
                    </button>
                  </div>

                  <div>
                    <Textarea
                      label="Notes / Remarks"
                      placeholder="Enter notes or special instructions..."
                      rows={4}
                      maxLength={NOTES_MAX}
                      value={form.notes || ""}
                      onChange={(e) => patchField("notes", e.target.value)}
                    />
                    <p className="mt-1 text-right text-[11px] tabular-nums text-slate-400">
                      {notesLen} / {NOTES_MAX}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                    <Button variant="primary" type="submit" loading={saving} disabled={!form.customer_id}>
                      <Plus className="mr-1.5 inline h-4 w-4" />
                      {isEdit ? "Update Sales Order" : "Create Sales Order"}
                    </Button>
                    <Button variant="outline" to="/sales/orders">
                      <ArrowLeft className="mr-1.5 inline h-4 w-4" />
                      Back to Sales Orders
                    </Button>
                  </div>
                </div>
              </article>
            </div>

            <div className="space-y-4">
              <JobCardWorkflowStatus steps={JOB_CARD_WORKFLOW_STEPS} currentStage={workflowCurrentStage} />
              <JobCardTimeline events={timeline} />
            </div>
          </div>
        </form>
      </div>

      {showQuickAdd ? (
        <QuickAddProductModal
          onClose={() => setShowQuickAdd(false)}
          onAdded={(newProduct) => {
            setProducts((prev) => [newProduct, ...prev]);
            setLines((prev) => {
              const last = prev[prev.length - 1];
              const isBlank = !last.product_id && !last.item_description;
              const patch = {
                product_id: newProduct.id,
                item_description: newProduct.name,
                unit_price: String(newProduct.unit_price || ""),
                unit: newProduct.unit || "pcs",
                quantity: String(newProduct.quantity || "1"),
              };
              return isBlank
                ? prev.map((l, i) => (i === prev.length - 1 ? { ...l, ...patch } : l))
                : [...prev, { ...emptyLine(), ...patch }];
            });
          }}
        />
      ) : null}

      <AddNewPartyModal
        open={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onSaved={(cust) => {
          if (!cust) return;
          fetchCustomersWithFallback().then((custs) => {
            setCustomers(custs);
            patchField("customer_id", String(cust.id || custs[0]?.id || ""));
          });
        }}
      />

      {/* ─── Add Sales Person Quick Modal ─── */}
      {showAddSalesPerson ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add Sales Person</h3>
              <button
                type="button"
                onClick={() => setShowAddSalesPerson(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block text-xs font-semibold text-slate-600">
              Full Name *
              <input
                type="text"
                value={newSpName}
                onChange={(e) => setNewSpName(e.target.value)}
                placeholder="e.g. Ravi Kumar"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                autoFocus
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Email (optional)
              <input
                type="email"
                value={newSpEmail}
                onChange={(e) => setNewSpEmail(e.target.value)}
                placeholder="e.g. ravi@company.com"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddSalesPerson(false)}
                className="rounded-xl border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newSpName.trim()}
                onClick={() => {
                  const id = `sp-local-${Date.now()}`;
                  const newSp = {
                    id,
                    full_name: newSpName.trim(),
                    name: newSpName.trim(),
                    email: newSpEmail.trim() || "",
                  };
                  setSalesPeople((prev) => [newSp, ...prev]);
                  patchField("sales_person_id", id);
                  patchField("sales_person", newSp.full_name);
                  setShowAddSalesPerson(false);
                }}
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
