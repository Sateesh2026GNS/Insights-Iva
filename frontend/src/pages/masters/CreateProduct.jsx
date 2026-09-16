import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function CreateProduct() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const target = location.pathname.startsWith("/products")
      ? "/products?add=1"
      : "/masters/products?add=1";
    navigate(target, { replace: true });
  }, [navigate, location.pathname]);

  return null;
}
/* legacy form below preserved for reference if needed */
function LegacyCreateProduct() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [existingProducts, setExistingProducts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getProducts()
      .then((res) => {
        if (!cancelled && Array.isArray(res?.data)) setExistingProducts(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    setLoading(true);
    getProductDetail(id)
      .then((res) => {
        if (cancelled) return;
        const p = res.data || {};
        setForm({
          product_code: p.product_code || p.code || "",
          name: p.name || "",
          category: p.category || "Finished Goods",
          unit: p.unit || p.unit_of_measure || "Pcs",
          warehouse: p.warehouse || "Main Store",
          min_stock: String(p.min_stock ?? 1),
          max_stock: String(p.max_stock ?? 100),
          current_stock: String(p.current_stock ?? 0),
          description: p.description || "",
          status: p.status || "active",
          _sku: p.sku || "",
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load material.");
          addToast("Could not load material", "error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, addToast]);

  const set = (key, value) => {
    let val = value;
    if (["current_stock", "min_stock", "max_stock"].includes(key) && typeof val === "string") {
      val = val.replace(/^0+(?=[0-9])/, "");
    }
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const numericOk = (v) => v === "" || /^(0|[1-9]\d*)(\.\d+)?$/.test(String(v));

  const autoSku = (name, code) => {
    const base = String(code || name || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24);
    return base || `SKU-${Date.now().toString().slice(-6)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const errs = {};
    if (!form.name.trim()) {
      errs.name = "Material name is required";
    } else if (!/[a-zA-Z0-9]/.test(form.name.trim())) {
      errs.name = "Product Name must contain at least one letter or number";
      const msg = "Product Name must contain at least one letter or number and cannot consist only of special characters.";
      setError(msg);
      addToast(msg, "error");
      return;
    }
    if (!numericOk(form.min_stock)) errs.min_stock = "Enter a valid number";
    if (!numericOk(form.current_stock)) errs.current_stock = "Enter a valid number";
    if (form.current_stock !== "" && !isNaN(Number(form.current_stock)) && Number(form.current_stock) < 0) {
      const msg = "Current Stock cannot be negative.";
      setError(msg);
      addToast(msg, "error");
      return;
    }
    if (form.min_stock !== "" && !isNaN(Number(form.min_stock)) && Number(form.min_stock) < 0) {
      const msg = "Min Stock cannot be negative.";
      setError(msg);
      addToast(msg, "error");
      return;
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    const cleanName = form.name.trim().toLowerCase();
    const dup = existingProducts.find(
      (p) =>
        String(p.id) !== String(id) &&
        p.name &&
        p.name.trim().toLowerCase() === cleanName
    );
    if (dup) {
      const msg = `Product Name "${form.name.trim()}" already exists.`;
      setError(msg);
      addToast(msg, "error");
      return;
    }

    const minStock = Number(form.min_stock) || 0;
    const currentStock = Number(form.current_stock) || 0;
    const maxStock = Number(form.max_stock) || (minStock ? minStock * 10 : 100);
    const sku = (form._sku || "").trim() || autoSku(form.name, form.product_code);

    const catStr = form.category || "Finished Goods";
    const descText = [
      form.description.trim(),
      `Category: ${catStr}`
    ].filter(Boolean).join(" | ");

    const payload = {
      tenant_id: Number(tenantId) || 1,
      sku,
      name: form.name.trim(),
      description: descText,
      category: catStr,
      product_type: catStr,
      unit_cost: null,
      unit_price: null,
      min_stock: minStock,
      current_stock: currentStock,
      max_stock: maxStock,
      unit: form.unit || "Pcs",
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateProduct(id, payload);
        addToast("Material updated", "success");
      } else {
        await createProduct(payload);
        addToast("Material created", "success");
      }
      navigate("/masters/products");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => d.msg || d.message).filter(Boolean).join(", ")
            : isEdit
              ? "Failed to update material."
              : "Failed to create material.";
      setError(msg);
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-slate-500">Loading material…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <Link
        to="/masters/products"
        className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-[var(--color-success)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to materials
      </Link>

      <PageHeader
        title={isEdit ? "Edit Material" : "Add Materials"}
        subtitle="Enter material details on this page, then save."
      />

      <form onSubmit={handleSubmit} className="ui-card space-y-4 p-5 sm:p-6">
        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <FormRow>
          <Input
            label="Material name"
            required
            autoFocus
            placeholder="e.g. HDPE Bottle 500ml"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            error={fieldErrors.name}
          />
          <Input
            label="Material code"
            placeholder="Optional"
            value={form.product_code}
            onChange={(e) => set("product_code", e.target.value)}
          />
        </FormRow>

        <FormRow className="sm:grid-cols-3">
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            options={CATEGORY_OPTIONS}
          />
          <Select
            label="Unit"
            value={form.unit}
            onChange={(e) => set("unit", e.target.value)}
            options={UNIT_OPTIONS}
          />
          <Select
            label="Warehouse"
            value={form.warehouse}
            onChange={(e) => set("warehouse", e.target.value)}
            options={WAREHOUSE_OPTIONS}
          />
        </FormRow>

        <Select
          label="Status"
          value={form.status}
          onChange={(e) => set("status", e.target.value)}
          options={STATUS_OPTIONS}
        />

        <FormRow className="sm:grid-cols-3">
          <Input
            label="Current stock"
            type="number"
            min="0"
            step="1"
            value={form.current_stock}
            onChange={(e) => set("current_stock", e.target.value)}
            error={fieldErrors.current_stock}
          />
          <Input
            label="Min stock"
            type="number"
            min="0"
            step="1"
            value={form.min_stock}
            onChange={(e) => set("min_stock", e.target.value)}
            error={fieldErrors.min_stock}
          />
          <Input
            label="Max stock"
            type="number"
            min="0"
            step="1"
            value={form.max_stock}
            onChange={(e) => set("max_stock", e.target.value)}
          />
        </FormRow>

        <Textarea
          label="Description"
          rows={3}
          placeholder="Optional notes"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Link
            to="/masters/products"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <Button variant="primary" type="submit" disabled={saving} className="min-w-[9rem] disabled:opacity-60">
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add Materials"}
          </Button>
        </div>
      </form>
    </div>
  );
}
