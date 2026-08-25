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
import {
  HrAvatar,
  HrKpiCard,
  HrPage,
  HrPageHeader,
  HrPanel,
  HrViewAllLink,
} from "../../components/hr/hrUi";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getHRHub } from "../../api/hrApi";
import { EMPTY_HR_HUB, mergeHrHub } from "../../data/hrMasterData";

function LeaveStatusBadge({ status }) {
  const key = String(status || "").toLowerCase();
  if (key === "approved") {
    return (
      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        Approved
      </span>
    );
  }
  return (
    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
      Pending
    </span>
  );
}

function DateBadge({ children }) {
  return (
    <span className="shrink-0 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">
      {children}
    </span>
  );
}

function QuickLinkTile({ to, label, icon: Icon, tone }) {
  const tones = {
    purple: "bg-[var(--kpi-violet-soft)] text-[var(--kpi-violet)]",
    blue: "bg-[var(--kpi-info-soft)] text-[var(--kpi-info)]",
    green: "bg-[var(--kpi-success-soft)] text-[var(--kpi-success)]",
    orange: "bg-[var(--kpi-orange-soft)] text-[var(--kpi-orange)]",
  };
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-4 py-5 text-center transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-surface)]"
    >
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{label}</span>
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
    <HrPage>
      <HrPageHeader
        title="HR Dashboard"
        breadcrumb={
          <nav className="flex flex-wrap items-center gap-1 text-sm text-[var(--color-text-muted)]" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-[var(--color-primary)]">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-faint)]" aria-hidden />
            <span>HR</span>
            <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-faint)]" aria-hidden />
            <span className="font-medium text-[var(--color-text-secondary)]">Dashboard</span>
          </nav>
        }
        action={<AddButton to="/hr/employees/create">Add Employee</AddButton>}
      />

      <div className="ui-grid-kpi">
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
        <HrPanel
          title="Attendance Overview"
          action={
            <select
              value={attendanceRange}
              onChange={(e) => setAttendanceRange(e.target.value)}
              className="ui-input rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none"
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
        </HrPanel>

        <HrPanel title="Employees by Department">
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
                <span className="ui-kpi__value text-xl">{deptTotal}</span>
                <span className="ui-caption">Total</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2.5 pt-1">
              {(hub.departments || []).map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-[var(--color-text-muted)]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                    <span className="truncate">{d.name}</span>
                  </span>
                  <span className="font-semibold text-[var(--color-text)]">{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </HrPanel>

        <HrPanel title="Upcoming Birthdays" action={<HrViewAllLink to="/hr/employees" />}>
          <ul className="space-y-3">
            {(hub.upcoming_birthdays || []).map((person) => (
              <li key={person.id} className="flex items-center gap-3">
                <HrAvatar label={person.avatar || person.name?.slice(0, 2)?.toUpperCase()} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">{person.name}</p>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">{person.role}</p>
                </div>
                <DateBadge>{person.date}</DateBadge>
              </li>
            ))}
          </ul>
        </HrPanel>
      </div>

      {/* Recent joins, leave, quick links */}
      <div className="grid gap-4 xl:grid-cols-3">
        <HrPanel title="Recent Joins" action={<HrViewAllLink to="/hr/employees" />}>
          <ul className="space-y-3">
            {(hub.recent_joins || []).map((person) => (
              <li key={person.id} className="flex items-center gap-3">
                <HrAvatar label={person.avatar || person.name?.slice(0, 2)?.toUpperCase()} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">{person.name}</p>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">{person.role}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="mb-1 inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Joined
                  </span>
                  <p className="text-xs text-[var(--color-text-muted)]">{person.date}</p>
                </div>
              </li>
            ))}
          </ul>
        </HrPanel>

        <HrPanel title="Leave Requests" action={<HrViewAllLink to="/hr/leave" />}>
          <ul className="space-y-3">
            {(hub.leave_requests_list || []).map((req) => (
              <li key={req.id} className="flex items-center gap-3">
                <HrAvatar label={req.avatar || req.name?.slice(0, 2)?.toUpperCase()} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">{req.name}</p>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">{req.type}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="mb-1 flex justify-end">
                    <LeaveStatusBadge status={req.status} />
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">{req.dates}</p>
                </div>
              </li>
            ))}
          </ul>
        </HrPanel>

        <HrPanel title="Quick Links">
          <div className="grid grid-cols-2 gap-3">
            <QuickLinkTile to="/hr/employees" label="Employees" icon={Users} tone="purple" />
            <QuickLinkTile to="/hr/attendance" label="Attendance" icon={CalendarDays} tone="blue" />
            <QuickLinkTile to="/hr/leave" label="Leave" icon={Palmtree} tone="green" />
            <QuickLinkTile to="/hr/payroll" label="Payroll" icon={Wallet} tone="orange" />
          </div>
        </HrPanel>
      </div>

      {/* HR notice bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-600">
            <Megaphone className="h-4 w-4" aria-hidden />
          </div>
          <p className="text-sm font-medium leading-relaxed text-[var(--color-text)]">{hub.hr_notice}</p>
        </div>
        <Link
          to="/hr/documents"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--color-primary)] hover:underline"
        >
          View All Notices
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </HrPage>
  );
}
