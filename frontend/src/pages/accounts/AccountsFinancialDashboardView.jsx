import { useCallback, useEffect, useMemo, useState } from "react";
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
  Building2,
  ChartNoAxesCombined,
  CircleHelp,
  Clock,
  FileText,
  Hourglass,
  LineChart as LineChartIcon,
  Package,
  SlidersHorizontal,
  UserPlus,
  X,
} from "lucide-react";

import { getAccountsDashboard } from "../../api/accountsApi";
import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/states/ErrorState";
import LoadingState from "../../components/common/states/LoadingState";
import { DateRangePicker } from "../../design-system/dateControls";
import usePageRefresh from "../../hooks/usePageRefresh";
import { formatInr } from "../../data/financeMasterData";
import { apiErrorMessage } from "../../utils/apiError";
import { buildAccountsDateRangePresets, formatMediumDate, fyRange, todayIso } from "../../utils/dateUtils";
import {
  ACCOUNTS_DASHBOARD_SECTIONS,
  defaultSectionState,
  loadSectionState,
  saveSectionState,
} from "./accountsDashboardSections";
import { ACCOUNTS_ROUTES, payablesLink, receivablesLink } from "../../utils/accountsDashboardLinks";
import "./accountsFinancialDashboard.css";

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
  { key: "sales", label: "SALES", color: "#7c3aed" },
  { key: "purchases", label: "PURCHASES", color: "#16a34a" },
  { key: "collections", label: "COLLECTIONS", color: "#2563eb" },
  { key: "expenses", label: "EXPENSES", color: "#db2777" },
];

