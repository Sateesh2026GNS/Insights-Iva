import { useCallback, useEffect, useMemo, useState } from "react";
import { Moon, Sun, TrendingDown, TrendingUp } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart,
} from "recharts";

import AnalyticsAlertsBanner from "../../components/analytics/AnalyticsAlertsBanner";
import AnalyticsBenchmarkCards from "../../components/analytics/AnalyticsBenchmarkCards";
import AnalyticsChartCard from "../../components/analytics/AnalyticsChartCard";
import AnalyticsErrorState from "../../components/analytics/AnalyticsErrorState";
import AnalyticsFilterBar from "../../components/analytics/AnalyticsFilterBar";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getProductionAnalytics } from "../../api/analyticsApi";
import {
  CHART_COLORS,
  changeArrow,
  changeColor,
  currentFiscalYearLabel,
  fiscalYearToYear,
  SOURCE_LINKS,
} from "../../data/analyticsMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { apiErrorMessage } from "../../utils/apiError";
import {
  MTK_ANALYTICS_AXIS,
  MTK_ANALYTICS_GRID,
  MTK_ANALYTICS_LEGEND,
  MTK_ANALYTICS_TOOLTIP,
  PRODUCTION_ANALYTICS_TOOLKIT_SUBTITLE,
  PRODUCTION_ANALYTICS_TOOLKIT_TAGLINE,
  productionAnalyticsKpiDisplay,
  productionAnalyticsKpiIcon,
  productionAnalyticsKpiTone,
} from "../../utils/productionAnalyticsToolkit";
import "../../styles/manufacturing-toolkit.css";
import "../../styles/production-analytics-toolkit.css";

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

