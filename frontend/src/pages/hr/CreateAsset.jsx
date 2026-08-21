import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";

import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { createHrAsset, getEmployees } from "../../api/hrApi";
import { apiErrorMessage } from "../../utils/apiError";

import Button from "../../components/common/Button";
const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all";

export default function CreateAsset() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    asset_code: "",
    name: "",
    category: "IT Equipment",
    status: "Active",
    assigned_to: "",
    location: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    purchase_cost: "",
  });

  useEffect(() => {
    getEmployees()
      .then((r) => setEmployees(r.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-set status to Assigned if assigned_to is selected
      if (field === "assigned_to") {
        if (value) {
          updated.status = "Assigned";
        } else if (prev.status === "Assigned") {
          updated.status = "Active";
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.asset_code || !form.name) {
      setError("Asset Code and Asset Name are required.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      await createHrAsset({
        ...form,
        purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : 0,
      });
      addToast("Asset registered successfully", "success");
      navigate("/hr/assets");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save asset registry."));
      addToast(apiErrorMessage(err, "Failed to save asset"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading registration form..." />;

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          to="/hr/assets"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <p className="text-xs text-slate-500">Add a new company asset, IT equipment, safety gear, or tool into the register.</p>
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
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Asset Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. AST-LPT-05"
                value={form.asset_code}
                onChange={(e) => handleChange("asset_code", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Asset Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. HP EliteBook G8"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
              <select
                value={form.category}
                onChange={(e) => handleChange("category", e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {["IT Equipment", "Safety Gear", "Tools & Instruments", "Vehicles", "Office Supplies", "Furniture"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned To</label>
              <select
                value={form.assigned_to}
                onChange={(e) => handleChange("assigned_to", e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Keep Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.full_name}>
                    {emp.full_name} ({emp.employee_code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
              <select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {["Active", "Assigned", "In Repair", "Retired"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Location / Floor</label>
              <input
                type="text"
                placeholder="e.g. Main Plant - Floor B"
                value={form.location}
                onChange={(e) => handleChange("location", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Purchase Date</label>
              <input
                type="date"
                value={form.purchase_date}
                onChange={(e) => handleChange("purchase_date", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Purchase Cost (₹)</label>
              <input
                type="number"
                placeholder="e.g. 45000"
                value={form.purchase_cost}
                onChange={(e) => handleChange("purchase_cost", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Link
              to="/hr/assets"
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
            <Button variant="primary" type="submit" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Register Asset"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
