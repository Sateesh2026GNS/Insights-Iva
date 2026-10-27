import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  Coins,
  Filter,
  Package,
  PackageX,
  Plus,
  Search,
} from "lucide-react";

import Button from "../../components/common/Button";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import KpiCard, { ClickableKpiCard } from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
import { SearchBar } from "../../components/common/SearchFilter";
import PageHeader from "../../components/common/PageHeader";
import StatusBadge from "../../components/common/StatusBadge";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import InventoryRowActionsMenu from "../../components/inventory/InventoryRowActionsMenu";
import InventoryHeaderControls from "../../components/inventory/InventoryHeaderControls";
import MaterialDetailModal from "../../components/inventory/MaterialDetailModal";
import MaterialFormModal from "../../components/inventory/MaterialFormModal";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import useAuth from "../../hooks/useAuth";
import { userCanDeleteInventoryItem } from "../../config/permissions";
import {
  formatInventoryQuantity,
  pickDefaultWarehouse,
  singleUomInRows,
  summarizeQuantitiesByUom,
} from "../../utils/inventoryUomFormat";
import {
  deleteInventoryItem,
  getFinishedGoods,
  getFinishedGoodsSummary,
  getInventoryItem,
  getWarehouses,
} from "../../api/inventoryApi";
import { stockStatusLabel, stockStatusTone } from "../../data/inventoryMasterData";
import { PLANTS } from "../../data/warehousesMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { asArray, apiErrorMessage } from "../../utils/apiError";
import { todayIso } from "../../utils/dateUtils";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const FINISHED_GOODS_EXPORT_COLUMNS = [
  { key: "name", label: "Product Name" },
  { key: "sku", label: "Product Code" },
  { key: "category", label: "Category" },
  { key: "unit", label: "UOM" },
  { key: "quantity", label: "Quantity" },
  { key: "available", label: "Available" },
  { key: "reorder_level", label: "Reorder Level" },
  { key: "warehouse_name", label: "Warehouse" },
  { key: "status", label: "Status" },
  { key: "last_updated", label: "Last Updated" },
];

const EMPTY_SUMMARY = {
  total_products: 0,
  stock_value: 0,
  low_stock: 0,
  out_of_stock: 0,
  total_quantity: 0,
};