function formatLastUpdated(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function ProductionAnalytics() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(emptyData);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [appearance, setAppearance] = useState("day");
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

  const setF = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));

  const monthlyProduction = useMemo(() => normalizeChartData(data.monthly_production), [data.monthly_production]);
  const productionTrend = useMemo(() => normalizeChartData(data.production_trend), [data.production_trend]);
  const dailyOutput = useMemo(() => normalizeChartData(data.daily_output), [data.daily_output]);
  const shiftWise = useMemo(() => normalizeChartData(data.shift_wise), [data.shift_wise]);
  const machineWise = useMemo(() => normalizeChartData(data.machine_wise), [data.machine_wise]);
  const productWise = useMemo(() => normalizeChartData(data.product_wise), [data.product_wise]);
  const operatorPerformance = useMemo(() => normalizeChartData(data.operator_performance), [data.operator_performance]);
  const downtimeAnalysis = useMemo(() => normalizeChartData(data.downtime_analysis), [data.downtime_analysis]);

  const lastUpdatedLabel = formatLastUpdated(data.last_updated);

  const toolkitHero = (
    <header className="mtk-hero">
      <div className="mtk-hero__row">
        <span>{PRODUCTION_ANALYTICS_TOOLKIT_TAGLINE}</span>
        {lastUpdatedLabel ? (
          <div className="mtk-hero__meta">
            <div>Last updated</div>
            <div>{lastUpdatedLabel}</div>
          </div>
        ) : null}
      </div>
      <div className="mtk-hero__title">
        <h1>Production KPI</h1>
        <p style={{ fontSize: 10, opacity: 0.9, margin: 0 }}>
          Planned vs actual, OEE, machine utilization, downtime, and operator performance.
        </p>
        <p style={{ fontSize: 9, opacity: 0.85, margin: "4px 0 0" }}>{PRODUCTION_ANALYTICS_TOOLKIT_SUBTITLE}</p>
      </div>
    </header>
  );

  const toolkitKpiRow = (
    <div className="mtk-kpi-row" aria-label="Production analytics KPIs">
      {(data.kpis || []).map((kpi, index) => {
        const pct = kpi.change_pct;
        const isUp = pct > 0;
        const TrendIcon = isUp ? TrendingUp : TrendingDown;
        const active = activeKpi?.key === kpi.key;
        return (
          <button
            key={kpi.key}
            type="button"
            className={`mtk-kpi mtk-kpi--button${active ? " mtk-kpi--active" : ""}`}
            onClick={() => setActiveKpi(kpi)}
            title={kpi.label}
          >
            <div className={`mtk-kpi__icon mtk-kpi__icon--${productionAnalyticsKpiTone(index)}`}>
              {productionAnalyticsKpiIcon(kpi)}
            </div>
            <div className="mtk-kpi__label">{kpi.label}</div>
            <div className="mtk-kpi__value">{productionAnalyticsKpiDisplay(kpi)}</div>
            {pct != null ? (
              <div className={`production-analytics-kpi-meta flex items-center justify-center gap-0.5 ${changeColor(pct)}`}>
                <TrendIcon className="h-2.5 w-2.5" aria-hidden />
                {changeArrow(pct)} {Math.abs(pct)}%
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  if (loading && !data.kpis?.length) {
    return (
      <div className={`production-analytics-page production-analytics-page--toolkit${appearance === "night" ? " production-analytics-page--night" : ""} min-h-full min-w-0 w-full`}>
        <div className="mtk-root mtk-theme--teal">
          {toolkitHero}
          <div className="mtk-body production-analytics-loading">
            <Loader label="Loading production analytics…" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !data.kpis?.length) {
    return (
      <div className={`production-analytics-page production-analytics-page--toolkit${appearance === "night" ? " production-analytics-page--night" : ""} min-h-full min-w-0 w-full`}>
        <div className="mtk-root mtk-theme--teal">
          {toolkitHero}
          <div className="mtk-body production-analytics-error">
            <AnalyticsErrorState message={error} onRetry={() => load()} />
          </div>
        </div>
      </div>
    );
  }

  const chartVariant = "toolkit";
  const axis = MTK_ANALYTICS_AXIS;
  const grid = MTK_ANALYTICS_GRID;
  const tooltip = MTK_ANALYTICS_TOOLTIP;
  const legend = MTK_ANALYTICS_LEGEND;

  return (
    <div className={`production-analytics-page production-analytics-page--toolkit${appearance === "night" ? " production-analytics-page--night" : ""} min-h-full min-w-0 w-full`}>
      <div className="mtk-root mtk-theme--teal">
        {toolkitHero}
        {toolkitKpiRow}

        <div className="mtk-body min-w-0">
          <div className="production-analytics-toolbar">
            <div className="production-analytics-appearance" role="group" aria-label="Page appearance">
              <button
                type="button"
                className={appearance === "day" ? "is-active" : ""}
                aria-pressed={appearance === "day"}
                onClick={() => setAppearance("day")}
              >
                <Sun size={14} aria-hidden /> Day
              </button>
              <button
                type="button"
                className={appearance === "night" ? "is-active" : ""}
                aria-pressed={appearance === "night"}
                onClick={() => setAppearance("night")}
              >
                <Moon size={14} aria-hidden /> Night
              </button>
            </div>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(autoRefresh)}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[var(--color-border)]"
              />
              Auto refresh (60s)
            </label>
          </div>

          <div className="production-analytics-alerts">
            <AnalyticsAlertsBanner alerts={data.alerts} />
          </div>

          <section className="mtk-panel min-w-0">
            <div className="mtk-panel__title">Reporting period</div>
            <div className="production-analytics-filter-body">
              <AnalyticsFilterBar
                embedded
                fiscalYear={filters.fiscalYear}
                onFiscalYearChange={setF("fiscalYear")}
                month={filters.month}
                onMonthChange={setF("month")}
                quarter={filters.quarter}
                onQuarterChange={setF("quarter")}
                plant={filters.plant}
                onPlantChange={setF("plant")}
                department={filters.department}
                onDepartmentChange={setF("department")}
                warehouse={filters.warehouse}
                onWarehouseChange={setF("warehouse")}
                product={filters.product}
                onProductChange={setF("product")}
                customer={filters.customer}
                onCustomerChange={setF("customer")}
                machine={filters.machine}
                onMachineChange={setF("machine")}
                dateFrom={filters.dateFrom}
                onDateFromChange={setF("dateFrom")}
                dateTo={filters.dateTo}
                onDateToChange={setF("dateTo")}
              />
            </div>
          </section>

          {data.benchmarks?.length ? (
            <div className="production-analytics-benchmarks">
              <AnalyticsBenchmarkCards benchmarks={data.benchmarks} />
            </div>
          ) : null}

          <div className="production-analytics-charts grid gap-4 lg:grid-cols-2">
            <AnalyticsChartCard id="chart-monthly-prod" variant={chartVariant} title="Monthly Production" subtitle="Planned vs Actual" data={data.monthly_production} dataKeys={["label", "value", "value2"]} sourceLink={SOURCE_LINKS.production} sourceLabel="Production">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyProduction}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} />
                  <Tooltip {...tooltip} formatter={fmtTooltip} />
                  <Legend {...legend} />
                  <Bar dataKey="value" name="Actual" fill={CHART_COLORS[0]} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="value2" name="Planned" fill={CHART_COLORS[1]} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsChartCard>

            <AnalyticsChartCard id="chart-prod-trend" variant={chartVariant} title="Production Trend" data={data.production_trend} sourceLink={SOURCE_LINKS.production} sourceLabel="Production">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={productionTrend}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} />
                  <Tooltip {...tooltip} formatter={fmtTooltip} />
                  <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.2} name="Output" />
                </AreaChart>
              </ResponsiveContainer>
            </AnalyticsChartCard>

            <AnalyticsChartCard id="chart-daily" variant={chartVariant} title="Daily Output" data={data.daily_output} sourceLink={SOURCE_LINKS.production} sourceLabel="Production">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyOutput}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="label" {...axis} interval={4} />
                  <YAxis {...axis} />
                  <Tooltip {...tooltip} formatter={fmtTooltip} />
                  <Line type="monotone" dataKey="value" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} name="Units" />
                </LineChart>
              </ResponsiveContainer>
            </AnalyticsChartCard>

            <AnalyticsChartCard id="chart-shift" variant={chartVariant} title="Shift Wise Production" data={data.shift_wise} sourceLink={SOURCE_LINKS.production} sourceLabel="Production">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={shiftWise}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} />
                  <Tooltip {...tooltip} formatter={fmtTooltip} />
                  <Bar dataKey="value" name="Units" radius={[2, 2, 0, 0]}>
                    {data.shift_wise.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsChartCard>

            <AnalyticsChartCard id="chart-machine" variant={chartVariant} title="Machine Wise Production" data={data.machine_wise} sourceLink={SOURCE_LINKS.production} sourceLabel="Production">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={machineWise} layout="vertical">
                  <CartesianGrid {...grid} />
                  <XAxis type="number" {...axis} />
                  <YAxis dataKey="label" type="category" width={80} {...axis} />
                  <Tooltip {...tooltip} formatter={fmtTooltip} />
                  <Bar dataKey="value" fill={CHART_COLORS[3]} name="Efficiency %" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsChartCard>

            <AnalyticsChartCard id="chart-product" variant={chartVariant} title="Product Wise Production" data={data.product_wise} sourceLink={SOURCE_LINKS.production} sourceLabel="Production">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={productWise} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={88} label>
                    {productWise.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...tooltip} formatter={fmtTooltip} />
                  <Legend {...legend} />
                </PieChart>
              </ResponsiveContainer>
            </AnalyticsChartCard>

            <AnalyticsChartCard id="chart-operator" variant={chartVariant} title="Operator Performance" data={data.operator_performance} sourceLink={SOURCE_LINKS.production} sourceLabel="Production">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={operatorPerformance}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} domain={[0, 100]} />
                  <Tooltip {...tooltip} formatter={fmtTooltip} />
                  <Bar dataKey="value" fill={CHART_COLORS[4]} name="Score %" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsChartCard>

            <AnalyticsChartCard id="chart-downtime" variant={chartVariant} title="Downtime Analysis" data={data.downtime_analysis} sourceLink="/maintenance" sourceLabel="Maintenance">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={downtimeAnalysis}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} />
                  <Tooltip {...tooltip} formatter={(v) => [`${v} h`, "Downtime"]} />
                  <Bar dataKey="value" fill="#dc2626" name="Hours" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsChartCard>
          </div>
        </div>
      </div>
    </div>
  );
}
