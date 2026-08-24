import { useEffect, useState, useCallback, useRef } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { CheckCircle, HelpCircle, Upload, Check } from "lucide-react";
import FinanceFilters from "../../components/finance/FinanceFilters";
import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import { getExtendedReports, getTenantPref, putTenantPref } from "../../api/accountsApi";
import { formatInr } from "../../data/financeMasterData";
import { apiErrorMessage } from "../../utils/apiError";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";

import Button from "../../components/common/Button";
const PREF_KEY = "bank_reconciliation_v1";

function parseStatementCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 2) continue;
    const amountRaw = parts[parts.length - 1];
    const amount = Number(String(amountRaw).replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(amount)) continue;
    rows.push({
      id: `upload-${i}-${Date.now()}`,
      date: parts[0] || "",
      description: parts.slice(1, -1).join(" ") || parts[1] || "Statement line",
      amount,
      matched: false,
    });
  }
  return rows;
}


export default function BankReconciliation() {
  const { addToast } = useToast();
  const uploadInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [financialYear, setFinancialYear] = useState("2026-27");
  const [month, setMonth] = useState("All Months");
  const [branch, setBranch] = useState("");
  const [search, setSearch] = useState("");
  const [ledgerLines, setLedgerLines] = useState([]);
  const [bankLines, setBankLines] = useState([]);
  const [cashBalance, setCashBalance] = useState(0);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [selectedBank, setSelectedBank] = useState(null);

  const persistState = useCallback(
    async (ledger, bank) => {
      try {
        await putTenantPref(PREF_KEY, {
          financialYear,
          month,
          branch,
          reconciled_ledger_ids: ledger.filter((l) => l.reconciled).map((l) => l.id),
          bank_lines: bank,
        });
      } catch {
        /* non-blocking */
      }
    },
    [financialYear, month, branch]
  );

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [repRes, prefRes] = await Promise.allSettled([
        getExtendedReports(financialYear, month, branch),
        getTenantPref(PREF_KEY),
      ]);


      const pref =
        prefRes.status === "fulfilled" ? prefRes.value?.data?.value || {} : {};
      const reconciled = new Set(pref.reconciled_ledger_ids || []);
      let ledger = [];
      if (repRes.status === "fulfilled" && repRes.value?.data) {
        ledger = (repRes.value.data.ledger_lines || []).map((l) => ({
          ...l,
          reconciled: reconciled.has(l.id) || Boolean(l.reconciled),
        }));
        setCashBalance(repRes.value.data.cash_balance || 0);
      }
      setLedgerLines(ledger);
      if (Array.isArray(pref.bank_lines) && pref.bank_lines.length) {
        setBankLines(pref.bank_lines);
      } else if (repRes.status === "fulfilled") {
        setBankLines(repRes.value?.data?.bank_lines || []);
      } else {
        setBankLines([]);
      }
    } catch {
      addToast("Failed to load Bank Reconciliation data", "error");
    } finally {
      setLoading(false);
    }
  }, [financialYear, month, branch, addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const handleMatch = async () => {
    if (selectedLedger === null || selectedBank === null) return;
    const ledgerObj = ledgerLines.find((l) => l.id === selectedLedger);
    const bankObj = bankLines.find((b) => b.id === selectedBank);
    if (!ledgerObj || !bankObj) return;
    if (Math.abs(ledgerObj.amount) !== Math.abs(bankObj.amount)) {
      addToast("Transaction amounts do not match — cannot reconcile.", "error");
      return;
    }
    const nextLedger = ledgerLines.map((l) =>
      l.id === selectedLedger ? { ...l, reconciled: true } : l
    );
    const nextBank = bankLines.map((b) =>
      b.id === selectedBank ? { ...b, matched: true } : b
    );
    setLedgerLines(nextLedger);
    setBankLines(nextBank);
    setSelectedLedger(null);
    setSelectedBank(null);
    await persistState(nextLedger, nextBank);
    addToast("Transactions successfully reconciled!", "success");
  };

  const handleUploadClick = () => uploadInputRef.current?.click();

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseStatementCsv(text);
      if (!parsed.length) {
        addToast("Could not parse statement. Use CSV: date, description, amount", "error");
        return;
      }
      setBankLines(parsed);
      await persistState(ledgerLines, parsed);
      addToast(`Imported ${parsed.length} bank statement lines from ${file.name}`, "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to upload statement"), "error");
    }
  };

  const unreconciledLedger = ledgerLines
    .filter((l) => !l.reconciled)
    .reduce((s, x) => s + x.amount, 0);
  const unreconciledBank = bankLines
    .filter((b) => !b.matched)
    .reduce((s, x) => s + x.amount, 0);

  const q = search.trim().toLowerCase();
  const visibleLedger = !q
    ? ledgerLines
    : ledgerLines.filter((l) =>
        `${l.description || ""} ${l.date || ""}`.toLowerCase().includes(q)
      );
  const visibleBank = !q
    ? bankLines
    : bankLines.filter((b) =>
        `${b.description || ""} ${b.date || ""}`.toLowerCase().includes(q)
      );

  if (loading) return <Loader label="Loading Bank Reconciliation..." />;

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        subtitle="Verify company cash postings against monthly bank statements to ensure ledger integrity."
        action={
          <>
            <Button variant="secondary" type="button" onClick={handleUploadClick}>
              <Upload className="h-4 w-4" />
              Upload Bank statement
            </Button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleUploadFile}
            />
          </>
        }
      />

      <FinanceFilters
        financialYear={financialYear}
        onFinancialYearChange={setFinancialYear}
        month={month}
        onMonthChange={setMonth}
        branch={branch}
        onBranchChange={setBranch}
        search={search}
        onSearchChange={setSearch}
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Cash Balance" value={formatInr(cashBalance)} icon={CheckCircle} color="bg-emerald-500" />
        <KpiCard label="Ledger Unreconciled" value={formatInr(unreconciledLedger)} icon={HelpCircle} color="bg-amber-500" />
        <KpiCard label="Statement Unreconciled" value={formatInr(unreconciledBank)} icon={HelpCircle} color="bg-red-500" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="ui-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Ledger Postings</h2>
            <span className="text-xs font-semibold text-slate-500">Select to match</span>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {visibleLedger.map((l) => (
              <button
                key={l.id}
                type="button"
                disabled={l.reconciled}
                onClick={() => !l.reconciled && setSelectedLedger(l.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm ${
                  l.reconciled
                    ? "cursor-default border-green-200 bg-green-50/50 text-slate-400"
                    : selectedLedger === l.id
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.description || "Ledger entry"}</p>
                  <p className="text-xs text-slate-500">{l.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums font-semibold">{formatInr(l.amount)}</span>
                  {l.reconciled && <Check className="h-4 w-4 shrink-0 text-green-600" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="ui-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Bank Statement</h2>
            <span className="text-xs font-semibold text-slate-500">Select to match</span>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {visibleBank.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                No bank statement transactions uploaded
              </div>
            ) : (
              visibleBank.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={b.matched}
                  onClick={() => !b.matched && setSelectedBank(b.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm ${
                    b.matched
                      ? "cursor-default border-green-200 bg-green-50/50 text-slate-400"
                      : selectedBank === b.id
                        ? "border-blue-400 bg-blue-50"
                        : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.description || "Bank line"}</p>
                    <p className="text-xs text-slate-500">{b.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-semibold">{formatInr(b.amount)}</span>
                    {b.matched && <Check className="h-4 w-4 shrink-0 text-green-600" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedLedger !== null && selectedBank !== null ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm font-medium text-blue-900">
            Ready to match selected ledger posting with bank statement item!
          </p>
          <Button type="button" variant="primary" onClick={handleMatch}>
            Confirm Match
          </Button>
        </div>
      ) : null}
    </div>
  );
}
