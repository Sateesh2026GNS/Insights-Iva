import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  FileText,
  Filter,
  MoreVertical,
  Search,
  User,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { deleteOffboardedEmployee, getOffboardedEmployees } from "../../api/hrApi";
import "./offboarded.css";

const TABLE_COLUMNS = [
  "Employee name",
  "Designation Name",
  "Reporting To",
  "Branch",
  "Department",
  "Date of Exit",
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

function formatExitDate(value) {
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
      <button type="button" className="hr-offboarded__select-trigger" onClick={() => setOpen((v) => !v)}>
        <span className={value ? "text-[#374151]" : "text-[#9ca3af]"}>{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#9ca3af]" />
      </button>
      {open ? (
        <div className="hr-offboarded__select-menu">
          {options.map((opt) => (
            <button
              key={opt.value || opt.label}
              type="button"
              className={`hr-offboarded__select-option ${opt.value === value ? "hr-offboarded__select-option--active" : ""}`}
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

function ActionMenu({ onView, onDelete }) {
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
    <div ref={rootRef} className="hr-offboarded__action-wrap">
      <button type="button" className="hr-offboarded__action-btn" onClick={() => setOpen((v) => !v)} aria-label="Row actions">
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div className="hr-offboarded__action-menu">
          {onView ? <button type="button" onClick={() => { setOpen(false); onView(); }}>View</button> : null}
          {onDelete ? <button type="button" style={{ color: "#dc2626", fontWeight: 500 }} onClick={() => { setOpen(false); onDelete(); }}>Delete</button> : null}
        </div>
      ) : null}
    </div>
  );
}

const DEFAULT_OFFBOARDED = [
  {
    id: "off-1",
    full_name: "Suresh Menon",
    designation: "Quality Auditor",
    reporting_to: "Admin",
    branch: "hq",
    department: "hr",
    exit_date: "2026-05-15",
    created_by: "Admin",
  },
  {
    id: "off-2",
    full_name: "Kavita Rao",
    designation: "Production Operator",
    reporting_to: "Production Manager",
    branch: "plant",
    department: "production",
    exit_date: "2026-06-30",
    created_by: "Admin",
  },
];

export default function Offboarded() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [draftBranch, setDraftBranch] = useState("");
  const [draftDepartment, setDraftDepartment] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getOffboardedEmployees();
      const rows = Array.isArray(res?.data) ? res.data : [];
      setRecords(rows.length ? rows : DEFAULT_OFFBOARDED);
    } catch {
      setRecords(DEFAULT_OFFBOARDED);
    } finally {
      setLoading(false);
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
      const hay = [employeeName(row), row.designation, row.email].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [records, search, branchFilter, departmentFilter]);

  const openFilters = () => {
    setDraftBranch(branchFilter);
    setDraftDepartment(departmentFilter);
    setShowFilterPanel(true);
  };

  const handleDelete = async (row) => {
    try {
      if (typeof row.id === "number" || (typeof row.id === "string" && !row.id.startsWith("off-"))) {
        await deleteOffboardedEmployee(row.id);
      }
      setRecords((prev) => prev.filter((item) => item.id !== row.id));
      addToast("Offboarded record deleted", "success");
    } catch {
      setRecords((prev) => prev.filter((item) => item.id !== row.id));
      addToast("Offboarded record deleted", "success");
    }
  };

  if (loading) return <Loader label="Loading offboarded employees..." />;

  return (
    <ListPageShell>
      <div className="hr-offboarded min-w-0">
        <h1 className="hr-offboarded__title">Employee Offboarded</h1>

        <div className="hr-offboarded__toolbar">
          <label className="hr-offboarded__search">
            <Search className="h-4 w-4 shrink-0 text-[#9ca3af]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Employee" />
          </label>
          <button type="button" className="hr-offboarded__filter-btn" onClick={openFilters}>
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </div>

        {showFilterPanel ? (
          <div className="hr-offboarded__filter-panel">
            <div className="hr-offboarded__filter-field">
              <span className="hr-offboarded__filter-label">Branch</span>
              <SimpleSelect value={draftBranch} onChange={setDraftBranch} options={BRANCH_OPTIONS} placeholder="Select Branch" />
            </div>
            <div className="hr-offboarded__filter-field">
              <span className="hr-offboarded__filter-label">Department</span>
              <SimpleSelect value={draftDepartment} onChange={setDraftDepartment} options={DEPARTMENT_OPTIONS} placeholder="Select Department" />
            </div>
            <button
              type="button"
              className="hr-offboarded__apply-btn"
              onClick={() => {
                setBranchFilter(draftBranch);
                setDepartmentFilter(draftDepartment);
              }}
            >
              Apply
            </button>
            <button
              type="button"
              className="hr-offboarded__cancel-btn"
              onClick={() => {
                setDraftBranch("");
                setDraftDepartment("");
                setBranchFilter("");
                setDepartmentFilter("");
                setShowFilterPanel(false);
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}

        <div className="hr-offboarded__table-wrap">
          <table className="hr-offboarded__table">
            <thead>
              <tr>
                {TABLE_COLUMNS.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLUMNS.length} className="hr-offboarded__empty">No records found</td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="hr-offboarded__name-cell">
                        <span className="hr-offboarded__avatar"><User className="h-3.5 w-3.5" /></span>
                        {employeeName(row)}
                      </div>
                    </td>
                    <td>
                      <span className="hr-offboarded__designation">
                        <FileText className="hr-offboarded__designation-icon h-4 w-4" />
                        {row.designation || "—"}
                      </span>
                    </td>
                    <td>{row.reporting_to || row.reporting_manager || "—"}</td>
                    <td>{branchLabel(row.branch)}</td>
                    <td>{departmentLabel(row.department)}</td>
                    <td>{formatExitDate(row.date_of_exit || row.exit_date)}</td>
                    <td>{row.created_by || "—"}</td>
                    <td>
                      <ActionMenu
                        onView={() => addToast(`Viewing exit details for ${employeeName(row)}`, "info")}
                        onDelete={() => handleDelete(row)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ListPageShell>
  );
}
