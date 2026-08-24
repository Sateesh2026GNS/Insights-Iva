import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CalendarX,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  Pencil,
  Plane,
  Plus,
  RefreshCw,
  Save,
  Users,
  X,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import InventoryRowActionsMenu from "../../components/inventory/InventoryRowActionsMenu";
import Button, { AddButton } from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import {
  createLeaveRequest,
  getEmployeeSummary,
  getEmployeesEnriched,
  getLeaveEnriched,
  getLeaveSummary,
  updateLeaveRequest,
} from "../../api/hrApi";
import {
  EMPTY_LEAVE_DASHBOARD,
  DEMO_LEAVE_SUMMARY,
  formatLeaveDate,
  leaveStatusBadgeClass,
  leaveTypeBadgeClass,
  leaveTypeLabel,
  mergeLeaveDashboard,
} from "../../data/hrMasterData";

const LEAVE_TABS = [
  { id: "all", label: "All Requests" },
  { id: "pending", label: "Pending Approval" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "cancelled", label: "Cancelled" },
];

const ALL_LEAVE_TYPES = [
  { value: "casual", label: "Casual Leave (CL)" },
  { value: "sick", label: "Sick / Medical Leave (SL)" },
  { value: "earned", label: "Earned / Privilege Leave (EL/PL)" },
  { value: "annual", label: "Annual Leave" },
  { value: "maternity", label: "Maternity Leave" },
  { value: "paternity", label: "Paternity Leave" },
  { value: "comp_off", label: "Compensatory Off (Comp-Off)" },
  { value: "marriage", label: "Marriage Leave" },
  { value: "bereavement", label: "Bereavement Leave" },
  { value: "study", label: "Study / Training Leave" },
  { value: "unpaid", label: "Loss of Pay (LOP) / Unpaid Leave" },
];

const AVATAR_TONES = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
];

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all";

function avatarTone(label) {
  let h = 0;
  for (let i = 0; i < String(label).length; i += 1) h += label.charCodeAt(i);
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

function LeaveKpiCard({ label, value, icon: Icon, tone, trend }) {
  const tones = {
    purple: "bg-[#ede9fe] text-[#7c3aed]",
    green: "bg-[#dcfce7] text-[#16a34a]",
    orange: "bg-[#ffedd5] text-[#ea580c]",
    blue: "bg-[#dbeafe] text-[#2563eb]",
    red: "bg-[#fee2e2] text-[#ef4444]",
  };
  let trendClass = "text-slate-500";
  let trendText = trend?.text || "";
  if (trend?.pct != null) {
    const up = trend.dir === "up";
    if (trend.positive === false && up) trendClass = "text-orange-600";
    else if (trend.positive === false && !up) trendClass = "text-red-600";
    else trendClass = up ? "text-emerald-600" : "text-red-600";
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
    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${avatarTone(label)}`}>
      {label}
    </div>
  );
}

function LeaveTypeBadge({ type }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${leaveTypeBadgeClass(type)}`}>
      {leaveTypeLabel(type)}
    </span>
  );
}

