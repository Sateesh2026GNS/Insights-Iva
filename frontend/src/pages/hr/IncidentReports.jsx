import { useEffect, useState, useMemo, useCallback } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Plus, AlertTriangle, ShieldCheck, HeartPulse, ShieldAlert, X, Save } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import DataTable from "../../components/common/DataTable";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { createSafetyIncident, getEmployees, getSafetyIncidents } from "../../api/hrApi";
import { apiErrorMessage } from "../../utils/apiError";

import Button from "../../components/common/Button";
const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all";


const severityBadgeColor = (sev) => {
  switch (String(sev).toLowerCase()) {
    case "critical":
    case "high":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
};

const statusBadgeColor = (st) => {
  switch (String(st).toLowerCase()) {
    case "closed":
    case "resolved":
      return "bg-green-50 text-green-700 border-green-200";
    case "investigating":
    case "in progress":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-rose-50 text-rose-700 border-rose-200";
  }
};

export default function IncidentReports({ autoOpenCreate }) {
  const { addToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState([]);

  // Modal form states
  const [showCreateModal, setShowCreateModal] = useState(autoOpenCreate || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    incident_code: "",
    title: "",
    type: "Near Miss",
    reporter: "",
    date: new Date().toISOString().slice(0, 10),
    severity: "Low",
    status: "Open",
    description: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, incRes] = await Promise.all([getEmployees(), getSafetyIncidents()]);
      setEmployees(empRes.data || []);
      setIncidents(
        (incRes.data || []).map((row) => ({
          ...row,
          date: row.incident_date || row.date,
        }))
      );
    } catch (err) {
      setIncidents([]);
      addToast(apiErrorMessage(err, "Failed to load incidents"), "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const handleRefresh = async () => {
    await loadData();
  };

  usePageRefresh(handleRefresh);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal and pre-generate incident code
  const handleOpenCreateModal = () => {
    setForm({
      incident_code: `INC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      title: "",
      type: "Near Miss",
      reporter: "",
      date: new Date().toISOString().slice(0, 10),
      severity: "Low",
      status: "Open",
      description: "",
    });
    setError("");
    setShowCreateModal(true);
  };

  const kpis = useMemo(() => {
    const total = incidents.length;
    const openCount = incidents.filter((i) => i.status === "Open" || i.status === "Investigating").length;
    const critical = incidents.filter((i) => i.severity === "Critical").length;
    const resolved = total > 0 ? Math.round((incidents.filter((i) => i.status === "Resolved").length / total) * 100) : 0;
    return { total, openCount, critical, resolved };
  }, [incidents]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.reporter || !form.description) {
      setError("Please fill in all required fields (Title, Reporter, Description).");
      return;
    }
    setSaving(true);
    setError("");

    try {
      await createSafetyIncident({
        incident_code: form.incident_code,
        title: form.title,
        type: form.type,
        reporter: form.reporter,
        incident_date: form.date,
        severity: form.severity,
        status: form.status,
        description: form.description,
      });
      addToast("Safety incident reported successfully", "success");
      setShowCreateModal(false);
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save incident report."));
      addToast(apiErrorMessage(err, "Failed to save report"), "error");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "incident_code", label: "Code", render: (r) => <span className="font-semibold text-slate-800">{r.incident_code}</span> },
    { key: "title", label: "Incident Title", render: (r) => <span className="font-medium text-slate-900">{r.title}</span> },
    { key: "type", label: "Incident Type", render: (r) => <span className="text-slate-600">{r.type}</span> },
    { key: "reporter", label: "Reporter", render: (r) => <span className="text-slate-700">{r.reporter}</span> },
    { key: "date", label: "Date Reported", render: (r) => <span className="text-slate-600">{r.date}</span> },
    {
      key: "severity",
      label: "Severity",
      render: (r) => (
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${severityBadgeColor(r.severity)}`}>
          {r.severity}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${statusBadgeColor(r.status)}`}>
          {r.status}
        </span>
      ),
    },
  ];

  if (loading && incidents.length === 0) return <Loader label="Loading safety log..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="Record, investigate, and audit occupational health and safety incidents and near misses."
        action={
          <>
            <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 shadow-sm transition-all animate-none"
          >
            <Plus className="h-4 w-4" /> Report Incident
          </button>
          </>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Safety Events" value={kpis.total} icon={AlertTriangle} color="bg-slate-600" />
        <KpiCard label="Open Investigations" value={kpis.openCount} icon={ShieldAlert} color="bg-[var(--color-primary)]" />
        <KpiCard label="Critical Incidents" value={kpis.critical} icon={HeartPulse} color="bg-red-600" />
        <KpiCard label="Resolution Rate" value={`${kpis.resolved}%`} icon={ShieldCheck} color="bg-green-600" />
      </div>

      <div className="ui-card p-4">
        <DataTable
          columns={columns}
          data={incidents}
          searchPlaceholder="Search"
          searchKeys={["title", "type", "reporter", "severity", "status"]}
        />
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Report Safety Incident</h3>
                <p className="text-xs text-slate-500 mt-0.5">Record a new workplace safety event or hazard.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Incident Code *</label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={form.incident_code}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Incident Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Slippery aisle floor"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Incident Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-750 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {["Near Miss", "Injury", "Property Damage", "Environmental Hazard", "Illness"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Reported By *</label>
                  <select
                    value={form.reporter}
                    onChange={(e) => setForm({ ...form, reporter: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-755 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                    required
                  >
                    <option value="">Select Reporter</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.full_name}>
                        {emp.full_name} ({emp.employee_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Severity</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-755 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {["Low", "Medium", "High", "Critical"].map((s) => (
                      <option key={s} value={s}>{s} Severity</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-755 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {["Open", "Investigating", "Resolved"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Description of Event *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Provide details on root cause and immediate corrective actions taken..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <Button variant="primary" type="submit" disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Submit Report"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
