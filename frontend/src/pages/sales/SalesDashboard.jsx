import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bell, ChevronDown, Plus, UserPlus, X } from "lucide-react";

import Button from "../../components/common/Button";
import StatusBadge from "../../components/common/StatusBadge";
import { AsyncPageBody, EmptyState } from "../../components/common/states";
import RecentTransactionsPeriodSelect from "../../components/accounts/RecentTransactionsPeriodSelect";
import DashboardReportExport from "../../components/common/DashboardReportExport";
import { metricExportRows } from "../../utils/dashboardExportRows";
import SalesDashboardMyWork from "../../components/sales/SalesDashboardMyWork";
import {
  getInvoicesEnriched,
  getLeadsEnriched,
  getQuotationSummary,
  getSalesHub,
  getSalesOrdersEnriched,
} from "../../api/salesApi";
import { formatInr } from "../../data/salesMasterData";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import { classifyApiError } from "../../utils/apiError";
import useAuth from "../../hooks/useAuth";
import { userCanCreateSalesJobCard } from "../../config/permissions";
import { jobCardCreateUrl } from "../../utils/jobCardRoutes";
import { formatMediumDate, toIsoDate } from "../../utils/dateUtils";
import {
  resolveSalesDashboardKpiLink,
  salesDashboardKpiNavLabel,
} from "../../utils/salesDashboardKpis";
import { salesDashboardRangeParams } from "../../utils/salesDashboardPeriod";
import {
  SALES_DASHBOARD_CHART_GRID,
  SALES_DASHBOARD_CHART_STROKE,
  SALES_DASHBOARD_CHART_TICK,
  SALES_DASHBOARD_CHART_TOOLTIP,
  SALES_DASHBOARD_TOOLKIT_SUBTITLE,
  SALES_DASHBOARD_TOOLKIT_TAGLINE,
  salesDashboardKpiIcon,
  salesDashboardKpiTone,
} from "../../utils/salesDashboardToolkit";
import "../../styles/manufacturing-toolkit.css";
import "../../styles/sales-dashboard-toolkit.css";
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
  period_from: "",
  period_to: "",
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
  if (!d) return { label: "Pending" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  if (day < today) return { label: "Overdue" };
  if (day.getTime() === today.getTime()) return { label: "Today" };
  return { label: "Pending" };
}

function extractItemDate(item) {
  if (!item) return null;
  const rawDate = item.issue_date || item.order_date || item.date || item.created_at || item.invoice_date;
  return parseIsoDay(rawDate);
}

function extractItemAmount(item) {
  if (!item) return 0;
  const val = item.grand_total ?? item.total_amount ?? item.amount ?? item.total ?? 0;
  const num = Number(val);
  return Number.isNaN(num) ? 0 : num;
}

function isItemCancelled(item) {
  if (!item) return true;
  const st = String(item.status || item.invoice_status || "").toLowerCase();
  return st === "cancelled" || st === "canceled" || st === "draft";
}

function buildDailyRevenueSeries(orders, invoices, rangeFrom, rangeTo) {
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

  const validInvoices = (invoices || []).filter((inv) => !isItemCancelled(inv));
  const validOrders = (orders || []).filter((so) => !isItemCancelled(so));

  const itemsToUse = validInvoices.length > 0 ? validInvoices : validOrders;

  for (const item of itemsToUse) {
    const day = extractItemDate(item);
    if (!day) continue;
    const key = toIsoDate(day);
    if (!map.has(key)) continue;
    const amt = extractItemAmount(item);
    map.set(key, (map.get(key) || 0) + amt);
  }

  let cumulative = 0;
  const series = [...map.entries()].map(([iso, dayAmt]) => {
    cumulative += dayAmt;
    const d = parseIsoDay(iso);
    const label = d
      ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
      : iso;
    return { iso, label, value: cumulative };
  });

  return series;
}

function revenueSeriesHasTransactionalData(series) {
  if (!series?.length) return false;
  return series[series.length - 1].value > 0;
}

function resolveSalesAlertLink(alert, kpiLinks) {
  const type = String(alert?.type || "").toLowerCase();
  if (type === "overdue_payment" || type === "outstanding_payment") return kpiLinks.outstandingPayments;
  if (type === "pending_dispatch") return kpiLinks.dispatchPending;
  if (type === "pending_invoice") return "/sales/invoices";
  return null;
}

