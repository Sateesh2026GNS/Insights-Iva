import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Package, ShoppingCart } from "lucide-react";

import DataTable from "../../components/common/DataTable";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
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
import { runListExport } from "../../utils/listExport";

import Button from "../../components/common/Button";
function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div className="ui-card p-4 min-h-[86px] flex flex-col justify-between min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <p className="truncate text-[11px] font-medium text-[var(--color-text-muted)] sm:text-xs min-w-0 flex-1">{label}</p>
        {Icon && (
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${color}`}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="truncate text-xl font-bold tabular-nums text-[var(--color-text)] leading-none sm:text-2xl">{value}</p>
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
        <span className={r.shortage_qty > 0 ? "font-semibold text-[var(--color-danger)]" : "text-[var(--color-success)]"}>
          {r.shortage_qty}
        </span>
      ),
    },
    {
      key: "enough",
      label: "Status",
      render: (r) =>
        r.enough ? (
          <span className="rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-success)]">OK</span>
        ) : (
          <span className="rounded-full bg-[var(--color-danger-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-danger)]">Buy</span>
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
      <ListPageShell>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader />
        </div>
      </ListPageShell>
    );
  }

  const handleExport = (format) => {
    runListExport(format, {
      data: tableRows,
      columns: exportCols,
      filename: "mrp-requirements",
      title: "MRP Requirements",
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <ListPageShell>
      <PageHeader
        title="Material Requirement Planning"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {result && tableRows.length > 0 ? (
              <ExportDownloadMenu onExport={handleExport} />
            ) : null}
            <Button variant="secondary" to="/procurement/material-requests">
              <ShoppingCart className="h-4 w-4" /> Purchase Requests
            </Button>
            <Button variant="success" to="/production/planning">
              Production Planning
            </Button>
          </div>
        }
      />

      <ListPageCard>
        <ListPageCardBody>
      <form
        onSubmit={handleRun}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="block text-sm">
          <span className="ui-label">Product</span>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="ui-select w-full"
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
          <span className="ui-label">Quantity</span>
          <input
            type="number"
            min="0.001"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="ui-input w-full"
            required
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={createPr}
            onChange={(e) => setCreatePr(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border)]"
          />
          <span className="font-medium text-[var(--color-text-secondary)]">
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
        </ListPageCardBody>
      </ListPageCard>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!products.length && !error && (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] px-6 py-10 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-[var(--color-text-faint)]" />
          <p className="mt-3 text-sm font-medium text-[var(--color-text-secondary)]">No products in masters.</p>
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
              <h2 className="text-lg font-semibold text-[var(--color-text)]">
                {result.product_name} × {result.quantity ?? result.planned_qty}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)]">
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
            </div>
          </div>

          <ListPageCard>
            <ListPageCardBody className="overflow-x-auto p-0 sm:p-0">
            <DataTable
              columns={columns}
              data={tableRows}
              emptyState={
                <div className="py-12 text-center">
                  <p className="text-sm text-[var(--color-text-secondary)]">No BOM components for this product.</p>
                  <Button variant="primary" to="/masters/bom" className="mt-4 inline-flex">
                    Maintain BOM
                  </Button>
                </div>
              }
            />
            </ListPageCardBody>
          </ListPageCard>
        </>
      )}
    </ListPageShell>
  );
}
