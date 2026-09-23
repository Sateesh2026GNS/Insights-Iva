import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Plus, Printer, Upload, UserCheck, UsersRound, Cpu, Layers } from "lucide-react";

import DataTable from "../../components/common/DataTable";
import TableActionButtons from "../../components/common/TableActionButtons";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import PageHeader from "../../components/common/PageHeader";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { SearchBar } from "../../components/common/SearchFilter";
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

export function buildDepartmentImportTemplateCsv() {
  const header = IMPORT_TEMPLATE_HEADERS.join(",");
  return `${header}\nDEP013,IT,support,Plant 1,Hyderabad,Rajesh Kumar,+919999999999,rajesh@smrt.local,active`;
}

export function triggerDepartmentImportPicker({ addToast } = {}) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,.xlsx,.xls";
  input.style.display = "none";
  document.body.appendChild(input);

  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) {
      addToast?.("No file selected", "error");
      return;
    }

    const name = (file.name || "").toLowerCase();
    if (/\.(xlsx|xls)$/i.test(name)) {
      addToast?.("Please upload a CSV file for department import.", "warning");
      return;
    }

    addToast?.("Import file selected — the import flow will continue in the next step.", "info");
  };

  input.click();
  window.setTimeout(() => input.remove(), 0);
}

export function triggerDepartmentPrint() {
  window.print();
}

function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium leading-4 text-slate-500 break-words">{label}</p>
          <p className="mt-1 truncate text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{value}</p>
        </div>
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4 text-white" />
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

export const defaultFilters = {
  code: "",
  name: "",
  department_type: "",
  manager: "",
  plant: "",
  branch: "",
  status: "",
};

export function applyDepartmentFilters(nextFilters, currentFilters = defaultFilters) {
  return {
    ...currentFilters,
    ...nextFilters,
  };
}

export function clearDepartmentFilters(currentFilters = defaultFilters) {
  return {
    ...defaultFilters,
    ...currentFilters,
    code: "",
    name: "",
    department_type: "",
    manager: "",
    plant: "",
    branch: "",
    status: "",
  };
}

