import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Boxes,
  Calendar,
  CheckCircle2,
  Clock,
  Laptop,
  Plus,
  RotateCcw,
  Search,
  User,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import {
  allocateAsset,
  getAllocatedAssets,
  getEmployees,
  getHrAssets,
  returnAllocatedAsset,
} from "../../api/hrApi";
import "./allocateAssets.css";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all";

function AllocateAssetModal({ open, onClose, onSave, saving, availableAssets, employees }) {
  const [assetId, setAssetId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [allocatedDate, setAllocatedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setAssetId(availableAssets[0]?.id ? String(availableAssets[0].id) : "");
      if (employees[0]) {
        setEmployeeId(String(employees[0].id));
        setEmployeeName(employees[0].full_name);
      } else {
        setEmployeeId("");
        setEmployeeName("");
      }
      setAllocatedDate(new Date().toISOString().slice(0, 10));
      setNotes("");
    }
  }, [open, availableAssets, employees]);

  if (!open) return null;

  const handleEmployeeChange = (e) => {
    const val = e.target.value;
    setEmployeeId(val);
    const found = employees.find((emp) => String(emp.id) === val);
    if (found) {
      setEmployeeName(found.full_name);
    }
  };

  return createPortal(
    <div
      className="hr-company-assets__overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Allocate Asset"
    >
      <div
        className="hr-company-assets__modal max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hr-company-assets__modal-header">
          <h2 className="hr-company-assets__modal-title">Allocate Asset to Employee</h2>
          <button type="button" className="hr-company-assets__modal-close" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!assetId || (!employeeId && !employeeName)) return;
            onSave({
              asset_id: Number(assetId),
              employee_id: employeeId ? Number(employeeId) : null,
              employee_name: employeeName,
              allocated_date: allocatedDate,
              notes: notes.trim(),
            });
          }}
        >
          <div className="hr-company-assets__modal-body space-y-4">
            <div>
              <label className="hr-company-assets__field-label">
                Select Asset to Allocate <span>*</span>
              </label>
              {availableAssets.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  No unallocated assets available right now. You can register a new asset first or return an existing one.
                </div>
              ) : (
                <select
                  required
                  className={inputClass}
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                >
                  {availableAssets.map((ast) => (
                    <option key={ast.id} value={ast.id}>
                      {ast.asset_code} — {ast.name} ({ast.category || "General"})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="hr-company-assets__field-label">
                Employee <span>*</span>
              </label>
              <select
                required
                className={inputClass}
                value={employeeId}
                onChange={handleEmployeeChange}
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code} — {emp.department || "Staff"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="hr-company-assets__field-label">Allocation Date</label>
              <input
                type="date"
                className={inputClass}
                value={allocatedDate}
                onChange={(e) => setAllocatedDate(e.target.value)}
              />
            </div>

            <div>
              <label className="hr-company-assets__field-label">Condition / Handover Notes</label>
              <textarea
                className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Issued with charger and mouse. Excellent condition."
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
              type="submit"
              className="hr-company-assets__save-btn"
              disabled={!assetId || (!employeeId && !employeeName) || saving}
            >
              {saving ? "Allocating..." : "Confirm Allocation"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default function AllocateAssets() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [allocRes, astRes, empRes] = await Promise.allSettled([
        getAllocatedAssets(),
        getHrAssets(),
        getEmployees(),
      ]);

      if (allocRes.status === "fulfilled") {
        const rows = allocRes.value?.data?.items || allocRes.value?.data || [];
        setAllocations(Array.isArray(rows) ? rows : []);
      }
      if (astRes.status === "fulfilled") {
        const rows = astRes.value?.data?.items || astRes.value?.data || [];
        setAssets(Array.isArray(rows) ? rows : []);
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

  const availableAssets = useMemo(() => {
    return assets.filter(
      (a) =>
        (a.status || "").toLowerCase() === "active" &&
        !a.assigned_to &&
        !allocations.some((al) => al.asset_id === a.id && al.status === "allocated")
    );
  }, [assets, allocations]);

  const handleAllocate = async (payload) => {
    setSaving(true);
    try {
      await allocateAsset(payload);
      addToast("Asset successfully allocated", "success");
      setModalOpen(false);
      load(true);
    } catch {
      addToast("Failed to allocate asset", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async (alloc) => {
    if (!window.confirm(`Confirm return of asset ${alloc.asset_code || alloc.asset_name || "item"} from ${alloc.employee_name}?`)) {
      return;
    }
    try {
      await returnAllocatedAsset({
        allocation_id: alloc.id,
        asset_id: alloc.asset_id,
        return_date: new Date().toISOString().slice(0, 10),
      });
      addToast("Asset returned and marked available", "success");
      load(true);
    } catch {
      addToast("Failed to return asset", "error");
    }
  };

  const filteredAllocations = useMemo(() => {
    return allocations.filter((al) => {
      const matchStatus =
        statusFilter === "all" || (al.status || "").toLowerCase() === statusFilter;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        (al.asset_code || "").toLowerCase().includes(q) ||
        (al.asset_name || "").toLowerCase().includes(q) ||
        (al.employee_name || "").toLowerCase().includes(q) ||
        (al.employee_code || "").toLowerCase().includes(q) ||
        (al.department || "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [allocations, statusFilter, search]);

  const stats = useMemo(() => {
    const active = allocations.filter((a) => (a.status || "").toLowerCase() === "allocated").length;
    const returned = allocations.filter((a) => (a.status || "").toLowerCase() === "returned").length;
    return {
      total: allocations.length,
      active,
      returned,
      availableCount: availableAssets.length,
    };
  }, [allocations, availableAssets]);

  if (loading) return <Loader label="Loading allocated assets..." />;

  return (
    <ListPageShell>
      <div className="hr-allocate-assets min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="hr-allocate-assets__title !mb-1 text-xl font-bold text-slate-900">
              Allocate Company Assets
            </h1>
            <p className="text-xs text-slate-500">
              Assign laptops, tools, accessories, and gear to team members with tracking and return verification.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              to="/hr/assets"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Boxes className="h-4 w-4" />
              Company Assets Register
            </Link>
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              + Allocate Asset
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="hr-allocate-assets__kpis">
          <div className="hr-allocate-assets__kpi-card">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-50 text-blue-600">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Currently Allocated
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.active}</div>
            </div>
          </div>

          <div className="hr-allocate-assets__kpi-card">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Available to Assign
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.availableCount}</div>
            </div>
          </div>

          <div className="hr-allocate-assets__kpi-card">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-purple-50 text-purple-600">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Returned Handbacks
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.returned}</div>
            </div>
          </div>

          <div className="hr-allocate-assets__kpi-card">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-slate-100 text-slate-700">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Total Records
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            </div>
          </div>
        </div>

        {/* Content Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search allocation by asset, employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-600"
              >
                <option value="all">All Allocations</option>
                <option value="allocated">Active Only</option>
                <option value="returned">Returned Only</option>
              </select>

              <Link
                to="/hr/assets/mapped"
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <Users className="h-3.5 w-3.5" />
                View Mapped Staff Assets &rarr;
              </Link>
            </div>
          </div>

          {filteredAllocations.length === 0 ? (
            <div className="py-16 text-center">
              <Laptop className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-600">No asset allocations recorded</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Click "+ Allocate Asset" to assign equipment to an employee.
              </p>
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Allocate Asset
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Asset Code</th>
                    <th className="px-4 py-3">Asset Name</th>
                    <th className="px-4 py-3">Assigned Employee</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Allocated Date</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                  {filteredAllocations.map((row) => {
                    const isAllocated = (row.status || "").toLowerCase() === "allocated";
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-blue-600">
                          {row.asset_code || `AST-${row.asset_id}`}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {row.asset_name || "Company Asset"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                              {(row.employee_name || "U")[0]}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">
                                {row.employee_name || "Staff Member"}
                              </div>
                              {row.employee_code && (
                                <div className="text-xs text-slate-400 font-mono">
                                  {row.employee_code}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.department || "General"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {row.allocated_date || "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                          {row.notes || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {isAllocated ? (
                            <span className="hr-allocate-assets__status-badge hr-allocate-assets__status-badge--allocated">
                              Allocated
                            </span>
                          ) : (
                            <span className="hr-allocate-assets__status-badge hr-allocate-assets__status-badge--returned">
                              Returned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAllocated ? (
                            <button
                              type="button"
                              onClick={() => handleReturn(row)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Return
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Completed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <AllocateAssetModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleAllocate}
          saving={saving}
          availableAssets={availableAssets}
          employees={employees}
        />
      </div>
    </ListPageShell>
  );
}

