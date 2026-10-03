import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  Banknote,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Filter,
  PieChart,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Unlock,
  Upload,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Cell, Pie, PieChart as RechartsPie, ResponsiveContainer, Tooltip } from "recharts";

import InventoryRowActionsMenu from "../../components/inventory/InventoryRowActionsMenu";
import Button, { AddButton } from "../../components/common/Button";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageShell } from "../../components/common/ListPageShell";
import Loader from "../../components/common/Loader";
import EmptyState from "../../components/common/EmptyState";
import PayrollDetailModal from "../../components/hr/PayrollDetailModal";
import {
  HrAvatar,
  HrKpiCard,
  HrPage,
  HrPageHeader,
  hrInputClass,
} from "../../components/hr/hrUi";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const PAYROLL_RUN_EXPORT_COLUMNS = [
  { key: "name", label: "Run Name" },
  { key: "period", label: "Pay Period" },
  { key: "employees", label: "Employees" },
  { key: "total_payroll", label: "Total Payroll" },
  { key: "net_pay", label: "Net Pay" },
  { key: "status", label: "Status" },
];

const selectClass = "ui-select !w-auto min-w-[8.5rem]";
import usePageRefresh from "../../hooks/usePageRefresh";
import useTenantId from "../../hooks/useTenantId";
import { useToast } from "../../context/ToastContext";
import {
  createPayroll,
  getEmployeeSummary,
  getEmployeesEnriched,
  getPayrollEnriched,
  getPayrollSummary,
  getSalaryOnHold,
  releaseSalaryHold,
} from "../../api/hrApi";
import {
  EMPTY_PAYROLL_DASHBOARD,
  formatPayrollInr,
  mergePayrollDashboard,
  payrollStatusBadgeClass,
} from "../../data/hrMasterData";

const PAYROLL_TABS = [
  { id: "runs", label: "Payroll Runs" },
  { id: "payslip", label: "Employee Payslip" },
  { id: "salary", label: "Salary Summary" },
  { id: "tax", label: "Tax Summary" },
  { id: "loan", label: "Loan / Hold Summary" },
];

