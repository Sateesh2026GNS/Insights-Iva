import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Cpu, Download, FileText, Layers, Plus, Printer, Upload, UserCheck, Users } from "lucide-react";

import DataTable from "../../components/common/DataTable";
import TableActionButtons from "../../components/common/TableActionButtons";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import DepartmentDetailModal, { DepartmentFormModal } from "../../components/masters/DepartmentDetailModal";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  createDepartment,
  deactivateDepartment,
  getDepartmentDetail,
  getDepartmentSummary,
  getDepartments,
  updateDepartment,
} from "../../api/departmentsApi";
import {
  BRANCHES,
  DEMO_DEPARTMENTS,
  DEPARTMENT_STATUSES,
  DEPARTMENT_TYPES,
  IMPORT_TEMPLATE_HEADERS,
  PLANTS,
  REPORT_TYPES,
  WORKFLOW_STEPS,
  computeDepartmentSummary,
  departmentTypeLabel,
  enrichApiDepartment,
} from "../../data/departmentsMasterData";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 truncate text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const active = status === "active";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
      active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
    }`}>
      {status}
    </span>
  );
}

const defaultFilters = {
  code: "",
  name: "",
  department_type: "",
  manager: "",
  plant: "",
  branch: "",
  status: "",
};

export default function DepartmentManagement() {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [apiSummary, setApiSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [formDept, setFormDept] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, sRes] = await Promise.all([
        getDepartments().catch(() => ({ data: [] })),
        getDepartmentSummary().catch(() => ({ data: null })),
      ]);
      const apiRows = dRes.data || [];
      setDepartments(apiRows.map((row, i) => enrichApiDepartment(row, i)));
      setApiSummary(sRes.data);
    } catch {
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(loadDepartments);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const openDepartment = async (dept) => {
    setSelected(dept);
    setDetail(null);
    if (typeof dept.id === "number") {
      try {
        const res = await getDepartmentDetail(dept.id);
        setDetail(enrichApiDepartment(res.data));
      } catch {
        /* use list data */
      }
    }
  };

  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      if (filters.code && !String(d.code).toLowerCase().includes(filters.code.toLowerCase())) return false;
      if (filters.name && !d.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
      if (filters.department_type && d.department_type !== filters.department_type) return false;
      if (filters.manager && !String(d.manager_name || "").toLowerCase().includes(filters.manager.toLowerCase())) return false;
      if (filters.plant && d.plant !== filters.plant) return false;
      if (filters.branch && d.branch !== filters.branch) return false;
      if (filters.status && d.status !== filters.status) return false;
      return true;
    });
  }, [departments, filters]);

  const summary = useMemo(() => {
    if (apiSummary && !Object.values(filters).some(Boolean)) {
      return apiSummary;
    }
    return computeDepartmentSummary(filteredDepartments);
  }, [apiSummary, filteredDepartments, filters]);

  const exportColumns = [
    { key: "code", label: "Code" },
    { key: "name", label: "Department" },
    { key: "manager_name", label: "Manager" },
    { key: "employee_count", label: "Employees" },
    { key: "machine_count", label: "Machines" },
    { key: "work_center_count", label: "Work Centers" },
    { key: "status", label: "Status" },
  ];

  const handleExportExcel = () => {
    exportToExcel(filteredDepartments, exportColumns, "departments");
    addToast("Exported to Excel");
  };

  const handleExportPdf = () => {
    exportToPdf(filteredDepartments, exportColumns, "Department Master", "departments");
    addToast("Exported to PDF");
  };

  const handlePrint = () => handleExportPdf();

  const handleDownloadTemplate = () => {
    const header = IMPORT_TEMPLATE_HEADERS.join(",");
    const blob = new Blob([`${header}\nDEP013,IT,support,Plant 1,Hyderabad,Rajesh Kumar,+919999999999,rajesh@smrt.local,active`], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "departments_import_template.csv";
    a.click();
    addToast("Template downloaded");
  };

  const handleSave = async (form) => {
    const payload = {
      tenant_id: tenantId,
      code: form.code,
      name: form.name,
      department_type: form.department_type,
      plant: form.plant,
      branch: form.branch,
      description: form.description,
      status: form.status,
      manager_name: form.manager_name,
      manager_mobile: form.manager_mobile,
      manager_email: form.manager_email,
      manager_designation: form.manager_designation,
      employee_count: form.employee_count != null && form.employee_count !== "" ? Number(form.employee_count) : 0,
      machine_count: form.machine_count != null && form.machine_count !== "" ? Number(form.machine_count) : 0,
      work_center_count: form.work_center_count != null && form.work_center_count !== "" ? Number(form.work_center_count) : 0,
      is_active: form.status === "active",
    };
    try {
      if (formDept?.id && typeof formDept.id === "number") {
        await updateDepartment(formDept.id, payload);
        addToast("Department updated");
        loadDepartments();
        setFormDept(null);
        return;
      }
      await createDepartment(payload);
      addToast("Department created");
      loadDepartments();
      setFormDept(null);
      return;
    } catch {
      /* local fallback */
    }
    if (formDept?.id) {
      setDepartments((prev) => prev.map((d) => (d.id === formDept.id ? {
        ...d,
        ...form,
        employee_count: form.employee_count != null && form.employee_count !== "" ? Number(form.employee_count) : 0,
        machine_count: form.machine_count != null && form.machine_count !== "" ? Number(form.machine_count) : 0,
        work_center_count: form.work_center_count != null && form.work_center_count !== "" ? Number(form.work_center_count) : 0,
      } : d)));
      addToast("Department updated locally");
    } else {
      const newD = {
        ...enrichApiDepartment({ id: `new-${Date.now()}`, ...payload }, departments.length),
        id: `new-${Date.now()}`,
        code: form.code || `DEP${String(departments.length + 1).padStart(3, "0")}`,
        ...form,
        employee_count: form.employee_count != null && form.employee_count !== "" ? Number(form.employee_count) : 0,
        machine_count: form.machine_count != null && form.machine_count !== "" ? Number(form.machine_count) : 0,
        work_center_count: form.work_center_count != null && form.work_center_count !== "" ? Number(form.work_center_count) : 0,
      };
      setDepartments((prev) => [...prev, newD]);
      addToast("Department added");
    }
    setFormDept(null);
  };

  const handleDeactivate = async (dept) => {
    if (!window.confirm(`Deactivate ${dept.name}?`)) return;
    if (typeof dept.id === "number") {
      try {
        await deactivateDepartment(dept.id);
        addToast("Department deactivated");
        loadDepartments();
        setSelected(null);
        return;
      } catch {
        addToast("Could not deactivate", "error");
        return;
      }
    }
    setDepartments((prev) => prev.map((d) => (d.id === dept.id ? { ...d, status: "inactive" } : d)));
    setSelected(null);
    addToast("Department deactivated");
  };

  const columns = [
    { key: "code", label: "Code" },
    { key: "name", label: "Department" },
    { key: "manager_name", label: "Manager" },
    {
      key: "employee_count",
      label: "Employees",
      render: (r) => r.employee_count ?? 0,
    },
    {
      key: "machine_count",
      label: "Machines",
      render: (r) => r.machine_count ?? 0,
    },
    {
      key: "work_center_count",
      label: "Work Centers",
      render: (r) => r.work_center_count ?? 0,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusPill status={r.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (r) => (
        <TableActionButtons
          onView={() => openDepartment(r)}
          onEdit={() => setFormDept(r)}
          onDelete={r.status === "active" ? () => handleDeactivate(r) : undefined}
          showDelete={r.status === "active"}
          deleteLabel="Deactivate"
        />
      ),
    },
  ];

  if (loading) return <Loader label="Loading departments..." />;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400">Masters &gt; Departments</p>
          <p className="mt-1 text-sm text-slate-500">
            Manage all company departments and assign employees, machines, and work centers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="add" type="button" onClick={() => setFormDept({})} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
            Add Department
          </Button>
          <button type="button" onClick={handleDownloadTemplate} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Upload className="h-4 w-4" /> Import
          </button>
          <button type="button" onClick={handleExportExcel} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Download className="h-4 w-4" /> Export Excel
          </button>
          <button type="button" onClick={handleExportPdf} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <FileText className="h-4 w-4" /> Export PDF
          </button>
          <button type="button" onClick={handlePrint} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Total Departments" value={summary.total_departments} icon={Building2} color="bg-[var(--color-primary)]" />
        <SummaryCard label="Active Departments" value={summary.active_departments} icon={UserCheck} color="bg-green-500" />
        <SummaryCard label="Production Departments" value={summary.production_departments} icon={Layers} color="bg-indigo-500" />
        <SummaryCard label="Support Departments" value={summary.support_departments} icon={Building2} color="bg-amber-500" />
        <SummaryCard label="Employees" value={summary.total_employees} icon={Users} color="bg-[var(--color-success-soft)]0" />
        <SummaryCard label="Machines" value={summary.total_machines} icon={Cpu} color="bg-slate-600" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              placeholder="Search"
              value={filters.name}
              onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
              className="min-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {showAdvanced ? "Hide Filters" : "Advanced Filters"}
            </button>
          </div>
        </div>

        {showAdvanced && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <input placeholder="Department Code" value={filters.code} onChange={(e) => setFilters((f) => ({ ...f, code: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <select value={filters.department_type} onChange={(e) => setFilters((f) => ({ ...f, department_type: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Department Type</option>
              {DEPARTMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input placeholder="Manager" value={filters.manager} onChange={(e) => setFilters((f) => ({ ...f, manager: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <select value={filters.plant} onChange={(e) => setFilters((f) => ({ ...f, plant: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Plant</option>
              {PLANTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filters.branch} onChange={(e) => setFilters((f) => ({ ...f, branch: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Branch</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Status</option>
              {DEPARTMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" onClick={() => setFilters(defaultFilters)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Clear
            </button>
          </div>
        )}

        <DataTable
          columns={columns}
          data={filteredDepartments}
          onRowClick={openDepartment}
          emptyMessage="No departments found. Click Add Department to create one."
        />
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl bg-slate-50 px-4 py-3">
        {WORKFLOW_STEPS.map((step, i) => (
          <span key={step} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-[#2563EB]">{step}</span>
            {i < WORKFLOW_STEPS.length - 1 && <span className="text-slate-300">→</span>}
          </span>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-800">Reports</h3>
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPES.map((r) => (
            <button key={r} type="button" onClick={handleExportPdf} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              {r}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <DepartmentDetailModal
          department={selected}
          detail={detail}
          onClose={() => { setSelected(null); setDetail(null); }}
          onEdit={(d) => { setSelected(null); setFormDept(d); }}
          onDeactivate={handleDeactivate}
        />
      )}

      {formDept && (
        <DepartmentFormModal
          department={formDept}
          onClose={() => setFormDept(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
