import { useCallback, useEffect, useState } from "react";
import {
  Activity, BarChart3, Box, CheckCircle, Clock, Cog, Factory, Gauge,
  IndianRupee, Package, Percent, Target, TrendingUp, Users, Zap,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart,
} from "recharts";

import AnalyticsAlertsBanner from "../../components/analytics/AnalyticsAlertsBanner";
import AnalyticsBenchmarkCards from "../../components/analytics/AnalyticsBenchmarkCards";
import AnalyticsChartCard from "../../components/analytics/AnalyticsChartCard";
import AnalyticsDashboardHeader from "../../components/analytics/AnalyticsDashboardHeader";
import AnalyticsFilterBar from "../../components/analytics/AnalyticsFilterBar";
import AnalyticsKpiCard from "../../components/analytics/AnalyticsKpiCard";
import AnalyticsPageShell from "../../components/analytics/AnalyticsPageShell";
import { ANALYTICS_AXIS, ANALYTICS_GRID, ANALYTICS_LEGEND, ANALYTICS_TOOLTIP } from "../../components/analytics/analyticsChartTheme";
import { useToast } from "../../context/ToastContext";
import { getProductionAnalytics } from "../../api/analyticsApi";
import { CHART_COLORS, currentFiscalYearLabel, fiscalYearToYear, SOURCE_LINKS } from "../../data/analyticsMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { apiErrorMessage } from "../../utils/apiError";

const KPI_ICONS = {
  planned: Target, actual: Factory, efficiency: Gauge, oee: Activity,
  utilization: Cog, rejection: Percent, downtime: Clock, cost: IndianRupee,
  wip: Package, completed: CheckCircle, worker: Users, avg_month: BarChart3,
};

const fmtTooltip = (v, name) => [Number(v).toLocaleString("en-IN"), name];
const emptyData = { kpis: [], alerts: [], monthly_production: [], production_trend: [], daily_output: [], shift_wise: [], machine_wise: [], product_wise: [], operator_performance: [], downtime_analysis: [], benchmarks: [] };

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
      const value = toNumeric(entry.value ?? entry.amount ?? entry.total ?? entry.qty ?? entry.units ?? entry.output ?? entry.efficiency);
      const value2 = toNumeric(entry.value2 ?? entry.planned ?? entry.target ?? entry.expense ?? entry.outflow);
      if (value !== null) normalized.value = value;
      if (value2 !== null) normalized.value2 = value2;
      return normalized;
    })
    .filter((entry) => entry && (entry.value !== undefined || entry.value2 !== undefined));
};

