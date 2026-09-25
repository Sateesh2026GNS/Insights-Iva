import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  IndianRupee,
  RefreshCw,
  Scale,
  Wallet,
} from "lucide-react";

import { getAccountsDashboard } from "../../api/accountsApi";
import Button from "../../components/common/Button";
import KpiCard from "../../components/common/KpiCard";
import DashboardReportExport from "../../components/common/DashboardReportExport";
import PageHeader from "../../components/common/PageHeader";
import { metricExportRows } from "../../utils/dashboardExportRows";
import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/states/ErrorState";
import LoadingState from "../../components/common/states/LoadingState";
import usePageRefresh from "../../hooks/usePageRefresh";
import { formatInr, statusColor } from "../../data/financeMasterData";
import { apiErrorMessage } from "../../utils/apiError";
import {
  ACCOUNTS_ROUTES,
  invoiceDetailLink,
  invoicesLink,
  ledgerAccountLink,
  payablesLink,
  paymentsLink,
  receivablesLink,
} from "../../utils/accountsDashboardLinks";

function moneyOrDash(value, failed) {
  if (failed || value === null || value === undefined) return "—";
  return formatInr(value);
}

function SectionCard({ title, action, children, error }) {
  return (
    <section className="ui-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        {action}
      </div>
      {error ? (
        <div className="p-4">
          <ErrorState title="Could not load this section" description={error} className="py-8" />
        </div>
      ) : (
        children
      )}
    </section>
  );
}