function inrHeadline(value) {
  const n = Number(value) || 0;
  return `₹ ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fyToDateRange() {
  const fy = fyRange();
  const to = todayIso();
  return { from: fy.from, to: to <= fy.to ? to : fy.to };
}

function resolveFinBlock(data) {
  if (data?.financial_dashboard?.overview) return data.financial_dashboard;
  const k = data?.kpis || {};
  const banks = data?.bank_accounts || [];
  const bankBal = banks.reduce((s, a) => s + Number(a.balance || 0), 0);
  return {
    reporting_period: { from: fyToDateRange().from, to: fyToDateRange().to },
    overview: {
      receivables: {
        total: k.total_receivables ?? 0,
        current: Math.max(0, (k.total_receivables ?? 0) - (k.overdue_receivables ?? 0)),
        overdue: k.overdue_receivables ?? 0,
      },
      payables: {
        total: k.total_payables ?? 0,
        current: Math.max(0, (k.total_payables ?? 0) - (k.overdue_payables ?? 0)),
        overdue: k.overdue_payables ?? 0,
      },
      cash_and_bank: { total: k.cash_and_bank_balance ?? bankBal, bank: bankBal, cash: 0, account_count: banks.length },
      gst: {
        net: k.gst_liability_period ?? data?.gst_period?.net_liability ?? 0,
        collected: 0,
        paid: 0,
      },
    },
    sales_purchases: { totals: {}, series: [] },
    aging: { receivable: { total: 0, buckets: {} }, payable: { total: 0, buckets: {} }, as_of: todayIso() },
    sales_breakdown: {
      top_customers: [],
      top_products: [],
      overdue: [],
      invoice_status: [],
      collections: [],
    },
    needs_attention: "",
  };
}

export default function AccountsFinancialDashboardView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(fyToDateRange);
  const [chartType, setChartType] = useState("bar");
  const [hidden, setHidden] = useState({});
  const [agingSide, setAgingSide] = useState("receivable");
  const [breakdownTab, setBreakdownTab] = useState("customers");
  const [breakdownTop, setBreakdownTop] = useState(5);
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [sections, setSections] = useState(loadSectionState);

  const presets = useMemo(() => [{ id: "FY to date", ...fyToDateRange() }, ...buildAccountsDateRangePresets()], []);
  const fin = useMemo(() => resolveFinBlock(data), [data]);
  const breakdownRows = useMemo(() => {
    const sb = fin.sales_breakdown || {};
    switch (breakdownTab) {
      case "products":
        return sb.top_products || [];
      case "overdue":
        return sb.overdue || [];
      case "invoice_status":
        return sb.invoice_status || [];
      case "collections":
        return sb.collections || [];
      default:
        return sb.top_customers || [];
    }
  }, [fin.sales_breakdown, breakdownTab]);
  const overview = fin.overview;
  const periodLabel = `${formatMediumDate(period.from)} – ${formatMediumDate(period.to)}`;

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        const res = await getAccountsDashboard({ date_from: period.from, date_to: period.to });
        setData(res?.data ?? res);
      } catch (err) {
        setData(null);
        setError(apiErrorMessage(err, "Could not load accounts dashboard."));
      } finally {
        setLoading(false);
      }
    },
    [period.from, period.to]
  );

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const chartData = useMemo(() => {
    return (fin.sales_purchases?.series || []).map((row) => ({
      ...row,
      sales: hidden.sales ? 0 : row.sales,
      purchases: hidden.purchases ? 0 : row.purchases,
      collections: hidden.collections ? 0 : row.collections,
      expenses: hidden.expenses ? 0 : row.expenses,
    }));
  }, [fin, hidden]);

  const chartMax = useMemo(() => {
    let m = 0;
    chartData.forEach((r) => {
      m = Math.max(m, r.sales, r.purchases, r.collections, r.expenses);
    });
    return m > 0 ? m * 1.1 : 100;
  }, [chartData]);

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
    return <ErrorState title="Dashboard unavailable" description={error} onRetry={() => load()} />;
  }

  const aging = agingSide === "receivable" ? fin.aging?.receivable : fin.aging?.payable;
  const totals = fin.sales_purchases?.totals || {};
  const sectionsOn = ACCOUNTS_DASHBOARD_SECTIONS.filter((s) => sections[s.id]).length;

  return (
    <div className="accounts-financial-dashboard ui-page ui-stack min-h-full">
      <header className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700">FY to date</span>
          <DateRangePicker from={period.from} to={period.to} presets={presets} popoverAlign="end" onChange={setPeriod} />
          <Button type="button" variant="secondary" className="gap-2" onClick={() => setCustomiseOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            Customise
          </Button>
      </header>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{error}</div>
      ) : null}

      {sections.needs_attention && fin.needs_attention ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">{fin.needs_attention}</div>
      ) : null}

      {sections.overview ? (
        <section>
          <h2 className="ui-section-title afd-section-head">Overview</h2>
          <p className="afd-section-lead">Your headline numbers.</p>
          <div className="mt-3 grid afd-overview-grid sm:grid-cols-2 xl:grid-cols-4">
            <OverviewCell
              to={receivablesLink()}
              status={overview.receivables.overdue <= 0 ? "✓ All current" : "Overdue balance"}
              ok={overview.receivables.overdue <= 0}
              icon={ArrowDownToLine}
              label="Total Receivables"
              value={overview.receivables.total}
              meta={`Current ${inrHeadline(overview.receivables.current)} · Overdue ${inrHeadline(overview.receivables.overdue)}`}
            />
            <OverviewCell
              to={payablesLink()}
              status={overview.payables.overdue <= 0 ? "✓ All current" : "Overdue balance"}
              ok={overview.payables.overdue <= 0}
              icon={ArrowUpFromLine}
              label="Total Payables"
              value={overview.payables.total}
              meta={`Current ${inrHeadline(overview.payables.current)} · Overdue ${inrHeadline(overview.payables.overdue)}`}
            />
            <OverviewCell
              to={ACCOUNTS_ROUTES.ledger}
              status={`${overview.cash_and_bank.account_count || 0} account${overview.cash_and_bank.account_count === 1 ? "" : "s"}`}
              muted
              icon={Building2}
              label="Cash and Bank"
              value={overview.cash_and_bank.total}
              meta={`Bank ${inrHeadline(overview.cash_and_bank.bank)} · Cash ${inrHeadline(overview.cash_and_bank.cash)}`}
            />
            <OverviewCell
              to={ACCOUNTS_ROUTES.gst}
              status={overview.gst.net <= 0 ? "✓ Nothing due" : "GST due"}
              ok={overview.gst.net <= 0}
              icon={FileText}
              label="GST Summary"
              value={overview.gst.net}
              meta={`Collected ${inrHeadline(overview.gst.collected)} · Paid ${inrHeadline(overview.gst.paid)}`}
            />
          </div>
        </section>
      ) : null}

      {sections.sales_purchases ? (
        <section className="afd-panel p-4 sm:p-5" style={{ borderTopWidth: 3, borderTopColor: "var(--color-primary)" }}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <ChartNoAxesCombined className="h-5 w-5 text-[var(--color-primary)]" aria-hidden />
                <h2 className="ui-section-title afd-section-head">Sales and Purchases</h2>
              </div>
              <p className="afd-section-lead">{periodLabel}</p>
            </div>
            <div className="flex gap-1">
              <ChartToggle active={chartType === "bar"} onClick={() => setChartType("bar")} icon={BarChart3} />
              <ChartToggle active={chartType === "line"} onClick={() => setChartType("line")} icon={LineChartIcon} />
              <button type="button" className="rounded-lg p-2 text-slate-400" aria-label="Info">
                <CircleHelp className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {SERIES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
                className={`rounded-xl border border-transparent p-3 text-left transition ${hidden[s.key] ? "opacity-40" : ""}`}
                style={{ backgroundColor: `${s.color}12` }}
              >
                <span className="afd-series-label" style={{ color: s.color }}>{s.label}</span>
                <p className="afd-money-chart">{inrHeadline(totals[s.key])}</p>
              </button>
            ))}
          </div>
          <p className="mt-2 afd-hint">Tap a total to hide it — useful when one series dwarfs the rest.</p>
          <div className="mt-4 h-64">
            {chartData.length === 0 ? (
              <EmptyState title="No activity in this period" className="py-8" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "line" ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis domain={[0, chartMax]} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => inrHeadline(v)} width={76} />
                    <Tooltip formatter={(v) => formatInr(v)} />
                    {SERIES.filter((s) => !hidden[s.key]).map((s) => (
                      <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                ) : (
                  <BarChart data={chartData} barGap={2}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis domain={[0, chartMax]} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => inrHeadline(v)} width={76} />
                    <Tooltip formatter={(v) => formatInr(v)} />
                    {SERIES.filter((s) => !hidden[s.key]).map((s) => (
                      <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </section>
      ) : null}

      {sections.aging_summary ? (
        <section className="afd-panel p-4 sm:p-5">
          <AgingHeader agingSide={agingSide} setAgingSide={setAgingSide} asOf={fin.aging?.as_of} />
          <p className="ui-eyebrow mt-4">Total outstanding</p>
          <p className="afd-money-hero">{inrHeadline(aging?.total)}</p>
          <AgingBuckets buckets={aging?.buckets} />
          {(aging?.total ?? 0) <= 0 ? <EmptyState title="Nothing outstanding on this side." className="py-10" /> : null}
        </section>
      ) : null}

      {sections.sales_breakdown ? (
        <section className="afd-panel afd-sales-breakdown p-4 sm:p-5" style={{ borderTopWidth: 3, borderTopColor: "#7c3aed" }}>
          <SalesBreakdownHeader periodLabel={periodLabel} breakdownTop={breakdownTop} setBreakdownTop={setBreakdownTop} />
          <div className="afd-breakdown-tabs" role="tablist" aria-label="Sales breakdown views">
            {BREAKDOWN_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = breakdownTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setBreakdownTab(tab.id)}
                  className={`afd-breakdown-tab ${active ? "afd-breakdown-tab--active" : ""}`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <BreakdownList rows={breakdownRows} top={breakdownTop} emptyLabel={BREAKDOWN_EMPTY[breakdownTab] || BREAKDOWN_EMPTY.customers} />
        </section>
      ) : null}

      {customiseOpen ? <CustomisePanel sections={sections} sectionsOn={sectionsOn} onToggle={toggleSection} onReset={() => { const d = defaultSectionState(); setSections(d); saveSectionState(d); }} onClose={() => setCustomiseOpen(false)} /> : null}
    </div>
  );
}

function OverviewCell({ to, status, ok, muted, icon: Icon, label, value, meta }) {
  return (
    <Link to={to} className="block border-b border-slate-100 p-4 transition hover:bg-slate-50/80 xl:border-b-0 xl:border-r xl:last:border-r-0">
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? "bg-emerald-50 text-emerald-700" : muted ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-800"}`}>
        {status}
      </span>
      <div className="mt-3 flex items-center gap-2 afd-label-link">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </div>
      <p className="afd-money-overview">{inrHeadline(value)}</p>
      <p className="mt-2 afd-meta">{meta}</p>
    </Link>
  );
}

