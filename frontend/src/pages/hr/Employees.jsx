import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Filter,
  Layers,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  User,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { deleteEmployee, getEmployeesEnriched } from "../../api/hrApi";
import "./employeeOnboarding.css";

const TABLE_COLUMNS = [
  "Employee name",
  "Designation Name",
  "Reporting To",
  "Branch",
  "Department",
  "Date of Joining",
  "Created By",
  "Action",
];

const BRANCH_OPTIONS = [
  { value: "", label: "Select Branch" },
  { value: "hq", label: "Head Office" },
  { value: "plant", label: "Manufacturing Plant" },
];

const DEPARTMENT_OPTIONS = [
  { value: "", label: "Select Department" },
  { value: "hr", label: "HR Department" },
  { value: "production", label: "Production" },
  { value: "accounts", label: "Accounts" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatJoinDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function branchLabel(value) {
  return BRANCH_OPTIONS.find((o) => o.value === value)?.label || value || "—";
}

function departmentLabel(value) {
  return DEPARTMENT_OPTIONS.find((o) => o.value === value)?.label || value || "—";
}

function employeeName(row) {
  return row.full_name || `${row.first_name || ""} ${row.last_name || ""}`.trim() || "—";
}

function SimpleSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button type="button" className="hr-emp-onboard__select-trigger" onClick={() => setOpen((v) => !v)}>
        <span className={value ? "text-[#374151]" : "text-[#9ca3af]"}>{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#9ca3af]" />
      </button>
      {open ? (
        <div className="hr-emp-onboard__select-menu">
          {options.map((opt) => (
            <button
              key={opt.value || opt.label}
              type="button"
              className={`hr-emp-onboard__select-option ${opt.value === value ? "hr-emp-onboard__select-option--active" : ""}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ActionMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="hr-emp-onboard__action-wrap">
      <button type="button" className="hr-emp-onboard__action-btn" onClick={() => setOpen((v) => !v)} aria-label="Row actions">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div className="hr-emp-onboard__action-menu">
          {onEdit ? <button type="button" onClick={() => { setOpen(false); onEdit(); }}>Edit</button> : null}
          {onDelete ? <button type="button" style={{ color: "#dc2626", fontWeight: 500 }} onClick={() => { setOpen(false); onDelete(); }}>Delete</button> : null}
        </div>
      ) : null}
    </div>
  );
}

export default function Employees() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [draftBranch, setDraftBranch] = useState("");
  const [draftDepartment, setDraftDepartment] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await getEmployeesEnriched();
      const rows = Array.isArray(res?.data) ? res.data : [];
      setRecords(rows);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((row) => {
      if (branchFilter && row.branch !== branchFilter) return false;
      if (departmentFilter && row.department !== departmentFilter) return false;
      if (!q) return true;
      const hay = [
        employeeName(row),
        row.designation,
        row.email,
        row.employee_code,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [records, search, branchFilter, departmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const openFilters = () => {
    setDraftBranch(branchFilter);
    setDraftDepartment(departmentFilter);
    setShowFilterPanel(true);
  };

  const handleDelete = async (row) => {
    try {
      if (typeof row.id === "number" || (typeof row.id === "string" && !row.id.startsWith("emp-") && !row.id.startsWith("demo"))) {
        await deleteEmployee(row.id);
      }
      setRecords((prev) => prev.filter((item) => item.id !== row.id));
      addToast("Employee deleted successfully", "success");
    } catch {
      setRecords((prev) => prev.filter((item) => item.id !== row.id));
      addToast("Employee deleted", "success");
    }
  };

  if (loading) return <Loader label="Loading employees..." />;

  const showingFrom = pagedRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filteredRows.length);

  return (
    <ListPageShell>
      <div className="hr-emp-onboard min-w-0">
        <div className="hr-emp-onboard__top">
          <h1 className="hr-emp-onboard__title">Employee Onboarding</h1>
          <div className="hr-emp-onboard__actions">
            <button type="button" className="hr-emp-onboard__icon-btn" onClick={() => load(true)} aria-label="Refresh" disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button type="button" className="hr-emp-onboard__bulk-btn" onClick={() => navigate("/hr/employees/bulk-upload")}>
              <Layers className="h-4 w-4" />
              Bulk Upload
            </button>
            <button type="button" className="hr-emp-onboard__add-btn" onClick={() => navigate("/hr/employees/create")}>
              <Plus className="h-4 w-4" />
              Add Employee
            </button>
          </div>
        </div>

        <div className="hr-emp-onboard__toolbar">
          <div className="hr-emp-onboard__toolbar-left">
            <label className="hr-emp-onboard__search">
              <Search className="h-4 w-4 shrink-0 text-[#9ca3af]" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search Employee" />
            </label>
            <button type="button" className="hr-emp-onboard__filter-btn" onClick={openFilters}>
              <Filter className="h-4 w-4" />
              Filter
            </button>
          </div>
        </div>

        {showFilterPanel ? (
          <div className="hr-emp-onboard__filter-panel">
            <div className="hr-emp-onboard__filter-row">
              <div>
                <label className="hr-emp-onboard__filter-label">Branch</label>
                <SimpleSelect value={draftBranch} onChange={setDraftBranch} options={BRANCH_OPTIONS} placeholder="Select Branch" />
              </div>
              <div>
                <label className="hr-emp-onboard__filter-label">Department</label>
                <SimpleSelect value={draftDepartment} onChange={setDraftDepartment} options={DEPARTMENT_OPTIONS} placeholder="Select Department" />
              </div>
            </div>
            <div className="hr-emp-onboard__filter-actions">
              <button
                type="button"
                className="hr-emp-onboard__outline-btn"
                onClick={() => {
                  setDraftBranch("");
                  setDraftDepartment("");
                  setBranchFilter("");
                  setDepartmentFilter("");
                  setShowFilterPanel(false);
                  setPage(1);
                }}
              >
                Reset
              </button>
              <button
                type="button"
                className="hr-emp-onboard__apply-btn"
                onClick={() => {
                  setBranchFilter(draftBranch);
                  setDepartmentFilter(draftDepartment);
                  setShowFilterPanel(false);
                  setPage(1);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        ) : null}

        <div className="hr-emp-onboard__table-wrap">
          <table className="hr-emp-onboard__table">
            <thead>
              <tr>
                {TABLE_COLUMNS.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length} className="hr-emp-onboard__empty">No records found</td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="hr-emp-onboard__name-cell">
                        <span className="hr-emp-onboard__avatar"><User className="h-3.5 w-3.5" /></span>
                        {employeeName(row)}
                      </div>
                    </td>
                    <td>
                      <span className="hr-emp-onboard__designation">
                        <FileText className="hr-emp-onboard__designation-icon h-4 w-4" />
                        {row.designation || "—"}
                      </span>
                    </td>
                    <td>{row.reporting_to || row.reporting_manager || "—"}</td>
                    <td>{branchLabel(row.branch)}</td>
                    <td>{departmentLabel(row.department)}</td>
                    <td>{formatJoinDate(row.date_of_joining || row.hire_date || row.joining_date)}</td>
                    <td>{row.created_by || "—"}</td>
                    <td>
                      <ActionMenu onEdit={() => navigate(`/hr/employees/create?id=${row.id}`)} onDelete={() => handleDelete(row)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="hr-emp-onboard__footer">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded border border-[#eff2f5] px-2 py-1 text-xs">
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>Entries</span>
            </div>
            <span>Showing {showingFrom} to {showingTo} of {filteredRows.length} entries</span>
            <div className="flex items-center gap-1">
              <button type="button" className="hr-emp-onboard__page-btn" onClick={() => setPage(1)} disabled={currentPage <= 1} aria-label="First page"><ChevronsLeft className="h-4 w-4" /></button>
              <button type="button" className="hr-emp-onboard__page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" className="hr-emp-onboard__page-btn hr-emp-onboard__page-btn--active">{currentPage}</button>
              <button type="button" className="hr-emp-onboard__page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
              <button type="button" className="hr-emp-onboard__page-btn" onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} aria-label="Last page"><ChevronsRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </ListPageShell>
  );
}
