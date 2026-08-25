import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Briefcase, UserCheck, UserMinus, UserPlus, Users, Filter, X, Save, Clock, Building2, FileText } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import DataTable from "../../components/common/DataTable";
import Loader from "../../components/common/Loader";
import EmployeeAddressModal from "../../components/hr/EmployeeAddressModal";
import EmployeeDetailModal from "../../components/hr/EmployeeDetailModal";
import { DepartmentFormModal } from "../../components/hr/DepartmentDetailModal";
import { useToast } from "../../context/ToastContext";
import { getEmployeeSummary, getEmployeesEnriched, createEmployee, getDepartments, createDepartment, getShifts } from "../../api/hrApi";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import { deptColor, formatInr, statusColor } from "../../data/hrMasterData";

import Button from "../../components/common/Button";
const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[var(--color-cta)] focus:outline-none focus:ring-2 focus:ring-amber-100 transition-all";


const defaultFilters = { department: "", employment_type: "", shift: "", status: "" };

export default function Employees() {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selected, setSelected] = useState(null);

  const [shifts, setShifts] = useState([]);
  const [deptList, setDeptList] = useState([]);
  const [showDeptForm, setShowDeptForm] = useState(false);

  const loadDepts = useCallback(async () => {
    try {
      const res = await getDepartments();
      if (Array.isArray(res.data)) setDeptList(res.data);
    } catch { /* keep empty */ }
  }, []);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    tenant_id: tenantId,
    employee_code: "",
    full_name: "",
    email: "",
    phone: "",
    department: "",
    address: "",
    designation: "",
    shift_name: "",
    reporting_manager: "",
    hire_date: new Date().toISOString().slice(0, 10),
    hourly_rate: "",
  });
  const [addressOpen, setAddressOpen] = useState(false);

  const load = useCallback(
    async (isManual = false) => {
      setLoading(true);
      try {
        const [sumRes, listRes, shiftsRes] = await Promise.allSettled([
          getEmployeeSummary(),
          getEmployeesEnriched(),
          getShifts(),
        ]);
        if (sumRes.status === "fulfilled" && sumRes.value?.data) {
          setSummary(sumRes.value.data || {});
        } else {
          setSummary({});
        }
        if (listRes.status === "fulfilled" && Array.isArray(listRes.value?.data)) {
          setRows([...listRes.value.data]);
        } else {
          setRows([]);
        }
        if (shiftsRes.status === "fulfilled" && Array.isArray(shiftsRes.value?.data)) {
          setShifts(shiftsRes.value.data);
        } else {
          setShifts([]);
        }
        await loadDepts();
      } catch {
        setSummary({});
        setRows([]);
        setShifts([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  usePageRefresh(load);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadDepts(); }, [loadDepts]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filters.department) list = list.filter((r) => r.department === filters.department);
    if (filters.employment_type) list = list.filter((r) => r.employment_type === filters.employment_type);
    if (filters.shift) list = list.filter((r) => r.shift === filters.shift);
    return list;
  }, [rows, filters]);

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee_code || !form.full_name) {
      setError("Employee Code and Full Name are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createEmployee({
        ...form,
        tenant_id: tenantId,
        employee_code: form.employee_code.trim(),
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        department: form.department.trim() || null,
        address: form.address.trim() || null,
        designation: form.designation.trim() || null,
        shift_name: form.shift_name.trim() || null,
        reporting_manager: form.reporting_manager.trim() || null,
        hire_date: form.hire_date || null,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
      });
      addToast("Employee created successfully", "success");
      setShowCreateModal(false);
      setForm({
        tenant_id: tenantId,
        employee_code: "",
        full_name: "",
        email: "",
        phone: "",
        department: "",
        address: "",
        designation: "",
        shift_name: "",
        reporting_manager: "",
        hire_date: new Date().toISOString().slice(0, 10),
        hourly_rate: "",
      });
      load();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.message;
      setError(
        typeof detail === "string"
          ? detail
          : "Failed to create employee. Please check the form and try again."
      );
      addToast("Failed to create employee", "error");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "photo", label: "Photo", render: (r) => (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">{r.initials || "?"}</div>
    )},
    { key: "employee_id", label: "Employee ID" },
    { key: "full_name", label: "Name", render: (r) => <span className="font-medium text-slate-900">{r.full_name}</span> },
    { key: "department", label: "Department", render: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${deptColor(r.department)}`}>{r.department}</span> },
    { key: "designation", label: "Designation" },
    { key: "shift", label: "Shift", render: (r) => typeof r.shift === "object" ? (r.shift?.label || r.shift?.id || "—") : (r.shift || "—") },
    { key: "reporting_manager", label: "Manager", render: (r) => r.reporting_manager || "—" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "joining_date", label: "Joining", render: (r) => String(r.joining_date || "").slice(0, 10) || "—" },
    { key: "salary", label: "Salary", render: (r) => r.salary ? formatInr(r.salary) : "—" },
    { key: "actions", label: "Actions", render: (r) => (
      <button type="button" onClick={() => setSelected(r)} className="text-xs font-semibold text-[var(--color-primary)] hover:underline">Profile</button>
    )},
  ];

  if (loading && rows.length === 0) return <Loader label="Loading employees..." />;

  return (
    <div className="hr-page ui-page ui-stack space-y-5 pb-4">
      <PageHeader
        action={
          <>
            <Button
            variant="add"
            type="button"
            onClick={() => setShowCreateModal(true)}
            leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
          >
            Create Employee
          </Button>
          </>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Employees" value={summary.total_employees} icon={Users} color="bg-[var(--color-primary)]" />
        <KpiCard label="Present Today" value={summary.present_today} icon={UserCheck} color="bg-green-600" />
        <KpiCard label="Absent" value={summary.absent} icon={UserMinus} color="bg-red-500" />
        <KpiCard label="On Leave" value={summary.on_leave} icon={Briefcase} color="bg-amber-500" />
        <KpiCard label="Overtime (h)" value={summary.overtime} icon={Clock} color="bg-orange-500" />
        <KpiCard label="Departments" value={summary.departments} icon={Building2} color="bg-indigo-600" />
        <KpiCard label="New Joiners" value={summary.new_joiners} icon={UserPlus} color="bg-purple-600" />
      </div>

      <div className="ui-card p-4">
        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="mb-3 inline-flex items-center gap-2 text-[var(--text-sm)] font-semibold text-[var(--color-text-secondary)]"><Filter className="h-4 w-4" /> Filters</button>
        {showAdvanced && (
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <select value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })} className="ui-input">
              <option value="">All Departments</option>
              {["Production", "HR", "Sales", "Accountant", "Store Manager", "Operator"].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filters.employment_type} onChange={(e) => setFilters({ ...filters, employment_type: e.target.value })} className="ui-input">
              <option value="">All Types</option>
              {["permanent", "contract", "temporary"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filters.shift} onChange={(e) => setFilters({ ...filters, shift: e.target.value })} className="ui-input">
              <option value="">All Shifts</option>
              {["Morning", "General", "Evening", "Night"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        <DataTable columns={columns} data={filtered} searchPlaceholder="Search" searchKeys={["full_name", "employee_id", "department", "designation"]} />
      </div>

      {selected && <EmployeeDetailModal employee={selected} onClose={() => setSelected(null)} />}

      {showDeptForm && (
        <DepartmentFormModal
          department={{}}
          onClose={() => setShowDeptForm(false)}
          onSave={async (formData) => {
            try {
              const res = await createDepartment({ ...formData, tenant_id: tenantId, is_active: true });
              addToast("Department created successfully", "success");
              await loadDepts();
              // Auto-select the newly created department
              if (res?.data?.name) handleFormChange("department", res.data.name);
            } catch {
              addToast("Failed to create department", "error");
            }
            setShowDeptForm(false);
          }}
        />
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Employee</h3>
                <p className="text-xs text-slate-500 mt-0.5">Add a new employee record for your organization.</p>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Employee Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP-001"
                    value={form.employee_code}
                    onChange={(e) => handleFormChange("employee_code", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name (As per Aadhar) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma"
                    value={form.full_name}
                    onChange={(e) => handleFormChange("full_name", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Address</p>
                  {form.address ? (
                    <p className="mt-1 text-sm text-slate-700">{form.address}</p>
                  ) : (
                    <p className="ui-subtitle">No address added yet.</p>
                  )}
                </div>
                <Button
                  variant="hr"
                  type="button"
                  onClick={() => setAddressOpen(true)}
                  className="px-3 py-2 text-[11px]"
                >
                  {form.address ? "Edit Address" : "Add Address"}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={form.email}
                    onChange={(e) => handleFormChange("email", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Hire Date</label>
                  <input
                    type="date"
                    value={form.hire_date}
                    onChange={(e) => handleFormChange("hire_date", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Department</label>
                    <button
                      type="button"
                      onClick={() => setShowDeptForm(true)}
                      className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
                    >
                      <Plus className="mr-1 inline h-3 w-3" /> Add Department
                    </button>
                  </div>
                  <select
                    value={form.department}
                    onChange={(e) => handleFormChange("department", e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select Department</option>
                    {deptList.length > 0
                      ? deptList.map((d) => (
                          <option key={d.id ?? d.name} value={d.name}>{d.name}</option>
                        ))
                      : ["Production", "HR", "Sales", "Accountant", "Store Manager", "Operator"].map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Assign Shift</label>
                  <select
                    value={form.shift_name}
                    onChange={(e) => handleFormChange("shift_name", e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Select Shift</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.name}>{s.name} ({s.start_time.slice(0,5)} - {s.end_time.slice(0,5)})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Operator"
                    value={form.designation}
                    onChange={(e) => handleFormChange("designation", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Hourly Rate ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.hourly_rate}
                    onChange={(e) => handleFormChange("hourly_rate", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Reporting Manager</label>
                  <input
                    type="text"
                    placeholder="e.g. Gogula Sowmya"
                    value={form.reporting_manager}
                    onChange={(e) => handleFormChange("reporting_manager", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 90591 86584"
                    value={form.phone}
                    onChange={(e) => handleFormChange("phone", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <EmployeeAddressModal
                open={addressOpen}
                onClose={() => setAddressOpen(false)}
                value={form.address}
                onSave={(value) => handleFormChange("address", value)}
              />

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
                  {saving ? "Saving..." : "Create Employee"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
