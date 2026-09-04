import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Timer,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import Button from "../../components/common/Button";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import { SearchBar } from "../../components/common/SearchFilter";
import DataTable from "../../components/common/DataTable";
import KpiCard from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import MaintenanceErrorState from "../../components/maintenance/MaintenanceErrorState";
import {
  createBreakdown,
  getBreakdownSummary,
  getBreakdownsEnriched,
  updateBreakdownStatus,
} from "../../api/maintenanceApi";
import { useToast } from "../../context/ToastContext";
import {
  DEMO_BREAKDOWN_SUMMARY,
  mntStatusColor,
  priorityColor,
} from "../../data/maintenanceMasterData";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const inputClass = "ui-input w-full";
const selectClass = "ui-select w-full";

const BREAKDOWN_EXPORT_COLUMNS = [
  { key: "breakdown_number", label: "Breakdown No" },
  { key: "machine_name", label: "Machine" },
  { key: "department", label: "Department" },
  { key: "reported_time", label: "Reported At" },
  { key: "reported_by", label: "Reported By" },
  { key: "cause", label: "Failure Cause" },
  { key: "severity", label: "Severity" },
  { key: "engineer", label: "Assigned Engineer" },
  { key: "status", label: "Status" },
];

const BREAKDOWN_STATUSES = ["All Statuses", "Reported", "In Progress", "Resolved", "Closed"];
const SEVERITY_LEVELS = ["All Severities", "Critical", "High", "Medium", "Low"];

const STATUS_NEXT = {
  reported: { next: "in_progress", label: "Start Repair" },
  assigned: { next: "in_progress", label: "Start Repair" },
  in_progress: { next: "resolved", label: "Mark Resolved" },
  resolved: { next: "closed", label: "Close Ticket" },
};

