import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Button from "../common/Button";
import SearchableSelect from "../common/SearchableSelect";
import { Input, Select, Textarea } from "../common/FormField";
import { DatePicker } from "../../design-system/dateControls";
import { LoadingState, ErrorState } from "../common/states";
import useAuth from "../../hooks/useAuth";
import usePermissions from "../../hooks/usePermissions";
import useManualJobCardMasters from "../../hooks/useManualJobCardMasters";
import { getCompanySettings } from "../../api/settingsApi";
import {
  createManualJobCard,
  getManualJobCard,
  updateManualJobCard,
} from "../../api/workflowApi";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage, extractApiErrorDetail } from "../../utils/apiError";
import {
  ADD_CUSTOMER_VALUE,
  ADD_PRODUCT_VALUE,
  buildManualPayload,
  emptyManualForm,
  emptyProductLine,
  emptySpecLine,
  getUomOptions,
  MANUAL_JOB_CARD_SAVED_STATUS,
  manualFormFromApi,
  mapApiErrors,
  PAYMENT_TERMS_OPTIONS,
  PRIORITY_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
  SPEC_PARAMETER_OPTIONS,
  validateManualForm,
} from "../../utils/manualSalesJobCard";
import { formatCompanyAddress, resolveCompanyLogoUrl, resolveCompanyTagline } from "../../utils/salesJobCardDocument";
import QuickAddCustomerModal from "./QuickAddCustomerModal";
import QuickAddProductModal from "./QuickAddProductModal";
import "../../styles/sales-job-card-document.css";
import "../../styles/manual-sales-job-card-form.css";

function FieldError({ error }) {
  if (!error) return null;
  return <p className="manual-sjc__error">{error}</p>;
}

function EditableFieldRow({ label, required, error, children }) {
  return (
    <div className="sjc-doc__field-row manual-sjc__field-row">
      <span className="sjc-doc__field-label">
        {label}
        {required ? " *" : ""}
      </span>
      <span className="manual-sjc__field-input">
        {children}
        <FieldError error={error} />
      </span>
    </div>
  );
}

function formatCustomerAddress(customer) {
  return [customer?.address_line1, customer?.address, customer?.city, customer?.state, customer?.pincode]
    .filter(Boolean)
    .join(", ");
}

function formatSalesOrderDate(order) {
  const raw = order?.order_date || order?.created_at || "";
  return raw ? String(raw).slice(0, 10) : "—";
}

function workflowStatusLabel(status) {
  const normalized = String(status || "").toUpperCase();
  if (!normalized || normalized === "SAVED") return MANUAL_JOB_CARD_SAVED_STATUS;
  if (normalized === "RETURNED_TO_SALES") return "Returned to Sales";
  if (normalized === "SENT") return "Sent";
  return status || MANUAL_JOB_CARD_SAVED_STATUS;
}

const compactSelectClass = "manual-sjc__select";

