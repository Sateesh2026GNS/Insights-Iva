import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Calendar, FileText, Plus, Trash2 } from "lucide-react";

import AccountSearchSelect from "../../components/accounts/AccountSearchSelect";
import { EXTRA_JOURNAL_ACCOUNTS } from "../../data/chartOfAccounts";
import { nextManualJournalNumber } from "../../data/manualJournals";
import {
  fetchManualJournals,
  postManualJournalToApi,
  updateManualJournalOnApi,
} from "../../api/manualJournalSync";
import {
  fetchChartOfAccounts,
  fetchJournalAccountOptions,
} from "../../api/chartOfAccountsSync";
import { getJournalEntry } from "../../api/accountsApi";
import { mapApiJournalToUi } from "../../api/manualJournalSync";
import { apiErrorMessage } from "../../utils/apiError";
import { useToast } from "../../context/ToastContext";

import {
  AccountsCard,
  AccountsPageShell,
  AccountsPrimaryButton,
  AccountsSecondaryButton,
  formatAccountsInr,
} from "../../components/accounts/accountsDesignSystem";
import Loader from "../../components/common/Loader";
import { inputClass } from "../../design-system/classes";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatInr(amount) {
  return formatAccountsInr(amount);
}

function emptyLine(accountId = "", accountName = "") {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    accountId,
    accountName,
    debit: "",
    credit: "",
  };
}

