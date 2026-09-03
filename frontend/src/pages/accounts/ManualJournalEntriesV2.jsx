import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";

import {
  AccountsCard,
  AccountsPageShell,
  AccountsPagination,
  AccountsPrimaryButton,
  AccountsAddButton,
  AccountsSearchInput,
  accountsTableClass,
  accountsTableHeadClass,
  accountsRowActionClass,
  accountsTableWrapClass,
  accountsTdClass,
  accountsThClass,
  formatAccountsInr,
} from "../../components/accounts/accountsDesignSystem";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import Loader from "../../components/common/Loader";
import {
  deleteManualJournalOnApi,
  fetchManualJournals,
} from "../../api/manualJournalSync";
import { apiErrorMessage } from "../../utils/apiError";
import { useToast } from "../../context/ToastContext";

function fyStartIso() {
  const d = new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-04-01`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatSlash(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

function RowMenu({ entry, onEdit, onDelete, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-30 mt-1 min-w-[160px] rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-lg"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-[#17264A] hover:bg-[#F8FAFC]"
        onClick={() => {
          onEdit?.(entry);
          onClose?.();
        }}
      >
        <Pencil className="h-4 w-4 text-[#64748B]" />
        Edit
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-[#c0392b] hover:bg-[#fef2f2]"
        onClick={() => {
          onDelete?.(entry);
          onClose?.();
        }}
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>
    </div>
  );
}

export default function ManualJournalEntriesV2() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(fyStartIso);
  const [toDate, setToDate] = useState(todayIso);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [menuId, setMenuId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchManualJournals();
        if (!cancelled) setEntries(rows);
      } catch (err) {
        if (!cancelled) {
          setEntries([]);
          addToast(apiErrorMessage(err, "Failed to load journals"), "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      const d = e.date || "";
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      if (!q) return true;
      return `${e.voucherNumber} ${e.name} ${e.narration}`.toLowerCase().includes(q);
    });
  }, [entries, search, fromDate, toDate]);

  useEffect(() => {
    setPage(1);
  }, [search, fromDate, toDate, pageSize]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const goNew = () => navigate("/accounts/journal-entries/new");

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete journal #${entry.voucherNumber}?`)) return;
    try {
      await deleteManualJournalOnApi(entry);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id && e.apiId !== entry.apiId));
      addToast("Journal entry deleted", "success");
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete journal"), "error");
    }
  };

  if (loading) {
    return (
      <AccountsPageShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader label="Loading journals…" />
        </div>
      </AccountsPageShell>
    );
  }

  return (
    <AccountsPageShell>
      <AccountsCard>
        <div className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <AccountsSearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search journals..."
              className="min-w-[220px] flex-1 max-w-sm"
            />
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-[13px] text-[#17264A] dark:text-slate-200 shadow-xs">
                <Calendar className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  onClick={(e) => e.target.showPicker?.()}
                  className="w-[110px] border-0 bg-transparent text-[12px] font-medium outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                />
                <span className="text-[#94A3B8] font-semibold">→</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  onClick={(e) => e.target.showPicker?.()}
                  className="w-[110px] border-0 bg-transparent text-[12px] font-medium outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                />
              </div>
              <AccountsAddButton onClick={goNew} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                New Journal Entry
              </AccountsAddButton>
            </div>
          </div>

          <div className={accountsTableWrapClass}>
            <table className={accountsTableClass}>
              <thead className={accountsTableHeadClass}>
                <tr>
                  <SerialNumberHeader className={accountsThClass} />
                  <th className={accountsThClass}>Journal No.</th>
                  <th className={accountsThClass}>Date</th>
                  <th className={accountsThClass}>Journal Entry Name</th>
                  <th className={`${accountsThClass} text-right`}>Amount</th>
                  <th className={accountsThClass}>Narration</th>
                  <th className={`${accountsThClass} w-[72px] text-center`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`${accountsTdClass} py-16 text-center`}>
                      <div className="text-[14px] text-[#64748B]">
                        No Journal Entries available, Create new entry
                      </div>
                      <AccountsAddButton onClick={goNew} className="mt-4" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                        New Journal Entry
                      </AccountsAddButton>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((e, rowIndex) => (
                    <tr key={e.id} className="hover:bg-[#F8FAFC]">
                      <SerialNumberCell
                        rowIndex={rowIndex}
                        page={page}
                        pageSize={pageSize}
                        className={accountsTdClass}
                      />
                      <td className={`${accountsTdClass} font-semibold text-[var(--color-primary)]`}>
                        {e.voucherNumber || "—"}
                      </td>
                      <td className={`${accountsTdClass} text-[#64748B]`}>{formatSlash(e.date)}</td>
                      <td className={`${accountsTdClass} font-medium text-[#17264A]`}>{e.name || "—"}</td>
                      <td className={`${accountsTdClass} text-right tabular-nums font-medium`}>
                        {formatAccountsInr(e.debit || e.amount || 0)}
                      </td>
                      <td className={`${accountsTdClass} text-[#64748B]`}>{e.narration || "—"}</td>
                      <td className={`${accountsTdClass} relative text-center`}>
                        <button
                          type="button"
                          onClick={() => setMenuId((id) => (id === e.id ? null : e.id))}
                          className={accountsRowActionClass}
                          aria-label="Actions"
                        >
                          <MoreVertical className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                        {menuId === e.id ? (
                          <RowMenu
                            entry={e}
                            onEdit={() =>
                              navigate(`/accounts/journal-entries/${e.id}/edit`)
                            }
                            onDelete={handleDelete}
                            onClose={() => setMenuId(null)}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <AccountsPagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </div>
      </AccountsCard>
    </AccountsPageShell>
  );
}
