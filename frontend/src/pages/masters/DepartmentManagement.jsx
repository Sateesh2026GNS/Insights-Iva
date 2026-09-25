import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  deleteDepartment,
  getDepartmentDetail,
  getDepartmentSummary,
  getDepartments,
  updateDepartment,
} from "../../api/departmentsApi";
import { getEmployees } from "../../api/hrApi";
import { getMachines } from "../../api/productionApi";
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
import { emitPageRefreshEvent } from "../../utils/pageRefresh";

export function buildDepartmentImportTemplateCsv() {
  const header = IMPORT_TEMPLATE_HEADERS.join(",");
  return `${header}\nDEP013,IT,support,Plant 1,Hyderabad,Rajesh Kumar,+919999999999,rajesh@smrt.local,active`;
}


export function triggerDepartmentImportPicker({ addToast, onImport } = {}) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv";
  input.style.display = "none";
  document.body.appendChild(input);

  input.onchange = () => {
    const file = input.files?.[0];

    if (!file) {
      addToast?.("Please upload a valid department CSV file", "warning");
      input.remove();
      return;
    }

    const name = (file.name || "").toLowerCase();

    if (!name.endsWith(".csv")) {
      addToast?.("Please upload a valid department CSV file", "warning");
      input.remove();
      return;
    }

    const reader = new FileReader();

    reader.onload = async (event) => {
      const csvText = event.target?.result;

      if (typeof csvText !== "string" || !csvText.trim()) {
        addToast?.("Please upload a valid department CSV file", "warning");
        input.remove();
        return;
      }

      const lines = csvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length <= 1) {
        addToast?.("Please upload a valid department CSV file", "warning");
        input.remove();
        return;
      }

      const firstLine = lines[0];
      const expectedHeaders = IMPORT_TEMPLATE_HEADERS.map((header) =>
        header.trim().toLowerCase()
      );
      const uploadedHeaders = firstLine
        .split(",")
        .map((header) => header.trim().toLowerCase());

      const isValidDepartmentCsv =
        uploadedHeaders.length >= expectedHeaders.length &&
        expectedHeaders.every(
          (header, index) => uploadedHeaders[index] === header
        );

      if (!isValidDepartmentCsv) {
        addToast?.("Please upload a valid department CSV file", "warning");
        input.remove();
        return;
      }

      const parsedRows = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        if (values.length >= expectedHeaders.length) {
          const rowObj = {};
          uploadedHeaders.forEach((h, idx) => {
            rowObj[h] = values[idx] || "";
          });
          parsedRows.push(rowObj);
        }
      }

      if (parsedRows.length === 0) {
        addToast?.("Please upload a valid department CSV file", "warning");
        input.remove();
        return;
      }

      if (onImport) {
        try {
          await onImport(parsedRows);
        } catch {
          /* ignore */
        }
      }

      addToast?.("Department data imported successfully", "success");
      input.remove();
    };

    reader.onerror = () => {
      addToast?.("Please upload a valid department CSV file", "warning");
      input.remove();
    };

    reader.readAsText(file);

    window.setTimeout(() => input.remove(), 0);
  };
  input.click();
}

export function triggerDepartmentPrint() {
  window.print();
}

const KPI_COLOR_THEMES = {
  "bg-[var(--color-primary)]": {
    hoverBorder: "hover:border-blue-600 hover:ring-2 hover:ring-blue-600/20",
    activeBorder: "border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/30",
  },
  "bg-primary-600": {
    hoverBorder: "hover:border-blue-600 hover:ring-2 hover:ring-blue-600/20",
    activeBorder: "border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/30",
  },
  "bg-green-500": {
    hoverBorder: "hover:border-green-500 hover:ring-2 hover:ring-green-500/20",
    activeBorder: "border-green-500 ring-2 ring-green-500/20 bg-green-50/30",
  },
  "bg-indigo-500": {
    hoverBorder: "hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/20",
    activeBorder: "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/30",
  },
  "bg-amber-500": {
    hoverBorder: "hover:border-amber-500 hover:ring-2 hover:ring-amber-500/20",
    activeBorder: "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30",
  },
  "bg-violet-500": {
    hoverBorder: "hover:border-violet-500 hover:ring-2 hover:ring-violet-500/20",
    activeBorder: "border-violet-500 ring-2 ring-violet-500/20 bg-violet-50/30",
  },
  "bg-slate-600": {
    hoverBorder: "hover:border-slate-500 hover:ring-2 hover:ring-slate-500/20",
    activeBorder: "border-slate-500 ring-2 ring-slate-500/20 bg-slate-50/30",
  },
};