export default function ManualSalesJobCardForm({ jobCardId = null, backTo = "/my-job-cards?dept=sales" }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const isEdit = Boolean(jobCardId);

  const {
    customers,
    products,
    salesOrders,
    loading: mastersLoading,
    error: mastersError,
    reloadCustomers,
    reloadProducts,
    reloadAll,
  } = useManualJobCardMasters();

  const canAddCustomer = can("sales") || can("masters");
  const canAddProduct = can("sales");

  const [form, setForm] = useState(() => emptyManualForm(user?.full_name || user?.name || ""));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState("");
  const [workflowStatus, setWorkflowStatus] = useState("SAVED");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addProductRowIndex, setAddProductRowIndex] = useState(null);

  const uomOptions = useMemo(() => getUomOptions().map((u) => ({ value: u, label: u })), []);
  const paymentTermsOptions = useMemo(
    () => PAYMENT_TERMS_OPTIONS.map((t) => ({ value: t, label: t })),
    []
  );
  const categoryOptions = useMemo(
    () => PRODUCT_CATEGORY_OPTIONS.map((c) => ({ value: c, label: c })),
    []
  );
  const specParameterOptions = useMemo(
    () => SPEC_PARAMETER_OPTIONS.map((p) => ({ value: p, label: p })),
    []
  );

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: String(c.id),
        label: c.name || c.company || c.customer_name || `Customer #${c.id}`,
      })),
    [customers]
  );

  const customerFooterOptions = useMemo(
    () => (canAddCustomer ? [{ value: ADD_CUSTOMER_VALUE, label: "+ Add Customer" }] : []),
    [canAddCustomer]
  );

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: String(p.id),
        label: [p.name, p.sku || p.product_code].filter(Boolean).join(" · ") || `Product #${p.id}`,
      })),
    [products]
  );

  const productFooterOptions = useMemo(
    () => (canAddProduct ? [{ value: ADD_PRODUCT_VALUE, label: "+ Add Product" }] : []),
    [canAddProduct]
  );

  const salesOrderOptions = useMemo(
    () =>
      salesOrders.map((o) => {
        const soNo = o.order_number || `SO-${o.id}`;
        const customer = o.customer_name || o.buyer_company || "—";
        const date = formatSalesOrderDate(o);
        const status = o.status || o.order_status || "—";
        return {
          value: String(o.id),
          label: `${soNo} · ${customer} · ${date} · ${status}`,
        };
      }),
    [salesOrders]
  );

  const customerSelectValue = useMemo(() => {
    if (selectedCustomerId) return selectedCustomerId;
    const name = form.customer.customer_name?.trim();
    if (!name) return "";
    const match = customers.find(
      (c) => String(c.name || c.company || "").toLowerCase() === name.toLowerCase()
    );
    return match ? String(match.id) : name;
  }, [selectedCustomerId, form.customer.customer_name, customers]);

  const salesOrderSelectValue = useMemo(() => {
    if (selectedSalesOrderId) return selectedSalesOrderId;
    const soNo = form.header.sales_order_no?.trim();
    if (!soNo) return "";
    const match = salesOrders.find(
      (o) => String(o.order_number || "").toLowerCase() === soNo.toLowerCase()
    );
    return match ? String(match.id) : soNo;
  }, [selectedSalesOrderId, form.header.sales_order_no, salesOrders]);

  const patch = useCallback((path, value) => {
    setDirty(true);
    setForm((prev) => {
      const next = { ...prev };
      const [section, key] = path.includes(".") ? path.split(".") : [null, path];
      if (section && key) {
        next[section] = { ...prev[section], [key]: value };
      } else {
        next[path] = value;
      }
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  const applyCustomerFromMaster = useCallback((customer) => {
    if (!customer) return;
    setDirty(true);
    setSelectedCustomerId(String(customer.id));
    setForm((prev) => ({
      ...prev,
      customer: {
        ...prev.customer,
        customer_name: customer.name || customer.company || customer.customer_name || "",
        contact_person: customer.contact_name || customer.contact_person || prev.customer.contact_person,
        phone: customer.phone || prev.customer.phone,
        email: customer.email || prev.customer.email,
        billing_address: formatCustomerAddress(customer) || prev.customer.billing_address,
      },
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next["customer.customer_name"];
      return next;
    });
  }, []);

  const applyProductToRow = useCallback((index, product) => {
    if (!product) return;
    setDirty(true);
    setForm((prev) => {
      const lines = [...prev.product_lines];
      lines[index] = {
        ...lines[index],
        product_id: String(product.id),
        product_code: product.sku || product.product_code || lines[index].product_code,
        product_name: product.name || lines[index].product_name,
        description: product.description || lines[index].description,
        uom: product.unit || product.uom || lines[index].uom || "Nos",
      };
      return { ...prev, product_lines: lines };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`product_lines.${index}.product_name`];
      delete next[`product_lines.${index}.uom`];
      return next;
    });
  }, []);

  const handleCustomerSelect = useCallback(
    (val) => {
      if (val === ADD_CUSTOMER_VALUE) {
        setShowAddCustomer(true);
        return;
      }
      const customer = customers.find((c) => String(c.id) === String(val));
      if (customer) {
        applyCustomerFromMaster(customer);
      } else {
        setSelectedCustomerId("");
        patch("customer.customer_name", val);
      }
    },
    [customers, applyCustomerFromMaster, patch]
  );

  const handleSalesOrderSelect = useCallback(
    (val) => {
      const order = salesOrders.find((o) => String(o.id) === String(val));
      if (order) {
        setSelectedSalesOrderId(String(order.id));
        patch("header.sales_order_no", order.order_number || `SO-${order.id}`);
      } else {
        setSelectedSalesOrderId("");
        patch("header.sales_order_no", val);
      }
    },
    [salesOrders, patch]
  );

  const handleProductSelect = useCallback(
    (index, val) => {
      if (val === ADD_PRODUCT_VALUE) {
        setAddProductRowIndex(index);
        setShowAddProduct(true);
        return;
      }
      const product = products.find((p) => String(p.id) === String(val));
      if (product) {
        applyProductToRow(index, product);
      } else {
        setDirty(true);
        setForm((prev) => {
          const lines = [...prev.product_lines];
          lines[index] = { ...lines[index], product_id: "", product_name: val };
          return { ...prev, product_lines: lines };
        });
      }
    },
    [products, applyProductToRow]
  );

  const getProductSelectValue = useCallback(
    (row) => {
      if (row.product_id) return row.product_id;
      const name = row.product_name?.trim();
      if (!name) return "";
      const match = products.find((p) => String(p.name || "").toLowerCase() === name.toLowerCase());
      return match ? String(match.id) : name;
    },
    [products]
  );

  useEffect(() => {
    getCompanySettings()
      .then((res) => setCompanyProfile(res?.data?.data ?? res?.data ?? null))
      .catch(() => setCompanyProfile(null));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    setLoadError("");
    getManualJobCard(jobCardId)
      .then((res) => {
        const data = res?.data ?? res;
        setForm(manualFormFromApi(data));
        setWorkflowStatus(data?.workflow_status || data?.workflow_stage || "SAVED");
      })
      .catch((err) => setLoadError(apiErrorMessage(err, "Could not load job card.")))
      .finally(() => setLoading(false));
  }, [isEdit, jobCardId]);

  const addProductLine = () => {
    setDirty(true);
    setForm((prev) => ({
      ...prev,
      product_lines: [...prev.product_lines, emptyProductLine(prev.product_lines.length)],
    }));
  };

  const removeProductLine = (index) => {
    setDirty(true);
    setForm((prev) => {
      const lines = prev.product_lines.filter((_, i) => i !== index);
      return {
        ...prev,
        product_lines: lines.length ? lines.map((r, i) => ({ ...r, sl_no: i + 1 })) : [emptyProductLine(0)],
      };
    });
  };

  const patchProductLine = (index, key, value) => {
    setDirty(true);
    setForm((prev) => {
      const lines = [...prev.product_lines];
      lines[index] = { ...lines[index], [key]: value };
      return { ...prev, product_lines: lines };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`product_lines.${index}.${key}`];
      delete next.product_lines;
      return next;
    });
  };

  const addSpecLine = () => {
    setDirty(true);
    setForm((prev) => ({
      ...prev,
      technical_specifications: [
        ...prev.technical_specifications,
        emptySpecLine(prev.technical_specifications.length),
      ],
    }));
  };

  const removeSpecLine = (index) => {
    setDirty(true);
    setForm((prev) => ({
      ...prev,
      technical_specifications: prev.technical_specifications
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, sl_no: i + 1 })),
    }));
  };

  const patchSpecLine = (index, key, value) => {
    setDirty(true);
    setForm((prev) => {
      const specs = [...prev.technical_specifications];
      specs[index] = { ...specs[index], [key]: value };
      return { ...prev, technical_specifications: specs };
    });
  };

  const handleCustomerCreated = async (created) => {
    await reloadCustomers();
    if (created) applyCustomerFromMaster(created);
  };

  const handleProductCreated = async (created) => {
    await reloadProducts();
    const idx = addProductRowIndex ?? 0;
    if (created) applyProductToRow(idx, created);
    setAddProductRowIndex(null);
  };

  const handleCancel = () => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    navigate(backTo);
  };

  const handleSave = async () => {
    if (saving) return;
    const validation = validateManualForm(form);
    if (Object.keys(validation).length) {
      setErrors(validation);
      addToast("Please fix the highlighted fields.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = buildManualPayload(form);
      const res = isEdit
        ? await updateManualJobCard(jobCardId, payload)
        : await createManualJobCard(payload);
      const data = res?.data ?? res;
      addToast(
        isEdit
          ? "Job card saved. Use Actions → Send when ready to route it."
          : "Job card created. Status: Saved. Use Actions → Send to route to Store Manager.",
        "success"
      );
      const id = data?.job_card_id || data?.id || jobCardId;
      navigate(id ? `/my-job-cards?dept=sales&jc=${id}` : backTo, { replace: true });
    } catch (err) {
      const detail = extractApiErrorDetail(err);
      const apiErrors = mapApiErrors(detail);
      if (Object.keys(apiErrors).length) setErrors(apiErrors);
      addToast(apiErrorMessage(err, "Failed to save job card."), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading job card…" className="py-16" />;
  }
  if (loadError) {
    return (
      <ErrorState title="Could not load job card" description={loadError} onRetry={() => window.location.reload()} />
    );
  }

  const companyName =
    companyProfile?.company_name || companyProfile?.legal_name || companyProfile?.name || "";
  const companyAddress = formatCompanyAddress(companyProfile);
  const logoUrl = resolveCompanyLogoUrl(companyProfile);
  const tagline = resolveCompanyTagline(companyProfile);
  const statusDisplay = isEdit ? workflowStatusLabel(workflowStatus) : MANUAL_JOB_CARD_SAVED_STATUS;

  const customerEmptyLabel =
    !mastersLoading && customerOptions.length === 0
      ? canAddCustomer
        ? "No customers found — use + Add Customer"
        : "No customers found"
      : "Select customer…";

  const productEmptyLabel =
    !mastersLoading && productOptions.length === 0
      ? canAddProduct
        ? "No products found — use + Add Product"
        : "No products found"
      : "Select product…";

  return (
    <div className="ui-page ui-stack manual-sjc-page">
      <QuickAddCustomerModal
        open={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onSaved={handleCustomerCreated}
      />
      <QuickAddProductModal
        open={showAddProduct}
        onClose={() => {
          setShowAddProduct(false);
          setAddProductRowIndex(null);
        }}
        onSaved={handleProductCreated}
      />

      <div className="ui-card manual-sjc-page__card">
        <div className="manual-sjc-page__toolbar">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Sales &amp; Manufacturing
            </p>
            <h1 className="text-base font-semibold sm:text-lg">
              {isEdit ? "Edit Sales Job Card" : "Add Sales Job Card"}
            </h1>
          </div>
          <Button variant="secondary" onClick={handleCancel} leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}>
            Cancel
          </Button>
        </div>

        {mastersError ? (
          <div className="border-b border-[var(--color-border-soft)] bg-red-50 px-4 py-2 text-xs text-red-700">
            {mastersError}
            <button type="button" className="ml-2 font-semibold underline" onClick={reloadAll}>
              Retry
            </button>
          </div>
        ) : null}

        <div className="manual-sjc-page__body">
          <div className="sjc-doc manual-sjc-form">
            <div className="sjc-doc__paper">
              <div className="sjc-doc__header-row">
                <div className="sjc-doc__company">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="sjc-doc__logo" />
                  ) : (
                    <div className="sjc-doc__logo-placeholder">LOGO</div>
                  )}
                  <div>
                    <div className="sjc-doc__company-name">{companyName || "Company Name"}</div>
                    {companyAddress ? <div className="sjc-doc__company-address">{companyAddress}</div> : null}
                  </div>
                </div>
                {tagline ? <p className="sjc-doc__tagline">{tagline}</p> : null}
                <div className="sjc-doc__meta">
                  <table className="sjc-doc__meta-grid">
                    <tbody>
                      <tr>
                        <td className="sjc-doc__meta-label">Job Card No.</td>
                        <td className="sjc-doc__meta-value">
                          {form.job_card_no || "Auto-generated on save"}
                        </td>
                      </tr>
                      <tr>
                        <td className="sjc-doc__meta-label">Date</td>
                        <td className="sjc-doc__meta-value">
                          <DatePicker
                            compact
                            value={form.header.job_card_date}
                            onChange={(v) => patch("header.job_card_date", v)}
                            error={errors["header.job_card_date"]}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="sjc-doc__meta-label">Sales Order</td>
                        <td className="sjc-doc__meta-value">
                          <SearchableSelect
                            value={salesOrderSelectValue}
                            onChange={handleSalesOrderSelect}
                            options={salesOrderOptions}
                            placeholder={mastersLoading ? "Loading sales orders…" : "Select sales order…"}
                            searchPlaceholder="Search sales order…"
                            allowCustom
                            disabled={mastersLoading}
                            error={Boolean(errors["header.sales_order_no"])}
                            className={compactSelectClass}
                          />
                          <FieldError error={errors["header.sales_order_no"]} />
                        </td>
                      </tr>
                      <tr>
                        <td className="sjc-doc__meta-label">Customer PO No.</td>
                        <td className="sjc-doc__meta-value">
                          <Input
                            value={form.header.customer_po_no}
                            onChange={(e) => patch("header.customer_po_no", e.target.value)}
                            className="sjc-doc__input"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="sjc-doc__meta-label">Status</td>
                        <td className="sjc-doc__meta-value">
                          <span className="manual-sjc__status-pill">{statusDisplay}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="sjc-doc__title-band">SALES JOB CARD</div>

              <div className="sjc-doc__columns">
                <div className="sjc-doc__panel">
                  <div className="sjc-doc__panel-title">Customer Details</div>
                  <div className="sjc-doc__panel-body">
                    <EditableFieldRow label="Customer Name" required error={errors["customer.customer_name"]}>
                      <SearchableSelect
                        value={customerSelectValue}
                        onChange={handleCustomerSelect}
                        options={customerOptions}
                        footerOptions={customerFooterOptions}
                        placeholder={mastersLoading ? "Loading customers…" : customerEmptyLabel}
                        searchPlaceholder="Search customer…"
                        allowCustom
                        disabled={mastersLoading}
                        error={Boolean(errors["customer.customer_name"])}
                        className={compactSelectClass}
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Contact Person" error={errors["customer.contact_person"]}>
                      <Input
                        value={form.customer.contact_person}
                        onChange={(e) => patch("customer.contact_person", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Phone" error={errors["customer.phone"]}>
                      <Input
                        value={form.customer.phone}
                        onChange={(e) => patch("customer.phone", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Email" error={errors["customer.email"]}>
                      <Input
                        type="email"
                        value={form.customer.email}
                        onChange={(e) => patch("customer.email", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Billing Address" error={errors["customer.billing_address"]}>
                      <Textarea
                        rows={2}
                        value={form.customer.billing_address}
                        onChange={(e) => patch("customer.billing_address", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                  </div>
                </div>

                <div className="sjc-doc__panel">
                  <div className="sjc-doc__panel-title">Order Details</div>
                  <div className="sjc-doc__panel-body">
                    <EditableFieldRow label="Sales Order Date" error={errors["order.sales_order_date"]}>
                      <DatePicker
                        compact
                        value={form.order.sales_order_date}
                        onChange={(v) => patch("order.sales_order_date", v)}
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Delivery Date" error={errors["order.delivery_date"]}>
                      <DatePicker
                        compact
                        value={form.order.delivery_date}
                        onChange={(v) => patch("order.delivery_date", v)}
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Product Category">
                      <SearchableSelect
                        value={form.order.product_category}
                        onChange={(v) => patch("order.product_category", v)}
                        options={categoryOptions}
                        placeholder="Select product category…"
                        searchPlaceholder="Search category…"
                        allowCustom
                        className={compactSelectClass}
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="End Use">
                      <Input
                        value={form.order.end_use}
                        onChange={(e) => patch("order.end_use", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Payment Terms">
                      <SearchableSelect
                        value={form.order.payment_terms}
                        onChange={(v) => patch("order.payment_terms", v)}
                        options={paymentTermsOptions}
                        placeholder="Select payment terms…"
                        searchPlaceholder="Search payment terms…"
                        allowCustom
                        className={compactSelectClass}
                      />
                    </EditableFieldRow>
                    <EditableFieldRow label="Priority">
                      <Select
                        value={form.order.priority}
                        onChange={(e) => patch("order.priority", e.target.value)}
                        className="sjc-doc__input"
                      >
                        {PRIORITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </Select>
                    </EditableFieldRow>
                    <EditableFieldRow label="Remarks">
                      <Textarea
                        rows={2}
                        value={form.order.remarks}
                        onChange={(e) => patch("order.remarks", e.target.value)}
                        className="sjc-doc__input"
                      />
                    </EditableFieldRow>
                  </div>
                </div>
              </div>

              <div className="sjc-doc__table-wrap">
                <div className="sjc-doc__table-caption">Product / Job Details</div>
                {errors.product_lines ? <FieldError error={errors.product_lines} /> : null}
                <table className="sjc-doc__table manual-sjc__editable-table">
                  <thead>
                    <tr>
                      <th>Sl. No.</th>
                      <th>Product</th>
                      <th>Product Code</th>
                      <th>Product Name</th>
                      <th>Description</th>
                      <th className="num">Quantity</th>
                      <th>UOM</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {form.product_lines.map((row, index) => (
                      <tr key={index}>
                        <td className="num">{index + 1}</td>
                        <td>
                          <SearchableSelect
                            value={getProductSelectValue(row)}
                            onChange={(val) => handleProductSelect(index, val)}
                            options={productOptions}
                            footerOptions={productFooterOptions}
                            placeholder={mastersLoading ? "Loading…" : productEmptyLabel}
                            searchPlaceholder="Search product…"
                            allowCustom
                            disabled={mastersLoading}
                            className={compactSelectClass}
                          />
                        </td>
                        <td>
                          <Input
                            value={row.product_code}
                            onChange={(e) => patchProductLine(index, "product_code", e.target.value)}
                            className="sjc-doc__input"
                          />
                        </td>
                        <td>
                          <Input
                            value={row.product_name}
                            onChange={(e) => patchProductLine(index, "product_name", e.target.value)}
                            error={errors[`product_lines.${index}.product_name`]}
                            className="sjc-doc__input"
                          />
                        </td>
                        <td>
                          <Input
                            value={row.description}
                            onChange={(e) => patchProductLine(index, "description", e.target.value)}
                            className="sjc-doc__input"
                          />
                        </td>
                        <td className="num">
                          <Input
                            type="number"
                            min="0.001"
                            step="any"
                            value={row.quantity}
                            onChange={(e) => patchProductLine(index, "quantity", e.target.value)}
                            error={errors[`product_lines.${index}.quantity`]}
                            className="sjc-doc__input"
                          />
                        </td>
                        <td>
                          <SearchableSelect
                            value={row.uom}
                            onChange={(v) => patchProductLine(index, "uom", v)}
                            options={uomOptions}
                            placeholder="Select UOM…"
                            searchPlaceholder="Search UOM…"
                            allowCustom
                            error={Boolean(errors[`product_lines.${index}.uom`])}
                            className={compactSelectClass}
                          />
                          <FieldError error={errors[`product_lines.${index}.uom`]} />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="manual-sjc__remove-btn"
                            onClick={() => removeProductLine(index)}
                            aria-label="Remove product row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="manual-sjc__add-row">
                  <Button variant="outline" size="sm" onClick={addProductLine} leftIcon={<Plus className="h-4 w-4" />}>
                    Add Product
                  </Button>
                </div>
              </div>

              <div className="sjc-doc__table-wrap">
                <div className="sjc-doc__table-caption">Technical Specifications</div>
                <table className="sjc-doc__table manual-sjc__editable-table">
                  <thead>
                    <tr>
                      <th>Sl. No.</th>
                      <th>Parameter</th>
                      <th>Specification</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {form.technical_specifications.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="manual-sjc__empty-spec">
                          No specifications added yet.
                        </td>
                      </tr>
                    ) : (
                      form.technical_specifications.map((row, index) => (
                        <tr key={index}>
                          <td className="num">{index + 1}</td>
                          <td>
                            <SearchableSelect
                              value={row.parameter}
                              onChange={(v) => patchSpecLine(index, "parameter", v)}
                              options={specParameterOptions}
                              placeholder="Select / enter parameter…"
                              searchPlaceholder="Search parameter…"
                              allowCustom
                              className={compactSelectClass}
                            />
                          </td>
                          <td>
                            <Input
                              value={row.specification}
                              onChange={(e) => patchSpecLine(index, "specification", e.target.value)}
                              className="sjc-doc__input"
                              placeholder="Enter specification"
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="manual-sjc__remove-btn"
                              onClick={() => removeSpecLine(index)}
                              aria-label="Remove specification"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className="manual-sjc__add-row">
                  <Button variant="outline" size="sm" onClick={addSpecLine} leftIcon={<Plus className="h-4 w-4" />}>
                    Add Specification
                  </Button>
                </div>
              </div>

              <div className="sjc-doc__approval manual-sjc__approval-edit">
                <table className="sjc-doc__table">
                  <thead>
                    <tr>
                      <th>Prepared By</th>
                      <th>Checked By</th>
                      <th>Approved By</th>
                      <th>Date</th>
                      <th>Customer Acknowledgement</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <Input
                          value={form.approval.prepared_by}
                          onChange={(e) => patch("approval.prepared_by", e.target.value)}
                          className="sjc-doc__input"
                        />
                      </td>
                      <td>
                        <Input
                          value={form.approval.checked_by}
                          onChange={(e) => patch("approval.checked_by", e.target.value)}
                          className="sjc-doc__input"
                        />
                      </td>
                      <td>
                        <Input
                          value={form.approval.approved_by}
                          onChange={(e) => patch("approval.approved_by", e.target.value)}
                          className="sjc-doc__input"
                        />
                      </td>
                      <td>
                        <DatePicker
                          compact
                          value={form.approval.prepared_date}
                          onChange={(v) => patch("approval.prepared_date", v)}
                        />
                      </td>
                      <td>
                        <Input
                          value={form.approval.customer_acknowledgement}
                          onChange={(e) => patch("approval.customer_acknowledgement", e.target.value)}
                          className="sjc-doc__input"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="manual-sjc-page__footer">
          <p className="manual-sjc-page__save-hint" role="note">
            <strong>Save</strong> stores this job card only — it does <strong>not</strong> send it to Store
            Manager or Production. After saving, use <strong>Actions → Send</strong> from My Job Cards to
            route it to the right person.
          </p>
          <div className="manual-sjc-page__footer-actions">
            <Button variant="secondary" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={saving}
              onClick={handleSave}
              leftIcon={<Save className="h-4 w-4" aria-hidden />}
            >
              {saving ? "Saving Job Card…" : "Save Job Card"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