function LeaveStatusBadge({ status }) {
  const key = String(status || "pending").toLowerCase();
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${leaveStatusBadgeClass(key)}`}>
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

export default function Leave({ autoOpenCreate = false }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(EMPTY_LEAVE_DASHBOARD);
  const [employees, setEmployees] = useState([]);
  const [tab, setTab] = useState("all");
  const [dateFrom, setDateFrom] = useState("2026-08-01");
  const [dateTo, setDateTo] = useState("2026-08-31");
  const [department, setDepartment] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [menuId, setMenuId] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(autoOpenCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    employee_id: "",
    leave_type: "casual",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: "",
  });

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes, empSumRes, empListRes] = await Promise.allSettled([
        getLeaveSummary(),
        getLeaveEnriched(),
        getEmployeeSummary(),
        getEmployeesEnriched(),
      ]);
      const summary = sumRes.status === "fulfilled" ? { ...DEMO_LEAVE_SUMMARY, ...sumRes.value?.data } : {};
      const rows = listRes.status === "fulfilled" && Array.isArray(listRes.value?.data) ? listRes.value.data : [];
      const employeeCount = empSumRes.status === "fulfilled" ? empSumRes.value?.data?.total_employees : 0;
      const emps = empListRes.status === "fulfilled" && Array.isArray(empListRes.value?.data) ? empListRes.value.data : [];
      const deptByName = Object.fromEntries(emps.map((e) => [e.full_name, e.department || "—"]));
      setEmployees(emps);
      setData(mergeLeaveDashboard({ summary, rows, employeeCount, deptByName }));
    } catch (err) {
      if (isRefresh) throw err;
      setData(EMPTY_LEAVE_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (autoOpenCreate) setShowCreateModal(true);
  }, [autoOpenCreate]);

  const departments = useMemo(() => {
    const set = new Set(data.requests.map((r) => r.department).filter(Boolean));
    return [...set].sort();
  }, [data.requests]);

  const filtered = useMemo(() => {
    return data.requests.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (department && r.department !== department) return false;
      if (leaveType && r.leave_type !== leaveType) return false;
      if (dateFrom && r.start_date < dateFrom) return false;
      if (dateTo && r.end_date > dateTo) return false;
      return true;
    });
  }, [data.requests, tab, statusFilter, department, leaveType, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [tab, statusFilter, department, leaveType, dateFrom, dateTo, pageSize]);

  const displayTotal =
    filtered.length === data.requests.length && data.total_requests > filtered.length
      ? data.total_requests
      : filtered.length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const from = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, filtered.length);

  const donutData = (data.status_slices || []).map((s) => ({
    name: s.label,
    value: s.count,
    color: s.color,
    pct: s.pct,
  }));
  const donutTotal = data.leaves_taken;
  const trends = data.kpi_trends || {};

  const handleStatus = async (id, status) => {
    if (typeof id !== "number") {
      addToast("Invalid leave request.", "error");
      return;
    }
    try {
      await updateLeaveRequest(id, { status });
      addToast(`Leave ${status}`, "success");
      load();
    } catch (err) {
      addToast(err.response?.data?.detail || "Update failed", "error");
    }
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.start_date || !form.end_date) {
      setError("Select employee and date range.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createLeaveRequest({
        employee_id: Number(form.employee_id),
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason.trim() || null,
        status: "pending",
      });
      addToast("Leave request submitted successfully", "success");
      setShowCreateModal(false);
      setForm({
        employee_id: "",
        leave_type: "casual",
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date().toISOString().slice(0, 10),
        reason: "",
      });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit leave request.");
      addToast("Failed to submit request", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading leave requests..." />;

  return (
    <div className="min-w-0 space-y-5 pb-5">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1e3a5f]">Leave Management</h1>
          <p className="mt-1 text-[13px] text-slate-500">Manage and track employee leave requests</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddButton type="button" onClick={() => setShowCreateModal(true)}>
            Apply Leave
          </AddButton>
          <button
            type="button"
            onClick={() => addToast("Leave calendar coming soon", "info")}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-[#6366f1] hover:bg-indigo-50"
          >
            <CalendarDays className="h-4 w-4" />
            Leave Calendar
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
        <LeaveKpiCard label="Total Employees" value={data.total_employees} icon={Users} tone="purple" trend={trends.employees} />
        <LeaveKpiCard label="Leaves Taken" value={data.leaves_taken} icon={CalendarDays} tone="green" trend={trends.leaves_taken} />
        <LeaveKpiCard
          label="On Leave Today"
          value={String(data.on_leave_today).padStart(2, "0")}
          icon={Plane}
          tone="orange"
          trend={trends.on_leave_today}
        />
        <LeaveKpiCard
          label="Pending Requests"
          value={String(data.pending_requests).padStart(2, "0")}
          icon={Clock}
          tone="blue"
          trend={trends.pending}
        />
        <LeaveKpiCard
          label="Rejected Requests"
          value={String(data.rejected_requests).padStart(2, "0")}
          icon={CalendarX}
          tone="red"
          trend={trends.rejected}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Main column */}
        <div className="xl:col-span-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-slate-200">
              {LEAVE_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    if (t.id !== "all") setStatusFilter("");
                  }}
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

            <div className="p-4 sm:p-5">
              {/* Filters */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border-none bg-transparent outline-none" />
                  <span className="text-slate-400">–</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border-none bg-transparent outline-none" />
                </label>
                <select value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600 outline-none">
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600 outline-none">
                  <option value="">All Leave Types</option>
                  {ALL_LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600 outline-none">
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
                  <Filter className="h-4 w-4" />
                  Filter
                </button>
                <button type="button" onClick={() => load(true)} className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50" aria-label="Refresh">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full w-full border-collapse text-left text-[13px]">
                  <thead className="bg-[#eef6ff] text-[12px] font-semibold text-slate-700">
                    <tr>
                      <SerialNumberHeader className="border-b border-slate-200 px-3 py-3" />
                      <th className="border-b border-slate-200 px-3 py-3 min-w-[160px]">Employee</th>
                      <th className="border-b border-slate-200 px-3 py-3">Department</th>
                      <th className="border-b border-slate-200 px-3 py-3">Leave Type</th>
                      <th className="border-b border-slate-200 px-3 py-3">From Date</th>
                      <th className="border-b border-slate-200 px-3 py-3">To Date</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-center">Days</th>
                      <th className="border-b border-slate-200 px-3 py-3">Status</th>
                      <th className="border-b border-slate-200 px-3 py-3">Applied On</th>
                      <th className="border-b border-slate-200 px-3 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                          No leave requests match your filters.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, rowIndex) => (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="border-b border-slate-100 px-3 py-3" />
                          <td className="border-b border-slate-100 px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar label={row.avatar} />
                              <span className="font-semibold text-slate-800">{row.employee_name}</span>
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.department}</td>
                          <td className="border-b border-slate-100 px-3 py-3">
                            <LeaveTypeBadge type={row.leave_type} />
                          </td>
                          <td className="border-b border-slate-100 px-3 py-3 whitespace-nowrap text-slate-600">{formatLeaveDate(row.start_date)}</td>
                          <td className="border-b border-slate-100 px-3 py-3 whitespace-nowrap text-slate-600">{formatLeaveDate(row.end_date)}</td>
                          <td className="border-b border-slate-100 px-3 py-3 text-center tabular-nums text-slate-700">{row.days}</td>
                          <td className="border-b border-slate-100 px-3 py-3">
                            <LeaveStatusBadge status={row.status} />
                          </td>
                          <td className="border-b border-slate-100 px-3 py-3 whitespace-nowrap text-slate-600">{formatLeaveDate(row.applied_on)}</td>
                          <td className="border-b border-slate-100 px-3 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => addToast(`View leave for ${row.employee_name}`, "info")}
                                className="grid h-8 w-8 place-items-center rounded-md text-[#6366f1] hover:bg-indigo-50"
                                aria-label="View"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => addToast(`Edit leave for ${row.employee_name}`, "info")}
                                className="grid h-8 w-8 place-items-center rounded-md text-[#2563eb] hover:bg-blue-50"
                                aria-label="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <InventoryRowActionsMenu
                                rowId={row.id}
                                isOpen={menuId === row.id}
                                onOpen={setMenuId}
                                onClose={() => setMenuId(null)}
                                onView={() => addToast(`View ${row.employee_name}`, "info")}
                                onEdit={() => addToast(`Edit ${row.employee_name}`, "info")}
                                showAdd={false}
                                showDelete={row.status === "pending"}
                                onDelete={() => handleStatus(row.id, "cancelled")}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-slate-500">
                <span>
                  Showing {from} to {to} of {displayTotal} entries
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
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-[15px] font-semibold text-slate-900">Leave Status Overview</h2>
            <div className="relative mx-auto h-44 w-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={2} stroke="none">
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[20px] font-bold text-slate-900">{donutTotal}</span>
                <span className="text-[11px] text-slate-500">Total</span>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-[12px]">
              {donutData.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {d.value} ({d.pct}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-slate-900">Leave Balance Summary</h2>
              <Link to="/hr/leave" className="text-[13px] font-semibold text-[#6366f1]">View All</Link>
            </div>
            <ul className="space-y-4">
              {data.leave_balances.map((bal) => {
                const pct = bal.total ? Math.min(100, (bal.used / bal.total) * 100) : 0;
                return (
                  <li key={bal.key}>
                    <div className="mb-1.5 flex items-center justify-between text-[12px]">
                      <span className="font-medium text-slate-700">{bal.label}</span>
                      <span className="font-semibold text-slate-800">
                        {bal.used} / {bal.total} days
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: bal.color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-slate-900">Upcoming Holidays</h2>
              <button type="button" onClick={() => addToast("Holiday calendar coming soon", "info")} className="text-[13px] font-semibold text-[#6366f1]">
                View Calendar
              </button>
            </div>
            <ul className="space-y-3 text-[13px]">
              {data.upcoming_holidays.map((h) => (
                <li key={h.name} className="flex flex-wrap items-baseline gap-x-2 text-slate-600">
                  <span className="font-semibold text-slate-800">{h.date}</span>
                  <span className="text-slate-400">|</span>
                  <span>{h.day}</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-700">{h.name}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] font-medium text-slate-500">
              Total Holidays: {data.total_holidays}
            </p>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Apply Leave</h3>
                <p className="text-xs text-slate-500 mt-0.5">Submit a new employee leave request.</p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Employee *</label>
                <select
                  value={form.employee_id}
                  onChange={(e) => handleFormChange("employee_id", e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="">Select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Leave Type</label>
                <select value={form.leave_type} onChange={(e) => handleFormChange("leave_type", e.target.value)} className={inputClass}>
                  {ALL_LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Start Date *</label>
                  <input type="date" required value={form.start_date} onChange={(e) => handleFormChange("start_date", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">End Date *</label>
                  <input type="date" required value={form.end_date} onChange={(e) => handleFormChange("end_date", e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Reason</label>
                <textarea
                  rows={3}
                  placeholder="Describe reason for leave request..."
                  value={form.reason}
                  onChange={(e) => handleFormChange("reason", e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <Button variant="primary" type="submit" disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Submit Request"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