export default function DepartmentManagement() {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [apiSummary, setApiSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [formDept, setFormDept] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [draftFilters, setDraftFilters] = useState(defaultFilters);
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
    exportToPdf(filteredDepartments, exportColumns, "Departments", "departments");
    addToast("Exported to PDF");
  };

  const handlePrint = () => {
    triggerDepartmentPrint();
  };

  const printTimestamp = new Date().toLocaleString();

  const handleListExport = (format) => {
    if (format === "pdf") handleExportPdf();
    else handleExportExcel();
  };

  const handleImportFile = () => {
    triggerDepartmentImportPicker({ addToast });
  };

  const handleDownloadTemplate = () => {
    const csv = buildDepartmentImportTemplateCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "departments_import_template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
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

  const handleDeactivate = (dept) => {
    setDeactivateTarget(dept);
  };

  const handleApplyFilters = () => {
    setFilters(applyDepartmentFilters(draftFilters, filters));
    setShowAdvanced(false);
  };

  const handleClearFilters = () => {
    const cleared = clearDepartmentFilters();
    setDraftFilters(cleared);
    setFilters(cleared);
    setShowAdvanced(false);
  };

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return;
    const dept = deactivateTarget;
    setDeactivating(true);
    if (typeof dept.id === "number") {
      try {
        await deactivateDepartment(dept.id);
        addToast("Department deactivated");
        loadDepartments();
        setSelected(null);
        setDeactivateTarget(null);
        return;
      } catch {
        addToast("Could not deactivate", "error");
        return;
      } finally {
        setDeactivating(false);
      }
    }
    setDepartments((prev) => prev.map((d) => (d.id === dept.id ? { ...d, status: "inactive" } : d)));
    setSelected(null);
    addToast("Department deactivated");
    setDeactivateTarget(null);
    setDeactivating(false);
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
    <>
      <style>{`
        @media print {
          @page { margin: 0.4in; size: auto; }
          body * { visibility: hidden; }
          .department-print-region, .department-print-region * { visibility: visible; }
          .department-print-region {
            position: static;
            display: block;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            color: #111827;
            overflow: visible !important;
          }
          .no-print,
          .print-hide,
          [class*="SearchBar"],
          [class*="TableActionButtons"],
          [class*="ExportDownloadMenu"],
          [class*="Button"],
          .pagination,
          .row-actions,
          .report-block {
            display: none !important;
          }
          .ui-list-card,
          .ui-list-card__body,
          .ui-table-wrap,
          .ui-table-wrap--scroll {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            overflow-x: visible !important;
            overflow-y: visible !important;
            background: transparent !important;
          }
          ::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          .department-print-header {
            display: block !important;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 1px solid #cbd5e1 !important;
          }
          .department-print-title {
            font-size: 22px;
            font-weight: 700;
            letter-spacing: 0.01em;
            color: #111827;
          }
          .department-print-meta {
            font-size: 11px;
            color: #4b5563;
            margin-top: 4px;
          }
          table, .ui-table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: auto !important;
            font-size: 11px !important;
            margin-top: 8px !important;
            border: 1px solid #cbd5e1 !important;
          }
          th, td, .ui-table th, .ui-table td {
            border: 1px solid #cbd5e1 !important;
            padding: 8px 10px !important;
            text-align: left;
            vertical-align: middle;
            white-space: normal !important;
            word-break: normal !important;
          }
          thead th, .ui-table-head th {
            background: #f8fafc !important;
            font-weight: 700 !important;
            color: #1e293b !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    <ListPageShell>
    <div className="department-print-region space-y-6 pb-8">
      <div className="no-print">
        <PageHeader
          subtitle="Manage all company departments and assign employees, machines, and work centers."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="add" type="button" onClick={() => setFormDept({})} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                Add Department
              </Button>
              <Button variant="outline" type="button" onClick={handleImportFile} leftIcon={<Upload className="h-4 w-4" />}>
                Import
              </Button>
              <ExportDownloadMenu disabled={!filteredDepartments.length} onExport={handleListExport} />
              <Button variant="secondary" type="button" onClick={handlePrint} leftIcon={<Printer className="h-4 w-4" />}>
                Print
              </Button>
            </div>
          }
        />
      </div>

      <div className="department-print-header" style={{ display: "none" }}>
        <div>
          <div className="department-print-title">Departments</div>
          <div className="department-print-meta">Printed on {printTimestamp}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6 no-print">
        <SummaryCard label="Total Departments" value={summary.total_departments} icon={Building2} color="bg-[var(--color-primary)]" />
        <SummaryCard label="Active Departments" value={summary.active_departments} icon={UserCheck} color="bg-green-500" />
        <SummaryCard label="Production Departments" value={summary.production_departments} icon={Layers} color="bg-indigo-500" />
        <SummaryCard label="Support Departments" value={summary.support_departments} icon={Building2} color="bg-amber-500" />
        <SummaryCard label="Employees" value={summary.total_employees} icon={UsersRound} color="bg-violet-500" />
        <SummaryCard label="Machines" value={summary.total_machines} icon={Cpu} color="bg-slate-600" />
      </div>

      <ListPageCard>
        <ListPageCardBody>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex flex-wrap gap-2">
            <SearchBar
              value={filters.name}
              onChange={(v) => setFilters((f) => ({ ...f, name: v }))}
              placeholder="Search"
              className="min-w-[200px]"
            />
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setDraftFilters(filters);
                setShowAdvanced(!showAdvanced);
              }}
            >
              {showAdvanced ? "Hide Filters" : "Advanced Filters"}
            </Button>
          </div>
        </div>

        {showAdvanced && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 no-print">
            <input placeholder="Department Code" value={draftFilters.code} onChange={(e) => setDraftFilters((f) => ({ ...f, code: e.target.value }))} className="ui-input" />
            <select value={draftFilters.department_type} onChange={(e) => setDraftFilters((f) => ({ ...f, department_type: e.target.value }))} className="ui-select">
              <option value="">Department Type</option>
              {DEPARTMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input placeholder="Manager" value={draftFilters.manager} onChange={(e) => setDraftFilters((f) => ({ ...f, manager: e.target.value }))} className="ui-input" />
            <select value={draftFilters.plant} onChange={(e) => setDraftFilters((f) => ({ ...f, plant: e.target.value }))} className="ui-select">
              <option value="">Plant</option>
              {PLANTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={draftFilters.branch} onChange={(e) => setDraftFilters((f) => ({ ...f, branch: e.target.value }))} className="ui-select">
              <option value="">Branch</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={draftFilters.status} onChange={(e) => setDraftFilters((f) => ({ ...f, status: e.target.value }))} className="ui-select">
              <option value="">Status</option>
              {DEPARTMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex items-center gap-2 self-end sm:col-span-2 lg:col-span-4 xl:col-span-1">
              <Button variant="primary" type="button" onClick={handleApplyFilters}>
                Apply Filters
              </Button>
              <Button variant="secondary" type="button" onClick={handleClearFilters}>
                Clear
              </Button>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          data={filteredDepartments}
          onRowClick={openDepartment}
          emptyMessage="No departments found. Click Add Department to create one."
        />
        </ListPageCardBody>
      </ListPageCard>

      <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 no-print">
        {WORKFLOW_STEPS.map((step, i) => (
          <span key={step} className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="font-semibold text-[var(--color-primary)]">{step}</span>
            {i < WORKFLOW_STEPS.length - 1 && <span className="text-[var(--color-border)]">→</span>}
          </span>
        ))}
      </div>

      <ListPageCard className="no-print">
        <ListPageCardBody>
        <h3 className="mb-3 text-sm font-bold text-[var(--color-text)]">Reports</h3>
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPES.map((r) => (
            <Button key={r} type="button" variant="secondary" size="sm" onClick={handleExportPdf}>
              {r}
            </Button>
          ))}
        </div>
        </ListPageCardBody>
      </ListPageCard>

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

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate department"
        message={`Are you sure you want to deactivate ${deactivateTarget?.name || "this department"}?`}
        confirmLabel="Deactivate"
        loading={deactivating}
        loadingLabel="Deactivating..."
        onConfirm={handleDeactivateConfirm}
        onClose={() => {
          if (!deactivating) setDeactivateTarget(null);
        }}
      />
    </div>
    </ListPageShell>
    </>
  );
}
