import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
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
import "./payrollMisReport.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const EMPLOYMENT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
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

function formatMonthLabel(monthValue) {
  if (!monthValue) return "";
  const [year, month] = monthValue.split("-");
  const idx = Number(month) - 1;
  if (!year || idx < 0 || idx > 11) return monthValue;
  return `${MONTHS[idx]} ${year}`;
}

function parseMonthParts(monthValue) {
  const [year, month] = monthValue.split("-");
  const idx = Number(month) - 1;
  return {
    monthLabel: MONTHS[idx] || month,
    year: year || "",
  };
}

function optionLabel(options, value) {
  return options.find((o) => o.value === value)?.label || value || "—";
}

function GenerateReportDrawer({ open, onClose, onGenerate, drawerTitle, showEmploymentFields }) {
  const [reportMonth, setReportMonth] = useState("");
  const [employmentType, setEmploymentType] = useState("all");
  const [employeeId, setEmployeeId] = useState("");

  useEffect(() => {
    if (!open) return;
    setReportMonth("");
    setEmploymentType("all");
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
    <div className="hr-payroll-mis-report__overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={drawerTitle}>
      <div className="hr-payroll-mis-report__drawer" onClick={(e) => e.stopPropagation()}>
        <div className="hr-payroll-mis-report__drawer-header">
          <h2>{drawerTitle}</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="hr-payroll-mis-report__drawer-body">
          <div className="hr-payroll-mis-report__field">
            <label>Month <span>*</span></label>
            <div className="hr-payroll-mis-report__month-wrap">
              <span className={reportMonth ? "" : "is-placeholder"}>
                {reportMonth ? formatMonthLabel(reportMonth) : "Select Month"}
              </span>
              <CalendarDays className="h-4 w-4" />
              <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} />
            </div>
          </div>

          {showEmploymentFields && (
            <>
              <div className="hr-payroll-mis-report__field">
                <label>Employment Type</label>
                <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
                  {EMPLOYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="hr-payroll-mis-report__field">
                <label>Employee List</label>
                <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                  {EMPLOYEE_OPTIONS.map((o) => <option key={o.value || o.label} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="hr-payroll-mis-report__drawer-footer">
          <button type="button" className="hr-payroll-mis-report__cancel-btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="hr-payroll-mis-report__generate-btn"
            disabled={!reportMonth}
            onClick={() => {
              onGenerate({
                report_month: reportMonth,
                employment_type: employmentType,
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

/**
 * Shared payroll MIS report page — PF, ESIC, Salary, Bank Template.
 * @param {{
 *   title: string;
 *   drawerTitle: string;
 *   storageKey: string;
 *   filePrefix: string;
 *   showEmploymentType: boolean;
 *   loadingLabel: string;
 *   successToast: string;
 *   fetchReports: (params: object) => Promise<unknown>;
 *   generateReport: (payload: object) => Promise<unknown>;
 * }} config
 */
export default function PayrollMisReport({
  title,
  drawerTitle,
  storageKey,
  filePrefix,
  showEmploymentType,
  loadingLabel,
  successToast,
  fetchReports,
  generateReport,
}) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [viewDate, setViewDate] = useState(() => new Date(2026, 8, 1));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const periodLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
  const colSpan = showEmploymentType ? 6 : 5;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await fetchReports({
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
  }, [fetchReports, storageKey, viewDate]);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => records.filter((row) => {
    if (row.report_month) {
      const [y, m] = row.report_month.split("-");
      return Number(m) - 1 === viewDate.getMonth() && Number(y) === viewDate.getFullYear();
    }
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
    const { monthLabel, year } = parseMonthParts(payload.report_month);
    const fileName = `${filePrefix}_${monthLabel}_${year}.xlsx`;
    const row = {
      id: `${storageKey}-${Date.now()}`,
      file_name: fileName,
      month: monthLabel,
      year,
      employment_type: showEmploymentType ? optionLabel(EMPLOYMENT_OPTIONS, payload.employment_type) : undefined,
      generated_on: new Date().toISOString(),
      download_url: "#",
      ...payload,
    };

    try {
      await generateReport(payload);
      addToast(successToast, "success");
      setRecords((prev) => [row, ...prev]);
    } catch {
      addToast(`Failed to generate ${title.toLowerCase()}`, "error");
    }
  };

  const handleDownload = (row) => {
    addToast(`Downloading ${row.file_name}`, "info");
  };

  if (loading) return <Loader label={loadingLabel} />;

  return (
    <>
      <ListPageShell>
        <div className="hr-payroll-mis-report min-w-0">
          <div className="hr-payroll-mis-report__header">
            <h1 className="hr-payroll-mis-report__title">{title}</h1>
            <div className="hr-payroll-mis-report__period">
              <button type="button" className="hr-payroll-mis-report__nav-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span>{periodLabel}</span>
              <button type="button" className="hr-payroll-mis-report__nav-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <button type="button" className="hr-payroll-mis-report__create-btn" onClick={() => setDrawerOpen(true)}>
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Generate Report
            </button>
          </div>

          <div className="hr-payroll-mis-report__table-wrap">
            <table className="hr-payroll-mis-report__table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Month</th>
                  <th>Year</th>
                  {showEmploymentType && <th>Employment Type</th>}
                  <th>Generated On</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="hr-payroll-mis-report__empty">No records found</td>
                  </tr>
                ) : (
                  pagedRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.file_name}</td>
                      <td>{row.month}</td>
                      <td>{row.year}</td>
                      {showEmploymentType && <td>{row.employment_type}</td>}
                      <td>{formatGeneratedOn(row.generated_on)}</td>
                      <td>
                        <button type="button" className="hr-payroll-mis-report__download-btn" onClick={() => handleDownload(row)} aria-label="Download">
                          <Download className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="hr-payroll-mis-report__footer">
              <div className="hr-payroll-mis-report__page-size">
                Show
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                Entries
              </div>
              <span className="hr-payroll-mis-report__page-info">
                Showing {showingFrom} to {showingTo} of {filteredRows.length} entries
              </span>
              <div className="hr-payroll-mis-report__pager">
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
        drawerTitle={drawerTitle}
        showEmploymentFields={showEmploymentType}
      />
    </>
  );
}
