import { useEffect, useState, useCallback } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Plus, CheckCircle, Trash2, X } from "lucide-react";
import FinanceFilters from "../../components/finance/FinanceFilters";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getExtendedReports, createJournalEntry } from "../../api/accountsApi";
import { formatInr } from "../../data/financeMasterData";
import PageHeader from "../../components/common/PageHeader";
import { inputMtClass as inputClass } from "../../design-system/classes";

const EMPTY_ENTRY = {
  date: new Date().toISOString().split("T")[0],
  ref: "",
  desc: "",
  branch: "Head Office",
  status: "Posted",
  legs: [
    { account: "", debit: 0, credit: 0 },
    { account: "", debit: 0, credit: 0 },
  ],
};

export default function JournalEntries() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [financialYear, setFinancialYear] = useState("2026-27");
  const [month, setMonth] = useState("All Months");
  const [branch, setBranch] = useState("");
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [newEntry, setNewEntry] = useState(EMPTY_ENTRY);

  const load = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getExtendedReports(financialYear, month, branch);
      const list = res?.data?.journal_entries || res?.data?.data?.journal_entries || [];
      setEntries(Array.isArray(list) ? list : []);


    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "Failed to load Journal Entries data";
      console.error("JournalEntries load failed", error);
      addToast(detail, "error");
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [financialYear, month, branch, addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => { load(); }, [load]);

  const handleAddLeg = () => {
    setNewEntry((prev) => ({
      ...prev,
      legs: [...prev.legs, { account: "", debit: 0, credit: 0 }]
    }));
  };

  const handleRemoveLeg = (idx) => {
    setNewEntry((prev) => ({
      ...prev,
      legs: prev.legs.filter((_, i) => i !== idx)
    }));
  };

  const handleLegChange = (idx, field, value) => {
    setNewEntry((prev) => {
      const legs = [...prev.legs];
      legs[idx] = { ...legs[idx], [field]: value };
      return { ...prev, legs };
    });
  };

  const totalDebits = newEntry.legs.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredits = newEntry.legs.reduce((s, l) => s + Number(l.credit || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalDebits !== totalCredits) {
      addToast("Out of balance! Total Debits must equal Total Credits.", "warning");
      return;
    }

    const payload = {
      date: newEntry.date,
      ref: newEntry.ref,
      desc: newEntry.desc,
      reference: newEntry.ref,
      description: newEntry.desc,
      branch: newEntry.branch || "Head Office",
      status: newEntry.status || "Posted",
      legs: newEntry.legs.map((leg) => ({
        account: (leg.account || "").trim() || "General",
        debit: Number(leg.debit || 0),
        credit: Number(leg.credit || 0),
      })),
    };

    setLoading(true);
    try {
      await createJournalEntry(payload);
      addToast("Journal Entry posted successfully!", "success");
      setModalOpen(false);
      setNewEntry({ ...EMPTY_ENTRY, date: new Date().toISOString().split("T")[0] });
      await load();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message || "Failed to post Journal Entry";
      addToast(detail, "error");
    } finally {
      setLoading(false);
    }
  };

  const filtered = entries.filter((e) => {
    if (branch && e.branch !== branch) return false;
    if (search && !e.desc.toLowerCase().includes(search.toLowerCase()) && !e.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <Loader label="Loading Journal Entries..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="Record manual adjustments, accrued expenses, and general ledger corrections."
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
        searchPlaceholder="Search journal entries..."
      />

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b text-slate-500 text-left font-semibold">
                <th className="p-3">Entry ID</th>
                <th className="p-3">Posting Date</th>
                <th className="p-3">Reference</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">Debit (₹)</th>
                <th className="p-3 text-right">Credit (₹)</th>
                <th className="p-3">Branch</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-semibold text-[var(--color-primary)]">{e.id}</td>
                  <td className="p-3 text-slate-700">{e.date}</td>
                  <td className="p-3 text-slate-600 font-medium">{e.ref || "—"}</td>
                  <td className="p-3 text-slate-700">
                    <div>{e.desc}</div>
                    <div className="mt-1.5 space-y-1 text-xs pl-2 border-l-2 border-slate-200">
                      {(e.legs || []).map((l, i) => (
                        <div key={i} className="flex justify-between w-64 text-slate-400">
                          <span>{l.account}</span>
                          <span>{l.debit > 0 ? `Dr ${formatInr(l.debit)}` : `Cr ${formatInr(l.credit)}`}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-right font-bold text-slate-900 tabular-nums">{formatInr(e.debit)}</td>
                  <td className="p-3 text-right font-bold text-slate-900 tabular-nums">{formatInr(e.credit)}</td>
                  <td className="p-3 text-slate-600">{e.branch}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      e.status === "Posted" ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center p-6 text-slate-400">
                    No ledger adjustments recorded for the selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Journal Entry Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Record New Journal Entry</h3>
                <p className="text-xs text-slate-500 mt-0.5">Post general ledger adjustments and double-entry voucher postings.</p>
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
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Posting Date *</label>
                  <input
                    type="date"
                    required
                    value={newEntry.date}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, date: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Reference / Doc # *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Accrual Ref-09"
                    value={newEntry.ref}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, ref: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Branch</label>
                  <select
                    value={newEntry.branch}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, branch: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="Head Office">Head Office</option>
                    <option value="Plant-1">Plant-1</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
                  <select
                    value={newEntry.status}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, status: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Posted">Posted</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Entry Narration *</label>
                <input
                  type="text"
                  required
                  placeholder="Describe the entry purpose..."
                  value={newEntry.desc}
                  onChange={(e) => setNewEntry((prev) => ({ ...prev, desc: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800">Double-Entry Postings</h3>
                  <button
                    type="button"
                    onClick={handleAddLeg}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                  >
                    + Add Account Line
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {newEntry.legs.map((leg, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        required
                        placeholder="Account name..."
                        value={leg.account}
                        onChange={(e) => handleLegChange(idx, "account", e.target.value)}
                        className={`${inputClass} flex-1`}
                      />
                      <input
                        type="number"
                        placeholder="Debit"
                        value={leg.debit || ""}
                        onChange={(e) => handleLegChange(idx, "debit", Number(e.target.value))}
                        className={`${inputClass} w-28 text-right`}
                      />
                      <input
                        type="number"
                        placeholder="Credit"
                        value={leg.credit || ""}
                        onChange={(e) => handleLegChange(idx, "credit", Number(e.target.value))}
                        className={`${inputClass} w-28 text-right`}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveLeg(idx)}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm">
                <span className="font-semibold text-slate-600">Verification summary:</span>
                <div className="flex gap-4">
                  <span className="font-bold text-blue-600">Total Debit: {formatInr(totalDebits)}</span>
                  <span className="font-bold text-indigo-600">Total Credit: {formatInr(totalCredits)}</span>
                </div>
                {totalDebits === totalCredits && totalDebits > 0 ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
                    <CheckCircle className="h-3 w-3" /> Balanced
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                    Out of balance
                  </span>
                )}
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
                  Create Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
