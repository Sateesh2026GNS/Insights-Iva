import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { AlertTriangle, Clock, Timer, Wrench, Zap } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import DataTable from "../../components/common/DataTable";
import MaintenanceErrorState from "../../components/maintenance/MaintenanceErrorState";
import MaintenanceFilters from "../../components/maintenance/MaintenanceFilters";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getBreakdownsEnriched, getBreakdownSummary, updateBreakdownStatus } from "../../api/maintenanceApi";
import { DEMO_BREAKDOWN_LIST, DEMO_BREAKDOWN_SUMMARY, WORK_ORDER_FLOW, mntStatusColor, priorityColor } from "../../data/maintenanceMasterData";


const STATUS_NEXT = { reported: "assigned", assigned: "in_progress", in_progress: "resolved" };

export default function BreakdownReports() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(DEMO_BREAKDOWN_SUMMARY);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const [sumRes, listRes] = await Promise.allSettled([getBreakdownSummary(), getBreakdownsEnriched()]);

      if (sumRes.status === "rejected" && listRes.status === "rejected") throw new Error("Network error");
      if (sumRes.status === "fulfilled" && sumRes.value?.data) setSummary({ ...DEMO_BREAKDOWN_SUMMARY, ...sumRes.value.data });
      if (listRes.status === "fulfilled" && listRes.value?.data?.length) setRows(listRes.value.data);
      else setRows([]);
    } catch (e) {
      setError(e.message || "Failed to load data");
      setSummary(DEMO_BREAKDOWN_SUMMARY);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => { load(); }, [load]);

  const advance = async (row) => {
    const next = STATUS_NEXT[row.status];
    if (!next) return;
    try {
      await updateBreakdownStatus(row.id, next);
      addToast(`Breakdown moved to ${next.replace("_", " ")}`);
      load();
    } catch {
      addToast("Update failed", "error");
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (q && ![r.breakdown_number, r.machine_name, r.cause, r.engineer].some((v) => String(v || "").toLowerCase().includes(q))) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  const columns = [
    { key: "breakdown_number", label: "Breakdown No" },
    { key: "machine_name", label: "Machine" },
    { key: "department", label: "Department" },
    { key: "reported_by", label: "Reported By" },
    { key: "reported_time", label: "Reported Time", render: (r) => String(r.reported_time || "").slice(0, 16).replace("T", " ") },
    { key: "cause", label: "Cause" },
    { key: "severity", label: "Severity", render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${priorityColor(r.severity)}`}>{r.severity}</span> },
    { key: "priority", label: "Priority", render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${priorityColor(r.priority)}`}>{r.priority}</span> },
    { key: "engineer", label: "Engineer" },
    { key: "estimated_completion", label: "Est. Completion", render: (r) => r.estimated_completion ? String(r.estimated_completion).slice(0, 16).replace("T", " ") : "—" },
    { key: "status", label: "Status", render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${mntStatusColor(r.status)}`}>{r.status.replace("_", " ")}</span> },
    {
      key: "actions", label: "Action",
      render: (r) => STATUS_NEXT[r.status] ? (
        <button type="button" onClick={() => advance(r)} className="text-xs font-semibold text-[#2563EB] hover:underline capitalize">→ {STATUS_NEXT[r.status].replace("_", " ")}</button>
      ) : <span className="text-xs text-slate-400">Closed</span>,
    },
  ];

  if (loading) return <Loader label="Loading breakdown maintenance..." />;
  if (error && !rows.length) return <MaintenanceErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader subtitle="Critical production breakdowns — downtime tracking, MTTR, and repair workflow." />

      <div className="ui-grid-kpi">
        <KpiCard label="Active Breakdowns" value={summary.active_breakdowns} icon={AlertTriangle} color="bg-red-500" />
        <KpiCard label="Total Downtime" value={summary.total_downtime_hours} suffix=" h" icon={Clock} color="bg-orange-500" />
        <KpiCard label="MTTR" value={summary.avg_repair_time_mttr} suffix=" h" icon={Timer} color="bg-indigo-600" />
        <KpiCard label="Machine Availability" value={summary.machine_availability_pct} suffix="%" icon={Wrench} color="bg-teal-600" />
        <KpiCard label="Pending Repairs" value={summary.pending_repairs} icon={Clock} color="bg-amber-500" />
        <KpiCard label="Emergency" value={summary.emergency_breakdowns} icon={Zap} color="bg-red-700" />
      </div>

      <div className="ui-toolbar ui-card px-4 py-3 text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
        {WORK_ORDER_FLOW.map((s, i) => (
          <span key={s} className="flex items-center gap-1">
            <span className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 ring-1 ring-[var(--color-border)]">{s}</span>
            {i < WORK_ORDER_FLOW.length - 1 && <span className="text-[var(--color-text-faint)]">↓</span>}
          </span>
        ))}
      </div>

      <MaintenanceFilters search={search} onSearchChange={setSearch} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} searchPlaceholder="Search" />

      <div className="ui-card p-4 sm:p-5 overflow-x-auto">
        <DataTable columns={columns} data={filtered} searchPlaceholder="" searchKeys={[]} />
      </div>
    </div>
  );
}
