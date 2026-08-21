import { useEffect, useState, useCallback } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Download, Layers, Building2, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import FinanceFilters from "../../components/finance/FinanceFilters";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getExtendedReports } from "../../api/accountsApi";
import { formatInr } from "../../data/financeMasterData";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

export default function MultiBranchLedger() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [financialYear, setFinancialYear] = useState("2026-27");
  const [month, setMonth] = useState("All Months");
  const [branch, setBranch] = useState("");
  const [search, setSearch] = useState("");
  const [postings, setPostings] = useState([]);
  const [branchData, setBranchData] = useState([]);
  const [summary, setSummary] = useState({ revenue: 0, expenses: 0 });

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getExtendedReports(financialYear, month, branch);
      if (res.data) {
        setPostings(res.data.journal_entries || []);


        
        // Calculate dynamic branch breakdowns
        const hoPostings = (res.data.journal_entries || []).filter((p) => p.branch === "Head Office");
        const plPostings = (res.data.journal_entries || []).filter((p) => p.branch === "Plant-1");

        const hoRev = hoPostings.filter((p) => p.id.includes("INC")).reduce((s, x) => s + x.debit, 0);
        const hoExp = hoPostings.filter((p) => p.id.includes("EXP")).reduce((s, x) => s + x.debit, 0);
        
        const plRev = plPostings.filter((p) => p.id.includes("INC")).reduce((s, x) => s + x.debit, 0);
        const plExp = plPostings.filter((p) => p.id.includes("EXP")).reduce((s, x) => s + x.debit, 0);

        setBranchData([
          { name: "Head Office", revenue: hoRev, expenses: hoExp, profit: hoRev - hoExp },
          { name: "Plant-1", revenue: plRev, expenses: plExp, profit: plRev - plExp },
        ]);
        setSummary({
          revenue: hoRev + plRev,
          expenses: hoExp + plExp
        });
      }
    } catch {
      addToast("Failed to load Multi-Branch Ledger data", "error");
    } finally {
      setLoading(false);
    }
  }, [financialYear, month, branch, addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => { load(); }, [load]);

  const filtered = postings.filter((p) => {
    if (branch && p.branch !== branch) return false;
    if (search && !p.desc.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalDebit = filtered.reduce((s, p) => s + p.debit, 0);
  const totalCredit = filtered.reduce((s, p) => s + p.credit, 0);

  if (loading) return <Loader label="Loading Multi-Branch Ledger..." />;

  const hasBranchData = branchData.some((b) => b.revenue > 0 || b.expenses > 0);
  const consolidatedRev = branchData.reduce((s, b) => s + b.revenue, 0) || 0;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader subtitle="Consolidated posting logs and branch-level financial comparison dashboard." />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Consolidated Revenue" value={formatInr(summary.revenue)} icon={Building2} color="bg-[var(--color-primary)]" />
        <KpiCard label="Total Consolidated Expenses" value={formatInr(summary.expenses)} icon={TrendingDown} color="bg-red-500" />
        <KpiCard label="Consolidated Net Profit" value={formatInr(summary.revenue - summary.expenses)} icon={TrendingUp} color="bg-green-600" />
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="ui-section-title mb-4">Branch Performance Comparison</h2>
          <div className="h-64">
            {hasBranchData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => formatInr(v)} />
                  <Tooltip formatter={(v) => formatInr(v)} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Net Profit" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <svg className="h-10 w-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-sm text-slate-400">No branch data available — journal entries will populate this chart</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="mb-4 font-semibold text-slate-900 border-b pb-2">Branch Contribution Share</h2>
            {hasBranchData && consolidatedRev > 0 ? (
              <div className="space-y-4">
                {branchData.map((b) => (
                  <div key={b.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-slate-700">{b.name}</span>
                      <span className="font-bold text-blue-600">{((b.revenue / consolidatedRev) * 100).toFixed(0)}% contribution</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-[var(--color-primary)] h-full" style={{ width: `${(b.revenue / consolidatedRev) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 mt-2">No branch revenue data to display</p>
            )}
          </div>
          <div className="mt-6 border-t pt-4 text-xs text-slate-500">
            * Figures are extracted from general ledger entries matching active filter periods.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50/50 flex justify-between items-center">
          <h2 className="font-bold text-slate-800">Consolidated General Ledger Postings</h2>
          <span className="text-xs text-slate-500">Showing {filtered.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b text-slate-500 text-left font-semibold">
                <th className="p-3">Date</th>
                <th className="p-3">Branch</th>
                <th className="p-3">Ledger Account</th>
                <th className="p-3">Narration / Description</th>
                <th className="p-3 text-right">Debit (₹)</th>
                <th className="p-3 text-right">Credit (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => {
                const legDr = p.legs.find((l) => l.debit > 0) || { account: "" };
                const legCr = p.legs.find((l) => l.credit > 0) || { account: "" };
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="p-3 text-slate-700 font-medium">{p.date}</td>
                    <td className="p-3 text-slate-600 font-semibold">{p.branch}</td>
                    <td className="p-3 text-slate-900 font-medium">
                      <div>{legDr.account}</div>
                      <div className="text-xs text-slate-400">To {legCr.account}</div>
                    </td>
                    <td className="p-3 text-slate-600">{p.desc}</td>
                    <td className="p-3 text-right text-slate-900 font-bold tabular-nums">{formatInr(p.debit)}</td>
                    <td className="p-3 text-right text-slate-900 font-bold tabular-nums">{formatInr(p.credit)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center p-6 text-slate-400">
                    No general ledger postings matching active filters
                  </td>
                </tr>
              )}
              <tr className="bg-blue-50/50 font-bold text-slate-800">
                <td colSpan={4} className="p-3 text-right">Total Summary:</td>
                <td className="p-3 text-right text-blue-700">{formatInr(totalDebit)}</td>
                <td className="p-3 text-right text-indigo-700">{formatInr(totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

