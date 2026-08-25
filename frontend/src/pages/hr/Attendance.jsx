import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  Download,
  Eye,
  Filter,
  MoreVertical,
  Pencil,
  Plane,
  RefreshCw,
  Settings,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import {
  HrAvatar,
  HrKpiCard,
  HrPage,
  HrPageHeader,
  HrPanel,
} from "../../components/hr/hrUi";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import {
  getAttendanceEnriched,
  getAttendanceSummary,
  getEmployeeSummary,
} from "../../api/hrApi";
import {
  ATTENDANCE_STATUS_COLORS,
  EMPTY_ATTENDANCE_DASHBOARD,
  attendanceStatusBadgeClass,
  attendanceStatusLabel,
  mergeAttendanceDashboard,
} from "../../data/hrMasterData";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${attendanceStatusBadgeClass(status)}`}>
      {attendanceStatusLabel(status)}
    </span>
  );
}

function AttendanceCalendar({ year, month, selectedIso, marks, onSelectDay }) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const markColor = (key) => ATTENDANCE_STATUS_COLORS[key]?.fill || "#94a3b8";

  return (
    <div>
      <div className="mb-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="h-9" />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isSelected = iso === selectedIso;
          const mark = marks[iso];
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDay?.(iso)}
              className={`relative grid h-9 place-items-center rounded-lg text-[12px] font-medium transition-colors ${
                isSelected ? "bg-[#6366f1] text-white" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {day}
              {mark && !isSelected ? (
                <span
                  className="absolute bottom-1 h-1.5 w-1.5 rounded-full"
                  style={{ background: markColor(mark) }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
        {["present", "late", "absent", "on_leave", "holiday"].map((key) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: ATTENDANCE_STATUS_COLORS[key].fill }} />
            {ATTENDANCE_STATUS_COLORS[key].label}
          </span>
        ))}
      </div>
    </div>
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

export default function Attendance() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(EMPTY_ATTENDANCE_DASHBOARD);
  const [recordDate, setRecordDate] = useState(todayIso());
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [location, setLocation] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState(7);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes, empRes] = await Promise.allSettled([
        getAttendanceSummary({ record_date: recordDate }),
        getAttendanceEnriched({ record_date: recordDate }),
        getEmployeeSummary(),
      ]);
      const summary = sumRes.status === "fulfilled" ? sumRes.value?.data || {} : {};
      const rows = listRes.status === "fulfilled" ? listRes.value?.data || [] : [];
      const employeeCount = empRes.status === "fulfilled" ? empRes.value?.data?.total_employees : 0;
      setData(mergeAttendanceDashboard({ summary, rows, employeeCount }));
    } catch (err) {
      if (isRefresh) throw err;
      setData(EMPTY_ATTENDANCE_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, [addToast, recordDate]);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const departments = useMemo(
    () => [...new Set(data.records.map((r) => r.department).filter(Boolean))],
    [data.records]
  );

  const filteredRecords = useMemo(() => {
    return data.records.filter((r) => {
      if (department && r.department !== department) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (designation && !String(r.name).toLowerCase().includes(designation.toLowerCase())) return false;
      if (location && !String(r.department).toLowerCase().includes(location.toLowerCase())) return false;
      return true;
    });
  }, [data.records, department, designation, location, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [department, designation, location, statusFilter, recordDate, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const pageRows = filteredRecords.slice((page - 1) * pageSize, page * pageSize);
  const from = filteredRecords.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, filteredRecords.length);

  const donutData = data.summary_slices.map((s) => ({
    name: ATTENDANCE_STATUS_COLORS[s.key]?.label || s.key,
    value: s.count,
    color: ATTENDANCE_STATUS_COLORS[s.key]?.fill || "#94a3b8",
    pct: s.pct,
  }));

  const trends = data.kpi_trends || {};

  const goPrevMonth = () => {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  if (loading) return <Loader label="Loading attendance..." />;

  return (
    <HrPage>
      <HrPageHeader
        title="Attendance"
        subtitle="Track and manage employee attendance"
        action={
          <>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            onClick={() => addToast("Upload attendance coming soon", "info")}
          >
            <Upload className="h-4 w-4" />
            Upload Attendance
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"
            onClick={() => addToast("Report download started", "success")}
          >
            <Download className="h-4 w-4" />
            Attendance Report
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
            aria-label="More actions"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          </>
        }
      />

      <div className="ui-grid-kpi">
        <HrKpiCard label="Total Employees" value={data.total_employees} icon={Users} tone="purple" trend={trends.employees} />
        <HrKpiCard label="Present Today" value={data.present_today} icon={CircleCheck} tone="green" trend={trends.present} />
        <HrKpiCard label="On Leave" value={String(data.on_leave).padStart(2, "0")} icon={Plane} tone="orange" trend={trends.leave} />
        <HrKpiCard label="Late Today" value={data.late_today} icon={Clock} tone="blue" trend={trends.late} />
        <HrKpiCard label="Absent Today" value={data.absent_today} icon={XCircle} tone="red" trend={trends.absent} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={recordDate}
            onChange={(e) => setRecordDate(e.target.value)}
            className="border-none bg-transparent text-sm outline-none"
          />
        </label>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none">
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={designation} onChange={(e) => setDesignation(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none">
          <option value="">All Designations</option>
          <option value="manager">Manager</option>
          <option value="engineer">Engineer</option>
          <option value="executive">Executive</option>
        </select>
        <select value={location} onChange={(e) => setLocation(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none">
          <option value="">All Locations</option>
          <option value="engineering">Engineering</option>
          <option value="hr">HR</option>
          <option value="sales">Sales</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none">
          <option value="">All Status</option>
          <option value="present">Present</option>
          <option value="late">Late</option>
          <option value="absent">Absent</option>
          <option value="on_leave">On Leave</option>
        </select>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <Filter className="h-4 w-4" />
          Filter
        </button>
        <button
          type="button"
          onClick={() => load(true)}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
          aria-label="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Middle widgets */}
      <div className="grid gap-4 xl:grid-cols-3">
        <HrPanel title="Attendance Summary">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={48} outerRadius={68} paddingAngle={2} stroke="none">
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[20px] font-bold text-slate-900">{data.total_employees}</span>
                <span className="text-xs text-slate-500">Total</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2 text-[12px]">
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
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[12px]">
              <span className="font-medium text-slate-600">Attendance %</span>
              <span className="font-bold text-emerald-600">{data.attendance_pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${data.attendance_pct}%` }} />
            </div>
          </div>
        </HrPanel>

        <HrPanel
          title="Attendance Calendar"
          action={
            <div className="flex items-center gap-1">
              <button type="button" onClick={goPrevMonth} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[88px] text-center text-sm font-semibold text-slate-700">
                {MONTHS[calMonth]} {calYear}
              </span>
              <button type="button" onClick={goNextMonth} className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50">
                <ChevronRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()); setRecordDate(todayIso()); }} className="ml-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-[#6366f1] hover:bg-indigo-50">
                Today
              </button>
            </div>
          }
        >
          <AttendanceCalendar
            year={calYear}
            month={calMonth}
            selectedIso={recordDate}
            marks={data.calendar_marks || {}}
            onSelectDay={setRecordDate}
          />
        </HrPanel>

        <HrPanel title="Today's Status Overview" action={<Link to="/hr/attendance" className="text-sm font-semibold text-[#6366f1]">View All</Link>}>
          <ul className="space-y-3">
            {data.today_overview.map((row) => (
              <li key={row.id} className="flex items-center gap-3">
                <HrAvatar label={row.avatar} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{row.name}</p>
                  <p className="truncate text-xs text-slate-500">{row.department}</p>
                </div>
                <div className="shrink-0 text-right">
                  <StatusBadge status={row.status} />
                  <p className="mt-1 text-xs text-slate-500">{row.check_in || "—"}</p>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="mt-4 w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            View All Attendance
          </button>
        </HrPanel>
      </div>

      {/* Records table */}
      <HrPanel
        title="Attendance Records"
        action={
          <div className="flex items-center gap-2">
            <Link to="/hr/attendance" className="text-sm font-semibold text-[#6366f1]">View All</Link>
            <button type="button" className="text-slate-400 hover:text-slate-600" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full w-full border-collapse text-left text-sm">
            <thead className="ui-table-head">
              <tr>
                <SerialNumberHeader className="border-b border-slate-200 px-3 py-3" />
                <th className="border-b border-slate-200 px-3 py-3">Employee ID</th>
                <th className="border-b border-slate-200 px-3 py-3 min-w-[160px]">Employee Name</th>
                <th className="border-b border-slate-200 px-3 py-3">Department</th>
                <th className="border-b border-slate-200 px-3 py-3">Check In</th>
                <th className="border-b border-slate-200 px-3 py-3">Check Out</th>
                <th className="border-b border-slate-200 px-3 py-3">Working Hours</th>
                <th className="border-b border-slate-200 px-3 py-3">Status</th>
                <th className="border-b border-slate-200 px-3 py-3">Remarks</th>
                <th className="border-b border-slate-200 px-3 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                    No attendance records for {formatDisplayDate(recordDate)}.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, rowIndex) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="border-b border-slate-100 px-3 py-3" />
                    <td className="border-b border-slate-100 px-3 py-3 font-medium text-slate-700">{row.employee_id}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <div className="flex items-center gap-2">
                        <HrAvatar label={row.avatar} />
                        <span className="font-semibold text-slate-800">{row.name}</span>
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.department}</td>
                    <td className="border-b border-slate-100 px-3 py-3 tabular-nums text-slate-600">{row.check_in || "—"}</td>
                    <td className="border-b border-slate-100 px-3 py-3 tabular-nums text-slate-600">{row.check_out || "—"}</td>
                    <td className="border-b border-slate-100 px-3 py-3 tabular-nums text-slate-600">{row.working_hours}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-500">{row.remarks}</td>
                    <td className="relative border-b border-slate-100 px-3 py-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-[#6366f1] hover:bg-indigo-50" aria-label="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-[#2563eb] hover:bg-blue-50" aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-[#6366f1] hover:bg-slate-50"
                          aria-label="More"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>
            Showing {from} to {to} of {filteredRecords.length} entries
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
                  className={`grid h-8 min-w-8 place-items-center rounded-md border px-2 text-sm font-semibold ${
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
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        </div>
      </HrPanel>
    </HrPage>
  );
}
