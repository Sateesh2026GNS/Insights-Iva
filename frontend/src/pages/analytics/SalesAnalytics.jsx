import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  IndianRupee, ShoppingCart, Users, Percent, TrendingUp, Truck, Target, BarChart3,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart,
} from "recharts";

import AnalyticsAlertsBanner from "../../components/analytics/AnalyticsAlertsBanner";
import AnalyticsChartCard from "../../components/analytics/AnalyticsChartCard";
import AnalyticsDashboardHeader from "../../components/analytics/AnalyticsDashboardHeader";
import AnalyticsFilterBar from "../../components/analytics/AnalyticsFilterBar";
import AnalyticsKpiCard from "../../components/analytics/AnalyticsKpiCard";
import AnalyticsPageShell from "../../components/analytics/AnalyticsPageShell";
import DrillDownBreadcrumb from "../../components/analytics/DrillDownBreadcrumb";
import { ANALYTICS_AXIS, ANALYTICS_GRID, ANALYTICS_LEGEND, ANALYTICS_TOOLTIP } from "../../components/analytics/analyticsChartTheme";
import { useToast } from "../../context/ToastContext";
import { getSalesAnalytics } from "../../api/analyticsApi";
import { getSalesReportsSummary } from "../../api/salesApi";
import { CHART_COLORS, currentFiscalYearLabel, fiscalYearToYear, SOURCE_LINKS, formatInr } from "../../data/analyticsMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { apiErrorMessage } from "../../utils/apiError";

const KPI_ICONS = {
  revenue: IndianRupee, orders: ShoppingCart, customers: Users, conversion: Percent,
  aov: Target, growth: TrendingUp, pending: BarChart3, dispatch: Truck,
};

const emptyData = {
  kpis: [], alerts: [], monthly_revenue: [], top_customers: [],
  top_products: [], regional_sales: [], sales_funnel: [],
  quotation_conversion: [], order_status: [], drill_revenue: [],
  last_updated: null,
};

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
      const value = toNumeric(entry.value ?? entry.amount ?? entry.revenue ?? entry.total ?? entry.qty ?? entry.orders ?? entry.units);
      const value2 = toNumeric(entry.value2 ?? entry.expense ?? entry.target ?? entry.planned ?? entry.outflow);
      if (value !== null) normalized.value = value;
      if (value2 !== null) normalized.value2 = value2;
      return normalized;
    })
    .filter((entry) => entry && (entry.value !== undefined || entry.value2 !== undefined));
};

/**
 * @param {object} props
 * @param {boolean} [props.useSalesModuleApi] — load via GET /sales/reports/summary (sales RBAC).
 */
