import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Archive, BarChart3, Box, IndianRupee, Package, Percent, RefreshCw, TrendingUp, Warehouse,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart,
} from "recharts";

import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import AnalyticsAlertsBanner from "../../components/analytics/AnalyticsAlertsBanner";
import AnalyticsChartCard from "../../components/analytics/AnalyticsChartCard";
import AnalyticsDashboardHeader from "../../components/analytics/AnalyticsDashboardHeader";
import AnalyticsFilterBar from "../../components/analytics/AnalyticsFilterBar";
import AnalyticsKpiCard from "../../components/analytics/AnalyticsKpiCard";
import AnalyticsPageShell from "../../components/analytics/AnalyticsPageShell";
import { ANALYTICS_AXIS, ANALYTICS_GRID, ANALYTICS_LEGEND, ANALYTICS_TOOLTIP } from "../../components/analytics/analyticsChartTheme";
import { useToast } from "../../context/ToastContext";
import { getInventoryAnalytics } from "../../api/analyticsApi";
import { CHART_COLORS, currentFiscalYearLabel, SOURCE_LINKS, formatInr } from "../../data/analyticsMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { apiErrorMessage } from "../../utils/apiError";

const KPI_ICONS = {
  turnover: TrendingUp, outflow: Package, avg_inv: Box, value: IndianRupee,
  fast: BarChart3, slow: RefreshCw, dead: Archive, reorder: AlertTriangle,
  accuracy: Percent, warehouse: Warehouse,
};

const emptyData = { kpis: [], alerts: [], stock_in_vs_out: [], warehouse_occupancy: [], abc_analysis: [], inventory_aging: [], monthly_consumption: [], value_trend: [], fast_moving: [], slow_moving: [], dead_stock: [], reorder_alerts: [] };

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
      const value = toNumeric(entry.value ?? entry.amount ?? entry.total ?? entry.qty ?? entry.units ?? entry.occupancy ?? entry.turnover ?? entry.value);
      const value2 = toNumeric(entry.value2 ?? entry.expense ?? entry.outflow ?? entry.stock_out ?? entry.target ?? entry.planned);
      if (value !== null) normalized.value = value;
      if (value2 !== null) normalized.value2 = value2;
      return normalized;
    })
    .filter((entry) => entry && (entry.value !== undefined || entry.value2 !== undefined));
};

