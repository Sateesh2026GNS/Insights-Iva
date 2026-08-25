import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cpu,
  Download,
  Gauge,
  GripVertical,
  LayoutList,
  MousePointer2,
  Settings2,
  Wrench,
} from "lucide-react";

import Button from "../../components/common/Button";
import { SearchBar } from "../../components/common/SearchFilter";
import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import KpiCard from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
import StatusBadge from "../../components/common/StatusBadge";
import { useToast } from "../../context/ToastContext";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  assignAllocation,
  getAllocationMachines,
  getAllocationSummary,
  getAllocations,
} from "../../api/productionApi";
import {
  DEMO_ALLOC_SUMMARY,
  DEMO_MACHINE_AVAIL,
  priorityStyle,
} from "../../data/machineAllocationMasterData";
import { exportToExcel } from "../../utils/exportUtils";
import { cleanProductLabel } from "../../utils/productLabel";

const VIEWS = [
  { id: "list", label: "List", icon: LayoutList },
  { id: "board", label: "Assign", icon: MousePointer2 },
];

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "running" || s === "in_progress" || s === "allocated" || s === "planned") return "success";
  if (s === "maintenance" || s === "breakdown" || s === "down") return "danger";
  if (s === "unassigned" || s === "idle" || s === "free") return "warning";
  if (s === "paused" || s === "on_hold") return "warning";
  return "info";
}

function StatusDot({ status }) {
  const tone = statusTone(status);
  const color =
    tone === "success"
      ? "bg-[var(--color-success)]"
      : tone === "danger"
        ? "bg-[var(--color-danger)]"
        : tone === "warning"
          ? "bg-[var(--color-warning)]"
          : "bg-[var(--color-text-muted)]";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}

function isUnassigned(row) {
  return !row.machine_id || !row.machine_name || String(row.status).toLowerCase() === "unassigned";
}

function normalizeLocalWorkOrders() {
  try {
    const stored = localStorage.getItem("smrt_local_work_orders") || localStorage.getItem("smrt_work_orders");
    if (!stored) return [];
    return JSON.parse(stored).map((w) => ({
      work_order_id: w.id || w.work_order_number,
      work_order_number: w.work_order_number,
      product_name: w.product_name || "Product",
      machine_id: w.machine_id || null,
      machine_name:
        w.machine_name && w.machine_name !== "Unassigned" && w.machine_name !== "—"
          ? w.machine_name
          : null,
      operator_name: w.operator_name || "—",
      shift:
        typeof w.shift === "object"
          ? w.shift?.label || w.shift?.id || "General"
          : w.shift || "General",
      capacity_pct: w.machine_id ? 85 : 0,
      status:
        w.machine_name && w.machine_name !== "Unassigned" && w.machine_name !== "—"
          ? w.status || "planned"
          : "unassigned",
      priority: w.priority || "medium",
    }));
  } catch {
    return [];
  }
}