function SummaryCard({ label, value, icon: Icon, color, onClick, isActive }) {
  const theme = KPI_COLOR_THEMES[color] || {
    hoverBorder: "hover:border-slate-300 hover:ring-2 hover:ring-slate-400/20",
    activeBorder: "border-slate-400 ring-2 ring-slate-400/20 bg-slate-50/30",
  };

  return (
    <div
      onClick={onClick}
      className={`group relative flex h-full flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm transition-all duration-200 ${
        isActive ? `${theme.activeBorder} shadow-sm` : "border-slate-200"
      } ${
        onClick ? `cursor-pointer ${theme.hoverBorder} hover:shadow-md hover:-translate-y-0.5` : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 min-h-[38px]">
        <p className="text-[11px] font-medium leading-tight text-slate-500 transition-colors group-hover:text-slate-700 sm:text-xs min-w-0 pr-1">
          {label}
        </p>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${color}`}>
          <Icon className="h-4.5 w-4.5 text-white" />
        </div>
      </div>
      <div className="mt-3 pt-1">
        <p className="truncate text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{value}</p>
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
  const navigate = useNavigate();
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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeCard, setActiveCard] = useState(null);
  const [globalEmployeeCount, setGlobalEmployeeCount] = useState(0);
  const [globalMachineCount, setGlobalMachineCount] = useState(0);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, sRes, eRes, mRes] = await Promise.all([
        getDepartments().catch(() => ({ data: [] })),
        getDepartmentSummary().catch(() => ({ data: null })),
        getEmployees().catch(() => ({ data: [] })),
        getMachines().catch(() => ({ data: [] })),
      ]);
      const apiRows = dRes.data || [];
      const empList = Array.isArray(eRes.data) ? eRes.data : [];
      const machList = Array.isArray(mRes.data) ? mRes.data : (mRes.data?.data || mRes.data?.machines || []);

      const enrichedDepts = apiRows.map((row, i) => {
        const enriched = enrichApiDepartment(row, i);
        const empCount = empList.filter(
          (e) => e.department_id === row.id || (e.department && row.name && e.department.toLowerCase() === row.name.toLowerCase())
        ).length;
        const machCount = machList.filter(
          (m) => m.department_id === row.id || (m.department && row.name && m.department.toLowerCase() === row.name.toLowerCase())
        ).length;
        return {
          ...enriched,
          employee_count: Math.max(enriched.employee_count || 0, empCount),
          machine_count: Math.max(enriched.machine_count || 0, machCount),
        };
      });

      setDepartments(enrichedDepts);
      setApiSummary(sRes.data);
      setGlobalEmployeeCount(empList.length);
      setGlobalMachineCount(machList.length);
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
    return computeDepartmentSummary(filteredDepartments, apiSummary, {
      employeeCount: globalEmployeeCount,
      machineCount: globalMachineCount,
    });
  }, [filteredDepartments, apiSummary, globalEmployeeCount, globalMachineCount]);

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
    addToast("Department list exported to Excel", "success");
  };

  const handleExportPdf = () => {
    exportToPdf(filteredDepartments, exportColumns, "Departments", "departments");
    addToast("Department list exported to PDF", "success");
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
    triggerDepartmentImportPicker({
      addToast,
      onImport: async (rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return;

        const newDepartments = [];
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const payload = {
            tenant_id: tenantId,
            code: r.code || `DEP${String(departments.length + i + 1).padStart(3, "0")}`,
            name: r.name || `Department ${i + 1}`,
            department_type: (r.department_type || "support").toLowerCase(),
            plant: r.plant || "Plant 1",
            branch: r.branch || "Hyderabad",
            manager_name: r.manager_name || "Manager",
            manager_mobile: r.manager_mobile || "",
            manager_email: r.manager_email || "",
            status: (r.status || "active").toLowerCase(),
            employee_count: r.employee_count ? Number(r.employee_count) : 0,
            machine_count: r.machine_count ? Number(r.machine_count) : 0,
            work_center_count: r.work_center_count ? Number(r.work_center_count) : 0,
            is_active: (r.status || "active").toLowerCase() === "active",
          };

          try {
            await createDepartment(payload);
          } catch {
            newDepartments.push(
              enrichApiDepartment(
                { id: `imported-${Date.now()}-${i}`, ...payload },
                departments.length + i
              )
            );
          }
        }

        if (newDepartments.length > 0) {
          setDepartments((prev) => [...prev, ...newDepartments]);
        }
        await loadDepartments();
      },
    });
  };

  const handleDownloadTemplate = () => {
    const csv = buildDepartmentImportTemplateCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "departments_import_template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    addToast("Upload your department data using Import", "warning");
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

  const handleActivate = async (dept) => {
    if (typeof dept.id === "number") {
      try {
        await updateDepartment(dept.id, { status: "active", is_active: true });
        addToast("Department activated");
        loadDepartments();
        return;
      } catch {
        addToast("Could not activate department", "error");
        return;
      }
    }
    setDepartments((prev) =>
      prev.map((d) => (d.id === dept.id ? { ...d, status: "active" } : d))
    );
    addToast("Department activated");
  };

  const handleDelete = (dept) => {
    setDeleteTarget(dept);
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

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const dept = deleteTarget;
    setDeleting(true);
    setApiSummary(null);
    if (typeof dept.id === "number") {
      try {
        await deleteDepartment(dept.id);
        addToast("Department deleted successfully");
        setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
        await loadDepartments();
        setSelected(null);
        setDeleteTarget(null);
        return;
      } catch {
        addToast("Could not delete department", "error");
        return;
      } finally {
        setDeleting(false);
      }
    }
    setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
    setSelected(null);
    addToast("Department deleted successfully");
    setDeleteTarget(null);
    setDeleting(false);
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
          onDeactivate={
            r.status === "active"
              ? () => handleDeactivate(r)
              : () => handleActivate(r)
          }
          deactivateLabel={r.status === "active" ? "Deactivate" : "Activate"}
          showDeactivate={true}
          onDelete={() => handleDelete(r)}
          showDelete={true}
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
              <Button variant="add" type="button" onClick={() => { emitPageRefreshEvent(); setFormDept({}); }} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                Add Department
              </Button>
              <Button variant="outline" type="button" onClick={() => { emitPageRefreshEvent(); handleImportFile(); }} leftIcon={<Upload className="h-4 w-4" />}>
                Import
              </Button>
              <ExportDownloadMenu disabled={!filteredDepartments.length} onExport={(fmt) => { emitPageRefreshEvent(); handleListExport(fmt); }} />
              <Button variant="secondary" type="button" onClick={() => { emitPageRefreshEvent(); handlePrint(); }} leftIcon={<Printer className="h-4 w-4" />}>
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
        <SummaryCard
          label="Total Departments"
          value={summary.total_departments}
          icon={Building2}
          color="bg-[var(--color-primary)]"
          onClick={() => {
            emitPageRefreshEvent();
            const cleared = clearDepartmentFilters();
            setFilters(cleared);
            setDraftFilters(cleared);
            setActiveCard((prev) => (prev === "total" ? null : "total"));
          }}
          isActive={activeCard === "total"}
        />
        <SummaryCard
          label="Active Departments"
          value={summary.active_departments}
          icon={UserCheck}
          color="bg-green-500"
          onClick={() => {
            emitPageRefreshEvent();
            const nextStatus = filters.status === "active" ? "" : "active";
            setFilters((f) => ({ ...f, status: nextStatus, department_type: "" }));
            setDraftFilters((f) => ({ ...f, status: nextStatus, department_type: "" }));
            setActiveCard((prev) => (prev === "active" ? null : "active"));
          }}
          isActive={activeCard === "active"}
        />
        <SummaryCard
          label="Production Departments"
          value={summary.production_departments}
          icon={Layers}
          color="bg-indigo-500"
          onClick={() => {
            emitPageRefreshEvent();
            const nextType = filters.department_type === "production" ? "" : "production";
            setFilters((f) => ({ ...f, department_type: nextType }));
            setDraftFilters((f) => ({ ...f, department_type: nextType }));
            setActiveCard((prev) => (prev === "production" ? null : "production"));
          }}
          isActive={activeCard === "production"}
        />
        <SummaryCard
          label="Support Departments"
          value={summary.support_departments}
          icon={Building2}
          color="bg-amber-500"
          onClick={() => {
            emitPageRefreshEvent();
            const nextType = filters.department_type === "support" ? "" : "support";
            setFilters((f) => ({ ...f, department_type: nextType }));
            setDraftFilters((f) => ({ ...f, department_type: nextType }));
            setActiveCard((prev) => (prev === "support" ? null : "support"));
          }}
          isActive={activeCard === "support"}
        />
        <SummaryCard
          label="Employees"
          value={summary.total_employees}
          icon={UsersRound}
          color="bg-violet-500"
          onClick={() => {
            emitPageRefreshEvent();
            setActiveCard("employees");
            navigate("/hr/employees");
          }}
          isActive={activeCard === "employees"}
        />
        <SummaryCard
          label="Machines"
          value={summary.total_machines}
          icon={Cpu}
          color="bg-slate-600"
          onClick={() => {
            emitPageRefreshEvent();
            setActiveCard("machines");
            navigate("/production/machines");
          }}
          isActive={activeCard === "machines"}
        />
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
          onDeactivate={(d) => {
            setSelected(null);
            if (d.status === "active") handleDeactivate(d);
            else handleActivate(d);
          }}
          onDelete={(d) => {
            setSelected(null);
            handleDelete(d);
          }}
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete department"
        message={`Are you sure you want to delete ${deleteTarget?.name || "this department"}? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        loadingLabel="Deleting..."
        onConfirm={handleDeleteConfirm}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
    </ListPageShell>
    </>
  );
}
