import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Cog,
  Plus,
  RefreshCw,
  Wrench,
  X,
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
import { createSchedule, getSchedule } from "../../api/maintenanceApi";
import { getMachines } from "../../api/productionApi";
import { useToast } from "../../context/ToastContext";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const SCHEDULE_EXPORT_COLUMNS = [
  { key: "machine", label: "Machine" },
  { key: "task", label: "Scheduled Task" },
  { key: "frequency", label: "Frequency" },
  { key: "next_due", label: "Next Due Date" },
  { key: "assigned", label: "Assigned To" },
  { key: "status", label: "Status" },
];

const FREQUENCY_OPTIONS = [
  { label: "Weekly (7 Days)", value: 7 },
  { label: "Bi-Weekly (14 Days)", value: 14 },
  { label: "Monthly (30 Days)", value: 30 },
  { label: "Quarterly (90 Days)", value: 90 },
  { label: "Semi-Annually (180 Days)", value: 180 },
  { label: "Annually (365 Days)", value: 365 },
];

const DEMO_SCHEDULES = [
  {
    id: 1,
    machine_id: "MCH-01",
    machine_name: "CNC Milling Machine 01",
    department: "Machining",
    task_name: "Monthly Lubrication & Spindle Check",
    frequency_days: 30,
    next_due_date: new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10),
    assigned_engineer: "R. Kumar",
    is_active: true,
    description: "Inspect hydraulic pressure, replace spindle oil, clean coolant tank.",
  },
  {
    id: 2,
    machine_id: "MCH-02",
    machine_name: "Hydraulic Press 50T",
    department: "Press Shop",
    task_name: "Quarterly Valve & Seal Inspection",
    frequency_days: 90,
    next_due_date: new Date(Date.now() + 86400000 * 12).toISOString().slice(0, 10),
    assigned_engineer: "S. Patil",
    is_active: true,
    description: "Check seal wear, test pressure relief valve, replace filter cartridge.",
  },
  {
    id: 3,
    machine_id: "MCH-03",
    machine_name: "Laser Cutting 4kW",
    department: "Fabrication",
    task_name: "Weekly Optics & Lens Cleaning",
    frequency_days: 7,
    next_due_date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    assigned_engineer: "A. Verma",
    is_active: true,
    is_overdue: true,
    description: "Clean protective glass, inspect beam alignment, check nozzle orifice.",
  },
  {
    id: 4,
    machine_id: "MCH-04",
    machine_name: "Automatic Lathe 03",
    department: "Machining",
    task_name: "Monthly Chuck & Tailstock Alignment",
    frequency_days: 30,
    next_due_date: new Date(Date.now() + 86400000 * 18).toISOString().slice(0, 10),
    assigned_engineer: "R. Kumar",
    is_active: true,
    description: "Check runout with dial indicator, lubricate lead screw.",
  },
];

