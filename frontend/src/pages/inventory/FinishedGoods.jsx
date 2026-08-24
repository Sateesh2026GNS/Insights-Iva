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
import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import KpiCard from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import StatusBadge from "../../components/common/StatusBadge";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import InventoryRowActionsMenu from "../../components/inventory/InventoryRowActionsMenu";
import InventoryHeaderControls from "../../components/inventory/InventoryHeaderControls";
import MaterialDetailModal from "../../components/inventory/MaterialDetailModal";
import MaterialFormModal from "../../components/inventory/MaterialFormModal";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import {
  deleteInventoryItem,
  getFinishedGoods,
  getFinishedGoodsSummary,
  getInventoryItem,
  getWarehouses,
} from "../../api/inventoryApi";
import { stockStatusLabel, stockStatusTone } from "../../data/inventoryMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { asArray } from "../../utils/apiError";
import { notifyManufacturingSpine, MANUFACTURING_EVENTS } from "../../utils/manufacturingEvents";

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

function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUpdated(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
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

const KPI_TONE_RING = {
  primary: "hover:ring-2 hover:ring-[var(--kpi-primary)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-primary)]",
  info: "hover:ring-2 hover:ring-[var(--kpi-info)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-info)]",
  success: "hover:ring-2 hover:ring-[var(--kpi-success)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-success)]",
  warning: "hover:ring-2 hover:ring-[var(--kpi-warning)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-warning)]",
  danger: "hover:ring-2 hover:ring-[var(--kpi-danger)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-danger)]",
  yellow: "hover:ring-2 hover:ring-[var(--kpi-warning)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-warning)]",
  violet: "hover:ring-2 hover:ring-[var(--kpi-violet)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-violet)]",
  teal: "hover:ring-2 hover:ring-[var(--kpi-teal)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-teal)]",
  orange: "hover:ring-2 hover:ring-[var(--kpi-orange)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-orange)]",
  neutral: "hover:ring-2 hover:ring-[var(--kpi-neutral)] focus-visible:ring-2 focus-visible:ring-[var(--kpi-neutral)]",
};

function ClickableKpiCard({ onClick, title, tone, children }) {
  const resolvedTone = tone || children?.props?.tone || "primary";
  const ringClass = KPI_TONE_RING[resolvedTone] || KPI_TONE_RING.primary;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-full w-full rounded-[var(--radius-lg)] text-left transition focus:outline-none ${ringClass}`}
      title={title}
    >
      {children}
    </button>
  );
}

export default function FinishedGoods() {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [products, setProducts] = useState([]);
  const [warehousesApi, setWarehousesApi] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [category, setCategory] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [selectedDate, setSelectedDate] = useState("2026-08-13");
  const dateInputRef = useRef(null);
  const [headerWarehouse, setHeaderWarehouse] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
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
      setHeaderWarehouse(String(warehousesApi[0].id));
    }
  }, [warehousesApi, headerWarehouse]);

  const rows = useMemo(
    () =>
      products.map((p) => {
        const available = Number(p.available ?? Math.max((Number(p.quantity) || 0) - (Number(p.reserved) || 0), 0));
        return {
          ...p,
          available,
          reserved: Number(p.reserved || 0),
          description: p.description || p.category || "",
          last_updated: p.updated_at || p.last_updated || p.created_at,
          thumb: thumbColor(p.name || p.sku || ""),
          live: true,
        };
      }),
    [products]
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
    return {
      total_products: summary.total_products ?? rows.length,
      stock_value: stockValue,
      low_stock: summary.low_stock ?? low,
      out_of_stock: summary.out_of_stock ?? out,
      total_quantity: totalQty,
    };
  }, [rows, summary]);

  const categories = useMemo(() => {
    const set = new Set(rows.map((r) => r.category).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const warehouseOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.warehouse_name).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

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
    if (statusFilter) list = list.filter((r) => resolveStatus(r) === statusFilter);
    if (category) list = list.filter((r) => r.category === category);
    if (warehouse) list = list.filter((r) => r.warehouse_name === warehouse);
    return list;
  }, [rows, search, statusFilter, category, warehouse]);

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
    } catch {
      addToast("Could not delete finished good", "error");
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

  const toggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columns = [
    {
      key: "_check",
      label: "",
      sortable: false,
      render: (r) => (
        <input
          type="checkbox"
          checked={selectedIds.has(r.id)}
          onChange={() => toggleRow(r.id)}
          className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-action-teal)]"
          aria-label={`Select ${r.name}`}
        />
      ),
    },
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
        <span className="tabular-nums text-[13px] font-semibold text-[var(--color-text)]">{formatQty(r.available)}</span>
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
          />
        </div>
      ),
    },
  ];

  if (loading) return <Loader label="Loading finished goods…" />;

  return (
    <div className="min-w-0 space-y-5 pb-4">
      <PageHeader
        subtitle="Manage and track your finished goods inventory"
        action={
          <InventoryHeaderControls
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
          onClick={() => { setStatusFilter(""); setSearch(""); }}
          title="Show all finished goods"
          tone="info"
        >
          <KpiCard label="Total Products" value={Number(kpis.total_products).toLocaleString("en-IN")} icon={Package} tone="info" meta="Click to show all" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => { setStatusFilter(""); setSearch(""); }}
          title="View total stock value"
          tone="success"
        >
          <KpiCard label="Total Stock Value" value={formatInrAmount(kpis.stock_value)} icon={Coins} tone="success" meta="Across all warehouses" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => setStatusFilter("low_stock")}
          title="Filter low stock items"
          tone="warning"
        >
          <KpiCard label="Low Stock Items" value={kpis.low_stock} icon={AlertTriangle} tone="warning" meta="Click to filter" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => setStatusFilter("out_of_stock")}
          title="Filter out of stock items"
          tone="danger"
        >
          <KpiCard label="Out of Stock" value={kpis.out_of_stock} icon={PackageX} tone="danger" meta="Click to filter" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => { setStatusFilter(""); setSearch(""); }}
          title="View total quantity"
          tone="info"
        >
          <KpiCard label="Total Quantity" value={formatQty(kpis.total_quantity)} icon={ArrowDownToLine} tone="info" meta="Across all products" />
        </ClickableKpiCard>
      </div>

      <div className="ui-card p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative ui-search-wrap min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="search"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ui-input w-full !pl-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowFilters((v) => !v)}>
              <Filter className="h-4 w-4" /> Filters
            </Button>
            {showFilters ? (
              <>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="ui-select !w-auto min-w-[8.5rem]">
                  <option value="">Category</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ui-select !w-auto min-w-[8.5rem]">
                  <option value="">Status</option>
                  <option value="available">In Stock</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
                <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className="ui-select !w-auto min-w-[9rem]">
                  <option value="">Warehouse</option>
                  {warehouseOptions.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <Button type="button" variant="primary" onClick={handleAdd}>
              <Plus className="h-4 w-4" /> Add Finished Good
            </Button>
          </div>
        </div>

        <div className="inventory-table-scroll inventory-table-scroll--finished-goods rounded-lg border border-[var(--color-border-soft)]">
          <DataTable
            columns={columns}
            data={filtered}
            showSearch={false}
            pageSize={10}
            emptyState={
              <EmptyState
                icon="cube"
                title="No finished goods found"
                description="Add your first finished good to start tracking stock."
              />
            }
          />
        </div>
      </div>

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
  );
}
