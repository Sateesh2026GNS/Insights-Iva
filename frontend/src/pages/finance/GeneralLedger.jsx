import { useCallback, useEffect, useMemo, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { BookOpen, Building2, IndianRupee, Landmark, Scale, TrendingUp } from "lucide-react";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import DataTable from "../../components/common/DataTable";
import FinanceFilters from "../../components/finance/FinanceFilters";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getGLEnriched, getGLSummary } from "../../api/accountsApi";
import { COST_CENTERS, GL_PLANNED_FEATURES, formatInr } from "../../data/financeMasterData";


export default function GeneralLedger() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total_assets: 0, total_liabilities: 0, equity: 0,
    revenue: 0, expenses: 0, cash_balance: 0,
  });
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [financialYear, setFinancialYear] = useState("2025-26");
  const [month, setMonth] = useState("All Months");
  const [branch, setBranch] = useState("");
  const [costCenter, setCostCenter] = useState("");

  const EMPTY_GL_SUMMARY = {
    total_assets: 0, total_liabilities: 0, equity: 0,
    revenue: 0, expenses: 0, cash_balance: 0,
  };

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.allSettled([getGLSummary(), getGLEnriched()]);


      // Use API data only — no localStorage fallback
      if (listRes.status === "fulfilled" && listRes.value?.data?.length) {
        setRows(listRes.value.data);
      } else {
        setRows([]);
      }

      if (sumRes.status === "fulfilled" && sumRes.value?.data) {
        setSummary({ ...EMPTY_GL_SUMMARY, ...sumRes.value.data });
      } else {
        setSummary(EMPTY_GL_SUMMARY);
      }
    } catch {
      setRows([]);
      setSummary(EMPTY_GL_SUMMARY);
      addToast("Failed to load general ledger data", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return rows.filter((r) => {
      if (q && ![r.voucher_no, r.account, r.narration].some((v) => String(v || "").toLowerCase().includes(q))) return false;

      const rowBranch = r.branch || (r.id % 2 === 0 ? "Head Office" : "Plant-1");
      if (branch && rowBranch !== branch) return false;
      if (costCenter && r.cost_center && r.cost_center !== costCenter) return false;

      if (!r.entry_date) return true;
      const d = new Date(r.entry_date);
      if (isNaN(d.getTime())) return true;

      if (financialYear && financialYear !== "All Years") {
        const startYear = parseInt(financialYear.split("-")[0], 10);
        if (d < new Date(startYear, 3, 1) || d > new Date(startYear + 1, 2, 31, 23, 59, 59)) return false;
      }
      if (month && month !== "All Months") {
        const mi = monthNames.indexOf(month);
        if (mi !== -1 && d.getMonth() !== mi) return false;
      }
      return true;
    });
  }, [rows, search, branch, costCenter, financialYear, month]);

  const columns = [
    { key: "voucher_no", label: "Voucher No" },
    { key: "entry_date", label: "Date", render: (r) => String(r.entry_date || "").slice(0, 10) },
    { key: "account", label: "Account" },
    { key: "debit", label: "Debit", render: (r) => r.debit ? formatInr(r.debit) : "—" },
    { key: "credit", label: "Credit", render: (r) => r.credit ? formatInr(r.credit) : "—" },
    { key: "balance", label: "Balance", render: (r) => formatInr(r.balance) },
    { key: "narration", label: "Narration" },
    { key: "cost_center", label: "Cost Center" },
    { key: "branch", label: "Branch" },
  ];

  if (loading) return <Loader label="Loading general ledger..." />;

  const hasData = rows.length > 0;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader subtitle="Central accounting ledger — vouchers, journal entries, and cost center allocation." />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Assets" value={formatInr(summary.total_assets)} icon={Building2} color="bg-[var(--color-success)]" />
        <KpiCard label="Total Liabilities" value={formatInr(summary.total_liabilities)} icon={Scale} color="bg-amber-500" />
        <KpiCard label="Equity" value={formatInr(summary.equity)} icon={Landmark} color="bg-indigo-600" />
        <KpiCard label="Revenue" value={formatInr(summary.revenue)} icon={TrendingUp} color="bg-[var(--color-success)]" />
        <KpiCard label="Expenses" value={formatInr(summary.expenses)} icon={IndianRupee} color="bg-rose-600" />
        <KpiCard label="Cash Balance" value={formatInr(summary.cash_balance)} icon={BookOpen} color="bg-cyan-600" />
      </div>

      {!hasData && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Coming Soon — Full GL Module</h2>
          <p className="mt-2 text-sm text-slate-500">Journal entries will auto-post from AP, AR, and payment workflows.</p>
          <ul className="mx-auto mt-6 grid max-w-lg gap-2 text-left text-sm text-slate-600 sm:grid-cols-2">
            {GL_PLANNED_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />{f}</li>
            ))}
          </ul>
        </div>
      )}

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
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Cost Center</label>
          <select value={costCenter} onChange={(e) => setCostCenter(e.target.value)} className="ui-input w-full">
            <option value="">All</option>
            {COST_CENTERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </FinanceFilters>

      <div className="ui-card p-4">
        <DataTable columns={columns} data={filtered} searchPlaceholder="" searchKeys={[]} />
      </div>
    </div>
  );
}
