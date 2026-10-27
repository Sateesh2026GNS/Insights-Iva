import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  ClipboardCheck,
  Filter,
  IndianRupee,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  Warehouse,
} from "lucide-react";

import Button from "../../components/common/Button";
import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import KpiCard, { ClickableKpiCard } from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
import { ListPageCard, ListPageCardBody } from "../../components/common/ListPageShell";
import { SearchBar } from "../../components/common/SearchFilter";
import PageHeader from "../../components/common/PageHeader";
import InventoryHeaderControls from "../../components/inventory/InventoryHeaderControls";
import StatusBadge from "../../components/common/StatusBadge";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import InventoryRowActionsMenu from "../../components/inventory/InventoryRowActionsMenu";
import WarehouseDetailModal, { WarehouseFormModal } from "../../components/inventory/WarehouseDetailModal";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  createWarehouseFull,
  deactivateWarehouse,
  getWarehouseDetail,
  getWarehouses,
  updateWarehouse,
} from "../../api/inventoryApi";
import {
  BRANCHES,
  PLANTS,
  WAREHOUSE_STATUSES,
  WAREHOUSE_TYPES,
  enrichApiWarehouse,
} from "../../data/warehousesMasterData";
import { asArray } from "../../utils/apiError";
import { todayIso } from "../../utils/dateUtils";
import { uploadAndAttachWarehouseDocument } from "../../utils/warehouseDocuments";

function formatInrAmount(value) {
  return `₹ ${Number(value || 0).toLocaleString("en-IN")}`;
}

