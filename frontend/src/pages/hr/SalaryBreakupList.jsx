import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { deleteSalaryBreakup, getEmployees, getSalaryBreakups } from "../../api/hrApi";
import "./salaryBreakupList.css";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function SalaryBreakupList() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [breakupRes, empRes] = await Promise.allSettled([
        getSalaryBreakups(),
        getEmployees(),
      ]);
      if (breakupRes.status === "fulfilled") {
        const rows = breakupRes.value?.data?.items || breakupRes.value?.data || [];
        setRecords(Array.isArray(rows) ? rows : []);
      }
      if (empRes.status === "fulfilled") {
        const rows = empRes.value?.data?.items || empRes.value?.data || [];
        setEmployees(Array.isArray(rows) ? rows : []);
      }
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  const departmentOptions = useMemo(() => {
    const depts = new Set();
    records.forEach((r) => { if (r.department) depts.add(r.department); });
    employees.forEach((e) => { if (e.department) depts.add(e.department); });
    return [{ value: "", label: "All Departments" }, ...Array.from(depts).map((d) => ({ value: d, label: d }))];
  }, [records, employees]);

  const employeeOptions = useMemo(() => {
    const map = new Map();
    records.forEach((r) => {
      const id = String(r.employee_id || r.id);
      const name = r.employee_name || r.name;
      if (name) map.set(id, name);
    });
    employees.forEach((e) => {
      map.set(String(e.id), e.full_name);
    });
    return [{ value: "", label: "All Employees" }, ...Array.from(map.entries()).map(([value, label]) => ({ value, label }))];
  }, [records, employees]);

  const filteredRows = useMemo(() => records.filter((row) => {
    if (departmentFilter && row.department !== departmentFilter) return false;
    if (employeeFilter && String(row.employee_id) !== String(employeeFilter)) return false;
    return true;
  }), [records, departmentFilter, employeeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = pagedRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filteredRows.length);

  const resetFilters = () => {
    setDepartmentFilter("");
    setEmployeeFilter("");
    setPage(1);
  };

  const handleDelete = async (row) => {
    const label = row.employee_name || row.name || "breakup";
    if (!window.confirm(`Delete salary breakup for ${label}?`)) return;
    try {
      await deleteSalaryBreakup(row.id);
      setRecords((prev) => prev.filter((r) => r.id !== row.id));
      addToast("Salary breakup deleted", "success");
    } catch {
      addToast("Failed to delete salary breakup", "error");
    }
  };

  if (loading) return <Loader label="Loading salary breakup list..." />;

  return (
    <ListPageShell>
      <div className="hr-salary-breakup-list min-w-0">
        <div className="hr-salary-breakup-list__top">
          <h1 className="hr-salary-breakup-list__title">Salary Breakup List</h1>
          <button
            type="button"
            className="hr-salary-breakup-list__create-btn"
            onClick={() => navigate("/hr/payroll/salary-breakup/create")}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Create Salary Breakup
          </button>
        </div>

        <div className="hr-salary-breakup-list__filters">
          <select
            className="hr-salary-breakup-list__select"
            value={departmentFilter}
            onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
          >
            {departmentOptions.map((o) => (
              <option key={o.value || o.label} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className="hr-salary-breakup-list__select"
            value={employeeFilter}
            onChange={(e) => { setEmployeeFilter(e.target.value); setPage(1); }}
          >
            {employeeOptions.map((o) => (
              <option key={o.value || o.label} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button type="button" className="hr-salary-breakup-list__reset-btn" onClick={resetFilters}>
            Reset
          </button>
        </div>

        <div className="hr-salary-breakup-list__table-wrap">
          <table className="hr-salary-breakup-list__table">
            <thead>
              <tr>
                <th>SR No.</th>
                <th>Name</th>
                <th>Created By</th>
                <th>Updated By</th>
                <th>Effective From</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="hr-salary-breakup-list__empty">No records found</td>
                </tr>
              ) : (
                pagedRows.map((row, index) => (
                  <tr key={row.id}>
                    <td>{(currentPage - 1) * pageSize + index + 1}</td>
                    <td className="font-semibold text-slate-800">{row.name || row.employee_name || "—"}</td>
                    <td>{row.created_by || "—"}</td>
                    <td>{row.updated_by || "—"}</td>
                    <td>{formatDate(row.effective_from)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                          title="Edit Breakup"
                          onClick={() => navigate(`/hr/payroll/salary-breakup/create?id=${row.id}`)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Delete Breakup"
                          onClick={() => handleDelete(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="hr-salary-breakup-list__footer">
            <div className="hr-salary-breakup-list__page-size">
              Show
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              Entries
            </div>
            <span className="hr-salary-breakup-list__page-info">
              Showing {showingFrom} to {showingTo} of {filteredRows.length} entries
            </span>
            <div className="hr-salary-breakup-list__pager">
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
      </div>
    </ListPageShell>
  );
}
