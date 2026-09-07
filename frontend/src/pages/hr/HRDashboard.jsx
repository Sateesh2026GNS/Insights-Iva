import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Baby,
  Calendar,
  CalendarDays,
  ClipboardList,
  Clock,
  Palmtree,
  Plane,
  Sparkles,
  Umbrella,
  UserCheck,
  UserMinus,
  UserX,
  Users,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import Loader from "../../components/common/Loader";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  getAttendanceEnriched,
  getEmployeeSummary,
  getEmployeesEnriched,
  getHRHub,
  getLeaveEnriched,
  getLeaveSummary,
  getPayrollEnriched,
  getShifts,
} from "../../api/hrApi";
import { DEMO_HR_DASHBOARD, mergeHrDashboard } from "../../data/hrMasterData";
import "./hrDashboard.css";

const LEAVE_TONES = {
  green: { text: "#16a34a", bg: "#dcfce7", icon: Palmtree },
  orange: { text: "#d97706", bg: "#ffedd5", icon: Sparkles },
  blue: { text: "#1d4ed8", bg: "#dbeafe", icon: CalendarDays },
  sky: { text: "#0284c7", bg: "#e0f2fe", icon: Baby },
  red: { text: "#dc2626", bg: "#fee2e2", icon: Users },
  yellow: { text: "#ca8a04", bg: "#fef9c3", icon: Plane },
};

const STAT_TONES = {
  success: { text: "#16a34a", bg: "#dcfce7" },
  info: { text: "#2563eb", bg: "#dbeafe" },
  muted: { text: "#64748b", bg: "#f1f5f9" },
  danger: { text: "#e11d8f", bg: "#fce7f3" },
};

