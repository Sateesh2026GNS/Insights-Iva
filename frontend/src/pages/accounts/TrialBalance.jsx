import { useEffect, useState, useCallback } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { CheckCircle, AlertTriangle, Landmark, TrendingUp, ShieldCheck } from "lucide-react";
import FinanceFilters from "../../components/finance/FinanceFilters";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getExtendedReports } from "../../api/accountsApi";
import { formatInr } from "../../data/financeMasterData";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

export default function TrialBalance() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [financialYear, setFinancialYear] = useState("2026-27");
  const [month, setMonth] = useState("All Months");
  const [branch, setBranch] = useState("");
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getExtendedReports(financialYear, month, branch);
      if (res.data && res.data.trial_balance_accounts) {
        setAccounts(res.data.trial_balance_accounts);
      }
    } catch {
      addToast("Failed to load Trial Balance data", "error");
    } finally {
      setLoading(false);
    }
  }, [financialYear, month, branch, addToast]);

  usePageRefresh(load);

  useEffect(() => { load(); }, [load]);

  const filtered = accounts.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.code.includes(search)
  );

  const totalDebit = filtered.reduce((s, a) => s + a.debit, 0);
  const totalCredit = filtered.reduce((s, a) => s + a.credit, 0);
  const difference = Math.abs(totalDebit - totalCredit);

  if (loading) return <Loader label="Loading Trial Balance..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader subtitle="Unadjusted closing balances consolidated across assets, liabilities, equity, and operations." />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Debits" value={formatInr(totalDebit)} icon={TrendingUp} color="bg-[var(--color-primary)]" />
        <KpiCard label="Total Credits" value={formatInr(totalCredit)} icon={ShieldCheck} color="bg-indigo-600" />
        <div className={`rounded-2xl border p-4 shadow-sm ${difference < 1.0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wider ${difference < 1.0 ? "text-green-600" : "text-red-600"}`}>Difference</p>
              <p className={`mt-1 text-2xl font-bold ${difference < 1.0 ? "text-green-900" : "text-red-900"}`}>{formatInr(difference)}</p>
            </div>
            {difference < 1.0 ? (
              <CheckCircle className="h-10 w-10 text-green-500" />
            ) : (
              <AlertTriangle className="h-10 w-10 text-red-500 animate-pulse" />
            )}
          </div>
        </div>
      </div>

      <FinanceFilters
        search={search}
        onSearchChange={setSearch}
        financialYear={financialYear}
        onFinancialYearChange={setFinancialYear}
        month={month}
        onMonthChange={setMonth}
        branch={branch}
        onBranchChange={setBranch}
        searchPlaceholder="Search"
      />

      <div className="ui-table-wrap ui-table-wrap--scroll">
          <table className="ui-table w-full text-sm">
            <thead className="ui-table-head">
              <tr>
                <th className="p-3">Account Code</th>
                <th className="p-3">Account Title</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Debit Balance (₹)</th>
                <th className="p-3 text-right">Credit Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((a) => (
                <tr key={a.code} className="hover:bg-slate-50/50">
                  <td className="p-3 font-semibold text-slate-700">{a.code}</td>
                  <td className="p-3 text-slate-900 font-medium">{a.name}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.category === "Asset" ? "bg-blue-50 text-blue-700" :
                      a.category === "Liability" ? "bg-red-50 text-red-700" :
                      a.category === "Equity" ? "bg-green-50 text-green-700" :
                      a.category === "Revenue" ? "bg-purple-50 text-purple-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {a.category}
                    </span>
                  </td>
                  <td className="p-3 text-right text-slate-800 font-bold tabular-nums">{a.debit > 0 ? formatInr(a.debit) : "—"}</td>
                  <td className="p-3 text-right text-slate-800 font-bold tabular-nums">{a.credit > 0 ? formatInr(a.credit) : "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center p-6 text-slate-400">
                    No ledger balances recorded for the selected period
                  </td>
                </tr>
              )}
              <tr className="bg-blue-50/50 font-bold text-slate-800">
                <td colSpan={3} className="p-3 text-right uppercase tracking-wider">Total Consolidated:</td>
                <td className="p-3 text-right text-blue-700 tabular-nums">{formatInr(totalDebit)}</td>
                <td className="p-3 text-right text-indigo-700 tabular-nums">{formatInr(totalCredit)}</td>
              </tr>
            </tbody>
          </table>
      </div>
    </div>
  );
}