function ViewTabs({ view, onChange }) {
  return (
    <div
      className="inline-flex flex-wrap rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1"
      role="tablist"
      aria-label="Allocation views"
    >
      {VIEWS.map((v) => {
        const Icon = v.icon;
        const active = view === v.id;
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterChips({ value, onChange, counts }) {
  const chips = [
    { id: "all", label: "All", count: counts.all },
    { id: "unassigned", label: "Unassigned", count: counts.unassigned },
    { id: "allocated", label: "Allocated", count: counts.allocated },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              active
                ? "bg-[var(--color-action-teal)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            {c.label}
            <span className={`tabular-nums ${active ? "text-white/80" : "text-[var(--color-text-muted)]"}`}>
              {c.count}
            </span>
          </button>
        );
      })}
    </div>
  );
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

export default function MachineAllocation() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(DEMO_ALLOC_SUMMARY);
  const [allocations, setAllocations] = useState([]);
  const [machines, setMachines] = useState(DEMO_MACHINE_AVAIL);
  const [dragWo, setDragWo] = useState(null);
  const [view, setView] = useState("list");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const localAllocations = normalizeLocalWorkOrders();
      const [sumRes, listRes, machRes] = await Promise.allSettled([
        getAllocationSummary(),
        getAllocations(),
        getAllocationMachines(),
      ]);

      if (sumRes.status === "fulfilled" && sumRes.value?.data) {
        setSummary({ ...DEMO_ALLOC_SUMMARY, ...sumRes.value.data });
      }

      const apiList =
        listRes.status === "fulfilled" && Array.isArray(listRes.value?.data)
          ? listRes.value.data
          : [];
      const combined = [...localAllocations, ...apiList];
      const seen = new Set();
      const uniqueList = combined.filter((item) => {
        const key = item.work_order_id || item.work_order_number;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setAllocations(uniqueList);

      if (machRes.status === "fulfilled" && Array.isArray(machRes.value?.data)) {
        setMachines(machRes.value.data);
      }
    } catch {
      // keep prior state
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const unassigned = useMemo(
    () =>
      allocations
        .filter(isUnassigned)
        .map((r) => ({
          work_order_id: r.work_order_id,
          work_order_number: r.work_order_number,
          product_name: r.product_name,
          priority: r.priority,
        })),
    [allocations]
  );

  const counts = useMemo(
    () => ({
      all: allocations.length,
      unassigned: unassigned.length,
      allocated: allocations.length - unassigned.length,
    }),
    [allocations.length, unassigned.length]
  );

  const filtered = useMemo(() => {
    let rows = allocations;
    if (filter === "unassigned") rows = rows.filter(isUnassigned);
    if (filter === "allocated") rows = rows.filter((r) => !isUnassigned(r));
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      [r.work_order_number, r.product_name, r.machine_name, r.operator_name]
        .some((v) => v && String(v).toLowerCase().includes(q))
    );
  }, [allocations, filter, search]);

  const handleDrop = async (machineId, machineName, machineStatus) => {
    if (!dragWo) return;
    const status = String(machineStatus || "").toLowerCase();
    if (status === "maintenance" || status === "breakdown" || status === "down") {
      addToast("Cannot assign to a machine under maintenance", "error");
      setDragWo(null);
      return;
    }

    const numericWo = typeof dragWo.work_order_id === "number";
    const numericMachine = typeof machineId === "number";
    if (numericWo && numericMachine) {
      try {
        const res = await assignAllocation({
          work_order_id: dragWo.work_order_id,
          machine_id: machineId,
        });
        if (res.data?.success) {
          addToast(res.data.message || `Assigned to ${machineName}`, "success");
          setDragWo(null);
          load();
          return;
        }
      } catch {
        // local fallback below
      }
    }

    try {
      const stored = localStorage.getItem("smrt_local_work_orders") || localStorage.getItem("smrt_work_orders");
      if (stored) {
        const localWOs = JSON.parse(stored);
        const updated = localWOs.map((w) =>
          w.id === dragWo.work_order_id || w.work_order_number === dragWo.work_order_number
            ? { ...w, machine_id: machineId, machine_name: machineName, status: "planned" }
            : w
        );
        localStorage.setItem("smrt_local_work_orders", JSON.stringify(updated));
        localStorage.setItem("smrt_work_orders", JSON.stringify(updated));
      }
    } catch {
      // ignore storage errors
    }

    setAllocations((prev) =>
      prev.map((r) =>
        r.work_order_id === dragWo.work_order_id || r.work_order_number === dragWo.work_order_number
          ? { ...r, machine_id: machineId, machine_name: machineName, status: "planned", capacity_pct: 85 }
          : r
      )
    );
    addToast(`Assigned ${dragWo.work_order_number} to ${machineName}`, "success");
    setDragWo(null);
  };

  const columns = useMemo(
    () => [
      {
        key: "work_order_number",
        label: "Work Order",
        render: (r) => (
          <div className="min-w-[7rem]">
            <p className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">
              {r.work_order_number || "—"}
            </p>
            <p className="mt-0.5 text-[11px] capitalize text-[var(--color-text-muted)]">
              {typeof r.shift === "object" ? r.shift?.label || "General" : r.shift || "General"}
            </p>
          </div>
        ),
      },
      {
        key: "product_name",
        label: "Product",
        render: (r) => {
          const product = cleanProductLabel(r.product_name);
          const p = priorityStyle(r.priority);
          return (
            <div className="max-w-[220px]">
              <p className="truncate text-[13px] font-medium text-[var(--color-text)]" title={product}>
                {product}
              </p>
              <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.bg} ${p.text}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
                {p.label}
              </span>
            </div>
          );
        },
      },
      {
        key: "machine_name",
        label: "Machine",
        render: (r) =>
          r.machine_name ? (
            <span className="text-[13px] font-medium text-[var(--color-text)]">{r.machine_name}</span>
          ) : (
            <span className="text-[12px] font-semibold text-[var(--color-warning)]">Unassigned</span>
          ),
      },
      {
        key: "operator_name",
        label: "Operator",
        render: (r) => (
          <span className="text-[13px] text-[var(--color-text-secondary)]">
            {r.operator_name || r.assigned_operator || r.operator || "—"}
          </span>
        ),
      },
      {
        key: "capacity_pct",
        label: "Load",
        render: (r) => {
          const pct = Number(r.capacity_pct || 0);
          return (
            <div className="min-w-[72px]">
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--color-action-teal)]"
                  style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
                />
              </div>
              <span className="mt-0.5 block text-[10px] tabular-nums text-[var(--color-text-muted)]">{pct}%</span>
            </div>
          );
        },
      },
      {
        key: "status",
        label: "Status",
        render: (r) => (
          <StatusBadge tone={statusTone(isUnassigned(r) ? "unassigned" : r.status)}>
            {isUnassigned(r) ? "unassigned" : r.status || "—"}
          </StatusBadge>
        ),
      },
    ],
    []
  );

  const handleExport = () => {
    exportToExcel(
      filtered.length ? filtered : allocations,
      [
        { key: "work_order_number", label: "Work Order" },
        { key: "product_name", label: "Product" },
        { key: "machine_name", label: "Machine" },
        { key: "operator_name", label: "Operator" },
        { key: "shift", label: "Shift" },
        { key: "status", label: "Status" },
        { key: "priority", label: "Priority" },
      ],
      "machine-allocation"
    );
    addToast("Allocation exported to Excel", "success");
  };

  if (loading) return <Loader label="Loading machine allocation…" />;

  return (
    <div className="space-y-5 pb-4">
      <div className="ui-grid-kpi">
        <ClickableKpiCard onClick={() => { setFilter("all"); setSearch(""); }} title="Show all machines" tone="primary">
          <KpiCard label="Machines" value={summary.total_machines ?? 0} icon={Cpu} tone="primary" meta="Click to filter" />
        </ClickableKpiCard>
        <ClickableKpiCard onClick={() => setFilter("allocated")} title="Show allocated work orders" tone="info">
          <KpiCard label="Allocated" value={summary.allocated ?? counts.allocated} icon={Settings2} tone="info" meta="Click to filter" />
        </ClickableKpiCard>
        <ClickableKpiCard onClick={() => setFilter("unassigned")} title="Show unassigned work orders" tone="success">
          <KpiCard label="Free" value={summary.free_machines ?? 0} icon={Cpu} tone="success" meta="Click to filter" />
        </ClickableKpiCard>
        <ClickableKpiCard onClick={() => { setFilter("all"); setSearch("maintenance"); }} title="Show maintenance machines" tone="danger">
          <KpiCard label="Maintenance" value={summary.under_maintenance ?? 0} icon={Wrench} tone="danger" meta="Click to filter" />
        </ClickableKpiCard>
        <ClickableKpiCard onClick={() => { setFilter("all"); setSearch(""); }} title="View machine utilization" tone="warning">
          <KpiCard
            label="Utilization"
            value={`${summary.utilization_pct ?? 0}%`}
            icon={Gauge}
            tone="warning"
            meta="Click to filter"
          />
        </ClickableKpiCard>
      </div>

      {unassigned.length > 0 ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] px-4 py-3">
          <MousePointer2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {unassigned.length} work order{unassigned.length > 1 ? "s" : ""} need a machine
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              Open Assign view and drag a work order onto a free machine.
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setView("board")}>
            Assign
          </Button>
        </div>
      ) : null}

      <div className="ui-card overflow-hidden p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <ViewTabs view={view} onChange={setView} />
            <FilterChips value={filter} onChange={setFilter} counts={counts} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" to="/production/work-orders">
              Work Orders
            </Button>
            <Button type="button" variant="secondary" onClick={handleExport}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {view === "list" ? (
          <div>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search"
              className="mb-4 w-full"
            />
            {filtered.length === 0 ? (
              <EmptyState
                icon="factory"
                title="Nothing to allocate"
                description={
                  allocations.length === 0
                    ? "Create work orders first, then assign them to machines here."
                    : "No rows match this filter."
                }
              />
            ) : (
              <DataTable
                columns={columns}
                data={filtered}
                searchKeys={["work_order_number", "product_name", "machine_name"]}
                showSearch={false}
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text)]">Unassigned work orders</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Drag onto a machine below</p>
                </div>
                <span className="rounded-full bg-[var(--color-surface)] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--color-text-muted)]">
                  {unassigned.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {unassigned.map((u) => {
                  const p = priorityStyle(u.priority);
                  return (
                    <div
                      key={u.work_order_id || u.work_order_number}
                      draggable
                      onDragStart={() => setDragWo(u)}
                      onDragEnd={() => setDragWo(null)}
                      className={`flex max-w-full cursor-grab items-center gap-2 rounded-xl border bg-[var(--color-surface)] px-3 py-2 shadow-sm active:cursor-grabbing ${
                        dragWo?.work_order_id === u.work_order_id
                          ? "border-[var(--color-action-teal)] ring-2 ring-[var(--color-action-teal)]/20"
                          : "border-[var(--color-border-soft)]"
                      }`}
                    >
                      <GripVertical className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold tabular-nums text-[var(--color-text)]">
                          {u.work_order_number}
                        </p>
                        <p className="truncate text-[11px] text-[var(--color-text-muted)]">
                          {cleanProductLabel(u.product_name)}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${p.bg} ${p.text}`}>
                        {p.label}
                      </span>
                    </div>
                  );
                })}
                {unassigned.length === 0 ? (
                  <p className="py-2 text-sm text-[var(--color-text-muted)]">All work orders are assigned.</p>
                ) : null}
              </div>
            </div>

            {machines.length === 0 ? (
              <EmptyState
                icon="cpu"
                title="No machines available"
                description="Add machines in Masters to start allocating work orders."
                actionLabel="Open Machines"
                actionHref="/production/machines"
              />
            ) : (
              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">Machines</p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {machines.map((m) => {
                    const busy = String(m.status || "").toLowerCase();
                    const blocked = busy === "maintenance" || busy === "breakdown" || busy === "down";
                    const util = Number(m.utilization_pct || 0);
                    return (
                      <div
                        key={m.machine_id}
                        onDragOver={(e) => {
                          if (!blocked) e.preventDefault();
                        }}
                        onDrop={() => handleDrop(m.machine_id, m.machine_name, m.status)}
                        className={`rounded-xl border p-3 transition-colors ${
                          blocked
                            ? "border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/40 opacity-70"
                            : dragWo
                              ? "border-[var(--color-action-teal)]/50 bg-[var(--color-action-teal)]/5"
                              : "border-[var(--color-border-soft)] bg-[var(--color-surface)] hover:border-[var(--color-action-teal)]/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <StatusDot status={m.status} />
                              <p className="truncate text-sm font-semibold text-[var(--color-text)]">{m.machine_name}</p>
                            </div>
                            <p className="mt-0.5 text-xs capitalize text-[var(--color-text-muted)]">{m.status || "idle"}</p>
                          </div>
                          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-[var(--color-text-muted)]">
                            {util}%
                          </span>
                        </div>
                        {m.current_job ? (
                          <p className="mt-2 truncate text-xs text-[var(--color-text-secondary)]">
                            Job: {cleanProductLabel(m.current_job)}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                            {blocked ? "Unavailable" : "Drop a work order here"}
                          </p>
                        )}
                        {util > 0 ? (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                            <div
                              className="h-full rounded-full bg-[var(--color-action-teal)]"
                              style={{ width: `${Math.min(util, 100)}%` }}
                            />
                          </div>
                        ) : null}
                        {m.free_time ? (
                          <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">Free: {m.free_time}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