function formatInrAmount(value) {
  return `₹ ${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatQty(value, unit) {
  return formatInventoryQuantity(value, unit);
}

function formatUpdated(value) {
  if (!value) return "—";
  const valStr = String(value).slice(0, 10);
  const d = new Date(valStr.length === 10 ? `${valStr}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return valStr;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function resolveStatus(row) {
  const q = Number(row.available ?? row.quantity ?? 0) || 0;
  const reorder = Number(row.reorder_level) || 0;
  if (row.status === "damaged") return "damaged";
  if (row.status === "out_of_stock" || q <= 0) return "out_of_stock";
  if (row.status === "low_stock" || (reorder > 0 && q <= reorder)) return "low_stock";
  if (row.status === "ready") return "ready";
  return "available";
}

function thumbColor(name = "") {
  const colors = ["#0ea5e9", "#d97706", "#22c55e", "#a855f7", "#14b8a6", "#ef4444", "#f59e0b", "#64748b"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % colors.length;
  return colors[hash];
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}


const DEFAULT_FILTERS = {
  status: "",
  location: "",
  type: "",
  plant: "",
};

export default function FinishedGoods() {
  const tenantId = useTenantId();
  const { user } = useAuth();
  const canDeleteInventory = userCanDeleteInventoryItem(user);
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [products, setProducts] = useState([]);
  const [warehousesApi, setWarehousesApi] = useState([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => todayIso());
  const dateInputRef = useRef(null);
  const [headerWarehouse, setHeaderWarehouse] = useState("");
  const [selected, setSelected] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [formModal, setFormModal] = useState({ open: false, mode: "add", material: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    try {
      const [sumRes, listRes, whRes] = await Promise.allSettled([
        getFinishedGoodsSummary(),
        getFinishedGoods(),
        getWarehouses(),
      ]);
      if (sumRes.status === "fulfilled" && sumRes.value?.data) setSummary(sumRes.value.data);
      else setSummary({});
      if (listRes.status === "fulfilled") setProducts(asArray(listRes.value?.data));
      else setProducts([]);
      if (whRes.status === "fulfilled") setWarehousesApi(asArray(whRes.value?.data));
      else setWarehousesApi([]);
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useManufacturingRefresh(() => load({ background: true }));

  useEffect(() => {
    if (!headerWarehouse && warehousesApi.length) {
      setHeaderWarehouse(
        pickDefaultWarehouse(warehousesApi, {
          preferTypes: ["finished", "finished_good"],
          nameIncludes: ["finished good", "finished goods", "fg"],
        })
      );
    }
  }, [warehousesApi, headerWarehouse]);

  const rows = useMemo(
    () =>
      products.map((p) => {
        const available = Number(p.available ?? Math.max((Number(p.quantity) || 0) - (Number(p.reserved) || 0), 0));
        const rawDate = p.updated_at || p.last_updated || p.created_at;
        const rawDateStr = rawDate ? String(rawDate).slice(0, 10) : "";
        const effectiveLastUpdated =
          rawDateStr && selectedDate && rawDateStr <= selectedDate
            ? rawDateStr
            : selectedDate || rawDateStr || todayIso();
        return {
          ...p,
          available,
          reserved: Number(p.reserved || 0),
          description: p.description || p.category || "",
          last_updated: effectiveLastUpdated,
          thumb: thumbColor(p.name || p.sku || ""),
          live: true,
        };
      }),
    [products, selectedDate]
  );

  const kpis = useMemo(() => {
    let low = 0;
    let out = 0;
    let stockValue = Number(summary.stock_value) || 0;
    let totalQty = 0;
    rows.forEach((p) => {
      const st = resolveStatus(p);
      if (st === "out_of_stock" || st === "damaged") out += 1;
      else if (st === "low_stock") low += 1;
      totalQty += Number(p.available ?? p.quantity ?? 0) || 0;
      if (!summary.stock_value) {
        const q = Number(p.quantity ?? p.available ?? 0) || 0;
        const cost = Number(p.unit_cost) || 0;
        stockValue += p.stock_value != null ? Number(p.stock_value) : q * cost;
      }
    });
    const onlyUom = singleUomInRows(rows);
    return {
      total_products: summary.total_products ?? rows.length,
      stock_value: stockValue,
      low_stock: summary.low_stock ?? low,
      out_of_stock: summary.out_of_stock ?? out,
      total_quantity: onlyUom ? totalQty : null,
      total_quantity_label: onlyUom
        ? formatInventoryQuantity(totalQty, onlyUom)
        : summarizeQuantitiesByUom(rows, "available"),
    };
  }, [rows, summary]);

  const locationOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.warehouse_name).filter(Boolean));
    warehousesApi.forEach((w) => {
      if (w.name) set.add(w.name);
      if (w.branch) set.add(w.branch);
    });
    return Array.from(set).sort();
  }, [rows, warehousesApi]);

  const typeOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.category).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const plantOptions = useMemo(() => {
    const set = new Set();
    PLANTS.forEach((p) => set.add(p));
    warehousesApi.forEach((w) => {
      if (w.plant) set.add(w.plant);
    });
    rows.forEach((r) => {
      if (r.plant) set.add(r.plant);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [warehousesApi, rows]);

  const categories = typeOptions;
  const warehouseOptions = locationOptions;

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({ ...filters });
  }, [filters]);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  }, []);

  const handleFilterKeyDown = (e) => {
    if (e.key === "Enter") {
      handleApplyFilters();
    }
  };

  const filtered = useMemo(() => {
    let list = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.name, r.sku, r.category, r.description, r.warehouse_name].some(
          (v) => v && String(v).toLowerCase().includes(q)
        )
      );
    }
    if (appliedFilters.status) {
      list = list.filter((r) => resolveStatus(r) === appliedFilters.status);
    }
    if (appliedFilters.location) {
      const locNorm = appliedFilters.location.toLowerCase();
      list = list.filter((r) => {
        if (r.warehouse_name && r.warehouse_name.toLowerCase() === locNorm) return true;
        const wh = warehousesApi.find(
          (w) => w.name === r.warehouse_name || String(w.id) === String(r.warehouse_id)
        );
        if (wh?.branch && wh.branch.toLowerCase() === locNorm) return true;
        return false;
      });
    }
    if (appliedFilters.type) {
      const typeNorm = appliedFilters.type.toLowerCase();
      list = list.filter(
        (r) =>
          (r.category && r.category.toLowerCase() === typeNorm) ||
          (r.item_type && r.item_type.toLowerCase() === typeNorm)
      );
    }
    if (appliedFilters.plant) {
      const pNorm = appliedFilters.plant.toLowerCase();
      list = list.filter((r) => {
        if (r.plant && r.plant.toLowerCase().includes(pNorm)) return true;
        const wh = warehousesApi.find(
          (w) => w.name === r.warehouse_name || String(w.id) === String(r.warehouse_id)
        );
        if (wh?.plant && (wh.plant.toLowerCase().includes(pNorm) || pNorm.includes(wh.plant.toLowerCase()))) return true;
        if (wh?.branch && pNorm.includes(wh.branch.toLowerCase())) return true;
        return false;
      });
    }
    return list;
  }, [rows, search, appliedFilters, warehousesApi]);

  const requireLiveRow = (row, actionLabel = "This action") => {
    if (row.live && typeof row.id === "number") return true;
    addToast(`${actionLabel} is only available for live inventory items.`, "warning");
    return false;
  };

  const openDetail = async (row) => {
    if (row.live && typeof row.id === "number") {
      try {
        const res = await getInventoryItem(row.id);
        setSelected({
          ...res.data,
          quantity: row.quantity,
          available: row.available,
          reserved: row.reserved,
          reorder_level: row.reorder_level ?? res.data.reorder_level,
          readOnly: true,
        });
        return;
      } catch {
        addToast("Could not load product detail", "error");
      }
    }
    setSelected({ ...row, readOnly: true });
  };

  const handleView = (row) => openDetail(row);
  const handleEdit = (row) => {
    if (!requireLiveRow(row, "Edit")) return;
    setFormModal({ open: true, mode: "edit", material: row });
  };
  const handleAdd = () => setFormModal({ open: true, mode: "add", material: null });
  const handleDeleteRequest = (row) => {
    if (!requireLiveRow(row, "Delete")) return;
    setDeleteTarget(row);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.id) return;
    const itemId = deleteTarget.id;
    setDeleting(true);
    try {
      await deleteInventoryItem(itemId);
      addToast("Finished good deleted successfully");
      setDeleteTarget(null);
      notifyManufacturingSpine(MANUFACTURING_EVENTS.INVENTORY_CHANGED, { item_id: itemId });
      await load({ background: true });
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not delete finished good"), "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleFormSaved = async () => {
    addToast(formModal.mode === "edit" ? "Finished good updated successfully" : "Finished good added successfully");
    notifyManufacturingSpine(MANUFACTURING_EVENTS.INVENTORY_CHANGED, {});
    await load({ background: true });
  };

  const defaultWarehouseName =
    warehousesApi.find((w) => String(w.id) === String(headerWarehouse))?.name ||
    warehousesApi[0]?.name ||
    "Main Warehouse";

  const columns = [
    {
      key: "name",
      label: "Product Name",
      render: (r) => (
        <div className="flex min-w-[180px] items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
            style={{ backgroundColor: r.thumb || thumbColor(r.name) }}
            aria-hidden
          >
            {(r.name || "?").slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--color-text)]">{r.name}</p>
            <p className="truncate text-[11px] text-[var(--color-text-muted)]">{r.description || r.category || "—"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "sku",
      label: "SKU / Code",
      render: (r) => <span className="tabular-nums text-[13px] text-[var(--color-text-secondary)]">{r.sku || "—"}</span>,
    },
    {
      key: "category",
      label: "Category",
      render: (r) => <span className="text-[13px] text-[var(--color-text)]">{r.category || "—"}</span>,
    },
    {
      key: "unit",
      label: "UOM",
      render: (r) => <span className="text-[13px] text-[var(--color-text-secondary)]">{r.unit || "—"}</span>,
    },
    {
      key: "available",
      label: "Available Qty",
      render: (r) => (
        <span className="tabular-nums text-[13px] font-semibold text-[var(--color-text)]">{formatQty(r.available, r.unit)}</span>
      ),
    },
    {
      key: "reserved",
      label: "Reserved Qty",
      render: (r) => (
        <span className="tabular-nums text-[13px] text-[var(--color-text-secondary)]">{formatQty(r.reserved)}</span>
      ),
    },
    {
      key: "reorder_level",
      label: "Reorder Level",
      render: (r) => (
        <span className="tabular-nums text-[13px] text-[var(--color-text-secondary)]">
          {r.reorder_level != null ? formatQty(r.reorder_level) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Stock Status",
      render: (r) => {
        const st = resolveStatus(r);
        return <StatusBadge tone={stockStatusTone(st)}>{stockStatusLabel(st)}</StatusBadge>;
      },
    },
    {
      key: "warehouse_name",
      label: "Warehouse",
      render: (r) => <span className="text-[13px] text-[var(--color-text-secondary)]">{r.warehouse_name || "—"}</span>,
    },
    {
      key: "last_updated",
      label: "Last Updated",
      render: (r) => (
        <span className="whitespace-nowrap text-[12px] text-[var(--color-text-muted)]">{formatUpdated(r.last_updated)}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      className: "min-w-[4.5rem] w-[4.5rem] whitespace-nowrap",
      render: (r) => (
        <div className="flex items-center justify-end whitespace-nowrap">
          <InventoryRowActionsMenu
            rowId={r.id}
            isOpen={openMenuId === r.id}
            onOpen={setOpenMenuId}
            onClose={() => setOpenMenuId(null)}
            onView={() => handleView(r)}
            onEdit={() => handleEdit(r)}
            onAdd={handleAdd}
            onDelete={() => handleDeleteRequest(r)}
            showDelete={canDeleteInventory}
          />
        </div>
      ),
    },
  ];

  const exportRows = filtered.map((r) => ({
    name: r.name,
    sku: r.sku || "",
    category: r.category || "",
    unit: r.unit || "",
    quantity: formatQty(r.quantity ?? r.available),
    available: formatQty(r.available ?? r.quantity),
    reorder_level: r.reorder_level ?? "",
    warehouse_name: r.warehouse_name || "",
    status: stockStatusLabel(resolveStatus(r)),
    last_updated: formatUpdated(r.last_updated),
  }));

  const handleExport = async (format) => {
    try {
      if (format === "pdf") {
        await exportToPdf(exportRows, FINISHED_GOODS_EXPORT_COLUMNS, "Finished Goods", "finished-goods");
      } else {
        await exportToExcel(exportRows, FINISHED_GOODS_EXPORT_COLUMNS, "finished-goods");
      }
      addToast(
        exportRows.length
          ? (format === "pdf" ? "Exported to PDF" : "Exported to Excel")
          : "Downloaded an empty Finished Goods report.",
        "success",
      );
    } catch (error) {
      console.error("Finished Goods export failed:", error);
      addToast(apiErrorMessage(error, "Unable to download the Finished Goods report."), "error");
    }
  };

  if (loading) return <Loader label="Loading finished goods…" />;

  return (
    <ListPageShell>
    <div className="min-w-0 space-y-5 pb-4">
      <PageHeader variant="inventory"
        subtitle="Manage and track your finished goods inventory"
        action={
          <InventoryHeaderControls
            sectionTitle="Finished Goods"
            itemType="finished_good"
            dateValue={selectedDate}
            onDateChange={(v) => setSelectedDate(v || todayISO())}
            warehouseValue={headerWarehouse}
            onWarehouseChange={setHeaderWarehouse}
            warehouses={warehousesApi}
          />
        }
      />

      <div className="ui-grid-kpi">
        <ClickableKpiCard
          onClick={() => {
            setFilters(DEFAULT_FILTERS);
            setAppliedFilters(DEFAULT_FILTERS);
            setSearch("");
          }}
          title="Show all finished goods"
          tone="info"
        >
          <KpiCard label="Total Products" value={Number(kpis.total_products).toLocaleString("en-IN")} icon={Package} tone="info" meta="Click to show all" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => {
            setFilters(DEFAULT_FILTERS);
            setAppliedFilters(DEFAULT_FILTERS);
            setSearch("");
          }}
          title="View total stock value"
          tone="success"
        >
          <KpiCard label="Total Stock Value" value={formatInrAmount(kpis.stock_value)} icon={Coins} tone="success" meta="Across all warehouses" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => {
            const next = { ...DEFAULT_FILTERS, status: "low_stock" };
            setFilters(next);
            setAppliedFilters(next);
          }}
          title="Filter low stock items"
          tone="warning"
        >
          <KpiCard label="Low Stock Items" value={kpis.low_stock} icon={AlertTriangle} tone="warning" meta="Click to filter" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => {
            const next = { ...DEFAULT_FILTERS, status: "out_of_stock" };
            setFilters(next);
            setAppliedFilters(next);
          }}
          title="Filter out of stock items"
          tone="danger"
        >
          <KpiCard label="Out of Stock" value={kpis.out_of_stock} icon={PackageX} tone="danger" meta="Click to filter" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => {
            setFilters(DEFAULT_FILTERS);
            setAppliedFilters(DEFAULT_FILTERS);
            setSearch("");
          }}
          title="View total quantity"
          tone="info"
        >
          <KpiCard
            label="Total Quantity"
            value={kpis.total_quantity_label}
            icon={ArrowDownToLine}
            tone="info"
            meta={kpis.total_quantity != null ? `All products (${singleUomInRows(rows) || ""})` : "By unit of measure"}
          />
        </ClickableKpiCard>
      </div>

      <ListPageCard>
        <ListPageCardBody>
        <div className={`flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between ${showFilters ? "mb-3" : "mb-4"}`}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search finished goods..."
            className="w-full min-w-0 max-w-none flex-1 lg:mr-4"
          />

          <div className="flex flex-wrap items-center gap-2">
            <ExportDownloadMenu onExport={handleExport} />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowFilters((v) => !v)}
              className={showFilters ? "!border-[var(--color-primary)] !text-[var(--color-primary)] font-semibold" : ""}
            >
              <Filter className="h-4 w-4" /> Filters
              {Object.values(appliedFilters).filter(Boolean).length > 0 ? (
                <span className="ml-1 rounded-full bg-[var(--color-primary)] px-1.5 py-0.2 text-[10px] text-white">
                  {Object.values(appliedFilters).filter(Boolean).length}
                </span>
              ) : null}
            </Button>
            <Button type="button" variant="add" onClick={handleAdd} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              Add Finished Good
            </Button>
          </div>
        </div>

        {showFilters ? (
          <section
            aria-label="Filter finished goods"
            className="-mx-4 sm:-mx-5 px-4 sm:px-5 mb-4 flex flex-wrap items-center gap-3 border-y border-[var(--color-border-soft)] py-3.5"
          >
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              onKeyDown={handleFilterKeyDown}
              className="ui-select !w-auto min-w-[8.5rem]"
            >
              <option value="">Status</option>
              <option value="available">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="ready">Ready</option>
              <option value="damaged">Damaged</option>
            </select>
            <select
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
              onKeyDown={handleFilterKeyDown}
              className="ui-select !w-auto min-w-[8.5rem]"
            >
              <option value="">Location</option>
              {locationOptions.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <select
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
              onKeyDown={handleFilterKeyDown}
              className="ui-select !w-auto min-w-[8.5rem]"
            >
              <option value="">Type</option>
              {typeOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={filters.plant}
              onChange={(e) => setFilters((f) => ({ ...f, plant: e.target.value }))}
              onKeyDown={handleFilterKeyDown}
              className="ui-select !w-auto min-w-[8.5rem]"
            >
              <option value="">Plant</option>
              {plantOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleApplyFilters}
                className="h-10 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 text-xs sm:text-sm transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap text-center justify-center flex items-center"
              >
                Apply Filters
              </button>
              <button
                type="button"
                onClick={handleClearFilters}
                className="h-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold px-5 text-xs sm:text-sm transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap text-center justify-center flex items-center"
              >
                Clear
              </button>
            </div>
          </section>
        ) : null}

        <DataTable
          columns={columns}
          data={filtered}
          showSearch={false}
          pageSize={10}
          wrapClassName="inventory-table-scroll--finished-goods rounded-lg border border-[var(--color-border-soft)]"
          emptyState={
            <EmptyState
              icon="document"
              title="No records found."
              description="There is nothing to show here yet."
              className="border-none bg-transparent py-12"
            />
          }
        />
        </ListPageCardBody>
      </ListPageCard>

      {selected ? (
        <MaterialDetailModal
          material={selected}
          readOnly
          nameLabel="Product Name"
          onClose={() => setSelected(null)}
        />
      ) : null}

      <MaterialFormModal
        open={formModal.open}
        mode={formModal.mode}
        material={formModal.material}
        itemType="finished_good"
        tenantId={tenantId}
        warehouseName={defaultWarehouseName}
        onClose={() => setFormModal({ open: false, mode: "add", material: null })}
        onSaved={handleFormSaved}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete record"
        message="Are you sure you want to delete this record?"
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
    </ListPageShell>
  );
}
