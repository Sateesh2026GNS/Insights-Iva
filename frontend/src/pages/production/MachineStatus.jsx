import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ChevronLeft, ChevronRight, Cpu, FileText, Grid3X3, LayoutList, Plus, Printer, Thermometer, Upload, Wrench, Zap } from "lucide-react";

import DataTable from "../../components/common/DataTable";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import Button from "../../components/common/Button";
import { SearchBar } from "../../components/common/SearchFilter";
import MachineDetailModal from "../../components/production/MachineDetailModal";
import { useToast } from "../../context/ToastContext";
import usePageRefresh from "../../hooks/usePageRefresh";
import useTenantId from "../../hooks/useTenantId";
import useAuth from "../../hooks/useAuth";
import { isOperator } from "../../config/permissions";
import {
  getMachineDetail,
  getMachineSummary,
  getMachines,
  updateMachineStatus,
} from "../../api/productionApi";
import {
  DEPARTMENTS,
  IMPORT_TEMPLATE_HEADERS,
  MACHINE_STATUSES,
  MACHINE_TYPES,
  PRODUCTION_LINES,
  SHIFTS,
  STATUS_COLORS,
  WORK_CENTERS,
  computeMachineSummary,
  enrichApiMachine,
  normalizeStatus,
  statusLabel,
} from "../../data/machinesMasterData";
import { runListExport } from "../../utils/listExport";

const PAGE_SIZES = [20, 50, 100];

function SummaryCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="ui-card p-4 min-h-[86px] flex flex-col justify-between min-w-0 overflow-hidden" title={typeof label === "string" ? label : undefined}>
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <p className="truncate text-[11px] font-medium text-[var(--color-text-muted)] leading-tight sm:text-xs min-w-0 flex-1">{label}</p>
        {Icon && (
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${color}`}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>
        )}
      </div>
      <div className="mt-2">
        <p className="truncate text-xl font-bold tabular-nums text-[var(--color-text)] leading-none sm:text-2xl">{value}</p>
        {sub && <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">{sub}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status, large }) {
  const s = normalizeStatus({ status, display_status: status });
  const c = STATUS_COLORS[s] || STATUS_COLORS.idle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold capitalize ${c.bg} ${c.text} ${c.border} ${
      large ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"
    }`}>
      <span>{c.dot}</span>
      {statusLabel(s)}
    </span>
  );
}

function MachineCard({ machine, onClick }) {
  const s = normalizeStatus(machine);
  const c = STATUS_COLORS[s] || STATUS_COLORS.idle;
  return (
    <button
      type="button"
      onClick={() => onClick(machine)}
      className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-left shadow-sm transition-all hover:border-[var(--color-action-blue)]/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-[var(--color-text)]">{machine.name}</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{machine.code}</p>
        </div>
        <StatusBadge status={s} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[var(--color-text-faint)]">Department</p>
          <p className="font-medium text-[var(--color-text-secondary)]">{machine.department || "—"}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-faint)]">Line</p>
          <p className="font-medium text-[var(--color-text-secondary)]">{machine.production_line || "—"}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-faint)]">Operator</p>
          <p className="font-medium text-[var(--color-text-secondary)] truncate">{machine.assigned_operator || "—"}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-faint)]">Current Job</p>
          <p className="font-medium text-[var(--color-action-blue)] truncate">{machine.current_work_order || "—"}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-faint)]">Health</p>
          <p className="font-medium text-[var(--color-text-secondary)]">{machine.health_score != null ? `${machine.health_score}%` : "—"}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-faint)]">Efficiency</p>
          <p className="font-medium text-[var(--color-text-secondary)]">{machine.efficiency_pct != null ? `${machine.efficiency_pct}%` : "—"}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-faint)]">Today's Output</p>
          <p className="font-bold text-[var(--color-text)]">{machine.todays_output ?? 0}</p>
        </div>
        <div>
          <p className="text-[var(--color-text-faint)]">Temperature</p>
          <p className="font-medium text-[var(--color-text-secondary)] flex items-center gap-1">
            {machine.temperature_c != null ? (
              <><Thermometer className="h-3 w-3" />{machine.temperature_c}°C</>
            ) : "—"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-border-soft)] pt-3">
        <div className={`h-2 w-2 rounded-full ${c.ring} ${s === "running" ? "animate-pulse" : ""}`} />
        <span className="text-[10px] text-[var(--color-text-muted)]">Last maint: {machine.last_maintenance_date || "—"}</span>
      </div>
    </button>
  );
}

const defaultFilters = {
  code: "",
  name: "",
  department: "",
  production_line: "",
  machine_type: "",
  status: "",
  operator: "",
  shift: "",
  work_center: "",
};

