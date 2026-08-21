import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  FileSpreadsheet,
  FileText,
  ListFilter,
  Settings,
  Trash2,
  X,
} from "lucide-react";

import AddNewItemModal from "../../components/sales/AddNewItemModal";
import InventoryRowActionsMenu from "../../components/inventory/InventoryRowActionsMenu";
import RecordDetailModal from "../../components/inventory/RecordDetailModal";
import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
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
import {
  InventoryOutlineButton,
  InventoryPageCard,
  InventoryPageShell,
  InventoryPrimaryButton,
  InventorySearchInput,
  InventoryTabs,
  InventoryToolbarButton,
  InventoryPagination,
  inventoryRowClass,
  inventoryTableHeadClass,
  inventoryTdClass,
  inventoryThClass,
} from "../../components/inventory/inventoryDesignSystem";

const PAGE_SIZES = [10, 20, 50];

const SORT_OPTIONS = [
  { id: "name-asc", label: "Item Name A-Z" },
  { id: "name-desc", label: "Item Name Z-A" },
  { id: "qty-asc", label: "Quantity Low to High" },
  { id: "qty-desc", label: "Quantity High to low" },
];

const STOCK_FILTERS = [
  { id: "all", label: "All" },
  { id: "in", label: "In Stock" },
  { id: "out", label: "Out Of Stock" },
];

function todayLabel() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

function OutlinedField({ label, children }) {
  return (
    <label className="relative block">
      <span className="absolute -top-2 left-3 z-10 bg-white px-1 text-[11px] font-medium text-[#6b6b76]">
        {label}
      </span>
      {children}
    </label>
  );
}

