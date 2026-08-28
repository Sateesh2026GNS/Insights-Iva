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
import KpiCard from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
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

function formatInrAmount(value) {
  return `₹ ${Number(value || 0).toLocaleString("en-IN")}`;
}

function utilizationTone(pct) {
  const n = Number(pct) || 0;
  if (n >= 80) return { bar: "bg-[#ef4444]", text: "text-[#ef4444]" };
  if (n >= 55 && n < 70) return { bar: "bg-[#f59e0b]", text: "text-[#d97706]" };
  return { bar: "bg-[#16a34a]", text: "text-[#16a34a]" };
}

function thumbColor(name = "") {
  const colors = ["#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#0ea5e9", "#64748b", "#14b8a6", "#ef4444"];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % colors.length;
  return colors[hash];
}

function ClickableKpiCard({ onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block h-full w-full border-0 p-0 bg-transparent text-left focus:outline-none cursor-pointer"
      title={title}
    >
      {children}
    </button>
  );
}

export default function Warehouses() {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [formWarehouse, setFormWarehouse] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [headerDate, setHeaderDate] = useState("2026-08-13");
  const [headerScope, setHeaderScope] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const wRes = await getWarehouses().catch(() => ({ data: [] }));
      const apiRows = asArray(wRes.data);
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
        utilization_pct:
          w.utilization_pct ??
          (w.capacity ? Math.round(((w.used_capacity || 0) / w.capacity) * 100) : 0),
        thumb: thumbColor(w.name || w.code || ""),
        live: true,
      })),
    [warehouses]
  );

  const filtered = useMemo(() => {
    let list = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((w) =>
        [w.name, w.code, w.city, w.state, w.branch, w.description].some(
          (v) => v && String(v).toLowerCase().includes(q)
        )
      );
    }
    if (statusFilter) list = list.filter((w) => String(w.status || "").toLowerCase() === statusFilter);
    if (branchFilter) list = list.filter((w) => w.branch === branchFilter || w.city === branchFilter);
    if (headerScope && headerScope !== "all") {
      list = list.filter((w) => String(w.id) === String(headerScope) || w.code === headerScope);
    }
    return list;
  }, [rows, search, statusFilter, branchFilter, headerScope]);

  const kpis = useMemo(() => {
    const active = filtered.filter((w) => w.status === "active").length;
    const totalItems = filtered.reduce((s, w) => s + Number(w.total_items || 0), 0);
    const stockValue = filtered.reduce((s, w) => s + Number(w.inventory_value || 0), 0);
    const utilValues = filtered.map((w) => Number(w.utilization_pct) || 0).filter((n) => n > 0);
    const avgUtilization = utilValues.length
      ? Math.round(utilValues.reduce((a, b) => a + b, 0) / utilValues.length)
      : 0;
    return {
      total: filtered.length,
      totalItems,
      stockValue,
      avgUtilization,
      active,
    };
  }, [filtered]);

  const openWarehouse = async (wh) => {
    setSelected(wh);
    setDetail(null);
    if (wh.live && typeof wh.id === "number") {
      try {
        const res = await getWarehouseDetail(wh.id);
        setDetail(res.data);
      } catch {
        /* use list data */
      }
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setBranchFilter("");
    setHeaderScope("");
  };

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
      is_primary: form.is_primary,
      status: form.status,
    };
    try {
      if (formWarehouse?.id && typeof formWarehouse.id === "number") {
        await updateWarehouse(formWarehouse.id, payload);
        addToast("Warehouse updated");
        loadWarehouses();
        setFormWarehouse(null);
        return;
      }
      await createWarehouseFull(payload);
      addToast("Warehouse created");
      loadWarehouses();
      setFormWarehouse(null);
      return;
    } catch {
      /* local fallback */
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
      render: (r) => <span className="tabular-nums text-[13px] text-[var(--color-text-secondary)]">{r.code || "—"}</span>,
    },
    {
      key: "location",
      label: "Location",
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
      render: (r) => (
        <span className="tabular-nums text-[13px] font-semibold text-[var(--color-text)]">
          {Number(r.total_items || 0).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "inventory_value",
      label: "Stock Value",
      render: (r) => (
        <span className="whitespace-nowrap tabular-nums text-[13px] font-semibold text-[var(--color-text)]">
          {formatInrAmount(r.inventory_value)}
        </span>
      ),
    },
    {
      key: "utilization_pct",
      label: "Utilization",
      render: (r) => {
        const pct = Number(r.utilization_pct) || 0;
        const tone = utilizationTone(pct);
        return (
          <div className="min-w-[110px]">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className={`text-[12px] font-semibold tabular-nums ${tone.text}`}>{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
              <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusBadge tone={r.status === "active" ? "success" : "neutral"}>
          {r.status === "active" ? "Active" : "Inactive"}
        </StatusBadge>
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
            onView={() => openWarehouse(r)}
            onEdit={() => setFormWarehouse(r.live ? r : {})}
            onAdd={() => setFormWarehouse({})}
            onDelete={() => handleDeleteRequest(r)}
          />
        </div>
      ),
    },
  ];

  if (loading) return <Loader label="Loading warehouses…" />;

  return (
    <div className="min-w-0 space-y-5 pb-4">
      <PageHeader
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <ClickableKpiCard
          onClick={() => { setStatusFilter(""); setSearch(""); }}
          title="Show all warehouses"
          tone="info"
        >
          <KpiCard label="Total Warehouses" value={kpis.total} icon={Warehouse} tone="info" meta="Click to show all" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => { setStatusFilter(""); setSearch(""); }}
          title="View total items"
          tone="success"
        >
          <KpiCard label="Total Items" value={Number(kpis.totalItems).toLocaleString("en-IN")} icon={Package} tone="success" meta="In all warehouses" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => { setStatusFilter(""); setSearch(""); }}
          title="View total stock value"
          tone="warning"
        >
          <KpiCard label="Total Stock Value" value={formatInrAmount(kpis.stockValue)} icon={IndianRupee} tone="warning" meta="Across all warehouses" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => { setStatusFilter(""); setSearch(""); }}
          title="View average utilization"
          tone="primary"
        >
          <KpiCard label="Avg. Utilization" value={`${kpis.avgUtilization}%`} icon={Building2} tone="primary" meta="Warehouse capacity" />
        </ClickableKpiCard>
        <ClickableKpiCard
          onClick={() => { setStatusFilter("active"); setSearch(""); }}
          title="Filter active warehouses"
          tone="success"
        >
          <KpiCard label="Active Warehouses" value={kpis.active} icon={ClipboardCheck} tone="success" meta="Click to filter" />
        </ClickableKpiCard>
      </div>

      <div className="ui-card p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="Search" className="w-full" />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowFilters((v) => !v)}>
              <Filter className="h-4 w-4" /> Filters
            </Button>
            {showFilters ? (
              <>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ui-select !w-auto min-w-[8.5rem]">
                  <option value="">Status</option>
                  {WAREHOUSE_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="ui-select !w-auto min-w-[8.5rem]">
                  <option value="">Location</option>
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <select className="ui-select !w-auto min-w-[8.5rem]" defaultValue="">
                  <option value="">Type</option>
                  {WAREHOUSE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <select className="ui-select !w-auto min-w-[8.5rem]" defaultValue="">
                  <option value="">Plant</option>
                  {PLANTS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </>
            ) : null}
            <Button type="button" variant="ghost" onClick={clearFilters}>
              <RefreshCw className="h-4 w-4" /> Clear
            </Button>
            <Button variant="add" type="button" onClick={() => setFormWarehouse({})} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              Add Warehouse
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          showSearch={false}
          pageSize={10}
          wrapClassName="inventory-table-scroll--warehouses rounded-lg border border-[var(--color-border-soft)]"
          emptyState={
            <EmptyState
              icon="factory"
              title="No warehouses yet"
              description="Add a warehouse to organize stock by location."
            />
          }
        />
        {filtered.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-[var(--color-text-muted)]">
              Showing 1 to {Math.min(10, filtered.length)} of {filtered.length} warehouses
            </p>
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-[var(--color-border-soft)] px-2.5 py-1 text-[12px] text-[var(--color-text-secondary)]">
                10 / page
              </span>
              <div className="flex items-center gap-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-action-teal)] text-[12px] font-semibold text-white">
                  1
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {selected ? (
        <WarehouseDetailModal
          warehouse={selected}
          detail={detail}
          onClose={() => {
            setSelected(null);
            setDetail(null);
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
