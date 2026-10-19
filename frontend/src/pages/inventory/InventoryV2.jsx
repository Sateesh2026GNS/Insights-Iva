import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, Pencil, Trash2, X } from "lucide-react";

import AddNewItemModal from "../../components/sales/AddNewItemModal";
import AddInventoryCategoryModal from "../../components/inventory/AddInventoryCategoryModal";
import SelectStockItemCategoryModal from "../../components/inventory/SelectStockItemCategoryModal";
import InventoryStockItems from "../../components/inventory/InventoryStockItems";
import useAuth from "../../hooks/useAuth";
import { isProductionManager, userCanWriteProductMaster } from "../../config/permissions";
import {
  buildInventoryStockRowActionItems,
  filterCategoryWiseItems,
  normalizeCategoryName,
  selectableInventoryCategories,
} from "../../utils/inventoryCategoryWise";
import RecordDetailModal from "../../components/inventory/RecordDetailModal";
import InventoryItemPhoto from "../../components/inventory/InventoryItemPhoto";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { useToast } from "../../context/ToastContext";
import {
  addInventoryV2Stock,
  createInventoryV2Category,
  deleteInventoryV2Item,
  getInventoryV2Item,
  listInventoryV2Categories,
  listInventoryV2Items,
  removeInventoryV2Stock,
} from "../../api/inventoryV2Api";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";
import { apiErrorMessage } from "../../utils/apiError";
import { removeLocalProducts } from "../../utils/localProductCache";
import { catalogStockReportMeta } from "../../utils/storeReportPageMeta";
import { invalidateReferenceCache } from "../../utils/referenceDataCache";
import { InventoryPageShell } from "../../components/inventory/inventoryDesignSystem";
import {
  filterInventoryStockRows,
  getInventoryStockItemTableHeaders,
  isLockedKpiStockFilter,
  resolveInventoryKpiStockFilter,
  SORT_OPTIONS,
} from "../../utils/inventoryStockItems";

function todayLabel() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