function DropdownMenu({ open, onClose, children, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`absolute right-0 z-30 mt-1 min-w-[180px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

function RadioRow({ checked, label, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
    >
      <span
        className={`grid h-4 w-4 place-items-center rounded-full border ${
          checked ? "border-[var(--color-text)]" : "border-[var(--color-border-strong)]"
        }`}
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" /> : null}
      </span>
      {label}
    </button>
  );
}

function DeleteConfirmModal({ open, onClose, onConfirm, busy = false }) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
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
        <h3 className="text-[28px] font-bold leading-tight text-[#1a1a1f]">Delete Item?</h3>
        <p className="mt-3 text-[14px] leading-relaxed text-[#5a5a66]">
          Are you sure you want to delete this item?
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#1a1a1f] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#1a1a1f]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit({ qty: Number(qty), remark, unit: unitVal })}
            className={`rounded-lg px-6 py-2.5 text-[14px] font-bold text-white transition ${
              canSubmit ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]" : "cursor-not-allowed bg-slate-300"
            }`}
          >
            {isAdd ? "Add" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InventoryV2() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState("items");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name-asc");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categories, setCategories] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [stockTarget, setStockTarget] = useState(null);
  const [stockMode, setStockMode] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [itemsRes, catsRes] = await Promise.all([
        listInventoryV2Items(),
        listInventoryV2Categories(),
      ]);


      const rows = Array.isArray(itemsRes.data) ? itemsRes.data : [];
      setProducts(rows);
      const cats = Array.isArray(catsRes.data) ? catsRes.data : [];
      setCategories(cats);
    } catch {
      setProducts([]);
      setCategories([]);
      addToast("Could not load inventory from API.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, sort, stockFilter, pageSize, tab]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = products.filter((p) => {
      if (q) {
        const hay = `${p.name} ${p.hsn_code} ${p.category} ${p.product_code || p.sku}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const qty = Number(p.current_stock) || 0;
      if (stockFilter === "in" && qty <= 0) return false;
      if (stockFilter === "out" && qty > 0) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sort === "name-desc") return String(b.name).localeCompare(String(a.name));
      if (sort === "qty-asc") return (Number(a.current_stock) || 0) - (Number(b.current_stock) || 0);
      if (sort === "qty-desc") return (Number(b.current_stock) || 0) - (Number(a.current_stock) || 0);
      return String(a.name).localeCompare(String(b.name));
    });
    return rows;
  }, [products, search, sort, stockFilter]);

  const categoryRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories
      .map((c) => ({
        category: c.name,
        stock: c.stock ?? products.filter((p) => (p.category || "No Category") === c.name).length,
        id: c.id,
      }))
      .filter((r) => !q || r.category.toLowerCase().includes(q))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [products, categories, search]);

  const activeRows = tab === "items" ? filteredItems : categoryRows;
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

  const onExportExcel = () => {
    exportToExcel(filteredItems, exportCols, "inventory-items");
    addToast("Excel exported.");
  };
  const onExportPdf = () => {
    exportToPdf(filteredItems, exportCols, "Inventory Items", "inventory-items");
    addToast("PDF exported.");
  };

  const onDelete = (row) => setDeleting(row);

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return;
    const rawId = deleting.id;
    const isDemo = String(rawId) === "demo-product";
    setDeleteBusy(true);
    try {
      if (!isDemo) {
        await deleteInventoryV2Item(rawId);
      }
      setDeleting(null);
      addToast("Item deleted.");
      load();
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
    try {
      await createInventoryV2Category(name);
      setCategoryName("");
      setCategoryModal(false);
      addToast("Category created.");
      load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not create category."), "error");
    }
  };

  const onStockAdjust = async ({ qty, remark, unit }) => {
    if (!stockTarget || !qty || qty <= 0) {
      addToast("Enter a valid quantity.", "error");
      return;
    }
    if (String(stockTarget.id) === "demo-product") {
      addToast("Add a real inventory item to adjust stock.", "error");
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
    if (String(row.id) === "demo-product") {
      setViewTarget(row);
      return;
    }
    try {
      const res = await getInventoryV2Item(row.id);
      setViewTarget(res.data || row);
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not load item details."), "error");
    }
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

  if (loading) {
    return (
      <InventoryPageShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader label="Loading inventory…" />
        </div>
      </InventoryPageShell>
    );
  }

  return (
    <InventoryPageShell>
      <InventoryPageCard>
        <InventoryTabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "items", label: "All Items" },
            { id: "categories", label: "Category Wise" },
          ]}
          action={
            <Link to="/inventory/settings" className="ui-btn ui-btn-outline inline-flex items-center gap-1.5 text-[13px]">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          }
        />

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <InventorySearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" />

            {tab === "items" ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <InventoryToolbarButton
                    onClick={() => {
                      setSortOpen((v) => !v);
                      setFilterOpen(false);
                    }}
                  >
                    <ListFilter className="h-4 w-4" />
                    {sortLabel}
                    <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
                  </InventoryToolbarButton>
                  <DropdownMenu open={sortOpen} onClose={() => setSortOpen(false)}>
                    {SORT_OPTIONS.map((opt) => (
                      <RadioRow
                        key={opt.id}
                        checked={sort === opt.id}
                        label={opt.label}
                        onSelect={() => {
                          setSort(opt.id);
                          setSortOpen(false);
                        }}
                      />
                    ))}
                  </DropdownMenu>
                </div>

                <div className="relative">
                  <InventoryToolbarButton
                    onClick={() => {
                      setFilterOpen((v) => !v);
                      setSortOpen(false);
                    }}
                  >
                    <ListFilter className="h-4 w-4" />
                    Filters
                    <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)]" />
                  </InventoryToolbarButton>
                  <DropdownMenu open={filterOpen} onClose={() => setFilterOpen(false)}>
                    {STOCK_FILTERS.map((opt) => (
                      <RadioRow
                        key={opt.id}
                        checked={stockFilter === opt.id}
                        label={opt.label}
                        onSelect={() => {
                          setStockFilter(opt.id);
                          setFilterOpen(false);
                        }}
                      />
                    ))}
                  </DropdownMenu>
                </div>

                <InventoryPrimaryButton
                  onClick={() => {
                    setEditing(null);
                    setAddOpen(true);
                  }}
                >
                  Add Items
                </InventoryPrimaryButton>
                <InventoryOutlineButton type="button" onClick={onExportPdf}>
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> PDF
                  </span>
                </InventoryOutlineButton>
                <InventoryOutlineButton type="button" onClick={onExportExcel}>
                  <span className="inline-flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4" /> Excel
                  </span>
                </InventoryOutlineButton>
              </div>
            ) : (
              <InventoryPrimaryButton type="button" onClick={() => setCategoryModal(true)}>
                Add Category
              </InventoryPrimaryButton>
            )}
          </div>

          <div className="ui-table-wrap ui-table-wrap--scroll overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              {tab === "items" ? (
                <table className="min-w-full border-collapse text-left text-[13px]">
                  <thead className={inventoryTableHeadClass}>
                    <tr>
                      <SerialNumberHeader className={`${inventoryThClass} border-r`} />
                      {["HSN Code", "Item Name", "Stock Value", "Purchase Price", "Sales Price", "Stock In Hand", "Action"].map(
                        (h) => (
                          <th key={h} className={`${inventoryThClass} last:border-r-0`}>
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-sm text-[var(--color-text-faint)]">
                          No items found.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, rowIndex) => (
                        <tr key={row.id} className={inventoryRowClass}>
                          <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} />
                          <td className={`${inventoryTdClass} text-[var(--color-text-muted)]`}>{row.hsn_code || "—"}</td>
                          <td className={`${inventoryTdClass} font-semibold`}>
                            <button
                              type="button"
                              className="text-left hover:underline"
                              onClick={() => navigate(`/inventory/items/${row.id}`)}
                            >
                              {row.name}
                            </button>
                          </td>
                          <td className={`${inventoryTdClass} tabular-nums`}>{Number(row.stock_value || 0).toFixed(1)}</td>
                          <td className={`${inventoryTdClass} tabular-nums`}>{Number(row.purchase_price || 0).toFixed(1)}</td>
                          <td className={`${inventoryTdClass} tabular-nums`}>{Number(row.selling_price || 0).toFixed(1)}</td>
                          <td className={`${inventoryTdClass} tabular-nums`}>{Number(row.current_stock || 0)}</td>
                          <td className={inventoryTdClass}>
                            <div className="flex items-center justify-end whitespace-nowrap">
                              <InventoryRowActionsMenu
                                rowId={row.id}
                                isOpen={openMenuId === row.id}
                                onOpen={setOpenMenuId}
                                onClose={() => setOpenMenuId(null)}
                                showAdd={false}
                                showAddStock
                                showRemoveStock
                                menuWidth={176}
                                onView={() => handleView(row)}
                                onEdit={() => {
                                  setEditing(row);
                                  setAddOpen(true);
                                }}
                                onAddStock={() => {
                                  setStockTarget(row);
                                  setStockMode("add");
                                }}
                                onRemoveStock={() => {
                                  setStockTarget(row);
                                  setStockMode("remove");
                                }}
                                onDelete={() => onDelete(row)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full border-collapse text-left text-[13px]">
                  <thead className={inventoryTableHeadClass}>
                    <tr>
                      <SerialNumberHeader className={`${inventoryThClass} border-r`} />
                      {["Category", "Stock", "Action"].map((h) => (
                        <th key={h} className={`${inventoryThClass} last:border-r-0`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-12 text-center text-sm text-[var(--color-text-faint)]">
                          No categories found.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, rowIndex) => (
                        <tr key={row.category} className={inventoryRowClass}>
                          <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} />
                          <td className={`${inventoryTdClass} font-semibold`}>{row.category}</td>
                          <td className={`${inventoryTdClass} tabular-nums`}>{row.stock}</td>
                          <td className={`${inventoryTdClass} text-[var(--color-text-faint)]`}>NA</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <InventoryPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPage={setPage}
            onPageSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      </InventoryPageCard>

      <AddNewItemModal
        open={addOpen}
        placement="drawer"
        item={editing}
        categories={categories.map((c) => c.name || c)}
        onAddCategory={() => {
          setAddOpen(false);
          setCategoryModal(true);
        }}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setAddOpen(false);
          setEditing(null);
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

      <DeleteConfirmModal
        open={Boolean(deleting)}
        busy={deleteBusy}
        onClose={() => !deleteBusy && setDeleting(null)}
        onConfirm={confirmDelete}
      />

      <RecordDetailModal
        open={Boolean(viewTarget)}
        title={viewTarget?.name || "Item Details"}
        subtitle={viewTarget?.sku || viewTarget?.product_code}
        fields={viewFields}
        onClose={() => setViewTarget(null)}
      />

      {categoryModal ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-[17px] font-bold text-[#1a1a1f]">Add Category</h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setCategoryModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-[#f0f0f4] text-[#1a1a1f]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <OutlinedField label="Category name">
              <input
                autoFocus
                className="w-full rounded-lg border border-[#cfcfd6] bg-white px-3 py-3 text-sm outline-none focus:border-[#0f6d84]"
                placeholder="Category name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createCategory()}
              />
            </OutlinedField>
            <button
              type="button"
              onClick={createCategory}
              className="mt-6 w-full rounded-lg bg-[#6b6b76] py-3 text-[14px] font-bold text-white hover:bg-[#4a4a55]"
            >
              Create
            </button>
          </div>
        </div>
      ) : null}
    </InventoryPageShell>
  );
}
