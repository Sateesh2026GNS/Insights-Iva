import { useCallback, useEffect, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, IndianRupee, Landmark, TrendingDown, TrendingUp } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import Loader from "../../components/common/Loader";
import { getFinanceHub } from "../../api/accountsApi";
import { getInvoices, getPayments } from "../../api/salesApi";
import { FINANCE_FLOW, formatInr } from "../../data/financeMasterData";
import RecordIncome from "./RecordIncome";
import RecordExpense from "./RecordExpense";

import Button from "../../components/common/Button";

const INITIAL_FINANCE_HUB = {
  total_receivables: null,
  outstanding_payables: null,
  cash_balance: null,
  monthly_revenue: null,
  monthly_expenses: null,
  net_profit: null,
  gst_payable: null,
  cash_flow_trend: [],
  revenue_trend: [],
  expense_trend: [],
  profit_trend: [],
  gst_trend: [],
  vendor_payments: [],
  customer_receipts: [],
  monthly_cost: [],
  department_cost: [],
  manufacturing_cost: [],
  budget_vs_actual: [],
  accounts_aging: [],
  alerts: [],
};


const alertIcons = { overdue: TrendingDown, gst: Landmark, ap: ArrowDownRight, budget: AlertTriangle };

export default function AccountsDashboard() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [hub, setHub] = useState(INITIAL_FINANCE_HUB);
  const [showRecordIncome, setShowRecordIncome] = useState(false);
  const [showRecordExpense, setShowRecordExpense] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setLoading(true);
    setError(null);

    const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    // Fetch real data from backend APIs only — no localStorage fallback
    let allInv = [];
    let payments = [];

    try {
      const [invRes, payRes] = await Promise.allSettled([
        getInvoices(),
        getPayments(),
      ]);

      if (invRes.status === "fulfilled") {
        const d = invRes.value?.data ?? invRes.value ?? [];
        allInv = Array.isArray(d) ? d : [];
      }
      if (payRes.status === "fulfilled") {
        const d = payRes.value?.data ?? payRes.value ?? [];
        payments = Array.isArray(d) ? d : [];
      }
    } catch { /* ignore */ }

    // ── KPI calculations from API data only ───────────────────────
    const total_receivables = allInv.reduce((s, i) => s + (Number(i.grand_total ?? i.amount) || 0), 0);
    const gst_payable       = allInv.reduce((s, i) =>
      s + (Number(i.sgst_amount) || 0) + (Number(i.cgst_amount) || 0) + (Number(i.igst_amount) || 0), 0);
    const amount_paid       = allInv.reduce((s, i) => s + (Number(i.amount_paid) || 0), 0);

    // ── Monthly trend maps ────────────────────────────────────────
    const revMap = {}, gstMap = {};
    allInv.forEach((i) => {
      const d = new Date(i.issue_date || i.created_at || "");
      if (isNaN(d)) return;
      const k = MN[d.getMonth()];
      revMap[k] = (revMap[k] || 0) + (Number(i.grand_total ?? i.amount) || 0);
      if (!gstMap[k]) gstMap[k] = { month: k, sgst: 0, cgst: 0, igst: 0 };
      gstMap[k].sgst += Number(i.sgst_amount) || 0;
      gstMap[k].cgst += Number(i.cgst_amount) || 0;
      gstMap[k].igst += Number(i.igst_amount) || 0;
    });

    const revenue_trend   = MN.map((m) => ({ month: m, amount: revMap[m] || 0 }));
    const cash_flow_trend = MN.map((m) => ({ month: m, inflow: revMap[m] || 0, outflow: 0 }));
    const gst_trend       = MN.map((m) => gstMap[m] || { month: m, sgst: 0, cgst: 0, igst: 0 });
    const customer_receipts = payments.map((p) => ({
      month: new Date(p.payment_date || "").toLocaleDateString("en-IN", { month: "short" }) || "—",
      amount: Number(p.amount) || 0,
    }));

    const computed = {
      total_receivables,
      outstanding_payables: 0,
      cash_balance: amount_paid,
      monthly_revenue: total_receivables,
      monthly_expenses: 0,
      net_profit: total_receivables,
      gst_payable,
      cash_flow_trend,
      revenue_trend,
      expense_trend: MN.map((m) => ({ month: m, amount: 0 })),
      profit_trend:  MN.map((m) => ({ month: m, amount: revMap[m] || 0 })),
      gst_trend,
      vendor_payments: [],
      customer_receipts,
      monthly_cost: [],
      department_cost: [],
      manufacturing_cost: [],
      budget_vs_actual: [],
      accounts_aging: [],
      alerts: [],
    };

    // Finance hub endpoint fills in extra data (vendor payments, expenses, aging etc.)
    try {
      const res = await getFinanceHub();
      if (res?.data) {
        setHub({
          ...computed,
          ...res.data,
          // always prefer computed trends if hub returns empty arrays
          revenue_trend:   res.data.revenue_trend?.length   ? res.data.revenue_trend   : computed.revenue_trend,
          expense_trend:   res.data.expense_trend?.length   ? res.data.expense_trend   : computed.expense_trend,
          profit_trend:    res.data.profit_trend?.length    ? res.data.profit_trend    : computed.profit_trend,
          cash_flow_trend: res.data.cash_flow_trend?.length ? res.data.cash_flow_trend : computed.cash_flow_trend,
          gst_trend:       res.data.gst_trend?.length       ? res.data.gst_trend       : computed.gst_trend,
        });
      } else {
        setHub(computed);
      }
    } catch (err) {
      if (isRefresh) throw err;
      setHub(computed);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));

  // reload on every visit (catches navigate-back after record create)
  useEffect(() => { load(); }, [load, location.key]);

  // Display layout immediately; live numbers populate when fetch resolves
  return (
    <div className="space-y-5 pb-4">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}
      <PageHeader
        subtitle="Enterprise finance hub — cash flow, revenue, expenses, GST, and manufacturing cost insights."
        action={
          <>
            <Button variant="primary" type="button" onClick={() => setShowRecordIncome(true)}>+ Record Income</Button>
            <Button variant="danger" type="button" onClick={() => setShowRecordExpense(true)}>+ Record Expense</Button>
          </>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Receivables" value={formatInr(hub.total_receivables)} icon={ArrowUpRight} color="bg-[var(--color-success)]" />
        <KpiCard label="Outstanding Payables" value={formatInr(hub.outstanding_payables)} icon={ArrowDownRight} color="bg-rose-600" />
        <KpiCard label="Cash Balance" value={formatInr(hub.cash_balance)} icon={IndianRupee} color="bg-[var(--color-success)]" />
        <KpiCard label="Monthly Revenue" value={formatInr(hub.monthly_revenue)} icon={TrendingUp} color="bg-indigo-600" />
        <KpiCard label="Monthly Expenses" value={formatInr(hub.monthly_expenses)} icon={TrendingDown} color="bg-amber-500" />
        <KpiCard label="Net Profit" value={formatInr(hub.net_profit)} icon={IndianRupee} color="bg-cyan-600" sub={`GST Payable: ${formatInr(hub.gst_payable)}`} />
      </div>

      <div className="flex flex-wrap items-center gap-1 ui-card px-4 py-3 text-[10px] font-medium text-slate-600 sm:text-xs">
        {FINANCE_FLOW.map((s, i) => (
          <span key={s} className="flex items-center gap-1">
            <span className="rounded bg-slate-50 px-1.5 py-0.5 ring-1 ring-slate-200/80">{s}</span>
            {i < FINANCE_FLOW.length - 1 && <span className="text-slate-400">↓</span>}
          </span>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Cash Flow Trend" data={hub.cash_flow_trend} lines={[{ key: "inflow", color: "#22c55e", name: "Inflow" }, { key: "outflow", color: "#ef4444", name: "Outflow" }]} />
        <ChartCard title="Revenue Trend" data={hub.revenue_trend} lines={[{ key: "amount", color: "#0f6d84", name: "Revenue" }]} />
        <ChartCard title="Expense Trend" data={hub.expense_trend} lines={[{ key: "amount", color: "#f59e0b", name: "Expenses" }]} />
        <ChartCard title="Profit Trend" data={hub.profit_trend} lines={[{ key: "amount", color: "#10b981", name: "Profit" }]} />
        <ChartCard title="GST Trend" data={hub.gst_trend} lines={[{ key: "sgst", color: "#6366f1", name: "SGST" }, { key: "cgst", color: "#8b5cf6", name: "CGST" }, { key: "igst", color: "#ec4899", name: "IGST" }]} />
        <ChartCard title="Vendor Payments" data={hub.vendor_payments} lines={[{ key: "amount", color: "#ef4444", name: "Paid" }]} />
        <ChartCard title="Customer Receipts" data={hub.customer_receipts} lines={[{ key: "amount", color: "#22c55e", name: "Received" }]} />
        <ChartCard title="Budget vs Actual" data={hub.budget_vs_actual} bars={[{ key: "budget", color: "#94a3b8", name: "Budget" }, { key: "actual", color: "#0f6d84", name: "Actual" }]} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="ui-card p-5">
          <h2 className="ui-section-title mb-4">Department Cost</h2>
          <ul className="space-y-2">
            {(hub.department_cost || []).map((d) => (
              <li key={d.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium">{d.name}</span>
                <span className="font-semibold text-[var(--color-primary)]">{formatInr(d.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="ui-card p-5">
          <h2 className="ui-section-title mb-4">Manufacturing Cost</h2>
          <ul className="space-y-2">
            {(hub.manufacturing_cost || []).map((d) => (
              <li key={d.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium">{d.name}</span>
                <span className="font-semibold text-[var(--color-primary)]">{formatInr(d.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="ui-card p-5">
        <h2 className="ui-section-title mb-4">Accounts Aging</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hub.accounts_aging || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => formatInr(v)} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatInr(v)} />
              <Bar dataKey="amount" fill="#0f6d84" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="ui-card p-5">
        <h2 className="ui-section-title mb-4">Alerts</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(hub.alerts || []).map((a, i) => {
            const Icon = alertIcons[a.type] || AlertTriangle;
            return (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm text-amber-900">{a.message}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink to="/finance/accounts-payable" label="Accounts Payable" />
        <QuickLink to="/finance/accounts-receivable" label="Accounts Receivable" />
        <QuickLink to="/finance/payment-tracking" label="Payment Tracking" />
        <QuickLink to="/finance/general-ledger" label="General Ledger" />
        <QuickLink to="/accounts/tax-reports" label="Goods & Services Tax (GST) Reports" />
        <QuickLink to="/accounts/profit-loss" label="Profit & Loss" />
        <QuickLink to="/accounts/balance-sheet" label="Balance Sheet" />
        <QuickLink to="/accounts/trial-balance" label="Trial Balance" />
        <QuickLink to="/accounts/journal-entries" label="Journal Entries" />
        <QuickLink to="/accounts/chart-of-accounts" label="Chart of Accounts" />
        <QuickLink to="/accounts/fixed-assets" label="Fixed Assets" />
        <QuickLink to="/accounts/bank-reconciliation" label="Bank Reconciliation" />
        <QuickLink to="/accounts/budget-actual" label="Budget vs Actual" />
        <QuickLink to="/accounts/cost-allocation" label="Cost Allocation" />
      </div>

      {showRecordIncome && (
        <RecordIncome onClose={() => { setShowRecordIncome(false); load(); }} />
      )}
      {showRecordExpense && (
        <RecordExpense onClose={() => { setShowRecordExpense(false); load(); }} />
      )}
    </div>
  );
}

function ChartCard({ title, data, lines, bars }) {
  return (
    <div className="ui-card p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-900">{title}</h2>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          {bars ? (
            <BarChart data={data || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => formatInr(v)} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatInr(v)} />
              <Legend />
              {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[2, 2, 0, 0]} />)}
            </BarChart>
          ) : (
            <LineChart data={data || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => formatInr(v)} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => formatInr(v)} />
              <Legend />
              {(lines || []).map((l) => <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={false} />)}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function QuickLink({ to, label }) {
  return (
    <Link
      to={to}
      className="ui-card px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
    >
      {label} →
    </Link>
  );
}