export default function SalesAnalytics({ useSalesModuleApi = false }) {
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(emptyData);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [drillTrail, setDrillTrail] = useState([]);
  const [filters, setFilters] = useState({
    fiscalYear: currentFiscalYearLabel(), month: "All Months", quarter: "All Quarters",
    plant: "All Plants", customer: "All Customers", dateFrom: "", dateTo: "",
  });

  useEffect(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from && !to) return;
    setFilters((f) => ({
      ...f,
      ...(from ? { dateFrom: from } : {}),
      ...(to ? { dateTo: to } : {}),
    }));
  }, [searchParams]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const year = fiscalYearToYear(filters.fiscalYear);
      const fetchSummary = useSalesModuleApi ? getSalesReportsSummary : getSalesAnalytics;
      const res = useSalesModuleApi ? await fetchSummary() : await fetchSummary(year);
      if (res.data) {
        setData({ ...emptyData, ...res.data });
        setDrillTrail(res.data.drill_revenue || []);
      } else if (!isRefresh) {
        setData(emptyData);
        setDrillTrail([]);
      }
    } catch (err) {
      if (isRefresh) throw err;
      setData(emptyData);
      setDrillTrail([]);
      const message = apiErrorMessage(err, "Failed to load sales analytics");
      setError(message);
      addToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, useSalesModuleApi, filters.fiscalYear]);

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

  const monthlyRevenue = normalizeChartData(data.monthly_revenue);
  const topCustomers = normalizeChartData(data.top_customers);
  const topProducts = normalizeChartData(data.top_products);
  const salesFunnel = normalizeChartData(data.sales_funnel);
  const orderStatus = normalizeChartData(data.order_status);
  const quotationConversion = normalizeChartData(data.quotation_conversion);

  const handleKpiClick = (kpi) => {
    if (kpi.key === "revenue" && data.drill_revenue) setDrillTrail(data.drill_revenue);
  };

  return (
    <AnalyticsPageShell>
      <AnalyticsDashboardHeader
        title={useSalesModuleApi ? "Sales Report" : "Sales KPI"}
        subtitle={
          useSalesModuleApi
            ? "Revenue, funnel, and customer insights from the sales module."
            : "Revenue, orders, funnel, and top customers or products from live sales data."
        }
        lastUpdated={data.last_updated}
        onRefresh={load}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
        loading={loading}
      />

      <AnalyticsAlertsBanner alerts={data.alerts} />
      <DrillDownBreadcrumb trail={drillTrail} onSelect={(_, i) => setDrillTrail(drillTrail.slice(0, i + 1))} />

      <AnalyticsFilterBar
        fiscalYear={filters.fiscalYear} onFiscalYearChange={setF("fiscalYear")}
        month={filters.month} onMonthChange={setF("month")}
        quarter={filters.quarter} onQuarterChange={setF("quarter")}
        plant={filters.plant} onPlantChange={setF("plant")}
        customer={filters.customer} onCustomerChange={setF("customer")}
        dateFrom={filters.dateFrom} onDateFromChange={setF("dateFrom")}
        dateTo={filters.dateTo} onDateToChange={setF("dateTo")}
      />

      <div className="ui-kpi-strip">
        {(data.kpis || []).map((kpi) => (
          <AnalyticsKpiCard key={kpi.key} kpi={kpi} icon={KPI_ICONS[kpi.key] || BarChart3} onClick={() => handleKpiClick(kpi)} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsChartCard id="chart-monthly-rev" title="Monthly Revenue" data={data.monthly_revenue} dataKeys={["label", "value"]} sourceLink={SOURCE_LINKS.sales} sourceLabel="Sales">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyRevenue}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={(v) => formatInr(v)} />
              <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.2} name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-top-cust" title="Top Customers" data={data.top_customers} dataKeys={["label", "value"]} sourceLink={SOURCE_LINKS.sales} sourceLabel="Sales">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topCustomers}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} />
              <Bar dataKey="value" name="Orders" fill={CHART_COLORS[1]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-top-prod" title="Top Products" data={data.top_products} dataKeys={["label", "value"]} sourceLink={SOURCE_LINKS.sales} sourceLabel="Sales">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} />
              <Bar dataKey="value" name="Qty" fill={CHART_COLORS[2]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-funnel" title="Sales Funnel" data={data.sales_funnel} dataKeys={["label", "value"]} sourceLink={SOURCE_LINKS.sales} sourceLabel="Sales">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesFunnel} layout="vertical">
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis type="number" {...ANALYTICS_AXIS} />
              <YAxis dataKey="label" type="category" width={100} {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} />
              <Bar dataKey="value" fill={CHART_COLORS[3]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-order-status" title="Order Status" data={data.order_status} dataKeys={["label", "value"]} sourceLink={SOURCE_LINKS.sales} sourceLabel="Sales">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={orderStatus} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} label>
                {(orderStatus || []).map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...ANALYTICS_TOOLTIP} />
              <Legend {...ANALYTICS_LEGEND} />
            </PieChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-quote-conv" title="Quotation Conversion" data={data.quotation_conversion} dataKeys={["label", "value"]} sourceLink={SOURCE_LINKS.sales} sourceLabel="Sales">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={quotationConversion}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} />
              <Line type="monotone" dataKey="value" stroke={CHART_COLORS[4]} name="Conversion %" />
            </LineChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>
      </div>
    </AnalyticsPageShell>
  );
}
