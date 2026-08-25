import { useEffect, useState, useCallback } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Plus, Layers, Calculator, ShieldAlert, Award, FileText, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import FinanceFilters from "../../components/finance/FinanceFilters";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getExtendedReports, createFixedAsset } from "../../api/accountsApi";
import { formatInr } from "../../data/financeMasterData";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";
import Button from "../../components/common/Button";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";

import { inputMtClass as inputClass } from "../../design-system/classes";

export default function FixedAssets() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);       // initial page load
  const [refreshing, setRefreshing] = useState(false); // button-only spinner
  const [financialYear, setFinancialYear] = useState("2026-27");
  const [month, setMonth] = useState("All Months");
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState([]);

  const load = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getExtendedReports(
        financialYear,
        month === "All Months" ? undefined : month,
        undefined
      );
      if (res.data?.fixed_assets) setAssets(res.data.fixed_assets);
    } catch {
      addToast("Failed to load Fixed Assets data", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [financialYear, month, addToast]);

  usePageRefresh(() => load({ isRefresh: true }));

  useEffect(() => { load(); }, [load]);

  const [modalOpen, setModalOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({
    code: "",
    name: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    cost: "",
    accumDep: "",
    salvage: "",
    life: "",
    method: "Straight Line"
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createFixedAsset(newAsset);
      if (res.data && res.data.status === "error") {
        addToast(res.data.message || "Failed to register asset", "error");
        setLoading(false);
        return;
      }
      addToast("Fixed Asset registered successfully!", "success");
      setModalOpen(false);
      setNewAsset({
        code: "",
        name: "",
        purchaseDate: new Date().toISOString().split("T")[0],
        cost: "",
        accumDep: "",
        salvage: "",
        life: "",
        method: "Straight Line"
      });
      load();
    } catch {
      addToast("Failed to register Fixed Asset", "error");
      setLoading(false);
    }
  };

  const filtered = assets.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.code.toLowerCase().includes(search.toLowerCase())
  );

  const totalCost = filtered.reduce((s, a) => s + a.cost, 0);
  const totalDep = filtered.reduce((s, a) => s + a.accumDep, 0);
  const netValue = totalCost - totalDep;

  const currentMonthDep = filtered.reduce((s, a) => {
    const cost = a.cost || 0;
    const salvage = a.salvage || 0;
    const life = a.life || 10;
    const accumDep = a.accumDep || 0;
    const nbv = cost - accumDep;
    if (nbv <= 0) return s;
    if (a.method === "WDV (15%)") return s + (nbv * 0.15) / 12;
    if (a.method === "Double Declining") return s + (nbv * (2 / life)) / 12;
    const remaining = (cost - salvage) - accumDep;
    return s + (remaining > 0 ? (cost - salvage) / life / 12 : 0);
  }, 0);

  const baseYear = (() => {
    const parts = financialYear?.split("-");
    return parts?.length === 2 ? parseInt(parts[0], 10) : new Date().getFullYear();
  })();

  // Per-asset bar chart: Cost vs Accumulated Depreciation vs Net Book Value
  const chartData = filtered.length > 0
    ? filtered.map((a) => ({
        name: a.name.length > 14 ? a.name.slice(0, 13) + "…" : a.name,
        Cost: a.cost,
        AccumDep: a.accumDep,
        NetValue: a.cost - a.accumDep,
      }))
    : [
        { name: "No Assets", Cost: 0, AccumDep: 0, NetValue: 0 },
      ];

  if (loading) return <Loader label="Loading Fixed Assets..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="Track company capitalizations, useful lives, accumulated depreciation, and asset schedules."
        action={
          <>
            
          </>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Gross Block" value={formatInr(totalCost)} icon={Layers} color="bg-[var(--color-primary)]" />
        <KpiCard label="Accumulated Depreciation" value={formatInr(totalDep)} icon={Calculator} color="bg-red-500" />
        <KpiCard label="Net Book Value" value={formatInr(netValue)} icon={Award} color="bg-green-600" />
        <KpiCard label="Current Month Depreciation" value={formatInr(currentMonthDep)} icon={ShieldAlert} color="bg-indigo-600" />
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
            <h2 className="font-bold text-slate-800">Capital Fixed Assets Schedule</h2>
          </div>
          <div className="ui-table-wrap ui-table-wrap--scroll !rounded-none !border-0">
            <table className="ui-table w-full text-sm">
              <thead className="ui-table-head">
                <tr>
                  <SerialNumberHeader className="p-3" />
                  <th className="p-3">Asset Code</th>
                  <th className="p-3">Asset Description</th>
                  <th className="p-3">Purchased</th>
                  <th className="p-3 text-right">Cost (₹)</th>
                  <th className="p-3 text-right">Accum Dep (₹)</th>
                  <th className="p-3 text-right">Net Value (₹)</th>
                  <th className="p-3 text-center">Life</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((a, rowIndex) => (
                  <tr key={a.code} className="hover:bg-slate-50/50">
                    <SerialNumberCell rowIndex={rowIndex} className="p-3" />
                    <td className="p-3 font-semibold text-slate-700">{a.code}</td>
                    <td className="p-3 text-slate-900 font-medium">
                      <div>{a.name}</div>
                      <div className="text-[11px] text-slate-400">Method: {a.method} | Salvage: {formatInr(a.salvage)}</div>
                    </td>
                    <td className="p-3 text-slate-600">{a.purchaseDate}</td>
                    <td className="p-3 text-right text-slate-800 font-bold tabular-nums">{formatInr(a.cost)}</td>
                    <td className="p-3 text-right text-slate-800 font-bold tabular-nums">{formatInr(a.accumDep)}</td>
                    <td className="p-3 text-right text-green-700 font-bold tabular-nums">{formatInr(a.cost - a.accumDep)}</td>
                    <td className="p-3 text-center text-slate-600 font-semibold">{a.life} yrs</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center p-6 text-slate-400">
                      No capitalized assets recorded for the selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ui-card p-5">
          <h2 className="mb-1 font-semibold text-slate-900">Cost vs Depreciation vs Net Value</h2>
          <p className="mb-4 text-xs text-slate-400">Per asset breakdown</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tickFormatter={(v) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`} tick={{ fontSize: 10 }} width={55} />
                <Tooltip formatter={(v, name) => [formatInr(v), name]} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="Cost" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Bar dataKey="AccumDep" name="Accum Dep" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Bar dataKey="NetValue" name="Net Value" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Register Asset Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Register Fixed Asset</h3>
                <p className="text-xs text-slate-500 mt-0.5">Capitalize capital assets, plant machinery, and office property.</p>
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Asset Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FA-004"
                    value={newAsset.code}
                    onChange={(e) => setNewAsset((prev) => ({ ...prev, code: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={newAsset.purchaseDate}
                    onChange={(e) => setNewAsset((prev) => ({ ...prev, purchaseDate: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Asset Description / Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Laser engraving machine"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset((prev) => ({ ...prev, name: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Cost (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="450000"
                    value={newAsset.cost}
                    onChange={(e) => setNewAsset((prev) => ({ ...prev, cost: e.target.value }))}
                    className={`${inputClass} text-right`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Accum Dep (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newAsset.accumDep}
                    onChange={(e) => setNewAsset((prev) => ({ ...prev, accumDep: e.target.value }))}
                    className={`${inputClass} text-right`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Salvage Value (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="50000"
                    value={newAsset.salvage}
                    onChange={(e) => setNewAsset((prev) => ({ ...prev, salvage: e.target.value }))}
                    className={`${inputClass} text-right`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Useful Life (Yrs) *</label>
                  <input
                    type="number"
                    required
                    placeholder="10"
                    value={newAsset.life}
                    onChange={(e) => setNewAsset((prev) => ({ ...prev, life: e.target.value }))}
                    className={`${inputClass} text-center`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Depreciation Method</label>
                <select
                  value={newAsset.method}
                  onChange={(e) => setNewAsset((prev) => ({ ...prev, method: e.target.value }))}
                  className={inputClass}
                >
                  <option value="Straight Line">Straight Line</option>
                  <option value="WDV (15%)">WDV (15%)</option>
                  <option value="Double Declining">Double Declining Balance</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Capitalize Asset
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

