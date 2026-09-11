import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Search,
  Trash2,
  Unlock,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import {
  createSalaryHold,
  deleteSalaryHold,
  getEmployees,
  getSalaryOnHold,
  releaseSalaryHold,
} from "../../api/hrApi";
import "./salaryOnHold.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
];

function formatInr(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PutHoldModal({ open, onClose, onSave, saving, employees }) {
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [reason, setReason] = useState("");
  const [paidDays, setPaidDays] = useState(0);
  const [deductions, setDeductions] = useState(0);
  const [holdFrom, setHoldFrom] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      if (employees.length > 0) {
        setEmployeeId(String(employees[0].id));
        setEmployeeName(employees[0].full_name);
      } else {
        setEmployeeId("");
        setEmployeeName("");
      }
      setReason("");
      setPaidDays(0);
      setDeductions(0);
      setHoldFrom(new Date().toISOString().slice(0, 10));
    }
  }, [open, employees]);

  if (!open) return null;

  const handleEmployeeChange = (e) => {
    const val = e.target.value;
    setEmployeeId(val);
    const found = employees.find((emp) => String(emp.id) === val);
    if (found) setEmployeeName(found.full_name);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Put Salary On Hold</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!employeeId || !reason.trim()) return;
            onSave({
              employee_id: Number(employeeId),
              employee_name: employeeName,
              reason: reason.trim(),
              paid_days: Number(paidDays) || 0,
              deductions: Number(deductions) || 0,
              hold_from: holdFrom,
            });
          }}
          className="mt-4 space-y-3.5 text-sm"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Employee <span className="text-rose-500">*</span>
            </label>
            <select
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              value={employeeId}
              onChange={handleEmployeeChange}
            >
              <option value="">Select an employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_code} — {emp.department || "General"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Hold <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Pending disciplinary review, clearance documents required"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Paid Days</label>
              <input
                type="number"
                min="0"
                max="31"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                value={paidDays}
                onChange={(e) => setPaidDays(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Deductions (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                value={deductions}
                onChange={(e) => setDeductions(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Hold Effective From</label>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
              value={holdFrom}
              onChange={(e) => setHoldFrom(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !employeeId || !reason.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Put On Hold"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function TypeFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = TYPE_OPTIONS.find((o) => o.value === value)?.label || "All";

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="hr-salary-on-hold__type-select">
      <button type="button" className="hr-salary-on-hold__type-trigger" onClick={() => setOpen((v) => !v)}>
        <span>{selected}</span>
        <ChevronDown className="h-4 w-4" />
      </button>
      {open ? (
        <div className="hr-salary-on-hold__type-menu">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`hr-salary-on-hold__type-option ${opt.value === value ? "hr-salary-on-hold__type-option--active" : ""}`}
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

export default function SalaryOnHold() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [viewDate, setViewDate] = useState(() => new Date(2026, 8, 1));
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortPaidDays, setSortPaidDays] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const periodLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [holdRes, empRes] = await Promise.all([
        getSalaryOnHold({
          month: viewDate.getMonth() + 1,
          year: viewDate.getFullYear(),
        }),
        getEmployees(),
      ]);
      const rows = holdRes?.data?.items || holdRes?.data || [];
      setRecords(Array.isArray(rows) ? rows : []);
      const emps = empRes?.data?.items || empRes?.data || [];
      setEmployees(Array.isArray(emps) ? emps : []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [viewDate]);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  const handleSaveHold = async (payload) => {
    setSaving(true);
    try {
      await createSalaryHold(payload);
      addToast("Salary placed on hold successfully", "success");
      setShowModal(false);
      await load(true);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to put salary on hold";
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async (row) => {
    const name = row.employee_name || "Employee";
    if (!window.confirm(`Release salary hold for ${name}?`)) return;
    try {
      await releaseSalaryHold(row.id);
      addToast(`Salary hold released for ${name}`, "success");
      await load(true);
    } catch {
      addToast("Failed to release salary hold", "error");
    }
  };

  const handleDelete = async (row) => {
    const name = row.employee_name || "Employee";
    if (!window.confirm(`Delete hold record for ${name}?`)) return;
    try {
      await deleteSalaryHold(row.id);
      addToast(`Hold record deleted for ${name}`, "success");
      await load(true);
    } catch {
      addToast("Failed to delete hold record", "error");
    }
  };

  const filteredRows = useMemo(() => {
    let rows = [...records];
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) => String(row.employee_name || row.name || "").toLowerCase().includes(q));
    }
    if (typeFilter !== "all") {
      rows = rows.filter((row) => (row.employment_type || "permanent") === typeFilter);
    }
    if (sortPaidDays) {
      rows.sort((a, b) => {
        const av = Number(a.paid_days) || 0;
        const bv = Number(b.paid_days) || 0;
        return sortPaidDays === "asc" ? av - bv : bv - av;
      });
    }
    return rows;
  }, [records, search, typeFilter, sortPaidDays]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = pagedRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filteredRows.length);

  const shiftMonth = (delta) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setPage(1);
  };

  const togglePaidDaysSort = () => {
    setSortPaidDays((prev) => (prev === null ? "asc" : prev === "asc" ? "desc" : null));
  };

  if (loading) return <Loader label="Loading salary on hold..." />;

  return (
    <ListPageShell>
      <div className="hr-salary-on-hold min-w-0">
        <div className="hr-salary-on-hold__header">
          <div className="hr-salary-on-hold__title-row">
            <button type="button" className="hr-salary-on-hold__back" onClick={() => navigate("/hr/payroll")} aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="hr-salary-on-hold__title">Salary On Hold</h1>
          </div>
          <div className="hr-salary-on-hold__period">
            <button type="button" className="hr-salary-on-hold__nav-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span>{periodLabel}</span>
            <button type="button" className="hr-salary-on-hold__nav-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Put Salary On Hold
            </button>
          </div>
        </div>

        <div className="hr-salary-on-hold__toolbar">
          <div className="hr-salary-on-hold__search-wrap">
            <Search className="h-4 w-4" />
            <input
              className="hr-salary-on-hold__search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search Employees"
            />
          </div>
          <TypeFilter value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1); }} />
        </div>

        <div className="hr-salary-on-hold__table-wrap">
          <table className="hr-salary-on-hold__table">
            <thead>
              <tr>
                <th>Employee name</th>
                <th>
                  <button type="button" className="hr-salary-on-hold__sort-btn" onClick={togglePaidDaysSort}>
                    Paid Days
                    <span className="hr-salary-on-hold__sort-icons">
                      <ArrowUp className={`h-3 w-3 ${sortPaidDays === "asc" ? "is-active" : ""}`} />
                      <ArrowDown className={`h-3 w-3 ${sortPaidDays === "desc" ? "is-active" : ""}`} />
                    </span>
                  </button>
                </th>
                <th>Deductions</th>
                <th>Gross Pay</th>
                <th>Net Pay</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Updated By</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="hr-salary-on-hold__empty">No records found</td>
                </tr>
              ) : (
                pagedRows.map((row) => {
                  const isReleased = row.status === "released";
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="font-semibold text-slate-900">{row.employee_name || row.name}</div>
                        <div className="text-xs text-slate-400">{row.employee_code || "EMP"}</div>
                      </td>
                      <td>{row.paid_days ?? 0}</td>
                      <td>{formatInr(row.deductions)}</td>
                      <td>{formatInr(row.gross_pay)}</td>
                      <td>{formatInr(row.net_pay)}</td>
                      <td className="max-w-[180px] truncate" title={row.reason}>{row.reason || "—"}</td>
                      <td>
                        {isReleased ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Released
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            Active Hold
                          </span>
                        )}
                      </td>
                      <td>{row.updated_by || "Admin"}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isReleased ? (
                            <button
                              type="button"
                              onClick={() => handleRelease(row)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors shadow-xs"
                              title="Release hold"
                            >
                              <Unlock className="h-3.5 w-3.5" />
                              Release
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="hr-salary-on-hold__footer">
            <div className="hr-salary-on-hold__page-size">
              Show
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              Entries
            </div>
            <span className="hr-salary-on-hold__page-info">
              Showing {showingFrom} to {showingTo} of {filteredRows.length} entries
            </span>
            <div className="hr-salary-on-hold__pager">
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage(1)} aria-label="First page">
                <ChevronsLeft className="h-4 w-4" />
              </button>
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(totalPages)} aria-label="Last page">
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <PutHoldModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSave={handleSaveHold}
          saving={saving}
          employees={employees}
        />
      </div>
    </ListPageShell>
  );
}