function ChartToggle({ active, onClick, icon: Icon }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg p-2 ${active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function AgingHeader({ agingSide, setAgingSide, asOf }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700">
          <Hourglass className="h-5 w-5" />
        </div>
        <div>
          <h2 className="ui-section-title afd-section-head">Aging Summary</h2>
          <p className="afd-section-lead">As of {formatMediumDate(asOf || todayIso())}</p>
        </div>
      </div>
      <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm">
        {["receivable", "payable"].map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => setAgingSide(side)}
            className={`rounded-md px-3 py-1.5 font-semibold capitalize ${agingSide === side ? "bg-slate-900 text-white" : "text-slate-600"}`}
          >
            {side === "receivable" ? "Receivable" : "Payable"}
          </button>
        ))}
      </div>
    </div>
  );
}

function AgingBuckets({ buckets }) {
  const keys = ["current", "1-30", "31-60", "61-90", "90+"];
  return (
    <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
      {keys.map((b, i) => (
        <div key={b}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: `hsl(${258 - i * 14}, 65%, 52%)` }} />
          <p className="mt-1 text-slate-500">{b === "current" ? "Current" : b}</p>
          <p className="ui-num font-semibold text-[var(--color-text)]">{inrHeadline(buckets?.[b] ?? 0)}</p>
        </div>
      ))}
    </div>
  );
}

