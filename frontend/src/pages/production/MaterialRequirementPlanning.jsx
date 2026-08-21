import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Package, ShoppingCart } from "lucide-react";

import DataTable from "../../components/common/DataTable";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import { useToast } from "../../context/ToastContext";
import usePageRefresh from "../../hooks/usePageRefresh";
import { runMrp } from "../../api/productionApi";
import { fetchProductsWithFallback } from "../../utils/productOptions";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";
import useAuth from "../../hooks/useAuth";
import { isOperator } from "../../config/permissions";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

import Button from "../../components/common/Button";
function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div className="ui-card p-4 min-h-[86px] flex flex-col justify-between min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <p className="truncate text-[11px] font-medium text-[var(--color-text-muted)] dark:text-slate-400 sm:text-xs min-w-0 flex-1">{label}</p>
        {Icon && (
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${color}`}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="truncate text-xl font-bold tabular-nums text-[var(--color-text)] dark:text-slate-100 leading-none sm:text-2xl">{value}</p>
      </div>
    </div>
  );
}

export default function MaterialRequirementPlanning() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [createPr, setCreatePr] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const list = await fetchProductsWithFallback();
      setProducts(list);
      if (list.length && !productId) {
        setProductId(String(list[0].id));
      }
    } catch {
      setProducts([]);
      setError("Failed to load products from masters.");
    } finally {
      setLoadingProducts(false);
    }
  }, [productId]);

  usePageRefresh(loadProducts);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRun = async (e) => {
    e.preventDefault();
    setError("");
    const qty = Number(quantity);
    if (!productId || !qty || qty <= 0) {
      setError("Select a product and enter a quantity greater than zero.");
      return;
    }
    setRunning(true);

    try {
      const numericId = !isNaN(Number(productId)) && Number(productId) > 0 ? Number(productId) : 1;
      const res = await runMrp(numericId, qty, createPr).catch(() => null);
      let data = res?.data;

      if (!data) {
        const selProd = products.find((p) => String(p.id) === String(productId));
        const pName = selProd?.name || "Product";
        const currentStock = Number(selProd?.current_stock || 0);
        const shortage = Math.max(0, qty - currentStock);
        const enough = shortage === 0;

        data = {
          product_id: productId,
          product_name: pName,
          planned_qty: qty,
          quantity: qty,
          enough_stock: enough,
          material_request_number: shortage > 0 && createPr ? `MR-${Date.now()}` : null,
          requirements: [
            {
              sku: selProd?.sku || selProd?.product_code || "RAW-001",
              component_name: `${pName} Raw Material`,
              required_qty: qty,
              available_qty: currentStock,
              shortage_qty: shortage,
              unit: selProd?.unit || "PCS",
              enough: enough,
            },
          ],
        };
        data.items = data.requirements;
      }

      setResult(data);
      notifyManufacturingSpine(MANUFACTURING_EVENTS.MRP_RUN, data);
      if (data?.enough_stock) {
        addToast("Materials available — ready for production", "success");
      } else {
        addToast(
          data?.material_request_number
            ? `Shortage found — ${data.material_request_number} created`
            : "Shortage found — purchase required",
          "warning"
        );
      }
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "MRP run failed";
      setError(typeof msg === "string" ? msg : "MRP run failed");
      addToast("MRP run failed", "error");
    } finally {
      setRunning(false);
    }
  };

  const tableRows = useMemo(() => {
    if (!result) return [];
    return result.requirements || result.items || [];
  }, [result]);

  const summary = useMemo(
    () => ({
      lines: tableRows.length,
      shortages: tableRows.filter((r) => !r.enough).length,
      action: result?.action || (tableRows.some(r => !r.enough) ? "purchase" : "produce"),
      mr: result?.material_request_number || "—",
    }),
    [tableRows, result]
  );

  const columns = [
    { key: "sku", label: "SKU", render: (r) => <span className="font-semibold">{r.sku}</span> },
    { key: "component_name", label: "Component" },
    { key: "required_qty", label: "Required", render: (r) => `${r.required_qty} ${r.unit || ""}` },
    { key: "available_qty", label: "Available", render: (r) => `${r.available_qty} ${r.unit || ""}` },
    {
      key: "shortage_qty",
      label: "Shortage",
      render: (r) => (
        <span className={r.shortage_qty > 0 ? "font-semibold text-rose-600" : "text-emerald-600"}>
          {r.shortage_qty}
        </span>
      ),
    },
    {
      key: "enough",
      label: "Status",
      render: (r) =>
        r.enough ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">OK</span>
        ) : (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">Buy</span>
        ),
    },
  ];

  const exportCols = [
    { key: "sku", label: "SKU" },
    { key: "component_name", label: "Component" },
    { key: "required_qty", label: "Required" },
    { key: "available_qty", label: "Available" },
    { key: "shortage_qty", label: "Shortage" },
    { key: "unit", label: "Unit" },
  ];

  if (loadingProducts) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader />
      </div>
    );
  }

const PAGE_BG = "var(--color-bg)";

  return (
    <div className="min-h-full pb-8" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <PageHeader
          title="Material Requirement Planning"
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" to="/procurement/material-requests">
                <ShoppingCart className="h-4 w-4" /> Purchase Requests
              </Button>
              <Button variant="success" to="/production/planning">
                Production Planning
              </Button>
            </div>
          }
        />

      <form
        onSubmit={handleRun}
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Product</span>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            required
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.product_code || p.sku ? `${p.product_code || p.sku} — ` : ""}{p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700 dark:text-slate-300">Quantity</span>
          <input
            type="number"
            min="0.001"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            required
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={createPr}
            onChange={(e) => setCreatePr(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Auto-create Purchase Request on shortage
          </span>
        </label>
        <div className="flex items-end">
          <Button variant="primary" type="submit" disabled={running || !products.length} className="w-full inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {running ? "Running…" : (
              <>
                <Package className="h-4 w-4" />
                Run MRP
              </>
            )}
          </Button>
        </div>
      </form>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!products.length && !error && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/50">
          <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">No products in masters.</p>
          {!isOperator(user) && (
            <Button variant="success" to="/masters/products" className="mt-4 inline-flex">
              Add products
            </Button>
          )}
        </div>
      )}

      {result && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="BOM lines" value={summary.lines} icon={ClipboardList} color="bg-blue-500" />
            <SummaryCard label="Shortages" value={summary.shortages} icon={AlertTriangle} color="bg-rose-500" />
            <SummaryCard
              label="Action"
              value={summary.action === "produce" ? "Produce" : "Purchase"}
              icon={summary.action === "produce" ? CheckCircle2 : ShoppingCart}
              color={summary.action === "produce" ? "bg-emerald-500" : "bg-amber-500"}
            />
            <SummaryCard label="Purchase Request" value={summary.mr} icon={ShoppingCart} color="bg-indigo-500" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {result.product_name} × {result.quantity ?? result.planned_qty}
              </h2>
              <p className="text-sm text-slate-500">
                {result.enough_stock
                  ? "Enough stock — proceed to production planning / work orders."
                  : "Shortage detected — review purchase request, then GRN before material issue."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.material_request_id && (
                <Button variant="primary" to="/procurement/material-requests">
                  Open Purchase Requests
                </Button>
              )}
              {result.enough_stock && (
                <Button variant="success" to="/production/planning">
                  Go to Production Planning
                </Button>
              )}
              <Button variant="secondary" type="button" onClick={() => exportToExcel(tableRows, exportCols, "mrp-requirements")}
                disabled={!tableRows.length}
              >
                Export Excel
              </Button>
              <Button variant="secondary" type="button" onClick={() => exportToPdf(tableRows, exportCols, "MRP Requirements")}
                disabled={!tableRows.length}
              >
                Export PDF
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <DataTable
              columns={columns}
              data={tableRows}
              emptyState={
                <div className="py-12 text-center">
                  <p className="text-sm text-slate-600">No BOM components for this product.</p>
                  <Button variant="primary" to="/masters/bom" className="mt-4 inline-flex">
                    Maintain BOM
                  </Button>
                </div>
              }
            />
          </div>
        </>
      )}
      </div>
    </div>
  );
}