export default function InventoryAnalytics() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(emptyData);
  const [autoRefresh, setAutoRefresh] = useState(false);
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
      const res = await getInventoryAnalytics();
      if (res.data) setData({ ...emptyData, ...res.data });
      else if (!isRefresh) setData(emptyData);
    } catch (err) {
      if (isRefresh) throw err;
      setData(emptyData);
      const message = apiErrorMessage(err, "Failed to load inventory analytics");
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
    const t = setInterval(() => load(true), 60000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  if (loading && !data.kpis?.length) {
    return <AnalyticsPageShell loading kpiCount={5} chartCount={6} />;
  }
  if (error && !data.kpis?.length) {
    return <AnalyticsPageShell error={error} onRetry={() => load()} />;
  }
  const setF = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));

  const stockInVsOut = normalizeChartData(data.stock_in_vs_out);
  const warehouseOccupancy = normalizeChartData(data.warehouse_occupancy);
  const abcAnalysis = normalizeChartData(data.abc_analysis);
  const inventoryAging = normalizeChartData(data.inventory_aging);
  const monthlyConsumption = normalizeChartData(data.monthly_consumption);
  const valueTrend = normalizeChartData(data.value_trend);

  return (
    <AnalyticsPageShell>
      <AnalyticsDashboardHeader
        title="Inventory KPI"
        subtitle="Turnover, stock value, ABC analysis, aging, and warehouse occupancy."
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
        warehouse={filters.warehouse} onWarehouseChange={setF("warehouse")}
        dateFrom={filters.dateFrom} onDateFromChange={setF("dateFrom")}
        dateTo={filters.dateTo} onDateToChange={setF("dateTo")}
      />

      <div className="ui-kpi-strip ui-kpi-strip--5">
        {(data.kpis || []).map((kpi) => (
          <AnalyticsKpiCard key={kpi.key} kpi={kpi} icon={KPI_ICONS[kpi.key] || Box} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsChartCard id="chart-stock-io" title="Stock In vs Stock Out" data={data.stock_in_vs_out} dataKeys={["label", "value", "value2"]} sourceLink={SOURCE_LINKS.inventory} sourceLabel="Inventory">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stockInVsOut}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} />
              <Legend {...ANALYTICS_LEGEND} />
              <Bar dataKey="value" name="Stock In" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="value2" name="Stock Out" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-warehouse" title="Warehouse Occupancy" data={data.warehouse_occupancy} sourceLink={SOURCE_LINKS.inventory} sourceLabel="Inventory">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={warehouseOccupancy}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} domain={[0, 100]} />
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={(v) => [`${v}%`, "Occupancy"]} />
              <Bar dataKey="value" fill={CHART_COLORS[2]} name="%" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-abc" title="ABC Analysis" data={data.abc_analysis} sourceLink={SOURCE_LINKS.inventory} sourceLabel="Inventory">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={abcAnalysis} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                {abcAnalysis.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
              </Pie>
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={(v) => [`${v}%`, "Share"]} />
              <Legend {...ANALYTICS_LEGEND} />
            </PieChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-aging" title="Inventory Aging" data={data.inventory_aging} sourceLink={SOURCE_LINKS.inventory} sourceLabel="Inventory">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={inventoryAging}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={(v) => [`${v}%`, "Share"]} />
              <Bar dataKey="value" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-consumption" title="Monthly Consumption" data={data.monthly_consumption} sourceLink={SOURCE_LINKS.inventory} sourceLabel="Inventory">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyConsumption}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} />
              <Tooltip {...ANALYTICS_TOOLTIP} />
              <Line type="monotone" dataKey="value" stroke={CHART_COLORS[4]} strokeWidth={2} name="Units" />
            </LineChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard id="chart-value-trend" title="Inventory Value Trend" data={data.value_trend} sourceLink={SOURCE_LINKS.inventory} sourceLabel="Inventory">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={valueTrend}>
              <CartesianGrid {...ANALYTICS_GRID} />
              <XAxis dataKey="label" {...ANALYTICS_AXIS} />
              <YAxis {...ANALYTICS_AXIS} tickFormatter={(v) => formatInr(v)} />
              <Tooltip {...ANALYTICS_TOOLTIP} formatter={(v) => [formatInr(v), "Value"]} />
              <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.15} name="Value" />
            </AreaChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { title: "Fast moving items", rows: data.fast_moving, cols: ["item", "qty", "turns"] },
          { title: "Slow moving items", rows: data.slow_moving, cols: ["item", "qty", "days_idle"] },
          { title: "Dead stock", rows: data.dead_stock, cols: ["item", "qty", "value"] },
          { title: "Reorder alerts", rows: data.reorder_alerts, cols: ["item", "current", "reorder", "warehouse"] },
        ].map(({ title, rows, cols }) => (
          <section key={title} className="ui-card ui-card--padded min-w-0">
            <h3 className="mb-3 text-sm font-medium text-[var(--color-text)]">{title}</h3>
            {rows?.length ? (
              <div className="overflow-x-auto">
                <table className="ui-table w-full text-left text-xs">
                  <thead className="ui-table-head">
                    <tr>
                      <SerialNumberHeader className="pb-2" />
                      {cols.map((c) => <th key={c} className="pb-2 pr-3 font-medium capitalize">{c.replace("_", " ")}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={`${title}-${i}`} className="border-b border-[var(--color-border)]">
                        <SerialNumberCell rowIndex={i} className="py-2" />
                        {cols.map((c) => (
                          <td key={c} className={`py-2 pr-3 ${c === "value" || c === "qty" || c === "current" || c === "reorder" || c === "turns" || c === "days_idle" ? "font-numeric text-right" : ""}`}>
                            {c === "value" ? formatInr(r[c]) : r[c]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ui-caption">No items in this period.</p>
            )}
          </section>
        ))}
      </div>
    </AnalyticsPageShell>
  );
}