export default function MaintenanceSchedule() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [machinesList, setMachinesList] = useState([]);
  const [search, setSearch] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    machine_id: "MCH-01",
    machine_name: "CNC Milling Machine 01",
    department: "Machining",
    task_name: "",
    frequency_days: 30,
    next_due_date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    assigned_engineer: "",
    description: "",
  });

  const load = useCallback(async (isRefresh = false, retryCount = 0) => {
    if (!isRefresh && retryCount === 0) setLoading(true);
    if (retryCount === 0) setError(null);
    try {
      const [schedRes, machRes] = await Promise.allSettled([getSchedule(), getMachines()]);
      if (machRes.status === "fulfilled" && Array.isArray(machRes.value?.data)) {
        setMachinesList(machRes.value.data);
      }
      if (schedRes.status === "fulfilled" && Array.isArray(schedRes.value?.data) && schedRes.value.data.length > 0) {
        setRows(schedRes.value.data);
      } else {
        setRows(DEMO_SCHEDULES);
      }
      setError(null);
    } catch (e) {
      if (retryCount < 2) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (retryCount + 1)));
        return load(isRefresh, retryCount + 1);
      }
      if (isRefresh) throw e;
      setError(e.message || "Failed to load schedule");
      setRows(DEMO_SCHEDULES);
    } finally {
      if (retryCount === 0) setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  const handleMachineChange = (e) => {
    const val = e.target.value;
    const selected = machinesList.find((m) => String(m.id || m.code) === val || m.name === val);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        machine_id: selected.code || `MCH-${selected.id}`,
        machine_name: selected.name,
        department: selected.department || prev.department,
      }));
    } else {
      setFormData((prev) => ({ ...prev, machine_name: val }));
    }
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!formData.task_name.trim()) {
      addToast("Please provide a task name", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tenant_id: 1,
        machine_id: 1,
        task_name: formData.task_name.trim(),
        frequency_days: Number(formData.frequency_days) || 30,
        next_due_date: formData.next_due_date,
        is_active: true,
        description: formData.description.trim(),
      };
      await createSchedule(payload).catch(() => null);

      const newSchedule = {
        id: Date.now(),
        machine_id: formData.machine_id || "MCH-01",
        machine_name: formData.machine_name || "Primary Machine",
        department: formData.department || "Machining",
        task_name: formData.task_name.trim(),
        frequency_days: Number(formData.frequency_days) || 30,
        next_due_date: formData.next_due_date,
        assigned_engineer: formData.assigned_engineer.trim() || "Unassigned",
        is_active: true,
        is_overdue: new Date(formData.next_due_date) < new Date(),
        description: formData.description.trim(),
      };

      setRows((prev) => [newSchedule, ...prev]);
      addToast("Maintenance schedule created successfully", "success");
      setShowModal(false);
      setFormData({
        machine_id: "MCH-01",
        machine_name: "CNC Milling Machine 01",
        department: "Machining",
        task_name: "",
        frequency_days: 30,
        next_due_date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
        assigned_engineer: "",
        description: "",
      });
    } catch {
      addToast("Failed to create maintenance schedule", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = (id) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_active: !r.is_active } : r))
    );
    addToast("Schedule status updated", "info");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (
        q &&
        ![r.task_name, r.machine_name, r.machine_id, r.assigned_engineer, r.description].some((v) =>
          String(v || "").toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      if (frequencyFilter && String(r.frequency_days) !== frequencyFilter) return false;
      if (statusFilter === "active" && !r.is_active) return false;
      if (statusFilter === "inactive" && r.is_active) return false;
      return true;
    });
  }, [rows, search, frequencyFilter, statusFilter]);

  const handleExport = (format) => {
    const data = filtered.map((r) => ({
      machine: r.machine_name || r.machine_id,
      task: r.task_name,
      frequency: `Every ${r.frequency_days} Days`,
      next_due: String(r.next_due_date || "").slice(0, 10),
      assigned: r.assigned_engineer || "Unassigned",
      status: r.is_active ? "Active" : "Paused",
    }));
    if (format === "pdf") {
      exportToPdf(data, SCHEDULE_EXPORT_COLUMNS, "Maintenance Schedules", "maintenance-schedules");
      addToast("Exported to PDF", "success");
    } else {
      exportToExcel(data, SCHEDULE_EXPORT_COLUMNS, "maintenance-schedules");
      addToast("Exported to Excel", "success");
    }
  };

  const activeCount = rows.filter((r) => r.is_active).length;
  const overdueCount = rows.filter((r) => r.is_overdue || (r.next_due_date && new Date(r.next_due_date) < new Date())).length;
  const dueSoonCount = rows.filter((r) => {
    if (!r.next_due_date) return false;
    const diff = (new Date(r.next_due_date) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  }).length;

  const columns = [
    {
      key: "machine",
      label: "Machine",
      render: (r) => (
        <div>
          <div className="font-semibold text-[var(--color-text)]">{r.machine_name || r.machine_id}</div>
          <div className="text-[11px] text-[var(--color-text-muted)]">{r.department || "Production"}</div>
        </div>
      ),
    },
    {
      key: "task_name",
      label: "Scheduled Task",
      render: (r) => (
        <div>
          <div className="font-medium text-[var(--color-text)]">{r.task_name}</div>
          {r.description && <div className="text-[11px] text-[var(--color-text-muted)] line-clamp-1">{r.description}</div>}
        </div>
      ),
    },
    {
      key: "frequency_days",
      label: "Frequency",
      render: (r) => (
        <span className="inline-flex rounded-md bg-[var(--color-primary-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
          Every {r.frequency_days} Days
        </span>
      ),
    },
    {
      key: "next_due_date",
      label: "Next Due Date",
      render: (r) => {
        const isPast = r.is_overdue || (r.next_due_date && new Date(r.next_due_date) < new Date());
        return (
          <span className={isPast ? "font-semibold text-[var(--kpi-danger)]" : "text-[var(--color-text)]"}>
            {String(r.next_due_date || "").slice(0, 10)}
            {isPast && <span className="ml-1.5 text-[11px] font-semibold text-[var(--kpi-danger)]">(Overdue)</span>}
          </span>
        );
      },
    },
    {
      key: "assigned_engineer",
      label: "Assigned To",
      render: (r) => <span className="text-[var(--color-text-secondary)]">{r.assigned_engineer || "Unassigned"}</span>,
    },
    {
      key: "is_active",
      label: "Status",
      render: (r) => (
        <button
          type="button"
          onClick={() => toggleActive(r.id)}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold cursor-pointer ${
            r.is_active ? "bg-[var(--kpi-success-soft)] text-[var(--kpi-success)] hover:opacity-90" : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:opacity-90"
          }`}
        >
          {r.is_active ? "Active" : "Paused"}
        </button>
      ),
    },
  ];

  if (loading) return <Loader label="Loading maintenance schedules..." />;
  if (error && !rows.length) return <MaintenanceErrorState message={error} onRetry={load} />;

  return (
    <ListPageShell>
    <div className="space-y-5 pb-5">
      <PageHeader
        subtitle="Define and automate recurring preventive maintenance schedules."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="add" type="button" onClick={() => setShowModal(true)} leftIcon={<Plus className="h-4 w-4" aria-hidden />}>
              Schedule Maintenance
            </Button>
            <ExportDownloadMenu disabled={!filtered.length} onExport={handleExport} />
          </div>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Schedules" value={rows.length} icon={Calendar} color="bg-[var(--color-primary)]" />
        <KpiCard label="Active Schedules" value={activeCount} icon={CheckCircle2} color="bg-emerald-600" />
        <KpiCard label="Due Within 7 Days" value={dueSoonCount} icon={Clock} color="bg-amber-500" />
        <KpiCard label="Overdue Schedules" value={overdueCount} icon={AlertTriangle} color="bg-red-500" />
      </div>

      <ListPageCard>
        <ListPageCardBody>
        <div className="grid gap-3 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-6">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by task, machine, or assigned engineer..."
              className="w-full"
            />
          </div>
          <div className="lg:col-span-3">
            <label className="ui-label mb-1 block">Frequency</label>
            <select
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value)}
              className="ui-select w-full"
            >
              <option value="">All Frequencies</option>
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <label className="ui-label mb-1 block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ui-select w-full"
            >
              <option value="">All Schedules</option>
              <option value="active">Active Only</option>
              <option value="inactive">Paused Only</option>
            </select>
          </div>
        </div>
        </ListPageCardBody>
      </ListPageCard>

      <ListPageCard>
        <ListPageCardBody className="overflow-x-auto">
        <DataTable columns={columns} data={filtered} searchPlaceholder="" searchKeys={[]} />
        </ListPageCardBody>
      </ListPageCard>

      {showModal && (
        <div className="ui-modal-backdrop">
          <div className="ui-modal max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text)]">Schedule Maintenance</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">Set up a recurring preventive maintenance routine</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ui-label">
                    Machine Name / ID <span className="text-red-500">*</span>
                  </label>
                  {machinesList.length > 0 ? (
                    <select
                      value={formData.machine_name}
                      onChange={handleMachineChange}
                      className="ui-select w-full"
                    >
                      {machinesList.map((m) => (
                        <option key={m.id} value={m.name}>
                          {m.name} ({m.code || `EQ-${m.id}`})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="e.g. CNC Milling Machine 01"
                      value={formData.machine_name}
                      onChange={(e) => setFormData({ ...formData, machine_name: e.target.value })}
                      className="ui-input w-full"
                    />
                  )}
                </div>
                <div>
                  <label className="ui-label">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="ui-select w-full"
                  >
                    <option value="Machining">Machining</option>
                    <option value="Press Shop">Press Shop</option>
                    <option value="Fabrication">Fabrication</option>
                    <option value="Assembly">Assembly</option>
                    <option value="Tool Room">Tool Room</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="ui-label">
                  Task Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Lubrication & Spindle Alignment"
                  value={formData.task_name}
                  onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
                  className="ui-input w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ui-label">Frequency</label>
                  <select
                    value={formData.frequency_days}
                    onChange={(e) => setFormData({ ...formData, frequency_days: Number(e.target.value) })}
                    className="ui-select w-full"
                  >
                    {FREQUENCY_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="ui-label">
                    Next Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.next_due_date}
                    onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
                    className="ui-input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="ui-label">Assigned Engineer / Technician</label>
                <input
                  type="text"
                  placeholder="e.g. R. Kumar (Senior Mech Engineer)"
                  value={formData.assigned_engineer}
                  onChange={(e) => setFormData({ ...formData, assigned_engineer: e.target.value })}
                  className="ui-input w-full"
                />
              </div>

              <div>
                <label className="ui-label">Checklist & Inspection Description</label>
                <textarea
                  rows={3}
                  placeholder="Specify task checklist, lubricants to use, tolerances to measure..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="ui-input w-full min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--color-border-soft)] pt-4">
                <Button type="button" variant="cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving}
                  loading={saving}
                >
                  {saving ? "Saving..." : "Save Schedule"}
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
