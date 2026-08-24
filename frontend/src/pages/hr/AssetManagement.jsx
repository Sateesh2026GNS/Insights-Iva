import { useEffect, useState, useMemo, useCallback } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Plus, Briefcase, Tag, MapPin, User, ShieldCheck, X, Save } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import DataTable from "../../components/common/DataTable";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { createHrAsset, getEmployees, getHrAssets } from "../../api/hrApi";
import { apiErrorMessage } from "../../utils/apiError";

import Button from "../../components/common/Button";
const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all";


const statusBadgeColor = (status) => {
  switch (String(status).toLowerCase()) {
    case "active":
    case "assigned":
      return "bg-green-50 text-green-700 border-green-200";
    case "in repair":
    case "maintenance":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "retired":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
};

export default function AssetManagement({ autoOpenCreate }) {
  const { addToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);

  // Modal form states
  const [showCreateModal, setShowCreateModal] = useState(autoOpenCreate || false);
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, assetRes] = await Promise.all([getEmployees(), getHrAssets()]);
      setEmployees(empRes.data || []);
      setAssets(assetRes.data || []);
    } catch (err) {
      setAssets([]);
      addToast(apiErrorMessage(err, "Failed to load assets"), "error");
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

  const kpis = useMemo(() => {
    const total = assets.length;
    const active = assets.filter((a) => a.status === "Active" || a.status === "Assigned").length;
    const repair = assets.filter((a) => a.status === "In Repair").length;
    const retired = assets.filter((a) => a.status === "Retired").length;
    return { total, active, repair, retired };
  }, [assets]);

  const handleFormChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
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
      setShowCreateModal(false);
      setForm({
        asset_code: "",
        name: "",
        category: "IT Equipment",
        status: "Active",
        assigned_to: "",
        location: "",
        purchase_date: new Date().toISOString().slice(0, 10),
        purchase_cost: "",
      });
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to save asset registry."));
      addToast(apiErrorMessage(err, "Failed to save asset"), "error");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "asset_code", label: "Asset Code", render: (r) => <span className="font-semibold text-slate-800">{r.asset_code}</span> },
    { key: "name", label: "Asset Name", render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    { key: "category", label: "Category", render: (r) => <span className="text-slate-600">{r.category}</span> },
    { key: "location", label: "Location", render: (r) => <span className="text-slate-600">{r.location || "—"}</span> },
    {
      key: "assigned_to",
      label: "Assigned To",
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-slate-700">
          <User className="h-3.5 w-3.5 text-slate-400" />
          {r.assigned_to || <span className="text-xs text-slate-400 italic">Unassigned</span>}
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
    {
      key: "purchase_cost",
      label: "Cost",
      render: (r) => (r.purchase_cost ? `₹${Number(r.purchase_cost).toLocaleString()}` : "—"),
    },
  ];

  if (loading && assets.length === 0) return <Loader label="Loading assets registry..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="Track company assets, IT gear, and tooling assigned to employees and operational locations."
        action={
          <>
            <Button
            variant="add"
            type="button"
            onClick={() => setShowCreateModal(true)}
            leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
          >
            Register Asset
          </Button>
          </>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Registered Assets" value={kpis.total} icon={Briefcase} color="bg-[var(--color-primary)]" />
        <KpiCard label="Active / Assigned" value={kpis.active} icon={ShieldCheck} color="bg-green-600" />
        <KpiCard label="Under Repair" value={kpis.repair} icon={Tag} color="bg-amber-500" />
        <KpiCard label="Retired / Disposed" value={kpis.retired} icon={MapPin} color="bg-slate-400" />
      </div>

      <div className="ui-card p-4">
        <DataTable
          columns={columns}
          data={assets}
          searchPlaceholder="Search"
          searchKeys={["name", "asset_code", "category", "assigned_to", "location"]}
        />
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Register Asset</h3>
                <p className="text-xs text-slate-500 mt-0.5">Define a company asset entry for auditing.</p>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Asset Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AST-LPT-05"
                    value={form.asset_code}
                    onChange={(e) => handleFormChange("asset_code", e.target.value)}
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
                    onChange={(e) => handleFormChange("name", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => handleFormChange("category", e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-750 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {["IT Equipment", "Safety Gear", "Tools & Instruments", "Vehicles", "Office Supplies", "Furniture"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned To</label>
                  <select
                    value={form.assigned_to}
                    onChange={(e) => handleFormChange("assigned_to", e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-750 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                    onChange={(e) => handleFormChange("status", e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-750 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {["Active", "Assigned", "In Repair", "Retired"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Location / Floor</label>
                  <input
                    type="text"
                    placeholder="e.g. Main Plant - Floor B"
                    value={form.location}
                    onChange={(e) => handleFormChange("location", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Purchase Date</label>
                  <input
                    type="date"
                    value={form.purchase_date}
                    onChange={(e) => handleFormChange("purchase_date", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Cost (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 45000"
                    value={form.purchase_cost}
                    onChange={(e) => handleFormChange("purchase_cost", e.target.value)}
                    className={inputClass}
                  />
                </div>
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
                  {saving ? "Saving..." : "Register Asset"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