const PIPELINE_STAGE_LINK = {
  leads: (links) => links.openLeads || "/sales/leads?open=1",
  quotations: (links) => links.openQuotations || "/sales/quotations?kpi=pending",
  sales_orders: (links) => links.totalOrders || "/sales/orders",
  production: () => "/manufacturing/workflow",
  dispatch: (links) => links.dispatchPending || "/sales/dispatch?status=pending_dispatch",
  completed: (links) => links.totalOrders || "/sales/orders",
};

function SalesToolkitKpi({ kpi }) {
  const inner = (
    <>
      <div className={`mtk-kpi__icon mtk-kpi__icon--${kpi.tone}`}>{kpi.icon}</div>
      <div className="mtk-kpi__label">{kpi.label}</div>
      <div className="mtk-kpi__value">{kpi.value}</div>
      {kpi.unit ? <div className="mtk-kpi__unit">{kpi.unit}</div> : null}
    </>
  );
  const className = `mtk-kpi mtk-kpi--link${kpi.emphasized ? " mtk-kpi--emphasized" : ""}`;
  if (!kpi.to) {
    return (
      <div className={className} title={kpi.title}>
        {inner}
      </div>
    );
  }
  return (
    <Link to={kpi.to} className={className} title={kpi.title} aria-label={kpi.navAriaLabel}>
      {inner}
    </Link>
  );
}

