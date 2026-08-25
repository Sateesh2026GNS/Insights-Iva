import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle, ClipboardCheck, Clock, Percent, XCircle } from "lucide-react";

import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import { getQualityHub } from "../../api/qualityApi";
import { EMPTY_QUALITY_HUB, mergeQualityHub, qcStatusColor } from "../../data/qualityMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";

const TONE_CLASS = {
  primary: "!bg-[#dbeafe] !text-[#2563eb]",
  success: "!bg-[#dcfce7] !text-[#16a34a]",
  danger: "!bg-[#fee2e2] !text-[#ef4444]",
  warning: "!bg-[#ffedd5] !text-[#ea580c]",
  violet: "!bg-[#ede9fe] !text-[#7c3aed]",
};

function QualityKpi({ label, value, icon: Icon, tone, trendPct, trendDir, trendGoodWhenDown = false }) {
  const isUp = trendDir === "up";
  const positive = trendGoodWhenDown ? !isUp : isUp;
  return (
    <div className="ui-kpi">
      <div className="ui-kpi__top">
        <p className="ui-kpi__label">{label}</p>
        {Icon ? (
          <div className={`ui-kpi__icon ${TONE_CLASS[tone] || TONE_CLASS.primary}`}>
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        ) : null}
      </div>
      <p className="ui-kpi__value">{value}</p>
      {trendPct != null ? (
        <p className={`text-xs font-medium ${positive ? "text-emerald-600" : "text-red-600"}`}>
          {isUp ? "↑" : "↓"} {trendPct}% vs last 14 days
        </p>
      ) : null}
    </div>
  );
}

function StatusPill({ value, kind = "status" }) {
  const key = String(value || "").toLowerCase();
  const label =
    kind === "result"
      ? key === "passed" || key === "pass"
        ? "Passed"
        : key === "failed" || key === "fail"
          ? "Failed"
          : "—"
      : key === "completed"
        ? "Completed"
        : key === "in_progress"
          ? "In Progress"
          : value || "—";

  if (kind === "result" && (key === "passed" || key === "pass")) {
    return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Passed</span>;
  }
  if (kind === "result" && (key === "failed" || key === "fail")) {
    return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">Failed</span>;
  }
  if (kind === "result" && !value) {
    return <span className="text-sm text-[var(--color-text-muted)]">—</span>;
  }
  if (key === "completed") {
    return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Completed</span>;
  }
  if (key === "in_progress") {
    return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">In Progress</span>;
  }
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${qcStatusColor(key)}`}>{label}</span>;
}

export default function QualityDashboard() {
  const [loading, setLoading] = useState(true);
  const [hub, setHub] = useState(EMPTY_QUALITY_HUB);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getQualityHub();
      setHub(mergeQualityHub(res.data));
    } catch (err) {
      if (isRefresh) throw err;
      setHub(EMPTY_QUALITY_HUB);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useManufacturingRefresh(() => load(true));

  if (loading) return <Loader label="Loading quality dashboard..." />;

  const trends = hub.kpi_trends || {};
  const trendData = hub.inspection_trend || [];
  const typeData = hub.inspection_by_type || [];
  const recentRows = hub.recent_inspections || [];

  return (
    <div className="min-w-0 space-y-5 pb-4">
      <PageHeader subtitle="Overview of quality activities and performance." />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <QualityKpi
          label="Total Inspections"
          value={hub.total_inspections}
          icon={ClipboardCheck}
          tone="primary"
          trendPct={trends.total?.pct}
          trendDir={trends.total?.direction}
        />
        <QualityKpi
          label="Passed"
          value={hub.passed}
          icon={CheckCircle}
          tone="success"
          trendPct={trends.passed?.pct}
          trendDir={trends.passed?.direction}
        />
        <QualityKpi
          label="Failed"
          value={hub.failed}
          icon={XCircle}
          tone="danger"
          trendPct={trends.failed?.pct}
          trendDir={trends.failed?.direction}
          trendGoodWhenDown
        />
        <QualityKpi
          label="In-Process"
          value={hub.in_process ?? 0}
          icon={Clock}
          tone="warning"
          trendPct={trends.in_process?.pct}
          trendDir={trends.in_process?.direction}
        />
        <QualityKpi
          label="Pass Rate"
          value={`${hub.pass_rate ?? 0}%`}
          icon={Percent}
          tone="violet"
          trendPct={trends.pass_rate?.pct}
          trendDir={trends.pass_rate?.direction}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="ui-card ui-card--padded">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">Inspection Trend</h2>
          <div className="mb-3 flex flex-wrap gap-4 text-xs font-medium text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Passed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Failed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-500" /> In-Process
            </span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="passed" stroke="#22c55e" strokeWidth={2} dot={false} name="Passed" />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={false} name="Failed" />
                <Line type="monotone" dataKey="in_process" stroke="#f97316" strokeWidth={2} dot={false} name="In-Process" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ui-card ui-card--padded">
          <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">Inspection by Type</h2>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative h-52 w-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={82}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {typeData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold text-[var(--color-text)]">{hub.total_inspections}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Total</p>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2.5 text-sm">
              {typeData.map((item) => (
                <li key={item.name} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                    <span className="truncate text-[var(--color-text-secondary)]">{item.name}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--color-text-muted)]">
                    {item.count} ({item.pct}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Recent Inspections Table */}
      <div className="ui-card overflow-hidden">
        <div className="border-b border-[var(--color-border-soft)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Recent Inspections</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead className="ui-table-head">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-muted)]">
              {recentRows.map((row) => (
                <tr key={`${row.reference}-${row.date}`} className="hover:bg-[var(--color-surface-muted)]/40">
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-secondary)]">{row.date}</td>
                  <td className="px-4 py-3 text-[var(--color-text)]">{row.type}</td>
                  <td className="px-4 py-3 font-medium text-[var(--color-text)]">{row.reference}</td>
                  <td className="px-4 py-3">
                    <StatusPill value={row.status} kind="status" />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill value={row.result} kind="result" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[var(--color-border-soft)] px-5 py-3">
          <Link to="/quality/inspection" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
            View All Inspections →
          </Link>
        </div>
      </div>
    </div>
  );
}
