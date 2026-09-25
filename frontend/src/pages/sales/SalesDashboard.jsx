import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Bell,
  ClipboardList,
  FileText,
  IndianRupee,
  Percent,
  Plus,
  ShoppingCart,
  Target,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";

import KpiCard from "../../components/common/KpiCard";
import Button from "../../components/common/Button";
import { ListPageShell } from "../../components/common/ListPageShell";
import { AsyncPageBody, EmptyState } from "../../components/common/states";
import RecentTransactionsPeriodSelect from "../../components/accounts/RecentTransactionsPeriodSelect";
import DashboardReportExport from "../../components/common/DashboardReportExport";
import { metricExportRows } from "../../utils/dashboardExportRows";
import CreateLeadModal from "../../components/sales/CreateLeadModal";
import SalesDashboardMyWork from "../../components/sales/SalesDashboardMyWork";
import {
  getLeadsEnriched,
  getQuotationSummary,
  getSalesHub,
  getSalesOrdersEnriched,
} from "../../api/salesApi";
import { formatInr, statusColor } from "../../data/salesMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import { classifyApiError } from "../../utils/apiError";
import useAuth from "../../hooks/useAuth";
import { userCanCreateSalesJobCard } from "../../config/permissions";
import { jobCardCreateUrl } from "../../utils/jobCardRoutes";
import { toIsoDate } from "../../utils/dateUtils";
import {
  resolveSalesDashboardKpiLink,
  salesDashboardKpiNavLabel,
} from "../../utils/salesDashboardKpis";
import { salesDashboardRangeParams } from "../../utils/salesDashboardPeriod";
import {
  PERIOD_RECENT,
  buildRecentTransactionsPeriodOptions,
  periodOptionLabel,
  resolveRecentTransactionsPeriod,
} from "../../utils/recentTransactionsPeriod";
import "../../styles/sales-dashboard.css";

const emptyHub = {
  monthly_revenue: 0,
  total_orders: 0,
  pending_orders: 0,
  dispatch_pending: 0,
  outstanding_payments: 0,
  open_leads: 0,
  open_quotations: 0,
  open_quotations_value: 0,
  conversion_rate: 0,
  period_label: "",
  pipeline_production: 0,
  pipeline_completed: 0,
  top_customers: [],
  sales_executive_performance: [],
  alerts: [],
};

function pickData(res) {
  const body = res?.data;
  if (body && typeof body === "object" && "data" in body && body.data != null) return body.data;
  return body;
}

