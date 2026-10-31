import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Banknote,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  CircleAlert,
  CircleHelp,
  Clock,
  FileText,
  Info,
  Landmark,
  LineChart as LineChartIcon,
  MoreHorizontal,
  MoreVertical,
  Package,
  RefreshCw,
  UserPlus,
  X,
} from "lucide-react";

import { getAccountsDashboard } from "../../api/accountsApi";
import { getFeatureSetting, putFeatureSetting } from "../../api/bizDocumentsApi";
import { saveLedgerCashAccount } from "../../api/ledgerAccountsSync";
import { approveExpenseClaims } from "../../api/hrApi";
import Button from "../../components/common/Button";
import ConfirmationDialog from "../../components/common/ConfirmationDialog";
import EmptyState from "../../components/common/EmptyState";
import Pagination from "../../components/common/Pagination";
import SendMetricReportEmailModal from "../../components/common/SendMetricReportEmailModal";
import StatusBadge from "../../components/common/StatusBadge";
import ErrorState from "../../components/common/states/ErrorState";
import LoadingState from "../../components/common/states/LoadingState";
import NetworkErrorState from "../../components/common/states/NetworkErrorState";
import OfflineState from "../../components/common/states/OfflineState";
import PermissionDeniedState from "../../components/common/states/PermissionDeniedState";
import { useToast } from "../../context/ToastContext";
import { DateRangePicker } from "../../design-system/dateControls";
import { isAdmin, userCanAccess } from "../../config/permissions";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import { formatInr } from "../../data/financeMasterData";
import { apiErrorMessage } from "../../utils/apiError";
import { runReportExport } from "../../utils/reportExport";
import { buildAccountsDateRangePresets, formatMediumDate, fyRange, todayIso } from "../../utils/dateUtils";
import { OPENING_BALANCE_SETTING_KEY, indianFyStartIso, unwrapFeatureSettingValue } from "../settings/openingBalancesSettings";
import {
  ACCOUNTS_DASHBOARD_SECTIONS,
  defaultSectionState,
  loadSectionState,
  saveSectionState,
} from "./accountsDashboardSections";
import { ACCOUNTS_ROUTES, invoiceDetailLink, invoicesLink, payablesLink, receivablesLink } from "../../utils/accountsDashboardLinks";
import "../../styles/manufacturing-toolkit.css";
import "./accountsFinancialDashboard.css";
import "./accountsToolkit.css";

const TX_PAGE_SIZE = 8;

const BREAKDOWN_TABS = [
  { id: "customers", label: "Top customers", icon: UserPlus },
  { id: "products", label: "Top products", icon: Package },
  { id: "overdue", label: "Overdue", icon: Clock },
  { id: "invoice_status", label: "Invoice status", icon: FileText },
  { id: "collections", label: "Collections", icon: Banknote },
];

const BREAKDOWN_EMPTY = {
  customers: "No sales to any customer in this period.",
  products: "No product sales in this period.",
  overdue: "No overdue receivables by customer.",
  invoice_status: "No invoices in this period.",
  collections: "No collections recorded in this period.",
};

const SERIES = [
  { key: "collections", label: "Receipts", color: "#036F71" },
  { key: "expenses", label: "Expenses", color: "#b45309" },
  { key: "sales", label: "Invoiced sales", color: "#64748b" },
  { key: "purchases", label: "Vendor bills", color: "#94a3b8" },
];

const CHART_TOOLTIP = {
  contentStyle: {
    fontFamily: '"IBM Plex Sans", Inter, sans-serif',
    fontSize: 13,
    lineHeight: 1.4,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    boxShadow: "0 1px 2px rgba(23, 32, 51, 0.06)",
    color: "#172033",
  },
  labelStyle: { fontWeight: 600, marginBottom: 4, color: "#172033" },
};

const AXIS_TICK = { fontSize: 12, fill: "#475569", fontFamily: '"IBM Plex Sans", Inter, sans-serif' };

const AGING_BUCKETS = [
  { id: "current", label: "Current", color: "#0f766e" },
  { id: "1-30", label: "1–30 days", color: "#2563eb" },
  { id: "31-60", label: "31–60 days", color: "#d97706" },
  { id: "61-90", label: "61–90 days", color: "#ea580c" },
  { id: "90+", label: "90+ days", color: "#b91c1c" },
];

const KIND_LABEL = {
  invoice: "Invoice",
  payment_received: "Receipt",
  payment_made: "Supplier payment",
  journal: "Journal",
};

const KIND_ICON = {
  invoice: FileText,
  payment_received: ArrowDownToLine,
  payment_made: ArrowUpFromLine,
  journal: BookOpen,
};

const BOOK_KINDS = new Set(["invoice", "payment_received", "payment_made", "journal"]);
const INVOICE_COUNT_KEYS = ["draft", "sent", "partial", "paid", "overdue", "cancelled"];
const PENDING_EXPENSE = new Set(["submitted", "pending", "pending_approval"]);
const CLOSED_TX = /cancel|reversal|reversed/i;

const EXPORT_COLUMNS = [
  { key: "metric", label: "Metric" },
  { key: "value", label: "Value" },
  { key: "definition", label: "Calculation" },
];

function inrHeadline(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₹ ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fyToDateRange() {
  const fy = fyRange();
  const to = todayIso();
  return { from: fy.from, to: to <= fy.to ? to : fy.to };
}

function resolveFinBlock(data) {
  if (data?.financial_dashboard?.overview) return data.financial_dashboard;
  const banks = data?.bank_accounts || [];
  const bankBal = banks.reduce((s, a) => s + Number(a.balance || 0), 0);
  return {
    reporting_period: { from: fyToDateRange().from, to: fyToDateRange().to },
    overview: {
      receivables: { total: data?.kpis?.total_receivables ?? 0, current: 0, overdue: data?.kpis?.overdue_receivables ?? 0 },
      payables: { total: data?.kpis?.total_payables ?? 0, current: 0, overdue: data?.kpis?.overdue_payables ?? 0 },
      cash_and_bank: {
        total: banks.length ? bankBal : null,
        bank: banks.length ? bankBal : null,
        cash: banks.length ? 0 : null,
        account_count: banks.length,
        available: banks.length > 0,
      },
      gst: { net: data?.kpis?.gst_liability_period ?? 0, collected: 0, paid: 0 },
    },
    sales_purchases: { totals: {}, series: [] },
    aging: { receivable: { total: 0, buckets: {} }, payable: { total: 0, buckets: {} }, as_of: data?.as_of_date || todayIso() },
    outstanding: { customers: [], suppliers: [] },
    profit: { available: false, reason: "Profit is not shown because a closed profit calculation is not available." },
    definitions: {},
    sales_breakdown: { top_customers: [], top_products: [], overdue: [], invoice_status: [], collections: [] },
    needs_attention: "",
  };
}

function actionIsOpen(item) {
  const count = Number(item?.count);
  const amount = Number(item?.amount);
  return (Number.isFinite(count) && count > 0) || (Number.isFinite(amount) && amount > 0);
}

function companyHasBooks(data) {
  const summary = data?.invoice_summary || {};
  const invoiceCount = INVOICE_COUNT_KEYS.reduce((sum, key) => sum + Number(summary[key] || 0), 0);
  if (invoiceCount > 0) return true;
  return (data?.recent_activity || []).some((row) => BOOK_KINDS.has(row.kind));
}

function failureKind(err) {
  const status = err?.response?.status;
  if (status === 403) return "permission";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  if (!err?.response) return "network";
  return "error";
}

function creatorMatchesUser(createdBy, user) {
  const raw = String(createdBy || "").trim().toLowerCase();
  if (!raw || raw === "—" || raw === "-") return null;
  const names = [user?.full_name, user?.name, user?.email]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());
  return names.includes(raw);
}

