import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Boxes,
  CheckCircle2,
  Layers,
  MapPin,
  Package,
  Plus,
  Search,
  Tag,
  Trash2,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";

import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import {
  allocateAsset,
  createAssetCategory,
  createHrAsset,
  deleteAssetCategory,
  deleteHrAsset,
  getAssetCategories,
  getEmployees,
  getHrAssets,
} from "../../api/hrApi";
import "./companyAssets.css";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all";

function AddCategoryModal({ open, onClose, onSave, saving }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="hr-company-assets__overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add Category"
    >
      <div className="hr-company-assets__modal" onClick={(e) => e.stopPropagation()}>
        <div className="hr-company-assets__modal-header">
          <h2 className="hr-company-assets__modal-title">Add Asset Category</h2>
          <button type="button" className="hr-company-assets__modal-close" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="hr-company-assets__modal-body space-y-4">
          <div>
            <label className="hr-company-assets__field-label">
              Category Name <span>*</span>
            </label>
            <input
              className="hr-company-assets__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. IT Equipment, Safety Gear"
              autoFocus
            />
          </div>
          <div>
            <label className="hr-company-assets__field-label">Description</label>
            <textarea
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the asset category"
            />
          </div>
        </div>

        <div className="hr-company-assets__modal-footer flex items-center justify-end gap-2 border-t pt-4">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="hr-company-assets__save-btn"
            disabled={!name.trim() || saving}
            onClick={() => onSave({ name: name.trim(), description: description.trim() })}
          >
            {saving ? "Saving..." : "Save Category"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AddAssetModal({ open, onClose, onSave, saving, categories, employees }) {
  const [form, setForm] = useState({
    asset_code: "",
    name: "",
    category: categories[0]?.name || "IT Equipment",
    status: "Active",
    assigned_to: "",
    location: "",
    purchase_cost: "",
    purchase_date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (open) {
      setForm({
        asset_code: `AST-${Date.now().toString().slice(-4)}`,
        name: "",
        category: categories[0]?.name || "IT Equipment",
        status: "Active",
        assigned_to: "",
        location: "",
        purchase_cost: "",
        purchase_date: new Date().toISOString().slice(0, 10),
      });
    }
  }, [open, categories]);

  if (!open) return null;

  return createPortal(
    <div
      className="hr-company-assets__overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add Asset"
    >
      <div
        className="hr-company-assets__modal max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hr-company-assets__modal-header">
          <h2 className="hr-company-assets__modal-title">Register New Asset</h2>
          <button type="button" className="hr-company-assets__modal-close" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.asset_code.trim() || !form.name.trim()) return;
            onSave(form);
          }}
        >
          <div className="hr-company-assets__modal-body space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="hr-company-assets__field-label">Asset Code *</label>
                <input
                  className={inputClass}
                  required
                  value={form.asset_code}
                  onChange={(e) => setForm({ ...form, asset_code: e.target.value })}
                  placeholder="e.g. AST-LPT-05"
                />
              </div>
              <div>
                <label className="hr-company-assets__field-label">Asset Name *</label>
                <input
                  className={inputClass}
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Dell Latitude 5420"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="hr-company-assets__field-label">Category</label>
                <select
                  className={inputClass}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  {categories.length === 0 && <option value="IT Equipment">IT Equipment</option>}
                </select>
              </div>
              <div>
                <label className="hr-company-assets__field-label">Status</label>
                <select
                  className={inputClass}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="Active">Active / Available</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Repair">Under Maintenance</option>
                  <option value="Retired">Retired</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="hr-company-assets__field-label">Assigned To (Optional)</label>
                <select
                  className={inputClass}
                  value={form.assigned_to}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      assigned_to: e.target.value,
                      status: e.target.value ? "Assigned" : form.status === "Assigned" ? "Active" : form.status,
                    })
                  }
                >
                  <option value="">Keep Unassigned</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.full_name}>
                      {emp.full_name} ({emp.employee_code || emp.department || "Staff"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="hr-company-assets__field-label">Location / Workstation</label>
                <input
                  className={inputClass}
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Floor 2, Workstation B-14"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="hr-company-assets__field-label">Purchase Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.purchase_date}
                  onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                />
              </div>
              <div>
                <label className="hr-company-assets__field-label">Purchase Cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={form.purchase_cost}
                  onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })}
                  placeholder="e.g. 65000"
                />
              </div>
            </div>
          </div>

          <div className="hr-company-assets__modal-footer flex items-center justify-end gap-2 border-t pt-4">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="hr-company-assets__save-btn"
              disabled={!form.asset_code.trim() || !form.name.trim() || saving}
            >
              {saving ? "Saving..." : "Register Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default function CompanyAssets() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState("assets");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [astRes, catRes, empRes] = await Promise.allSettled([
        getHrAssets(),
        getAssetCategories(),
        getEmployees(),
      ]);

      if (astRes.status === "fulfilled") {
        const rows = astRes.value?.data?.items || astRes.value?.data || [];
        setAssets(Array.isArray(rows) ? rows : []);
      }
      if (catRes.status === "fulfilled") {
        const rows = catRes.value?.data?.items || catRes.value?.data || [];
        setCategories(Array.isArray(rows) ? rows : []);
      }
      if (empRes.status === "fulfilled") {
        const rows = empRes.value?.data?.items || empRes.value?.data || [];
        setEmployees(Array.isArray(rows) ? rows : []);
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const handleSaveCategory = async (payload) => {
    setSaving(true);
    try {
      const res = await createAssetCategory(payload);
      const created = res?.data || { id: `cat-${Date.now()}`, ...payload };
      setCategories((prev) => [...prev, created]);
      addToast("Category added successfully", "success");
      setCatModalOpen(false);
    } catch {
      addToast("Failed to add category", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    try {
      await deleteAssetCategory(catId);
      setCategories((prev) => prev.filter((c) => c.id !== catId));
      addToast("Category deleted", "success");
    } catch {
      addToast("Failed to delete category", "error");
    }
  };

  const handleSaveAsset = async (payload) => {
    setSaving(true);
    try {
      const res = await createHrAsset({
        ...payload,
        purchase_cost: payload.purchase_cost ? Number(payload.purchase_cost) : 0,
      });
      const created = res?.data || { id: `ast-${Date.now()}`, ...payload };
      setAssets((prev) => [created, ...prev]);

      // If assigned, register allocation
      if (payload.assigned_to) {
        try {
          await allocateAsset({
            asset_id: created.id,
            employee_name: payload.assigned_to,
            allocated_date: payload.purchase_date,
          });
        } catch {
          // non-blocking
        }
      }

      addToast("Asset registered successfully", "success");
      setAssetModalOpen(false);
    } catch {
      addToast("Failed to register asset", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAsset = async (astId) => {
    if (!window.confirm("Are you sure you want to delete this asset from register?")) return;
    try {
      await deleteHrAsset(astId);
      setAssets((prev) => prev.filter((a) => a.id !== astId));
      addToast("Asset removed", "success");
    } catch {
      addToast("Failed to remove asset", "error");
    }
  };

  // KPIs
  const kpiStats = useMemo(() => {
    const total = assets.length;
    const assigned = assets.filter((a) => (a.status || "").toLowerCase() === "assigned" || a.assigned_to).length;
    const available = assets.filter((a) => (a.status || "").toLowerCase() === "active" && !a.assigned_to).length;
    const maintenance = assets.filter((a) => ["in repair", "maintenance"].includes((a.status || "").toLowerCase())).length;
    return { total, assigned, available, maintenance };
  }, [assets]);

  // Filtered assets
  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      const matchCat = selectedCategory === "all" || a.category === selectedCategory;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (a.name || "").toLowerCase().includes(q) ||
        (a.asset_code || "").toLowerCase().includes(q) ||
        (a.assigned_to || "").toLowerCase().includes(q) ||
        (a.location || "").toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [assets, selectedCategory, search]);

  if (loading) return <Loader label="Loading company assets..." />;

  return (
    <ListPageShell>
      <div className="hr-company-assets min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="hr-company-assets__title !mb-1 text-xl font-bold text-slate-900">
              Company Assets Register
            </h1>
            <p className="text-xs text-slate-500">
              Track, allocate, and manage company-owned IT hardware, furniture, equipment, and safety gear.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" onClick={() => setCatModalOpen(true)}>
              <Tag className="h-4 w-4 mr-1" />
              Manage Categories
            </Button>
            <Button variant="primary" onClick={() => setAssetModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Asset
            </Button>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="hr-company-assets__kpis">
          <div className="hr-company-assets__kpi-card">
            <div className="hr-company-assets__kpi-icon bg-blue-50 text-blue-600">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="hr-company-assets__kpi-label">Total Assets</div>
              <div className="hr-company-assets__kpi-value">{kpiStats.total}</div>
            </div>
          </div>

          <div className="hr-company-assets__kpi-card">
            <div className="hr-company-assets__kpi-icon bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="hr-company-assets__kpi-label">Available / In Stock</div>
              <div className="hr-company-assets__kpi-value">{kpiStats.available}</div>
            </div>
          </div>

          <div className="hr-company-assets__kpi-card">
            <div className="hr-company-assets__kpi-icon bg-indigo-50 text-indigo-600">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="hr-company-assets__kpi-label">Assigned to Staff</div>
              <div className="hr-company-assets__kpi-value">{kpiStats.assigned}</div>
            </div>
          </div>

          <div className="hr-company-assets__kpi-card">
            <div className="hr-company-assets__kpi-icon bg-amber-50 text-amber-600">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <div className="hr-company-assets__kpi-label">Under Maintenance</div>
              <div className="hr-company-assets__kpi-value">{kpiStats.maintenance}</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="hr-company-assets__tabs-bar">
          <button
            type="button"
            className={`hr-company-assets__tab-btn ${activeTab === "assets" ? "hr-company-assets__tab-btn--active" : ""}`}
            onClick={() => setActiveTab("assets")}
          >
            <Boxes className="h-4 w-4" />
            Asset Inventory ({assets.length})
          </button>
          <button
            type="button"
            className={`hr-company-assets__tab-btn ${activeTab === "categories" ? "hr-company-assets__tab-btn--active" : ""}`}
            onClick={() => setActiveTab("categories")}
          >
            <Layers className="h-4 w-4" />
            Asset Categories ({categories.length})
          </button>
        </div>

        {activeTab === "assets" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {/* Toolbar */}
            <div className="hr-company-assets__toolbar">
              <div className="hr-company-assets__search-wrap">
                <Search className="hr-company-assets__search-icon h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search code, name, staff, location..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="hr-company-assets__search-input"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category:</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-600"
                >
                  <option value="all">All Categories ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <Link
                  to="/hr/assets/create"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Go to Allocate Assets &rarr;
                </Link>
              </div>
            </div>

            {/* Assets Table */}
            {filteredAssets.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">No assets found</p>
                <p className="text-xs text-slate-400 mt-1">
                  {search ? "Try clearing search filter." : "Click 'Add Asset' to register equipment."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Asset Code</th>
                      <th className="px-4 py-3">Asset Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Assigned To</th>
                      <th className="px-4 py-3">Cost (₹)</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                    {filteredAssets.map((ast) => {
                      const isAssigned = (ast.status || "").toLowerCase() === "assigned" || ast.assigned_to;
                      return (
                        <tr key={ast.id} className="hover:bg-slate-50/75 transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-blue-600">
                            {ast.asset_code}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {ast.name}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {ast.category || "General"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {ast.location ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-400" />
                                {ast.location}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {ast.assigned_to ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                                <UserCheck className="h-3.5 w-3.5 text-blue-500" />
                                {ast.assigned_to}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {ast.purchase_cost ? `₹ ${Number(ast.purchase_cost).toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {isAssigned ? (
                              <span className="hr-company-assets__status-badge hr-company-assets__status-badge--assigned">
                                Assigned
                              </span>
                            ) : (ast.status || "").toLowerCase() === "in repair" ? (
                              <span className="hr-company-assets__status-badge hr-company-assets__status-badge--maintenance">
                                In Repair
                              </span>
                            ) : (
                              <span className="hr-company-assets__status-badge hr-company-assets__status-badge--active">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                to="/hr/assets/create"
                                title="Allocate Asset"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                              </Link>
                              <button
                                type="button"
                                title="Delete Asset"
                                onClick={() => handleDeleteAsset(ast.id)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "categories" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Asset Categories</h2>
                <p className="text-xs text-slate-500">Classify assets to streamline inventory audits and allocation.</p>
              </div>
              <Button variant="primary" onClick={() => setCatModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                New Category
              </Button>
            </div>

            {categories.length === 0 ? (
              <div className="py-12 text-center">
                <Layers className="h-9 w-9 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">No categories found</p>
                <button
                  type="button"
                  onClick={() => setCatModalOpen(true)}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                >
                  Create your first category
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Category Name</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Assets In Category</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                    {categories.map((cat) => {
                      const count = assets.filter((a) => a.category === cat.name).length;
                      return (
                        <tr key={cat.id || cat.name} className="hover:bg-slate-50/75 transition-colors">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {cat.name}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {cat.description || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                              {count} {count === 1 ? "Asset" : "Assets"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 transition-colors"
                              title="Delete Category"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <AddCategoryModal
          open={catModalOpen}
          onClose={() => setCatModalOpen(false)}
          onSave={handleSaveCategory}
          saving={saving}
        />

        <AddAssetModal
          open={assetModalOpen}
          onClose={() => setAssetModalOpen(false)}
          onSave={handleSaveAsset}
          saving={saving}
          categories={categories}
          employees={employees}
        />
      </div>
    </ListPageShell>
  );
}
