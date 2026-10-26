import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

import { getWorkforceDashboard } from "../../api/hrApi";
import { getCompanySettings } from "../../api/settingsApi";
import "../../styles/workforce-dashboard.css";

const COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#3b82f6"];
const PAY_COLORS = ["#f97316", "#2563eb", "#16a34a", "#0f766e"];

function money(value) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatDay(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function WorkforceDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [factory, setFactory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getWorkforceDashboard(), getCompanySettings().catch(() => null)])
      .then(([response, settings]) => {
        if (!active) return;
        setDashboard(response.data);
        setFactory(settings?.data?.company_name || settings?.data?.legal_name || "Your factory");
      })
      .catch((err) => {
        if (!active) return;
        const status = err?.response?.status;
        setError(status === 403 ? "You do not have access to workforce pay and attendance." : (err?.response?.data?.detail || "Workforce dashboard could not be loaded."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const days = dashboard?.last_five_days || [];
  const departments = dashboard?.departments || [];
  const pay = (dashboard?.last_month_pay || []).filter((row) => row.label !== "Net pay" && row.amount != null);
  const todayTotal = (dashboard?.today || []).reduce((sum, row) => sum + row.count, 0);
  const dayTotal = days.reduce((sum, row) => ({
    present: sum.present + row.present,
    half_day: sum.half_day + row.half_day,
    absent: sum.absent + row.absent,
    leave: sum.leave + row.leave,
  }), { present: 0, half_day: 0, absent: 0, leave: 0 });
  const wageTotal = departments.reduce((sum, row) => sum + Number(row.monthly_wage || 0), 0);

  return (
    <div className="wfd-root">
      <header className="wfd-header">
        <div>
          <p className="wfd-kicker">{factory || "Factory"} · {dashboard ? formatDay(dashboard.as_of) : "Workforce"}</p>
          <h1>Workforce Dashboard</h1>
          <p>Who is in today, the last 5 days by status, headcount by department, and last month’s wages.</p>
          <nav className="wfd-links" aria-label="Workforce sections">
            <Link to="/hr/employees">Workers</Link>
            <Link to="/hr/attendance">Attendance</Link>
            <Link to="/hr/shifts">Shifts</Link>
            <Link to="/hr/attendance/overtime">Overtime</Link>
            <Link to="/hr/payroll">Wages</Link>
          </nav>
        </div>
        <div>
          <strong>{factory || "—"}</strong>
          <div>{dashboard ? `${formatDay(dashboard.last_month_from)} – ${formatDay(dashboard.last_month_to)}` : "—"}</div>
        </div>
      </header>
      {loading ? <p>Loading workforce dashboard…</p> : null}
      {error ? <p className="wfd-error">{String(error)}</p> : null}
      {!loading && dashboard ? <>

      <section className="wfd-kpis" aria-label="Workforce summary">
        <article className="wfd-kpi"><span>Workers</span><strong>{dashboard?.workers ?? "—"}</strong><small>on the list</small></article>
        <article className="wfd-kpi"><span>Present Today</span><strong>{dashboard?.present_today ?? "—"}</strong><small>{dashboard ? `${dashboard.absent_today} absent` : "—"}</small></article>
        <article className="wfd-kpi"><span>OT Hours</span><strong>{dashboard?.ot_hours ?? "—"}</strong><small>approved this month</small></article>
        <article className="wfd-kpi"><span>Piece Earnings</span><strong>{money(dashboard?.piece_earnings)}</strong><small>{dashboard?.piece_recorded ? "this month" : "not recorded"}</small></article>
        <article className="wfd-kpi"><span>Net Pay</span><strong>{money(dashboard?.net_pay)}</strong><small>{dashboard?.payroll_recorded ? formatDay(dashboard.last_month_to) : "no payroll last month"}</small></article>
        <article className="wfd-kpi"><span>To Pay</span><strong>{money(dashboard?.to_pay)}</strong><small>{dashboard?.to_pay ? "not marked paid" : "no open payroll"}</small></article>
      </section>

      <div className="wfd-charts">
        <section className="wfd-panel">
          <h2>Last 5 days by status</h2>
          <div className="wfd-panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={days}>
                <XAxis dataKey="day" tickFormatter={(value) => formatDay(value).slice(0, 6)} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" stackId="status" fill={COLORS[0]} name="Present" />
                <Bar dataKey="half_day" stackId="status" fill={COLORS[1]} name="Half day" />
                <Bar dataKey="absent" stackId="status" fill={COLORS[2]} name="Absent" />
                <Bar dataKey="leave" stackId="status" fill={COLORS[3]} name="Leave" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="wfd-panel">
          <h2>Workers by department</h2>
          <div className="wfd-panel-body">
            {departments.length === 0 ? <p>No active workers.</p> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={departments} layout="vertical" margin={{ left: 24 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="department" width={90} />
                  <Tooltip />
                  <Bar dataKey="workers" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
        <section className="wfd-panel">
          <h2>Last month’s pay</h2>
          <div className="wfd-panel-body">
            {pay.length === 0 ? <p>No payroll was stored for last month.</p> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pay} dataKey="amount" nameKey="label" innerRadius={48} outerRadius={76}>
                    {pay.map((row, index) => <Cell key={row.label} fill={PAY_COLORS[index % PAY_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <div className="wfd-tables">
        <section className="wfd-panel">
          <h2>Last 5 Days</h2>
          <div className="wfd-panel-body">
            <table className="wfd-table">
              <thead><tr><th>Date</th><th>Present</th><th>Half day</th><th>Absent</th><th>Leave</th></tr></thead>
              <tbody>
                {days.length === 0 ? <tr><td colSpan={5}>No attendance in the last 5 days.</td></tr> : days.map((row) => (
                  <tr key={row.day}><td>{formatDay(row.day)}</td><td>{row.present}</td><td>{row.half_day}</td><td>{row.absent}</td><td>{row.leave}</td></tr>
                ))}
                {days.length ? <tr className="wfd-total"><td>Total</td><td>{dayTotal.present}</td><td>{dayTotal.half_day}</td><td>{dayTotal.absent}</td><td>{dayTotal.leave}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="wfd-panel">
          <h2>Today</h2>
          <div className="wfd-panel-body">
            <table className="wfd-table">
              <thead><tr><th>Status</th><th>Workers</th></tr></thead>
              <tbody>
                {(dashboard?.today || []).map((row) => <tr key={row.label}><td><Link to="/hr/attendance">{row.label}</Link></td><td>{row.count}</td></tr>)}
                <tr className="wfd-total"><td>Total</td><td>{dashboard ? todayTotal : "—"}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="wfd-tables">
        <section className="wfd-panel">
          <h2>By Department</h2>
          <div className="wfd-panel-body">
            <table className="wfd-table">
              <thead><tr><th>Department</th><th>Workers</th><th>Wage a month</th></tr></thead>
              <tbody>
                {departments.length === 0 ? <tr><td colSpan={3}>No active workers.</td></tr> : departments.map((row) => (
                  <tr key={row.department}><td>{row.department}</td><td>{row.workers}</td><td className="wfd-num">{money(row.monthly_wage)}</td></tr>
                ))}
                {departments.length ? <tr className="wfd-total"><td>Total</td><td>{dashboard?.workers}</td><td className="wfd-num">{money(wageTotal)}</td></tr> : null}
              </tbody>
            </table>
            <p>Monthly wage is the salary stored on each active worker.</p>
          </div>
        </section>
        <section className="wfd-panel">
          <h2>Last Month’s Pay</h2>
          <div className="wfd-panel-body">
            <table className="wfd-table">
              <thead><tr><th>Part</th><th>Amount</th></tr></thead>
              <tbody>
                {(dashboard?.last_month_pay || []).map((row) => (
                  <tr key={row.label}><td><Link to="/hr/payroll">{row.label}</Link></td><td className="wfd-num">{money(row.amount)}</td></tr>
                ))}
              </tbody>
            </table>
            <p>Net pay and the amount still to pay come from last month’s payroll records. Paid means processed, paid, or approved.</p>
          </div>
        </section>
      </div>

      <section className="wfd-panel">
        <h2>Insights</h2>
        <div className="wfd-panel-body">
          <ul className="wfd-insights">
            {(dashboard?.insights || []).length === 0 ? <li>No workforce records yet.</li> : dashboard.insights.map((line) => (
              <li key={line}>{line.replace("{factory}", factory || "Your factory")}</li>
            ))}
          </ul>
        </div>
      </section>

      </> : null}

      <nav className="wfd-footer" aria-label="Workforce links">
        <Link to="/hr">Home</Link>
        <Link to="/hr/employees">Workers</Link>
        <Link to="/hr/attendance">Attendance</Link>
        <Link to="/hr/attendance/overtime">Overtime</Link>
        <Link to="/hr/payroll">Wages</Link>
        <Link to="/hr/workforce-dashboard">Workforce Dashboard</Link>
      </nav>
    </div>
  );
}
