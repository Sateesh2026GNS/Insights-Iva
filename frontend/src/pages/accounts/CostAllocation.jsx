import { useEffect, useState, useCallback } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Plus, Layers, Award, ShieldAlert, X } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import FinanceFilters from "../../components/finance/FinanceFilters";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getExtendedReports } from "../../api/accountsApi";
import { formatInr } from "../../data/financeMasterData";
import KpiCard from "../../components/common/KpiCard";
import Button from "../../components/common/Button";

import { inputMtClass as inputClass } from "../../design-system/classes";
const COST_ALLOCATION_STORAGE_KEY = "cost-allocation-local-entries";

const readStoredAllocations = () => {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(COST_ALLOCATION_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function CostAllocation() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [financialYear, setFinancialYear] = useState("2026-27");
  const [month, setMonth] = useState("All Months");
  const [search, setSearch] = useState("");
  const [allocations, setAllocations] = useState([]);
  const [localEntries, setLocalEntries] = useState(() => readStoredAllocations());

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getExtendedReports(financialYear, month);
      const backendList = res?.data?.cost_allocations || res?.data?.data?.cost_allocations || [];
      const mergedList = [
        ...(Array.isArray(localEntries) ? localEntries : []),
        ...(Array.isArray(backendList) ? backendList : []),
      ];
      setAllocations(mergedList);
    } catch (error) {
      console.error("CostAllocation load failed", error);
      setAllocations(Array.isArray(localEntries) ? localEntries : []);
      if (!isRefresh) addToast("Failed to load Cost Center Allocation data", "error");
      if (isRefresh) throw error;
    } finally {
      setLoading(false);
    }
  }, [financialYear, month, addToast, localEntries]);

  usePageRefresh(() => load(true));

  useEffect(() => { load(); }, [load]);

  const [modalOpen, setModalOpen] = useState(false);
  const [newAlloc, setNewAlloc] = useState({
    expense: "",
    ratio: "",
    dept: "Production",
    amount: "",
    date: new Date().toISOString().split("T")[0]
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const amountValue = Number(newAlloc.amount);
    const ratioValue = Number(newAlloc.ratio);
    const entry = {
      id: `local-${Date.now()}`,
      date: newAlloc.date || new Date().toISOString().split("T")[0],
      expense: newAlloc.expense.trim(),
      dept: newAlloc.dept,
      ratio: Number.isFinite(ratioValue) ? ratioValue : 0,
      amount: Number.isFinite(amountValue) ? amountValue : 0,
    };

    const nextEntries = [entry, ...(Array.isArray(localEntries) ? localEntries : [])];
    setLocalEntries(nextEntries);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COST_ALLOCATION_STORAGE_KEY, JSON.stringify(nextEntries));
    }
    setAllocations((prev) => [entry, ...prev]);
    setModalOpen(false);
    setNewAlloc({
      expense: "",
      ratio: "",
      dept: "Production",
      amount: "",
      date: new Date().toISOString().split("T")[0]
    });
    addToast("Cost allocation added and saved for this browser", "success");
  };

  const filtered = allocations.filter((a) =>
    a.expense.toLowerCase().includes(search.toLowerCase()) ||
    a.dept.toLowerCase().includes(search.toLowerCase())
  );

  const totalAllocated = filtered.reduce((s, a) => s + a.amount, 0);

  const deptSummary = filtered.reduce((acc, curr) => {
    const existing = acc.find((item) => item.name === curr.dept);
    if (existing) {
      existing.value += curr.amount;
    } else {
      acc.push({ name: curr.dept, value: curr.amount });
    }
    return acc;
  }, []);

  const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#8B5CF6"];

  if (loading) return <Loader label="Loading Cost Allocations..." />;

  return (
    <div className="space-y-5 pb-4">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ui-subtitle font-medium">Allocate indirect overhead and general expense vouchers across organizational departments.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="add" onClick={() => setModalOpen(true)} leftIcon={<Plus className="h-4 w-4" aria-hidden />}>
            New Allocation
          </Button>
        </div>
      </header>

      <div className="ui-grid-kpi">
        <KpiCard label="Total Allocated Overhead" value={formatInr(totalAllocated)} icon={Layers} color="bg-[var(--color-primary)]" />
        <KpiCard label="Production cost Center Share" value={formatInr(filtered.filter((a) => a.dept === "Production").reduce((s, a) => s + a.amount, 0))} icon={Award} color="bg-green-600" />
        <KpiCard label="General overhead Cost Center" value={formatInr(filtered.filter((a) => a.dept !== "Production").reduce((s, a) => s + a.amount, 0))} icon={ShieldAlert} color="bg-amber-50" />
      </div>

      <FinanceFilters
        search={search}
        onSearchChange={setSearch}
        financialYear={financialYear}
        onFinancialYearChange={setFinancialYear}
        month={month}
        onMonthChange={setMonth}
        searchPlaceholder="Search"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50/50">
            <h2 className="font-bold text-slate-800">Direct Overhead Posting Ledger</h2>
          </div>
          <div className="ui-table-wrap ui-table-wrap--scroll !rounded-none !border-0">
            <table className="ui-table w-full text-sm">
              <thead className="ui-table-head">
                <tr>
                  <th className="p-3">Posting Date</th>
                  <th className="p-3">Expense Voucher Item</th>
                  <th className="p-3">Allocated Center</th>
                  <th className="p-3 text-center">Ratio (%)</th>
                  <th className="p-3 text-right">Allocated Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="p-3 text-slate-600">{a.date}</td>
                    <td className="p-3 text-slate-900 font-semibold">{a.expense}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                        {a.dept}
                      </span>
                    </td>
                    <td className="p-3 text-center text-slate-600 font-semibold">{a.ratio}%</td>
                    <td className="p-3 text-right text-slate-900 font-bold tabular-nums">{formatInr(a.amount)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center p-6 text-slate-400">
                      No cost allocations found for the selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ui-card p-5">
          <h2 className="ui-section-title mb-4">Cost Center Distribution</h2>
          <div className="h-64">
            {deptSummary.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={deptSummary} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name }) => name}>
                    {deptSummary.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatInr(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-slate-400">No department cost allocation logs</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Allocation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create Cost Allocation</h3>
                <p className="text-xs text-slate-500 mt-0.5">Distribute overhead costs and expenses to operational cost centers.</p>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Posting Date *</label>
                  <input
                    type="date"
                    required
                    value={newAlloc.date}
                    onChange={(e) => setNewAlloc((prev) => ({ ...prev, date: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Allocated Center *</label>
                  <select
                    value={newAlloc.dept}
                    onChange={(e) => setNewAlloc((prev) => ({ ...prev, dept: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="Production">Production</option>
                    <option value="R&D">R&D</option>
                    <option value="Admin">Admin</option>
                    <option value="Sales">Sales</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Expense Description / Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Headquarters High-Speed Broadband Bill"
                  value={newAlloc.expense}
                  onChange={(e) => setNewAlloc((prev) => ({ ...prev, expense: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Overhead Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="50000"
                    value={newAlloc.amount}
                    onChange={(e) => setNewAlloc((prev) => ({ ...prev, amount: e.target.value }))}
                    className={`${inputClass} text-right`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Allocation Share (%) *</label>
                  <input
                    type="number"
                    required
                    placeholder="50"
                    value={newAlloc.ratio}
                    onChange={(e) => setNewAlloc((prev) => ({ ...prev, ratio: e.target.value }))}
                    className={`${inputClass} text-center`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Allocate Cost
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

