import { useCallback, useEffect, useState } from "react";
import {
  Activity, BarChart3, Box, CheckCircle, Cog, Factory, IndianRupee, Star, TrendingUp, Users,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart,
} from "recharts";

import AnalyticsAlertsBanner from "../../components/analytics/AnalyticsAlertsBanner";
import AnalyticsBenchmarkCards from "../../components/analytics/AnalyticsBenchmarkCards";
import AnalyticsChartCard from "../../components/analytics/AnalyticsChartCard";
import AnalyticsDashboardHeader from "../../components/analytics/AnalyticsDashboardHeader";
import AnalyticsFilterBar from "../../components/analytics/AnalyticsFilterBar";
import AnalyticsInsightsPanel from "../../components/analytics/AnalyticsInsightsPanel";
import AnalyticsKpiCard from "../../components/analytics/AnalyticsKpiCard";
import AnalyticsPageShell from "../../components/analytics/AnalyticsPageShell";
import AnalyticsQuickNav from "../../components/analytics/AnalyticsQuickNav";
import { ANALYTICS_AXIS, ANALYTICS_GRID, ANALYTICS_TOOLTIP } from "../../components/analytics/analyticsChartTheme";
import { useToast } from "../../context/ToastContext";
import { getExecutiveHub } from "../../api/analyticsApi";
import { CHART_COLORS, currentFiscalYearLabel, fiscalYearToYear, formatInr } from "../../data/analyticsMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { apiErrorMessage } from "../../utils/apiError";

const KPI_ICONS = {
  revenue: IndianRupee, profit: TrendingUp, production: Factory, inventory: Box,
  machine_health: Cog, worker_eff: Users, satisfaction: Star, pending_orders: BarChart3,
  quality: CheckCircle,
};

const emptyData = { kpis: [], alerts: [], benchmarks: [], revenue_trend: [], production_trend: [], inventory_value_trend: [], machine_health: [], ai_insights: [] };

const toNumeric = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeChartData = (rows = []) => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const entry = typeof row === "object" && row !== null ? row : {};
      const label = entry.label ?? entry.month ?? entry.date ?? entry.period ?? entry.name ?? entry.item ?? entry.category ?? "";
      const normalized = {
        ...entry,
        label: label || "N/A",
      };
      const value = toNumeric(entry.value ?? entry.amount ?? entry.total ?? entry.qty ?? entry.units ?? entry.score ?? entry.revenue ?? entry.profit ?? entry.inflow ?? entry.outflow);
      const value2 = toNumeric(entry.value2 ?? entry.expense ?? entry.target ?? entry.planned ?? entry.outflow ?? entry.stock_out);
      if (value !== null) normalized.value = value;
      if (value2 !== null) normalized.value2 = value2;
      return normalized;
    })
    .filter((entry) => entry && (entry.value !== undefined || entry.value2 !== undefined));
};

export default function ExecutiveDashboard() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(emptyData);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filters, setFilters] = useState({
    fiscalYear: currentFiscalYearLabel(),
    month: "All Months",
    quarter: "All Quarters",
    plant: "All Plants",
    dateFrom: "",
    dateTo: "",
  });

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await getExecutiveHub(fiscalYearToYear(filters.fiscalYear));
      if (res.data) setData({ ...emptyData, ...res.data });
      else if (!isRefresh) setData(emptyData);
    } catch (err) {
      if (isRefresh) throw err;
      setData(emptyData);
      const message = apiErrorMessage(err, "Failed to load executive hub");
      setError(message);
      addToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, filters.fiscalYear]);

  useEffect(() => { load(); }, [load]);
  useManufacturingRefresh(() => load(true));
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const t = setInterval(() => load(true), 60000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const setF = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));

  if (loading && !data.kpis?.length) {
    return <AnalyticsPageShell loading kpiCount={5} chartCount={4} />;
  }
  if (error && !data.kpis?.length) {
    return <AnalyticsPageShell error={error} onRetry={() => load()} />;
  }

  const revenueTrend = normalizeChartData(data.revenue_trend);
  const productionTrend = normalizeChartData(data.production_trend);
  const inventoryValueTrend = normalizeChartData(data.inventory_value_trend);
  const machineHealth = normalizeChartData(data.machine_health);

  return (
    <AnalyticsPageShell>
      <AnalyticsDashboardHeader
        title="Executive Dashboard"
        subtitle="Revenue, profit, production, inventory, and quality in one view."
        lastUpdated={data.last_updated}
        onRefresh={load}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
        loading={loading}
      />

      <AnalyticsQuickNav />
      <AnalyticsAlertsBanner alerts={data.alerts} />

      <AnalyticsFilterBar
        fiscalYear={filters.fiscalYear} onFiscalYearChange={setF("fiscalYear")}
        month={filters.month} onMonthChange={setF("month")}
        quarter={filters.quarter} onQuarterChange={setF("quarter")}
        plant={filters.plant} onPlantChange={setF("plant")}
        dateFrom={filters.dateFrom} onDateFromChange={setF("dateFrom")}
        dateTo={filters.dateTo} onDateToChange={setF("dateTo")}
        showAll={false}
      />

      <div className="ui-kpi-strip ui-kpi-strip--5">
        {(data.kpis || []).map((kpi) => (
          <AnalyticsKpiCard key={kpi.key} kpi={kpi} icon={KPI_ICONS[kpi.key] || Activity} />
        ))}
      </div>

      <AnalyticsBenchmarkCards benchmarks={data.benchmarks} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsChartCard id="exec-revenue" title="Revenue trend" data={revenueTrend} dataKeys={["label", "value"]}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueTrend}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} tickFormatter={(v) => formatInr(v)} />
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={(v) => [formatInr(v), "Revenue"]} />
              <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="exec-production" title="Production trend" data={productionTrend} dataKeys={["label", "value"]}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={productionTrend}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} />
              <Line type="monotone" dataKey="value" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="exec-inventory" title="Inventory value" data={inventoryValueTrend} dataKeys={["label", "value"]}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={inventoryValueTrend}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} tickFormatter={(v) => formatInr(v)} />
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={(v) => [formatInr(v), "Value"]} />
              <Area type="monotone" dataKey="value" stroke={CHART_COLORS[2]} fill={CHART_COLORS[2]} fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="exec-machines" title="Machine health" data={machineHealth} dataKeys={["label", "value"]}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={machineHealth}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} domain={[0, 100]} />
              <Tooltip {...ANALYTICS_TOOLTIP} />
              <Bar dataKey="value" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>
      </div>

      <AnalyticsInsightsPanel insights={data.ai_insights} title="Insights" />
    </AnalyticsPageShell>
  );
}