export default function MachineStatus() {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const { user } = useAuth();
  const operatorMode = isOperator(user);
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState([]);
  const [apiSummary, setApiSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [viewMode, setViewMode] = useState("grid");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadMachines = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        getMachines(),
        getMachineSummary().catch(() => ({ data: null })),
      ]);
      const apiRows = Array.isArray(mRes?.data) ? mRes.data : [];
      setMachines(apiRows.map((row, i) => enrichApiMachine(row, i)));
      setApiSummary(sRes?.data ?? null);
    } catch {
      setMachines([]);
      setApiSummary(null);
      addToast("Failed to load machines", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(loadMachines);

  useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  const openMachine = async (machine) => {
    setSelected(machine);
    setDetail(null);
    if (typeof machine.id === "number") {
      try {
        const res = await getMachineDetail(machine.id);
        setDetail(enrichApiMachine(res.data));
      } catch {
        /* use list data */
      }
    }
  };

  const filtered = useMemo(() => {
    return machines.filter((m) => {
      if (filters.name && !m.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (filters.code && !m.code.toLowerCase().includes(filters.code.toLowerCase())) return false;
      if (filters.status && normalizeStatus(m.status) !== filters.status) return false;
      if (filters.department && m.department !== filters.department) return false;
      if (filters.production_line && m.production_line !== filters.production_line) return false;
      if (filters.machine_type && m.machine_type !== filters.machine_type) return false;
      if (filters.operator && !String(m.assigned_operator || m.operator_name || "").toLowerCase().includes(filters.operator.toLowerCase())) return false;
      if (filters.shift && (m.current_shift || m.shift) !== filters.shift) return false;
      if (filters.work_center && m.work_center !== filters.work_center) return false;
      return true;
    });
  }, [machines, filters]);

  const filteredMachines = filtered;

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const paginatedMachines = useMemo(() => {
    return filtered.slice((page - 1) * pageSize, page * pageSize);
  }, [filtered, page, pageSize]);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const summary = useMemo(() => {
    if (apiSummary && !Object.values(filters).some(Boolean)) {
      return apiSummary;
    }
    return computeMachineSummary(filtered);
  }, [apiSummary, filtered, filters]);

  const exportColumns = [
    { key: "code", label: "Machine Code" },
    { key: "name", label: "Machine Name" },
    { key: "department", label: "Department" },
    { key: "production_line", label: "Line" },
    { key: "machine_type", label: "Type" },
    { key: "assigned_operator", label: "Operator" },
    { key: "display_status", label: "Status" },
    { key: "efficiency_pct", label: "Efficiency %" },
    { key: "todays_output", label: "Today's Output" },
  ];

  const handleExport = (format) => {
    const rows = filteredMachines.map((m) => ({ ...m, display_status: normalizeStatus(m) }));
    runListExport(format, {
      data: rows,
      columns: exportColumns,
      filename: "machines",
      title: "Machine Master",
    });
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  const handleDownloadTemplate = () => {
    const header = IMPORT_TEMPLATE_HEADERS.join(",");
    const blob = new Blob([`${header}\nMCH026,New CNC Unit,CNC,Machining,Line A,WC-01,idle,Ravi Kumar,Shift A,DMG Mori,CNC-126`], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "machines_import_template.csv";
    a.click();
    addToast("Template downloaded");
  };

  const handleStatusChange = async (machine, newStatus, idleReason) => {
    if (typeof machine.id !== "number") {
      addToast("Invalid machine record", "error");
      return;
    }
    try {
      await updateMachineStatus(machine.id, tenantId, newStatus, idleReason);
      addToast(`Machine ${newStatus}`);
      loadMachines();
      setSelected(null);
    } catch {
      addToast("Status update failed", "error");
    }
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const columns = [
    { key: "code", label: "Code" },
    { key: "name", label: "Machine Name" },
    { key: "department", label: "Department" },
    { key: "production_line", label: "Line" },
    { key: "machine_type", label: "Type" },
    { key: "assigned_operator", label: "Operator" },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge status={normalizeStatus(r)} />,
    },
    {
      key: "efficiency_pct",
      label: "Efficiency",
      render: (r) => (r.efficiency_pct != null ? `${r.efficiency_pct}%` : "—"),
    },
    {
      key: "todays_output",
      label: "Today",
      render: (r) => r.todays_output ?? 0,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (r) => (
        <button type="button" onClick={() => openMachine(r)} className="text-xs font-semibold text-[var(--color-action-blue)] hover:underline">
          View Dashboard
        </button>
      ),
    },
  ];

  if (loading) {
    return <Loader label="Loading machines..." />;
  }

  return (
    <ListPageShell>
      <PageHeader subtitle="Digital profiles · Live status · OEE · Production integration" />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <SummaryCard label="Total Machines" value={summary.total_machines} icon={Cpu} color="bg-[var(--color-text-muted)]" />
          <SummaryCard label="Running" value={summary.running} icon={Zap} color="bg-green-600" />
          <SummaryCard label="Idle" value={summary.idle} icon={Activity} color="bg-yellow-500" />
          <SummaryCard label="Maintenance" value={summary.maintenance} icon={Wrench} color="bg-[var(--color-primary)]" />
          <SummaryCard label="Breakdown" value={summary.breakdown} icon={Activity} color="bg-red-600" />
          <SummaryCard label="Offline" value={summary.offline} icon={Cpu} color="bg-[var(--color-text)]" />
          <SummaryCard label="Utilization" value={`${summary.utilization_pct}%`} icon={Activity} color="bg-indigo-600" />
          <SummaryCard label="Today's Production" value={summary.todays_production?.toLocaleString?.() ?? summary.todays_production} icon={FileText} color="bg-teal-600" />
        </div>

        <ListPageCard>
          <ListPageCardBody>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <SearchBar
              value={filters.name}
              onChange={(val) => setFilters((f) => ({ ...f, name: val }))}
              placeholder="Search"
              className="w-full"
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="ui-select w-auto min-w-[140px]"
            >
              <option value="">All Status</option>
              {MACHINE_STATUSES.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
            >
              {showAdvanced ? "Hide Filters" : "More Filters"}
            </button>
            {!operatorMode && (
              <>
                <Button type="button" variant="secondary" onClick={handleDownloadTemplate}>
                  <Upload className="h-4 w-4" /> Import
                </Button>
                <ExportDownloadMenu disabled={!filteredMachines.length} onExport={handleExport} />
              </>
            )}
            {!operatorMode && (
              <Button variant="add" to="/production/machines/create" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                New Machine
              </Button>
            )}
            <div className="ml-auto flex rounded-lg border border-[var(--color-border)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`rounded-md p-2 ${viewMode === "grid" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"}`}
                title="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded-md p-2 ${viewMode === "list" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"}`}
                title="List view"
              >
                <LayoutList className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showAdvanced && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input placeholder="Machine Code" value={filters.code} onChange={(e) => setFilters((f) => ({ ...f, code: e.target.value }))} className="ui-input" />
              <select value={filters.department} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))} className="ui-select">
                <option value="">All Departments</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={filters.production_line} onChange={(e) => setFilters((f) => ({ ...f, production_line: e.target.value }))} className="ui-select">
                <option value="">All Lines</option>
                {PRODUCTION_LINES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <select value={filters.machine_type} onChange={(e) => setFilters((f) => ({ ...f, machine_type: e.target.value }))} className="ui-select">
                <option value="">All Types</option>
                {MACHINE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input placeholder="Operator" value={filters.operator} onChange={(e) => setFilters((f) => ({ ...f, operator: e.target.value }))} className="ui-input" />
              <select value={filters.shift} onChange={(e) => setFilters((f) => ({ ...f, shift: e.target.value }))} className="ui-select">
                <option value="">All Shifts</option>
                {SHIFTS.map((s) => {
                  const id = typeof s === "object" ? s.id : s;
                  const label = typeof s === "object" ? s.label : s;
                  return <option key={id} value={id}>{label}</option>;
                })}
              </select>
              <select value={filters.work_center} onChange={(e) => setFilters((f) => ({ ...f, work_center: e.target.value }))} className="ui-select">
                <option value="">All Work Centers</option>
                {WORK_CENTERS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
              <button type="button" onClick={() => setFilters(defaultFilters)} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]">
                Clear Filters
              </button>
            </div>
          )}

          {filteredMachines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 py-16 text-center">
              <Cpu className="mx-auto h-12 w-12 text-[var(--color-text-faint)]" />
              {machines.length === 0 ? (
                <>
                  <p className="mt-4 text-sm font-semibold text-[var(--color-text-secondary)]">No machines found.</p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">Add a machine to get started.</p>
                  {!operatorMode && (
                    <Button variant="add" to="/production/machines/create" className="mt-4" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                      New Machine
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-4 text-sm font-medium text-[var(--color-text-secondary)]">
                    {hasActiveFilters ? "No machines match your filters." : "No machines found."}
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => setFilters(defaultFilters)}
                      className="mt-2 text-sm font-semibold text-[var(--color-action-blue)] hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </>
              )}
            </div>
          ) : viewMode === "list" ? (
            <>
              <div className="overflow-hidden rounded-lg border border-[var(--color-border-soft)]">
                <DataTable columns={columns} data={paginatedMachines} showSearch={false} pagination={false} />
              </div>
              <div className="mt-4 ui-pagination justify-between">
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
                  <span>{total === 0 ? "0-0 of 0" : `${from}-${to} of ${total}`}</span>
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
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedMachines.map((machine) => (
                <MachineCard key={machine.id} machine={machine} onClick={openMachine} />
              ))}
            </div>
          )}
        </ListPageCardBody>
      </ListPageCard>

      {filteredMachines.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
          <button type="button" onClick={() => handleExport("pdf")} className="inline-flex items-center gap-1 font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-action-blue)]">
            <Printer className="h-3 w-3" /> Print Report
          </button>
        </div>
      )}

      {selected && (
        <MachineDetailModal
          machine={selected}
          detail={detail}
          onClose={() => { setSelected(null); setDetail(null); }}
          onStatusChange={handleStatusChange}
          operatorMode={operatorMode}
        />
      )}
    </ListPageShell>
  );
}
