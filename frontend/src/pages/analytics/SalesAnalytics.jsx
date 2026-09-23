import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  IndianRupee, ShoppingCart, Users, Percent, TrendingUp, Truck, Target, BarChart3,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart,
} from "recharts";

import Loader from "../../components/common/Loader";
import SkeletonCard, { SkeletonChart } from "../../components/common/SkeletonCard";
import AnalyticsAlertsBanner from "../../components/analytics/AnalyticsAlertsBanner";
import AnalyticsChartCard from "../../components/analytics/AnalyticsChartCard";
import AnalyticsDashboardHeader from "../../components/analytics/AnalyticsDashboardHeader";
import AnalyticsFilterBar from "../../components/analytics/AnalyticsFilterBar";
import AnalyticsKpiCard from "../../components/analytics/AnalyticsKpiCard";
import DrillDownBreadcrumb from "../../components/analytics/DrillDownBreadcrumb";
import { useToast } from "../../context/ToastContext";
import { getSalesAnalytics } from "../../api/analyticsApi";
import { getSalesReportsSummary } from "../../api/salesApi";
import { CHART_COLORS, SOURCE_LINKS, formatInr } from "../../data/analyticsMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";

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
  const [data, setData] = useState(emptyData);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [drillTrail, setDrillTrail] = useState([]);
  const [filters, setFilters] = useState({
    fiscalYear: "2025-26", month: "All Months", quarter: "All Quarters",
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
    try {
      const fetchSummary = useSalesModuleApi ? getSalesReportsSummary : getSalesAnalytics;
      const res = await fetchSummary();
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
      addToast("Failed to load sales analytics", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, useSalesModuleApi]);

  useEffect(() => { load(); }, [load]);
  useManufacturingRefresh(() => load(true));
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const t = setInterval(() => load(true), 60000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  if (loading && !data.kpis?.length) {
    return (
      <div className="space-y-6 bg-slate-50 p-4 dark:bg-slate-900 sm:p-6">
        <div className="h-16 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (<SkeletonCard key={index} />))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (<SkeletonChart key={index} />))}
        </div>
      </div>
    );
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
    <div className="space-y-6 bg-slate-50 p-4 dark:bg-slate-900 sm:p-6">
      <AnalyticsDashboardHeader
        title={useSalesModuleApi ? "Sales Report" : "Sales Analytics"}
        subtitle={
          useSalesModuleApi
            ? "Revenue, funnel, and customer insights — sales module reporting."
            : "Revenue, orders, funnel, top customers/products — integrated with Sales module."
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {(data.kpis || []).map((kpi) => (
          <AnalyticsKpiCard key={kpi.key} kpi={kpi} icon={KPI_ICONS[kpi.key] || BarChart3} onClick={() => handleKpiClick(kpi)} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsChartCard id="chart-monthly-rev" title="Monthly Revenue" data={data.monthly_revenue} dataKeys={["label", "value"]} sourceLink={SOURCE_LINKS.sales} sourceLabel="Sales">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" /><YAxis /><Tooltip formatter={(v) => formatInr(v)} />
              <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.2} name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-top-cust" title="Top Customers" data={data.top_customers} dataKeys={["label", "value"]} sourceLink={SOURCE_LINKS.sales} sourceLabel="Sales">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topCustomers}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" /><YAxis /><Tooltip />
              <Bar dataKey="value" name="Orders" fill={CHART_COLORS[1]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-top-prod" title="Top Products" data={data.top_products} dataKeys={["label", "value"]} sourceLink={SOURCE_LINKS.sales} sourceLabel="Sales">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" /><YAxis /><Tooltip />
              <Bar dataKey="value" name="Qty" fill={CHART_COLORS[2]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-funnel" title="Sales Funnel" data={data.sales_funnel} dataKeys={["label", "value"]} sourceLink={SOURCE_LINKS.sales} sourceLabel="Sales">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesFunnel} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" /><YAxis dataKey="label" type="category" width={100} /><Tooltip />
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
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-quote-conv" title="Quotation Conversion" data={data.quotation_conversion} dataKeys={["label", "value"]} sourceLink={SOURCE_LINKS.sales} sourceLabel="Sales">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={quotationConversion}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" /><YAxis /><Tooltip />
              <Line type="monotone" dataKey="value" stroke={CHART_COLORS[4]} name="Conversion %" />
            </LineChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>
      </div>
    </div>
  );
}
