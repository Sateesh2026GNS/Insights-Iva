import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Boxes,
  CheckCircle2,
  Filter,
  Laptop,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";

import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { getMappedAssets, returnAllocatedAsset } from "../../api/hrApi";
import "./mappedAssets.css";

export default function MappedAssets() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [mapped, setMapped] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getMappedAssets();
      const rows = res?.data?.items || res?.data || [];
      setMapped(Array.isArray(rows) ? rows : []);
    } catch {
      setMapped([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const handleReturn = async (row) => {
    const label = `${row.asset_code || "Asset"} (${row.name || "item"})`;
    if (!window.confirm(`Unmap and return ${label} from ${row.assigned_to}?`)) return;
    try {
      await returnAllocatedAsset({
        asset_id: row.id,
        allocation_id: row.allocation_id || null,
        return_date: new Date().toISOString().slice(0, 10),
      });
      addToast("Asset returned and unmapped successfully", "success");
      load(true);
    } catch {
      addToast("Failed to unmap asset", "error");
    }
  };

  const categories = useMemo(() => {
    const set = new Set();
    mapped.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set);
  }, [mapped]);

  const departments = useMemo(() => {
    const set = new Set();
    mapped.forEach((m) => {
      if (m.department && m.department !== "—") set.add(m.department);
    });
    return Array.from(set);
  }, [mapped]);

  const filteredMapped = useMemo(() => {
    return mapped.filter((m) => {
      const matchCat = categoryFilter === "all" || m.category === categoryFilter;
      const matchDept = departmentFilter === "all" || m.department === departmentFilter;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (m.name || "").toLowerCase().includes(q) ||
        (m.asset_code || "").toLowerCase().includes(q) ||
        (m.assigned_to || "").toLowerCase().includes(q) ||
        (m.employee_code || "").toLowerCase().includes(q) ||
        (m.department || "").toLowerCase().includes(q) ||
        (m.location || "").toLowerCase().includes(q);
      return matchCat && matchDept && matchSearch;
    });
  }, [mapped, categoryFilter, departmentFilter, search]);

  const stats = useMemo(() => {
    const total = mapped.length;
    const itEquip = mapped.filter((m) => (m.category || "").toLowerCase().includes("it")).length;
    const uniqueStaff = new Set(mapped.map((m) => m.assigned_to).filter(Boolean)).size;
    const totalCost = mapped.reduce((acc, curr) => acc + (Number(curr.purchase_cost) || 0), 0);
    return { total, itEquip, uniqueStaff, totalCost };
  }, [mapped]);

  if (loading) return <Loader label="Loading mapped assets..." />;

  return (
    <ListPageShell>
      <div className="hr-mapped-assets min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="hr-mapped-assets__title !mb-1 text-xl font-bold text-slate-900">
              Mapped Assets Directory
            </h1>
            <p className="text-xs text-slate-500">
              Comprehensive overview of company hardware and tools currently mapped and handed over to personnel.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              to="/hr/assets"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Boxes className="h-4 w-4" />
              Company Assets
            </Link>
            <Link
              to="/hr/assets/create"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              + Allocate Asset
            </Link>
          </div>
        </div>

        {/* 4 KPIs */}
        <div className="hr-mapped-assets__kpis">
          <div className="hr-mapped-assets__kpi-card">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-50 text-blue-600">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Total Mapped Assets
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            </div>
          </div>

          <div className="hr-mapped-assets__kpi-card">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Employees Holding Assets
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.uniqueStaff}</div>
            </div>
          </div>

          <div className="hr-mapped-assets__kpi-card">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-purple-50 text-purple-600">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                IT & Tech Devices
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.itEquip}</div>
            </div>
          </div>

          <div className="hr-mapped-assets__kpi-card">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Value Mapped (₹)
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono">
                ₹ {stats.totalCost.toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        </div>

        {/* Directory Table Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee, asset code, department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {categories.length > 0 && (
                <>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category:</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-600"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {departments.length > 0 && (
                <>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Department:</label>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-600"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {filteredMapped.length === 0 ? (
            <div className="py-16 text-center">
              <UserCheck className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-600">No mapped assets found</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                {search || categoryFilter !== "all"
                  ? "Try resetting your filter parameters."
                  : "Allocate assets to employees to have them mapped here."}
              </p>
              <Link
                to="/hr/assets/create"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Allocate Asset
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Department & Branch</th>
                    <th className="px-4 py-3">Asset Code</th>
                    <th className="px-4 py-3">Asset Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Allocated Date</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                  {filteredMapped.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 text-xs">
                            {(row.assigned_to || "U")[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {row.assigned_to}
                            </div>
                            <div className="text-xs text-slate-400">
                              {row.designation || row.employee_code || "Staff"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {row.department || "General"}
                        </div>
                        {row.work_location && (
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <MapPin className="h-3 w-3" />
                            {row.work_location}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-blue-600">
                        {row.asset_code}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {row.category || "General"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">
                        {row.allocated_date || row.purchase_date || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {row.purchase_cost ? `₹ ${Number(row.purchase_cost).toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleReturn(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm"
                          title="Unmap / Return Asset"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Unmap / Return
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ListPageShell>
  );
}
