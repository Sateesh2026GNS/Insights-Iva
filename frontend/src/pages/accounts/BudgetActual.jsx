import { useEffect, useState, useCallback } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { TrendingUp, HelpCircle, FileSpreadsheet, ShieldAlert, Plus, X, Edit2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import FinanceFilters from "../../components/finance/FinanceFilters";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getInvoices } from "../../api/salesApi";
import { formatInr } from "../../data/financeMasterData";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

const STORAGE_KEY = "smrt_budget_targets";
const CATEGORIES  = ["Sales Revenue", "Cost of Goods Sold", "Operating Expenses", "Marketing", "HR & Payroll", "Admin & Overhead", "Other Income"];

import { inputMtClass as inputClass } from "../../design-system/classes";

// Load saved budgets from localStorage
function loadSavedBudgets() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

export default function BudgetActual() {
  const { addToast } = useToast();
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [financialYear, setFinancialYear] = useState("2026-27");
  const [month,  setMonth]  = useState("All Months");
  const [branch, setBranch] = useState("");
  const [search, setSearch] = useState("");

  // Budget targets (user-set, persisted to localStorage)
  const [budgetTargets, setBudgetTargets] = useState(loadSavedBudgets);

  // Actual spending per category (from real API)
  const [actuals, setActuals] = useState({});

  // Set Budget modal
  const [modalOpen, setModalOpen] = useState(false);
  const [draftTargets, setDraftTargets] = useState({});

  const load = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch real invoices from backend
      const invRes = await getInvoices();
      const invoices = Array.isArray(invRes?.data) ? invRes.data : [];

      // Expenses from localStorage (recorded via Record Expense)
      const expenses = JSON.parse(localStorage.getItem("smrt_expenses") || "[]");

      // Compute actuals by category
      const computed = {};

      // Sales Revenue = sum of all invoice grand_total
      const totalRevenue = invoices.reduce((s, i) => s + (Number(i.grand_total) || 0), 0);
      computed["Sales Revenue"] = totalRevenue;

      // COGS = sum of invoices where cost fields exist (approximate as 60% of revenue if not tagged)
      const taggedCOGS = invoices
        .filter(i => /cogs|cost of good|material/i.test(i.notes || ""))
        .reduce((s, i) => s + (Number(i.grand_total) || 0), 0);
      computed["Cost of Goods Sold"] = taggedCOGS || Math.round(totalRevenue * 0.6);

      // Expenses by category
      expenses.forEach((e) => {
        const cat = mapExpenseCategory(e.category || e.type || "");
        if (cat) computed[cat] = (computed[cat] || 0) + (Number(e.amount) || 0);
      });

      setActuals(computed);
    } catch {
      addToast("Failed to load actual data from server", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [financialYear, month, branch, addToast]);

  usePageRefresh(load);

  useEffect(() => { load(); }, [load]);

  // Map expense category strings to our standard categories
  function mapExpenseCategory(cat) {
    const c = cat.toLowerCase();
    if (/marketing|advertis|promo/i.test(c))   return "Marketing";
    if (/hr|payroll|salary|wage/i.test(c))      return "HR & Payroll";
    if (/admin|overhead|rent|util/i.test(c))    return "Admin & Overhead";
    if (/operat|general/i.test(c))              return "Operating Expenses";
    return "Operating Expenses";
  }

  // Build merged budget vs actual rows
  const budgetRows = CATEGORIES.map((cat) => {
    const budget   = Number(budgetTargets[cat] || 0);
    const actual   = Number(actuals[cat] || 0);
    const variance = budget - actual;
    return { category: cat, budget, actual, variance };
  }).filter((r) => r.budget > 0 || r.actual > 0);

  const filtered = budgetRows.filter((b) =>
    b.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalBudget   = filtered.reduce((s, b) => s + b.budget, 0);
  const totalActual   = filtered.reduce((s, b) => s + b.actual, 0);
  const totalVariance = totalBudget - totalActual;
  const budgetPct     = totalBudget > 0 ? ((totalVariance / totalBudget) * 100).toFixed(1) : "0.0";

  // Open "Set Budget" modal
  const openModal = () => {
    setDraftTargets({ ...budgetTargets });
    setModalOpen(true);
  };

  const saveBudgets = () => {
    const cleaned = {};
    Object.entries(draftTargets).forEach(([k, v]) => {
      const n = Number(v);
      if (n > 0) cleaned[k] = n;
    });
    setBudgetTargets(cleaned);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    setModalOpen(false);
    addToast("Budget targets saved successfully!", "success");
  };

  if (loading) return <Loader label="Loading Budget vs Actual..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader subtitle="Monitor departmental budget targets against real spending data." />

      {/* KPI Cards */}
      <div className="ui-grid-kpi">
        <KpiCard label="Total Budget Target" value={formatInr(totalBudget)} icon={FileSpreadsheet} color="bg-[var(--color-primary)]" />
        <KpiCard label="Total Actual Spending" value={formatInr(totalActual)} icon={TrendingUp} color="bg-indigo-600" />
        <KpiCard label="Consolidated Variance" value={formatInr(Math.abs(totalVariance))} icon={HelpCircle}
          color={totalVariance >= 0 ? "bg-green-600" : "bg-red-500"}
          sub={totalVariance >= 0 ? "Under budget ✓" : "Over budget ✗"} />
        <KpiCard label="Variance %" value={`${Math.abs(budgetPct)}%`} icon={ShieldAlert} color="bg-amber-500"
          sub={totalBudget === 0 ? "Set budget targets →" : undefined} />
      </div>

      {/* Prompt if no budgets set */}
      {Object.keys(budgetTargets).length === 0 && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-blue-800">No budget targets set yet</p>
            <p className="text-xs text-blue-600 mt-0.5">Click "Set Budget Targets" to enter monthly/annual targets for each category. Actuals are pulled from your real invoice and expense data.</p>
          </div>
          <button onClick={openModal}
            className="ml-4 shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)]">
            <Plus className="h-3.5 w-3.5" /> Set Targets
          </button>
        </div>
      )}

      <FinanceFilters
        search={search} onSearchChange={setSearch}
        financialYear={financialYear} onFinancialYearChange={setFinancialYear}
        month={month} onMonthChange={setMonth}
        branch={branch} onBranchChange={setBranch}
        searchPlaceholder="Search"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Table */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50/50">
            <h2 className="font-bold text-slate-800">Operational Variance Audit Ledger</h2>
            <p className="text-xs text-slate-400 mt-0.5">Actuals from real invoices &amp; expenses • Budgets set by you</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-slate-500 text-left font-semibold">
                  <th className="p-3">Cost Category</th>
                  <th className="p-3 text-right">Budget Target (₹)</th>
                  <th className="p-3 text-right">Actual (₹)</th>
                  <th className="p-3 text-right">Variance (₹)</th>
                  <th className="p-3 text-center">Variance %</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((b) => {
                  const pct = b.budget > 0 ? ((b.variance / b.budget) * 100).toFixed(0) : "—";
                  return (
                    <tr key={b.category} className="hover:bg-slate-50/50">
                      <td className="p-3 text-slate-900 font-semibold">{b.category}</td>
                      <td className="p-3 text-right text-slate-700 tabular-nums">
                        {b.budget > 0 ? formatInr(b.budget) : <span className="text-slate-300 text-xs italic">not set</span>}
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-800 tabular-nums">{formatInr(b.actual)}</td>
                      <td className={`p-3 text-right font-bold tabular-nums ${b.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {b.budget > 0 ? (b.variance >= 0 ? "+" : "") + formatInr(b.variance) : "—"}
                      </td>
                      <td className="p-3 text-center">
                        {b.budget > 0 ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            b.variance >= 0 ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                          }`}>
                            {pct}%
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-slate-400">
                      <p>No data yet.</p>
                      <p className="text-xs mt-1">Set budget targets and record invoices/expenses to see comparisons.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bar chart */}
        <div className="ui-card p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Budget vs Actual</h2>
          <p className="text-xs text-slate-400 mb-4">Per category comparison</p>
          <div className="h-64">
            {filtered.filter(b => b.budget > 0 || b.actual > 0).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filtered} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fontSize: 8 }} angle={-20} textAnchor="end" height={40} />
                  <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => formatInr(v)} />
                  <Legend />
                  <Bar dataKey="budget" name="Budget" fill="#94A3B8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" name="Actual" fill="#2563EB" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                <ShieldAlert className="h-8 w-8 opacity-30" />
                <p className="text-sm">Set budget targets to see chart</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Set Budget Targets Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Set Budget Targets</h3>
                <p className="text-xs text-slate-500 mt-0.5">Enter annual/monthly budget targets per category. Actuals come from your real data.</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {CATEGORIES.map((cat) => (
                <div key={cat} className="flex items-center gap-3">
                  <label className="w-48 text-sm font-semibold text-slate-700 shrink-0">{cat}</label>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={draftTargets[cat] || ""}
                      onChange={(e) => setDraftTargets((prev) => ({ ...prev, [cat]: e.target.value }))}
                      className="mt-0 w-full rounded-xl border border-slate-200 bg-white pl-7 pr-4 py-2.5 text-sm text-right text-slate-800 placeholder:text-slate-300 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={saveBudgets}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] shadow-sm transition-all">
                Save Budget Targets
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