export default function ProductionAnalytics() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(emptyData);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [activeKpi, setActiveKpi] = useState(null);
  const [filters, setFilters] = useState({
    fiscalYear: currentFiscalYearLabel(), month: "All Months", quarter: "All Quarters",
    plant: "All Plants", department: "All Departments", warehouse: "All Warehouses",
    product: "All Products", customer: "All Customers", machine: "All Machines",
    dateFrom: "", dateTo: "",
  });

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await getProductionAnalytics(fiscalYearToYear(filters.fiscalYear));
      if (res.data) setData({ ...emptyData, ...res.data });
      else if (!isRefresh) setData(emptyData);
    } catch (err) {
      if (isRefresh) throw err;
      setData(emptyData);
      const message = apiErrorMessage(err, "Failed to load production analytics");
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

  if (loading && !data.kpis?.length) {
    return <AnalyticsPageShell loading kpiCount={4} chartCount={6} />;
  }
  if (error && !data.kpis?.length) {
    return <AnalyticsPageShell error={error} onRetry={() => load()} />;
  }

  const setF = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));

  const monthlyProduction = normalizeChartData(data.monthly_production);
  const productionTrend = normalizeChartData(data.production_trend);
  const dailyOutput = normalizeChartData(data.daily_output);
  const shiftWise = normalizeChartData(data.shift_wise);
  const machineWise = normalizeChartData(data.machine_wise);
  const productWise = normalizeChartData(data.product_wise);
  const operatorPerformance = normalizeChartData(data.operator_performance);
  const downtimeAnalysis = normalizeChartData(data.downtime_analysis);

  return (
    <AnalyticsPageShell>
      <AnalyticsDashboardHeader
        title="Production KPI"
        subtitle="Planned vs actual, OEE, machine utilization, downtime, and operator performance."
        lastUpdated={data.last_updated}
        onRefresh={load}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
        loading={loading}
      />

      <AnalyticsAlertsBanner alerts={data.alerts} />

      <AnalyticsFilterBar
        fiscalYear={filters.fiscalYear} onFiscalYearChange={setF("fiscalYear")}
        month={filters.month} onMonthChange={setF("month")}
        quarter={filters.quarter} onQuarterChange={setF("quarter")}
        plant={filters.plant} onPlantChange={setF("plant")}
        department={filters.department} onDepartmentChange={setF("department")}
        warehouse={filters.warehouse} onWarehouseChange={setF("warehouse")}
        product={filters.product} onProductChange={setF("product")}
        customer={filters.customer} onCustomerChange={setF("customer")}
        machine={filters.machine} onMachineChange={setF("machine")}
        dateFrom={filters.dateFrom} onDateFromChange={setF("dateFrom")}
        dateTo={filters.dateTo} onDateToChange={setF("dateTo")}
      />

      <div className="ui-kpi-strip">
        {(data.kpis || []).map((kpi) => (
          <AnalyticsKpiCard
            key={kpi.key}
            kpi={kpi}
            icon={KPI_ICONS[kpi.key] || Zap}
            active={activeKpi?.key === kpi.key}
            onClick={setActiveKpi}
          />
        ))}
      </div>

      <AnalyticsBenchmarkCards benchmarks={data.benchmarks} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsChartCard id="chart-monthly-prod" title="Monthly Production" subtitle="Planned vs Actual" data={data.monthly_production} dataKeys={["label", "value", "value2"]} sourceLink={SOURCE_LINKS.production} sourceLabel="Production">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyProduction}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={fmtTooltip} />
              <Legend {...ANALYTICS_LEGEND} />
              <Bar dataKey="value" name="Actual" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="value2" name="Planned" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-prod-trend" title="Production Trend" data={data.production_trend} sourceLink={SOURCE_LINKS.production} sourceLabel="Production">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={productionTrend}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={fmtTooltip} />
              <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.2} name="Output" />
            </AreaChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-daily" title="Daily Output" data={data.daily_output} sourceLink={SOURCE_LINKS.production} sourceLabel="Production">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyOutput}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} interval={4} />
              <YAxis {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={fmtTooltip} />
              <Line type="monotone" dataKey="value" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} name="Units" />
            </LineChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-shift" title="Shift Wise Production" data={data.shift_wise} sourceLink={SOURCE_LINKS.production} sourceLabel="Production">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={shiftWise}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={fmtTooltip} />
              <Bar dataKey="value" name="Units" radius={[6, 6, 0, 0]}>
                {data.shift_wise.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-machine" title="Machine Wise Production" data={data.machine_wise} sourceLink={SOURCE_LINKS.production} sourceLabel="Production">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={machineWise} layout="vertical">
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis type="number" {...ANALYTICS_AXIS} />
              <YAxis dataKey="label" type="category" width={80} {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={fmtTooltip} />
              <Bar dataKey="value" fill={CHART_COLORS[3]} name="Efficiency %" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-product" title="Product Wise Production" data={data.product_wise} sourceLink={SOURCE_LINKS.production} sourceLabel="Production">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={productWise} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} label>
                {productWise.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={fmtTooltip} />
              <Legend {...ANALYTICS_LEGEND} />
            </PieChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-operator" title="Operator Performance" data={data.operator_performance} sourceLink={SOURCE_LINKS.production} sourceLabel="Production">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={operatorPerformance}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} domain={[0, 100]} />
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={fmtTooltip} />
              <Bar dataKey="value" fill={CHART_COLORS[4]} name="Score %" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-downtime" title="Downtime Analysis" data={data.downtime_analysis} sourceLink="/maintenance" sourceLabel="Maintenance">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={downtimeAnalysis}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={(v) => [`${v} h`, "Downtime"]} />
              <Bar dataKey="value" fill="#ef4444" name="Hours" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>
      </div>
    </AnalyticsPageShell>
  );
}
