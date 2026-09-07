import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreVertical,
  Search,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getSalaryOnHold } from "../../api/hrApi";
import "./salaryOnHold.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "permanent", label: "Permanent" },
];

function formatInr(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [viewDate, setViewDate] = useState(() => new Date(2026, 8, 1));
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortPaidDays, setSortPaidDays] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const periodLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getSalaryOnHold({
        month: viewDate.getMonth() + 1,
        year: viewDate.getFullYear(),
      });
      const rows = res?.data?.items || res?.data || [];
      setRecords(Array.isArray(rows) ? rows : []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [viewDate]);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

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
          <span aria-hidden />
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
                <th>Updated By</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="hr-salary-on-hold__empty">No records found</td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.employee_name || row.name}</td>
                    <td>{row.paid_days ?? "—"}</td>
                    <td>{formatInr(row.deductions)}</td>
                    <td>{formatInr(row.gross_pay)}</td>
                    <td>{formatInr(row.net_pay)}</td>
                    <td>{row.reason || "—"}</td>
                    <td>{row.updated_by || "—"}</td>
                    <td>
                      <button type="button" className="hr-salary-on-hold__action-btn" aria-label="Row actions">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
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
      </div>
    </ListPageShell>
  );
}