function SalesBreakdownHeader({ periodLabel, breakdownTop, setBreakdownTop }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700">
          <BarChart3 className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className="ui-section-title afd-section-head">Sales Breakdown</h2>
          <p className="afd-section-lead">{periodLabel}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
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
        </div>
        <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="About sales breakdown">
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
    <ul className="mt-4 divide-y divide-slate-100">
      {list.map((row) => (
        <li key={row.name} className="flex justify-between py-2.5 text-sm">
          <span className="font-medium text-[var(--color-text)]">{row.name}</span>
          <span className="ui-num font-semibold">{formatInr(row.amount)}</span>
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
            <p className="afd-customise-count">
              {sectionsOn} of {ACCOUNTS_DASHBOARD_SECTIONS.length} sections on
            </p>
            <button type="button" onClick={onReset} className="afd-customise-reset">
              Reset
            </button>
          </div>
        </header>
        <div className="afd-customise-list">
          {ACCOUNTS_DASHBOARD_SECTIONS.map((s) => (
            <label key={s.id} className="afd-customise-item">
              <input
                type="checkbox"
                className="afd-customise-checkbox"
                checked={Boolean(sections[s.id])}
                onChange={() => onToggle(s.id)}
              />
              <span className="afd-customise-item-text">
                <span className="afd-customise-item-title">{s.title}</span>
                <span className="afd-customise-item-desc">{s.description}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="afd-customise-footer">Cards you turn off aren&apos;t loaded — fewer requests, faster dashboard.</p>
      </aside>
    </>
  );
}
