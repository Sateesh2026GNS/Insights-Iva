import { useState, useEffect, useCallback } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { RefreshCw, CheckCircle2, ChevronRight, Lock, CheckCircle, ShieldAlert } from "lucide-react";
import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";
import { getExtendedReports } from "../../api/accountsApi";
import { formatInr } from "../../data/financeMasterData";

export default function YearClosing() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [financialYear, setFinancialYear] = useState("2026-27");
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState({
    trial_balance_accounts: [],
    cash_balance: 0
  });

  const [closingChecks, setClosingChecks] = useState([
    { id: 1, label: "All journal entries posted for current fiscal period", checked: true, detail: "No draft vouchers remaining" },
    { id: 2, label: "Bank statements reconciled up to March 31st", checked: true, detail: "All deposits and withdrawals matched" },
    { id: 3, label: "Depreciation posting processed for all fixed assets", checked: true, detail: "Accumulated values updated in ledger" },
    { id: 4, label: "Accrued liabilities and taxes verified", checked: false, detail: "Pending tax calculations check" }
  ]);

  const load = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getExtendedReports(financialYear, "All Months", "");
      if (res.data) {
        setData(res.data);
      }
    } catch {
      addToast("Failed to load Year End Closing parameters", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [financialYear, addToast]);

  usePageRefresh(() => load({ isRefresh: true }));

  useEffect(() => { load(); }, [load]);

  const handleToggleCheck = (id) => {
    setClosingChecks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))
    );
  };

  const handleStartClose = () => {
    setActionLoading(true);
    setTimeout(() => {
      setActionLoading(false);
      setCurrentStep(3);
      addToast("Financial Year successfully closed!", "success");
    }, 2000);
  };

  const allChecksPassed = closingChecks.every((c) => c.checked);

  const revenuesTotal = data.trial_balance_accounts
    ? data.trial_balance_accounts.filter(a => a.category === "Revenue").reduce((s, a) => s + a.credit, 0)
    : 0;

  const expensesTotal = data.trial_balance_accounts
    ? data.trial_balance_accounts.filter(a => a.category === "Expense").reduce((s, a) => s + a.debit, 0)
    : 0;

  const retainedEarnings = revenuesTotal - expensesTotal;

  if (loading) return <Loader label="Loading Closing Parameters..." />;

  return (
    <div className="space-y-5 pb-4">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ui-subtitle font-medium">Perform fiscal period closure, transfer net earnings, and seal books for audit.</p>
        </div>
      </header>

      {/* Stepper Wizard Progress */}
      <div className="flex items-center gap-4 bg-slate-50 border p-4 rounded-2xl">
        <StepIndicator step={1} current={currentStep} label="Pre-Close Checklist" />
        <ChevronRight className="h-5 w-5 text-slate-300" />
        <StepIndicator step={2} current={currentStep} label="Closing Journal Entry" />
        <ChevronRight className="h-5 w-5 text-slate-300" />
        <StepIndicator step={3} current={currentStep} label="Books Locked" />
      </div>

      {currentStep === 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Step 1: Closing Audit & Verifications</h2>
            <p className="text-sm text-slate-500">Ensure the following pre-closing tasks are completed. Verify adjustments before closing revenue and expense accounts.</p>
          </div>

          <div className="space-y-3">
            {closingChecks.map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-xl border p-3 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={c.checked}
                  onChange={() => handleToggleCheck(c.id)}
                  className="mt-1 h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <label className="text-sm font-semibold text-slate-800 block cursor-pointer">{c.label}</label>
                  <span className="text-xs text-slate-400 block mt-0.5">{c.detail}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button
              type="button"
              variant="primary"
              disabled={!allChecksPassed}
              onClick={() => setCurrentStep(2)}
              rightIcon={<ChevronRight className="h-4 w-4" aria-hidden />}
            >
              Next Step
            </Button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Step 2: Post Year-End Closing Entry</h2>
            <p className="text-sm text-slate-500">Post a closing voucher transferring the net profit of the current period into Retained Earnings. This will zero out all revenue and expense accounts.</p>
          </div>

          <div className="bg-slate-50 border rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Proposed Journal Entry</h3>
            <div className="space-y-1 text-sm border-l-4 border-blue-500 pl-3">
              <div className="flex justify-between w-96 text-slate-700">
                <span className="font-medium">All Revenues (Debit)</span>
                <span className="font-semibold text-right">{formatInr(revenuesTotal)}</span>
              </div>
              <div className="flex justify-between w-96 text-slate-600 pl-4">
                <span>To All Expenses (Credit)</span>
                <span className="font-semibold text-right">{formatInr(expensesTotal)}</span>
              </div>
              <div className="flex justify-between w-96 text-green-700 font-bold pl-4">
                <span>To Retained Earnings (Credit Surplus)</span>
                <span className="text-right">{formatInr(retainedEarnings)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-xs font-semibold text-amber-900 uppercase tracking-wider">Warning: Critical Action</p>
              <p className="text-xs text-amber-700 mt-0.5">Closing the fiscal year is irreversible. Once posted, no further modifications can be made to transactions in this period.</p>
            </div>
          </div>

          <div className="flex justify-between border-t pt-4">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(1)}>
              Back
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={actionLoading}
              loading={actionLoading}
              onClick={handleStartClose}
              leftIcon={<Lock className="h-4 w-4" aria-hidden />}
            >
              {actionLoading ? "Closing Year..." : "Finalize Year-End Close"}
            </Button>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div className="rounded-2xl border border-green-200 bg-green-50/30 p-8 shadow-sm space-y-6 text-center max-w-xl mx-auto">
          <div className="flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4 border border-green-300">
              <CheckCircle className="h-10 w-10 text-green-600 animate-bounce" />
            </div>
            <h2 className="text-xl font-bold text-green-950">Financial Year Closed Successfully</h2>
            <p className="text-sm text-green-700 mt-2">All postings for Financial Year {financialYear} have been zeroed and transferred into Retained Earnings. The ledger is now officially locked.</p>
          </div>

          <div className="bg-white border border-green-200 rounded-xl p-4 text-sm text-left divide-y space-y-2">
            <div className="flex justify-between text-slate-600 py-1.5">
              <span>Fiscal Year Locked:</span>
              <span className="font-semibold text-slate-800">{financialYear}</span>
            </div>
            <div className="flex justify-between text-slate-600 py-1.5">
              <span>Income Transferred:</span>
              <span className="font-semibold text-green-700">{formatInr(retainedEarnings)}</span>
            </div>
            <div className="flex justify-between text-slate-600 py-1.5">
              <span>Closing Voucher ID:</span>
              <span className="font-semibold text-slate-800">JV-2026-CLOSE</span>
            </div>
          </div>

          <Button
            type="button"
            variant="view"
            fullWidth
            onClick={() => {
              setCurrentStep(1);
              setClosingChecks((prev) => prev.map((c) => c.id === 4 ? { ...c, checked: false } : c));
            }}
          >
            Acknowledge & Return
          </Button>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step, current, label }) {
  const isDone = current > step;
  const isActive = current === step;
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold border ${
        isDone ? "bg-green-600 border-green-600 text-white" :
        isActive ? "bg-[var(--color-primary)] border-blue-600 text-white shadow" : "bg-white border-slate-300 text-slate-500"
      }`}>
        {isDone ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <span className={`text-sm font-semibold ${isActive ? "text-slate-900" : isDone ? "text-slate-600" : "text-slate-400"}`}>
        {label}
      </span>
    </div>
  );
}
