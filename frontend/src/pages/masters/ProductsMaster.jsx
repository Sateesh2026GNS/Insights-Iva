import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

import useAuth from "../../hooks/useAuth";
import { isProductionManager, userCanWriteProductMaster } from "../../config/permissions";
import ProductDetailModal from "../../components/masters/ProductDetailModal";
import { expandProductsToTableRows, formatProductInr } from "../../utils/productTableRows";
import AddNewItemModal from "../../components/sales/AddNewItemModal";
import Loader from "../../components/common/Loader";
import { SearchBar } from "../../components/common/SearchFilter";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { useToast } from "../../context/ToastContext";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  createInventoryV2Category,
  listInventoryV2Categories,
} from "../../api/inventoryV2Api";
import { deleteProduct, getProductDetail, getProductRelatedSection, getProducts } from "../../api/productsApi";
import AddInventoryCategoryModal from "../../components/inventory/AddInventoryCategoryModal";
import { computeSummary, enrichApiProduct } from "../../data/productsMasterData";
import { runListExport } from "../../utils/listExport";
import { apiErrorMessage } from "../../utils/apiError";
import { removeLocalProducts } from "../../utils/localProductCache";
import { invalidateReferenceCache } from "../../utils/referenceDataCache";

import EmptyState from "../../components/common/EmptyState";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import RowActionMenu from "../../components/common/RowActionMenu";
import Button from "../../components/common/Button";
import ConfirmDialog from "../../components/admin/ConfirmDialog";

const PAGE_SIZES = [20, 50, 100];

const PRODUCT_EXPORT_COLUMNS = [
  { key: "name", label: "Product Name" },
  { key: "product_code", label: "Code" },
  { key: "category", label: "Category" },
  { key: "description", label: "Description" },
  { key: "hsn_code", label: "HSN" },
  { key: "unit", label: "Unit" },
  { key: "vendor_name", label: "Vendor" },
  { key: "purchase_price", label: "Purchase Price" },
  { key: "transport_cost", label: "Transport" },
  { key: "labour_cost", label: "Labour" },
  { key: "import_cost", label: "Import" },
  { key: "total_landed_cost", label: "Landed Cost" },
  { key: "minimum_price", label: "Min Price" },
  { key: "maximum_price", label: "Max Price" },
  { key: "selling_price", label: "Selling Price" },
  { key: "gst_percent", label: "GST Tax" },
  { key: "cess_percent", label: "CESS %" },
];

const SCREENSHOT_DEMO = [];

function blankOr(value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s || s === "—") return "";
  return s;
}

function rowActionItems(row, { canWrite, isPM, onView, setEditing, setDeleting }) {
  const items = [
    {
      label: "View",
      icon: <Eye className="h-4 w-4" />,
      onClick: () => onView(row),
    },
  ];
  if (canWrite && !isPM) {
    items.push({
      label: "Edit",
      icon: <Pencil className="h-4 w-4" />,
      onClick: () => {
        setEditing(row);
      },
    });
    items.push({ divider: true });
    items.push({
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      danger: true,
      onClick: () => setDeleting(row),
    });
  }
  return items;
}

