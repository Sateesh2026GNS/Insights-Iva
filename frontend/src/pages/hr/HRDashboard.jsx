import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Megaphone,
  Palmtree,
  Plus,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Loader from "../../components/common/Loader";
import { AddButton } from "../../components/common/Button";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getHRHub } from "../../api/hrApi";
import { EMPTY_HR_HUB, mergeHrHub } from "../../data/hrMasterData";

const KPI_TONES = {
  purple: { icon: "bg-[#ede9fe] text-[#7c3aed]" },
  blue: { icon: "bg-[#dbeafe] text-[#2563eb]" },
  green: { icon: "bg-[#dcfce7] text-[#16a34a]" },
  red: { icon: "bg-[#fee2e2] text-[#ef4444]" },
};

function HrKpiCard({ label, value, icon: Icon, tone, trendPct, trendLabel }) {
  const styles = KPI_TONES[tone] || KPI_TONES.purple;
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${styles.icon}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
      <p className="text-[28px] font-bold leading-tight text-slate-900">{value}</p>
      {trendPct != null ? (
        <p className="mt-1.5 text-[12px] font-medium text-emerald-600">
          ↑ {trendPct}% {trendLabel}
        </p>
      ) : null}
    </div>
  );
}

function PanelCard({ title, action, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function ViewAllLink({ to }) {
  return (
    <Link to={to} className="text-[13px] font-semibold text-[#6366f1] hover:text-[#4f46e5]">
      View All
    </Link>
  );
}

function AvatarBadge({ label, className = "" }) {
  return (
    <div
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-200 text-[12px] font-bold text-indigo-700 ${className}`}
    >
      {label}
    </div>
  );
}

function LeaveStatusBadge({ status }) {
  const key = String(status || "").toLowerCase();
  if (key === "approved") {
    return (
      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        Approved
      </span>
    );
  }
  return (
    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
      Pending
    </span>
  );
}

function DateBadge({ children }) {
  return (
    <span className="shrink-0 rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600">
      {children}
    </span>
  );
}

function QuickLinkTile({ to, label, icon: Icon, tone }) {
  const tones = {
    purple: "bg-[#f5f3ff] text-[#7c3aed]",
    blue: "bg-[#eff6ff] text-[#2563eb]",
    green: "bg-[#f0fdf4] text-[#16a34a]",
    orange: "bg-[#fff7ed] text-[#ea580c]",
  };
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-5 text-center transition-colors hover:border-indigo-200 hover:bg-white"
    >
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <span className="text-[13px] font-semibold text-slate-700">{label}</span>
    </Link>
  );
}

export default function HRDashboard() {
  const [loading, setLoading] = useState(true);
  const [hub, setHub] = useState(EMPTY_HR_HUB);
  const [attendanceRange, setAttendanceRange] = useState("this_week");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getHRHub();
      setHub(mergeHrHub(res.data));
    } catch (err) {
      if (isRefresh) throw err;
      setHub(EMPTY_HR_HUB);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const deptTotal = useMemo(
    () => (hub.departments || []).reduce((sum, d) => sum + (Number(d.count) || 0), 0) || hub.total_employees,
    [hub.departments, hub.total_employees]
  );

  if (loading) return <Loader label="Loading HR dashboard..." />;

  const trends = hub.kpi_trends || {};

  return (
    <div className="min-w-0 space-y-5 pb-5">
      {/* Page header — matches mockup */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1e3a5f]">HR Dashboard</h1>
          <nav className="mt-1 flex flex-wrap items-center gap-1 text-[13px] text-slate-500" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-indigo-600">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            <span className="text-slate-600">HR</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            <span className="font-medium text-slate-700">Dashboard</span>
          </nav>
        </div>
        <AddButton to="/hr/employees/create">
          Add Employee
        </AddButton>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HrKpiCard
          label="Total Employees"
          value={hub.total_employees}
          icon={Users}
          tone="purple"
          trendPct={trends.employees?.pct}
          trendLabel={trends.employees?.label}
        />
        <HrKpiCard
          label="Present Today"
          value={`${hub.present_today} / ${hub.total_for_present || hub.total_employees}`}
          icon={CalendarDays}
          tone="blue"
          trendPct={trends.present?.pct}
          trendLabel={trends.present?.label}
        />
        <HrKpiCard
          label="Leave Requests"
          value={hub.leave_requests}
          icon={Palmtree}
          tone="green"
          trendPct={trends.leave?.pct}
          trendLabel={trends.leave?.label}
        />
        <HrKpiCard
          label="Pending Tasks"
          value={hub.pending_tasks}
          icon={AlertTriangle}
          tone="red"
          trendPct={trends.tasks?.pct}
          trendLabel={trends.tasks?.label}
        />
      </div>

      {/* Charts + birthdays */}
      <div className="grid gap-4 xl:grid-cols-3">
        <PanelCard
          title="Attendance Overview"
          action={
            <select
              value={attendanceRange}
              onChange={(e) => setAttendanceRange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 outline-none focus:border-indigo-400"
            >
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
            </select>
          }
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hub.attendance_week} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(v) => [`${v}%`, "Attendance"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="pct" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={42}>
                  <LabelList
                    dataKey="pct"
                    position="top"
                    formatter={(v) => `${v}%`}
                    style={{ fontSize: 11, fontWeight: 600, fill: "#64748b" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>

        <PanelCard title="Employees by Department">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={hub.departments}
                    dataKey="count"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {(hub.departments || []).map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[22px] font-bold text-slate-900">{deptTotal}</span>
                <span className="text-[11px] font-medium text-slate-500">Total</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2.5 pt-1">
              {(hub.departments || []).map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="flex min-w-0 items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <span className="font-semibold text-slate-800">{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </PanelCard>

        <PanelCard title="Upcoming Birthdays" action={<ViewAllLink to="/hr/employees" />}>
          <ul className="space-y-3">
            {(hub.upcoming_birthdays || []).map((person) => (
              <li key={person.id} className="flex items-center gap-3">
                <AvatarBadge label={person.avatar || person.name?.slice(0, 2)?.toUpperCase()} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-800">{person.name}</p>
                  <p className="truncate text-[12px] text-slate-500">{person.role}</p>
                </div>
                <DateBadge>{person.date}</DateBadge>
              </li>
            ))}
          </ul>
        </PanelCard>
      </div>

      {/* Recent joins, leave, quick links */}
      <div className="grid gap-4 xl:grid-cols-3">
        <PanelCard title="Recent Joins" action={<ViewAllLink to="/hr/employees" />}>
          <ul className="space-y-3">
            {(hub.recent_joins || []).map((person) => (
              <li key={person.id} className="flex items-center gap-3">
                <AvatarBadge label={person.avatar || person.name?.slice(0, 2)?.toUpperCase()} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-800">{person.name}</p>
                  <p className="truncate text-[12px] text-slate-500">{person.role}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="mb-1 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Joined
                  </span>
                  <p className="text-[11px] text-slate-500">{person.date}</p>
                </div>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard title="Leave Requests" action={<ViewAllLink to="/hr/leave" />}>
          <ul className="space-y-3">
            {(hub.leave_requests_list || []).map((req) => (
              <li key={req.id} className="flex items-center gap-3">
                <AvatarBadge label={req.avatar || req.name?.slice(0, 2)?.toUpperCase()} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-800">{req.name}</p>
                  <p className="truncate text-[12px] text-slate-500">{req.type}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="mb-1 flex justify-end">
                    <LeaveStatusBadge status={req.status} />
                  </div>
                  <p className="text-[11px] text-slate-500">{req.dates}</p>
                </div>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard title="Quick Links">
          <div className="grid grid-cols-2 gap-3">
            <QuickLinkTile to="/hr/employees" label="Employees" icon={Users} tone="purple" />
            <QuickLinkTile to="/hr/attendance" label="Attendance" icon={CalendarDays} tone="blue" />
            <QuickLinkTile to="/hr/leave" label="Leave" icon={Palmtree} tone="green" />
            <QuickLinkTile to="/hr/payroll" label="Payroll" icon={Wallet} tone="orange" />
          </div>
        </PanelCard>
      </div>

      {/* HR notice bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-600">
            <Megaphone className="h-4 w-4" aria-hidden />
          </div>
          <p className="text-[13px] font-medium leading-relaxed text-emerald-900">{hub.hr_notice}</p>
        </div>
        <Link
          to="/hr/documents"
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-[#2563eb] hover:underline"
        >
          View All Notices
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
