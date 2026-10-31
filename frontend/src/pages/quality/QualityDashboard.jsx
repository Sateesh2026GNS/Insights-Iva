import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Loader from "../../components/common/Loader";
import DashboardReportExport from "../../components/common/DashboardReportExport";
import { metricExportRows } from "../../utils/dashboardExportRows";
import { getQualityHub } from "../../api/qualityApi";
import { EMPTY_QUALITY_HUB, mergeQualityHub } from "../../data/qualityMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { classifyApiError } from "../../utils/apiError";
import "../../styles/manufacturing-toolkit.css";
import "./qualityDashboard.css";

const QUALITY_PAGES = [
  { label: "Inspection Records", to: "/quality/inspection" },
  { label: "Incoming Inspection", to: "/quality/incoming" },
  { label: "In-Process QC", to: "/quality/in-process" },
  { label: "Final QC", to: "/quality/final" },
  { label: "Quality Issues", to: "/quality/defects" },
  { label: "Batch Reports", to: "/quality/batch-reports" },
];

const TYPE_LIST = {
  "Incoming Inspection": "/quality/incoming",
  "In-Process QC": "/quality/in-process",
  "Final QC": "/quality/final",
};

function typeListPath(name) {
  return TYPE_LIST[name] || null;
}

function resultPill(value) {
  const key = String(value || "").toLowerCase();
  if (key === "passed" || key === "pass") return <span className="mtk-pill mtk-pill--success">Passed</span>;
  if (key === "failed" || key === "fail") return <span className="mtk-pill mtk-pill--danger">Failed</span>;
  if (!value) return "\u2014";
  return <span className="mtk-pill mtk-pill--neutral">{value}</span>;
}

function statusPill(value) {
  const key = String(value || "").toLowerCase();
  if (key === "completed") return <span className="mtk-pill mtk-pill--success">Completed</span>;
  if (key === "in_progress") return <span className="mtk-pill mtk-pill--info">In Progress</span>;
  if (!value) return "\u2014";
  return <span className="mtk-pill mtk-pill--neutral">{String(value).replace(/_/g, " ")}</span>;
}

function displayCount(value) {
  return value == null || value === "" ? "\u2014" : value;
}

function TrackerKpi({ label, value, unit, icon, tone, to }) {
  const body = (
    <>
      <div className={`mtk-kpi__icon mtk-kpi__icon--${tone}`}>{icon}</div>
      <div className="mtk-kpi__label">{label}</div>
      <div className="mtk-kpi__value">{value}</div>
      {unit ? <div className="mtk-kpi__unit">{unit}</div> : null}
    </>
  );
  if (!to) return <div className="mtk-kpi">{body}</div>;
  return (
    <Link to={to} className="mtk-kpi qc-dash__kpi-link">
      {body}
    </Link>
  );
}

function DashboardHeader({ exportRows, exportDisabled }) {
  return (
    <header className="mtk-hero">
      <div className="mtk-hero__row">
        <span>Inspect · Measure · Release</span>
        <div className="qc-dash__hero-actions">
          <Link className="qc-dash__primary" to="/quality/inspection?new=1">
            New Inspection
          </Link>
          <DashboardReportExport
            title="Quality Dashboard"
            filename="quality-dashboard"
            rows={exportRows}
            module="quality"
            disabled={exportDisabled}
          />
        </div>
      </div>
      <div className="mtk-hero__title">
        <h1>
          Manufacturing
          <span className="mtk-accent"> Quality Control</span>
        </h1>
        <p>Manufacturing Production Planning &amp; Factory Control Toolkit</p>
      </div>
    </header>
  );
}

