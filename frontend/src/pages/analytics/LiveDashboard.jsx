import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, Cog, Package, Truck, Zap,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import AnalyticsAlertsBanner from "../../components/analytics/AnalyticsAlertsBanner";
import AnalyticsChartCard from "../../components/analytics/AnalyticsChartCard";
import AnalyticsDashboardHeader from "../../components/analytics/AnalyticsDashboardHeader";
import AnalyticsInsightsPanel from "../../components/analytics/AnalyticsInsightsPanel";
import AnalyticsKpiCard from "../../components/analytics/AnalyticsKpiCard";
import AnalyticsPageShell from "../../components/analytics/AnalyticsPageShell";
import { ANALYTICS_AXIS, ANALYTICS_GRID, ANALYTICS_TOOLTIP } from "../../components/analytics/analyticsChartTheme";
import { useToast } from "../../context/ToastContext";
import { getLiveDashboard } from "../../api/analyticsApi";
import { CHART_COLORS } from "../../data/analyticsMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { apiErrorMessage } from "../../utils/apiError";

const emptyData = {
  current_production: 0,
  active_machines: 0,
  total_machines: 0,
  todays_orders: 0,
  dispatches_today: 0,
  breakdown_alerts: 0,
  live_oee: 0,
  alerts: [],
  ai_insights: [],
  production_pulse: [],
};

export default function LiveDashboard() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(emptyData);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await getLiveDashboard();
      if (res.data) setData({ ...emptyData, ...res.data });
      else if (!isRefresh) setData(emptyData);
    } catch (err) {
      if (isRefresh) throw err;
      setData(emptyData);
      const message = apiErrorMessage(err, "Failed to load live dashboard");
      setError(message);
      addToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);
  useManufacturingRefresh(() => load(true));
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  if (loading && !data.production_pulse?.length && data.current_production === 0) {
    return <AnalyticsPageShell loading kpiCount={6} chartCount={1} />;
  }
  if (error && data.current_production === 0 && !data.production_pulse?.length) {
    return <AnalyticsPageShell error={error} onRetry={() => load()} />;
  }

  const liveKpis = [
    { key: "prod", label: "Current production", value: data.current_production, unit: "units/hr", format: "number" },
    { key: "machines", label: "Active machines", value: `${data.active_machines ?? 0}/${data.total_machines ?? 0}` },
    { key: "orders", label: "Today's orders", value: data.todays_orders, format: "number" },
    { key: "dispatch", label: "Dispatches today", value: data.dispatches_today, format: "number" },
    { key: "breakdown", label: "Breakdown alerts", value: data.breakdown_alerts, format: "number" },
    { key: "oee", label: "Live OEE", value: data.live_oee, unit: "%", format: "percent" },
  ];

  const icons = { prod: Activity, machines: Cog, orders: Package, dispatch: Truck, breakdown: AlertTriangle, oee: Zap };
  const tones = { prod: "primary", machines: "info", orders: "violet", dispatch: "teal", breakdown: "danger", oee: "success" };

  return (
    <AnalyticsPageShell>
      <AnalyticsDashboardHeader
        title="Live Dashboard"
        subtitle="Real-time production, machines, orders, dispatches, and OEE."
        lastUpdated={data.last_updated}
        onRefresh={load}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
        autoRefreshLabel="Auto refresh (30s)"
        loading={loading}
      />

      <Link
        to="/analytics/executive"
        className="text-xs font-medium text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
      >
        ← Executive Dashboard
      </Link>

      <AnalyticsAlertsBanner alerts={data.alerts} />

      <div className="ui-kpi-strip ui-kpi-strip--6">
        {liveKpis.map((kpi) => (
          <AnalyticsKpiCard key={kpi.key} kpi={kpi} icon={icons[kpi.key]} tone={tones[kpi.key]} />
        ))}
      </div>

      <AnalyticsChartCard
        id="live-pulse"
        title="Production pulse (today)"
        data={data.production_pulse}
        dataKeys={["label", "value"]}
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.production_pulse}>
            <CartesianGrid {...ANALYTICS_GRID} />
            <XAxis dataKey="label" {...ANALYTICS_AXIS} />
            <YAxis {...ANALYTICS_AXIS} />
            <Tooltip {...ANALYTICS_TOOLTIP} />
            <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.18} name="Units/hr" />
          </AreaChart>
        </ResponsiveContainer>
      </AnalyticsChartCard>

      <AnalyticsInsightsPanel insights={data.ai_insights} title="Insights" />
    </AnalyticsPageShell>
  );
}