function thumbColor(name = "") {
  const colors = ["#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#0ea5e9", "#64748b", "#14b8a6", "#ef4444"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % colors.length;
  return colors[hash];
}


const DEFAULT_FILTERS = {
  status: "",
  location: "",
  type: "",
  plant: "",
};

export default function Warehouses() {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [formWarehouse, setFormWarehouse] = useState(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [headerDate, setHeaderDate] = useState("");
  const [headerScope, setHeaderScope] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const wRes = await getWarehouses().catch(() => ({ data: [] }));
      const apiRows = asArray(wRes.data);
      const createdDate = apiRows[0]?.created_at?.slice?.(0, 10) || todayIso();
      setHeaderDate(createdDate);
      setWarehouses(apiRows.map((row, i) => ({ ...enrichApiWarehouse(row, i), live: true })));
    } catch {
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(loadWarehouses);
  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  const rows = useMemo(
    () =>
      warehouses.map((w) => ({
        ...w,
        description: w.description || w.warehouse_type || w.plant || "",
        country: w.country || "India",
        total_items: w.total_items ?? w.item_count ?? 0,
        inventory_value: Number(w.inventory_value ?? w.stock_value ?? 0) || 0,
        thumb: thumbColor(w.name || w.code || ""),
        live: true,
      })),
    [warehouses]
  );

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({ ...filters });
  }, [filters]);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setHeaderScope("");
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
      list = list.filter((w) =>
        [w.name, w.code, w.city, w.state, w.branch, w.description, w.plant, w.warehouse_type].some(
          (v) => v && String(v).toLowerCase().includes(q)
        )
      );
    }
    if (appliedFilters.status) {
      list = list.filter((w) => String(w.status || "").toLowerCase() === appliedFilters.status.toLowerCase());
    }
    if (appliedFilters.location) {
      const locNorm = appliedFilters.location.toLowerCase();
      list = list.filter((w) => (w.branch && w.branch.toLowerCase() === locNorm) || (w.city && w.city.toLowerCase() === locNorm));
    }
    if (appliedFilters.type) {
      const tNorm = appliedFilters.type.toLowerCase();
      list = list.filter((w) => w.warehouse_type && w.warehouse_type.toLowerCase() === tNorm);
    }
    if (appliedFilters.plant) {
      const pNorm = appliedFilters.plant.toLowerCase();
      list = list.filter((w) => w.plant && (w.plant.toLowerCase().includes(pNorm) || pNorm.includes(w.plant.toLowerCase())));
    }
    if (headerScope && headerScope !== "all") {
      list = list.filter((w) => String(w.id) === String(headerScope) || w.code === headerScope);
    }
    return list;
  }, [rows, search, appliedFilters, headerScope]);

  const kpis = useMemo(() => {
    const active = filtered.filter((w) => w.status === "active").length;
    const totalItems = filtered.reduce((s, w) => s + Number(w.total_items || 0), 0);
    const stockValue = filtered.reduce((s, w) => s + Number(w.inventory_value || 0), 0);
    return {
      total: filtered.length,
      totalItems,
      stockValue,
      active,
    };
  }, [filtered]);

  const openWarehouse = async (wh) => {
    setSelected(wh);
    setDetail(null);
    setDetailError(false);
    if (wh.live && typeof wh.id === "number") {
      setDetailLoading(true);
      try {
        const res = await getWarehouseDetail(wh.id);
        setDetail(res.data);
      } catch {
        setDetailError(true);
      } finally {
        setDetailLoading(false);
      }
    } else {
      setDetailLoading(false);
    }
  };

  const clearFilters = handleClearFilters;

  const handleSave = async (form) => {
    const usedCap = form.used_capacity !== "" && form.used_capacity != null ? Number(form.used_capacity) : 0;
    const cap = form.capacity !== "" && form.capacity != null ? Number(form.capacity) : null;
    const payload = {
      tenant_id: tenantId,
      name: form.name,
      code: form.code,
      branch: form.branch,
      plant: form.plant,
      warehouse_type: form.warehouse_type,
      state: form.state,
      city: form.city,
      address: form.address,
      manager_name: form.manager_name,
      manager_phone: form.manager_phone,
      capacity: cap,
      used_capacity: usedCap,
      rack_count: form.rack_count === "" ? null : Number(form.rack_count),
      bin_count: form.bin_count === "" ? null : Number(form.bin_count),
      is_primary: form.is_primary,
      status: form.status,
    };
    let savedWarehouseId = null;
    let savedRemotely = false;
    try {
      if (formWarehouse?.id && typeof formWarehouse.id === "number") {
        const response = await updateWarehouse(formWarehouse.id, payload);
        savedWarehouseId = response?.data?.id ?? formWarehouse.id;
      } else {
        const response = await createWarehouseFull(payload);
        savedWarehouseId = response?.data?.id;
      }
      savedRemotely = Number.isInteger(Number(savedWarehouseId)) && Number(savedWarehouseId) > 0;
    } catch {
      /* Keep the existing local fallback when the warehouse API is unavailable. */
    }

    if (savedRemotely) {
      const documents = Array.isArray(form.documents) ? form.documents : [];
      const uploadErrors = [];
      for (const file of documents) {
        try {
          await uploadAndAttachWarehouseDocument(file, Number(savedWarehouseId));
        } catch (error) {
          uploadErrors.push(`${file.name}: ${error?.message || "upload failed"}`);
        }
      }
      addToast(formWarehouse?.id ? "Warehouse updated" : "Warehouse created");
      if (documents.length && !uploadErrors.length) {
        addToast(`${documents.length} document${documents.length === 1 ? "" : "s"} attached`);
      } else if (uploadErrors.length) {
        addToast(`Warehouse saved, but document upload failed: ${uploadErrors.join("; ")}`, "error");
      }
      loadWarehouses();
      if (selected?.id === Number(savedWarehouseId)) {
        try {
          const refreshed = await getWarehouseDetail(Number(savedWarehouseId));
          setDetail(refreshed.data);
          setDetailError(false);
        } catch {
          setDetailError(true);
        }
      }
      setFormWarehouse(null);
      return;
    }

    if (formWarehouse?.id) {
      const used = form.used_capacity ? Number(form.used_capacity) : 0;
      const avail =
        form.available_capacity != null && form.available_capacity !== ""
          ? Number(form.available_capacity)
          : cap
            ? Math.max(0, cap - used)
            : 0;
      setWarehouses((prev) =>
        prev.map((w) => (w.id === formWarehouse.id ? { ...w, ...form, used_capacity: used, available_capacity: avail, live: true } : w))
      );
      addToast("Warehouse updated locally");
    } else {
      const used = form.used_capacity ? Number(form.used_capacity) : 0;
      const avail =
        form.available_capacity != null && form.available_capacity !== ""
          ? Number(form.available_capacity)
          : cap
            ? Math.max(0, Number(cap) - used)
            : 0;
      const newW = {
        ...enrichApiWarehouse({ id: `new-${Date.now()}`, ...payload }, warehouses.length),
        id: `new-${Date.now()}`,
        ...form,
        used_capacity: used,
        available_capacity: avail,
        inventory_value: 0,
        created_at: new Date().toISOString().slice(0, 10),
        live: true,
      };
      setWarehouses((prev) => [...prev, newW]);
      addToast("Warehouse added");
    }
    if (form.documents?.length) {
      addToast("The warehouse is only saved locally, so its documents were not uploaded or attached.", "warning");
    }
    setFormWarehouse(null);
  };

  const handleDeleteRequest = (wh) => {
    if (wh.live && typeof wh.id === "number") {
      setDeleteTarget(wh);
      return;
    }
    addToast("Delete is only available for live warehouse records.", "warning");
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.live && typeof deleteTarget.id === "number") {
        await deactivateWarehouse(deleteTarget.id);
        addToast("Warehouse deactivated");
        loadWarehouses();
        setSelected(null);
      } else {
        setWarehouses((prev) => prev.map((w) => (w.id === deleteTarget.id ? { ...w, status: "inactive" } : w)));
        setSelected(null);
        addToast("Warehouse deactivated");
      }
      setDeleteTarget(null);
    } catch {
      addToast("Could not deactivate warehouse", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeactivate = (wh) => setDeleteTarget(wh);

  const columns = [
    {
      key: "name",
      label: "Warehouse Name",
      width: "280px",
      render: (r) => (
        <div className="flex min-w-[200px] items-start gap-2.5">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: r.thumb || thumbColor(r.name) }}
          >
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-[13px] font-semibold text-[var(--color-text)]">{r.name}</p>
              {r.is_primary ? <StatusBadge tone="success">Primary</StatusBadge> : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
              {r.description || "—"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "code",
      label: "Warehouse Code",
      width: "145px",
      render: (r) => <span className="tabular-nums text-[13px] text-[var(--color-text-secondary)]">{r.code || "—"}</span>,
    },
    {
      key: "location",
      label: "Location",
      width: "165px",
      render: (r) => (
        <span className="inline-flex max-w-[180px] items-start gap-1 text-[13px] text-[var(--color-text-secondary)]">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
          <span>
            {[r.city, r.state].filter(Boolean).join(", ") || r.branch || "—"}
            {r.country ? ` ${r.country}` : ""}
          </span>
        </span>
      ),
    },
    {
      key: "total_items",
      label: "Total Items",
      align: "center",
      width: "110px",
      render: (r) => (
        <span className="tabular-nums text-[13px] font-semibold text-[var(--color-text)]">
          {Number(r.total_items || 0).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "inventory_value",
      label: "Stock Value",
      align: "center",
      width: "120px",
      render: (r) => (
        <span className="whitespace-nowrap tabular-nums text-[13px] font-semibold text-[var(--color-text)]">
          {formatInrAmount(r.inventory_value)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      align: "center",
      width: "105px",
      render: (r) => (
        <StatusBadge tone={r.status === "active" ? "success" : "neutral"}>
          {r.status === "active" ? "Active" : "Inactive"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      sortable: false,
      width: "74px",
      className: "min-w-[4.5rem] w-[4.5rem] whitespace-nowrap",
      render: (r) => (
        <div className="flex items-center justify-center whitespace-nowrap">
          <InventoryRowActionsMenu
            rowId={r.id}
            isOpen={openMenuId === r.id}
            onOpen={setOpenMenuId}
            onClose={() => setOpenMenuId(null)}
            onView={() => openWarehouse(r)}
            onEdit={() => setFormWarehouse(r.live ? r : {})}
            showAdd={false}
            onDelete={() => handleDeleteRequest(r)}
          />
        </div>
      ),
    },
  ];

  if (loading) return <Loader label="Loading warehouses…" />;

  return (
    <div className="min-w-0 space-y-5 pb-4">
      <PageHeader variant="inventory"
        subtitle="Manage and organize all your warehouses"
        action={
          <InventoryHeaderControls
            dateValue={headerDate}
            onDateChange={setHeaderDate}
            warehouseValue={headerScope}
            onWarehouseChange={setHeaderScope}
            warehouseOptions={[
              { value: "", label: "All Warehouses" },
              ...rows.map((w) => ({ value: w.id, label: w.name })),
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ClickableKpiCard
          onClick={() => {
            setFilters(DEFAULT_FILTERS);
            setAppliedFilters(DEFAULT_FILTERS);
            setSearch("");
          }}
          title="Show all warehouses"
          tone="info"
        >
          <KpiCard label="Total Warehouses" value={kpis.total} icon={Warehouse} tone="info" meta="Click to show all" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => {
            setFilters(DEFAULT_FILTERS);
            setAppliedFilters(DEFAULT_FILTERS);
            setSearch("");
          }}
          title="View total items"
          tone="success"
        >
          <KpiCard label="Total Items" value={Number(kpis.totalItems).toLocaleString("en-IN")} icon={Package} tone="success" meta="In all warehouses" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => {
            setFilters(DEFAULT_FILTERS);
            setAppliedFilters(DEFAULT_FILTERS);
            setSearch("");
          }}
          title="View total stock value"
          tone="warning"
        >
          <KpiCard label="Total Stock Value" value={formatInrAmount(kpis.stockValue)} icon={IndianRupee} tone="warning" meta="Across all warehouses" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => {
            const next = { ...DEFAULT_FILTERS, status: "active" };
            setFilters(next);
            setAppliedFilters(next);
            setSearch("");
          }}
          title="Filter active warehouses"
          tone="success"
        >
          <KpiCard label="Active Warehouses" value={kpis.active} icon={ClipboardCheck} tone="success" meta="Click to filter" />
        </ClickableKpiCard>
      </div>

      <ListPageCard>
        <ListPageCardBody>
          <div className={`flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between ${showFilters ? "mb-3" : "mb-4"}`}>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search warehouses..."
              className="w-full min-w-0 max-w-none flex-1 lg:mr-4"
              inputClassName="pending-inventory-search-input"
            />
            <div className="flex flex-wrap items-center gap-2">
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
              <Button variant="add" type="button" onClick={() => setFormWarehouse({})} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                Add Warehouse
              </Button>
            </div>
          </div>

          {showFilters ? (
            <section
              aria-label="Filter warehouses"
              className="-mx-4 sm:-mx-5 px-4 sm:px-5 mb-4 flex flex-wrap items-center gap-3 border-y border-[var(--color-border-soft)] py-3.5"
            >
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                onKeyDown={handleFilterKeyDown}
                className="ui-select !w-auto min-w-[8.5rem]"
              >
                <option value="">Status</option>
                {WAREHOUSE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={filters.location}
                onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
                onKeyDown={handleFilterKeyDown}
                className="ui-select !w-auto min-w-[8.5rem]"
              >
                <option value="">Location</option>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <select
                value={filters.type}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
                onKeyDown={handleFilterKeyDown}
                className="ui-select !w-auto min-w-[8.5rem]"
              >
                <option value="">Type</option>
                {WAREHOUSE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                value={filters.plant}
                onChange={(e) => setFilters((f) => ({ ...f, plant: e.target.value }))}
                onKeyDown={handleFilterKeyDown}
                className="ui-select !w-auto min-w-[8.5rem]"
              >
                <option value="">Plant</option>
                {PLANTS.map((p) => (
                  <option key={p} value={p}>{p}</option>
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
            wrapClassName="inventory-table-scroll--warehouses rounded-lg border border-[var(--color-border-soft)]"
            tableClassName="table-fixed"
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
        <WarehouseDetailModal
          warehouse={selected}
          detail={detail}
          detailLoading={detailLoading}
          detailError={detailError}
          onClose={() => {
            setSelected(null);
            setDetail(null);
            setDetailLoading(false);
            setDetailError(false);
          }}
          onEdit={(w) => {
            setFormWarehouse(w);
            setSelected(null);
          }}
          onDeactivate={handleDeactivate}
        />
      ) : null}

      {formWarehouse ? (
        <WarehouseFormModal warehouse={formWarehouse} onClose={() => setFormWarehouse(null)} onSave={handleSave} />
      ) : null}

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