export default function QualityDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [hub, setHub] = useState(EMPTY_QUALITY_HUB);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setLoadError("");
    try {
      const res = await getQualityHub();
      setHub(mergeQualityHub(res.data));
    } catch (err) {
      const classified = classifyApiError(err, "Quality dashboard data could not be loaded.");
      if (isRefresh) throw err;
      setLoadError(classified.message);
      setHub(EMPTY_QUALITY_HUB);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useManufacturingRefresh(() => load(true));

  const qualityExportRows = metricExportRows([
    { label: "Total inspections", value: hub.total_inspections },
    { label: "Passed", value: hub.passed },
    { label: "Failed", value: hub.failed },
    { label: "In-process", value: hub.in_process },
    { label: "Pass rate", value: hub.pass_rate == null ? "" : `${hub.pass_rate}%` },
  ]);

  if (loading) {
    return (
      <div className="qc-dash mtk-root mtk-theme--orange">
        <Loader label="Loading quality dashboard..." />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="qc-dash mtk-root mtk-theme--orange min-w-0">
        <DashboardHeader exportRows={[]} exportDisabled />
        <div className="mtk-body">
          <section className="mtk-panel" role="alert">
            <div className="mtk-panel__title">Quality Dashboard</div>
            <p className="qc-dash__empty">{loadError}</p>
            <div className="qc-dash__footer">
              <button type="button" className="qc-dash__retry" onClick={() => load()}>
                Try again
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const trends = hub.kpi_trends || {};
  const trendData = hub.inspection_trend || [];
  const typeData = hub.inspection_by_type || [];
  const recentRows = hub.recent_inspections || [];

  const trendUnit = (key) => {
    const item = trends[key];
    if (item?.pct == null) return null;
    const direction = item.direction === "up" ? "Up" : "Down";
    return `${direction} ${item.pct}% vs last 14 days`;
  };

  return (
    <div className="qc-dash mtk-root mtk-theme--orange min-w-0">
      <DashboardHeader exportRows={qualityExportRows} />
      <div className="mtk-kpi-row" aria-label="Quality summary">
        <TrackerKpi
          label="Total Inspections"
          value={displayCount(hub.total_inspections)}
          icon="QC"
          tone="orange"
          unit={trendUnit("total")}
          to="/quality/inspection"
        />
        <TrackerKpi
          label="Passed"
          value={displayCount(hub.passed)}
          icon="P"
          tone="green"
          unit={trendUnit("passed")}
          to="/quality/inspection?result=pass"
        />
        <TrackerKpi
          label="Failed"
          value={displayCount(hub.failed)}
          icon="F"
          tone="red"
          unit={trendUnit("failed")}
          to="/quality/inspection?result=fail"
        />
        <TrackerKpi
          label="In-Process"
          value={displayCount(hub.in_process)}
          icon="IP"
          tone="orange"
          unit={trendUnit("in_process")}
        />
        <TrackerKpi
          label="Pass Rate"
          value={hub.pass_rate == null ? "\u2014" : `${hub.pass_rate}%`}
          icon="%"
          tone="blue"
          unit={trendUnit("pass_rate")}
        />
      </div>
      <div className="mtk-body">
        <nav className="qc-dash__nav" aria-label="Quality pages">
          {QUALITY_PAGES.map((page) => (
            <Link key={page.to} to={page.to}>{page.label}</Link>
          ))}
        </nav>
        <div className="mtk-layout-row mtk-layout-row--1-1">
          <section className="mtk-panel">
            <div className="mtk-panel__title">Inspection Trend</div>
            {trendData.length ? (
              <div className="mtk-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 2 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="passed" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} name="Passed" />
                    <Line type="monotone" dataKey="failed" stroke="#dc2626" strokeWidth={2} dot={{ r: 2 }} name="Failed" />
                    <Line type="monotone" dataKey="in_process" stroke="#ea580c" strokeWidth={2} dot={{ r: 2 }} name="In-Process" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="qc-dash__empty">No inspection history available yet.</p>
            )}
          </section>
          <section className="mtk-panel">
            <div className="mtk-panel__title">Inspection by Type</div>
            {typeData.length ? (
              <div className="qc-dash__type">
                <div className="mtk-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={48}
                        stroke="none"
                        onClick={(entry) => {
                          const path = typeListPath(entry?.name);
                          if (path) navigate(path);
                        }}
                      >
                        {typeData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={entry.color || "#ea580c"}
                            cursor={typeListPath(entry.name) ? "pointer" : "default"}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 2 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="qc-dash__legend">
                  {typeData.map((item) => {
                    const path = typeListPath(item.name);
                    const label = (
                      <>
                        <span style={{ background: item.color || "#ea580c" }} />
                        <span>{item.name}</span>
                        <strong>{item.count}{item.pct != null ? ` (${item.pct}%)` : ""}</strong>
                      </>
                    );
                    return (
                      <li key={item.name}>
                        {path ? <Link to={path}>{label}</Link> : <div>{label}</div>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="qc-dash__empty">No inspection type data available yet.</p>
            )}
          </section>
        </div>
        <section className="mtk-panel">
          <div className="mtk-panel__title">Recent Inspections</div>
          <div className="mtk-table-wrap">
            <table className="mtk-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Result</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.length ? recentRows.map((row) => {
                  const path = typeListPath(row.type);
                  return (
                    <tr key={`${row.reference}-${row.date}-${row.type}`}>
                      <td>{row.date}</td>
                      <td className="mtk-left">{row.type}</td>
                      <td className="mtk-left">{row.reference}</td>
                      <td>{statusPill(row.status)}</td>
                      <td>{resultPill(row.result)}</td>
                      <td>
                        {path ? <Link to={path}>Open list</Link> : "\u2014"}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6}>No inspections yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="qc-dash__footer">
            <Link to="/quality/inspection">View all inspections</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