function initials(name) {
  const parts = String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function parseIsoDay(iso) {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function followupStatus(iso) {
  const d = parseIsoDay(iso);
  if (!d) return { label: "Pending", badgeClass: statusColor("pending") };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  if (day < today) return { label: "Overdue", badgeClass: statusColor("overdue") };
  if (day.getTime() === today.getTime()) return { label: "Today", badgeClass: "bg-amber-100 text-amber-800" };
  return { label: "Pending", badgeClass: statusColor("pending") };
}

function buildDailyRevenueSeries(orders, rangeFrom, rangeTo) {
  const from = parseIsoDay(rangeFrom);
  const to = parseIsoDay(rangeTo);
  if (!from || !to) return [];
  const map = new Map();
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const key = toIsoDate(cursor);
    map.set(key, 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const o of orders || []) {
    const day = parseIsoDay(o.order_date);
    if (!day) continue;
    const key = toIsoDate(day);
    if (!map.has(key)) continue;
    map.set(key, (map.get(key) || 0) + Number(o.total_amount || o.amount || 0));
  }
  let cumulative = 0;
  return [...map.entries()].map(([iso, dayAmt]) => {
    cumulative += dayAmt;
    const d = parseIsoDay(iso);
    const label = d
      ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      : iso;
    return { iso, label, value: cumulative };
  });
}

const PIPELINE_STAGES = [
  { key: "leads", label: "Leads", to: "/sales/leads" },
  { key: "quotations", label: "Quotations", to: "/sales/quotations" },
  { key: "sales_orders", label: "Sales Orders", to: "/sales/orders" },
  { key: "production", label: "Production", to: "/manufacturing/workflow" },
  { key: "dispatch", label: "Dispatch", to: "/sales/dispatch" },
  { key: "completed", label: "Completed", to: "/sales/orders" },
];

const SUMMARY_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6"];

export default function SalesDashboard() {
  const { user } = useAuth();
  const { online, markRequestStart, markRequestEnd, registerRetry } = useNetworkStatus();
  const canCreateJobCard = userCanCreateSalesJobCard(user);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadErrorObj, setLoadErrorObj] = useState(null);
  const [hub, setHub] = useState(emptyHub);
  const [quoteSummary, setQuoteSummary] = useState(null);
  const [leads, setLeads] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [alertTab, setAlertTab] = useState("all");

  const periodOptions = useMemo(() => buildRecentTransactionsPeriodOptions(), []);
  const initialRange = useMemo(
    () => resolveRecentTransactionsPeriod(PERIOD_RECENT, periodOptions),
    [periodOptions]
  );
  const [periodId, setPeriodId] = useState(PERIOD_RECENT);
  const [customRange, setCustomRange] = useState(null);
  const [rangeFrom, setRangeFrom] = useState(initialRange.from);
  const [rangeTo, setRangeTo] = useState(initialRange.to);
  const loadGenerationRef = useRef(0);
  const loadRef = useRef(() => {});

  const rangeParams = useMemo(
    () => salesDashboardRangeParams(rangeFrom, rangeTo),
    [rangeFrom, rangeTo]
  );
  const appliedFrom = rangeParams?.from_date ?? "";
  const appliedTo = rangeParams?.to_date ?? "";

  const load = useCallback(
    async (isRefresh = false) => {
      const params = salesDashboardRangeParams(rangeFrom, rangeTo);
      if (!params) return;

      const generation = ++loadGenerationRef.current;
      if (!isRefresh) setLoading(true);
      setLoadError("");
      setLoadErrorObj(null);
      markRequestStart();
      try {
        const [hubRes, quoteRes, leadsRes, ordersRes] = await Promise.allSettled([
          getSalesHub(params),
          getQuotationSummary(params),
          getLeadsEnriched(params),
          getSalesOrdersEnriched(params),
        ]);
        if (generation !== loadGenerationRef.current) return;

        if (hubRes.status === "fulfilled") {
          const data = pickData(hubRes.value);
          if (data) setHub({ ...emptyHub, ...data });
        } else throw hubRes.reason;
        setQuoteSummary(quoteRes.status === "fulfilled" ? pickData(quoteRes.value) : null);
        setLeads(leadsRes.status === "fulfilled" && Array.isArray(pickData(leadsRes.value)) ? pickData(leadsRes.value) : []);
        setOrders(
          ordersRes.status === "fulfilled" && Array.isArray(pickData(ordersRes.value))
            ? pickData(ordersRes.value)
            : []
        );
      } catch (err) {
        if (generation !== loadGenerationRef.current) return;
        if (isRefresh) throw err;
        const classified = classifyApiError(err, "We couldn't load the sales dashboard.");
        setLoadError(classified.message);
        setLoadErrorObj(err);
      } finally {
        if (generation === loadGenerationRef.current) {
          markRequestEnd();
          setLoading(false);
        }
      }
    },
    [markRequestStart, markRequestEnd, rangeFrom, rangeTo]
  );

  loadRef.current = load;

  useEffect(() => {
    if (!appliedFrom || !appliedTo) return;
    loadRef.current();
  }, [appliedFrom, appliedTo]);

  useManufacturingRefresh(() => load(true));
  useEffect(() => registerRetry(() => load(true)), [registerRetry, load]);

  const periodMeta = useMemo(
    () => periodOptionLabel(periodId, periodOptions, customRange),
    [periodId, periodOptions, customRange]
  );

  const dashboardExportRows = useMemo(
    () =>
      metricExportRows([
        { label: "Reporting period", value: periodMeta },
        { label: "Revenue", value: formatInr(hub.monthly_revenue) },
        { label: "Total orders", value: hub.total_orders },
        { label: "Pending orders", value: hub.pending_orders },
        { label: "Dispatch pending", value: hub.dispatch_pending },
        { label: "Outstanding payments", value: formatInr(hub.outstanding_payments) },
        { label: "Open leads", value: hub.open_leads },
        { label: "Open quotations", value: hub.open_quotations },
        { label: "Conversion rate", value: `${hub.conversion_rate ?? 0}%` },
      ]),
    [hub, periodMeta]
  );

  const onReportingPeriodApplied = useCallback(({ from, to }) => {
    setRangeFrom(from);
    setRangeTo(to);
  }, []);

  const pipelineCounts = useMemo(
    () => ({
      leads: hub.open_leads,
      quotations: quoteSummary?.total_quotations ?? hub.open_quotations,
      sales_orders: hub.total_orders,
      production: hub.pipeline_production ?? 0,
      dispatch: hub.dispatch_pending,
      completed: hub.pipeline_completed ?? 0,
    }),
    [hub, quoteSummary]
  );

  const revenueSeries = useMemo(
    () => buildDailyRevenueSeries(orders, rangeFrom, rangeTo),
    [orders, rangeFrom, rangeTo]
  );

  const summaryDonut = useMemo(() => {
    const quotations = Number(hub.open_quotations_value || 0);
    const salesOrders = Number(hub.monthly_revenue || 0);
    const jobCards = orders
      .filter((o) => /job|jc/i.test(String(o.order_number || "")))
      .reduce((s, o) => s + Number(o.total_amount || o.amount || 0), 0);
    const other = Math.max(0, salesOrders - quotations - jobCards);
    const rows = [
      { name: "Quotations", value: quotations },
      { name: "Sales Orders", value: salesOrders },
      { name: "Job Cards", value: jobCards },
      { name: "Other", value: other },
    ].filter((r) => r.value > 0);
    const total = rows.reduce((s, r) => s + r.value, 0);
    return { rows: rows.length ? rows : [{ name: "Quotations", value: 0 }], total };
  }, [hub, orders]);

  const followups = useMemo(() => {
    return (leads || [])
      .filter((l) => l.next_followup)
      .sort((a, b) => String(a.next_followup).localeCompare(String(b.next_followup)))
      .slice(0, 6);
  }, [leads]);

  const recentOrders = useMemo(() => {
    return [...(orders || [])]
      .sort((a, b) => String(b.order_date || "").localeCompare(String(a.order_date || "")))
      .slice(0, 5);
  }, [orders]);

  const topCustomers = useMemo(
    () =>
      (hub.top_customers || []).map((c) => ({
        name: c.name,
        orders: c.orders,
        revenue: c.revenue ?? c.total ?? 0,
      })),
    [hub.top_customers]
  );

  const executives = hub.sales_executive_performance || [];

  const alerts = hub.alerts || [];
  const filteredAlerts = useMemo(() => {
    if (alertTab === "all") return alerts;
    if (alertTab === "followups") return alerts.filter((a) => /follow/i.test(a.message || ""));
    if (alertTab === "overdue") return alerts.filter((a) => /overdue/i.test(a.message || ""));
    return alerts.filter((a) => !/follow|overdue/i.test(a.message || ""));
  }, [alerts, alertTab]);

  const kpiRange = useMemo(
    () => (rangeParams ? { dateFrom: rangeParams.from_date, dateTo: rangeParams.to_date } : {}),
    [rangeParams]
  );

  const kpiLinks = useMemo(
    () => ({
      monthlyRevenue: resolveSalesDashboardKpiLink(user, "monthlyRevenue", kpiRange),
      totalOrders: resolveSalesDashboardKpiLink(user, "totalOrders"),
      pendingOrders: resolveSalesDashboardKpiLink(user, "pendingOrders"),
      dispatchPending: resolveSalesDashboardKpiLink(user, "dispatchPending"),
      openLeads: resolveSalesDashboardKpiLink(user, "openLeads"),
      openQuotations: resolveSalesDashboardKpiLink(user, "openQuotations"),
      conversionRate: resolveSalesDashboardKpiLink(user, "conversionRate"),
      outstandingPayments: resolveSalesDashboardKpiLink(user, "outstandingPayments"),
    }),
    [user, kpiRange]
  );

  const quoteTiles = [
    { label: "Draft", value: quoteSummary?.draft ?? 0, bg: "#f1f5f9", color: "#475569" },
    {
      label: "Pending",
      value: Math.max(0, (quoteSummary?.total_quotations ?? 0) - (quoteSummary?.accepted ?? 0) - (quoteSummary?.rejected ?? 0) - (quoteSummary?.expired ?? 0) - (quoteSummary?.draft ?? 0) - (quoteSummary?.sent ?? 0)),
      bg: "#fff7ed",
      color: "#c2410c",
    },
    { label: "Sent", value: quoteSummary?.sent ?? 0, bg: "#e0f2fe", color: "#0369a1" },
    { label: "Accepted", value: quoteSummary?.accepted ?? 0, bg: "#ecfdf5", color: "#047857" },
    { label: "Rejected", value: quoteSummary?.rejected ?? 0, bg: "#fef2f2", color: "#b91c1c" },
    { label: "Expired", value: quoteSummary?.expired ?? 0, bg: "#f5f3ff", color: "#6d28d9" },
  ];

  return (
    <ListPageShell stackClassName="sales-dash space-y-4 sm:space-y-5 pb-8">
      <div className="sales-dash__toolbar">
        <div className="sales-dash__toolbar-actions">
          <Button variant="add" type="button" leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => setShowLeadModal(true)}>
            New Lead
          </Button>
          <Button variant="add" to="/sales/quotations/create" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} />}>
            New Quote
          </Button>
          {canCreateJobCard ? (
            <Button variant="add" to={jobCardCreateUrl()} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} />}>
              New Job Card
            </Button>
          ) : null}
        </div>
        <div className="sales-dash__toolbar-dates flex flex-col items-stretch gap-2 sm:items-end">
          <RecentTransactionsPeriodSelect
            id="sales-dashboard-recent-transactions"
            className="sales-dash__toolbar-period-select"
            periodId={periodId}
            customRange={customRange}
            onPeriodIdChange={setPeriodId}
            onCustomRangeChange={setCustomRange}
            onRangeApplied={onReportingPeriodApplied}
          />
          <DashboardReportExport
            title={`Sales Dashboard — ${periodMeta}`}
            filename="sales-dashboard"
            rows={dashboardExportRows}
            disabled={loading}
            module="sales"
          />
        </div>
      </div>

      <SalesDashboardMyWork />

      <CreateLeadModal isOpen={showLeadModal} onClose={() => setShowLeadModal(false)} onSuccess={() => load(true)} />

      <AsyncPageBody
        loading={loading}
        error={loadError}
        errorObj={loadErrorObj}
        online={online}
        onRetry={() => load()}
        loadingVariant="page"
        loadingLabel="Loading sales dashboard..."
        errorTitle="Could not load sales dashboard"
      >
        <div className="space-y-4 sm:space-y-5">
          <div className="sales-dash__kpi-grid">
            <KpiCard
              label="Revenue"
              value={formatInr(hub.monthly_revenue)}
              icon={IndianRupee}
              tone="teal"
              meta={periodMeta}
              to={kpiLinks.monthlyRevenue}
              navAriaLabel={salesDashboardKpiNavLabel("monthlyRevenue")}
            />
            <KpiCard
              label="Total Orders"
              value={hub.total_orders}
              icon={ShoppingCart}
              tone="info"
              meta={`${periodMeta} (excl. cancelled)`}
              to={kpiLinks.totalOrders}
              navAriaLabel={salesDashboardKpiNavLabel("totalOrders")}
            />
            <KpiCard
              label="Pending Orders"
              value={hub.pending_orders}
              icon={ClipboardList}
              tone="warning"
              meta={periodMeta}
              to={kpiLinks.pendingOrders}
              navAriaLabel={salesDashboardKpiNavLabel("pendingOrders")}
            />
            <KpiCard
              label="Dispatch Pending"
              value={hub.dispatch_pending}
              icon={Truck}
              tone="violet"
              meta={periodMeta}
              to={kpiLinks.dispatchPending}
              navAriaLabel={salesDashboardKpiNavLabel("dispatchPending")}
            />
            <KpiCard
              label="Open Leads"
              value={hub.open_leads}
              icon={Target}
              tone="success"
              meta={`${periodMeta} · open leads created`}
              to={kpiLinks.openLeads}
              navAriaLabel={salesDashboardKpiNavLabel("openLeads")}
            />
            <KpiCard
              label="Open Quotations"
              value={hub.open_quotations}
              icon={FileText}
              tone="info"
              meta={`${periodMeta} · ${formatInr(hub.open_quotations_value)} open value`}
              to={kpiLinks.openQuotations}
              navAriaLabel={salesDashboardKpiNavLabel("openQuotations")}
            />
            <KpiCard
              label="Conversion Rate"
              value={`${Number(hub.conversion_rate || 0).toFixed(1)}%`}
              icon={Percent}
              tone="teal"
              meta={`Quotations in ${periodMeta}`}
              to={kpiLinks.conversionRate}
              navAriaLabel={salesDashboardKpiNavLabel("conversionRate")}
            />
            <KpiCard
              label="Outstanding Payments"
              value={formatInr(hub.outstanding_payments)}
              icon={IndianRupee}
              tone="danger"
              meta="Current receivables (as of today)"
              to={kpiLinks.outstandingPayments}
              navAriaLabel={salesDashboardKpiNavLabel("outstandingPayments")}
            />
          </div>

          <div className="sales-dash__mid-grid">
            <div className="sales-dash-card">
              <div className="sales-dash-card__head">
                <h3 className="sales-dash-card__title">Sales Pipeline</h3>
                <Link to="/sales/leads" className="text-xs font-semibold text-[var(--color-primary)] hover:underline">
                  View Pipeline →
                </Link>
              </div>
              <div className="sales-dash-card__body overflow-x-auto">
                <div className="sales-dash-pipeline">
                  {PIPELINE_STAGES.map((stage) => (
                    <Link
                      key={stage.key}
                      to={stage.to}
                      className={`sales-dash-pipeline__stage sales-dash-pipeline__stage--${stage.key} hover:opacity-90`}
                    >
                      <div className="sales-dash-pipeline__label">{stage.label}</div>
                      <div className="sales-dash-pipeline__count">{pipelineCounts[stage.key] ?? 0}</div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="sales-dash-card">
              <div className="sales-dash-card__head">
                <h3 className="sales-dash-card__title">Quick Actions</h3>
              </div>
              <div className="sales-dash-card__body">
                <div className="sales-dash-quick">
                  <button type="button" className="sales-dash-quick__btn" onClick={() => setShowLeadModal(true)}>
                    <span className="sales-dash-quick__icon"><UserPlus className="h-4 w-4" /></span>
                    New Lead
                  </button>
                  <Link to="/sales/quotations/create" className="sales-dash-quick__btn">
                    <span className="sales-dash-quick__icon"><FileText className="h-4 w-4" /></span>
                    New Quote
                  </Link>
                  {canCreateJobCard ? (
                    <Link to={jobCardCreateUrl()} className="sales-dash-quick__btn">
                      <span className="sales-dash-quick__icon"><Plus className="h-4 w-4" /></span>
                      New Job Card
                    </Link>
                  ) : (
                    <span className="sales-dash-quick__btn opacity-50 pointer-events-none">
                      <span className="sales-dash-quick__icon"><Plus className="h-4 w-4" /></span>
                      New Job Card
                    </span>
                  )}
                  <Link to="/sales/customers" className="sales-dash-quick__btn">
                    <span className="sales-dash-quick__icon"><Users className="h-4 w-4" /></span>
                    View Customers
                  </Link>
                  <Link to="/sales/leads" className="sales-dash-quick__btn">
                    <span className="sales-dash-quick__icon"><Target className="h-4 w-4" /></span>
                    Follow-ups
                  </Link>
                  <Link to="/sales/reports/quotations" className="sales-dash-quick__btn">
                    <span className="sales-dash-quick__icon"><BarChart3 className="h-4 w-4" /></span>
                    Reports
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="sales-dash__charts-grid">
            <div className="sales-dash-card lg:col-span-1">
              <div className="sales-dash-card__head">
                <div>
                  <h3 className="sales-dash-card__title">Sales Revenue</h3>
                  <p className="text-[11px] text-[var(--color-text-muted)]">Total sales value over time</p>
                </div>
                <span className="text-[11px] font-medium text-[var(--color-text-muted)]">{periodMeta}</span>
              </div>
              <div className="sales-dash-card__body h-[220px]">
                {revenueSeries.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesRevFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)} />
                      <Tooltip formatter={(v) => formatInr(v)} />
                      <Area type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} fill="url(#salesRevFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState compact title="No revenue in range" description="Orders in the selected date range will chart here." />
                )}
              </div>
            </div>

            <div className="sales-dash-card">
              <div className="sales-dash-card__head">
                <div>
                  <h3 className="sales-dash-card__title">Sales Summary</h3>
                  <p className="text-[11px] text-[var(--color-text-muted)]">Total value by document type</p>
                </div>
              </div>
              <div className="sales-dash-card__body flex flex-col items-center justify-center gap-3 sm:flex-row">
                <div className="h-[180px] w-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={summaryDonut.rows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={72} paddingAngle={2}>
                        {summaryDonut.rows.map((_, i) => (
                          <Cell key={i} fill={SUMMARY_COLORS[i % SUMMARY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatInr(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-lg font-bold text-[var(--color-text)]">{formatInr(summaryDonut.total)}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Total Value</p>
                  <ul className="mt-2 space-y-1 text-[11px]">
                    {summaryDonut.rows.map((r, i) => (
                      <li key={r.name} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: SUMMARY_COLORS[i % SUMMARY_COLORS.length] }} />
                        <span>{r.name}</span>
                        <span className="text-[var(--color-text-muted)]">{formatInr(r.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="sales-dash-card">
              <div className="sales-dash-card__head">
                <h3 className="sales-dash-card__title">Sales Alerts &amp; Tasks</h3>
              </div>
              <div className="sales-dash-card__body">
                <div className="sales-dash-tabs" role="tablist">
                  {[
                    { id: "all", label: `All (${alerts.length})` },
                    { id: "followups", label: `Follow-ups (${alerts.filter((a) => /follow/i.test(a.message || "")).length})` },
                    { id: "overdue", label: `Overdue (${alerts.filter((a) => /overdue/i.test(a.message || "")).length})` },
                    { id: "others", label: `Others (${alerts.filter((a) => !/follow|overdue/i.test(a.message || "")).length})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={alertTab === tab.id}
                      onClick={() => setAlertTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {filteredAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-[var(--color-text-muted)]">
                    <Bell className="mb-2 h-8 w-8 opacity-40" aria-hidden />
                    <p className="text-sm font-semibold text-[var(--color-text)]">No alerts</p>
                    <p className="text-xs">You&apos;re all caught up on sales notifications.</p>
                  </div>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {filteredAlerts.map((a, i) => (
                      <li key={i} className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-3 py-2 font-medium">
                        {a.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="sales-dash__bottom-grid">
            <div className="sales-dash-card">
              <div className="sales-dash-card__head">
                <h3 className="sales-dash-card__title">Today&apos;s Follow-ups</h3>
                <Link to="/sales/leads" className="text-xs font-semibold text-[var(--color-primary)]">View All →</Link>
              </div>
              <div className="sales-dash-card__body overflow-x-auto">
                {followups.length === 0 ? (
                  <EmptyState compact title="No follow-ups scheduled" description="Leads with a next follow-up date appear here." />
                ) : (
                  <table className="sales-dash-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Lead / Quote</th>
                        <th>Date &amp; Time</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {followups.map((row) => {
                        const st = followupStatus(row.next_followup);
                        return (
                          <tr key={row.id || row.lead_id}>
                            <td>
                              <span className="sales-dash-avatar">{initials(row.customer_name || row.company)}</span>
                              {row.customer_name || row.company || "—"}
                            </td>
                            <td>{row.lead_id || row.id || "—"}</td>
                            <td>{String(row.next_followup || "").slice(0, 16) || "—"}</td>
                            <td>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.badgeClass}`}>
                                {st.label}
                              </span>
                            </td>
                            <td>
                              <Link to="/sales/leads" className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline">
                                Follow up
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="sales-dash-card">
              <div className="sales-dash-card__head">
                <h3 className="sales-dash-card__title">Quotation Overview</h3>
                <Link to="/sales/quotations" className="text-xs font-semibold text-[var(--color-primary)]">View All →</Link>
              </div>
              <div className="sales-dash-card__body">
                <div className="sales-dash-quote-grid">
                  {quoteTiles.map((t) => (
                    <div key={t.label} className="sales-dash-quote-tile" style={{ background: t.bg, color: t.color }}>
                      <strong>{t.value}</strong>
                      <span>{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sales-dash-card lg:col-span-2">
              <div className="sales-dash-card__head">
                <h3 className="sales-dash-card__title">Recent Sales Orders</h3>
                <Link to="/sales/orders" className="text-xs font-semibold text-[var(--color-primary)]">View All →</Link>
              </div>
              <div className="sales-dash-card__body overflow-x-auto">
                {recentOrders.length === 0 ? (
                  <EmptyState compact title="No sales orders yet" description="Recent orders will list here." />
                ) : (
                  <table className="sales-dash-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((o) => (
                        <tr key={o.id}>
                          <td className="font-semibold">{o.order_number || o.id}</td>
                          <td>{o.customer_name || "—"}</td>
                          <td>{String(o.order_date || "").slice(0, 10)}</td>
                          <td className="tabular-nums">{formatInr(o.total_amount || o.amount)}</td>
                          <td>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusColor(o.status)}`}>
                              {String(o.status || "pending").replace(/_/g, " ")}
                            </span>
                          </td>
                          <td>
                            <Link to={`/sales/orders`} className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline">
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="sales-dash-card">
              <div className="sales-dash-card__head">
                <h3 className="sales-dash-card__title">Top Customers</h3>
                <Link to="/sales/customers" className="text-xs font-semibold text-[var(--color-primary)]">View All →</Link>
              </div>
              <div className="sales-dash-card__body overflow-x-auto">
                {topCustomers.length === 0 ? (
                  <EmptyState compact title="No customer orders yet" />
                ) : (
                  <table className="sales-dash-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Orders</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCustomers.map((c) => (
                        <tr key={c.name}>
                          <td>
                            <span className="sales-dash-avatar">{initials(c.name)}</span>
                            {c.name}
                          </td>
                          <td className="tabular-nums">{c.orders}</td>
                          <td className="tabular-nums font-semibold">{formatInr(c.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="sales-dash-card">
              <div className="sales-dash-card__head">
                <h3 className="sales-dash-card__title">Sales Executive Performance</h3>
                <span className="text-[11px] text-[var(--color-text-muted)]">{periodMeta}</span>
                <Link to="/sales/reports/sales-orders" className="text-xs font-semibold text-[var(--color-primary)]">View All →</Link>
              </div>
              <div className="sales-dash-card__body overflow-x-auto">
                {executives.length === 0 ? (
                  <EmptyState compact title="No sales executive data" description="Assign a sales executive on orders to see metrics." />
                ) : (
                  <table className="sales-dash-table">
                    <thead>
                      <tr>
                        <th>Sales Executive</th>
                        <th>Orders</th>
                        <th>Revenue</th>
                        <th>Conversion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {executives.map((e) => (
                          <tr key={e.name}>
                            <td>{e.name}</td>
                            <td className="tabular-nums">{e.orders}</td>
                            <td className="tabular-nums">{formatInr(e.revenue)}</td>
                            <td className="tabular-nums">—</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </AsyncPageBody>
    </ListPageShell>
  );
}
