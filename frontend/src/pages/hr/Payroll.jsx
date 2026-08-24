import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  Upload,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Cell, Pie, PieChart as RechartsPie, ResponsiveContainer, Tooltip } from "recharts";

import InventoryRowActionsMenu from "../../components/inventory/InventoryRowActionsMenu";
import Button, { AddButton } from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import PayrollDetailModal from "../../components/hr/PayrollDetailModal";
import usePageRefresh from "../../hooks/usePageRefresh";
import useTenantId from "../../hooks/useTenantId";
import { useToast } from "../../context/ToastContext";
import {
  createPayroll,
  getEmployeeSummary,
  getEmployeesEnriched,
  getPayrollEnriched,
  getPayrollSummary,
} from "../../api/hrApi";
import {
  EMPTY_PAYROLL_DASHBOARD,
  DEMO_PAY_SUMMARY,
  formatPayrollInr,
  mergePayrollDashboard,
  payrollStatusBadgeClass,
} from "../../data/hrMasterData";

const PAYROLL_TABS = [
  { id: "runs", label: "Payroll Runs" },
  { id: "payslip", label: "Employee Payslip" },
  { id: "salary", label: "Salary Summary" },
  { id: "tax", label: "Tax Summary" },
  { id: "loan", label: "Loan Summary" },
];

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all";

function PayKpiCard({ label, value, icon: Icon, tone, trend }) {
  const tones = {
    purple: "bg-[#ede9fe] text-[#7c3aed]",
    green: "bg-[#dcfce7] text-[#16a34a]",
    blue: "bg-[#dbeafe] text-[#2563eb]",
    orange: "bg-[#ffedd5] text-[#ea580c]",
    red: "bg-[#fee2e2] text-[#ef4444]",
  };
  let trendClass = "text-slate-500";
  let trendText = trend?.text || "";
  if (trend?.pct != null) {
    const up = trend.dir === "up";
    trendClass = trend.positive === false ? "text-red-600" : "text-emerald-600";
    trendText = `${up ? "↑" : "↓"} ${trend.pct}% vs last month`;
  }
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-[22px] font-bold leading-tight text-slate-900">{value}</p>
          {trendText ? <p className={`mt-1 text-[11px] font-medium ${trendClass}`}>{trendText}</p> : null}
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function Avatar({ label }) {
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-200 text-[10px] font-bold text-indigo-700">
      {label}
    </div>
  );
}