function DashCard({ title, action, children, bodyClassName = "", className = "" }) {
  return (
    <section className={`hr-dash-card ${className}`.trim()}>
      {title || action ? (
        <div className="hr-dash-card__header">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      <div className={`hr-dash-card__body ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}

function MonthBadge({ children }) {
  return <span className="hr-dash-badge">{children}</span>;
}

function StatMini({ icon: Icon, label, value, tone = "info" }) {
  const colors = STAT_TONES[tone] || STAT_TONES.info;
  return (
    <div className="hr-dash-stat">
      <div className="hr-dash-stat__icon" style={{ background: colors.bg, color: colors.text }}>
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="hr-dash-stat__value" style={{ color: colors.text }}>{value}</p>
        <p className="hr-dash-stat__label">{label}</p>
      </div>
    </div>
  );
}

function WelcomeIllustration() {
  return (
    <svg viewBox="0 0 240 140" className="mx-auto h-32 w-full max-w-[220px] shrink-0 sm:mx-0" aria-hidden>
      <ellipse cx="120" cy="118" rx="72" ry="8" fill="#e2e8f0" opacity="0.6" />
      <rect x="72" y="88" width="96" height="22" rx="6" fill="#cbd5e1" />
      <rect x="88" y="96" width="28" height="10" rx="2" fill="#94a3b8" />
      <circle cx="98" cy="72" r="14" fill="#fdba74" />
      <path d="M88 84 Q98 78 108 84 L108 102 Q98 108 88 102 Z" fill="#3b82f6" />
      <circle cx="142" cy="68" r="14" fill="#fcd34d" />
      <path d="M132 80 Q142 74 152 80 L152 104 Q142 110 132 104 Z" fill="#0751b2" />
      <path d="M92 66 L100 56 L108 66" stroke="#fbbf24" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="100" cy="48" r="10" fill="#fef9c3" stroke="#fbbf24" strokeWidth="2" />
      <path d="M84 74 L96 68 M144 68 L156 74" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function formatLongDate(date = new Date()) {
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTimer(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(" : ");
}

function CheckInPanel() {
  const [checkedIn, setCheckedIn] = useState(false);
  const [elapsed, setElapsed] = useState(7);
  const [startTs, setStartTs] = useState(null);

  useEffect(() => {
    if (!checkedIn || !startTs) return undefined;
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTs) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [checkedIn, startTs]);

  const handleCheckIn = () => {
    if (checkedIn) return;
    setCheckedIn(true);
    setStartTs(Date.now());
    setElapsed(0);
  };

  return (
    <DashCard
      action={
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#e8f1ff] text-[#2563eb]">
          <ClipboardList className="h-5 w-5" aria-hidden />
        </div>
      }
    >
      <div className="-mt-1">
        <h3 className="hr-dash-checkin-title">Let&apos;s Get To Work</h3>
        <p className="hr-dash-checkin-date">{formatLongDate()}</p>
        <p className="hr-dash-timer">{formatTimer(elapsed)}</p>
        <div className="hr-dash-timer-bar" />
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button type="button" className="hr-dash-action-btn" onClick={handleCheckIn} disabled={checkedIn}>
            {checkedIn ? "Checked In" : "Check In"}
          </button>
          <button type="button" className="hr-dash-action-btn">Start Over Time</button>
        </div>
      </div>
    </DashCard>
  );
}

function DonutChart({ data, centerValue, emptyColor = "#c7d2fe", innerRadius = 58, outerRadius = 78 }) {
  const chartData = data?.length ? data : [{ name: "Empty", value: 1, color: emptyColor }];
  return (
    <div className="relative mx-auto h-52 w-full max-w-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={data?.length > 1 ? 1 : 0}
            stroke="none"
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {centerValue != null ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-[#1e293b]">{centerValue}</span>
        </div>
      ) : null}
    </div>
  );
}

function CelebrationItem({ item }) {
  return (
    <li className="flex items-center gap-3 border-b border-[#e8ecf3] px-[18px] py-3 last:border-0">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e8f1ff] text-[#2563eb]">
        <Users className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#2563eb]">{item.name}</p>
        <p className="text-xs text-[#64748b]">{item.date_label}</p>
      </div>
    </li>
  );
}

function LeaveRow({ leave }) {
  const tone = LEAVE_TONES[leave.tone] || LEAVE_TONES.blue;
  const Icon = tone.icon;
  return (
    <li className="hr-dash-leave-row">
      <div className="hr-dash-leave-icon" style={{ background: tone.bg, color: tone.text }}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#1e293b]">{leave.label}</p>
        <p className="text-xs text-[#64748b]">Available {leave.available} Days</p>
      </div>
      <span className="hr-dash-leave-count" style={{ color: tone.text }}>
        {leave.available}
      </span>
    </li>
  );
}

function EmptyIllustration({ type }) {
  if (type === "holidays") {
    return (
      <div className="mb-3 text-5xl" aria-hidden>🏝️</div>
    );
  }
  if (type === "celebrations") {
    return (
      <div className="mb-3 text-5xl" aria-hidden>🎉</div>
    );
  }
  if (type === "approvals") {
    return (
      <div className="mb-3 grid h-16 w-16 place-items-center rounded-lg border border-[#e8ecf3] bg-[#f8fafc] text-[#94a3b8]" aria-hidden>
        <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none">
          <rect x="8" y="10" width="32" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M14 18h20M14 24h14" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="34" cy="14" r="6" fill="#ef4444" />
          <path d="M31.5 14h5M34 11.5v5" stroke="#fff" strokeWidth="1.2" />
        </svg>
      </div>
    );
  }
  if (type === "announcements") {
    return (
      <div className="mb-3 grid h-16 w-16 place-items-center rounded-full bg-[#e0f2fe] text-[#0284c7]" aria-hidden>
        <svg viewBox="0 0 32 32" className="h-9 w-9" fill="currentColor">
          <path d="M6 12v8h3l5 4V8l-5 4H6zm14.5 2c0 2.1-1.2 3.9-3 4.8V22c3.3-.9 5.5-3.7 5.5-7s-2.2-6.1-5.5-7v3.2c1.8.9 3 2.7 3 4.8z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="mb-3 grid h-16 w-16 place-items-center rounded-full bg-[#dbeafe] text-[#2563eb]" aria-hidden>
      <svg viewBox="0 0 40 40" className="h-9 w-9" fill="none">
        <rect x="10" y="8" width="20" height="26" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
        <rect x="14" y="14" width="12" height="2" fill="currentColor" />
        <rect x="14" y="19" width="8" height="2" fill="currentColor" />
        <circle cx="28" cy="12" r="5" fill="#ef4444" />
        <path d="M26 12h4M28 10v4" stroke="#fff" strokeWidth="1.2" />
      </svg>
    </div>
  );
}

export default function HRDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(DEMO_HR_DASHBOARD);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const results = await Promise.allSettled([
        getHRHub(),
        getEmployeeSummary(),
        getLeaveSummary(),
        getLeaveEnriched(),
        getShifts(),
        getPayrollEnriched(),
        getEmployeesEnriched(),
        getAttendanceEnriched(),
      ]);
      const pick = (idx) => (results[idx].status === "fulfilled" ? results[idx].value.data : null);
      setData(
        mergeHrDashboard({
          hub: pick(0) || {},
          empSummary: pick(1) || {},
          leaveSummary: pick(2) || {},
          leaves: pick(3) || [],
          shifts: pick(4) || [],
          payrollRows: pick(5) || [],
          employees: pick(6) || [],
          attendanceRows: pick(7) || [],
        })
      );
    } catch (err) {
      if (isRefresh) throw err;
      setData(DEMO_HR_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const userName = user?.full_name || user?.name || "Satish Gogulothu";

  const overallChart = useMemo(() => {
    const hired = data.hired_total || 0;
    const exits = data.exits_total || 0;
    if (!hired && !exits) return [{ name: "Employees", value: 1, color: "#1e40af" }];
    const items = [];
    if (hired > 0) items.push({ name: "Hired", value: hired, color: "#1e40af" });
    if (exits > 0) items.push({ name: "Exits", value: exits, color: "#93c5fd" });
    return items.length ? items : [{ name: "Employees", value: 1, color: "#1e40af" }];
  }, [data.hired_total, data.exits_total]);

  const expenseChart = useMemo(
    () => (data.expense_categories || []).filter((c) => c.value > 0),
    [data.expense_categories]
  );

  if (loading) return <Loader label="Loading HR dashboard..." />;

  return (
    <div className="hr-dashboard ui-page ui-stack min-w-0 space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <DashCard className="lg:col-span-2" bodyClassName="py-5">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="hr-dash-welcome-title text-center sm:text-left">Welcome, {userName}</h1>
            <WelcomeIllustration />
          </div>
        </DashCard>

        <CheckInPanel />

        <div className="flex flex-col gap-4">
          <DashCard title="Employee Analytics" action={<MonthBadge>{data.analytics_month_label}</MonthBadge>}>
            <div className="grid grid-cols-3 gap-2">
              <StatMini icon={Users} label="Active" value={data.active_employees} tone="success" />
              <StatMini icon={UserCheck} label="Hired" value={data.hired_month} tone="info" />
              <StatMini icon={UserMinus} label="Exits" value={data.exits_month} tone="muted" />
            </div>
          </DashCard>
          <DashCard action={<MonthBadge>Today</MonthBadge>}>
            <div className="grid grid-cols-3 gap-2">
              <StatMini icon={UserCheck} label="Present" value={data.present_today} tone="success" />
              <StatMini icon={UserX} label="Absent" value={data.absent_today} tone="danger" />
              <StatMini icon={Umbrella} label="On leave" value={data.on_leave_today} tone="info" />
            </div>
          </DashCard>
        </div>

        <DashCard title="Celebration Corner" bodyClassName="hr-dash-card__body--flush min-h-[280px]">
          {(data.celebrations || []).length ? (
            <ul className="max-h-[320px] overflow-y-auto">
              {data.celebrations.map((item) => (
                <CelebrationItem key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            <div className="hr-dash-empty min-h-[240px]">
              <EmptyIllustration type="celebrations" />
              <p>No Celebrations Found</p>
            </div>
          )}
        </DashCard>

        <DashCard title="Overall Employees">
          <DonutChart data={overallChart} centerValue={data.overall_employees} />
        </DashCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DashCard title="Upcoming Holidays">
          {(data.upcoming_holidays || []).length ? (
            <ul className="space-y-2">
              {data.upcoming_holidays.map((h) => (
                <li key={h.id} className="text-sm text-[#64748b]">{h.name} — {h.date}</li>
              ))}
            </ul>
          ) : (
            <div className="hr-dash-empty py-8">
              <EmptyIllustration type="holidays" />
              <p>No Holidays Found</p>
            </div>
          )}
        </DashCard>

        <DashCard title="Shift Schedule">
          {data.shift_schedule ? (
            <div className="flex gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#dbeafe] text-sm font-bold text-[#2563eb]">
                {data.shift_schedule.initial}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[#1e293b]">{data.shift_schedule.name}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-[#64748b]">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {data.shift_schedule.date_range}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#64748b]">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {data.shift_schedule.time_range}
                </p>
              </div>
            </div>
          ) : (
            <p className="hr-dash-empty py-6">No shift assigned</p>
          )}
        </DashCard>

        <DashCard title="Total Expenses" bodyClassName="md:col-span-2 xl:col-span-1">
          <DonutChart
            data={expenseChart}
            centerValue={`₹ ${Number(data.expense_total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            emptyColor="#c7d2fe"
          />
        </DashCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DashCard title="My Leaves" bodyClassName="hr-dash-card__body--flush p-0">
          <ul className="hr-dash-leaves-scroll">
            {(data.my_leaves || []).map((leave) => (
              <LeaveRow key={leave.key} leave={leave} />
            ))}
          </ul>
        </DashCard>

        <DashCard title="Approval Requests">
          {(data.approval_requests || []).length ? (
            <ul className="divide-y divide-[#e8ecf3]">
              {data.approval_requests.map((req) => (
                <li key={req.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e8f1ff] text-xs font-semibold text-[#2563eb]">
                    {(req.name || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1e293b]">{req.name}</p>
                    <p className="text-xs text-[#64748b]">{req.date_label}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="hr-dash-empty py-10">
              <EmptyIllustration type="approvals" />
              <p>No Approval Requests</p>
            </div>
          )}
        </DashCard>

        <DashCard title="Announcements">
          {(data.announcements || []).length ? (
            <ul className="divide-y divide-[#e8ecf3]">
              {data.announcements.map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm font-semibold text-[#2563eb]">{item.title}</p>
                  <p className="text-xs text-[#64748b]">{item.date}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="hr-dash-empty py-10">
              <EmptyIllustration type="announcements" />
              <p>No Announcements Found</p>
            </div>
          )}
        </DashCard>
      </div>

      <DashCard title="Payslips" bodyClassName="max-w-md">
        {(data.payslips || []).length ? (
          <ul className="space-y-2">
            {data.payslips.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-[#64748b]">{p.period}</span>
                <span className="font-semibold tabular-nums text-[#1e293b]">
                  ₹ {Number(p.amount).toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="hr-dash-empty py-10">
            <EmptyIllustration type="payslips" />
            <p>No Payslips Found</p>
          </div>
        )}
      </DashCard>
    </div>
  );
}
