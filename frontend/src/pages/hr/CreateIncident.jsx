import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";

import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { createSafetyIncident, getEmployees } from "../../api/hrApi";
import { apiErrorMessage } from "../../utils/apiError";

import Button from "../../components/common/Button";
const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all";

export default function CreateIncident() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    incident_code: `INC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    title: "",
    type: "Near Miss",
    reporter: "",
    date: new Date().toISOString().slice(0, 10),
    severity: "Low",
    status: "Open",
    description: "",
  });

  useEffect(() => {
    getEmployees()
      .then((r) => setEmployees(r.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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
      navigate("/hr/incidents");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save incident report."));
      addToast(apiErrorMessage(err, "Failed to save report"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading incident form..." />;

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          to="/hr/incidents"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-xs text-slate-500">Record a new workplace safety event, near-miss, or hazard observation.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5 pb-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
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
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Incident Title / Summary *</label>
              <input
                type="text"
                required
                placeholder="e.g. Slippery spot near warehouse door"
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Incident Type</label>
              <select
                value={form.type}
                onChange={(e) => handleChange("type", e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {["Near Miss", "Injury", "Property Damage", "Environmental Hazard", "Illness"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Reported By *</label>
              <select
                value={form.reporter}
                onChange={(e) => handleChange("reporter", e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
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
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Date of Incident</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => handleChange("date", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Severity Level</label>
              <select
                value={form.severity}
                onChange={(e) => handleChange("severity", e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {["Low", "Medium", "High", "Critical"].map((s) => (
                  <option key={s} value={s}>
                    {s} Severity
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Workflow Status</label>
              <select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {["Open", "Investigating", "Resolved"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Description of Event *</label>
            <textarea
              required
              rows="4"
              placeholder="Provide a detailed description of what happened, root cause triggers, and immediate corrective actions taken..."
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Link
              to="/hr/incidents"
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
            <Button variant="primary" type="submit" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