function moneyText(row) {
  if (row?.amount == null || row?.amount === "") return "";
  return formatInr(row.amount);
}

export default function AccountsFinancialDashboardView() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(fyToDateRange);
  const [chartType, setChartType] = useState("bar");
  const [hidden, setHidden] = useState({ sales: true, purchases: true });
  const [breakdownTab, setBreakdownTab] = useState("customers");
  const [breakdownTop, setBreakdownTop] = useState(5);
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [sections, setSections] = useState(loadSectionState);
  const [txQuery, setTxQuery] = useState("");
  const [txStatus, setTxStatus] = useState("all");
  const [showJournals, setShowJournals] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [agingSide, setAgingSide] = useState("receivables");
  const [pendingApproval, setPendingApproval] = useState(null);
  const [approving, setApproving] = useState(false);
  const canApproveExpenses = isAdmin(user) || userCanAccess(user, "hr");

  const presets = useMemo(() => [{ id: "FY to date", ...fyToDateRange() }, ...buildAccountsDateRangePresets()], []);
  const fin = useMemo(() => resolveFinBlock(data), [data]);
  const overview = fin.overview || {};
  const totals = fin.sales_purchases?.totals || {};
  const periodLabel = `${formatMediumDate(fin.reporting_period?.from || period.from)} – ${formatMediumDate(fin.reporting_period?.to || period.to)}`;
  const asOf = formatMediumDate(fin.aging?.as_of || data?.as_of_date || todayIso());
  const definitions = fin.definitions || {};

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await getAccountsDashboard({ date_from: period.from, date_to: period.to });
        setData(res?.data ?? res);
      } catch (err) {
        if (!isRefresh) setData(null);
        setError({
          kind: failureKind(err),
          message: apiErrorMessage(err, "Could not load accounts dashboard."),
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period.from, period.to]
  );

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const approvals = useMemo(() => {
    return (data?.pending_expense_claims || []).filter((row) =>
      PENDING_EXPENSE.has(String(row.status || "pending").toLowerCase())
    );
  }, [data]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => {
      if (!event.target.closest(".afd-menu")) setMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const chartData = useMemo(() => {
    return (fin.sales_purchases?.series || []).map((row) => ({
      ...row,
      sales: hidden.sales ? 0 : row.sales,
      purchases: hidden.purchases ? 0 : row.purchases,
      collections: hidden.collections ? 0 : row.collections,
      expenses: hidden.expenses ? 0 : row.expenses,
    }));
  }, [fin, hidden]);

  const visibleSeries = useMemo(() => SERIES.filter((series) => !hidden[series.key]), [hidden]);
  const chartHasValues = useMemo(
    () => chartData.some((row) => visibleSeries.some((series) => Number(row[series.key]) > 0)),
    [chartData, visibleSeries]
  );
  const chartMax = useMemo(() => {
    let max = 0;
    chartData.forEach((row) => {
      visibleSeries.forEach((series) => {
        max = Math.max(max, Number(row[series.key]) || 0);
      });
    });
    return max > 0 ? max * 1.1 : 1;
  }, [chartData, visibleSeries]);

  const alerts = useMemo(() => (data?.pending_work || []).filter(actionIsOpen), [data]);

  const txStatuses = useMemo(() => {
    const set = new Set((data?.recent_activity || []).map((row) => row.status).filter(Boolean));
    return ["all", ...set];
  }, [data]);

  const filteredTx = useMemo(() => {
    const q = txQuery.trim().toLowerCase();
    return (data?.recent_activity || []).filter((row) => {
      if (!showJournals && row.kind === "journal") return false;
      if (CLOSED_TX.test(String(row.status || ""))) return false;
      if (txStatus !== "all" && String(row.status) !== txStatus) return false;
      if (!q) return true;
      const hay = [row.label, row.reference, row.kind, row.status, KIND_LABEL[row.kind]].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [data, txQuery, txStatus, showJournals]);

  const txSlice = filteredTx.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE);

  useEffect(() => {
    setTxPage(1);
  }, [txQuery, txStatus, showJournals, period.from, period.to]);

  const confirmApprove = async () => {
    if (!pendingApproval || approving) return;
    setApproving(true);
    try {
      await approveExpenseClaims({ ids: [pendingApproval.id], status: "approved" });
      addToast("Expense approved successfully", "success");
      setPendingApproval(null);
      await load(true);
    } catch (err) {
      addToast(apiErrorMessage(err, "Could not approve this expense."), "error");
    } finally {
      setApproving(false);
    }
  };

  const exportRows = useMemo(() => {
    const cash = overview.cash_and_bank || {};
    return [
      { metric: "Total receivables", value: formatInr(overview.receivables?.total || 0), definition: definitions.total_receivables || "" },
      { metric: "Total payables", value: formatInr(overview.payables?.total || 0), definition: definitions.total_payables || "" },
      {
        metric: "Cash and bank",
        value: cash.available ? formatInr(cash.total || 0) : "Unavailable",
        definition: definitions.cash_and_bank || "",
      },
      { metric: "Overdue receivables", value: formatInr(overview.receivables?.overdue || 0), definition: definitions.overdue_receivables || "" },
      { metric: "Revenue", value: formatInr(totals.revenue ?? totals.sales ?? 0), definition: definitions.revenue || "" },
      { metric: "Reporting period", value: periodLabel, definition: `Balances as of ${asOf}` },
    ];
  }, [overview, totals, definitions, periodLabel, asOf]);

  const toggleSection = (id) => {
    setSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveSectionState(next);
      return next;
    });
  };

  if (loading && !data) {
    return <LoadingState label="Loading dashboard" description="Fetching live financial data for your company." />;
  }
  if (error && !data) {
    if (error.kind === "permission") return <PermissionDeniedState description={error.message} />;
    if (error.kind === "offline") return <OfflineState description={error.message} onRetry={() => load()} />;
    if (error.kind === "network") return <NetworkErrorState description={error.message} onRetry={() => load()} />;
    return <ErrorState title="Dashboard unavailable" description={error.message} onRetry={() => load()} />;
  }

  const cash = overview.cash_and_bank || {};
  const revenue = totals.revenue ?? totals.sales ?? 0;
  const booksReady = companyHasBooks(data);
  const sectionsOn = ACCOUNTS_DASHBOARD_SECTIONS.filter((s) => sections[s.id]).length;
  const breakdownRows = (() => {
    const sb = fin.sales_breakdown || {};
    if (breakdownTab === "products") return sb.top_products || [];
    if (breakdownTab === "overdue") return sb.overdue || [];
    if (breakdownTab === "invoice_status") return sb.invoice_status || [];
    if (breakdownTab === "collections") return sb.collections || [];
    return sb.top_customers || [];
  })();
  const agingBlock = agingSide === "payables" ? fin.aging?.payable : fin.aging?.receivable;
  const agingTotal = Number(agingBlock?.total || 0);
  const exportTitle = `Accounts Dashboard — ${periodLabel}`;
  const cashFlowHint = [definitions.receipts, fin.profit?.reason].filter(Boolean).join(" ");
  const txEmptyCopy = txQuery.trim() || txStatus !== "all" || showJournals
    ? "No transactions match this filter"
    : "No data for this period";

  return (
    <div className="accounts-financial-dashboard acct-toolkit mtk-root mtk-theme--navy ui-page ui-stack min-h-full">
      <header className="mtk-hero">
        <div className="mtk-hero__row">
          <span>Record · Review · Reconcile</span>
          <span className="hidden sm:inline">Balances as of {asOf}</span>
        </div>
        <div className="mtk-hero__title">
          <h1>Accounting <span className="mtk-accent">Dashboard</span></h1>
          <p>Reporting period {periodLabel}</p>
        </div>
        <div className="afd-toolbar">
          <DateRangePicker from={period.from} to={period.to} presets={presets} popoverAlign="end" onChange={setPeriod} />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="Refresh"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
          </Button>
          <div className="afd-menu">
            <Button type="button" variant="secondary" aria-expanded={menu === "export"} aria-haspopup="menu" onClick={() => setMenu((current) => (current === "export" ? null : "export"))} rightIcon={<ChevronDown className="h-4 w-4" aria-hidden />}>
              Export
            </Button>
            {menu === "export" ? (
              <div className="afd-menu__panel" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenu(null); runReportExport("pdf", { rows: exportRows, columns: EXPORT_COLUMNS, title: exportTitle, filename: "accounts-dashboard" }); }}>PDF</button>
                <button type="button" role="menuitem" onClick={() => { setMenu(null); runReportExport("excel", { rows: exportRows, columns: EXPORT_COLUMNS, title: exportTitle, filename: "accounts-dashboard" }); }}>Excel</button>
                <button type="button" role="menuitem" onClick={() => { setMenu(null); setEmailOpen(true); }}>Email PDF</button>
              </div>
            ) : null}
          </div>
          <Button type="button" variant="primary" to="/sales/invoices/create">New invoice</Button>
          <div className="afd-menu">
            <Button type="button" variant="secondary" size="icon" aria-label="More actions" aria-expanded={menu === "more"} onClick={() => setMenu((current) => (current === "more" ? null : "more"))}>
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </Button>
            {menu === "more" ? (
              <div className="afd-menu__panel" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenu(null); setCustomiseOpen(true); }}>Customise</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {error?.message ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{error.message}</div>
      ) : null}
      {booksReady ? (
        <>
          <BooksSnapshot
            summary={data?.invoice_summary}
            pendingWork={data?.pending_work}
            overview={overview}
            receivableWeeks={fin.aging?.receivable_weeks}
            payableWeeks={fin.aging?.payable_weeks}
            bankAccounts={data?.bank_accounts || []}
            onBankAdded={() => load(true)}
          />

          <section aria-label="Key figures">
            <div className="afd-kpi-grid">
              <MetricCard to={receivablesLink()} icon={ArrowDownToLine} label="Total Receivables" value={inrHeadline(overview.receivables?.total)} meta={`Current ${inrHeadline(overview.receivables?.current)} · Overdue ${inrHeadline(overview.receivables?.overdue)}`} hint={definitions.total_receivables} />
              <MetricCard to={payablesLink()} icon={ArrowUpFromLine} label="Total Payables" value={inrHeadline(overview.payables?.total)} meta={`Current ${inrHeadline(overview.payables?.current)} · Overdue ${inrHeadline(overview.payables?.overdue)}`} hint={definitions.total_payables} />
              <MetricCard to={cash.available ? ACCOUNTS_ROUTES.ledger : undefined} icon={Landmark} label="Cash & Bank Balance" value={cash.available ? inrHeadline(cash.total) : "Unavailable"} meta={cash.available ? `${cash.account_count} ledger account${cash.account_count === 1 ? "" : "s"}` : "No cash or bank ledger account is set up."} hint={definitions.cash_and_bank} />
              <MetricCard to={receivablesLink("overdue")} icon={CircleAlert} label="Overdue Receivables" value={inrHeadline(overview.receivables?.overdue)} meta="Open invoices past their due date." hint={definitions.overdue_receivables} />
              <MetricCard to={ACCOUNTS_ROUTES.invoices} icon={ChartNoAxesCombined} label="Revenue" value={inrHeadline(revenue)} meta={`Invoiced ${inrHeadline(totals.sales)} · Other income ${inrHeadline(totals.other_income)}`} hint={definitions.revenue} />
            </div>
          </section>

          <section className="afd-split" aria-label="Approvals and aging">
            <div className="afd-stack">
              <section className="afd-panel" aria-label="Expense claims to approve">
                <div className="afd-panel__head">
                  <SectionHeading title="Expense claims to approve" lead="Claims waiting on an approver." />
                  <span className="afd-count">{approvals.length}</span>
                </div>
                {approvals.length === 0 ? (
                  <p className="afd-inline-empty">All caught up</p>
                ) : (
                  <ul className="afd-approvals">
                    {approvals.slice(0, 8).map((row) => {
                      const allow = canApproveExpenses && creatorMatchesUser(row.created_by, user) === false;
                      return (
                        <li key={row.id} className="afd-approval">
                          <div className="afd-approval__copy">
                            <span className="afd-approval__type">Expense claim</span>
                            <span className="afd-approval__party">{row.name || row.expense_name || "Expense"}</span>
                          </div>
                          <span className="afd-money ui-num">{row.amount == null ? "" : formatInr(row.amount)}</span>
                          <span className="afd-approval__actions">
                            {allow ? (
                              <Button type="button" size="sm" variant="primary" onClick={() => setPendingApproval(row)}>Approve</Button>
                            ) : null}
                            {canApproveExpenses ? (
                              <Link className="afd-text-link" to="/hr/expenses/approvals">View</Link>
                            ) : (
                              <span className="afd-muted">Awaiting HR approval</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {alerts.length === 0 ? <p className="afd-muted">No alerts right now</p> : null}
              </section>
              {alerts.length > 0 ? (
                <section className="afd-panel" aria-label="Pending actions">
                  <SectionHeading title="Pending actions" lead="Items that need a follow-up in the books." />
                  <ul className="afd-alerts">
                    {alerts.map((item) => (
                      <li key={item.id}>
                        <Link to={item.href || ACCOUNTS_ROUTES.dashboard} className="afd-alert">
                          <span>
                            <span className="afd-alert__label">{item.label}</span>
                            <span className="afd-alert__meta">
                              {item.count != null ? `${item.count} item${item.count === 1 ? "" : "s"}` : "Open"}
                              {item.amount != null ? ` · ${formatInr(item.amount)}` : ""}
                            </span>
                          </span>
                          <span className="afd-text-link">Open</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
            <section className="afd-panel" aria-label="Aging">
              <div className="afd-panel__head">
                <SectionHeading title="Aging" lead={`As of ${asOf}`} />
                <div className="afd-seg" role="group" aria-label="Aging type">
                  <button type="button" aria-pressed={agingSide === "receivables"} onClick={() => setAgingSide("receivables")}>Receivables</button>
                  <button type="button" aria-pressed={agingSide === "payables"} onClick={() => setAgingSide("payables")}>Payables</button>
                </div>
              </div>
              {agingTotal > 0 ? (
                <AgingBuckets buckets={agingBlock?.buckets} />
              ) : (
                <p className="afd-inline-empty">No outstanding {agingSide}.</p>
              )}
              <Link to={agingSide === "payables" ? payablesLink() : receivablesLink()} className="afd-text-link">View all</Link>
            </section>
          </section>

          <section className="afd-flow" aria-label="Cash flow and transactions">
            <section className="afd-panel">
              <div className="afd-panel__head">
                <div className="afd-heading afd-heading--tip">
                  <h2 className="ui-section-title afd-section-head">
                    Cash flow
                    {cashFlowHint ? (
                      <button type="button" className="afd-info" aria-label={cashFlowHint} title={cashFlowHint}>
                        <Info className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : null}
                  </h2>
                  <p className="afd-section-lead">{periodLabel}</p>
                </div>
                <div className="afd-chart-toggle" role="group" aria-label="Chart type">
                  <ChartToggle active={chartType === "bar"} onClick={() => setChartType("bar")} icon={BarChart3} label="Bar chart" />
                  <ChartToggle active={chartType === "line"} onClick={() => setChartType("line")} icon={LineChartIcon} label="Line chart" />
                </div>
              </div>
              <div className="afd-legend">
                {SERIES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
                    className={`afd-legend__item ${hidden[s.key] ? "is-off" : ""}`}
                    aria-pressed={!hidden[s.key]}
                  >
                    <span className="afd-legend__swatch" style={{ background: s.color }} aria-hidden />
                    <span className="afd-legend__label">{s.label}</span>
                  </button>
                ))}
              </div>
              <div className="afd-chart">
                {chartHasValues ? (
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === "line" ? (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                        <YAxis domain={[0, chartMax]} tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => inrHeadline(v)} width={72} />
                        <Tooltip cursor={{ stroke: "transparent" }} formatter={(v) => formatInr(v)} {...CHART_TOOLTIP} />
                        {visibleSeries.map((s) => (
                          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
                        ))}
                      </LineChart>
                    ) : (
                      <BarChart data={chartData} barGap={2}>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                        <YAxis domain={[0, chartMax]} tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => inrHeadline(v)} width={72} />
                        <Tooltip cursor={{ fill: "transparent" }} formatter={(v) => formatInr(v)} {...CHART_TOOLTIP} />
                        {visibleSeries.map((s) => (
                          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={22} />
                        ))}
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <p className="afd-inline-empty">No data for this period</p>
                )}
              </div>
            </section>

            <section className="afd-panel">
              <div className="afd-panel__head">
                <SectionHeading title="Recent transactions" lead="Invoices, receipts, and supplier payments." />
                <div className="afd-filters">
                  <button type="button" className={`afd-chip ${showJournals ? "is-on" : ""}`} aria-pressed={showJournals} onClick={() => setShowJournals((on) => !on)}>Journals</button>
                  <input className="ui-input" value={txQuery} onChange={(e) => setTxQuery(e.target.value)} placeholder="Search" aria-label="Search transactions" />
                  <select className="ui-input" value={txStatus} onChange={(e) => setTxStatus(e.target.value)} aria-label="Filter by status">
                    {txStatuses.map((status) => (
                      <option key={status} value={status}>{status === "all" ? "All statuses" : status}</option>
                    ))}
                  </select>
                </div>
              </div>
              {txSlice.length === 0 ? (
                <p className="afd-inline-empty">{txEmptyCopy}</p>
              ) : (
                <div className="ui-table-wrap ui-table-wrap--scroll afd-table">
                  <table className="ui-table">
                    <thead className="ui-table-head">
                      <tr>
                        <th>Date</th>
                        <th className="afd-icon-col">Type</th>
                        <th>Reference</th>
                        <th className="afd-money">Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txSlice.map((row) => {
                        const TypeIcon = KIND_ICON[row.kind] || FileText;
                        const party = row.label && row.label !== row.reference ? row.label : "";
                        return (
                          <tr key={`${row.kind}-${row.record_id || row.reference}-${row.date}`}>
                            <td className="afd-nowrap">{row.date ? formatMediumDate(row.date) : ""}</td>
                            <td className="afd-icon-col">
                              <span className="afd-type-icon" title={KIND_LABEL[row.kind] || row.kind}>
                                <TypeIcon className="h-4 w-4" aria-hidden />
                                <span className="sr-only">{KIND_LABEL[row.kind] || row.kind}</span>
                              </span>
                            </td>
                            <td>
                              {row.href ? <Link className="afd-text-link" to={row.href}>{row.reference || party || "View"}</Link> : <span>{row.reference || party}</span>}
                              {party ? <div className="afd-tx-party">{party}</div> : null}
                            </td>
                            <td className="afd-money ui-num">{moneyText(row)}</td>
                            <td>{row.status ? <StatusBadge status={row.status} /> : ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <Pagination page={txPage} pageSize={TX_PAGE_SIZE} total={filteredTx.length} onPageChange={setTxPage} showPageSize={false} />
            </section>
          </section>

          <details className="afd-more">
            <summary>More insights</summary>
            <div className="afd-more__body">
              {sections.needs_attention && fin.needs_attention ? (
                <p className="afd-note">{fin.needs_attention}</p>
              ) : null}
              <section className="afd-panel">
                <SectionHeading title="Cash movement today" lead="Customer receipts and supplier payments dated today." />
                <div className="afd-stat-row">
                  <MovementStat label="Receipts today" value={data?.cash_flow_today?.money_in} hint={definitions.receipts} />
                  <MovementStat label="Supplier payments today" value={data?.cash_flow_today?.money_out} hint="Supplier payment records dated today." />
                  <MovementStat label="Net movement today" value={data?.cash_flow_today?.net} hint="Receipts today minus supplier payments today." />
                </div>
              </section>
              {sections.sales_breakdown ? (
                <section className="afd-panel afd-sales-breakdown">
                  <SalesBreakdownHeader periodLabel={periodLabel} breakdownTop={breakdownTop} setBreakdownTop={setBreakdownTop} />
                  <div className="afd-breakdown-tabs" role="tablist" aria-label="Sales breakdown views">
                    {BREAKDOWN_TABS.map((tab) => {
                      const Icon = tab.icon;
                      const active = breakdownTab === tab.id;
                      return (
                        <button key={tab.id} type="button" role="tab" aria-selected={active} onClick={() => setBreakdownTab(tab.id)} className={`afd-breakdown-tab ${active ? "afd-breakdown-tab--active" : ""}`}>
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                  <BreakdownList rows={breakdownRows} top={breakdownTop} emptyLabel={BREAKDOWN_EMPTY[breakdownTab] || BREAKDOWN_EMPTY.customers} />
                </section>
              ) : null}
              <section className="afd-split">
                <DocumentTable title="Open invoices" rows={data?.receivables || []} nameKey="customer_name" refKey="invoice_number" hrefFor={(row) => invoiceDetailLink(row.id)} empty="No open customer invoices." />
                <DocumentTable title="Open bills" rows={data?.payables || []} nameKey="vendor_name" refKey="bill_number" hrefFor={() => payablesLink()} empty="No open supplier bills." />
              </section>
              {sections.gst_summary ? (
                <section className="afd-panel">
                  <SectionHeading title="GST summary" lead={periodLabel} />
                  <p className="afd-stat__value">{inrHeadline(overview.gst?.net)}</p>
                  <p className="afd-note">Output tax {inrHeadline(overview.gst?.collected)} · Input credit {inrHeadline(overview.gst?.paid)}</p>
                  <Link to={ACCOUNTS_ROUTES.gst} className="afd-text-link">Open GST</Link>
                </section>
              ) : null}
              {sections.cash_and_bank ? (
                <section className="afd-panel">
                  <SectionHeading title="Cash and bank accounts" />
                  {(data?.bank_accounts || []).length === 0 ? (
                    <p className="afd-inline-empty">No cash or bank ledger accounts.</p>
                  ) : (
                    <ul className="afd-accounts">
                      {(data.bank_accounts || []).map((account) => (
                        <li key={account.id || account.code} className="afd-account-row">
                          <Link to={ACCOUNTS_ROUTES.ledger} className="afd-text-link">{account.name}</Link>
                          <span className="ui-num afd-money">{formatInr(account.balance)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}
            </div>
          </details>
        </>
      ) : (
        <EmptyState
          title="Start your books"
          description="Create an invoice or record a receipt to begin."
          actions={(
            <>
              <Button variant="primary" to="/sales/invoices/create">Create invoice</Button>
              <Button variant="secondary" to="/sales/payments/create">Record receipt</Button>
            </>
          )}
        />
      )}

      <SendMetricReportEmailModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        module="accounts"
        title={exportTitle}
        filename="accounts-dashboard"
        rows={exportRows}
        columns={EXPORT_COLUMNS}
      />
      <ConfirmationDialog
        open={Boolean(pendingApproval)}
        title="Approve expense"
        message={pendingApproval ? `Approve ${pendingApproval.name || pendingApproval.expense_name || "this expense claim"}?` : ""}
        confirmLabel="Approve"
        confirmVariant="primary"
        loading={approving}
        onConfirm={confirmApprove}
        onCancel={() => { if (!approving) setPendingApproval(null); }}
      />

      {customiseOpen ? (
        <CustomisePanel
          sections={sections}
          sectionsOn={sectionsOn}
          onToggle={toggleSection}
          onReset={() => {
            const next = defaultSectionState();
            setSections(next);
            saveSectionState(next);
          }}
          onClose={() => setCustomiseOpen(false)}
        />
      ) : null}
    </div>
  );
}

function customerInvoiceRows(summary, overview) {
  const recv = overview?.receivables || {};
  const hasSummary = summary && Object.keys(summary).length > 0;
  const unpaidCount = hasSummary ? Number(summary.sent || 0) + Number(summary.partially_paid || summary.partial || 0) : null;
  return [
    {
      key: "validate",
      count: hasSummary ? Number(summary.draft || 0) : null,
      label: "Invoices to validate",
      amount: null,
      to: invoicesLink({ invoiceStatus: "draft" }),
    },
    {
      key: "unpaid",
      count: unpaidCount,
      label: "Unpaid invoices",
      amount: Number(recv.total || 0),
      to: receivablesLink(),
    },
    {
      key: "late",
      count: hasSummary ? Number(summary.overdue || 0) : null,
      label: "Late invoices",
      amount: Number(recv.overdue || 0),
      to: receivablesLink("overdue"),
    },
  ];
}

function vendorBillRows(pendingWork, overview) {
  const pay = overview?.payables || {};
  const late = (pendingWork || []).find((item) => item.id === "overdue_payables");
  return [
    {
      key: "pay",
      count: null,
      label: "Bills to pay",
      amount: Number(pay.total || 0),
      to: payablesLink(),
    },
    {
      key: "late",
      count: late ? Number(late.count || 0) : null,
      label: "Late bills",
      amount: Number(pay.overdue || 0),
      to: payablesLink("overdue"),
    },
  ];
}

const JOURNAL_FILTERS = [
  { id: "favorites", label: "Favorites" },
  { id: "sales", label: "Sales" },
  { id: "purchases", label: "Purchases" },
  { id: "liquidity", label: "Liquidity" },
  { id: "miscellaneous", label: "Miscellaneous" },
  { id: "archived", label: "Archived" },
];

const CARD_COLORS = ["#f97316", "#fb923c", "#facc15", "#a3e635", "#7c3aed", "#f472b6", "#0f766e", "#1e3a8a", "#22c55e", "#9333ea"];
const CARD_COLOR_KEY = "insights.accounts.dashboard.cardColors";
const CARD_FAVORITES_KEY = "insights.accounts.dashboard.favorites";
const PERIODS_FLAG_KEY = "insights.accounts.dashboard.periodsSaved";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const CARD_MENUS = {
  sales: {
    view: [
      { label: "Invoices", to: "/sales/invoices" },
      { label: "Credit notes", to: "/sales/credit-notes" },
      { label: "Payments", to: "/sales/payments" },
      { label: "Journal items", to: "/accounts/journal-entries" },
    ],
    create: [
      { label: "Invoice", to: "/sales/invoices/create" },
      { label: "Credit note", to: "/sales/credit-notes/create" },
    ],
    report: [
      { label: "Invoices", to: "/sales/invoices" },
      { label: "Aged receivables", to: receivablesLink() },
    ],
  },
  purchases: {
    view: [
      { label: "Vendor bills", to: "/procurement/vendor-bills" },
      { label: "Payments", to: "/procurement/supplier-payments" },
    ],
    create: [
      { label: "Vendor bill", to: "/procurement/vendor-bills" },
    ],
    report: [
      { label: "Aged payables", to: payablesLink() },
    ],
  },
};

function readJsonStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function BooksSnapshot({ summary, pendingWork, overview, receivableWeeks, payableWeeks, bankAccounts, onBankAdded }) {
  const { addToast } = useToast();
  const [filter, setFilter] = useState("favorites");
  const [filterOpen, setFilterOpen] = useState(false);
  const [customFilter, setCustomFilter] = useState("");
  const [menuId, setMenuId] = useState(null);
  const [colors, setColors] = useState(() => readJsonStore(CARD_COLOR_KEY, {}));
  const [favorites, setFavorites] = useState(() => readJsonStore(CARD_FAVORITES_KEY, { sales: true, purchases: true }));
  const [periodsOpen, setPeriodsOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [periodsSaved, setPeriodsSaved] = useState(() => localStorage.getItem(PERIODS_FLAG_KEY) === "1");

  useEffect(() => {
    const close = (event) => {
      if (!event.target.closest(".afd-odo-menu, .afd-journal-filter")) {
        setMenuId(null);
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const showSales = filter === "sales" || (filter === "favorites" && favorites.sales !== false);
  const showPurchases = filter === "purchases" || (filter === "favorites" && favorites.purchases !== false);
  const query = customFilter.trim().toLowerCase();
  const salesVisible = showSales && (!query || "customer invoices".includes(query));
  const purchasesVisible = showPurchases && (!query || "vendor bills".includes(query));
  const showLiquidity = filter === "liquidity";
  const showEmptyJournal = filter === "miscellaneous" || filter === "archived";

  const setColor = (id, color) => {
    const next = { ...colors, [id]: color };
    setColors(next);
    localStorage.setItem(CARD_COLOR_KEY, JSON.stringify(next));
  };

  const toggleFavorite = (id) => {
    const next = { ...favorites, [id]: favorites[id] === false };
    setFavorites(next);
    localStorage.setItem(CARD_FAVORITES_KEY, JSON.stringify(next));
    setMenuId(null);
  };

  return (
    <div className="afd-odo">
      <div className="afd-journal-filter">
        <button type="button" className="afd-journal-filter__btn" aria-expanded={filterOpen} onClick={() => { setFilterOpen((open) => !open); setMenuId(null); }}>
          Filters
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
        {filter !== "favorites" ? (
          <span className="afd-journal-filter__chip">
            {JOURNAL_FILTERS.find((item) => item.id === filter)?.label}
            <button type="button" aria-label="Clear filter" onClick={() => setFilter("favorites")}>×</button>
          </span>
        ) : null}
        {customFilter ? (
          <span className="afd-journal-filter__chip">
            {customFilter}
            <button type="button" aria-label="Clear custom filter" onClick={() => setCustomFilter("")}>×</button>
          </span>
        ) : null}
        {filterOpen ? (
          <div className="afd-journal-filter__menu" role="menu">
            {JOURNAL_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={item.id === filter ? "is-active" : ""}
                onClick={() => { setFilter(item.id); setFilterOpen(false); }}
              >
                {item.id === filter ? <Check className="h-3.5 w-3.5" aria-hidden /> : <span className="afd-journal-filter__mark" />}
                {item.label}
              </button>
            ))}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const value = new FormData(event.currentTarget).get("custom");
                setCustomFilter(String(value || "").trim());
                setFilterOpen(false);
              }}
            >
              <input name="custom" placeholder="Add custom filter" aria-label="Add custom filter" />
            </form>
          </div>
        ) : null}
      </div>
      <section className="afd-setup" aria-label="Accounting setup">
        <div className="afd-setup__step">
          <h2>Accounting periods</h2>
          <p>Define your fiscal years and tax return periods.</p>
          {periodsSaved ? (
            <p className="afd-setup__done"><Check className="h-4 w-4" aria-hidden /> Step completed</p>
          ) : (
            <button type="button" onClick={() => setPeriodsOpen(true)}>Configure</button>
          )}
        </div>
        <div className="afd-setup__step">
          <h2>Bank account</h2>
          <p>Add a cash or bank ledger for this company.</p>
          {bankAccounts.length > 0 ? (
            <p className="afd-setup__done"><Check className="h-4 w-4" aria-hidden /> Step completed</p>
          ) : (
            <button type="button" onClick={() => setBankOpen(true)}>Add a bank account</button>
          )}
        </div>
        <div className="afd-setup__step">
          <h2>Taxes</h2>
          <p>Set taxes for sales and purchase transactions.</p>
          <Link to={ACCOUNTS_ROUTES.gst}>Review</Link>
        </div>
        <div className="afd-setup__step">
          <h2>Chart of accounts</h2>
          <p>Set up the chart of accounts and opening balances.</p>
          <Link to="/accounts/chart-of-accounts">Review</Link>
        </div>
      </section>
      <section className="afd-odo-grid" aria-label="Customer invoices and vendor bills">
        {salesVisible ? (
          <OdooBooksCard
            title="Customer invoices"
            accent={colors.sales || "#7b6bb5"}
            menuOpen={menuId === "sales"}
            onMenu={() => setMenuId((id) => (id === "sales" ? null : "sales"))}
            menu={CARD_MENUS.sales}
            favorite={favorites.sales !== false}
            onColor={(color) => setColor("sales", color)}
            onFavorite={() => toggleFavorite("sales")}
            onConfigure={() => { setMenuId(null); setPeriodsOpen(true); }}
            action={<Button variant="primary" to="/sales/invoices/create">New invoice</Button>}
            rows={customerInvoiceRows(summary, overview)}
            weeks={receivableWeeks}
          />
        ) : null}
        {purchasesVisible ? (
          <OdooBooksCard
            title="Vendor bills"
            accent={colors.purchases || "#7b6bb5"}
            menuOpen={menuId === "purchases"}
            onMenu={() => setMenuId((id) => (id === "purchases" ? null : "purchases"))}
            menu={CARD_MENUS.purchases}
            favorite={favorites.purchases !== false}
            onColor={(color) => setColor("purchases", color)}
            onFavorite={() => toggleFavorite("purchases")}
            onConfigure={() => { setMenuId(null); setPeriodsOpen(true); }}
            action={<Link className="afd-odo-textlink" to="/procurement/vendor-bills">Create manually</Link>}
            rows={vendorBillRows(pendingWork, overview)}
            weeks={payableWeeks}
          />
        ) : null}
        {showLiquidity ? (
          <section className="afd-odo-card">
            <h2 className="afd-odo-card__title">Bank</h2>
            {bankAccounts.length === 0 ? (
              <p className="afd-inline-empty">No cash or bank ledger account is set up.</p>
            ) : (
              <ul className="afd-invoice-stats">
                {bankAccounts.map((account) => (
                  <li key={account.id}>
                    <Link to={ACCOUNTS_ROUTES.ledger} className="afd-invoice-stat">
                      <span>{account.name}</span>
                      <strong className="ui-num">{formatInr(account.balance)}</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
        {showEmptyJournal ? (
          <p className="afd-inline-empty">{filter === "archived" ? "No archived journals." : "No miscellaneous journals."}</p>
        ) : null}
      </section>
      {periodsOpen ? (
        <AccountingPeriodsDialog
          onClose={() => setPeriodsOpen(false)}
          onSaved={() => {
            setPeriodsSaved(true);
            localStorage.setItem(PERIODS_FLAG_KEY, "1");
            setPeriodsOpen(false);
            addToast("Accounting periods saved.", "success");
          }}
        />
      ) : null}
      {bankOpen ? (
        <AddBankLedgerDialog
          onClose={() => setBankOpen(false)}
          onSaved={() => {
            setBankOpen(false);
            addToast("Bank account added.", "success");
            onBankAdded?.();
          }}
        />
      ) : null}
    </div>
  );
}

function OdooBooksCard({ title, accent, action, rows, weeks, menuOpen, onMenu, menu, favorite, onColor, onFavorite, onConfigure }) {
  return (
    <section className="afd-odo-card" style={{ borderLeftColor: accent }}>
      <div className="afd-odo-card__head">
        <h2 className="afd-odo-card__title">{title}</h2>
        <div className="afd-odo-menu">
          <button type="button" className="afd-odo-menu__btn" aria-label={`${title} menu`} aria-expanded={menuOpen} onClick={onMenu}>
            <MoreVertical className="h-4 w-4" aria-hidden />
          </button>
          {menuOpen ? (
            <div className="afd-odo-menu__panel" role="menu">
              <div className="afd-odo-menu__cols">
                <div>
                  <p>View</p>
                  {menu.view.map((item) => <Link key={item.label} to={item.to}>{item.label}</Link>)}
                </div>
                <div>
                  <p>New</p>
                  {menu.create.map((item) => <Link key={item.label} to={item.to}>{item.label}</Link>)}
                </div>
                <div>
                  <p>Reporting</p>
                  {menu.report.map((item) => <Link key={item.label} to={item.to}>{item.label}</Link>)}
                </div>
              </div>
              <div className="afd-odo-menu__colors">
                <button type="button" aria-label="Reset colour" onClick={() => onColor("")}>✎</button>
                {CARD_COLORS.map((color) => (
                  <button key={color} type="button" aria-label={`Colour ${color}`} style={{ background: color }} onClick={() => onColor(color)} />
                ))}
              </div>
              <div className="afd-odo-menu__foot">
                <button type="button" onClick={onFavorite}>{favorite ? "Remove from favorites" : "Add to favorites"}</button>
                <button type="button" onClick={onConfigure}>Configuration</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="afd-odo-card__top">
        <div className="afd-odo-card__action">{action}</div>
        <ul className="afd-invoice-stats">
          {rows.map((row) => (
            <li key={row.key}>
              <Link to={row.to} className="afd-invoice-stat">
                <span>{row.count == null ? row.label : `${row.count} ${row.label}`}</span>
                {row.amount == null ? null : <strong className="ui-num">{formatInr(row.amount)}</strong>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <WeekBars weeks={weeks} />
    </section>
  );
}

function AccountingPeriodsDialog({ onClose, onSaved }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({
    openingDate: indianFyStartIso(),
    endDay: "31",
    endMonth: "3",
    periodicity: "monthly",
    reminderDays: "7",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getFeatureSetting(OPENING_BALANCE_SETTING_KEY)
      .then((res) => {
        if (cancelled) return;
        const value = unwrapFeatureSettingValue(res);
        if (!value || typeof value !== "object") return;
        setForm((current) => ({
          ...current,
          openingDate: value.opening_balance_date || current.openingDate,
          endDay: String(value.fiscal_year_end_day || current.endDay),
          endMonth: String(value.fiscal_year_end_month || current.endMonth),
          periodicity: value.tax_periodicity || current.periodicity,
          reminderDays: String(value.tax_reminder_days || current.reminderDays),
        }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const existingRes = await getFeatureSetting(OPENING_BALANCE_SETTING_KEY).catch(() => null);
      const existing = unwrapFeatureSettingValue(existingRes);
      const base = existing && typeof existing === "object" ? existing : {};
      await putFeatureSetting(OPENING_BALANCE_SETTING_KEY, {
        ...base,
        opening_balance_date: form.openingDate,
        fiscal_year_end_day: Number(form.endDay),
        fiscal_year_end_month: Number(form.endMonth),
        tax_periodicity: form.periodicity,
        tax_reminder_days: Number(form.reminderDays) || 7,
        periods_configured: true,
        updated_at: new Date().toISOString(),
      });
      onSaved();
    } catch (err) {
      addToast(apiErrorMessage(err, "Unable to save accounting periods."), "error");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="afd-dialog" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="afd-dialog__panel" role="dialog" aria-labelledby="afd-periods-title" onSubmit={save}>
        <div className="afd-dialog__head">
          <h2 id="afd-periods-title">Accounting periods</h2>
          <button type="button" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="afd-dialog__body">
          <fieldset>
            <legend>Fiscal years</legend>
            <label>
              Opening date
              <input type="date" value={form.openingDate} onChange={(event) => setForm((f) => ({ ...f, openingDate: event.target.value }))} required />
            </label>
            <label>
              Fiscal year end
              <span className="afd-dialog__pair">
                <input aria-label="Fiscal year end day" type="number" min="1" max="31" value={form.endDay} onChange={(event) => setForm((f) => ({ ...f, endDay: event.target.value }))} />
                <select aria-label="Fiscal year end month" value={form.endMonth} onChange={(event) => setForm((f) => ({ ...f, endMonth: event.target.value }))}>
                  {MONTHS.map((name, index) => <option key={name} value={String(index + 1)}>{name}</option>)}
                </select>
              </span>
            </label>
          </fieldset>
          <fieldset>
            <legend>Tax return</legend>
            <label>
              Periodicity
              <select value={form.periodicity} onChange={(event) => setForm((f) => ({ ...f, periodicity: event.target.value }))}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </label>
            <label>
              Reminder
              <span className="afd-dialog__pair">
                <input aria-label="Reminder days" type="number" min="0" max="60" value={form.reminderDays} onChange={(event) => setForm((f) => ({ ...f, reminderDays: event.target.value }))} />
                <span>days after period</span>
              </span>
            </label>
            <label>
              Journal
              <select defaultValue="journal" aria-label="Journal">
                <option value="journal">Journal entries</option>
              </select>
            </label>
          </fieldset>
          <p className="afd-dialog__note">The opening date is saved with opening balances. Dashboard reports stay on the Indian financial year, 1 April to 31 March.</p>
        </div>
        <div className="afd-dialog__foot">
          <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving" : "Apply"}</Button>
          <button type="button" className="afd-dialog__cancel" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function AddBankLedgerDialog({ onClose, onSaved }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({ name: "", account_number: "", ifsc: "", branch_name: "", holder_name: "" });
  const [saving, setSaving] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await saveLedgerCashAccount({
        name: form.name.trim(),
        account_type: "BANK",
        account_number: form.account_number.trim(),
        ifsc: form.ifsc.trim().toUpperCase(),
        branch_name: form.branch_name.trim(),
        holder_name: form.holder_name.trim(),
        balance: 0,
      });
      onSaved();
    } catch (err) {
      addToast(apiErrorMessage(err, "Unable to add the bank account."), "error");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="afd-dialog" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="afd-dialog__panel" role="dialog" aria-labelledby="afd-bank-title" onSubmit={save}>
        <div className="afd-dialog__head">
          <h2 id="afd-bank-title">Add a bank account</h2>
          <button type="button" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="afd-dialog__body afd-dialog__body--stack">
          <label>
            Bank name
            <input value={form.name} onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))} required />
          </label>
          <label>
            Account number
            <input value={form.account_number} onChange={(event) => setForm((f) => ({ ...f, account_number: event.target.value.replace(/\D/g, "").slice(0, 18) }))} />
          </label>
          <label>
            IFSC
            <input value={form.ifsc} onChange={(event) => setForm((f) => ({ ...f, ifsc: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11) }))} />
          </label>
          <label>
            Branch
            <input value={form.branch_name} onChange={(event) => setForm((f) => ({ ...f, branch_name: event.target.value }))} />
          </label>
          <label>
            Account holder
            <input value={form.holder_name} onChange={(event) => setForm((f) => ({ ...f, holder_name: event.target.value }))} />
          </label>
          <p className="afd-dialog__note">This creates a bank ledger on the chart of accounts. The opening balance stays zero until you post it.</p>
        </div>
        <div className="afd-dialog__foot">
          <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving" : "Save"}</Button>
          <button type="button" className="afd-dialog__cancel" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function WeekBars({ weeks }) {
  const items = Array.isArray(weeks) ? weeks : [];
  if (!items.length) return null;
  const max = Math.max(...items.map((item) => Number(item.amount) || 0), 0);
  return (
    <div className="afd-duebars" role="img" aria-label="Open balance by week">
      {items.map((item) => {
        const amount = Number(item.amount) || 0;
        return (
          <div key={item.label} className="afd-duebars__col" title={`${item.label}: ${inrHeadline(amount)}`}>
            <span className="afd-duebars__track">
              {amount > 0 ? <span style={{ height: `${Math.max(10, (amount / max) * 100)}%` }} /> : null}
            </span>
            <span className="afd-duebars__label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({ to, icon: Icon, label, value, meta, hint }) {
  const body = (
    <>
      <span className="afd-kpi__icon" aria-hidden><Icon className="h-4 w-4" /></span>
      <span className="afd-kpi__label">
        {label}
        {hint ? <span className="afd-info" title={hint}><Info className="h-3.5 w-3.5" aria-hidden /><span className="sr-only">{hint}</span></span> : null}
      </span>
      <span className="afd-kpi__value">{value}</span>
      <span className="afd-kpi__meta">{meta}</span>
    </>
  );
  if (to) return <Link to={to} className="afd-kpi">{body}</Link>;
  return <article className="afd-kpi">{body}</article>;
}

function SectionHeading({ title, lead }) {
  return (
    <div className="afd-heading">
      <h2 className="ui-section-title afd-section-head">{title}</h2>
      {lead ? <p className="afd-section-lead">{lead}</p> : null}
    </div>
  );
}

function MovementStat({ label, value, hint }) {
  return (
    <div className="afd-stat" title={hint}>
      <p className="afd-stat__label">{label}</p>
      <p className="afd-stat__value">{inrHeadline(value)}</p>
    </div>
  );
}

function DocumentTable({ title, rows, nameKey, refKey, hrefFor, empty }) {
  return (
    <section className="afd-panel">
      <SectionHeading title={title} />
      {rows.length === 0 ? <p className="afd-note">{empty}</p> : (
        <div className="ui-table-wrap ui-table-wrap--scroll afd-table">
          <table className="ui-table">
            <thead className="ui-table-head">
              <tr>
                <th>Reference</th>
                <th>Party</th>
                <th>Due</th>
                <th className="afd-money">Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id || row[refKey]}>
                  <td className="afd-nowrap"><Link to={hrefFor(row)} className="afd-text-link">{row[refKey] || "—"}</Link></td>
                  <td>{row[nameKey] || "—"}</td>
                  <td className="afd-nowrap">{row.due_date ? formatMediumDate(row.due_date) : "—"}</td>
                  <td className="afd-money ui-num">{formatInr(row.balance)}</td>
                  <td>{row.status ? <StatusBadge status={row.status} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ChartToggle({ active, onClick, icon: Icon, label }) {
  return (
    <button type="button" onClick={onClick} className={`afd-chart-toggle__btn ${active ? "is-active" : ""}`} aria-label={label} aria-pressed={active}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function AgingBuckets({ buckets }) {
  const items = AGING_BUCKETS.map((bucket) => ({ ...bucket, amount: Number(buckets?.[bucket.id] || 0) }));
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return (
    <div className="afd-aging">
      {total > 0 ? (
        <div className="afd-aging__bar" role="img" aria-label="Aging distribution">
          {items.filter((item) => item.amount > 0).map((item) => (
            <span key={item.id} style={{ width: `${(item.amount / total) * 100}%`, background: item.color }} title={`${item.label}: ${inrHeadline(item.amount)}`} />
          ))}
        </div>
      ) : null}
      <ul className="afd-aging__legend">
        {items.map((item) => (
          <li key={item.id}>
            <span className="afd-aging__name">
              <span className="afd-legend__swatch" style={{ background: item.color }} aria-hidden />
              <span>{item.label}</span>
            </span>
            <strong className="ui-num">{inrHeadline(item.amount)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SalesBreakdownHeader({ periodLabel, breakdownTop, setBreakdownTop }) {
  return (
    <div className="afd-panel__head">
      <SectionHeading title="Sales breakdown" lead={periodLabel} />
      <div className="afd-top">
        <span>Show top</span>
        {[5, 10, 20, 50].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setBreakdownTop(n)}
            className={`afd-breakdown-top-btn ${breakdownTop === n ? "afd-breakdown-top-btn--active" : ""}`}
          >
            {n}
          </button>
        ))}
        <button type="button" className="afd-icon-btn" aria-label="About sales breakdown">
          <CircleHelp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function BreakdownList({ rows, top, emptyLabel }) {
  const list = rows.slice(0, top);
  if (!list.length) return <p className="afd-breakdown-empty">{emptyLabel}</p>;
  return (
    <ul className="afd-rank">
      {list.map((row) => (
        <li key={row.name}>
          <span>{row.name}</span>
          <span className="ui-num">{formatInr(row.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

function CustomisePanel({ sections, sectionsOn, onToggle, onReset, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/30" onClick={onClose} aria-hidden />
      <aside className="afd-customise-panel" role="dialog" aria-labelledby="afd-customise-title" aria-modal="true">
        <header className="afd-customise-header">
          <div className="afd-customise-header__title-row">
            <h2 id="afd-customise-title" className="afd-customise-title">Show on dashboard</h2>
            <button type="button" onClick={onClose} className="afd-customise-close" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="afd-customise-header__meta">
            <p className="afd-customise-count">{sectionsOn} of {ACCOUNTS_DASHBOARD_SECTIONS.length} optional sections on</p>
            <button type="button" onClick={onReset} className="afd-customise-reset">Reset</button>
          </div>
        </header>
        <div className="afd-customise-list">
          {ACCOUNTS_DASHBOARD_SECTIONS.map((s) => (
            <label key={s.id} className="afd-customise-item">
              <input type="checkbox" className="afd-customise-checkbox" checked={Boolean(sections[s.id])} onChange={() => onToggle(s.id)} />
              <span className="afd-customise-item-text">
                <span className="afd-customise-item-title">{s.title}</span>
                <span className="afd-customise-item-desc">{s.description}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="afd-customise-footer">Headline cards, aging, transactions, and alerts stay on the dashboard.</p>
      </aside>
    </>
  );
}