export default function ProductsMaster() {
  const { user } = useAuth();
  const isPM = isProductionManager(user);
  const canWrite = userCanWriteProductMaster(user);
  const { addToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const pageTitle = pathname.startsWith("/inventory") ? "Inventory" : "Products";

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [relatedData, setRelatedData] = useState({});
  const [loadingSections, setLoadingSections] = useState({});
  const [sectionErrors, setSectionErrors] = useState({});
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryToSelect, setCategoryToSelect] = useState("");

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === String(selectedCategoryId)),
    [categories, selectedCategoryId]
  );
  const selectedCategoryName = selectedCategory?.name || "";

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("add") === "1" || params.get("create") === "1") {
      setEditing(null);
      setAddOpen(true);
    }
  }, [location.search]);

  const handleCloseModal = () => {
    setAddOpen(false);
    setEditing(null);
    const params = new URLSearchParams(location.search);
    if (params.get("add") === "1" || params.get("create") === "1") {
      navigate(location.pathname, { replace: true });
    }
  };

  const handleSavedModal = () => {
    handleCloseModal();
    setCategoryToSelect("");
    loadCategories();
    loadProducts();
  };

  const loadCategories = useCallback(async () => {
    try {
      const res = await listInventoryV2Categories();
      const rows = Array.isArray(res.data) ? res.data : [];
      const filtered = rows.filter((c) => c?.name && c.name !== "No Category");
      setCategories(filtered);
      return filtered;
    } catch {
      setCategories([]);
      return [];
    }
  }, []);

  const loadProducts = useCallback(async () => {
    if (!selectedCategoryName) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getProducts({
        category: selectedCategoryName,
        categoryId: selectedCategory?.id,
        q: query.trim() || undefined,
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      setProducts(rows.map((row) => enrichApiProduct(row)));
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory?.id, selectedCategoryName]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const tableRows = useMemo(() => expandProductsToTableRows(products), [products]);
  const filtered = tableRows;

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, selectedCategoryId]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const summary = useMemo(() => computeSummary(products), [products]);
  const categoryChart = useMemo(() => {
    const palette = ["#22C55E", "#3B82F6", "#F97316", "#A855F7", "#64748B", "#EC4899", "#14B8A6"];
    return categories
      .filter((c) => (Number(c.stock) || 0) > 0)
      .map((c, i) => ({
        name: c.name,
        value: Number(c.stock) || 0,
        color: palette[i % palette.length],
      }));
  }, [categories]);

  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      addToast("Enter a category name.", "error");
      return;
    }
    setCategoryBusy(true);
    try {
      await createInventoryV2Category(name);
      const updated = await loadCategories();
      setNewCategoryName("");
      setCategoryModalOpen(false);
      const match = updated.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (match) setSelectedCategoryId(String(match.id));
      if (addOpen) setCategoryToSelect(name);
      addToast("Category created.", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not create category."), "error");
    } finally {
      setCategoryBusy(false);
    }
  };

  const openAddProduct = () => {
    if (!selectedCategoryName) {
      addToast("Please select a category first.", "error");
      return;
    }
    setEditing(null);
    setCategoryToSelect(selectedCategoryName);
    setAddOpen(true);
  };

  const handleExport = (format) => {
    const exportCols = PRODUCT_EXPORT_COLUMNS.map((c) => {
      if (!String(c.key).includes("price") && c.key !== "total_landed_cost") return c;
      return {
        ...c,
        pdfValue: (row) => formatProductInr(row[c.key]),
      };
    });
    runListExport(format, {
      data: filtered,
      columns: exportCols,
      filename: "products",
      title: "Products",
      pdfOptions: { landscape: true },
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  const handleView = async (product) => {
    setViewing(null);
    setRelatedData({});
    setLoadingSections({});
    setSectionErrors({});
    const id = Number(product?.id);
    if (!Number.isFinite(id) || id <= 0) {
      setViewing(product);
      return;
    }
    try {
      const res = await getProductDetail(id);
      const detail = res?.data && typeof res.data === "object" ? res.data : {};
      const merged = { ...product, ...detail };
      if (Array.isArray(merged.bom)) {
        merged.bom = merged.bom.length ? `${merged.bom.length} component(s)` : "No BOM configured";
      }
      setViewing(enrichApiProduct(merged));
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not load product details."), "error");
    }
  };

  const loadRelatedSection = async (section, product) => {
    const id = Number(product?.id);
    if (!Number.isFinite(id) || id <= 0 || relatedData[section] !== undefined || loadingSections[section]) return;
    setLoadingSections((current) => ({ ...current, [section]: true }));
    setSectionErrors((current) => ({ ...current, [section]: "" }));
    try {
      const res = await getProductRelatedSection(id, section);
      setRelatedData((current) => ({ ...current, [section]: res?.data }));
    } catch (err) {
      setSectionErrors((current) => ({ ...current, [section]: apiErrorMessage(err, "Could not load this section.") }));
    } finally {
      setLoadingSections((current) => ({ ...current, [section]: false }));
    }
  };

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return;
    const rawId = deleting.id;
    const numericId = typeof rawId === "number" ? rawId : Number(rawId);
    const canCallApi = Number.isFinite(numericId) && numericId > 0;
    setDeleteBusy(true);
    try {
      if (!canCallApi) {
        addToast("This product cannot be deleted on the server. Refresh the list and try again.", "error");
        return;
      }
      if (pathname.startsWith("/inventory")) {
        const { deleteInventoryV2Item } = await import("../../api/inventoryV2Api");
        await deleteInventoryV2Item(numericId);
      } else {
        await deleteProduct(numericId);
      }
      removeLocalProducts({
        id: numericId,
        sku: deleting.sku || deleting.product_code,
        name: deleting.name,
      });
      invalidateReferenceCache("products");
      setDeleting(null);
      await loadProducts();
      addToast("Product deleted", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not delete product. It may be linked to other records."), "error");
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading && selectedCategoryName) return <Loader label="Loading products..." />;

  return (
    <div className="min-h-full bg-[var(--color-bg)]">
      <div className="ui-page mx-auto max-w-[1400px]">

        <div className="ui-card mb-5 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="block min-w-0 flex-1 sm:max-w-md">
              <span className="mb-1.5 block text-[12px] font-semibold text-[#6b6b76]">
                Category <span className="text-[#e11d48]">*</span>
              </span>
              <select
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  setPage(1);
                }}
                className="ui-select w-full"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                    {typeof c.stock === "number" ? ` (${c.stock})` : ""}
                  </option>
                ))}
              </select>
            </label>
            {canWrite && !isPM ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setNewCategoryName("");
                  setCategoryModalOpen(true);
                }}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Add New Category
              </Button>
            ) : null}
          </div>
          {!categories.length ? (
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">No categories found.</p>
          ) : null}
        </div>

        {/* Summary Cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
          <div className="ui-card p-3.5 sm:p-4">
            <p className="text-[11px] sm:text-[12px] font-semibold text-[var(--color-text-muted)] truncate">Total Products</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--color-text)]">{summary.total}</p>
          </div>
          <div className="ui-card p-3.5 sm:p-4">
            <p className="text-[11px] sm:text-[12px] font-semibold text-[var(--color-text-muted)] truncate">Categories</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--color-text)]">{summary.categories}</p>
          </div>
          <div className="ui-card p-3.5 sm:p-4">
            <p className="text-[11px] sm:text-[12px] font-semibold text-[var(--color-text-muted)] truncate">Active Products</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold ui-value-positive ui-num">{summary.active}</p>
          </div>
          <div className="ui-card p-3.5 sm:p-4">
            <p className="text-[11px] sm:text-[12px] font-semibold text-[var(--color-text-muted)] truncate">Low Stock</p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--color-warning)] ui-num">{summary.lowStock}</p>
          </div>
        </div>

        <div className="ui-card p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder={
                selectedCategoryName
                  ? `Search in ${selectedCategoryName}...`
                  : "Select a category to search products..."
              }
              aria-label="Search products"
              disabled={!selectedCategoryName}
            />
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:justify-end">
              {selectedCategoryId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSelectedCategoryId("");
                    setQuery("");
                    setPage(1);
                  }}
                >
                  Clear Category
                </Button>
              ) : null}
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
              <ExportDownloadMenu disabled={!filtered.length} onExport={handleExport} />
              {canWrite && !isPM && (
                <Button
                  variant="add"
                  type="button"
                  onClick={openAddProduct}
                  leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
                >
                  Add Product
                </Button>
              )}
            </div>
          </div>

          {!selectedCategoryName ? (
            <EmptyState
              title="Select a category"
              description="Please select a category to view products."
              actionLabel={canWrite && !isPM ? "Add New Category" : undefined}
              onAction={canWrite && !isPM ? () => setCategoryModalOpen(true) : undefined}
            />
          ) : filtered.length === 0 && !loading ? (
            <EmptyState
              title="No products found in this category"
              description={`There are no products under ${selectedCategoryName} yet.`}
              actionLabel={canWrite && !isPM ? "Add Product" : undefined}
              onAction={canWrite && !isPM ? openAddProduct : undefined}
            />
          ) : null}

          {selectedCategoryName && filtered.length > 0 ? (
          <>
          {/* Mobile Products Cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((p) => {
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
                  : `${p.gst_percent}%`;

              return (
                <div
                  key={p.id}
                  className="ui-card p-3.5 space-y-2.5 transition-all hover:border-[var(--color-primary-soft)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-table-text-secondary)]">
                          {category}
                        </span>
                        {hsn && (
                          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                            HSN: {hsn}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm text-[var(--color-text)] truncate mt-1">
                        {p.name || "—"}
                      </h3>
                      {desc && (
                        <p className="text-xs text-[var(--color-text-muted)] line-clamp-1 mt-0.5">{desc}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setEditing(p);
                          setAddOpen(true);
                        }}
                        leftIcon={<Pencil className="h-3.5 w-3.5" />}
                      >
                        Edit
                      </Button>
                      <RowActionMenu
                        rowId={p.id}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        items={[
                          {
                            label: "View",
                            icon: <Eye className="h-4 w-4" />,
                            onClick: () => handleView(p),
                          },
                          { divider: true },
                          {
                            label: "Edit",
                            icon: <Pencil className="h-4 w-4" />,
                            onClick: () => {
                              setEditing(p);
                              setAddOpen(true);
                            },
                          },
                          { divider: true },
                          {
                            label: "Delete",
                            icon: <Trash2 className="h-4 w-4" />,
                            danger: true,
                            onClick: () => setDeleting(p),
                          },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs text-[var(--color-text-secondary)] border-t border-[var(--color-border-soft)] pt-2">
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[10px] uppercase font-semibold">Price</span>
                      <span className="font-bold tabular-nums text-[var(--color-text)]">
                        ₹{Number(p.selling_price ?? p.unit_price ?? 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[10px] uppercase font-semibold">Unit</span>
                      <span className="font-medium">{unit || "Nos"}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[10px] uppercase font-semibold">GST</span>
                      <span className="font-medium">{gst}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {rows.length === 0 ? (
              <EmptyState
                icon="document"
                title="No records found."
                description="There is nothing to show here yet."
                className="border-none bg-transparent py-12"
              />
            ) : null}
          </div>

          <div className="ui-table-wrap ui-table-wrap--scroll hidden md:block">
              <table className="ui-table w-full min-w-[1400px] border-collapse text-left text-[13px]">
                <thead className="ui-table-head">
                  <tr>
                    <SerialNumberHeader />
                    <th className="px-4 py-3 font-medium">Product Name</th>
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">HSN</th>
                    <th className="px-4 py-3 font-medium">Unit</th>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium text-right">Purchase Price</th>
                    <th className="px-4 py-3 font-medium text-right">Transport</th>
                    <th className="px-4 py-3 font-medium text-right">Labour</th>
                    <th className="px-4 py-3 font-medium text-right">Import</th>
                    <th className="px-4 py-3 font-medium text-right">Landed Cost</th>
                    <th className="px-4 py-3 font-medium text-right">Min Price</th>
                    <th className="px-4 py-3 font-medium text-right">Max Price</th>
                    <th className="px-4 py-3 font-medium text-right">Selling Price</th>
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
                    const code = blankOr(p.product_code || p.sku);
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
                      <tr key={p.rowKey || p.id}>
                        <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} />
                        <td className="px-4 py-3.5 font-normal text-[var(--color-table-text)]">{p.name || ""}</td>
                        <td className="px-4 py-3.5 ui-table-text-secondary whitespace-nowrap">{code}</td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center rounded-full bg-[var(--color-surface-muted)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-table-text-secondary)]">
                            {category}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 ui-table-text-secondary max-w-[160px] truncate">{desc}</td>
                        <td className="px-4 py-3.5 ui-table-text-secondary">{hsn}</td>
                        <td className="px-4 py-3.5 ui-table-text-secondary">{unit}</td>
                        <td className="px-4 py-3.5 ui-table-text-secondary">{p.vendor_name || "—"}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{formatProductInr(p.purchase_price)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{formatProductInr(p.transport_cost)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{formatProductInr(p.labour_cost)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{formatProductInr(p.import_cost)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold">{formatProductInr(p.total_landed_cost)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{formatProductInr(p.minimum_price)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{formatProductInr(p.maximum_price)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums">{formatProductInr(p.selling_price)}</td>
                        <td className="px-4 py-3.5 ui-table-text-secondary">{gst}</td>
                        <td className="px-4 py-3.5 ui-table-text-secondary">{cess}</td>
                        <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end">
                            <RowActionMenu
                              rowId={p.rowKey || p.id}
                              openMenu={openMenu}
                              setOpenMenu={setOpenMenu}
                              items={rowActionItems(p, {
                                canWrite,
                                isPM,
                                onView: handleView,
                                setEditing: (row) => {
                                  setEditing(row);
                                  setAddOpen(true);
                                },
                                setDeleting,
                              })}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            {rows.length === 0 ? (
              <EmptyState
                icon="document"
                title="No records found."
                description="There is nothing to show here yet."
                className="border-none bg-transparent py-12"
              />
            ) : null}
          </div>

          <div className="mt-4 ui-pagination justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="ui-pagination-select"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>
                {total === 0 ? "0–0 of 0" : `${from}–${to} of ${total}`}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="ui-page-btn"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="ui-page-btn ui-page-btn--active"
              >
                {page}
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="ui-page-btn"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          </>
          ) : null}
        </div>

        {/* Product Categories Chart */}
        {categoryChart.length > 0 && (
          <div className="ui-card mt-5 p-4 sm:p-5">
            <h3 className="text-sm font-bold text-[var(--color-text)]">Product Categories Chart</h3>
            <p className="text-xs text-[var(--color-text-muted)]">Breakdown of products by category</p>
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
                        border: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-surface)",
                        color: "var(--color-text)",
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
                    <button
                      type="button"
                      onClick={() => {
                        const match = categories.find((c) => c.name === item.name);
                        if (match) setSelectedCategoryId(String(match.id));
                        setPage(1);
                      }}
                      className={`flex flex-1 items-center gap-2 text-left text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] ${
                        selectedCategoryName === item.name ? "font-bold text-[var(--color-primary)]" : ""
                      }`}
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium">{item.name}</span>
                    </button>
                    <span className="font-bold text-[var(--color-text)]">{item.value}</span>
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
        entityName="Product"
        item={editing}
        categories={categoryNames}
        requireCategory
        lockCategory={Boolean(editing) || Boolean(selectedCategoryName)}
        categoryToSelect={!editing ? categoryToSelect || selectedCategoryName : undefined}
        onAddCategory={() => setCategoryModalOpen(true)}
        readOnly={!canWrite}
        onClose={() => {
          setCategoryToSelect("");
          handleCloseModal();
        }}
        onSaved={handleSavedModal}
      />
      <AddInventoryCategoryModal
        open={categoryModalOpen}
        name={newCategoryName}
        busy={categoryBusy}
        onNameChange={setNewCategoryName}
        onClose={() => !categoryBusy && setCategoryModalOpen(false)}
        onSubmit={handleCreateCategory}
      />
      <ProductDetailModal
        product={viewing}
        relatedData={relatedData}
        loadingSections={loadingSections}
        sectionErrors={sectionErrors}
        onLoadSection={loadRelatedSection}
        onClose={() => setViewing(null)}
        onEdit={
          canWrite && !isPM && viewing
            ? (product) => {
                setViewing(null);
                setEditing(product);
                setAddOpen(true);
              }
            : undefined
        }
        onDuplicate={
          canWrite && !isPM && viewing
            ? (product) => {
                setViewing(null);
                setEditing({ ...product, id: null, sku: "", product_code: "" });
                setAddOpen(true);
              }
            : undefined
        }
        onDelete={
          canWrite && !isPM && viewing
            ? (product) => {
                setViewing(null);
                setDeleting(product);
              }
            : undefined
        }
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Product?"
        message={
          deleting?.name
            ? `Are you sure you want to delete "${deleting.name}"?`
            : "Are you sure you want to delete this product?"
        }
        loading={deleteBusy}
        onClose={() => !deleteBusy && setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