function StatusBadge({ status }) {
  const key = String(status || "draft").toLowerCase();
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${payrollStatusBadgeClass(key)}`}>
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
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(EMPTY_PAYROLL_DASHBOARD);
  const [apiRows, setApiRows] = useState([]);
  const [tab, setTab] = useState("runs");
  const [period, setPeriod] = useState("2026-08");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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
      const [sumRes, listRes, empSumRes, empListRes] = await Promise.allSettled([
        getPayrollSummary(),
        getPayrollEnriched(),
        getEmployeeSummary(),
        getEmployeesEnriched(),
      ]);
      const summary = sumRes.status === "fulfilled" ? sumRes.value?.data || {} : {};
      const rows = listRes.status === "fulfilled" && Array.isArray(listRes.value?.data) ? listRes.value.data : [];
      const employeeCount = empSumRes.status === "fulfilled" ? empSumRes.value?.data?.total_employees : 0;
      setApiRows(rows);
      setData(mergePayrollDashboard({ summary: { ...DEMO_PAY_SUMMARY, ...summary }, rows, employeeCount }));
      if (empListRes.status === "fulfilled" && Array.isArray(empListRes.value?.data)) {
        setEmployees(empListRes.value.data);
      }
    } catch (err) {
      if (isRefresh) throw err;
      setData(EMPTY_PAYROLL_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const filteredRuns = useMemo(() => {
    return data.payroll_runs.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
  }, [data.payroll_runs, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, pageSize, period]);

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
    const match = apiRows.find((r) => String(r.employee_name) === payslip.name);
    if (match) setSelected(match);
    else addToast(`Payslip preview for ${payslip.name}`, "info");
  };

  if (loading) return <Loader label="Loading payroll..." />;

  return (
    <div className="min-w-0 space-y-5 pb-5">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1e3a5f]">Payroll</h1>
          <p className="mt-1 text-[13px] text-slate-500">Manage and process employee payroll</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddButton type="button" onClick={() => setShowCreateModal(true)}>
            New Payroll Run
          </AddButton>
          <button
            type="button"
            onClick={() => addToast("Import payroll data coming soon", "info")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            Import Data
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            More Actions
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <PayKpiCard label="Total Employees" value={data.total_employees} icon={Users} tone="purple" trend={trends.employees} />
        <PayKpiCard
          label={`Total Payroll (${data.period_label})`}
          value={formatPayrollInr(data.total_payroll)}
          icon={Banknote}
          tone="green"
          trend={trends.total_payroll}
        />
        <PayKpiCard label="Net Pay" value={formatPayrollInr(data.net_pay)} icon={Wallet} tone="blue" trend={trends.net_pay} />
        <PayKpiCard label="Deductions" value={formatPayrollInr(data.deductions)} icon={PieChart} tone="orange" trend={trends.deductions} />
        <PayKpiCard
          label="Pending Approval"
          value={String(data.pending_approval).padStart(2, "0")}
          icon={CalendarDays}
          tone="red"
          trend={trends.pending}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 xl:col-span-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-slate-200">
              {PAYROLL_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 border-b-2 px-4 py-3.5 text-[13px] font-semibold transition-colors sm:px-5 ${
                    tab === t.id
                      ? "border-[#6366f1] text-[#6366f1]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "runs" ? (
              <div className="p-4 sm:p-5">
                {/* Filters */}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    <input
                      type="month"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="border-none bg-transparent outline-none"
                    />
                  </label>
                  <select value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600 outline-none">
                    <option value="">All Departments</option>
                    <option value="Engineering">Engineering</option>
                    <option value="HR">HR</option>
                    <option value="Sales">Sales</option>
                  </select>
                  <select value={location} onChange={(e) => setLocation(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600 outline-none">
                    <option value="">All Locations</option>
                    <option value="HQ">Head Office</option>
                    <option value="Plant">Plant</option>
                  </select>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600 outline-none">
                    <option value="">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                    <option value="paid">Paid</option>
                  </select>
                  <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
                    <Filter className="h-4 w-4" />
                    Filter
                  </button>
                  <button type="button" onClick={() => load(true)} className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50" aria-label="Refresh">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>

                <h2 className="mb-3 text-[15px] font-semibold text-slate-900">Payroll Runs</h2>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full w-full border-collapse text-left text-[13px]">
                    <thead className="bg-[#eef6ff] text-[12px] font-semibold text-slate-700">
                      <tr>
                        <th className="border-b border-slate-200 px-3 py-3">Run Name</th>
                        <th className="border-b border-slate-200 px-3 py-3">Pay Period</th>
                        <th className="border-b border-slate-200 px-3 py-3 text-right">Employees</th>
                        <th className="border-b border-slate-200 px-3 py-3 text-right">Total Payroll</th>
                        <th className="border-b border-slate-200 px-3 py-3 text-right">Net Pay</th>
                        <th className="border-b border-slate-200 px-3 py-3">Status</th>
                        <th className="border-b border-slate-200 px-3 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((run) => (
                        <tr key={run.id} className="hover:bg-slate-50/80">
                          <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-800">{run.name}</td>
                          <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{run.period}</td>
                          <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums text-slate-700">{run.employees}</td>
                          <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums text-slate-700">{formatPayrollInr(run.total_payroll)}</td>
                          <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums font-medium text-slate-800">{formatPayrollInr(run.net_pay)}</td>
                          <td className="border-b border-slate-100 px-3 py-3">
                            <StatusBadge status={run.status} />
                          </td>
                          <td className="border-b border-slate-100 px-3 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-[#6366f1] hover:bg-indigo-50" aria-label="View run">
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => addToast("Downloading payroll run…", "success")}
                                className="grid h-8 w-8 place-items-center rounded-md text-[#6366f1] hover:bg-indigo-50"
                                aria-label="Download run"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <InventoryRowActionsMenu
                                rowId={run.id}
                                isOpen={menuId === run.id}
                                onOpen={setMenuId}
                                onClose={() => setMenuId(null)}
                                onView={() => addToast(`View ${run.name}`, "info")}
                                onEdit={() => addToast(`Edit ${run.name}`, "info")}
                                showAdd={false}
                                showDelete={run.status === "draft"}
                                onDelete={() => addToast(`Delete ${run.name}`, "info")}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-slate-500">
                  <span>
                    Showing {from} to {to} of {filteredRuns.length} entries
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white disabled:opacity-40">
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
                          className={`grid h-8 min-w-8 place-items-center rounded-md border px-2 text-[13px] font-semibold ${
                            item === page ? "border-[#6366f1] bg-[#6366f1] text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                    <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white disabled:opacity-40">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] outline-none">
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>{n} / page</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-[13px] text-slate-500">
                {PAYROLL_TABS.find((t) => t.id === tab)?.label} view — use Payroll Runs for the full dashboard.
              </div>
            )}
          </div>

          {/* Recent Payslips */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-slate-900">Recent Payslips</h2>
              <Link to="/hr/payroll" className="text-[13px] font-semibold text-[#6366f1]">View All</Link>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full w-full border-collapse text-left text-[13px]">
                <thead className="bg-[#eef6ff] text-[12px] font-semibold text-slate-700">
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-3">Employee</th>
                    <th className="border-b border-slate-200 px-3 py-3">Department</th>
                    <th className="border-b border-slate-200 px-3 py-3 text-right">Net Pay</th>
                    <th className="border-b border-slate-200 px-3 py-3">Pay Period</th>
                    <th className="border-b border-slate-200 px-3 py-3">Status</th>
                    <th className="border-b border-slate-200 px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_payslips.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="border-b border-slate-100 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar label={row.avatar} />
                          <span className="font-semibold text-slate-800">{row.name}</span>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.department}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-right tabular-nums font-medium text-slate-800">{formatPayrollInr(row.net_pay)}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.period}</td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-center">
                        <button type="button" onClick={() => openPayslip(row)} className="inline-grid h-8 w-8 place-items-center rounded-md text-[#6366f1] hover:bg-indigo-50" aria-label="View payslip">
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-[15px] font-semibold text-slate-900">Payroll Summary ({data.period_label})</h2>
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
                <span className="text-[13px] font-bold leading-tight text-slate-900">{formatPayrollInr(data.total_payroll)}</span>
                <span className="text-[10px] text-slate-500">Total Payroll</span>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-[12px]">
              {data.summary_slices.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {formatPayrollInr(s.amount)} ({s.pct}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-[15px] font-semibold text-slate-900">Quick Links</h2>
            <ul className="space-y-1">
              {data.quick_links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="flex items-center justify-between rounded-lg px-2 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                    <span className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-slate-400" />
                      {link.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-[15px] font-semibold text-slate-900">Important Dates</h2>
            <ul className="space-y-3">
              {data.important_dates.map((d) => (
                <li key={d.label} className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                    {d.icon === "calendar" ? <CalendarDays className="h-4 w-4" /> : d.icon === "clock" ? <Clock className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-slate-500">{d.label}</p>
                    <p className="text-[13px] font-semibold text-slate-800">{d.value}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {selected ? <PayrollDetailModal record={selected} onClose={() => setSelected(null)} /> : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">New Payroll Run</h3>
                <p className="mt-0.5 text-xs text-slate-500">Create a payroll entry for an employee.</p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">{error}</div>
              ) : null}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Employee *</label>
                <select value={form.employee_id} onChange={(e) => handleFormChange("employee_id", e.target.value)} required className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-[#6366f1]">
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Period Start *</label>
                  <input type="date" required value={form.period_start} onChange={(e) => handleFormChange("period_start", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Period End *</label>
                  <input type="date" required value={form.period_end} onChange={(e) => handleFormChange("period_end", e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Regular Pay (₹)</label>
                  <input type="number" value={form.regular_pay} onChange={(e) => handleFormChange("regular_pay", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Overtime Pay (₹)</label>
                  <input type="number" value={form.overtime_pay} onChange={(e) => handleFormChange("overtime_pay", e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500">PF (₹)</label>
                  <input type="number" value={form.pf} onChange={(e) => handleFormChange("pf", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500">ESI (₹)</label>
                  <input type="number" value={form.esi} onChange={(e) => handleFormChange("esi", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500">Tax (₹)</label>
                  <input type="number" value={form.tax} onChange={(e) => handleFormChange("tax", e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Gross Pay</label>
                  <input type="number" disabled value={form.gross_pay} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Deductions</label>
                  <input type="number" disabled value={form.deductions} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-red-600" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Net Pay</label>
                  <input type="number" disabled value={form.net_pay} className="mt-1.5 w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700" />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <Button variant="primary" type="submit" disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving…" : "Create Payroll"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
