import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { AlertTriangle, Calendar, CheckCircle, Clock, Cog, Wrench } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import DataTable from "../../components/common/DataTable";
import MaintenanceErrorState from "../../components/maintenance/MaintenanceErrorState";
import MaintenanceFilters from "../../components/maintenance/MaintenanceFilters";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getPreventiveEnriched, getPreventiveSummary } from "../../api/maintenanceApi";
import { DEMO_PREVENTIVE_LIST, DEMO_PREVENTIVE_SUMMARY, MAINTENANCE_FLOW, mntStatusColor } from "../../data/maintenanceMasterData";


export default function PreventiveMaintenance() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(DEMO_PREVENTIVE_SUMMARY);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const [sumRes, listRes] = await Promise.allSettled([getPreventiveSummary(), getPreventiveEnriched()]);

      if (sumRes.status === "rejected" && listRes.status === "rejected") throw new Error("Network error");
      if (sumRes.status === "fulfilled" && sumRes.value?.data) setSummary({ ...DEMO_PREVENTIVE_SUMMARY, ...sumRes.value.data });
      if (listRes.status === "fulfilled" && listRes.value?.data?.length) setRows(listRes.value.data);
      else setRows([]);
    } catch (e) {
      setError(e.message || "Failed to load data");
      setSummary(DEMO_PREVENTIVE_SUMMARY);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (q && ![r.machine_name, r.machine_id, r.assigned_engineer, r.task_description].some((v) => String(v || "").toLowerCase().includes(q))) return false;
      if (statusFilter === "overdue" && !r.is_overdue) return false;
      if (statusFilter && statusFilter !== "overdue" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  const columns = [
    { key: "machine_id", label: "Machine ID" },
    { key: "machine_name", label: "Machine Name" },
    { key: "department", label: "Department" },
    { key: "maintenance_type", label: "Maintenance Type" },
    { key: "scheduled_date", label: "Scheduled Date", render: (r) => String(r.scheduled_date || "").slice(0, 10) },
    { key: "assigned_engineer", label: "Assigned Engineer" },
    { key: "estimated_duration", label: "Est. Duration" },
    { key: "status", label: "Status", render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${mntStatusColor(r.status)}`}>{r.status}</span> },
    {
      key: "next_due_date", label: "Next Due Date",
      render: (r) => (
        <span className={r.is_overdue ? "font-semibold text-red-600" : ""}>
          {String(r.next_due_date || "").slice(0, 10)}
          {r.is_overdue && <span className="ml-1 text-xs text-red-500">(Overdue)</span>}
        </span>
      ),
    },
  ];

  if (loading) return <Loader label="Loading preventive maintenance..." />;
  if (error && !rows.length) return <MaintenanceErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader subtitle="Schedule and track recurring maintenance tasks across all machines." />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Machines" value={summary.total_machines} icon={Cog} color="bg-[var(--color-primary)]" />
        <KpiCard label="Scheduled Today" value={summary.scheduled_today} icon={Calendar} color="bg-indigo-600" />
        <KpiCard label="Overdue Tasks" value={summary.overdue_tasks} icon={AlertTriangle} color="bg-red-500" />
        <KpiCard label="Completed This Month" value={summary.completed_this_month} icon={CheckCircle} color="bg-green-600" />
        <KpiCard label="Upcoming" value={summary.upcoming_maintenance} icon={Clock} color="bg-amber-500" />
        <KpiCard label="Machine Availability" value={summary.machine_availability_pct} suffix="%" icon={Wrench} color="bg-teal-600" />
      </div>

      <div className="ui-toolbar ui-card px-4 py-3 text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)]">
        {MAINTENANCE_FLOW.map((s, i) => (
          <span key={s} className="flex items-center gap-1">
            <span className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 ring-1 ring-[var(--color-border)]">{s}</span>
            {i < MAINTENANCE_FLOW.length - 1 && <span className="text-[var(--color-text-faint)]">↓</span>}
          </span>
        ))}
      </div>

      <MaintenanceFilters search={search} onSearchChange={setSearch} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} searchPlaceholder="Search" />

      <div className="ui-card p-4 sm:p-5">
        <DataTable columns={columns} data={filtered} searchPlaceholder="" searchKeys={[]} />
      </div>
    </div>
  );
}