export default function AccountsDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getAccountsDashboard();
      setData(res?.data ?? res);
    } catch (err) {
      setData(null);
      setError(apiErrorMessage(err, "Could not load accounts dashboard."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="pb-6">
        <LoadingState label="Loading accounts dashboard" description="Fetching live financial data for your company." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4 pb-6">
        <PageHeader title="Accounts Dashboard" subtitle="Accounting work control center" />
        <ErrorState title="Dashboard unavailable" description={error} />
        <Button type="button" variant="secondary" onClick={() => load()}>
          Try again
        </Button>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const cashToday = data?.cash_flow_today || {};
  const invoiceSummary = data?.invoice_summary || {};
  const failed = Boolean(error);

  const kpiItems = [
      {
        label: "Total Receivables",
        value: moneyOrDash(kpis.total_receivables, failed),
        icon: ArrowUpRight,
        color: "bg-emerald-600",
        to: receivablesLink("open"),
      },
      {
        label: "Total Payables",
        value: moneyOrDash(kpis.total_payables, failed),
        icon: ArrowDownRight,
        color: "bg-rose-600",
        to: payablesLink("open"),
      },
      {
        label: "Cash & Bank",
        value: moneyOrDash(kpis.cash_and_bank_balance, failed),
        icon: Wallet,
        color: "bg-slate-700",
        to: ACCOUNTS_ROUTES.ledger,
      },
      {
        label: "Today's Collections",
        value: moneyOrDash(kpis.todays_collections, failed),
        icon: Banknote,
        color: "bg-teal-600",
        to: paymentsLink("today_in"),
      },
      {
        label: "Today's Payments",
        value: moneyOrDash(kpis.todays_payments, failed),
        icon: IndianRupee,
        color: "bg-amber-600",
        to: paymentsLink("today_out"),
      },
      {
        label: "Overdue Receivables",
        value: moneyOrDash(kpis.overdue_receivables, failed),
        icon: AlertTriangle,
        tone: "danger",
        color: "bg-red-600",
        to: receivablesLink("overdue"),
      },
      {
        label: "Overdue Payables",
        value: moneyOrDash(kpis.overdue_payables, failed),
        icon: AlertTriangle,
        tone: "danger",
        color: "bg-rose-600",
        to: payablesLink("overdue"),
      },
  ];

  if (data?.features?.gst) {
    kpiItems.push({
      label: "GST Liability (This Period)",
      value: moneyOrDash(kpis.gst_liability_period, failed),
      icon: Scale,
      tone: "warning",
      color: "bg-amber-600",
      meta: kpis.gst_filing_due_label || data?.gst_period?.filing_due_label,
      to: ACCOUNTS_ROUTES.gst,
    });
  }

  const accountsExportRows = metricExportRows(kpiItems.map(({ label, value }) => ({ label, value })));

  const arColumns = [
    { key: "customer_name", label: "Customer" },
    { key: "invoice_number", label: "Invoice" },
    { key: "issue_date", label: "Invoice Date" },
    { key: "due_date", label: "Due Date" },
    {
      key: "amount",
      label: "Amount",
      render: (r) => formatInr(r.amount),
    },
    {
      key: "paid",
      label: "Paid",
      render: (r) => formatInr(r.paid),
    },
    {
      key: "balance",
      label: "Balance",
      render: (r) => formatInr(r.balance),
    },
    { key: "days_overdue", label: "Days Overdue" },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(r.status)}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: "action",
      label: "",
      render: (r) => (
        <Link to={invoiceDetailLink(r.id)} className="text-xs font-semibold text-[var(--color-action-teal)] hover:underline">
          View
        </Link>
      ),
    },
  ];

  const apColumns = [
    { key: "vendor_name", label: "Vendor" },
    { key: "bill_number", label: "Bill" },
    { key: "invoice_date", label: "Bill Date" },
    { key: "due_date", label: "Due Date" },
    {
      key: "amount",
      label: "Amount",
      render: (r) => formatInr((r.amount || 0) + (r.gst || 0)),
    },
    {
      key: "paid",
      label: "Paid",
      render: (r) => formatInr(r.paid),
    },
    {
      key: "balance",
      label: "Balance",
      render: (r) => formatInr(r.balance),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(r.status)}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: "action",
      label: "",
      render: () => (
        <Link to={payablesLink("open")} className="text-xs font-semibold text-[var(--color-action-teal)] hover:underline">
          View
        </Link>
      ),
    },
  ];

  const invoiceStatusRows = [
    { key: "draft", label: "Draft", count: invoiceSummary.draft, link: invoicesLink({ invoiceStatus: "active" }) },
    { key: "sent", label: "Sent (unpaid)", count: invoiceSummary.sent, link: invoicesLink({ payment: "unpaid" }) },
    { key: "partially_paid", label: "Partially paid", count: invoiceSummary.partially_paid, link: invoicesLink({ payment: "partial" }) },
    { key: "paid", label: "Paid", count: invoiceSummary.paid, link: invoicesLink({ payment: "paid" }) },
    { key: "overdue", label: "Overdue", count: invoiceSummary.overdue, link: receivablesLink("overdue") },
    { key: "cancelled", label: "Cancelled", count: invoiceSummary.cancelled, link: invoicesLink({ invoiceStatus: "cancelled" }) },
  ];

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Accounts Dashboard"
        subtitle="Your accounting work control center — receivables, payables, cash, and what needs attention today."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Calendar className="h-3.5 w-3.5" aria-hidden />
              FY {data?.financial_year || "—"}
              {data?.as_of_date ? ` · ${data.as_of_date}` : ""}
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </Button>
            <Link to={ACCOUNTS_ROUTES.settings}>
              <Button type="button" variant="secondary">Settings</Button>
            </Link>
            <DashboardReportExport
              title="Accounts Dashboard"
              filename="accounts-dashboard"
              rows={accountsExportRows}
              disabled={failed && !data}
              module="accounts"
            />
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Last refresh failed: {error}. Showing previous data where available.
        </div>
      ) : null}

      <div className="ui-grid-kpi">
        {kpiItems.map((k) => (
          <Link key={k.label} to={k.to} className="block transition hover:opacity-95">
            <KpiCard label={k.label} value={k.value} icon={k.icon} color={k.color} tone={k.tone} meta={k.meta} />
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="Cash flow today">
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <div className="rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
              <p className="text-xs text-slate-500">Money in</p>
              <p className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                {moneyOrDash(cashToday.money_in, failed)}
              </p>
            </div>
            <div className="rounded-lg bg-rose-50 px-3 py-2 dark:bg-rose-950/30">
              <p className="text-xs text-slate-500">Money out</p>
              <p className="text-lg font-bold text-rose-800 dark:text-rose-200">
                {moneyOrDash(cashToday.money_out, failed)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">Net</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {moneyOrDash(cashToday.net, failed)}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Cash & bank accounts"
          action={
            <Link to={ACCOUNTS_ROUTES.ledger} className="text-xs font-semibold text-[var(--color-action-teal)] hover:underline">
              Open ledger
            </Link>
          }
        >
          {(data?.bank_accounts || []).length === 0 ? (
            <EmptyState title="No cash/bank accounts" description="Add bank or cash accounts in Chart of Accounts or Ledger." className="py-8" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data.bank_accounts || []).map((acc) => (
                <li key={`${acc.code || acc.id}-${acc.name}`}>
                  <Link
                    to={ledgerAccountLink(acc.name)}
                    className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-100">{acc.name}</span>
                    <span className="font-semibold tabular-nums">{formatInr(acc.balance)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Pending work">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {(data?.pending_work || []).map((item) => (
              <li key={item.id}>
                <Link
                  to={item.href}
                  className="flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                  <span className="text-xs text-slate-500">
                    {item.count != null ? `${item.count} items` : "Open"}
                    {item.amount != null ? ` · ${formatInr(item.amount)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        title="Receivables"
        action={
          <Link to={receivablesLink()} className="text-xs font-semibold text-[var(--color-action-teal)] hover:underline">
            View all
          </Link>
        }
      >
        {(data?.receivables || []).length === 0 ? (
          <EmptyState title="No open receivables" description="Customer invoices with a balance will appear here." className="py-8" />
        ) : (
          <DataTable columns={arColumns} data={data.receivables} searchPlaceholder="" searchKeys={[]} />
        )}
      </SectionCard>

      <SectionCard
        title="Payables"
        action={
          <Link to={payablesLink()} className="text-xs font-semibold text-[var(--color-action-teal)] hover:underline">
            View all
          </Link>
        }
      >
        {(data?.payables || []).length === 0 ? (
          <EmptyState title="No open payables" description="Vendor bills and purchase obligations will appear here." className="py-8" />
        ) : (
          <DataTable columns={apColumns} data={data.payables} searchPlaceholder="" searchKeys={[]} />
        )}
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Invoice summary">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {invoiceStatusRows.map((row) => (
              <li key={row.key}>
                <Link
                  to={row.link}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <span>{row.label}</span>
                  <span className="font-semibold tabular-nums">{failed ? "—" : row.count ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Today's activity">
          {(data?.recent_activity || []).length === 0 ? (
            <EmptyState title="No recent activity" description="Payments, invoices, and journals from your company will show here." className="py-8" />
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {(data.recent_activity || []).map((ev, idx) => (
                <li key={`${ev.kind}-${ev.reference}-${idx}`} className="px-4 py-2.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{ev.label}</p>
                      <p className="text-xs capitalize text-slate-500">
                        {String(ev.kind || "").replace(/_/g, " ")} · {ev.date || "—"}
                      </p>
                    </div>
                    {ev.amount != null ? (
                      <span className="shrink-0 font-semibold tabular-nums">{formatInr(ev.amount)}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {data?.features?.expenses ? (
        <SectionCard
          title="Expenses this month"
          action={
            <Link to={ACCOUNTS_ROUTES.expenses} className="text-xs font-semibold text-[var(--color-action-teal)] hover:underline">
              View expenses
            </Link>
          }
        >
          <div className="flex flex-wrap gap-6 p-4 text-sm">
            <div>
              <p className="text-slate-500">Recorded amount</p>
              <p className="text-xl font-bold">{moneyOrDash(data?.expense_summary?.month_total, failed)}</p>
            </div>
            <div>
              <p className="text-slate-500">Voucher count</p>
              <p className="text-xl font-bold">{failed ? "—" : data?.expense_summary?.month_count ?? 0}</p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {data?.features?.bank_reconciliation ? (
        <div className="flex justify-end">
          <Link to={ACCOUNTS_ROUTES.bankRecon} className="text-sm font-semibold text-[var(--color-action-teal)] hover:underline">
            Open bank reconciliation →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
