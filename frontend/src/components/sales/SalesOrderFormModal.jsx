import { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Save, Layers, AlertTriangle, ClipboardList } from "lucide-react";
import { createSalesOrder } from "../../api/salesApi";
import { getTeamDirectory } from "../../api/adminApi";
import { getProductBom } from "../../api/bomApi";
import { getRawMaterials } from "../../api/inventoryApi";
import {
  fetchCustomersWithFallback,
  resolveCustomerId,
  invalidateReferenceCache,
} from "../../utils/customerOptions";
import { fetchProductsWithFallback } from "../../utils/productOptions";
import { apiErrorMessage } from "../../utils/apiError";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import useAuth from "../../hooks/useAuth";
import { userCanAction } from "../../config/permissions";
import { PRODUCT_UNITS } from "../../data/productsMasterData";
import Loader from "../common/Loader";
import Button, { IconButton } from "../common/Button";
import SearchableSelect from "../common/SearchableSelect";
import AddNewPartyModal from "./AddNewPartyModal";
import AddNewItemModal from "./AddNewItemModal";

const ADD_CUSTOMER_VALUE = "__add_customer__";
const ADD_PRODUCT_VALUE = "__add_product__";

const CUSTOMER_FOOTER = [{ value: ADD_CUSTOMER_VALUE, label: "+ Add Customer" }];
const PRODUCT_FOOTER = [{ value: ADD_PRODUCT_VALUE, label: "+ Add Product" }];

const UNIT_OPTIONS = PRODUCT_UNITS.map((u) => ({ value: u, label: u }));

function inputClass(hasError = false) {
  return `ui-input w-full${hasError ? " is-error" : ""}`;
}

function selectClass(hasError = false) {
  return `ui-select w-full${hasError ? " is-error" : ""}`;
}

