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
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageShell } from "../../components/common/ListPageShell";
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

import {
  HrAvatar,
  HrKpiCard,
  HrPage,
  HrPageHeader,
  HrPanel,
  HrViewAllLink,
  avatarTone,
  hrInputClass,
} from "../../components/hr/hrUi";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const selectClass = "ui-select !w-auto min-w-[8.5rem]";

const LEAVE_EXPORT_COLUMNS = [
  { key: "employee_name", label: "Employee" },
  { key: "department", label: "Department" },
  { key: "leave_type", label: "Leave Type" },
  { key: "start_date", label: "From Date" },
  { key: "end_date", label: "To Date" },
  { key: "days", label: "Days" },
  { key: "status", label: "Status" },
  { key: "applied_on", label: "Applied On" },
];

function LeaveTypeBadge({ type }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${leaveTypeBadgeClass(type)}`}>
      {leaveTypeLabel(type)}
    </span>
  );
}

function LeaveStatusBadge({ status }) {
  const key = String(status || "pending").toLowerCase();
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${leaveStatusBadgeClass(key)}`}>
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
      const summary = sumRes.status === "fulfilled" ? sumRes.value?.data || {} : {};
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

  const exportRows = filtered.map((r) => ({
    employee_name: r.employee_name || r.name,
    department: r.department,
    leave_type: leaveTypeLabel(r.leave_type),
    start_date: formatLeaveDate(r.start_date),
    end_date: formatLeaveDate(r.end_date),
    days: r.days,
    status: String(r.status || "").replace(/_/g, " "),
    applied_on: formatLeaveDate(r.applied_on),
  }));

  const handleExport = (format) => {
    if (format === "pdf") {
      exportToPdf(exportRows, LEAVE_EXPORT_COLUMNS, "Leave Requests", "leave-requests");
    } else {
      exportToExcel(exportRows, LEAVE_EXPORT_COLUMNS, "leave-requests");
    }
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <ListPageShell>
    <HrPage>
      <HrPageHeader
        title="Leave Management"
        subtitle="Manage and track employee leave requests"
        action={
          <>
          <AddButton type="button" onClick={() => setShowCreateModal(true)}>
            Apply Leave
          </AddButton>
          <ExportDownloadMenu disabled={!exportRows.length} onExport={handleExport} />
          <Button
            type="button"
            variant="secondary"
            onClick={() => addToast("Leave calendar coming soon", "info")}
            leftIcon={<CalendarDays className="h-4 w-4" aria-hidden />}
          >
            Leave Calendar
          </Button>
          <Button type="button" variant="secondary" rightIcon={<ChevronDown className="h-4 w-4" aria-hidden />}>
            More Actions
          </Button>
          </>
        }
      />

      <div className="ui-grid-kpi">
        <HrKpiCard label="Total Employees" value={data.total_employees} icon={Users} tone="purple" trend={trends.employees} />
        <HrKpiCard label="Leaves Taken" value={data.leaves_taken} icon={CalendarDays} tone="green" trend={trends.leaves_taken} />
        <HrKpiCard
          label="On Leave Today"
          value={String(data.on_leave_today).padStart(2, "0")}
          icon={Plane}
          tone="orange"
          trend={trends.on_leave_today}
        />
        <HrKpiCard
          label="Pending Requests"
          value={String(data.pending_requests).padStart(2, "0")}
          icon={Clock}
          tone="blue"
          trend={trends.pending}
        />
        <HrKpiCard
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
          <div className="ui-card shadow-sm">
            <div className="flex overflow-x-auto border-b border-[var(--color-border-soft)]">
              {LEAVE_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    if (t.id !== "all") setStatusFilter("");
                  }}
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

            <div className="p-4 sm:p-5">
              {/* Filters */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                  <CalendarDays className="h-4 w-4 text-[var(--color-text-muted)]" />
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border-none bg-transparent outline-none text-[var(--color-text)]" />
                  <span className="text-[var(--color-text-muted)]">–</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border-none bg-transparent outline-none text-[var(--color-text)]" />
                </label>
                <select value={department} onChange={(e) => setDepartment(e.target.value)} className={selectClass}>
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className={selectClass}>
                  <option value="">All Leave Types</option>
                  {ALL_LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <Button type="button" variant="secondary" leftIcon={<Filter className="h-4 w-4" aria-hidden />}>
                  Filter
                </Button>
                <Button type="button" variant="secondary" onClick={() => load(true)} aria-label="Refresh">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="ui-table-wrap ui-table-wrap--scroll">
                <table className="ui-table min-w-full w-full border-collapse text-left text-sm">
                  <thead className="ui-table-head">
                    <tr>
                      <SerialNumberHeader className="border-b border-[var(--color-border-soft)] px-3 py-3" />
                      <th className="border-b border-[var(--color-border-soft)] px-3 py-3 min-w-[160px]">Employee</th>
                      <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Department</th>
                      <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Leave Type</th>
                      <th className="border-b border-[var(--color-border-soft)] px-3 py-3">From Date</th>
                      <th className="border-b border-[var(--color-border-soft)] px-3 py-3">To Date</th>
                      <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">Days</th>
                      <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Status</th>
                      <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Applied On</th>
                      <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-[var(--color-text-muted)]">
                          No leave requests match your filters.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, rowIndex) => (
                        <tr key={row.id} className="hover:bg-[var(--color-surface-muted)]/80">
                          <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="border-b border-[var(--color-border-soft)] px-3 py-3" />
                          <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                            <div className="flex items-center gap-2">
                              <HrAvatar label={row.avatar} />
                              <span className="font-semibold text-[var(--color-text)]">{row.employee_name}</span>
                            </div>
                          </td>
                          <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">{row.department}</td>
                          <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                            <LeaveTypeBadge type={row.leave_type} />
                          </td>
                          <td className="border-b border-[var(--color-border-soft)] px-3 py-3 whitespace-nowrap text-[var(--color-text-secondary)]">{formatLeaveDate(row.start_date)}</td>
                          <td className="border-b border-[var(--color-border-soft)] px-3 py-3 whitespace-nowrap text-[var(--color-text-secondary)]">{formatLeaveDate(row.end_date)}</td>
                          <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center tabular-nums text-[var(--color-text)]">{row.days}</td>
                          <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                            <LeaveStatusBadge status={row.status} />
                          </td>
                          <td className="border-b border-[var(--color-border-soft)] px-3 py-3 whitespace-nowrap text-[var(--color-text-secondary)]">{formatLeaveDate(row.applied_on)}</td>
                          <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => addToast(`View leave for ${row.employee_name}`, "info")}
                                className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-primary)] hover:bg-indigo-50"
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

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-text-muted)]">
                <span>
                  Showing {from} to {to} of {displayTotal} entries
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
                          item === page ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border-soft)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
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
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="ui-select !w-auto">
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
          <div className="ui-card p-5 shadow-sm">
            <h2 className="mb-4 ui-section-title">Leave Status Overview</h2>
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
                <span className="text-[20px] font-bold text-[var(--color-text)]">{donutTotal}</span>
                <span className="text-xs text-[var(--color-text-muted)]">Total</span>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-[12px]">
              {donutData.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-semibold text-[var(--color-text)]">
                    {d.value} ({d.pct}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="ui-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="ui-section-title">Leave Balance Summary</h2>
              <Link to="/hr/leave" className="text-sm font-semibold text-[var(--color-primary)]">View All</Link>
            </div>
            <ul className="space-y-4">
              {data.leave_balances.map((bal) => {
                const pct = bal.total ? Math.min(100, (bal.used / bal.total) * 100) : 0;
                return (
                  <li key={bal.key}>
                    <div className="mb-1.5 flex items-center justify-between text-[12px]">
                      <span className="font-medium text-[var(--color-text)]">{bal.label}</span>
                      <span className="font-semibold text-[var(--color-text)]">
                        {bal.used} / {bal.total} days
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: bal.color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="ui-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="ui-section-title">Upcoming Holidays</h2>
              <button type="button" onClick={() => addToast("Holiday calendar coming soon", "info")} className="text-sm font-semibold text-[var(--color-primary)]">
                View Calendar
              </button>
            </div>
            <ul className="space-y-3 text-sm">
              {data.upcoming_holidays.map((h) => (
                <li key={h.name} className="flex flex-wrap items-baseline gap-x-2 text-[var(--color-text-secondary)]">
                  <span className="font-semibold text-[var(--color-text)]">{h.date}</span>
                  <span className="text-[var(--color-text-muted)]">|</span>
                  <span>{h.day}</span>
                  <span className="text-[var(--color-text-muted)]">|</span>
                  <span className="text-[var(--color-text)]">{h.name}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] font-medium text-[var(--color-text-muted)]">
              Total Holidays: {data.total_holidays}
            </p>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="ui-modal-backdrop">
          <div className="ui-modal max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text)]">Apply Leave</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Submit a new employee leave request.</p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]">
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
                <label className="ui-label">Employee *</label>
                <select
                  value={form.employee_id}
                  onChange={(e) => handleFormChange("employee_id", e.target.value)}
                  required
                  className="ui-select w-full"
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
                <label className="ui-label">Leave Type</label>
                <select value={form.leave_type} onChange={(e) => handleFormChange("leave_type", e.target.value)} className="ui-select w-full">
                  {ALL_LEAVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ui-label">Start Date *</label>
                  <input type="date" required value={form.start_date} onChange={(e) => handleFormChange("start_date", e.target.value)} className="ui-input w-full" />
                </div>
                <div>
                  <label className="ui-label">End Date *</label>
                  <input type="date" required value={form.end_date} onChange={(e) => handleFormChange("end_date", e.target.value)} className="ui-input w-full" />
                </div>
              </div>

              <div>
                <label className="ui-label">Reason</label>
                <textarea
                  rows={3}
                  placeholder="Describe reason for leave request..."
                  value={form.reason}
                  onChange={(e) => handleFormChange("reason", e.target.value)}
                  className="ui-input w-full min-h-[5rem]"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--color-border-soft)] pt-4">
                <Button type="button" variant="cancel" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Submit Request"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </HrPage>
    </ListPageShell>
  );
}
