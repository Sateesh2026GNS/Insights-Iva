import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreVertical,
  Plus,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getSalaryBreakups } from "../../api/hrApi";
import "./salaryBreakupList.css";

const DEPARTMENT_OPTIONS = [
  { value: "", label: "Department Name" },
  { value: "hr", label: "HR Department" },
  { value: "production", label: "Production" },
  { value: "accounts", label: "Accounts" },
];

const EMPLOYEE_OPTIONS = [
  { value: "", label: "Employee Name" },
  { value: "demo-satish", label: "Satish Gogulothu" },
];

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function SalaryBreakupList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getSalaryBreakups();
      const rows = res?.data?.items || res?.data || [];
      setRecords(Array.isArray(rows) ? rows : []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => records.filter((row) => {
    if (departmentFilter && row.department !== departmentFilter) return false;
    if (employeeFilter && row.employee_id !== employeeFilter) return false;
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
            {DEPARTMENT_OPTIONS.map((o) => (
              <option key={o.value || o.label} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className="hr-salary-breakup-list__select"
            value={employeeFilter}
            onChange={(e) => { setEmployeeFilter(e.target.value); setPage(1); }}
          >
            {EMPLOYEE_OPTIONS.map((o) => (
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
                    <td>{row.name || row.employee_name || "—"}</td>
                    <td>{row.created_by || "—"}</td>
                    <td>{row.updated_by || "—"}</td>
                    <td>{formatDate(row.effective_from)}</td>
                    <td>
                      <button
                        type="button"
                        className="hr-salary-breakup-list__action-btn"
                        aria-label="Row actions"
                        onClick={() => navigate(`/hr/payroll/salary-breakup/create?id=${row.id}`)}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
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