function Field({ label, required, hint, error, children, className = "", id }) {
  const errorId = id ? `${id}-error` : undefined;
  return (
    <div className={`space-y-1.5 ${className}`.trim()}>
      <label htmlFor={id} className="ui-label block">
        {label}
        {required ? <span className="text-[var(--color-danger)]"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      {!error && hint ? <p className="text-[11px] text-[var(--color-text-muted)]">{hint}</p> : null}
    </div>
  );
}

function buildProductsFromApi(prods, rawRes) {
  const rawList = Array.isArray(rawRes?.data) ? rawRes.data : Array.isArray(rawRes) ? rawRes : [];
  const rMap = {};
  rawList.forEach((rm) => {
    if (rm.sku) rMap[rm.sku] = rm;
    if (rm.name) rMap[rm.name] = rm;
    if (rm.id) rMap[rm.id] = rm;
  });

  let localRaw = [];
  try {
    const stored = localStorage.getItem("smrt_products");
    if (stored) {
      const parsed = JSON.parse(stored);
      localRaw = (Array.isArray(parsed) ? parsed : []).filter(
        (p) =>
          p &&
          (p.item_type === "raw_material" ||
            String(p.sku || "").toUpperCase().startsWith("RM-") ||
            String(p.sku || "").toUpperCase().startsWith("RAW-"))
      );
    }
  } catch {}

  const allRawItems = [...rawList, ...localRaw];
  const existingIds = new Set((prods || []).map((p) => String(p.id)));
  const existingSkus = new Set(
    (prods || []).map((p) => String(p.sku || p.product_code || p.name || "").trim().toLowerCase()).filter(Boolean)
  );

  const rawAsProds = allRawItems
    .map((rm) => ({
      id: rm.id || `rm-${rm.sku}`,
      name: rm.name,
      sku: rm.sku,
      product_code: rm.sku,
      category: rm.category || "Raw Materials",
      unit: rm.unit || "KG",
      unit_price: rm.unit_cost || rm.price || 0,
      is_raw_material: true,
      item_type: "raw_material",
    }))
    .filter(
      (rm) =>
        !existingIds.has(String(rm.id)) &&
        !existingSkus.has(String(rm.sku || rm.name || "").trim().toLowerCase())
    );

  return {
    combinedProducts: [...(prods || []), ...rawAsProds],
    rMap,
  };
}

function validateForm(form) {
  const errors = {};
  if (!form.customer_id) errors.customer_id = "Please select a customer.";
  if (!form.product_id) errors.product_id = "Please select a product or finished good.";

  const qty = Number(form.quantity);
  if (!form.quantity?.trim() || Number.isNaN(qty) || qty <= 0) {
    errors.quantity = "Enter a quantity greater than zero.";
  }

  const price = Number(form.unit_price);
  if (form.unit_price === "" || Number.isNaN(price) || price < 0) {
    errors.unit_price = "Enter a valid unit price (0 or greater).";
  }

  if (form.order_date && form.delivery_date && form.delivery_date < form.order_date) {
    errors.delivery_date = "Target delivery date cannot be earlier than the order date.";
  }

  return errors;
}

function formatOrderNumberFallback() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SO-${stamp}-${suffix}`;
}

export default function SalesOrderFormModal({ onClose, onSave }) {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { addToast } = useToast();
  const canEditSalesPerson = userCanAction(user, "sales", "update");

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesPeople, setSalesPeople] = useState([]);
  const [bomItems, setBomItems] = useState([]);
  const [rawMaterialsMap, setRawMaterialsMap] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  const defaultSalesPerson = user?.full_name || user?.name || user?.email || "";

  const [form, setForm] = useState({
    tenant_id: tenantId,
    customer_id: "",
    order_number: "",
    reference_number: "",
    order_date: new Date().toISOString().slice(0, 10),
    delivery_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    status: "draft",
    priority: "medium",
    sales_person: defaultSalesPerson,
    product_id: "",
    quantity: "1",
    unit: "PCS",
    unit_price: "",
    total_amount: "0",
  });

  const clearFieldError = (key) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const uniqueCustomers = useMemo(() => {
    const map = new Map();
    (customers || []).forEach((c) => {
      const displayName = c.company || c.name || c.customer_name;
      const cleanName = String(displayName || "").trim();
      const lower = cleanName.toLowerCase();
      if (cleanName && cleanName.length >= 2 && !map.has(lower)) {
        map.set(lower, { ...c, id: c.id || cleanName, name: cleanName });
      }
    });
    return Array.from(map.values());
  }, [customers]);

  const customerOptions = useMemo(
    () => uniqueCustomers.map((c) => ({ value: String(c.id || c.name), label: c.name })),
    [uniqueCustomers]
  );

  const finishedGoods = useMemo(() => {
    return (products || []).filter((p) => {
      if (p.is_raw_material || p.item_type === "raw_material") return false;
      const sku = String(p.sku || p.product_code || "").toUpperCase();
      const cat = String(p.category || "").toLowerCase();
      return (
        !sku.startsWith("RAW-") &&
        !sku.startsWith("PKG-") &&
        !sku.startsWith("RM-") &&
        !cat.includes("raw") &&
        !cat.includes("packag")
      );
    });
  }, [products]);

  const rawMaterialsList = useMemo(() => {
    return (products || []).filter((p) => !finishedGoods.includes(p));
  }, [products, finishedGoods]);

  const productOptions = useMemo(() => {
    const fg = finishedGoods.map((p) => ({
      value: String(p.id),
      label: `${p.name}${p.sku || p.product_code ? ` (${p.sku || p.product_code})` : ""}`,
    }));
    const rm = rawMaterialsList.map((p) => ({
      value: String(p.id),
      label: `[Component] ${p.name}${p.sku || p.product_code ? ` (${p.sku || p.product_code})` : ""}`,
    }));
    return [...fg, ...rm];
  }, [finishedGoods, rawMaterialsList]);

  const salesPersonOptions = useMemo(() => {
    const names = new Map();
    if (defaultSalesPerson) names.set(defaultSalesPerson, defaultSalesPerson);
    (salesPeople || []).forEach((u) => {
      const label = u.full_name || u.name || u.email;
      if (label) names.set(label, label);
    });
    return Array.from(names.values()).map((name) => ({ value: name, label: name }));
  }, [salesPeople, defaultSalesPerson]);

  const unitOptions = useMemo(() => {
    const set = new Set(PRODUCT_UNITS);
    if (form.unit) set.add(String(form.unit).toUpperCase());
    return Array.from(set).map((u) => ({ value: u, label: u }));
  }, [form.unit]);

  const orderTotal = useMemo(() => {
    const qty = Number(form.quantity) || 0;
    const price = Number(form.unit_price) || 0;
    return qty * price;
  }, [form.quantity, form.unit_price]);

  const refreshCustomers = useCallback(async () => {
    invalidateReferenceCache("customers");
    const custs = await fetchCustomersWithFallback({ force: true }).catch(() => []);
    setCustomers(custs);
    return custs;
  }, []);

  const refreshProducts = useCallback(async () => {
    invalidateReferenceCache("products");
    invalidateReferenceCache("raw_materials_options");
    const [prods, rawRes] = await Promise.all([
      fetchProductsWithFallback({ force: true }).catch(() => []),
      getRawMaterials().catch(() => ({ data: [] })),
    ]);
    const { combinedProducts, rMap } = buildProductsFromApi(prods, rawRes);
    setRawMaterialsMap(rMap);
    setProducts(combinedProducts);
    return combinedProducts;
  }, []);

  useEffect(() => {
    Promise.all([
      fetchCustomersWithFallback().catch(() => []),
      fetchProductsWithFallback().catch(() => []),
      getRawMaterials().catch(() => ({ data: [] })),
      getTeamDirectory()
        .then((r) => r?.data?.items ?? r?.data ?? r ?? [])
        .catch(() => []),
    ])
      .then(([custs, prods, rawRes, team]) => {
        setCustomers(custs);
        setSalesPeople(Array.isArray(team) ? team : []);

        const { combinedProducts, rMap } = buildProductsFromApi(prods, rawRes);
        setRawMaterialsMap(rMap);
        setProducts(combinedProducts);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCustomerSelect = (val) => {
    if (val === ADD_CUSTOMER_VALUE) {
      setShowAddCustomerModal(true);
      return;
    }
    setForm((f) => ({ ...f, customer_id: val }));
    clearFieldError("customer_id");
  };

  const handleCustomerCreated = async (buyer) => {
    setShowAddCustomerModal(false);
    if (!buyer) return;
    try {
      await refreshCustomers();
      const newId = buyer.id ?? buyer.customer_id;
      if (newId != null && newId !== "") {
        setForm((f) => ({ ...f, customer_id: String(newId) }));
        clearFieldError("customer_id");
      }
    } catch {
      setCustomers((rows) => [buyer, ...rows.filter((c) => c.id !== buyer.id)]);
      if (buyer.id != null) {
        setForm((f) => ({ ...f, customer_id: String(buyer.id) }));
        clearFieldError("customer_id");
      }
    }
  };

  const handleProductChange = (prodId) => {
    const selected = products.find((p) => String(p.id) === String(prodId));
    const price = selected ? selected.unit_price || selected.price || 0 : 0;
    const qty = Number(form.quantity) || 1;
    const u = selected?.unit ? String(selected.unit).toUpperCase() : form.unit || "PCS";
    setForm((f) => ({
      ...f,
      product_id: prodId,
      unit: u,
      unit_price: String(price),
      total_amount: String(qty * price),
    }));
    clearFieldError("product_id");
  };

  const handleProductSelect = (val) => {
    if (val === ADD_PRODUCT_VALUE) {
      setShowAddProductModal(true);
      return;
    }
    handleProductChange(val);
  };

  const handleProductCreated = async (line, product) => {
    setShowAddProductModal(false);
    const newId = product?.id ?? line?.product_id;
    if (newId == null || newId === "") return;

    const applySelection = (selected) => {
      const price = selected?.unit_price || selected?.price || Number(line?.rate) || 0;
      const qty = Number(form.quantity) || 1;
      const u = selected?.unit || line?.unit || form.unit || "PCS";
      setForm((f) => ({
        ...f,
        product_id: String(newId),
        unit: String(u).toUpperCase(),
        unit_price: String(price),
        total_amount: String(qty * price),
      }));
      clearFieldError("product_id");
    };

    try {
      const combinedProducts = await refreshProducts();
      const selected =
        combinedProducts.find((p) => String(p.id) === String(newId)) || product || null;
      applySelection(selected);
    } catch {
      if (product) {
        setProducts((rows) => [product, ...rows.filter((p) => String(p.id) !== String(product.id))]);
      }
      applySelection(product);
    }
  };

  useEffect(() => {
    if (!form.product_id) {
      setBomItems([]);
      return;
    }
    const pid = Number(form.product_id);
    if (!pid || Number.isNaN(pid)) {
      setBomItems([]);
      return;
    }

    getProductBom(pid)
      .then((res) => {
        const data = res?.data ?? res;
        const items = data?.items || data?.bom_items || (Array.isArray(data) ? data : []);
        setBomItems(Array.isArray(items) ? items : []);
      })
      .catch(() => setBomItems([]));
  }, [form.product_id]);

  const handleQuantityChange = (qtyStr) => {
    if (qtyStr !== "" && !/^\d*\.?\d*$/.test(qtyStr)) return;
    const qty = Number(qtyStr) || 0;
    const price = Number(form.unit_price) || 0;
    setForm((f) => ({
      ...f,
      quantity: qtyStr,
      total_amount: String(qty * price),
    }));
    if (qty > 0) clearFieldError("quantity");
  };

  const handlePriceChange = (priceStr) => {
    if (priceStr !== "" && !/^\d*\.?\d*$/.test(priceStr)) return;
    const price = Number(priceStr) || 0;
    const qty = Number(form.quantity) || 0;
    setForm((f) => ({
      ...f,
      unit_price: priceStr,
      total_amount: String(qty * price),
    }));
    if (priceStr !== "" && !Number.isNaN(price) && price >= 0) clearFieldError("unit_price");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    setError("");
    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const customerId = await resolveCustomerId(form.customer_id, uniqueCustomers, tenantId);
      const selectedProd = products.find((p) => String(p.id) === String(form.product_id));
      const qty = Number(form.quantity) || 1;
      const price = Number(form.unit_price) || 0;
      const total = qty * price;
      const orderNumber = form.order_number?.trim() || formatOrderNumberFallback();

      const lineItems = selectedProd
        ? [
            {
              product_id: typeof selectedProd.id === "number" ? selectedProd.id : undefined,
              item_description: selectedProd.name || "Product Item",
              quantity: qty,
              unit: form.unit || selectedProd.unit || "PCS",
              unit_price: price,
              line_total: total,
            },
          ]
        : [];

      await createSalesOrder({
        tenant_id: tenantId,
        customer_id: customerId,
        order_number: orderNumber,
        reference_number: form.reference_number?.trim() || undefined,
        order_date: form.order_date,
        delivery_date: form.delivery_date || undefined,
        status: form.status || "draft",
        priority: form.priority || "medium",
        sales_person: form.sales_person?.trim() || null,
        total_amount: total,
        line_items: lineItems,
      });
      addToast("Sales Order created successfully", "success");
      onSave?.();
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to create sales order. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl">
          <Loader label="Loading reference data..." />
        </div>
      </div>,
      document.body
    );
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-so-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
    >
      <div
        className="flex max-h-[min(90vh,820px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </div>
            <h2 id="create-so-title" className="truncate text-base font-bold text-[var(--color-text)] sm:text-lg">
              Create New Sales Order
            </h2>
          </div>
          <IconButton
            variant="ghost"
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
            className="shrink-0"
          >
            <X className="h-5 w-5" />
          </IconButton>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3 py-2.5 text-xs text-[var(--color-danger)]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Customer" required error={fieldErrors.customer_id} id="so-customer">
                <SearchableSelect
                  id="so-customer"
                  value={form.customer_id}
                  onChange={handleCustomerSelect}
                  options={customerOptions}
                  footerOptions={CUSTOMER_FOOTER}
                  placeholder="Select customer"
                  searchPlaceholder="Search customers…"
                  error={Boolean(fieldErrors.customer_id)}
                  menuClassName="z-[120]"
                  className="!min-h-[var(--control-h-lg)] !rounded-[var(--radius-md)] !bg-[var(--color-surface-muted)] !py-2.5 !text-sm"
                />
              </Field>

              <Field
                label="Product / Finished Good"
                required
                error={fieldErrors.product_id}
                id="so-product"
              >
                <SearchableSelect
                  id="so-product"
                  value={form.product_id}
                  onChange={handleProductSelect}
                  options={productOptions}
                  footerOptions={PRODUCT_FOOTER}
                  placeholder="Select product"
                  searchPlaceholder="Search products…"
                  error={Boolean(fieldErrors.product_id)}
                  menuClassName="z-[120]"
                  className="!min-h-[var(--control-h-lg)] !rounded-[var(--radius-md)] !bg-[var(--color-surface-muted)] !py-2.5 !text-sm"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Quantity" required error={fieldErrors.quantity} id="so-quantity">
                <input
                  id="so-quantity"
                  type="text"
                  inputMode="decimal"
                  required
                  value={form.quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className={inputClass(Boolean(fieldErrors.quantity))}
                  placeholder="1"
                  aria-invalid={Boolean(fieldErrors.quantity)}
                />
              </Field>

              <Field label="Unit" id="so-unit">
                <SearchableSelect
                  id="so-unit"
                  value={form.unit}
                  onChange={(val) => setForm((f) => ({ ...f, unit: val }))}
                  options={unitOptions.length ? unitOptions : UNIT_OPTIONS}
                  placeholder="Select unit"
                  searchPlaceholder="Search units…"
                  menuClassName="z-[120]"
                  className="!min-h-[var(--control-h-lg)] !rounded-[var(--radius-md)] !bg-[var(--color-surface-muted)] !py-2.5 !text-sm"
                />
              </Field>

              <Field label="Unit Price (₹)" required error={fieldErrors.unit_price} id="so-unit-price">
                <div className="relative">
                  <span
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)]"
                    aria-hidden
                  >
                    ₹
                  </span>
                  <input
                    id="so-unit-price"
                    type="text"
                    inputMode="decimal"
                    value={form.unit_price}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className={`${inputClass(Boolean(fieldErrors.unit_price))} !pl-8`}
                    aria-invalid={Boolean(fieldErrors.unit_price)}
                    placeholder="0.00"
                  />
                </div>
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-3 py-2.5">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">Order total</span>
              <div className="text-right">
                <span className="mr-2 text-[11px] text-[var(--color-text-muted)]">
                  {form.quantity || 0} {form.unit} × ₹{form.unit_price || 0}
                </span>
                <span className="text-base font-bold tabular-nums text-[var(--color-text)]">
                  ₹ {orderTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {bomItems.length > 0 ? (
              <details className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/50">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold text-[var(--color-text)] [&::-webkit-details-marker]:hidden">
                  <Layers className="h-3.5 w-3.5 text-[var(--color-primary)]" aria-hidden />
                  BOM stock check ({bomItems.length} components)
                </summary>
                <div className="max-h-36 space-y-1.5 overflow-y-auto border-t border-[var(--color-border-soft)] px-3 py-2">
                  {bomItems.map((b, idx) => {
                    const reqQty = (Number(b.quantity) || 1) * (Number(form.quantity) || 1);
                    const rawMatch =
                      rawMaterialsMap[b.component_sku] ||
                      rawMaterialsMap[b.component_name] ||
                      rawMaterialsMap[b.component_product_id];
                    const availableStock = rawMatch?.available ?? rawMatch?.quantity ?? 0;
                    const isShortage = availableStock < reqQty;

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[11px]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--color-text)]">
                            {b.component_name || b.component || "Raw Material"}
                          </p>
                          <p className="truncate font-mono text-[10px] text-[var(--color-text-muted)]">
                            {b.component_sku || "—"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            isShortage
                              ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                              : "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                          }`}
                        >
                          {isShortage ? `Short ${availableStock}` : `OK ${availableStock}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </details>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Order Number" hint="Auto-generated if left blank." id="so-order-number">
                <input
                  id="so-order-number"
                  type="text"
                  value={form.order_number}
                  onChange={(e) => setForm((f) => ({ ...f, order_number: e.target.value }))}
                  placeholder="Auto-generated if empty"
                  className={inputClass()}
                  autoComplete="off"
                />
              </Field>

              <Field label="Reference Number" id="so-reference">
                <input
                  id="so-reference"
                  type="text"
                  value={form.reference_number}
                  onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
                  placeholder="e.g. PO-8921"
                  className={inputClass()}
                />
              </Field>

              <Field label="Order Date" id="so-order-date">
                <input
                  id="so-order-date"
                  type="date"
                  value={form.order_date}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, order_date: e.target.value }));
                    clearFieldError("delivery_date");
                  }}
                  className={inputClass()}
                />
              </Field>

              <Field label="Target Delivery Date" error={fieldErrors.delivery_date} id="so-delivery-date">
                <input
                  id="so-delivery-date"
                  type="date"
                  value={form.delivery_date}
                  min={form.order_date || undefined}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, delivery_date: e.target.value }));
                    clearFieldError("delivery_date");
                  }}
                  className={inputClass(Boolean(fieldErrors.delivery_date))}
                  aria-invalid={Boolean(fieldErrors.delivery_date)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Sales Person" id="so-sales-person">
                {canEditSalesPerson ? (
                  <SearchableSelect
                    id="so-sales-person"
                    value={form.sales_person}
                    onChange={(val) => setForm((f) => ({ ...f, sales_person: val }))}
                    options={salesPersonOptions}
                    placeholder="Select sales person"
                    searchPlaceholder="Search team…"
                    menuClassName="z-[120]"
                    className="!min-h-[var(--control-h-lg)] !rounded-[var(--radius-md)] !bg-[var(--color-surface-muted)] !py-2.5 !text-sm"
                  />
                ) : (
                  <input
                    id="so-sales-person"
                    type="text"
                    value={form.sales_person}
                    readOnly
                    className={`${inputClass()} cursor-default opacity-90`}
                    aria-readonly="true"
                  />
                )}
              </Field>

              <Field label="Priority" id="so-priority">
                <select
                  id="so-priority"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  className={selectClass()}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </Field>

              <Field label="Status" hint="Starts as draft or pending." id="so-status">
                <select
                  id="so-status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className={selectClass()}
                >
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3.5 sm:flex-row sm:justify-end">
            <Button type="button" variant="cancel" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving}
              loading={saving}
              leftIcon={!saving ? <Save className="h-4 w-4" aria-hidden /> : undefined}
              aria-busy={saving}
              className="w-full sm:w-auto"
            >
              {saving ? "Creating Sales Order…" : "Save & Create Sales Order"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}
      <AddNewPartyModal
        open={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        onSaved={handleCustomerCreated}
        title="Add Customer"
      />
      <AddNewItemModal
        open={showAddProductModal}
        placement="drawer"
        onClose={() => setShowAddProductModal(false)}
        onSaved={handleProductCreated}
      />
    </>
  );
}
