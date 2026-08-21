import { useEffect, useState, useCallback } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Plus, Search, Layers, Shield, X } from "lucide-react";
import FinanceFilters from "../../components/finance/FinanceFilters";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getExtendedReports, createGLAccount } from "../../api/accountsApi";
import { formatInr } from "../../data/financeMasterData";
import PageHeader from "../../components/common/PageHeader";

import { inputMtClass as inputClass } from "../../design-system/classes";

export default function ChartOfAccounts() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);      // initial page load
  const [refreshing, setRefreshing] = useState(false); // button-only spinner
  const [financialYear, setFinancialYear] = useState("2026-27");
  const [month, setMonth] = useState("All Months");
  const [branch, setBranch] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("Assets");
  const [accounts, setAccounts] = useState([]);

  const load = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getExtendedReports(financialYear, month, branch);
      if (res.data && res.data.trial_balance_accounts) {
        const typeMap = { Asset: "Assets", Liability: "Liabilities", Equity: "Equity", Revenue: "Revenue", Expense: "Expenses" };
        const parentMap = { Asset: "Current Assets", Liability: "Current Liabilities", Equity: "Equity", Revenue: "Revenue", Expense: "Operating Cost" };
        const mapped = res.data.trial_balance_accounts.map((tb) => ({
          code: tb.code,
          name: tb.name,
          parent: tb.parent || parentMap[tb.category] || tb.category,
          type: typeMap[tb.category] || tb.category,
          balance: ["Liability", "Equity", "Revenue"].includes(tb.category)
            ? (tb.credit - tb.debit)
            : (tb.debit - tb.credit),
          status: tb.status || "Active"
        }));
        setAccounts(mapped);
      }
    } catch {
      addToast("Failed to load Chart of Accounts data", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [financialYear, month, branch, addToast]);

  usePageRefresh(load);

  useEffect(() => { load(); }, [load]);

  const [modalOpen, setModalOpen] = useState(false);
  const [newAcc, setNewAcc] = useState({
    code: "",
    name: "",
    parent: "Current Assets",
    type: "Assets",
    balance: 0,
    status: "Active"
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createGLAccount(newAcc);
      if (res.data && res.data.status === "error") {
        addToast(res.data.message || "Failed to create account", "error");
        setLoading(false);
        return;
      }
      addToast("GL Account added successfully!", "success");
      setModalOpen(false);
      setNewAcc({
        code: "",
        name: "",
        parent: "Current Assets",
        type: "Assets",
        balance: 0,
        status: "Active"
      });
      load();
    } catch {
      addToast("Failed to create GL Account", "error");
      setLoading(false);
    }
  };

  const tabs = ["Assets", "Liabilities", "Equity", "Revenue", "Expenses"];

  const filtered = accounts.filter((a) => {
    if (a.type !== activeTab) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.code.includes(search)) return false;
    return true;
  });

  if (loading) return <Loader label="Loading Chart of Accounts..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="Configure and manage General Ledger account structure codes and classifications."
        action={
          <>
            
          </>
        }
      />

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

      <div className="flex border-b border-slate-200 bg-slate-50/50 rounded-t-xl p-1.5 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
              activeTab === tab
                ? "bg-white text-[var(--color-primary)] shadow-sm font-bold border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="rounded-b-2xl border border-t-0 border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b text-slate-500 text-left font-semibold">
                <th className="p-3">Account Code</th>
                <th className="p-3">Account Name</th>
                <th className="p-3">Parent Group</th>
                <th className="p-3">Class Type</th>
                <th className="p-3 text-right">Current balance</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((a) => (
                <tr key={a.code} className="hover:bg-slate-50/50">
                  <td className="p-3 font-semibold text-slate-700">{a.code}</td>
                  <td className="p-3 text-slate-900 font-medium">{a.name}</td>
                  <td className="p-3 text-slate-600">{a.parent}</td>
                  <td className="p-3 text-slate-500">{a.type}</td>
                  <td className="p-3 text-right text-slate-800 font-bold tabular-nums">{formatInr(a.balance)}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                      a.status === "Active"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : a.status === "Suspended"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}>
                      {a.status || "Active"}
                    </span>
                  </td>

                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center p-6 text-slate-400">
                    No ledger structures registered under {activeTab} group
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Account Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add New GL Account</h3>
                <p className="text-xs text-slate-500 mt-0.5">Define a General Ledger account entry in the chart of accounts.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Account Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1005"
                    value={newAcc.code}
                    onChange={(e) => setNewAcc((prev) => ({ ...prev, code: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Class Type</label>
                  <select
                    value={newAcc.type}
                    onChange={(e) => setNewAcc((prev) => ({ ...prev, type: e.target.value }))}
                    className={inputClass}
                  >
                    {tabs.map((tab) => <option key={tab} value={tab}>{tab}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Account Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Petty Cash Account"
                  value={newAcc.name}
                  onChange={(e) => setNewAcc((prev) => ({ ...prev, name: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Parent Group *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Current Assets"
                    value={newAcc.parent}
                    onChange={(e) => setNewAcc((prev) => ({ ...prev, parent: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Current Balance (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newAcc.balance || ""}
                    onChange={(e) => setNewAcc((prev) => ({ ...prev, balance: e.target.value }))}
                    className={`${inputClass} text-right`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
                  <select
                    value={newAcc.status}
                    onChange={(e) => setNewAcc((prev) => ({ ...prev, status: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] shadow-sm transition-all"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