export default function NewJournalEntryV2() {
  const { accountId, entryId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const isManual =
    location.pathname.startsWith("/accounts/journal-entries") || !accountId;
  const returnTab = searchParams.get("tab") || "journals";
  const isEdit = Boolean(isManual && entryId);

  const [existingManual, setExistingManual] = useState(null);
  const [loadingEntry, setLoadingEntry] = useState(Boolean(isEdit));
  const [loadingAccounts, setLoadingAccounts] = useState(!isManual);
  const [saving, setSaving] = useState(false);
  const [parent, setParent] = useState(null);
  const [accountOptions, setAccountOptions] = useState([]);

  const [date, setDate] = useState(todayIso());
  const [voucherNumber, setVoucherNumber] = useState("");
  const [name, setName] = useState("");
  const [narration, setNarration] = useState("");
  const [touched, setTouched] = useState(false);
  const [lines, setLines] = useState(() => [emptyLine(), emptyLine()]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isManual) setLoadingAccounts(true);
      try {
        const opts = await fetchJournalAccountOptions();
        const extras = EXTRA_JOURNAL_ACCOUNTS.map((a) => ({
          value: a.id,
          label: a.name,
        }));
        if (!cancelled) setAccountOptions([...(opts || []), ...extras]);
        if (accountId && !isManual) {
          const mains = await fetchChartOfAccounts();
          const found = mains.find(
            (a) => String(a.id) === String(accountId) || String(a.code) === String(accountId)
          );
          if (!cancelled) {
            setParent(found || null);
            if (found) {
              setLines([emptyLine(found.id, found.name), emptyLine()]);
            }
          }
        }
        if (!entryId && isManual) {
          const rows = await fetchManualJournals();
          if (!cancelled) setVoucherNumber(nextManualJournalNumber(rows));
        } else if (!entryId && !isManual) {
          if (!cancelled) setVoucherNumber(String(Date.now()).slice(-6));
        }
      } catch {
        if (!cancelled) {
          setAccountOptions([
            { value: "ar", label: "Accounts Receivable (Sundry Debtors)" },
            { value: "ap", label: "Accounts Payable (Sundry Creditors)" },
            { value: "cash", label: "Cash In Hand" },
            { value: "bank", label: "Bank Accounts" },
            { value: "sales", label: "Sales Accounts" },
          ]);
        }
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, isManual, entryId]);

  useEffect(() => {
    if (!isEdit) {
      setLoadingEntry(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingEntry(true);
      try {
        const res = await getJournalEntry(entryId);
        const found = mapApiJournalToUi(res.data);
        if (cancelled) return;
        setExistingManual(found);
        setDate(found.date || todayIso());
        setVoucherNumber(found.voucherNumber || "");
        setName(found.name || "");
        setNarration(found.narration || "");
        setLines(
          (found.lines || []).length
            ? found.lines.map((l) => ({
                key: `line-${l.accountId}-${Math.random().toString(36).slice(2, 7)}`,
                accountId: l.accountId || "",
                accountName: l.accountName || "",
                debit: l.debit ? String(l.debit) : "",
                credit: l.credit ? String(l.credit) : "",
              }))
            : [emptyLine(), emptyLine()]
        );
      } catch (err) {
        if (!cancelled) {
          addToast(apiErrorMessage(err, "Failed to load journal"), "error");
          navigate("/accounts/journal-entries");
        }
      } finally {
        if (!cancelled) setLoadingEntry(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, entryId, addToast, navigate]);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { debit, credit };
  }, [lines]);

  const nameError = touched && !name.trim();

  const goBack = () => {
    if (isManual) {
      navigate("/accounts/journal-entries");
      return;
    }
    navigate(`/accounts/chart-of-accounts/${accountId}?tab=${returnTab}`);
  };

  const updateLine = (key, patch) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (key) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.key !== key) : prev));
  };

  const handleSave = async () => {
    setTouched(true);
    if (!name.trim()) {
      addToast("Journal Entry Name is required", "error");
      return;
    }
    if (!narration.trim()) {
      addToast("Narration is required", "error");
      return;
    }
    if (!voucherNumber.trim()) {
      addToast("Voucher Number is required", "error");
      return;
    }
    const filled = lines.filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)));
    if (filled.length < 2) {
      addToast("Add at least two account lines with amounts", "error");
      return;
    }
    if (Math.abs(totals.debit - totals.credit) > 0.001) {
      addToast("Total Debit must equal Total Credit", "error");
      return;
    }

    const entry = {
      id: existingManual?.id || entryId,
      apiId: existingManual?.apiId || entryId,
      date,
      voucherNumber: voucherNumber.trim(),
      name: name.trim(),
      narration: narration.trim(),
      transactionType: "Journal",
      debit: totals.debit,
      credit: totals.credit,
      amount: totals.debit,
      lines: filled.map((l) => ({
        accountId: l.accountId,
        accountName: l.accountName,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      })),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateManualJournalOnApi(entry);
        addToast("Journal entry updated", "success");
      } else {
        await postManualJournalToApi(entry);
        addToast("Journal entry saved", "success");
      }
      goBack();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to save journal"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loadingEntry || loadingAccounts) {
    return (
      <AccountsPageShell>
        <Loader label="Loading journal…" />
      </AccountsPageShell>
    );
  }

  if (!isManual && !parent) {
    return (
      <AccountsPageShell>
        <p className="text-[14px] text-[#64748B]">Account not found.</p>
      </AccountsPageShell>
    );
  }

  const field = inputClass;
  const lineField = `${inputClass} px-2.5 py-2 text-[13px]`;
  const cell = "border-b border-r border-[#d0d0d8] px-2.5 py-2.5 last:border-r-0";

  return (
    <AccountsPageShell>
      <div className="mx-auto max-w-[1100px]">
        <AccountsCard className="p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <AccountsSecondaryButton type="button" onClick={goBack}>
              Cancel
            </AccountsSecondaryButton>
            <AccountsPrimaryButton type="button" disabled={saving} onClick={handleSave}>
              {saving ? "Saving…" : isEdit ? "Update" : "Save"}
            </AccountsPrimaryButton>
          </div>
        </div>

        {/* Card 1 — Voucher Details */}
        <div className="mb-4 overflow-hidden rounded-xl border border-[#d0d0d8] bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#d0d0d8] bg-[var(--color-primary-soft)] px-5 py-3">
            <FileText className="h-4 w-4 text-[var(--color-primary)]" />
            <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-primary)]">
              Voucher Details
            </span>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="grid gap-4 border-b border-[#d0d0d8] pb-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#3a3a42]">
                  Date <span className="text-[#e11d48]">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`${field} pr-10`}
                  />
                  <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9aa5]" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-[#3a3a42]">
                  Voucher Number <span className="text-[#e11d48]">*</span>
                </label>
                <input
                  className={field}
                  value={voucherNumber}
                  onChange={(e) => setVoucherNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="border-b border-[#d0d0d8] pb-4">
              <label className="mb-1.5 block text-[13px] font-medium text-[#3a3a42]">
                Journal Entry Name <span className="text-[#e11d48]">*</span>
              </label>
              <input
                className={`${field} ${nameError ? "border-[#e11d48] bg-white" : ""}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter name"
              />
              {nameError ? (
                <div className="mt-1 text-[12px] font-medium text-[#e11d48]">required!</div>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-[#3a3a42]">
                Narration <span className="text-[#e11d48]">*</span>
              </label>
              <input
                className={field}
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Enter narration"
              />
            </div>
          </div>
        </div>

        {/* Card 2 — Journal Entry Details */}
        <div className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white shadow-sm">
          <div className="border-b border-[#d0d0d8] px-5 py-3.5">
            <h2 className="text-[15px] font-semibold text-[#1a1a1f]">Journal Entry Details</h2>
          </div>

          <div className="px-5 py-5">
            <div className="overflow-hidden rounded-lg border border-[#d0d0d8]">
              <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(120px,0.6fr)_minmax(120px,0.6fr)_44px] bg-[#fafafa] text-[13px] font-semibold text-[#6b6b76]">
                <div className={`${cell} border-b`}>Account</div>
                <div className={`${cell} border-b`}>Debit</div>
                <div className={`${cell} border-b`}>Credit</div>
                <div className={`${cell} border-b`} />
              </div>

              {lines.map((line, idx) => {
                const isLast = idx === lines.length - 1;
                const rowCell = isLast
                  ? "border-r border-[#d0d0d8] px-2.5 py-2.5 last:border-r-0"
                  : cell;
                return (
                  <div
                    key={line.key}
                    className="grid grid-cols-[minmax(0,1.4fr)_minmax(120px,0.6fr)_minmax(120px,0.6fr)_44px] items-center"
                  >
                    <div className={rowCell}>
                      <AccountSearchSelect
                        value={line.accountId}
                        label={line.accountName}
                        options={accountOptions}
                        onChange={(opt) =>
                          updateLine(line.key, {
                            accountId: opt.value,
                            accountName: opt.label,
                          })
                        }
                      />
                    </div>
                    <div className={rowCell}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Enter Amount"
                        value={line.debit}
                        onChange={(e) =>
                          updateLine(line.key, {
                            debit: e.target.value,
                            credit: e.target.value ? "" : line.credit,
                          })
                        }
                        className={lineField}
                      />
                    </div>
                    <div className={rowCell}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Enter Amount"
                        value={line.credit}
                        onChange={(e) =>
                          updateLine(line.key, {
                            credit: e.target.value,
                            debit: e.target.value ? "" : line.debit,
                          })
                        }
                        className={lineField}
                      />
                    </div>
                    <div className={`${rowCell} flex items-center justify-center`}>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        disabled={lines.length <= 1}
                        className="grid h-8 w-8 place-items-center rounded-md border border-[#d0d0d8] text-[#b91c1c] hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Remove journal line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(120px,0.6fr)_minmax(120px,0.6fr)_44px] border-t border-[#d0d0d8] bg-[#fafafa] text-[13px] text-[#1a1a1f]">
                <div className="border-r border-[#d0d0d8] px-2.5 py-3 font-semibold text-[#6b6b76]">
                  Total
                </div>
                <div className="border-r border-[#d0d0d8] px-2.5 py-3">
                  <span className="font-bold tabular-nums">{formatInr(totals.debit)}</span>
                </div>
                <div className="border-r border-[#d0d0d8] px-2.5 py-3">
                  <span className="font-bold tabular-nums">{formatInr(totals.credit)}</span>
                </div>
                <div className="px-2.5 py-3" />
              </div>
            </div>

            <button
              type="button"
              onClick={addLine}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--color-primary)] bg-white py-3 text-[14px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
            >
              <Plus className="h-4 w-4" />
              Add New Line
            </button>
          </div>
        </div>
        </AccountsCard>
      </div>
    </AccountsPageShell>
  );
}