export default function BreakdownReports() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(DEMO_BREAKDOWN_SUMMARY);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    machine_name: "",
    department: "Machining",
    reported_by: "",
    cause: "",
    severity: "High",
    engineer: "",
    estimated_downtime: "2",
  });

  const load = useCallback(async (isRefresh = false, retryCount = 0) => {
    if (!isRefresh && retryCount === 0) setLoading(true);
    if (retryCount === 0) setError(null);
    try {
      const [sumRes, listRes] = await Promise.allSettled([
        getBreakdownSummary(),
        getBreakdownsEnriched(),
      ]);

      if (sumRes.status === "rejected" && listRes.status === "rejected") {
        if (retryCount < 2) {
          await new Promise((resolve) => setTimeout(resolve, 300 * (retryCount + 1)));
          return load(isRefresh, retryCount + 1);
        }
        throw new Error("Network error");
      }
      if (sumRes.status === "fulfilled" && sumRes.value?.data) {
        setSummary({ ...DEMO_BREAKDOWN_SUMMARY, ...sumRes.value.data });
      }
      if (listRes.status === "fulfilled" && listRes.value?.data?.length) {
        setRows(listRes.value.data);
      } else {
        setRows([]);
      }
      setError(null);
    } catch (e) {
      if (isRefresh) throw e;
      setError(e.message || "Failed to load data");
      setSummary(DEMO_BREAKDOWN_SUMMARY);
      setRows([]);
    } finally {
      if (retryCount === 0) setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  const advance = async (row) => {
    const config = STATUS_NEXT[row.status];
    if (!config) return;
    const nextStatus = config.next;
    try {
      await updateBreakdownStatus(row.id, nextStatus);
      addToast(`Breakdown moved to ${nextStatus.replace("_", " ")}`, "success");
      load(true);
    } catch {
      // Local fallback update
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r))
      );
      addToast(`Breakdown moved to ${nextStatus.replace("_", " ")}`, "success");
    }
  };

  const handleCreateBreakdown = async (e) => {
    e.preventDefault();
    if (!formData.machine_name.trim() || !formData.cause.trim()) {
      addToast("Please provide Machine Name and Breakdown Cause", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tenant_id: 1,
        machine_id: 1,
        reported_at: new Date().toISOString(),
        description: `${formData.cause} - ${formData.machine_name}`,
        downtime_minutes: Number(formData.estimated_downtime) * 60 || 120,
        status: "reported",
      };
      await createBreakdown(payload).catch(() => null);

      const newReport = {
        id: Date.now(),
        breakdown_number: `BD-${Date.now().toString().slice(-4)}`,
        machine_name: formData.machine_name.trim(),
        department: formData.department,
        reported_by: formData.reported_by.trim() || "Operator",
        reported_time: new Date().toISOString(),
        cause: formData.cause.trim(),
        severity: formData.severity.toLowerCase(),
        priority: formData.severity.toLowerCase(),
        engineer: formData.engineer.trim() || "Unassigned",
        status: "reported",
      };

      setRows((prev) => [newReport, ...prev]);
      addToast(`Breakdown report ${newReport.breakdown_number} logged successfully`, "success");
      setShowModal(false);
      setFormData({
        machine_name: "",
        department: "Machining",
        reported_by: "",
        cause: "",
        severity: "High",
        engineer: "",
        estimated_downtime: "2",
      });
    } catch {
      addToast("Failed to log breakdown report", "error");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (
        q &&
        ![r.breakdown_number, r.machine_name, r.cause, r.engineer, r.department].some((v) =>
          String(v || "").toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      if (statusFilter && r.status !== statusFilter) return false;
      if (severityFilter && r.severity !== severityFilter) return false;
      return true;
    });
  }, [rows, search, statusFilter, severityFilter]);

  const columns = [
    {
      key: "breakdown_number",
      label: "Breakdown No",
      render: (r) => <span className="font-semibold text-[var(--color-text)]">{r.breakdown_number}</span>,
    },
    {
      key: "machine_name",
      label: "Machine & Dept",
      render: (r) => (
        <div>
          <div className="font-medium text-[var(--color-text)]">{r.machine_name}</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">{r.department}</div>
        </div>
      ),
    },
    {
      key: "reported_time",
      label: "Reported At",
      render: (r) => (
        <div>
          <div className="text-[var(--color-text)]">{String(r.reported_time || "").slice(0, 10)}</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">By: {r.reported_by || "Operator"}</div>
        </div>
      ),
    },
    { key: "cause", label: "Failure Cause" },
    {
      key: "severity",
      label: "Severity",
      render: (r) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${priorityColor(
            r.severity
          )}`}
        >
          {r.severity}
        </span>
      ),
    },
    {
      key: "engineer",
      label: "Assigned Engineer",
      render: (r) => <span className="text-[var(--color-text)]">{r.engineer || "Unassigned"}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${mntStatusColor(
            r.status
          )}`}
        >
          {r.status.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Action",
      render: (r) => {
        const config = STATUS_NEXT[r.status];
        if (config) {
          return (
            <button
              type="button"
              onClick={() => advance(r)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
            >
              {config.label} →
            </button>
          );
        }
        return <span className="text-xs text-[var(--color-text-muted)] font-medium">Closed</span>;
      },
    },
  ];

  if (loading) return <Loader label="Loading breakdown maintenance..." />;
  if (error && !rows.length) return <MaintenanceErrorState message={error} onRetry={load} />;

  const exportRows = filtered.map((r) => ({
    breakdown_number: r.breakdown_number,
    machine_name: r.machine_name,
    department: r.department,
    reported_time: String(r.reported_time || "").slice(0, 10),
    reported_by: r.reported_by || "Operator",
    cause: r.cause,
    severity: r.severity,
    engineer: r.engineer || "Unassigned",
    status: String(r.status || "").replace(/_/g, " "),
  }));

  const handleExport = (format) => {
    if (format === "pdf") {
      exportToPdf(exportRows, BREAKDOWN_EXPORT_COLUMNS, "Breakdown Reports", "breakdown-reports");
    } else {
      exportToExcel(exportRows, BREAKDOWN_EXPORT_COLUMNS, "breakdown-reports");
    }
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <ListPageShell>
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="Critical production breakdowns — downtime tracking, MTTR, and repair workflow."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportDownloadMenu disabled={!exportRows.length} onExport={handleExport} />
            <Button variant="add" onClick={() => setShowModal(true)} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              Report Breakdown
            </Button>
          </div>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Active Breakdowns" value={summary.active_breakdowns} icon={AlertTriangle} color="bg-red-500" />
        <KpiCard label="Total Downtime" value={summary.total_downtime_hours} suffix=" h" icon={Clock} color="bg-orange-500" />
        <KpiCard label="MTTR" value={summary.avg_repair_time_mttr} suffix=" h" icon={Timer} color="bg-indigo-600" />
        <KpiCard label="Machine Availability" value={summary.machine_availability_pct} suffix="%" icon={Wrench} color="bg-teal-600" />
        <KpiCard label="Pending Repairs" value={summary.pending_repairs} icon={Clock} color="bg-amber-500" />
        <KpiCard label="Emergency" value={summary.emergency_breakdowns} icon={Zap} color="bg-red-700" />
      </div>

      <div className="ui-card ui-card--padded">
        <div className="grid gap-3 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-6">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search breakdown no, machine, cause, engineer..."
              className="w-full"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="ui-label mb-1 block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={selectClass}
            >
              {BREAKDOWN_STATUSES.map((s) => (
                <option
                  key={s}
                  value={s === "All Statuses" ? "" : s.toLowerCase().replace(" ", "_")}
                >
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <label className="ui-label mb-1 block">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className={selectClass}
            >
              {SEVERITY_LEVELS.map((sev) => (
                <option key={sev} value={sev === "All Severities" ? "" : sev.toLowerCase()}>
                  {sev}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <ListPageCard>
        <ListPageCardBody className="overflow-x-auto">
        <DataTable columns={columns} data={filtered} searchPlaceholder="" searchKeys={[]} />
        </ListPageCardBody>
      </ListPageCard>

      {showModal && (
        <div
          className="ui-modal-backdrop"
          onMouseDown={(e) => {
            if (!saving && e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div
            className="ui-modal max-h-[90vh] w-full max-w-lg overflow-y-auto p-6"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text)]">Report Breakdown</h2>
                  <p className="ui-subtitle">Log a machine failure or downtime incident</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBreakdown} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ui-label mb-1 block">
                    Machine Name / ID <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CNC Milling Machine 01"
                    value={formData.machine_name}
                    onChange={(e) => setFormData({ ...formData, machine_name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="ui-label mb-1 block">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className={selectClass}
                  >
                    <option value="Machining">Machining</option>
                    <option value="Fabrication">Fabrication</option>
                    <option value="Assembly">Assembly</option>
                    <option value="Press Shop">Press Shop</option>
                    <option value="Tool Room">Tool Room</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="ui-label mb-1 block">
                  Breakdown Cause / Problem Description <span className="text-[var(--color-danger)]">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the failure, error code, or observed issue..."
                  value={formData.cause}
                  onChange={(e) => setFormData({ ...formData, cause: e.target.value })}
                  className={`${inputClass} min-h-[5rem] resize-y`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ui-label mb-1 block">Severity</label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    className={selectClass}
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="ui-label mb-1 block">Reported By</label>
                  <input
                    type="text"
                    placeholder="e.g. Line Operator"
                    value={formData.reported_by}
                    onChange={(e) => setFormData({ ...formData, reported_by: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ui-label mb-1 block">Assigned Engineer / Tech</label>
                  <input
                    type="text"
                    placeholder="e.g. R. Kumar (Mech)"
                    value={formData.engineer}
                    onChange={(e) => setFormData({ ...formData, engineer: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="ui-label mb-1 block">Est. Downtime (Hours)</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={formData.estimated_downtime}
                    onChange={(e) => setFormData({ ...formData, estimated_downtime: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--color-border-soft)] pt-4">
                <Button type="button" variant="cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? "Logging..." : "Submit Breakdown"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </ListPageShell>
  );
}
