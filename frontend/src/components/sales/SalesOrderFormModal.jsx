import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Save, Layers, AlertTriangle } from "lucide-react";
import { createSalesOrder } from "../../api/salesApi";
import { getProductBom } from "../../api/bomApi";
import { getRawMaterials } from "../../api/inventoryApi";
import { fetchCustomersWithFallback, resolveCustomerId } from "../../utils/customerOptions";
import { fetchProductsWithFallback } from "../../utils/productOptions";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import useAuth from "../../hooks/useAuth";
import Loader from "../common/Loader";
import Button, { IconButton } from "../common/Button";

function Field({ label, required, hint, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12px] font-semibold text-[var(--color-text,#1e293b)] dark:text-slate-200">
        {label}
        {required ? <span className="ml-0.5 text-rose-500 font-bold">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-[var(--color-text-muted,#64748b)]">{hint}</p> : null}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs space-y-3 ${className}`.trim()}>
      {title ? (
        <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800/80 pb-2">
          {Icon ? <Icon className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" /> : null}
          <h3 className="text-[12px] font-bold text-[#1a1a1f] dark:text-slate-100 uppercase tracking-wider">{title}</h3>
        </div>
      ) : null}
      {children}
    </section>
  );
}

const inputStyle =
  "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3 py-2 text-[13px] text-slate-800 dark:text-slate-100 transition-colors focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";

export default function SalesOrderFormModal({ onClose, onSave }) {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [bomItems, setBomItems] = useState([]);
  const [rawMaterialsMap, setRawMaterialsMap] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    tenant_id: tenantId,
    customer_id: "",
    order_number: "",
    reference_number: "",
    order_date: new Date().toISOString().slice(0, 10),
    delivery_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    status: "confirmed",
    priority: "medium",
    sales_person: "",
    product_id: "",
    quantity: "1",
    unit: "pcs",
    unit_price: "0",
    total_amount: "0",
  });

  useEffect(() => {
    if (user && !form.sales_person) {
      const name = user.full_name || user.name || user.email || "";
      if (name) setForm((f) => ({ ...f, sales_person: name }));
    }
  }, [user, form.sales_person]);

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

  const finishedGoods = useMemo(() => {
    return (products || []).filter((p) => {
      if (p.is_raw_material || p.item_type === "raw_material") return false;
      const sku = String(p.sku || p.product_code || "").toUpperCase();
      const cat = String(p.category || "").toLowerCase();
      return !sku.startsWith("RAW-") && !sku.startsWith("PKG-") && !sku.startsWith("RM-") && !cat.includes("raw") && !cat.includes("packag");
    });
  }, [products]);

  const rawMaterialsList = useMemo(() => {
    return (products || []).filter((p) => !finishedGoods.includes(p));
  }, [products, finishedGoods]);

  useEffect(() => {
    Promise.all([
      fetchCustomersWithFallback().catch(() => []),
      fetchProductsWithFallback().catch(() => []),
      getRawMaterials().catch(() => ({ data: [] })),
    ])
      .then(([custs, prods, rawRes]) => {
        setCustomers(custs);

        const rawList = Array.isArray(rawRes?.data) ? rawRes.data : Array.isArray(rawRes) ? rawRes : [];
        const rMap = {};
        rawList.forEach((rm) => {
          if (rm.sku) rMap[rm.sku] = rm;
          if (rm.name) rMap[rm.name] = rm;
          if (rm.id) rMap[rm.id] = rm;
        });
        setRawMaterialsMap(rMap);

        // Also check any locally cached raw materials
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

        const combinedProducts = [...(prods || []), ...rawAsProds];
        setProducts(combinedProducts);

        if (combinedProducts.length > 0 && !form.product_id) {
          const first = combinedProducts[0];
          setForm((f) => {
            const price = first.unit_price || first.price || 0;
            const qty = Number(f.quantity) || 1;
            return {
              ...f,
              product_id: String(first.id),
              unit: first.unit || f.unit || "pcs",
              unit_price: String(price),
              total_amount: String(qty * price),
            };
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

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

  const handleProductChange = (prodId) => {
    const selected = products.find((p) => String(p.id) === String(prodId));
    const price = selected ? selected.unit_price || selected.price || 0 : 0;
    const qty = Number(form.quantity) || 1;
    const u = selected?.unit || form.unit || "pcs";
    setForm((f) => ({
      ...f,
      product_id: prodId,
      unit: u,
      unit_price: String(price),
      total_amount: String(qty * price),
    }));
  };

  const handleQuantityChange = (qtyStr) => {
    const qty = Number(qtyStr) || 0;
    const price = Number(form.unit_price) || 0;
    setForm((f) => ({
      ...f,
      quantity: qtyStr,
      total_amount: String(qty * price),
    }));
  };

  const handlePriceChange = (priceStr) => {
    const price = Number(priceStr) || 0;
    const qty = Number(form.quantity) || 0;
    setForm((f) => ({
      ...f,
      unit_price: priceStr,
      total_amount: String(qty * price),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const customerId = await resolveCustomerId(form.customer_id, uniqueCustomers, tenantId);
      const selectedProd = products.find((p) => String(p.id) === String(form.product_id));
      const qty = Number(form.quantity) || 1;
      const price = Number(form.unit_price) || 0;
      const total = qty * price;

      const lineItems = selectedProd
        ? [
            {
              product_id: typeof selectedProd.id === "number" ? selectedProd.id : undefined,
              item_description: selectedProd.name || "Product Item",
              quantity: qty,
              unit: form.unit || selectedProd.unit || "pcs",
              unit_price: price,
              line_total: total,
            },
          ]
        : [];

      await createSalesOrder({
        tenant_id: tenantId,
        customer_id: customerId,
        order_number: form.order_number || `SO-${Date.now()}`,
        reference_number: form.reference_number || undefined,
        order_date: form.order_date,
        delivery_date: form.delivery_date || undefined,
        status: form.status || "confirmed",
        priority: form.priority || "medium",
        sales_person: form.sales_person?.trim() || null,
        total_amount: total || Number(form.total_amount) || 0,
        line_items: lineItems,
      });
      addToast("Sales order created successfully", "success");
      onSave?.();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
          <Loader label="Loading reference data..." />
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-so-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-slate-950 shadow-2xl border border-slate-200/80 dark:border-slate-800"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Clean Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
          <h2 id="create-so-title" className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Create New Sales Order
          </h2>
          <IconButton
            variant="ghost"
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </IconButton>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer & Product Information */}
          <SectionCard>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Customer" required>
                <select
                  required
                  value={form.customer_id}
                  onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                  className={inputStyle}
                >
                  <option value="">Select customer</option>
                  {uniqueCustomers.map((c) => (
                    <option key={c.id || c.name} value={c.id || c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Product / Finished Good" required>
                <select
                  required
                  value={form.product_id}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className={inputStyle}
                >
                  <option value="">Select product</option>
                  {finishedGoods.length > 0 ? (
                    <optgroup label="Finished Goods / Products">
                      {finishedGoods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.sku || p.product_code ? `(${p.sku || p.product_code})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {rawMaterialsList.length > 0 ? (
                    <optgroup label="Raw Materials / Components">
                      {rawMaterialsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.sku || p.product_code ? `(${p.sku || p.product_code})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </Field>
            </div>
          </SectionCard>

          {/* Quantity & Pricing Breakdown */}
          <SectionCard>
            <div className="grid grid-cols-3 gap-2.5">
              <Field label="Quantity" required>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={form.quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className={inputStyle}
                />
              </Field>

              <Field label="Unit">
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className={inputStyle}
                />
              </Field>

              <Field label="Unit Price (₹)" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unit_price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  className={inputStyle}
                />
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/40 px-3 py-2">
              <span className="text-[11px] font-semibold text-teal-900 dark:text-teal-200">
                Order Value Calculation
              </span>
              <div className="text-right">
                <span className="text-[11px] text-teal-700/80 dark:text-teal-300/80 mr-2">
                  {form.quantity || 0} {form.unit} × ₹{form.unit_price || 0} =
                </span>
                <span className="text-sm font-bold text-teal-800 dark:text-teal-100">
                  ₹ {Number(form.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </SectionCard>

          {/* Live BOM Raw Material Preview */}
          {bomItems.length > 0 ? (
            <SectionCard title="Required Raw Materials (BOM Check)" icon={Layers}>
              <p className="text-[10px] text-slate-500">
                Component stock for {form.quantity} {form.unit}.
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
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
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs shadow-2xs dark:border-slate-800 dark:bg-slate-800/50"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate font-semibold text-slate-800 dark:text-slate-100 text-[11px]">
                          {b.component_name || b.component || "Raw Material"}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">{b.component_sku || "—"}</p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2.5 tabular-nums text-right">
                        <div>
                          <p className="text-[10px] text-slate-500">Required</p>
                          <p className="font-semibold text-slate-700 dark:text-slate-200 text-[11px]">
                            {reqQty.toLocaleString("en-IN")} {b.unit || "Pcs"}
                          </p>
                        </div>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            isShortage
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          }`}
                        >
                          {isShortage
                            ? `Shortage (${availableStock})`
                            : `In Stock (${availableStock})`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          ) : null}

          {/* Schedule, Routing & Workflow */}
          <SectionCard>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field label="Order Number">
                <input
                  type="text"
                  value={form.order_number}
                  onChange={(e) => setForm((f) => ({ ...f, order_number: e.target.value }))}
                  placeholder="Auto-generated if empty"
                  className={inputStyle}
                />
              </Field>

              <Field label="Reference Number">
                <input
                  type="text"
                  value={form.reference_number}
                  onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
                  placeholder="e.g. PO-8921"
                  className={inputStyle}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Field label="Order Date">
                <input
                  type="date"
                  value={form.order_date}
                  onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))}
                  className={inputStyle}
                />
              </Field>

              <Field label="Target Delivery Date">
                <input
                  type="date"
                  value={form.delivery_date}
                  onChange={(e) => setForm((f) => ({ ...f, delivery_date: e.target.value }))}
                  className={inputStyle}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <Field label="Sales Person">
                <input
                  type="text"
                  value={form.sales_person}
                  onChange={(e) => setForm((f) => ({ ...f, sales_person: e.target.value }))}
                  placeholder="Salesperson"
                  className={inputStyle}
                />
              </Field>

              <Field label="Priority">
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  className={inputStyle}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </Field>

              <Field label="Workflow Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className={inputStyle}
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="draft">Draft</option>
                </select>
              </Field>
            </div>
          </SectionCard>

          {/* Sticky Bottom Actions Bar */}
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pt-4 shrink-0">
            <div>
              <span className="text-xs text-slate-400">Total Order Value: </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 ml-1">
                ₹ {Number(form.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={saving || !form.customer_id || !form.product_id}
                loading={saving}
                leftIcon={!saving ? <Save className="h-4 w-4" aria-hidden /> : undefined}
              >
                {saving ? "Saving…" : "Save & Create Sales Order"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