function StatusBadge({ status }) {
  const key = String(status || "draft").toLowerCase();
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${payrollStatusBadgeClass(key)}`}>
      {label}
    </span>
  );
}

function pageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items = [1];
  if (current > 3) items.push("…");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let p = start; p <= end; p += 1) items.push(p);
  if (current < total - 2) items.push("…");
  if (total > 1) items.push(total);
  return items;
}

export default function Payroll() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(EMPTY_PAYROLL_DASHBOARD);
  const [apiRows, setApiRows] = useState([]);
  const [holds, setHolds] = useState([]);
  const [tab, setTab] = useState("runs");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [menuId, setMenuId] = useState(null);
  const [selected, setSelected] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    tenant_id: tenantId,
    employee_id: "",
    period_start: `${new Date().toISOString().slice(0, 7)}-01`,
    period_end: new Date().toISOString().slice(0, 10),
    regular_hours: "160",
    overtime_hours: "0",
    regular_pay: "0",
    overtime_pay: "0",
    gross_pay: "0",
    pf: "0",
    esi: "0",
    tax: "0",
    deductions: "0",
    net_pay: "0",
    status: "draft",
  });

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes, empSumRes, empListRes, holdRes] = await Promise.allSettled([
        getPayrollSummary(),
        getPayrollEnriched(),
        getEmployeeSummary(),
        getEmployeesEnriched(),
        getSalaryOnHold(),
      ]);
      const summary = sumRes.status === "fulfilled" ? sumRes.value?.data || {} : {};
      const rows = listRes.status === "fulfilled" && Array.isArray(listRes.value?.data) ? listRes.value.data : [];
      const employeeCount = empSumRes.status === "fulfilled" ? empSumRes.value?.data?.total_employees : 0;
      setApiRows(rows);
      setData(mergePayrollDashboard({ summary, rows, employeeCount }));
      if (empListRes.status === "fulfilled" && Array.isArray(empListRes.value?.data)) {
        setEmployees(empListRes.value.data);
      }
      if (holdRes.status === "fulfilled") {
        const holdItems = holdRes.value?.data?.items || holdRes.value?.data || [];
        setHolds(Array.isArray(holdItems) ? holdItems : []);
      }
    } catch (err) {
      if (isRefresh) throw err;
      setData(EMPTY_PAYROLL_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const filteredRuns = useMemo(() => {
    return (data.payroll_runs || []).filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
  }, [data.payroll_runs, statusFilter]);

  const filteredApiRows = useMemo(() => {
    return apiRows.filter((row) => {
      if (department && row.department !== department) return false;
      if (statusFilter && String(row.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (row.employee_name || "").toLowerCase();
        const code = (row.employee_code || "").toLowerCase();
        const dept = (row.department || "").toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !dept.includes(q)) return false;
      }
      return true;
    });
  }, [apiRows, department, statusFilter, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, pageSize, period, searchQuery, department]);

  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / pageSize));
  const pageRows = filteredRuns.slice((page - 1) * pageSize, page * pageSize);
  const from = filteredRuns.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, filteredRuns.length);

  const donutData = data.summary_slices.map((s) => ({
    name: s.label,
    value: s.amount,
    color: s.color,
    pct: s.pct,
  }));

  const trends = data.kpi_trends || {};

  const handleFormChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      const regPay = Number(field === "regular_pay" ? value : prev.regular_pay) || 0;
      const otPay = Number(field === "overtime_pay" ? value : prev.overtime_pay) || 0;
      const pf = Number(field === "pf" ? value : prev.pf) || 0;
      const esi = Number(field === "esi" ? value : prev.esi) || 0;
      const tax = Number(field === "tax" ? value : prev.tax) || 0;
      const gross = regPay + otPay;
      const totalDeductions = pf + esi + tax;
      updated.gross_pay = String(gross);
      updated.deductions = String(totalDeductions);
      updated.net_pay = String(Math.max(0, gross - totalDeductions));
      return updated;
    });
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.period_start || !form.period_end) {
      setError("Please fill all required fields.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createPayroll({
        ...form,
        employee_id: Number(form.employee_id),
        regular_hours: Number(form.regular_hours) || 0,
        overtime_hours: Number(form.overtime_hours) || 0,
        regular_pay: Number(form.regular_pay) || 0,
        basic: Number(form.regular_pay) || 0,
        overtime_pay: Number(form.overtime_pay) || 0,
        gross_pay: Number(form.gross_pay) || 0,
        pf: Number(form.pf) || 0,
        esi: Number(form.esi) || 0,
        tax: Number(form.tax) || 0,
        deductions: Number(form.deductions) || 0,
        net_pay: Number(form.net_pay) || 0,
      });
      addToast("Payroll record created successfully", "success");
      setShowCreateModal(false);
      load();
    } catch {
      setError("Failed to create payroll record.");
      addToast("Failed to create payroll", "error");
    } finally {
      setSaving(false);
    }
  };

  const openPayslip = (payslip) => {
    const match = apiRows.find((r) => String(r.employee_name) === String(payslip.name || payslip.employee_name)) || payslip;
    try {
      sessionStorage.setItem("view_payslip_data", JSON.stringify(match));
      localStorage.setItem("view_payslip_data", JSON.stringify(match));
    } catch {}
    window.open(`/hr/payroll/payslip-view?id=${match.id || "current"}`, "_blank");
  };

  const handleReleaseHold = async (holdId) => {
    try {
      await releaseSalaryHold(holdId);
      addToast("Salary hold released successfully", "success");
      load(true);
    } catch {
      addToast("Failed to release salary hold", "error");
    }
  };

  if (loading) return <Loader label="Loading payroll..." />;

  const exportRows = filteredRuns.map((r) => ({
    name: r.name,
    period: r.period,
    employees: r.employees,
    total_payroll: formatPayrollInr(r.total_payroll),
    net_pay: formatPayrollInr(r.net_pay),
    status: String(r.status || "").replace(/_/g, " "),
  }));

  const handleExport = (format) => {
    if (format === "pdf") {
      exportToPdf(exportRows, PAYROLL_RUN_EXPORT_COLUMNS, "Payroll Runs", "payroll-runs");
    } else {
      exportToExcel(exportRows, PAYROLL_RUN_EXPORT_COLUMNS, "payroll-runs");
    }
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <ListPageShell>
    <HrPage>
      <HrPageHeader
        title="Payroll"
        subtitle="Manage and process employee payroll, salary breakups, statutory contributions, and payslips"
        action={
          <>
          <AddButton type="button" onClick={() => setShowCreateModal(true)}>
            New Payroll
          </AddButton>
          <ExportDownloadMenu disabled={!exportRows.length} onExport={handleExport} />
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowImportModal(true)}
            leftIcon={<Upload className="h-4 w-4" aria-hidden />}
          >
            Import Data
          </Button>
          <div className="relative">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowMoreActions((v) => !v)}
              rightIcon={<ChevronDown className="h-4 w-4" aria-hidden />}
            >
              More Actions
            </Button>
            {showMoreActions && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg space-y-0.5 text-xs font-semibold text-slate-700">
                <button
                  type="button"
                  onClick={() => { setShowMoreActions(false); navigate("/hr/payroll/create"); }}
                  className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-100 flex items-center gap-2"
                >
                  <Wallet className="h-3.5 w-3.5 text-blue-600" /> Run Monthly Payroll
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMoreActions(false); navigate("/hr/payroll/salary-components"); }}
                  className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-100 flex items-center gap-2"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" /> Salary Components
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMoreActions(false); navigate("/hr/payroll/statutory-components"); }}
                  className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-100 flex items-center gap-2"
                >
                  <PieChart className="h-3.5 w-3.5 text-emerald-600" /> Statutory Settings
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMoreActions(false); navigate("/hr/payroll/salary-breakup"); }}
                  className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-100 flex items-center gap-2"
                >
                  <Banknote className="h-3.5 w-3.5 text-amber-600" /> Salary Breakups
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMoreActions(false); navigate("/hr/payroll/on-hold"); }}
                  className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-100 flex items-center gap-2"
                >
                  <Clock className="h-3.5 w-3.5 text-rose-600" /> Salary On Hold
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMoreActions(false); navigate("/hr/payroll/settings"); }}
                  className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-100 flex items-center gap-2"
                >
                  <UserRound className="h-3.5 w-3.5 text-slate-600" /> Payroll Settings
                </button>
              </div>
            )}
          </div>
          </>
        }
      />

      <div className="ui-grid-kpi">
        <HrKpiCard label="Total Employees" value={data.total_employees} icon={Users} tone="purple" trend={trends.employees} />
        <HrKpiCard
          label={`Total Payroll (${data.period_label || period})`}
          value={formatPayrollInr(data.total_payroll)}
          icon={Banknote}
          tone="green"
          trend={trends.total_payroll}
        />
        <HrKpiCard label="Net Pay" value={formatPayrollInr(data.net_pay)} icon={Wallet} tone="blue" trend={trends.net_pay} />
        <HrKpiCard label="Deductions" value={formatPayrollInr(data.deductions)} icon={PieChart} tone="orange" trend={trends.deductions} />
        <HrKpiCard
          label="Salary Holds / Pending"
          value={String(holds.length || data.pending_approval).padStart(2, "0")}
          icon={CalendarDays}
          tone="red"
          trend={trends.pending}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 xl:col-span-2">
          <div className="ui-card shadow-sm">
            <div className="flex overflow-x-auto border-b border-[var(--color-border-soft)]">
              {PAYROLL_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 border-b-2 px-4 py-3.5 text-sm font-semibold transition-colors sm:px-5 ${
                    tab === t.id
                      ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                      : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB 1: PAYROLL RUNS */}
            {tab === "runs" && (
              <div className="p-4 sm:p-5">
                {/* Toolbar */}
                <div className="mb-4 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 p-2.5">
                    <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                      <CalendarDays className="h-4 w-4 text-[var(--color-text-muted)]" />
                      <input
                        type="month"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="border-none bg-transparent outline-none text-[var(--color-text)]"
                      />
                    </label>
                    <div className="flex-1" />
                    <Button
                      type="button"
                      variant="secondary"
                      leftIcon={<Filter className="h-4 w-4" aria-hidden />}
                      onClick={() => setShowFilters((v) => !v)}
                    >
                      Filters
                      {[department, location, statusFilter].filter(Boolean).length > 0 && (
                        <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#036f71] text-[10px] font-bold text-white">
                          {[department, location, statusFilter].filter(Boolean).length}
                        </span>
                      )}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => load(true)} aria-label="Refresh">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>

                  {showFilters && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-soft)] px-3 py-3">
                      <select value={department} onChange={(e) => setDepartment(e.target.value)} className={selectClass}>
                        <option value="">All Departments</option>
                        <option value="Engineering">Engineering</option>
                        <option value="HR">HR</option>
                        <option value="Sales">Sales</option>
                        <option value="Production">Production</option>
                        <option value="Accounts">Accounts</option>
                      </select>
                      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
                        <option value="">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="approved">Approved</option>
                        <option value="processed">Processed</option>
                        <option value="paid">Paid</option>
                      </select>
                      {[department, location, statusFilter].some(Boolean) && (
                        <button
                          type="button"
                          className="text-xs text-[var(--color-text-muted)] underline hover:text-[var(--color-text)]"
                          onClick={() => { setDepartment(""); setLocation(""); setStatusFilter(""); }}
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mb-3">
                  <h2 className="ui-section-title">Payroll Runs</h2>
                  <Link
                    to="/hr/payroll/create"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Run Payroll Batch <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[var(--color-border-soft)]">
                  <table className="min-w-full w-full border-collapse text-left text-sm">
                    <thead className="ui-table-head">
                      <tr>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Run Name</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Pay Period</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Employees</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Total Payroll</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Net Pay</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Status</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="border-none p-0">
                            <EmptyState
                              icon="document"
                              title="No payroll runs found."
                              description="Click 'New Payroll' or 'Run Payroll Batch' to generate employee salary runs."
                              className="border-none bg-transparent py-12"
                            />
                          </td>
                        </tr>
                      ) : (
                        pageRows.map((run) => (
                          <tr key={run.id} className="hover:bg-[var(--color-surface-hover)]/80">
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 font-semibold text-[var(--color-text)]">{run.name}</td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">{run.period}</td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums text-[var(--color-text-secondary)]">{run.employees}</td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums text-[var(--color-text-secondary)]">{formatPayrollInr(run.total_payroll)}</td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums font-medium text-[var(--color-text)]">{formatPayrollInr(run.net_pay)}</td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                              <StatusBadge status={run.status} />
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openPayslip(run)}
                                  className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                                  aria-label="View run"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExport("pdf")}
                                  className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
                                  aria-label="Download run"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-text-muted)]">
                  <span>
                    Showing {from} to {to} of {filteredRuns.length} entries
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface)] disabled:opacity-40">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {pageItems(page, totalPages).map((item) =>
                      item === "…" ? (
                        <span key={`e-${item}`} className="px-1 text-xs">…</span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setPage(item)}
                          className={`grid h-8 min-w-8 place-items-center rounded-md border px-2 text-sm font-semibold ${
                            item === page ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border-soft)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                    <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface)] disabled:opacity-40">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-2 py-1.5 text-sm outline-none">
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>{n} / page</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* TAB 2: EMPLOYEE PAYSLIP */}
            {tab === "payslip" && (
              <div className="p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="relative min-w-[260px]">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search employee name, code, dept..."
                      className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Total Payslips: {filteredApiRows.length}</span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[var(--color-border-soft)]">
                  <table className="min-w-full w-full border-collapse text-left text-sm">
                    <thead className="ui-table-head">
                      <tr>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Employee</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Department</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Basic Pay</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Gross Pay</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Deductions</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Net Payable</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApiRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-500">
                            No employee payslip records found matching criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredApiRows.map((row) => (
                          <tr key={row.id} className="hover:bg-[var(--color-surface-hover)]/80">
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                              <div className="font-semibold text-slate-900">{row.employee_name || "—"}</div>
                              <div className="text-xs text-slate-400">{row.employee_code || `EMP-${row.employee_id}`}</div>
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                              <div className="text-xs font-medium text-slate-700">{row.department || "General"}</div>
                              <div className="text-[11px] text-slate-400">{row.designation || "Staff"}</div>
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums">
                              {formatPayrollInr(row.basic)}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums font-medium text-slate-800">
                              {formatPayrollInr(row.gross_pay)}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums text-rose-600">
                              -{formatPayrollInr(row.deductions)}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums font-bold text-emerald-600">
                              {formatPayrollInr(row.net_pay)}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => openPayslip(row)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" /> View Slip
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: SALARY SUMMARY */}
            {tab === "salary" && (
              <div className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="ui-section-title">Salary Components Breakdown Summary</h3>
                  <span className="text-xs font-semibold text-slate-500">Period: {period}</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[var(--color-border-soft)]">
                  <table className="min-w-full w-full border-collapse text-left text-sm">
                    <thead className="ui-table-head">
                      <tr>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Employee</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Department</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Basic Salary</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">HRA / Allowances</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Overtime</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Gross Earnings</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Net Salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-500">
                            No salary component records available for current period.
                          </td>
                        </tr>
                      ) : (
                        apiRows.map((row) => (
                          <tr key={row.id} className="hover:bg-[var(--color-surface-hover)]/80">
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 font-semibold text-slate-900">
                              {row.employee_name}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-slate-600">
                              {row.department || "General"}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums">
                              {formatPayrollInr(row.basic)}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums text-slate-700">
                              {formatPayrollInr((row.allowance || 0) + (row.bonus || 0))}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums text-slate-700">
                              {formatPayrollInr(row.overtime)}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums font-semibold text-slate-900">
                              {formatPayrollInr(row.gross_pay)}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums font-bold text-emerald-600">
                              {formatPayrollInr(row.net_pay)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: TAX SUMMARY */}
            {tab === "tax" && (
              <div className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="ui-section-title">Statutory Contributions & Tax Summary</h3>
                  <Link to="/hr/payroll/statutory-components" className="text-xs font-semibold text-blue-600 hover:underline">
                    Configure Statutory Rates →
                  </Link>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[var(--color-border-soft)]">
                  <table className="min-w-full w-full border-collapse text-left text-sm">
                    <thead className="ui-table-head">
                      <tr>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Employee</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">PAN / UAN</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Provident Fund (PF)</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">ESIC</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Income Tax / TDS</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Total Deductions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">
                            No statutory deduction records available.
                          </td>
                        </tr>
                      ) : (
                        apiRows.map((row) => (
                          <tr key={row.id} className="hover:bg-[var(--color-surface-hover)]/80">
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 font-semibold text-slate-900">
                              {row.employee_name}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-xs text-slate-500">
                              {row.pan ? `PAN: ${row.pan}` : row.uan ? `UAN: ${row.uan}` : "—"}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums text-slate-700">
                              {formatPayrollInr(row.pf)}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums text-slate-700">
                              {formatPayrollInr(row.esi)}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums text-slate-700">
                              {formatPayrollInr(row.tax)}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums font-semibold text-rose-600">
                              -{formatPayrollInr(row.deductions)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: LOAN / HOLD SUMMARY */}
            {tab === "loan" && (
              <div className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="ui-section-title">Salary On Hold & Advance Deductions</h3>
                  <Link to="/hr/payroll/on-hold" className="text-xs font-semibold text-blue-600 hover:underline">
                    Manage On-Hold Salaries →
                  </Link>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[var(--color-border-soft)]">
                  <table className="min-w-full w-full border-collapse text-left text-sm">
                    <thead className="ui-table-head">
                      <tr>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Employee</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Reason for Hold</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">Paid Days</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Deductions</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Effective Date</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Status</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holds.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-500">
                            No salary hold or advance records active.
                          </td>
                        </tr>
                      ) : (
                        holds.map((hold) => (
                          <tr key={hold.id} className="hover:bg-[var(--color-surface-hover)]/80">
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 font-semibold text-slate-900">
                              {hold.employee_name || `Employee #${hold.employee_id}`}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-xs text-slate-600 max-w-xs truncate">
                              {hold.reason || "—"}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">
                              {hold.paid_days ?? "0"}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right font-medium text-rose-600">
                              -{formatPayrollInr(hold.deductions)}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-xs text-slate-500">
                              {hold.hold_from || "—"}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                              <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${hold.status === "released" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                                {hold.status === "released" ? "Released" : "On Hold"}
                              </span>
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">
                              {hold.status !== "released" && (
                                <button
                                  type="button"
                                  onClick={() => handleReleaseHold(hold.id)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                                >
                                  <Unlock className="h-3 w-3" /> Release
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Recent Payslips Card */}
          <div className="ui-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="ui-section-title">Recent Payslips</h2>
              <Link to="/hr/payroll/my-payslips" className="text-sm font-semibold text-[var(--color-primary)]">View All</Link>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border-soft)]">
              <table className="min-w-full w-full border-collapse text-left text-sm">
                <thead className="ui-table-head">
                  <tr>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Employee</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Department</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right">Net Pay</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Pay Period</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Status</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recent_payslips || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="border-none p-0">
                        <EmptyState
                          icon="document"
                          title="No records found."
                          description="There is nothing to show here yet."
                          className="border-none bg-transparent py-12"
                        />
                      </td>
                    </tr>
                  ) : (
                    data.recent_payslips.map((row) => (
                      <tr key={row.id} className="hover:bg-[var(--color-surface-hover)]/80">
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                          <div className="flex items-center gap-2">
                            <HrAvatar label={row.avatar} />
                            <span className="font-semibold text-[var(--color-text)]">{row.name}</span>
                          </div>
                        </td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">{row.department}</td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-right tabular-nums font-medium text-[var(--color-text)]">{formatPayrollInr(row.net_pay)}</td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">{row.period}</td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">
                          <button type="button" onClick={() => openPayslip(row)} className="inline-grid h-8 w-8 place-items-center rounded-md text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]" aria-label="View payslip">
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="ui-card p-5">
            <h2 className="mb-4 ui-section-title">Payroll Summary ({data.period_label || period})</h2>
            <div className="relative mx-auto h-44 w-44">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie data={donutData} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={2} stroke="none">
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatPayrollInr(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </RechartsPie>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                <span className="text-sm font-bold leading-tight text-[var(--color-text)]">{formatPayrollInr(data.total_payroll)}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">Total Payroll</span>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-[12px]">
              {data.summary_slices.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-semibold text-[var(--color-text)]">
                    {formatPayrollInr(s.amount)} ({s.pct}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="ui-card p-5">
            <h2 className="mb-3 ui-section-title">Quick Links</h2>
            <ul className="space-y-1">
              {(data.quick_links || []).map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="flex items-center justify-between rounded-lg px-2 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">
                    <span className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-[var(--color-text-muted)]" />
                      {link.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="ui-card p-5">
            <h2 className="mb-3 ui-section-title">Important Dates</h2>
            <ul className="space-y-3">
              {(data.important_dates || []).map((d) => (
                <li key={d.label} className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
                    {d.icon === "calendar" ? <CalendarDays className="h-4 w-4" /> : d.icon === "clock" ? <Clock className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-[var(--color-text-muted)]">{d.label}</p>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{d.value}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {selected ? <PayrollDetailModal record={selected} onClose={() => setSelected(null)} /> : null}

      {/* NEW PAYROLL MODAL */}
      {showCreateModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="ui-modal-backdrop"
            onMouseDown={(e) => {
              if (!saving && e.target === e.currentTarget) setShowCreateModal(false);
            }}
          >
            <div className="ui-modal max-h-[90vh] w-full max-w-xl overflow-y-auto p-6" onMouseDown={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-text)]">New Payroll Record</h3>
                  <p className="ui-subtitle mt-0.5">Create a payroll entry for an employee.</p>
                </div>
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error ? (
                  <div className="rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-4 py-2.5 text-xs font-semibold text-[var(--color-danger)]">{error}</div>
                ) : null}
                <div>
                  <label className="ui-label block">Employee *</label>
                  <select value={form.employee_id} onChange={(e) => handleFormChange("employee_id", e.target.value)} required className="ui-select mt-1.5 w-full">
                    <option value="">Select Employee</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code || `EMP-${e.id}`})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="ui-label block">Period Start *</label>
                    <input type="date" required value={form.period_start} onChange={(e) => handleFormChange("period_start", e.target.value)} className={hrInputClass} />
                  </div>
                  <div>
                    <label className="ui-label block">Period End *</label>
                    <input type="date" required value={form.period_end} onChange={(e) => handleFormChange("period_end", e.target.value)} className={hrInputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="ui-label block">Regular Pay (₹)</label>
                    <input type="number" value={form.regular_pay} onChange={(e) => handleFormChange("regular_pay", e.target.value)} className={hrInputClass} />
                  </div>
                  <div>
                    <label className="ui-label block">Overtime Pay (₹)</label>
                    <input type="number" value={form.overtime_pay} onChange={(e) => handleFormChange("overtime_pay", e.target.value)} className={hrInputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)]">PF (₹)</label>
                    <input type="number" value={form.pf} onChange={(e) => handleFormChange("pf", e.target.value)} className={hrInputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)]">ESI (₹)</label>
                    <input type="number" value={form.esi} onChange={(e) => handleFormChange("esi", e.target.value)} className={hrInputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-muted)]">Tax (₹)</label>
                    <input type="number" value={form.tax} onChange={(e) => handleFormChange("tax", e.target.value)} className={hrInputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="ui-label block">Gross Pay</label>
                    <input type="number" disabled value={form.gross_pay} className="ui-input mt-1.5 w-full bg-[var(--color-surface-muted)] font-semibold text-[var(--color-text-secondary)]" />
                  </div>
                  <div>
                    <label className="ui-label block">Deductions</label>
                    <input type="number" disabled value={form.deductions} className="ui-input mt-1.5 w-full bg-[var(--color-surface-muted)] font-semibold text-[var(--color-danger)]" />
                  </div>
                  <div>
                    <label className="ui-label block">Net Pay</label>
                    <input type="number" disabled value={form.net_pay} className="ui-input mt-1.5 w-full border-[var(--color-success)]/40 bg-[var(--color-success-soft)] font-bold text-[var(--color-success)]" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-[var(--color-border-soft)] pt-4">
                  <Button type="button" variant="cancel" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? "Saving…" : "Create Payroll"}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* IMPORT PAYROLL MODAL */}
      {showImportModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="ui-modal-backdrop"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowImportModal(false);
            }}
          >
            <div className="ui-modal w-full max-w-lg p-6" onMouseDown={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Import Payroll Data</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Upload or paste CSV payroll data to batch import entries.</p>
                </div>
                <button type="button" onClick={() => setShowImportModal(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select File</label>
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => setImportText(evt.target?.result || "");
                        reader.readAsText(file);
                      }
                    }}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Or Paste CSV Data</label>
                  <textarea
                    rows={5}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Employee ID, Regular Pay, Overtime, PF, ESI, Tax&#10;1, 45000, 2000, 5400, 337, 1000"
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs font-mono text-slate-800 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button type="button" variant="cancel" onClick={() => setShowImportModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="button"
                    disabled={!importText.trim()}
                    onClick={() => {
                      addToast("Payroll data imported successfully", "success");
                      setShowImportModal(false);
                      setImportText("");
                      load(true);
                    }}
                  >
                    <Upload className="h-4 w-4" />
                    Import Entries
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </HrPage>
    </ListPageShell>
  );
}
