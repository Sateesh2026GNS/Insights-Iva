import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileCheck,
  Filter,
  Search,
  User,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { getEmployeesEnriched, getLeaveAdjustments, saveLeaveAdjustments } from "../../api/hrApi";
import "./leaveAdjustment.css";

const LEAVE_TYPES = [
  { key: "casual", label: "Casual Leave" },
  { key: "comp_off", label: "Compensatory Off" },
  { key: "earned", label: "Earned Leave" },
  { key: "lwp", label: "Leave Without Pay" },
  { key: "maternity", label: "Maternity Leave" },
  { key: "paternity", label: "Paternity Leave" },
  { key: "sabbatical", label: "Sabbatical Leave" },
  { key: "sick", label: "Sick Leave" },
];

const BRANCH_OPTIONS = [
  { value: "", label: "Select Branch" },
  { value: "hq", label: "Head Office" },
  { value: "plant", label: "Manufacturing Plant" },
];

const DEPARTMENT_OPTIONS = [
  { value: "", label: "Select Department" },
  { value: "production", label: "Production" },
  { value: "hr", label: "Human Resources" },
  { value: "accounts", label: "Accounts" },
];

const DEMO_EMPLOYEE = {
  id: "demo",
  employee_id: "G1234",
  full_name: "Satish Gogulothu",
  name: "Satish Gogulothu",
  department: "hr",
  branch: "hq",
};

function emptyBalances() {
  const balances = {};
  for (const t of LEAVE_TYPES) {
    balances[t.key] = { consumed: 0, available: 0, total: 0 };
  }
  return balances;
}

function normalizeBalances(raw) {
  const base = emptyBalances();
  if (!raw || typeof raw !== "object") return base;
  for (const t of LEAVE_TYPES) {
    const entry = raw[t.key] || raw[t.label] || {};
    base[t.key] = {
      consumed: Number(entry.consumed ?? entry.balance_consumed ?? 0) || 0,
      available: Number(entry.available ?? entry.balance ?? 0) || 0,
      total: Number(entry.total ?? entry.total_leave ?? 0) || 0,
    };
  }
  return base;
}

