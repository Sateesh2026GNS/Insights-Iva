import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  MoreVertical,
  Plus,
  Search,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import {
  approveExpenseClaims,
  createExpenseApproval,
  getExpenseApprovals,
} from "../../api/hrApi";
import "./expenseApprovals.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DEMO_EMPLOYEES = [
  { value: "all", label: "All Employees" },
  { value: "demo-satish", label: "Satish Gogulothu", branch: "hq", department: "hr" },
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

const CATEGORY_OPTIONS = [
  { value: "", label: "Select Expense Category" },
  { value: "travel", label: "Travel" },
  { value: "food", label: "Food" },
  { value: "accommodation", label: "Accommodation" },
  { value: "supplies", label: "Office Supplies" },
  { value: "other", label: "Other" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Select Status" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

function formatDisplayDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function formatAmount(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `₹ ${n.toLocaleString("en-IN")}`;
}

function categoryLabel(value) {
  return CATEGORY_OPTIONS.find((o) => o.value === value)?.label || value || "—";
}

function branchLabel(value) {
  return BRANCH_OPTIONS.find((o) => o.value === value)?.label || value || "—";
}

function departmentLabel(value) {
  return DEPARTMENT_OPTIONS.find((o) => o.value === value)?.label || value || "—";
}

function StatusBadge({ status }) {
  const key = String(status || "pending").toLowerCase();
  return <span className={`hr-exp-approvals__status hr-exp-approvals__status--${key}`}>{status || "Pending"}</span>;
}

function EmployeeSelect({ value, onChange, employees }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const selected = employees.find((e) => e.value === value) || employees[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = employees.filter((e) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return e.label.toLowerCase().includes(q);
  });

  return (
    <div ref={rootRef} className="hr-exp-approvals__employee-select">
      <button type="button" className="hr-exp-approvals__select-trigger" onClick={() => setOpen((v) => !v)}>
        <span>{selected?.label || "All Employees"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#9ca3af]" />
      </button>
      {open ? (
        <div className="hr-exp-approvals__select-menu">
          <div className="hr-exp-approvals__select-search">
            <Search className="h-4 w-4 shrink-0 text-[#9ca3af]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Employee" />
          </div>
          {filtered.map((emp) => (
            <button
              key={emp.value}
              type="button"
              className={`hr-exp-approvals__select-option ${emp.value === value ? "hr-exp-approvals__select-option--active" : ""}`}
              onClick={() => { onChange(emp.value); setOpen(false); setQuery(""); }}
            >
              {emp.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FilterPopover({
  open,
  onClose,
  category,
  status,
  branch,
  department,
  onCategoryChange,
  onStatusChange,
  onBranchChange,
  onDepartmentChange,
  onApply,
  onClear,
}) {
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
    <div ref={rootRef} className="hr-exp-approvals__filter-popover">
      <div className="hr-exp-approvals__filter-popover-header">
        <h3>Filter</h3>
        <button type="button" className="hr-exp-approvals__modal-close" onClick={onClose} aria-label="Close filter">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="hr-exp-approvals__filter-popover-body">
        <div className="hr-exp-approvals__field">
          <label className="hr-exp-approvals__field-label">Expense Category</label>
          <select className="hr-exp-approvals__field-select" value={category} onChange={(e) => onCategoryChange(e.target.value)}>
            {CATEGORY_OPTIONS.map((o) => <option key={o.value || o.label} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="hr-exp-approvals__field">
          <label className="hr-exp-approvals__field-label">Status</label>
          <select className="hr-exp-approvals__field-select" value={status} onChange={(e) => onStatusChange(e.target.value)}>
            {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value || o.label} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="hr-exp-approvals__field">
          <label className="hr-exp-approvals__field-label">Branch</label>
          <select className="hr-exp-approvals__field-select" value={branch} onChange={(e) => onBranchChange(e.target.value)}>
            {BRANCH_OPTIONS.map((o) => <option key={o.value || o.label} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="hr-exp-approvals__field">
          <label className="hr-exp-approvals__field-label">Department</label>
          <select className="hr-exp-approvals__field-select" value={department} onChange={(e) => onDepartmentChange(e.target.value)}>
            {DEPARTMENT_OPTIONS.map((o) => <option key={o.value || o.label} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div className="hr-exp-approvals__filter-popover-footer">
        <button
          type="button"
          className="hr-exp-approvals__clear-btn"
          onClick={() => {
            if (onClear) onClear();
            else {
              onCategoryChange("");
              onStatusChange("");
              onBranchChange("");
              onDepartmentChange("");
              onClose();
            }
          }}
        >
          Clear
        </button>
        <button type="button" className="hr-exp-approvals__apply-btn" onClick={onApply}>Apply</button>
      </div>
    </div>
  );
}

function AddExpenseDrawer({ open, onClose, onSave, employees }) {
  const [employeeId, setEmployeeId] = useState("demo-satish");
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setEmployeeId("demo-satish");
    setCategory("");
    setName("");
    setExpenseDate("");
    setAmount("");
    setDetails("");
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const empOptions = employees.filter((e) => e.value !== "all");

  const drawer = (
    <div className="hr-exp-approvals__overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="hr-exp-approvals__drawer" onClick={(e) => e.stopPropagation()}>
        <div className="hr-exp-approvals__drawer-header">
          <svg className="hr-exp-approvals__drawer-waves" viewBox="0 0 120 48" fill="none" aria-hidden>
            <path d="M0 32C20 20 40 44 60 28C80 12 100 36 120 24V48H0V32Z" fill="rgba(255,255,255,0.6)" />
            <path d="M0 24C18 14 36 34 54 22C72 10 96 30 120 18V48H0V24Z" fill="rgba(255,255,255,0.35)" />
          </svg>
          <button type="button" className="hr-exp-approvals__drawer-close" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="hr-exp-approvals__drawer-body">
          <h2 className="hr-exp-approvals__drawer-title">Add Expense</h2>

          <div className="hr-exp-approvals__form-field">
            <label className="hr-exp-approvals__form-label">Employee</label>
            <select className="hr-exp-approvals__select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {empOptions.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>

          <div className="hr-exp-approvals__form-field">
            <label className="hr-exp-approvals__form-label">Expense Category <span>*</span></label>
            <select className="hr-exp-approvals__select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((o) => <option key={o.value || o.label} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="hr-exp-approvals__form-field">
            <label className="hr-exp-approvals__form-label">Expense Name <span>*</span></label>
            <input className="hr-exp-approvals__input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter Expense Name" />
          </div>

          <div className="hr-exp-approvals__form-field">
            <label className="hr-exp-approvals__form-label">Expense Date <span>*</span></label>
            <div className="hr-exp-approvals__date-wrap">
              <span className={expenseDate ? "" : "is-placeholder"}>{expenseDate ? formatDisplayDate(expenseDate) : "dd-mmm-yyyy"}</span>
              <CalendarDays className="h-4 w-4 shrink-0 text-[#9ca3af]" />
              <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
          </div>

          <div className="hr-exp-approvals__form-field">
            <label className="hr-exp-approvals__form-label">Amount <span>*</span></label>
            <div className="hr-exp-approvals__amount-wrap">
              <span className="hr-exp-approvals__amount-prefix">₹</span>
              <input className="hr-exp-approvals__input" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter Amount" />
            </div>
          </div>

          <div className="hr-exp-approvals__form-field">
            <label className="hr-exp-approvals__form-label">Details <span>*</span></label>
            <textarea className="hr-exp-approvals__textarea" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Enter Detail" />
          </div>

          <div className="hr-exp-approvals__form-field">
            <label className="hr-exp-approvals__form-label">Attachment</label>
            <p className="hr-exp-approvals__upload-hint">Maximum file size: 10MB.</p>
            <div className="hr-exp-approvals__upload-zone">
              <button type="button" className="hr-exp-approvals__upload-btn" onClick={() => fileRef.current?.click()}>
                <Plus className="h-4 w-4" />
                Upload Document
              </button>
              <input ref={fileRef} type="file" className="hr-exp-approvals__hidden-input" />
            </div>
          </div>
        </div>
        <div className="hr-exp-approvals__drawer-footer">
          <button
            type="button"
            className="hr-exp-approvals__save-btn"
            onClick={() => {
              if (!category || !name.trim() || !expenseDate || !amount || !details.trim()) return;
              const emp = empOptions.find((e) => e.value === employeeId);
              onSave({
                employee_id: employeeId,
                employee_name: emp?.label || "—",
                branch: emp?.branch || "",
                department: emp?.department || "",
                category,
                name: name.trim(),
                expense_date: expenseDate,
                amount: Number(amount),
                details: details.trim(),
                status: "Pending",
              });
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}

export default function ExpenseApprovals() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftBranch, setDraftBranch] = useState("");
  const [draftDepartment, setDraftDepartment] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [selected, setSelected] = useState([]);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const periodLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getExpenseApprovals({
        month: viewDate.getMonth() + 1,
        year: viewDate.getFullYear(),
      });
      const rows = Array.isArray(res?.data) ? res.data : [];
      setRecords(rows);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [viewDate]);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => {
    return records.filter((row) => {
      if (employeeFilter !== "all" && row.employee_id !== employeeFilter) return false;
      if (categoryFilter && row.category !== categoryFilter) return false;
      if (statusFilter && String(row.status || "").toLowerCase() !== statusFilter) return false;
      if (branchFilter && row.branch !== branchFilter) return false;
      if (departmentFilter && row.department !== departmentFilter) return false;
      return true;
    });
  }, [records, employeeFilter, categoryFilter, statusFilter, branchFilter, departmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allPageSelected = pagedRows.length > 0 && pagedRows.every((r) => selected.includes(r.id));

  const handleApprove = async () => {
    if (!selected.length) return;
    try {
      await approveExpenseClaims({ ids: selected });
      addToast("Expenses approved", "success");
      setRecords((prev) => prev.map((row) => (selected.includes(row.id) ? { ...row, status: "Approved" } : row)));
      setSelected([]);
    } catch {
      addToast("Failed to approve expenses", "error");
    }
  };

  const handleSave = async (payload) => {
    const row = {
      ...payload,
      id: `exp-appr-${Date.now()}`,
      created_by: "—",
      updated_by: "—",
      waiting_on: "—",
    };
    try {
      await createExpenseApproval(row);
      addToast("Expense added", "success");
      setRecords((prev) => [...prev, row]);
    } catch {
      addToast("Failed to add expense", "error");
    }
  };

  const shiftMonth = (delta) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setPage(1);
    setSelected([]);
  };

  if (loading) return <Loader label="Loading expense approvals..." />;

  const showingFrom = pagedRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filteredRows.length);

  return (
    <>
      <ListPageShell>
        <div className="hr-exp-approvals min-w-0">
          <div className="hr-exp-approvals__header">
            <div className="hr-exp-approvals__title-row">
              <button type="button" className="hr-exp-approvals__back" onClick={() => navigate("/hr/expenses")} aria-label="Back">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="hr-exp-approvals__title">Expense Approvals</h1>
            </div>
            <div className="hr-exp-approvals__period">
              <button type="button" className="hr-exp-approvals__nav-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft className="h-5 w-5" /></button>
              <span>{periodLabel}</span>
              <button type="button" className="hr-exp-approvals__nav-btn" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight className="h-5 w-5" /></button>
            </div>
            <button type="button" className="hr-exp-approvals__approve-btn" disabled={!selected.length} onClick={handleApprove}>
              Click Here To Approve
            </button>
          </div>

          <div className="hr-exp-approvals__toolbar">
            <EmployeeSelect value={employeeFilter} onChange={setEmployeeFilter} employees={DEMO_EMPLOYEES} />
            <div className="hr-exp-approvals__toolbar-right">
              <div className="hr-exp-approvals__filter-wrap">
                <button
                  type="button"
                  className="hr-exp-approvals__filter-btn"
                  onClick={() => {
                    setDraftCategory(categoryFilter);
                    setDraftStatus(statusFilter);
                    setDraftBranch(branchFilter);
                    setDraftDepartment(departmentFilter);
                    setFilterOpen((v) => !v);
                  }}
                >
                  <Filter className="h-4 w-4" />
                  Filter
                </button>
                <FilterPopover
                  open={filterOpen}
                  onClose={() => setFilterOpen(false)}
                  category={draftCategory}
                  status={draftStatus}
                  branch={draftBranch}
                  department={draftDepartment}
                  onCategoryChange={setDraftCategory}
                  onStatusChange={setDraftStatus}
                  onBranchChange={setDraftBranch}
                  onDepartmentChange={setDraftDepartment}
                  onClear={() => {
                    setDraftCategory("");
                    setDraftStatus("");
                    setDraftBranch("");
                    setDraftDepartment("");
                    setCategoryFilter("");
                    setStatusFilter("");
                    setBranchFilter("");
                    setDepartmentFilter("");
                    setFilterOpen(false);
                    setPage(1);
                  }}
                  onApply={() => {
                    setCategoryFilter(draftCategory);
                    setStatusFilter(draftStatus);
                    setBranchFilter(draftBranch);
                    setDepartmentFilter(draftDepartment);
                    setFilterOpen(false);
                    setPage(1);
                  }}
                />
              </div>
              <button type="button" className="hr-exp-approvals__add-btn" onClick={() => setDrawerOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Expense
              </button>
            </div>
          </div>

          <div className="hr-exp-approvals__table-wrap">
            <table className="hr-exp-approvals__table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={() => setSelected(allPageSelected ? [] : pagedRows.map((r) => r.id))}
                      aria-label="Select all on page"
                    />
                  </th>
                  <th>Employee</th>
                  <th>Branch</th>
                  <th>Department</th>
                  <th>Expense Category</th>
                  <th>Expense Name</th>
                  <th>Expense Date</th>
                  <th>Amount</th>
                  <th>Created By</th>
                  <th>Updated By</th>
                  <th>Status</th>
                  <th>Waiting On</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="hr-exp-approvals__empty">No records found</td>
                  </tr>
                ) : (
                  pagedRows.map((row) => {
                    const checked = selected.includes(row.id);
                    return (
                      <tr key={row.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setSelected((prev) => (checked ? prev.filter((id) => id !== row.id) : [...prev, row.id]))}
                            aria-label={`Select ${row.employee_name || row.name}`}
                          />
                        </td>
                        <td>{row.employee_name || row.employee || "—"}</td>
                        <td>{branchLabel(row.branch)}</td>
                        <td>{departmentLabel(row.department)}</td>
                        <td>{categoryLabel(row.category)}</td>
                        <td>{row.name || row.expense_name || "—"}</td>
                        <td>{formatDisplayDate(row.expense_date)}</td>
                        <td>{formatAmount(row.amount)}</td>
                        <td>{row.created_by || "—"}</td>
                        <td>{row.updated_by || "—"}</td>
                        <td><StatusBadge status={row.status} /></td>
                        <td>{row.waiting_on || "—"}</td>
                        <td>
                          <button type="button" className="hr-exp-approvals__action-btn" aria-label="Actions"><MoreVertical className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div className="hr-exp-approvals__footer">
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
                <button type="button" className="hr-exp-approvals__page-btn" onClick={() => setPage(1)} disabled={currentPage <= 1} aria-label="First page"><ChevronsLeft className="h-4 w-4" /></button>
                <button type="button" className="hr-exp-approvals__page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" className="hr-exp-approvals__page-btn hr-exp-approvals__page-btn--active">{currentPage}</button>
                <button type="button" className="hr-exp-approvals__page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
                <button type="button" className="hr-exp-approvals__page-btn" onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} aria-label="Last page"><ChevronsRight className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>
      </ListPageShell>

      <AddExpenseDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onSave={handleSave} employees={DEMO_EMPLOYEES} />
    </>
  );
}
