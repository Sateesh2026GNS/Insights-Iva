import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { createPortal } from "react-dom";

import useAuth from "../../hooks/useAuth";
import { isProductionManager } from "../../config/permissions";
import AddNewItemModal from "../../components/sales/AddNewItemModal";
import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { deleteProduct, getProducts } from "../../api/productsApi";
import { computeSummary, enrichApiProduct, getCategoryChartData } from "../../data/productsMasterData";
import { exportToExcel } from "../../utils/exportUtils";
import { apiErrorMessage } from "../../utils/apiError";

import { theme } from "../../styles/theme";

import Button from "../../components/common/Button";
const PAGE_BG = theme.bg;
const PAGE_SIZES = [20, 50, 100];

const SCREENSHOT_DEMO = [];

function blankOr(value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s || s === "—") return "";
  return s;
}

function DeleteConfirmModal({ open, onClose, onConfirm, busy = false }) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(e) => {
        if (!busy && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl bg-white px-8 py-8 text-center shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 grid h-[72px] w-[72px] place-items-center rounded-full bg-[#fee2e2]">
          <Trash2 className="h-9 w-9 text-[#ef4444]" strokeWidth={1.75} />
        </div>
        <h3 className="text-[28px] font-bold leading-tight text-[#1a1a1f]">Delete Product?</h3>
        <p className="mt-3 text-[14px] leading-relaxed text-[#5a5a66]">
          Are you sure you want to delete this Product?
        </p>
        <div className="mt-7 grid grid-cols-2 gap-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl bg-[#eceef4] py-3 text-[15px] font-semibold text-[#1a1a1f] disabled:opacity-60"
          >
            No
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm?.()}
            className="rounded-xl bg-[#ef5350] py-3 text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ProductsMaster() {
  const { user } = useAuth();
  const isPM = isProductionManager(user);
  const { addToast } = useToast();
  const { pathname } = useLocation();
  const pageTitle = pathname.startsWith("/inventory") ? "Inventory" : "Products";

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProducts();
      const rows = Array.isArray(res.data) ? res.data : [];
      setProducts(rows.map((row) => enrichApiProduct(row)));
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.description, p.hsn_code, p.unit, p.category, p.sku]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [products, query]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const summary = useMemo(() => computeSummary(products), [products]);
  const categoryChart = useMemo(() => getCategoryChartData(products), [products]);

  const onExport = () => {
    exportToExcel(
      filtered,
      [
        { key: "name", label: "Product Name" },
        { key: "category", label: "Category" },
        { key: "description", label: "Description" },
        { key: "hsn_code", label: "HSN" },
        { key: "unit", label: "Unit" },
        { key: "selling_price", label: "Price" },
        { key: "gst_percent", label: "GST Tax" },
        { key: "cess_percent", label: "CESS %" },
      ],
      "products"
    );
    addToast("Exported to Excel", "success");
  };

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return;
    const rawId = deleting.id;
    const numericId = typeof rawId === "number" ? rawId : Number(rawId);
    const canCallApi = Number.isFinite(numericId) && String(rawId) !== "demo-product";
    setDeleteBusy(true);
    try {
      if (canCallApi) {
        if (pathname.startsWith("/inventory")) {
          const { deleteInventoryV2Item } = await import("../../api/inventoryV2Api");
          await deleteInventoryV2Item(numericId);
        } else {
          await deleteProduct(numericId);
        }
      }
      setProducts((prev) => prev.filter((p) => String(p.id) !== String(rawId)));
      setDeleting(null);
      addToast("Product deleted", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not delete product. It may be linked to other records."), "error");
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading) return <Loader label="Loading products..." />;

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">

        {/* Summary Cards */}
        <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-[#e8e8ee] bg-white p-4 shadow-sm">
            <p className="text-[12px] font-semibold text-[#6b6b76]">Total Products</p>
            <p className="mt-1 text-2xl font-bold text-[#1a1a1f]">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-[#e8e8ee] bg-white p-4 shadow-sm">
            <p className="text-[12px] font-semibold text-[#6b6b76]">Categories</p>
            <p className="mt-1 text-2xl font-bold text-[#1a1a1f]">{summary.categories}</p>
          </div>
          <div className="rounded-xl border border-[#e8e8ee] bg-white p-4 shadow-sm">
            <p className="text-[12px] font-semibold text-[#6b6b76]">Active Products</p>
            <p className="mt-1 text-2xl font-bold text-[#22c55e]">{summary.active}</p>
          </div>
          <div className="rounded-xl border border-[#e8e8ee] bg-white p-4 shadow-sm">
            <p className="text-[12px] font-semibold text-[#6b6b76]">Low Stock</p>
            <p className="mt-1 text-2xl font-bold text-[#f59e0b]">{summary.lowStock}</p>
          </div>
        </div>

        <div className="ui-card p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative ui-search-wrap min-w-[10rem] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-icon)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="ui-input !rounded-full !pl-10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {!isPM && (
                <Button
                  variant="secondary"
                  to={
                    pathname.startsWith("/inventory")
                      ? "/inventory/products/bulk-import"
                      : "/masters/products/bulk-import"
                  }
                >
                  <Upload className="h-4 w-4" />
                  Bulk Import
                </Button>
              )}
              <Button variant="secondary" type="button" onClick={onExport}>
                <FileSpreadsheet className="h-4 w-4" />
                Export (xlsx)
              </Button>
              {!isPM && (
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setAddOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Create Product
                </Button>
              )}
            </div>
          </div>

          <div className="ui-table-wrap">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface-thead)] text-[12px] font-medium text-[var(--color-text-muted)]">
                    <SerialNumberHeader />
                    <th className="px-4 py-3 font-medium">Product Name</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">HSN</th>
                    <th className="px-4 py-3 font-medium">Unit</th>
                    <th className="px-4 py-3 font-medium">Price</th>
                    <th className="px-4 py-3 font-medium">GST Tax</th>
                    <th className="px-4 py-3 font-medium">CESS %</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, rowIndex) => {
                    const category = p.category || "Finished Goods";
                    const desc = blankOr(p.description);
                    const hsn = blankOr(p.hsn_code);
                    const unit = blankOr(p.unit);
                    const gst =
                      p.gst_percent === null ||
                      p.gst_percent === undefined ||
                      p.gst_percent === "" ||
                      Number(p.gst_percent) === 0
                        ? "-"
                        : `${p.gst_percent} %`;
                    const cess =
                      p.cess_percent === null || p.cess_percent === undefined || p.cess_percent === ""
                        ? "0 %"
                        : `${p.cess_percent} %`;
                    return (
                      <tr key={p.id} className="border-b border-[#f0f0f4] text-[#1a1a1f] last:border-b-0">
                        <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} />
                        <td className="px-4 py-3.5 font-normal">{p.name || ""}</td>
                        <td className="px-4 py-3.5 text-[#4a4a55]">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                            {category}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[#4a4a55]">{desc}</td>
                        <td className="px-4 py-3.5 text-[#4a4a55]">{hsn}</td>
                        <td className="px-4 py-3.5 text-[#4a4a55]">{unit}</td>
                        <td className="px-4 py-3.5 tabular-nums">
                          ₹ {Number(p.selling_price ?? p.unit_price ?? 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3.5 text-[#4a4a55]">{gst}</td>
                        <td className="px-4 py-3.5 text-[#4a4a55]">{cess}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(p);
                                setAddOpen(true);
                              }}
                              className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] hover:bg-[#e4e6fc]"
                              title="Edit"
                              aria-label="Edit product"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(p)}
                              className="grid h-8 w-8 place-items-center rounded-full bg-[#fde8e8] text-[#ef4444] hover:bg-[#fcdada]"
                              title="Delete"
                              aria-label="Delete product"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length === 0 ? (
              <div className="px-4 py-16 text-center text-[13px] text-[#8a8a96]">No data available</div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#6b6b76]">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded border border-[#e2e2e8] bg-white px-2 py-1 outline-none"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>
                {total === 0 ? "0-0 of 0" : `${from}-${to} of ${total}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="grid h-8 w-8 place-items-center rounded border border-[#e2e2e8] bg-white disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="grid h-8 min-w-8 place-items-center rounded border border-[#007f7d] bg-[#007f7d] px-2 text-[13px] font-semibold text-white shadow-sm"
              >
                {page}
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="grid h-8 w-8 place-items-center rounded border border-[#e2e2e8] bg-white disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Product Categories Chart */}
        {categoryChart.length > 0 && (
          <div className="mt-5 rounded-xl border border-[#e8e8ee] bg-white p-4 sm:p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[#1a1a1f]">Product Categories Chart</h3>
            <p className="text-xs text-[#6b6b76]">Breakdown of products by category</p>
            <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {categoryChart.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e4e4ea",
                        fontSize: 12,
                      }}
                      formatter={(value, name) => [`${value} products`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 space-y-2 text-xs">
                {categoryChart.map((item) => (
                  <li key={item.name} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[#4a4a55]">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium">{item.name}</span>
                    </span>
                    <span className="font-bold text-[#1a1a1f]">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <AddNewItemModal
        open={addOpen}
        placement="drawer"
        item={editing}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setAddOpen(false);
          setEditing(null);
          loadProducts();
        }}
      />
      <DeleteConfirmModal
        open={Boolean(deleting)}
        busy={deleteBusy}
        onClose={() => !deleteBusy && setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
