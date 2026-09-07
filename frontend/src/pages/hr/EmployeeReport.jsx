import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Plus,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { generateEmployeeReport, getEmployeeReports } from "../../api/hrApi";
import "./employeeReport.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const BRANCH_OPTIONS = [
  { value: "all", label: "All Branch" },
  { value: "hq", label: "Head Office" },
  { value: "plant", label: "Manufacturing Plant" },
];

const DEPARTMENT_OPTIONS = [
  { value: "all", label: "All Department" },
  { value: "hr", label: "HR Department" },
  { value: "production", label: "Production" },
  { value: "accounts", label: "Accounts" },
];

const EMPLOYMENT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
];

const EMPLOYEE_STATUS_OPTIONS = [
  { value: "all", label: "All Employee Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "on_notice", label: "On Notice" },
];

const EMPLOYEE_OPTIONS = [
  { value: "", label: "Select Employees" },
  { value: "demo-satish", label: "Satish Gogulothu" },
  { value: "all", label: "All Employees" },
];

function formatGeneratedOn(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hours}:${mins}`;
}

function optionLabel(options, value) {
  return options.find((o) => o.value === value)?.label || value || "—";
}

function GenerateReportDrawer({ open, onClose, onGenerate }) {
  const [branch, setBranch] = useState("all");
  const [department, setDepartment] = useState("all");
  const [employmentType, setEmploymentType] = useState("all");
  const [employeeStatus, setEmployeeStatus] = useState("all");
  const [employeeId, setEmployeeId] = useState("");

  useEffect(() => {
    if (!open) return;
    setBranch("all");
    setDepartment("all");
    setEmploymentType("all");
    setEmployeeStatus("all");
    setEmployeeId("");
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const drawer = (
    <div className="hr-employee-report__overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Generate Employee Report">
      <div className="hr-employee-report__drawer" onClick={(e) => e.stopPropagation()}>
        <div className="hr-employee-report__drawer-header">
          <h2>Generate Employee Report</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="hr-employee-report__drawer-body">
          <div className="hr-employee-report__field">
            <label>Branch</label>
            <select value={branch} onChange={(e) => setBranch(e.target.value)}>
              {BRANCH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="hr-employee-report__field">
            <label>Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              {DEPARTMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="hr-employee-report__field">
            <label>Employment Type</label>
            <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
              {EMPLOYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="hr-employee-report__field">
            <label>Employee Status</label>
            <select value={employeeStatus} onChange={(e) => setEmployeeStatus(e.target.value)}>
              {EMPLOYEE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="hr-employee-report__field">
            <label>Employee List</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {EMPLOYEE_OPTIONS.map((o) => <option key={o.value || o.label} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="hr-employee-report__drawer-footer">
          <button type="button" className="hr-employee-report__cancel-btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="hr-employee-report__generate-btn"
            onClick={() => {
              onGenerate({
                branch,
                department,
                employment_type: employmentType,
                employee_status: employeeStatus,
                employee_id: employeeId,
              });
              onClose();
            }}
          >
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}

export default function EmployeeReport() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [viewDate, setViewDate] = useState(() => new Date(2026, 8, 1));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const periodLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getEmployeeReports({
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

  const filteredRows = useMemo(() => records.filter((row) => {
    if (!row.generated_on) return true;
    const d = new Date(row.generated_on);
    return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
  }), [records, viewDate]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showingFrom = pagedRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filteredRows.length);

  const shiftMonth = (delta) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setPage(1);
  };

  const handleGenerate = async (payload) => {
    const fileName = `Employee_Report_${MONTHS[viewDate.getMonth()]}_${viewDate.getFullYear()}.xlsx`;
    const row = {
      id: `employee-report-${Date.now()}`,
      file_name: fileName,
      branch: optionLabel(BRANCH_OPTIONS, payload.branch),
      department: optionLabel(DEPARTMENT_OPTIONS, payload.department),
      employment_type: optionLabel(EMPLOYMENT_OPTIONS, payload.employment_type),
      status: optionLabel(EMPLOYEE_STATUS_OPTIONS, payload.employee_status),
      generated_on: new Date().toISOString(),
      download_url: "#",
      ...payload,
    };

    try {
      await generateEmployeeReport(payload);
      addToast("Employee report generated", "success");
      setRecords((prev) => [row, ...prev]);
    } catch {
      addToast("Failed to generate employee report", "error");
    }
  };

  const handleDownload = (row) => {
    addToast(`Downloading ${row.file_name}`, "info");
  };

  if (loading) return <Loader label="Loading employee reports..." />;

  return (
    <>
      <ListPageShell>
        <div className="hr-employee-report min-w-0">
          <div className="hr-employee-report__header">
            <h1 className="hr-employee-report__title">Employee Report</h1>
            <div className="hr-employee-report__period">
              <button type="button" className="hr-employee-report__nav-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span>{periodLabel}</span>
              <button type="button" className="hr-employee-report__nav-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <button type="button" className="hr-employee-report__create-btn" onClick={() => setDrawerOpen(true)}>
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Generate Report
            </button>
          </div>

          <div className="hr-employee-report__table-wrap">
            <table className="hr-employee-report__table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Branch</th>
                  <th>Department</th>
                  <th>Employment Type</th>
                  <th>Status</th>
                  <th>Generated On</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="hr-employee-report__empty">No records found</td>
                  </tr>
                ) : (
                  pagedRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.file_name}</td>
                      <td>{row.branch}</td>
                      <td>{row.department}</td>
                      <td>{row.employment_type}</td>
                      <td>{row.status}</td>
                      <td>{formatGeneratedOn(row.generated_on)}</td>
                      <td>
                        <button type="button" className="hr-employee-report__download-btn" onClick={() => handleDownload(row)} aria-label="Download">
                          <Download className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="hr-employee-report__footer">
              <div className="hr-employee-report__page-size">
                Show
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                Entries
              </div>
              <span className="hr-employee-report__page-info">
                Showing {showingFrom} to {showingTo} of {filteredRows.length} entries
              </span>
              <div className="hr-employee-report__pager">
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

      <GenerateReportDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onGenerate={handleGenerate}
      />
    </>
  );
}