function StockAdjustModal({ mode, open, stock, unit, onClose, onSubmit }) {
  const [qty, setQty] = useState("");
  const [remark, setRemark] = useState("");
  const [unitVal, setUnitVal] = useState(unit || "PCS");
  const isAdd = mode === "add";
  const canSubmit = Number(qty) > 0;

  useEffect(() => {
    if (!open) return;
    setQty("");
    setRemark("");
    setUnitVal(unit || "PCS");
  }, [open, unit]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-[#1a1a1f]">{isAdd ? "Add Stock" : "Remove Stock"}</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-[#f0f0f4] text-[#1a1a1f]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 text-[13px]">
          <div>
            <div className="text-[#6b6b76]">Available Stock</div>
            <div className="mt-0.5 font-semibold text-[#1a1a1f]">{Number(stock || 0)}</div>
          </div>
          <div className="text-right">
            <div className="text-[#6b6b76]">Date</div>
            <div className="mt-0.5 font-semibold text-[#1a1a1f]">{todayLabel()}</div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-[1fr_110px] gap-3">
          <label className="block text-[12px] font-medium text-[#6b6b76]">
            {isAdd ? "Enter Quantity to Add" : "Enter Quantity to Remove"}
            <input
              autoFocus
              type="number"
              min="0"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={isAdd ? "Enter Quantity to Add" : "Enter Quantity to Remove"}
              className="mt-1.5 w-full rounded-lg border border-[#cfcfd6] bg-white px-3 py-2.5 text-[13px] text-[#1a1a1f] outline-none focus:border-[#0f6d84]"
            />
          </label>
          <label className="block text-[12px] font-medium text-[#6b6b76]">
            Unit
            <select
              value={unitVal}
              onChange={(e) => setUnitVal(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#cfcfd6] bg-white px-3 py-2.5 text-[13px] outline-none"
            >
              {["PCS", "Nos", "Kgs", "Ltr", "Box", "Mtr"].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mb-5 block text-[12px] font-medium text-[#6b6b76]">
          Remark (Optional)
          <input
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Enter Remarks"
            className="mt-1.5 w-full rounded-lg border border-[#cfcfd6] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[#0f6d84]"
          />
        </label>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canSubmit}
            onClick={() => onSubmit({ qty: Number(qty), remark, unit: unitVal })}
          >
            {isAdd ? "Add" : "Remove"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{ forcedStockFilter?: "low"|"out"|null }} props
 * When set (dedicated low/out pages), KPI stock filter is locked; data still loads once via listInventoryV2Items.
 */
export default function InventoryV2({ forcedStockFilter = null }) {
  const { user } = useAuth();
  const canWrite = userCanWriteProductMaster(user);
  const isPM = isProductionManager(user);
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const kpiStockFilter = resolveInventoryKpiStockFilter({
    pathname: location.pathname,
    searchParams,
    forcedStockFilter,
  });
  const lockedStockFilter = isLockedKpiStockFilter({
    pathname: location.pathname,
    forcedStockFilter,
  });
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState("items");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name-asc");
  const [stockFilter, setStockFilter] = useState(() => kpiStockFilter);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const toolbarRef = useRef(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [addOpen, setAddOpen] = useState(false);
  const [categoryPickOpen, setCategoryPickOpen] = useState(false);
  const [pickedCategoryId, setPickedCategoryId] = useState("");
  const [categoryPickError, setCategoryPickError] = useState("");
  const [editing, setEditing] = useState(null);
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryToSelect, setCategoryToSelect] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewTarget, setViewTarget] = useState(null);
  const [stockTarget, setStockTarget] = useState(null);
  const [stockMode, setStockMode] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setLoading(true);
    try {
      const [itemsRes, catsRes] = await Promise.all([
        listInventoryV2Items(),
        listInventoryV2Categories(),
      ]);

      const rows = Array.isArray(itemsRes?.data) ? itemsRes.data : [];
      setProducts(rows);
      const cats = Array.isArray(catsRes?.data) ? catsRes.data : [];
      setCategories(cats);
    } catch {
      setProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setStockFilter(kpiStockFilter);
  }, [kpiStockFilter, location.pathname, forcedStockFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, sort, stockFilter, pageSize, tab, categoryFilter]);

  useEffect(() => {
    setOpenMenuId(null);
  }, [tab]);

  useEffect(() => {
  const handleOutsideClick = (e) => {
    if (!toolbarRef.current?.contains(e.target)) {
      setSortOpen(false);
      setFilterOpen(false);
    }
  };

  document.addEventListener("mousedown", handleOutsideClick);

  return () => {
    document.removeEventListener("mousedown", handleOutsideClick);
  };
  }, []);

  const filteredItems = useMemo(
    () => filterInventoryStockRows(products, { search, sort, stockFilter }),
    [products, search, sort, stockFilter]
  );

  const categoryWiseItems = useMemo(
    () => filterCategoryWiseItems(products, { search, categoryFilter, sort }),
    [products, search, categoryFilter, sort]
  );

  const categoryFilterOptions = useMemo(() => {
    const names = new Set();
    categories.forEach((c) => {
      if (c?.name) names.add(c.name);
    });
    products.forEach((p) => names.add(normalizeCategoryName(p.category)));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [categories, products]);

  const selectableCategories = useMemo(
    () => selectableInventoryCategories(categories),
    [categories]
  );

  const itemFormCategories = useMemo(() => {
    const list = [...selectableCategories];
    const existingName = String(editing?.category || "").trim();
    if (
      existingName &&
      existingName.toLowerCase() !== "no category" &&
      !list.some((c) => String(c.name).toLowerCase() === existingName.toLowerCase())
    ) {
      list.push({ id: null, name: existingName });
    }
    return list;
  }, [selectableCategories, editing]);

  const activeRows = tab === "items" ? filteredItems : categoryWiseItems;
  const total = activeRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = activeRows.slice((page - 1) * pageSize, page * pageSize);
  const sortLabel = SORT_OPTIONS.find((o) => o.id === sort)?.label || "Item Name A-Z";

  const exportCols = [
    { key: "hsn_code", label: "HSN Code" },
    { key: "name", label: "Item Name" },
    { key: "stock_value", label: "Stock Value" },
    { key: "purchase_price", label: "Purchase Price" },
    { key: "selling_price", label: "Sales Price" },
    { key: "current_stock", label: "Stock In Hand" },
  ];

  const handleExport = (format) => {
    if (format === "pdf") {
      exportToPdf(filteredItems, exportCols, "Inventory Items", "inventory-items");
      addToast("Exported to PDF", "success");
    } else {
      exportToExcel(filteredItems, exportCols, "inventory-items");
      addToast("Exported to Excel", "success");
    }
  };

  const onDelete = (row) => setDeleting(row);

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return;
    const rawId = deleting.id;
    const numericId = typeof rawId === "number" ? rawId : Number(rawId);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      addToast("This item cannot be deleted on the server. Refresh the list and try again.", "error");
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteInventoryV2Item(numericId);
      removeLocalProducts({
        id: numericId,
        sku: deleting.sku || deleting.product_code,
        name: deleting.name,
      });
      invalidateReferenceCache("products");
      setDeleting(null);
      addToast("Item deleted.", "success");
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not delete item."), "error");
    } finally {
      setDeleteBusy(false);
    }
  };

  const createCategory = async () => {
    const name = categoryName.trim();
    if (!name) {
      addToast("Enter a category name.", "error");
      return;
    }
    if (categoryBusy) return;
    setCategoryBusy(true);
    const fromAddFlow = categoryPickOpen || addOpen;
    try {
      const res = await createInventoryV2Category(name);
      const created = res?.data;
      setCategoryName("");
      setCategoryModal(false);
      await load();
      if (fromAddFlow && created?.id && created?.name) {
        setSelectedCategory({ id: created.id, name: created.name });
        setPickedCategoryId(String(created.id));
        setCategoryToSelect(created.name);
        setCategoryPickError("");
        setCategoryPickOpen(false);
        if (!editing) {
          setAddOpen(true);
        }
      }
      addToast("Category created.");
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not create category."), "error");
    } finally {
      setCategoryBusy(false);
    }
  };

  const closeCategoryPick = () => {
    setCategoryPickOpen(false);
    setCategoryPickError("");
    setPickedCategoryId("");
    setSelectedCategory(null);
    setCategoryToSelect("");
  };

  const openAddItem = () => {
    setEditing(null);
    setAddOpen(false);
    setSelectedCategory(null);
    setCategoryToSelect("");
    setPickedCategoryId("");
    setCategoryPickError("");
    setCategoryPickOpen(true);
  };

  const continueFromCategory = (cat) => {
    if (!cat?.id || Number(cat.id) <= 0 || !String(cat.name || "").trim()) {
      setCategoryPickError("Please select or create a category before adding an item.");
      return;
    }
    setSelectedCategory(cat);
    setCategoryToSelect(cat.name);
    setCategoryPickError("");
    setCategoryPickOpen(false);
    setEditing(null);
    setAddOpen(true);
  };

  const closeItemForm = () => {
    setAddOpen(false);
    setEditing(null);
    setSelectedCategory(null);
    setCategoryToSelect("");
    setPickedCategoryId("");
  };

  const onStockAdjust = async ({ qty, remark, unit }) => {
    if (!stockTarget || !qty || qty <= 0) {
      addToast("Enter a valid quantity.", "error");
      return;
    }
    const available = Number(stockTarget.current_stock) || 0;
    if (stockMode === "remove" && qty > available) {
      addToast(`Cannot remove more than available stock (${available}).`, "error");
      return;
    }
    try {
      const fn = stockMode === "add" ? addInventoryV2Stock : removeInventoryV2Stock;
      const res = await fn(stockTarget.id, { quantity: qty, remark, unit });
      const updated = res.data?.item;
      if (updated) {
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        load();
      }
      setStockMode(null);
      setStockTarget(null);
      addToast(stockMode === "add" ? "Stock added." : "Stock removed.");
    } catch (err) {
      addToast(apiErrorMessage(err, "Stock update failed."), "error");
    }
  };

  const handleView = async (row) => {
    try {
      const res = await getInventoryV2Item(row.id);
      setViewTarget(res.data || row);
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not load item details."), "error");
    }
  };

  const handleEditRow = (row) => {
    setCategoryPickOpen(false);
    setEditing(row);
    const existing = String(row.category || "").trim();
    setCategoryToSelect(existing && existing.toLowerCase() !== "no category" ? existing : "");
    setSelectedCategory(null);
    setAddOpen(true);
  };

  const categoryWiseActionItems = (row) => {
    const base = buildInventoryStockRowActionItems(row, {
      canWrite,
      isPM,
      onView: handleView,
      onEdit: handleEditRow,
      onDelete: onDelete,
    });
    const iconFor = (label) => {
      if (label === "View") return <Eye className="h-4 w-4" />;
      if (label === "Edit") return <Pencil className="h-4 w-4" />;
      if (label === "Delete") return <Trash2 className="h-4 w-4" />;
      return null;
    };
    return base.map((item) =>
      item.divider ? item : { ...item, icon: iconFor(item.label) }
    );
  };

  const viewFields = viewTarget
    ? [
        { label: "Item Name", value: viewTarget.name },
        { label: "SKU", value: viewTarget.sku || viewTarget.product_code },
        { label: "Unit", value: viewTarget.unit },
        { label: "HSN Code", value: viewTarget.hsn_code },
        { label: "Category", value: viewTarget.category },
        { label: "Purchase Price", value: viewTarget.purchase_price },
        { label: "Sales Price", value: viewTarget.selling_price ?? viewTarget.unit_price },
        { label: "Stock In Hand", value: viewTarget.current_stock },
        { label: "Min Stock", value: viewTarget.min_stock },
        { label: "Stock Value", value: viewTarget.stock_value },
        { label: "GST %", value: viewTarget.gst_percent },
        { label: "Description", value: viewTarget.description },
      ]
    : [];

  const stockReportMeta = catalogStockReportMeta(stockFilter === "low" ? "low" : stockFilter === "out" ? "out" : null);
  const emptyReportTitle = stockReportMeta?.emptyTitle;
  const emptyReportDescription = stockReportMeta?.emptyDescription;

  const itemTableHeaders = useMemo(() => getInventoryStockItemTableHeaders(stockFilter), [stockFilter]);

  return (
    <InventoryPageShell className="space-y-5">
      <InventoryStockItems
        lockedStockFilter={lockedStockFilter}
        stockFilter={stockFilter}
        onStockFilterChange={setStockFilter}
        tab={tab}
        onTabChange={setTab}
        search={search}
        onSearchChange={(e) => setSearch(e.target.value)}
        sort={sort}
        sortLabel={sortLabel}
        sortOpen={sortOpen}
        onSortOpenChange={setSortOpen}
        filterOpen={filterOpen}
        onFilterOpenChange={setFilterOpen}
        toolbarRef={toolbarRef}
        onSortSelect={(id) => {
          setSort(id);
          setSortOpen(false);
        }}
        itemTableHeaders={itemTableHeaders}
        emptyReportTitle={emptyReportTitle}
        emptyReportDescription={emptyReportDescription}
        pageRows={pageRows}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        filteredItemsCount={filteredItems.length}
        onExport={handleExport}
        onOpenAddItem={openAddItem}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        categoryFilterOptions={categoryFilterOptions}
        onOpenAddCategory={() => setCategoryModal(true)}
        openMenuId={openMenuId}
        onOpenMenuIdChange={setOpenMenuId}
        onItemNameNavigate={(row) => navigate(`/inventory/items/${row.id}`)}
        onViewItem={handleView}
        onEditItem={handleEditRow}
        onDeleteItem={onDelete}
        onAddStock={(row) => {
          setStockTarget(row);
          setStockMode("add");
        }}
        onRemoveStock={(row) => {
          setStockTarget(row);
          setStockMode("remove");
        }}
        categoryWiseActionItems={categoryWiseActionItems}
      />

      <SelectStockItemCategoryModal
        open={categoryPickOpen}
        categories={selectableCategories}
        selectedId={pickedCategoryId}
        error={categoryPickError}
        onSelect={(cat) => {
          setPickedCategoryId(cat?.id != null ? String(cat.id) : "");
          setSelectedCategory(cat || null);
          setCategoryPickError("");
        }}
        onAddCategory={() => {
          setCategoryName("");
          setCategoryModal(true);
        }}
        onContinue={continueFromCategory}
        onClose={closeCategoryPick}
      />

      <AddNewItemModal
        open={addOpen}
        placement="drawer"
        item={editing}
        categories={itemFormCategories}
        categoryToSelect={categoryToSelect}
        requireCategory={!editing}
        lockCategory={Boolean(!editing && selectedCategory)}
        saveAsInventoryItem
        onAddCategory={() => {
          setCategoryName("");
          setCategoryModal(true);
        }}
        onClose={closeItemForm}
        onSaved={() => {
          closeItemForm();
          load();
        }}
      />

      <StockAdjustModal
        mode={stockMode || "add"}
        open={Boolean(stockMode && stockTarget)}
        stock={Number(stockTarget?.current_stock) || 0}
        unit={stockTarget?.unit && stockTarget.unit !== "—" ? stockTarget.unit : "PCS"}
        onClose={() => {
          setStockMode(null);
          setStockTarget(null);
        }}
        onSubmit={onStockAdjust}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete Stock Item?"
        message="Are you sure you want to delete this stock item?"
        confirmLabel="Delete"
        loading={deleteBusy}
        onClose={() => !deleteBusy && setDeleting(null)}
        onConfirm={confirmDelete}
      />

      <RecordDetailModal
        open={Boolean(viewTarget)}
        title={viewTarget?.name || "Item Details"}
        subtitle={viewTarget?.sku || viewTarget?.product_code}
        fields={viewFields}
        onClose={() => setViewTarget(null)}
      >
        <section className="rounded-lg border bg-slate-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Item Photo</h3>
          <InventoryItemPhoto
            photoFileId={viewTarget?.photo_file_id}
            alt={`${viewTarget?.name || "Item"} photo`}
            className="max-h-64 w-full rounded-lg object-contain"
          />
        </section>
      </RecordDetailModal>

      <AddInventoryCategoryModal
        open={categoryModal}
        name={categoryName}
        busy={categoryBusy}
        onNameChange={setCategoryName}
        onClose={() => !categoryBusy && setCategoryModal(false)}
        onSubmit={createCategory}
      />
    </InventoryPageShell>
  );
}