const PIPELINE_STAGES = [
  { key: "leads", label: "Leads", to: "/sales/leads" },
  { key: "quotations", label: "Quotations", to: "/sales/quotations" },
  { key: "sales_orders", label: "Sales Orders", to: "/sales/orders" },
  { key: "production", label: "Production", to: "/manufacturing/workflow" },
  { key: "dispatch", label: "Dispatch", to: "/sales/dispatch" },
  { key: "completed", label: "Completed", to: "/sales/orders" },
];

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
  const [invoices, setInvoices] = useState([]);
  const [alertTab, setAlertTab] = useState("all");
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    if (!showMore) return;
    const handleClickOutside = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setShowMore(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setShowMore(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showMore]);

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

  const loadFollowupLeads = useCallback(async () => {
    try {
      const res = await getLeadsEnriched({ followup_due: true });
      const rows = pickData(res);
      setLeads(Array.isArray(rows) ? rows : []);
    } catch {
      setLeads([]);
    }
  }, []);

  const loadPeriodData = useCallback(
    async (isRefresh = false) => {
      const params = salesDashboardRangeParams(rangeFrom, rangeTo);
      if (!params) return;

      const generation = ++loadGenerationRef.current;
      if (!isRefresh) setLoading(true);
      setLoadError("");
      setLoadErrorObj(null);
      markRequestStart();
      try {
        const [hubRes, quoteRes, ordersRes, invoicesRes] = await Promise.allSettled([
          getSalesHub(params),
          getQuotationSummary(params),
          getSalesOrdersEnriched(params),
          getInvoicesEnriched(params),
        ]);
        if (generation !== loadGenerationRef.current) return;

        if (hubRes.status === "fulfilled") {
          const data = pickData(hubRes.value);
          if (data) setHub({ ...emptyHub, ...data });
        } else throw hubRes.reason;
        setQuoteSummary(quoteRes.status === "fulfilled" ? pickData(quoteRes.value) : null);
        setOrders(
          ordersRes.status === "fulfilled" && Array.isArray(pickData(ordersRes.value))
            ? pickData(ordersRes.value)
            : []
        );
        setInvoices(
          invoicesRes.status === "fulfilled" && Array.isArray(pickData(invoicesRes.value))
            ? pickData(invoicesRes.value)
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

  const refreshDashboard = useCallback(
    (isRefresh = false) => {
      loadPeriodData(isRefresh);
      loadFollowupLeads();
    },
    [loadPeriodData, loadFollowupLeads]
  );

  loadRef.current = loadPeriodData;

  useEffect(() => {
    loadFollowupLeads();
  }, [loadFollowupLeads]);

  useEffect(() => {
    if (!appliedFrom || !appliedTo) return;
    loadRef.current();
  }, [appliedFrom, appliedTo]);

  useManufacturingRefresh(() => refreshDashboard(true));
  useEffect(() => registerRetry(() => refreshDashboard(true)), [registerRetry, refreshDashboard]);

  const periodMeta = useMemo(
    () => periodOptionLabel(periodId, periodOptions, customRange),
    [periodId, periodOptions, customRange]
  );

  const dashboardExportRows = useMemo(
    () =>
      metricExportRows([
        { label: "Revenue", value: formatInr(hub.monthly_revenue) },
        { label: "Total orders", value: hub.total_orders },
        { label: "Pending orders", value: hub.pending_orders },
        { label: "Dispatch pending", value: hub.dispatch_pending },
        { label: "Outstanding payments", value: formatInr(hub.outstanding_payments) },
        { label: "Open leads", value: hub.open_leads },
        { label: "Open quotations", value: hub.open_quotations },
        { label: "Conversion rate", value: `${hub.conversion_rate ?? 0}%` },
      ]),
    [hub]
  );

  const onReportingPeriodApplied = useCallback(({ from, to }) => {
    setRangeFrom(from);
    setRangeTo(to);
  }, []);

  const pipelineCounts = useMemo(
    () => ({
      leads: hub.open_leads,
      quotations: hub.open_quotations,
      sales_orders: hub.total_orders,
      production: hub.pipeline_production ?? 0,
      dispatch: hub.dispatch_pending,
      completed: hub.pipeline_completed ?? 0,
    }),
    [hub]
  );

  const revenueSeries = useMemo(
    () => buildDailyRevenueSeries(orders, invoices, rangeFrom, rangeTo),
    [orders, invoices, rangeFrom, rangeTo]
  );

  const periodSummaryRows = useMemo(
    () => [
      {
        key: "revenue",
        label: "Period revenue",
        value: formatInr(hub.monthly_revenue),
        hint: "Recognized from orders and invoices in the selected range",
      },
      {
        key: "open_quotes",
        label: "Open quotation value",
        value: formatInr(hub.open_quotations_value),
        hint: "Draft and sent quotations in range",
      },
      {
        key: "quotes_count",
        label: "Quotations in period",
        value: quoteSummary?.total_quotations ?? 0,
        hint: "All quotation records dated in range",
      },
      {
        key: "converted",
        label: "Converted to sales orders",
        value: quoteSummary?.converted_to_sales_orders ?? 0,
        hint: "Quotations linked to a sales order",
      },
    ],
    [hub.monthly_revenue, hub.open_quotations_value, quoteSummary]
  );

  const followups = useMemo(
    () =>
      [...(leads || [])]
        .filter((l) => l.next_followup)
        .sort((a, b) => String(a.next_followup).localeCompare(String(b.next_followup)))
        .slice(0, 6),
    [leads]
  );

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
      openLeads: resolveSalesDashboardKpiLink(user, "openLeads", kpiRange),
      openQuotations: resolveSalesDashboardKpiLink(user, "openQuotations", kpiRange),
      conversionRate: resolveSalesDashboardKpiLink(user, "conversionRate"),
      outstandingPayments: resolveSalesDashboardKpiLink(user, "outstandingPayments"),
    }),
    [user, kpiRange]
  );

  const toolkitKpis = useMemo(
    () =>
      [
        {
          key: "monthlyRevenue",
          label: "Revenue",
          value: formatInr(hub.monthly_revenue),
          unit: periodMeta,
          title: "Total sales revenue in the selected reporting period",
          to: kpiLinks.monthlyRevenue,
        },
        {
          key: "totalOrders",
          label: "Total Orders",
          value: hub.total_orders,
          unit: `${periodMeta} (excl. cancelled)`,
          to: kpiLinks.totalOrders,
        },
        {
          key: "pendingOrders",
          label: "Pending Orders",
          value: hub.pending_orders,
          unit: periodMeta,
          emphasized: true,
          to: kpiLinks.pendingOrders,
        },
        {
          key: "dispatchPending",
          label: "Dispatch Pending",
          value: hub.dispatch_pending,
          unit: periodMeta,
          to: kpiLinks.dispatchPending,
        },
        {
          key: "openLeads",
          label: "Open Leads",
          value: hub.open_leads,
          unit: `${periodMeta} · open leads created`,
          to: kpiLinks.openLeads,
        },
        {
          key: "openQuotations",
          label: "Open Quotations",
          value: hub.open_quotations,
          unit: `${periodMeta} · ${formatInr(hub.open_quotations_value)} open value`,
          to: kpiLinks.openQuotations,
        },
        {
          key: "conversionRate",
          label: "Conversion Rate",
          value: `${Number(hub.conversion_rate || 0).toFixed(1)}%`,
          unit: `Quotations in ${periodMeta}`,
          title: "Accepted or converted quotations divided by all quotations dated in the period",
          to: kpiLinks.conversionRate,
        },
        {
          key: "outstandingPayments",
          label: "Outstanding Payments",
          value: formatInr(hub.outstanding_payments),
          unit: "Current receivables (as of today)",
          to: kpiLinks.outstandingPayments,
        },
      ].map((kpi, index) => ({
        ...kpi,
        tone: salesDashboardKpiTone(index),
        icon: salesDashboardKpiIcon(kpi.key),
        navAriaLabel: salesDashboardKpiNavLabel(kpi.key),
        title: kpi.title || `${kpi.label}. ${kpi.unit || ""}`.trim(),
      })),
    [hub, periodMeta, kpiLinks]
  );

  const quoteTiles = [
    { label: "Draft", value: quoteSummary?.draft ?? 0, tone: "neutral" },
    {
      label: "Open",
      value: quoteSummary?.open_quotations ?? hub.open_quotations ?? 0,
      tone: "amber",
    },
    { label: "Sent", value: quoteSummary?.sent ?? 0, tone: "blue" },
    { label: "Accepted", value: quoteSummary?.accepted ?? 0, tone: "green" },
    { label: "Rejected", value: quoteSummary?.rejected ?? 0, tone: "red" },
    { label: "Expired", value: quoteSummary?.expired ?? 0, tone: "purple" },
  ];

  const reportingPeriodControl = (
    <RecentTransactionsPeriodSelect
      id="sales-dashboard-recent-transactions"
      className="sales-dash__period-select min-w-0 w-full sm:w-auto"
      periodId={periodId}
      customRange={customRange}
      onPeriodIdChange={setPeriodId}
      onCustomRangeChange={setCustomRange}
      onRangeApplied={onReportingPeriodApplied}
      hideLabel
      label="Reporting period"
    />
  );

  const reportingLabel = hub.period_label || periodMeta;
  const revenueChartReady = revenueSeriesHasTransactionalData(revenueSeries);
  const headerActions = (
    <>
      <Button variant="add" to="/sales/leads/new" leftIcon={<UserPlus className="h-4 w-4" aria-hidden />}>
        New Lead
      </Button>
      <Button variant="add" to="/sales/quotations/create" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
        New Quote
      </Button>
      {canCreateJobCard ? (
        <Button variant="add" to={jobCardCreateUrl()} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
          New Job Card
        </Button>
      ) : null}
      <div ref={moreRef} className="relative inline-block">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowMore((v) => !v)}
              rightIcon={<ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showMore ? "rotate-180" : ""}`} />}
              aria-expanded={showMore}
              aria-label="More options"
              data-testid="sales-dash-more-btn"
            >
              More
            </Button>

            {showMore ? (
              <div className="sales-dash-more-menu" onMouseDown={(e) => e.stopPropagation()}>
                <div className="sales-dash-more-menu__head">
                  <span>More</span>
                  <button type="button" onClick={() => setShowMore(false)} aria-label="Close menu">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div>
                  <div>
                    <span className="mb-1.5 block text-[10px] font-semibold text-slate-500">
                      Export &amp; Share
                    </span>
                    <DashboardReportExport
                      title={`Sales Dashboard — ${periodMeta}`}
                      filename="sales-dashboard"
                      rows={dashboardExportRows}
                      disabled={loading || !dashboardExportRows.length}
                      module="sales"
                      defaultRecipient={user?.email || ""}
                    />
                  </div>
                </div>
              </div>
            ) : null}
      </div>
    </>
  );

  const toolkitHero = (
    <header className="mtk-hero">
      <div className="mtk-hero__row">
        <span>{SALES_DASHBOARD_TOOLKIT_TAGLINE}</span>
        <span className="hidden sm:inline">{reportingLabel}</span>
      </div>
      <div className="mtk-hero__title">
        <h1>Sales Dashboard</h1>
        <p style={{ fontSize: 10, opacity: 0.9, margin: 0 }}>
          Revenue, pipeline, and quotations for {reportingLabel}. Due follow-ups and outstanding receivables use live
          tenant snapshots.
        </p>
        <p style={{ fontSize: 9, opacity: 0.85, margin: "4px 0 0" }}>{SALES_DASHBOARD_TOOLKIT_SUBTITLE}</p>
      </div>
    </header>
  );

  return (
    <div className="sales-dash sales-dash-page--toolkit min-h-full min-w-0 w-full">
      <div className="mtk-root mtk-theme--teal">
        {toolkitHero}
        {!loading && !loadError ? (
          <div className="mtk-kpi-row" aria-label="Sales dashboard KPIs">
            {toolkitKpis.map((kpi) => (
              <SalesToolkitKpi key={kpi.key} kpi={kpi} />
            ))}
          </div>
        ) : null}

        <div className="mtk-body min-w-0">
      <div className="sales-dash-toolbar">{headerActions}</div>

      <fieldset
        className="sales-dash__period-bar"
        data-testid="sales-dash-period-bar"
        disabled={loading}
        aria-busy={loading || undefined}
      >
        <span id="sales-dash-period-label" className="sales-dash__period-label">
          Reporting period
        </span>
        <div className="sales-dash__period-control" aria-labelledby="sales-dash-period-label">
          {reportingPeriodControl}
        </div>
        <span className="sales-dash__period-active" title="Active reporting range">
          {periodMeta}
        </span>
      </fieldset>

      <SalesDashboardMyWork />

      <AsyncPageBody
        className="sales-dash-async"
        loading={loading}
        error={loadError}
        errorObj={loadErrorObj}
        online={online}
        onRetry={() => refreshDashboard()}
        loadingVariant="page"
        loadingLabel="Loading sales dashboard..."
        errorTitle="Could not load sales dashboard"
      >
        <div className="sales-dash-sections">
          <p className="sales-dash__period-context" data-testid="sales-dash-period-context">
            Hub KPIs, pipeline, charts, and summary use{" "}
            <span className="font-semibold">{reportingLabel}</span>
            {hub.period_from && hub.period_to ? (
              <span>
                {" "}
                ({hub.period_from} – {hub.period_to})
              </span>
            ) : null}
            . Outstanding payments and alerts may include all-time receivables.
          </p>

          <div className="sales-dash-card">
            <div className="sales-dash-card__head">
              <div className="min-w-0">
                <h3 className="sales-dash-card__title">Sales Pipeline</h3>
                <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                  Stage counts for {reportingLabel}. Open leads and quotations; order stages from sales hub.
                </p>
              </div>
              <Link
                to={kpiLinks.openLeads || "/sales/leads?open=1"}
                className="shrink-0 text-xs font-semibold text-[var(--color-primary)] hover:underline"
              >
                View leads →
              </Link>
            </div>
            <div className="sales-dash-card__body overflow-x-auto">
              <div className="sales-dash-pipeline" role="list" aria-label="Sales pipeline stages">
                {PIPELINE_STAGES.map((stage) => {
                  const count = pipelineCounts[stage.key] ?? 0;
                  const stageTo = (PIPELINE_STAGE_LINK[stage.key] || (() => stage.to))(kpiLinks);
                  return (
                    <Link
                      key={stage.key}
                      to={stageTo}
                      role="listitem"
                      className={`sales-dash-pipeline__stage sales-dash-pipeline__stage--${stage.key} hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]`}
                      aria-label={`${stage.label}: ${count}. Open ${stage.label}`}
                    >
                      <div className="sales-dash-pipeline__label">{stage.label}</div>
                      <div className="sales-dash-pipeline__count">{count}</div>
                    </Link>
                  );
                })}
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
              <div className="sales-dash-card__body sales-dash-revenue-chart">
                {revenueChartReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesRevFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={SALES_DASHBOARD_CHART_STROKE} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={SALES_DASHBOARD_CHART_STROKE} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...SALES_DASHBOARD_CHART_GRID} />
                      <XAxis dataKey="label" tick={SALES_DASHBOARD_CHART_TICK} interval="preserveStartEnd" />
                      <YAxis tick={SALES_DASHBOARD_CHART_TICK} tickFormatter={(v) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)} />
                      <Tooltip {...SALES_DASHBOARD_CHART_TOOLTIP} formatter={(v) => formatInr(v)} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        name="Revenue"
                        stroke={SALES_DASHBOARD_CHART_STROKE}
                        strokeWidth={2}
                        fill="url(#salesRevFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    compact
                    title="No daily revenue trend"
                    description={
                      Number(hub.monthly_revenue) > 0
                        ? `Period total is ${formatInr(hub.monthly_revenue)}. The chart appears when dated orders or invoices exist in range.`
                        : "Dated sales orders or invoices in the selected period will chart here."
                    }
                  />
                )}
              </div>
            </div>

            <div className="sales-dash-card">
              <div className="sales-dash-card__head">
                <div>
                  <h3 className="sales-dash-card__title">Sales Summary</h3>
                  <p className="text-[11px] text-[var(--color-text-muted)]">Period snapshot from sales hub and quotations</p>
                </div>
                <span className="text-[11px] font-medium text-[var(--color-text-muted)]">{reportingLabel}</span>
              </div>
              <div className="sales-dash-card__body min-h-[180px]">
                <ul className="sales-dash-summary-list">
                  {periodSummaryRows.map((row) => (
                    <li key={row.key} className="sales-dash-summary-list__row">
                      <div className="min-w-0">
                        <p className="sales-dash-summary-list__label">{row.label}</p>
                        <p className="sales-dash-summary-list__hint">{row.hint}</p>
                      </div>
                      <p className="sales-dash-summary-list__value tabular-nums">{row.value}</p>
                    </li>
                  ))}
                </ul>
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
                  <div className="flex flex-col items-center justify-center py-5 text-center text-[var(--color-text-muted)]">
                    <Bell className="mb-2 h-7 w-7 opacity-40" aria-hidden />
                    <p className="text-sm font-semibold text-[var(--color-text)]">No alerts</p>
                    <p className="text-xs max-w-[16rem]">
                      {loadError
                        ? "Alerts could not be loaded with the dashboard. Retry above if the request failed."
                        : "No overdue payments, dispatch holds, or invoice warnings for this tenant."}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {filteredAlerts.map((a, i) => {
                      const href = resolveSalesAlertLink(a, kpiLinks);
                      const severity = String(a.severity || "info").toLowerCase();
                      const tone =
                        severity === "danger" ? "danger" : severity === "warning" ? "warning" : "info";
                      const inner = (
                        <>
                          <StatusBadge tone={tone} className="mb-1 capitalize">
                            {a.type ? String(a.type).replace(/_/g, " ") : "Alert"}
                          </StatusBadge>
                          <span className="block font-medium text-[var(--color-text)]">{a.message}</span>
                        </>
                      );
                      if (href) {
                        return (
                          <li key={`${a.type}-${i}`}>
                            <Link
                              to={href}
                              className="block rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-3 py-2 transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-surface)]"
                            >
                              {inner}
                            </Link>
                          </li>
                        );
                      }
                      return (
                        <li
                          key={`${a.type}-${i}`}
                          className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-3 py-2"
                        >
                          {inner}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="sales-dash__bottom-grid">
            <div className="sales-dash-card">
              <div className="sales-dash-card__head">
                <div>
                  <h3 className="sales-dash-card__title">Due follow-ups</h3>
                  <p className="text-[11px] text-[var(--color-text-muted)]">Today and overdue next steps</p>
                </div>
                <Link to="/sales/leads" className="text-xs font-semibold text-[var(--color-primary)] shrink-0">
                  View all →
                </Link>
              </div>
              <div className="sales-dash-card__body overflow-x-auto">
                {followups.length === 0 ? (
                  <EmptyState
                    compact
                    title="No follow-ups due"
                    description="Leads with a next follow-up today or earlier appear here."
                    actionLabel="New lead"
                    actionHref="/sales/leads/new"
                  />
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
                            <td>{formatMediumDate(row.next_followup) || "—"}</td>
                            <td>
                              <StatusBadge
                                tone={st.label === "Overdue" ? "danger" : st.label === "Today" ? "warning" : "pending"}
                              >
                                {st.label}
                              </StatusBadge>
                            </td>
                            <td>
                              <Link
                                to={row.id ? `/sales/leads?lead=${row.id}` : "/sales/leads"}
                                className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
                              >
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
                <Link
                  to={kpiLinks.openQuotations || "/sales/quotations?kpi=pending"}
                  className="text-xs font-semibold text-[var(--color-primary)]"
                >
                  View All →
                </Link>
              </div>
              <div className="sales-dash-card__body">
                <div className="sales-dash-quote-grid">
                  {quoteTiles.map((t) => (
                    <div key={t.label} className={`sales-dash-quote-tile sales-dash-quote-tile--${t.tone}`}>
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
                        <th>Order No.</th>
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
                            <StatusBadge status={o.status} className="capitalize">
                              {String(o.status || "pending").replace(/_/g, " ")}
                            </StatusBadge>
                          </td>
                          <td>
                            <Link
                              to={o.id ? `/sales/orders/${o.id}` : "/sales/orders"}
                              className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline"
                            >
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
                        <th>Sales executive</th>
                        <th>Orders</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {executives.map((e) => (
                          <tr key={e.name}>
                            <td>{e.name}</td>
                            <td className="tabular-nums">{e.orders}</td>
                            <td className="tabular-nums font-semibold">{formatInr(e.revenue)}</td>
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
        </div>
      </div>
    </div>
  );
}