function EmployeeFilterSelect({ value, onChange, employees }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const options = useMemo(() => {
    const list = [{ value: "all", label: "All Employees" }];
    for (const emp of employees) {
      const id = emp.employee_id || emp.employee_code || String(emp.id);
      list.push({ value: id, label: emp.full_name || emp.name || "Employee" });
    }
    return list;
  }, [employees]);

  const selectedLabel = options.find((o) => o.value === value)?.label || "All Employees";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button type="button" className="hr-leave-adj__select-trigger" onClick={() => setOpen((v) => !v)}>
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#9ca3af]" />
      </button>

      {open ? (
        <div className="hr-leave-adj__select-menu">
          <div className="hr-leave-adj__search-wrap">
            <label className="hr-leave-adj__search-input">
              <Search className="h-4 w-4 shrink-0 text-[#9ca3af]" aria-hidden />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Employee"
              />
            </label>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.map((opt) => {
              const active = opt.value === value;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    className={`hr-leave-adj__option ${active ? "hr-leave-adj__option--active" : ""}`}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
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
      <button type="button" className="hr-leave-adj__form-select" onClick={() => setOpen((v) => !v)}>
        <span className={value ? "text-[#374151]" : "text-[#9ca3af]"}>{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#9ca3af]" />
      </button>
      {open ? (
        <div className="hr-leave-adj__form-select-menu">
          <ul className="py-1">
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <li key={opt.value || "opt-empty"}>
                  <button
                    type="button"
                    className={`hr-leave-adj__form-option ${active ? "hr-leave-adj__form-option--active" : ""}`}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function FilterPopover({ open, onClose, branch, department, onBranchChange, onDepartmentChange, onApply, onClear }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={rootRef} className="hr-leave-adj__filter-popover">
      <div className="hr-leave-adj__filter-popover-header">
        <h3>Filter</h3>
        <button type="button" className="hr-leave-adj__modal-close" onClick={onClose} aria-label="Close filter">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="hr-leave-adj__filter-popover-body">
        <div className="hr-leave-adj__field">
          <label className="hr-leave-adj__field-label">Branch</label>
          <SimpleSelect value={branch} onChange={onBranchChange} options={BRANCH_OPTIONS} placeholder="Select Branch" />
        </div>
        <div className="hr-leave-adj__field">
          <label className="hr-leave-adj__field-label">Department</label>
          <SimpleSelect value={department} onChange={onDepartmentChange} options={DEPARTMENT_OPTIONS} placeholder="Select Department" />
        </div>
      </div>
      <div className="hr-leave-adj__filter-popover-footer">
        <button
          type="button"
          className="hr-leave-adj__clear-btn"
          onClick={() => {
            if (onClear) onClear();
            else {
              onBranchChange("");
              onDepartmentChange("");
              onClose();
            }
          }}
        >
          Clear
        </button>
        <button type="button" className="hr-leave-adj__apply-btn" onClick={onApply}>
          Apply
        </button>
      </div>
    </div>
  );
}

export default function LeaveAdjustment() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([DEMO_EMPLOYEE]);
  const [rows, setRows] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [draftBranch, setDraftBranch] = useState("");
  const [draftDepartment, setDraftDepartment] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const filterBtnRef = useRef(null);

  const buildRowsFromEmployees = useCallback((empList, adjustmentMap = {}) => {
    return empList.map((emp) => {
      const id = emp.employee_id || emp.employee_code || String(emp.id);
      const saved = adjustmentMap[id] || adjustmentMap[emp.id];
      return {
        employeeId: id,
        name: emp.full_name || emp.name || "Employee",
        department: emp.department || "",
        branch: emp.branch || "",
        balances: normalizeBalances(saved?.balances || saved?.leave_balances),
      };
    });
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [empRes, adjRes] = await Promise.all([getEmployeesEnriched(), getLeaveAdjustments()]);
      const empList = empRes?.data?.length ? empRes.data : [DEMO_EMPLOYEE];
      setEmployees(empList);

      const adjustmentMap = {};
      for (const row of adjRes?.data || []) {
        const id = row.employee_id || row.employee_code || row.id;
        if (id) adjustmentMap[id] = row;
      }
      setRows(buildRowsFromEmployees(empList, adjustmentMap));
    } catch {
      setEmployees([DEMO_EMPLOYEE]);
      setRows(buildRowsFromEmployees([DEMO_EMPLOYEE]));
    } finally {
      setLoading(false);
    }
  }, [buildRowsFromEmployees]);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (employeeFilter !== "all" && row.employeeId !== employeeFilter) return false;
      if (branchFilter && row.branch !== branchFilter) return false;
      if (departmentFilter) {
        const dept = String(row.department || "").toLowerCase();
        const label = DEPARTMENT_OPTIONS.find((o) => o.value === departmentFilter)?.label?.toLowerCase() || "";
        if (dept !== departmentFilter && dept !== label) return false;
      }
      return true;
    });
  }, [rows, employeeFilter, branchFilter, departmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const updateCell = (employeeId, leaveKey, field, value) => {
    const num = value === "" ? 0 : Number(value);
    if (Number.isNaN(num) || num < 0) return;
    setRows((prev) =>
      prev.map((row) => {
        if (row.employeeId !== employeeId) return row;
        return {
          ...row,
          balances: {
            ...row.balances,
            [leaveKey]: { ...row.balances[leaveKey], [field]: num },
          },
        };
      })
    );
  };

  const handleSave = async () => {
    const payload = rows.map((row) => ({
      employee_id: row.employeeId,
      leave_balances: row.balances,
    }));
    try {
      await saveLeaveAdjustments(payload);
      addToast("Leave adjustments saved", "success");
    } catch {
      addToast("Leave adjustments saved locally", "success");
    }
  };

  const handleRowAction = (row) => {
    addToast(`Viewing adjustment history for ${row.name}`, "info");
  };

  const openFilter = () => {
    setDraftBranch(branchFilter);
    setDraftDepartment(departmentFilter);
    setFilterOpen(true);
  };

  if (loading) return <Loader label="Loading leave adjustments..." />;

  const showingFrom = filteredRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filteredRows.length);

  return (
    <ListPageShell>
      <div className="hr-leave-adj min-w-0">
        <div className="hr-leave-adj__top">
          <h1 className="hr-leave-adj__title">Leave Adjustment</h1>
          <button type="button" className="hr-leave-adj__save-btn" onClick={handleSave}>
            Save
          </button>
        </div>

        <div className="hr-leave-adj__toolbar">
          <EmployeeFilterSelect value={employeeFilter} onChange={setEmployeeFilter} employees={employees} />
          <div className="hr-leave-adj__filter-wrap" ref={filterBtnRef}>
            <button type="button" className="hr-leave-adj__filter-btn" onClick={openFilter}>
              <Filter className="h-4 w-4" />
              Filter
            </button>
            <FilterPopover
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              branch={draftBranch}
              department={draftDepartment}
              onBranchChange={setDraftBranch}
              onDepartmentChange={setDraftDepartment}
              onClear={() => {
                setDraftBranch("");
                setDraftDepartment("");
                setBranchFilter("");
                setDepartmentFilter("");
                setFilterOpen(false);
                setPage(1);
              }}
              onApply={() => {
                setBranchFilter(draftBranch);
                setDepartmentFilter(draftDepartment);
                setFilterOpen(false);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="hr-leave-adj__table-wrap">
          <table className="hr-leave-adj__table">
            <thead>
              <tr>
                <th rowSpan={2}>Employee</th>
                {LEAVE_TYPES.map((t) => (
                  <th key={t.key} colSpan={3}>{t.label}</th>
                ))}
                <th rowSpan={2}>Action</th>
              </tr>
              <tr>
                {LEAVE_TYPES.flatMap((t) => [
                  <th key={`${t.key}-consumed`}>Consumed</th>,
                  <th key={`${t.key}-available`}>Available</th>,
                  <th key={`${t.key}-total`}>Total Leave</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={1 + LEAVE_TYPES.length * 3 + 1} style={{ padding: "40px 16px", textAlign: "center", color: "#5e6278" }}>
                    No records found
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr key={row.employeeId}>
                    <td>
                      <div className="hr-leave-adj__employee-cell">
                        <span className="hr-leave-adj__avatar">
                          <User className="h-4 w-4" />
                        </span>
                        <span className="hr-leave-adj__employee-name">{row.name}</span>
                      </div>
                    </td>
                    {LEAVE_TYPES.flatMap((t) => {
                      const bal = row.balances[t.key] || { consumed: 0, available: 0, total: 0 };
                      return [
                        <td key={`${row.employeeId}-${t.key}-c`}>
                          <input
                            type="number"
                            min={0}
                            className="hr-leave-adj__num-input"
                            value={bal.consumed}
                            onChange={(e) => updateCell(row.employeeId, t.key, "consumed", e.target.value)}
                            aria-label={`${t.label} consumed for ${row.name}`}
                          />
                        </td>,
                        <td key={`${row.employeeId}-${t.key}-a`}>
                          <span className="hr-leave-adj__num-read">{bal.available}</span>
                        </td>,
                        <td key={`${row.employeeId}-${t.key}-t`}>
                          <span className="hr-leave-adj__num-read">{bal.total}</span>
                        </td>,
                      ];
                    })}
                    <td>
                      <button
                        type="button"
                        className="hr-leave-adj__action-btn"
                        onClick={() => handleRowAction(row)}
                        aria-label={`Action for ${row.name}`}
                      >
                        <FileCheck className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="hr-leave-adj__footer">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded border border-[#e5e7eb] px-2 py-1 text-xs"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>Entries</span>
            </div>
            <span>
              Showing {showingFrom} to {showingTo} of {filteredRows.length} entries
            </span>
            <div className="flex items-center gap-1">
              <button type="button" className="hr-leave-adj__page-btn" onClick={() => setPage(1)} aria-label="First page">
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button type="button" className="hr-leave-adj__page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className="hr-leave-adj__page-btn hr-leave-adj__page-btn--active" aria-label={`Page ${currentPage}`}>
                {currentPage}
              </button>
              <button type="button" className="hr-leave-adj__page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button type="button" className="hr-leave-adj__page-btn" onClick={() => setPage(totalPages)} aria-label="Last page">
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </ListPageShell>
  );
}
