import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getProductionPlannerDashboard } from "../../api/productionApi";
import ErrorState from "../common/states/ErrorState";
import {
  dailyTotals,
  emptyPlannerModel,
  loadingPlannerKpis,
  plannerApiToModel,
  statusPill,
  weeklyDayTotals,
} from "../../data/productionPlannerToolkitData";
import "../../styles/production-planner-toolkit.css";

const KPI_ICONS = {
  blue: "📋",
  green: "✓",
  orange: "%",
  purple: "🏭",
  red: "⚙",
  teal: "🚚",
  lime: "📅",
};

const MIX_COLORS = ["#2563eb", "#ea580c", "#16a34a", "#7c3aed", "#dc2626", "#64748b"];

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

function fmtPct(n) {
  return `${Number(n || 0).toFixed(1)}%`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyWeeklyProductionPlanner({
  orders = [],
  activeTab = "dashboard",
  onTabChange,
  refreshToken = 0,
}) {
  const navigate = useNavigate();
  const [planDate, setPlanDate] = useState(todayIso);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [plannerPayload, setPlannerPayload] = useState(null);

  const loadPlanner = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getProductionPlannerDashboard(planDate);
      setPlannerPayload(res.data ?? null);
    } catch (err) {
      setPlannerPayload(null);
      setLoadError(err?.response?.data?.detail || "Could not load production planner");
    } finally {
      setLoading(false);
    }
  }, [planDate]);

  useEffect(() => {
    loadPlanner();
  }, [loadPlanner, refreshToken]);

  const model = useMemo(() => {
    if (loadError) {
      return { ...emptyPlannerModel(), kpis: loadingPlannerKpis(), dailyRows: [], weeklyRows: [], machines: [], dispatch: [], dailyChart: [], productMix: [], insights: [], actions: [] };
    }
    if (loading && !plannerPayload) {
      return { ...emptyPlannerModel(), kpis: loadingPlannerKpis(), dailyRows: [], weeklyRows: [], machines: [], dispatch: [], dailyChart: [], productMix: [], insights: [], actions: [] };
    }
    if (plannerPayload) return plannerApiToModel(plannerPayload);
    return emptyPlannerModel();
  }, [plannerPayload, loading, loadError]);
  const dailyTotal = useMemo(() => dailyTotals(model.dailyRows), [model.dailyRows]);
  const weekTotals = useMemo(() => weeklyDayTotals(model.weeklyRows), [model.weeklyRows]);
  const weekGrand = weekTotals.reduce((a, b) => a + b, 0);
  const mixTotal = model.productMix.reduce((s, p) => s + p.value, 0);

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "daily_plan", label: "Daily Plan" },
    { id: "weekly_schedule", label: "Weekly Schedule" },
    { id: "production_data", label: "Production Data" },
    { id: "machine_status", label: "Machine Status", path: "/production/machines" },
    { id: "dispatch", label: "Dispatch", path: "/sales/shipping" },
    { id: "settings", label: "Settings", path: "/settings" },
  ];

  const handleTab = (tab) => {
    if (tab.path) {
      navigate(tab.path);
      return;
    }
    onTabChange?.(tab.id);
    if (tab.id === "daily_plan") {
      document.getElementById("ppt-daily-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (tab.id === "weekly_schedule") {
      document.getElementById("ppt-weekly-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (activeTab === "production_data") {
    return (
      <div className="ppt-root mb-3">
        <nav className="ppt-tabs" aria-label="Production planner sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "ppt-tabs__active" : ""}
              onClick={() => handleTab(tab)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="ppt-root mb-4 print:hidden">
      <header className="ppt-hero">
        <div className="ppt-hero__top">
          <span>🏭 Manufacturing Production Planning &amp; Factory Control Toolkit</span>
          <span className="hidden sm:inline text-right max-w-[200px]">
            Higher Productivity · Better Planning · On-Time Delivery · Stronger Manufacturing
          </span>
        </div>
        <div className="ppt-hero__title">
          <h1>
            DAILY &amp; WEEKLY <span className="ppt-gold">PRODUCTION PLANNER</span>
          </h1>
          <p className="ppt-hero__subtitle">
            Plan Production | Track Progress | Manage Resources | Ensure On-Time Dispatch
          </p>
          <label className="ppt-hero__plan-date mt-2 inline-flex items-center gap-2 font-semibold">
            Plan date
            <input
              type="date"
              className="ppt-hero__date-input rounded border border-white/30 bg-white/10 text-white"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
            />
          </label>
        </div>
      </header>

      {loadError ? (
        <ErrorState
          title="Could not load production planner"
          description={typeof loadError === "string" ? loadError : "Failed to load planner data."}
          onRetry={loadPlanner}
          className="mb-4 py-10"
        />
      ) : null}
      {loading && !loadError ? (
        <div className="mb-2 text-center text-xs text-[var(--color-text-muted)]">Loading production planner…</div>
      ) : null}

      {!loadError ? (
      <>
      <div className="ppt-kpi-row" aria-label="Production KPIs">
        {model.kpis.map((kpi) => (
          <div key={kpi.key} className="ppt-kpi">
            <div className={`ppt-kpi__icon ppt-kpi__icon--${kpi.tone}`}>{KPI_ICONS[kpi.tone] || "•"}</div>
            <div className="ppt-kpi__label">{kpi.label}</div>
            <div className="ppt-kpi__value">{kpi.value}</div>
            {kpi.unit ? <div className="ppt-kpi__unit">{kpi.unit}</div> : null}
          </div>
        ))}
      </div>

      <div className="ppt-body">
        <div className="ppt-grid-2">
          <section className="ppt-panel" id="ppt-daily-table">
            <div className="ppt-panel__title">Daily Production Plan vs Actual</div>
            <div className="ppt-table-wrap">
              <table className="ppt-table">
                <thead>
                  <tr>
                    <th>S.No.</th>
                    <th>Product Name</th>
                    <th>Code</th>
                    <th>Machine</th>
                    <th>Shift</th>
                    <th>Planned</th>
                    <th>Actual</th>
                    <th>Variance</th>
                    <th>Achv %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {!model.dailyRows.length && !loading ? (
                    <tr>
                      <td colSpan={10} className="ppt-left text-[var(--color-text-muted)]">
                        No production plan or daily reports for this date.
                      </td>
                    </tr>
                  ) : null}
                  {model.dailyRows.map((row) => {
                    const ach = row.planned > 0 ? (row.actual / row.planned) * 100 : row.achievement || 0;
                    const pill = statusPill(row.status);
                    return (
                      <tr key={row.sno}>
                        <td>{row.sno}</td>
                        <td className="ppt-left">{row.product}</td>
                        <td>{row.code}</td>
                        <td>{row.machine}</td>
                        <td>{row.shift}</td>
                        <td>{fmt(row.planned)}</td>
                        <td>{fmt(row.actual)}</td>
                        <td>{fmt(row.variance ?? row.actual - row.planned)}</td>
                        <td>{fmtPct(ach)}</td>
                        <td><span className={pill.className}>{pill.label}</span></td>
                      </tr>
                    );
                  })}
                  <tr className="ppt-total-row">
                    <td colSpan={5}>TOTAL</td>
                    <td>{fmt(dailyTotal.planned)}</td>
                    <td>{fmt(dailyTotal.actual)}</td>
                    <td>{fmt(dailyTotal.variance)}</td>
                    <td>{fmtPct(dailyTotal.achievement)}</td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="ppt-panel" id="ppt-weekly-table">
            <div className="ppt-panel__title">Weekly Production Schedule ({model.weekLabel})</div>
            <div className="ppt-table-wrap">
              <table className="ppt-table">
                <thead>
                  <tr>
                    <th className="ppt-left">Product</th>
                    {model.weekDays.map((d) => (
                      <th key={d}>{d}</th>
                    ))}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {model.weeklyRows.map((row) => (
                    <tr key={row.product}>
                      <td className="ppt-left">{row.product}</td>
                      {row.days.map((v, i) => (
                        <td key={i}>{v ? fmt(v) : "—"}</td>
                      ))}
                      <td>{fmt(row.total)}</td>
                    </tr>
                  ))}
                  <tr className="ppt-total-row">
                    <td className="ppt-left">TOTAL</td>
                    {weekTotals.map((v, i) => (
                      <td key={i}>{fmt(v)}</td>
                    ))}
                    <td>{fmt(weekGrand)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="ppt-grid-3">
          <section className="ppt-panel">
            <div className="ppt-panel__title">Machine &amp; Shift Allocation</div>
            <div className="ppt-table-wrap">
              <table className="ppt-table">
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th>Line</th>
                    <th>Shift A</th>
                    <th>Shift B</th>
                    <th>Shift C</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {model.machines.map((m) => (
                    <tr key={m.machine}>
                      <td>{m.machine}</td>
                      <td>{m.line}</td>
                      <td className="ppt-left">{m.shiftA}</td>
                      <td className="ppt-left">{m.shiftB}</td>
                      <td className="ppt-left">{m.shiftC}</td>
                      <td>
                        <span
                          className={
                            m.status === "maintenance"
                              ? "ppt-status ppt-status--danger"
                              : "ppt-status ppt-status--success"
                          }
                        >
                          {m.status === "maintenance" ? "Maintenance" : "Running"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ppt-panel">
            <div className="ppt-panel__title">Dispatch Schedule</div>
            <div className="ppt-table-wrap">
              <table className="ppt-table">
                <thead>
                  <tr>
                    <th className="ppt-left">Customer</th>
                    <th className="ppt-left">Product</th>
                    <th>Qty</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {model.dispatch.map((row, i) => (
                    <tr key={i}>
                      <td className="ppt-left">{row.customer}</td>
                      <td className="ppt-left">{row.product}</td>
                      <td>{fmt(row.qty)}</td>
                      <td>{row.date}</td>
                      <td>
                        <span
                          className={
                            row.status === "scheduled"
                              ? "ppt-status ppt-status--info"
                              : "ppt-status ppt-status--pending"
                          }
                        >
                          {row.status === "scheduled" ? "Scheduled" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="space-y-2">
            <section className="ppt-panel">
              <div className="ppt-panel__title">Daily Plan vs Actual Production</div>
              <div className="ppt-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={model.dailyChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Bar dataKey="planned" name="Planned Qty" fill="#2563eb" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="actual" name="Actual Qty" fill="#ea580c" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="ppt-panel">
              <div className="ppt-panel__title">Production by Product (This Week)</div>
              <div className="ppt-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={model.productMix}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={58}
                      paddingAngle={1}
                    >
                      {model.productMix.map((_, i) => (
                        <Cell key={i} fill={MIX_COLORS[i % MIX_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="ppt-donut-center">{fmt(mixTotal)} Units</div>
            </section>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 mt-2">
          <div className="ppt-insights">
            <h4>✓ Key Insights</h4>
            <ul>
              {model.insights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="ppt-actions">
            <h4>Action Items</h4>
            <ol>
              {model.actions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>
      </>
      ) : null}

      <nav className="ppt-tabs" aria-label="Production planner sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "ppt-tabs__active" : ""}
            onClick={() => handleTab(tab)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
