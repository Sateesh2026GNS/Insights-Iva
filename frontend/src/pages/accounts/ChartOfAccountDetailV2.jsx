import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Info, MoreVertical, Pencil, Plus, User } from "lucide-react";

import CreateAccountModal from "../../components/accounts/CreateAccountModal";
import {
  createSubAccount,
  fetchChartOfAccounts,
  fetchSubAccounts,
  updateChartAccount,
} from "../../api/chartOfAccountsSync";
import { fetchManualJournals } from "../../api/manualJournalSync";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";

const PAGE_BG = "var(--color-bg)";
const PAGE_SIZES = [10, 20, 50];

function formatInr(amount) {
  const n = Number(amount) || 0;
  return `₹ ${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

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
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="ui-pagination justify-between w-full">
      <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap text-[13px] text-[#596b82]">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="ui-pagination-select"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span>
          {total === 0 ? "0–0 of 0" : `${from}–${to} of ${total}`}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="ui-page-btn"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="ui-page-btn ui-page-btn--active"
        >
          {page}
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="ui-page-btn"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function OverflowMenu({ items, onClose }) {
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
      className="absolute right-0 top-full z-30 mt-1 min-w-[190px] rounded-lg border border-[#e4e4ea] bg-white py-1 shadow-lg"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-[#3a3a42] hover:bg-[#f7f7f9]"
          onClick={() => {
            item.onClick?.();
            onClose?.();
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

function SummaryCards({ totals }) {
  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
      <div className="rounded-xl border border-[#cfcfd6] bg-white px-5 py-4">
        <div className="text-[13px] text-[#6b6b76]">Total Balance of Sub-accounts</div>
        <div className="mt-1 text-[22px] font-bold tabular-nums text-[#1a1a1f]">
          {formatInr(totals.subTotal)}
        </div>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#cfcfd6] bg-white">
        <div className="border-r border-[#e4e4ea] px-5 py-4">
          <div className="text-[13px] text-[#6b6b76]">Total Opening Balance</div>
          <div className="mt-1 text-[22px] font-bold tabular-nums text-[#1a1a1f]">
            {formatInr(totals.opening)}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-[13px] text-[#6b6b76]">Total Closing Balance</div>
          <div className="mt-1 text-[22px] font-bold tabular-nums text-[#1a1a1f]">
            {formatInr(totals.closing)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChartOfAccountDetailV2() {
  const { accountId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [account, setAccount] = useState(null);
  const [subs, setSubs] = useState([]);
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(() =>
    searchParams.get("tab") === "journals" ? "journals" : "subs"
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [fromDate, setFromDate] = useState(fyStartIso);
  const [toDate, setToDate] = useState(todayIso);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [mains, children, allJournals] = await Promise.all([
        fetchChartOfAccounts(),
        fetchSubAccounts(accountId),
        fetchManualJournals(),
      ]);


      const found = mains.find((a) => String(a.id) === String(accountId) || String(a.code) === String(accountId));
      setAccount(found || null);
      setSubs(children);
      const name = found?.name || "";
      setJournals(
        allJournals.filter((j) =>
          (j.lines || []).some(
            (l) =>
              String(l.accountId) === String(accountId) ||
              String(l.accountName || "").toLowerCase() === name.toLowerCase()
          )
        )
      );
    } catch (err) {
      setAccount(null);
      setSubs([]);
      setJournals([]);
      addToast(apiErrorMessage(err, "Failed to load account"), "error");
    } finally {
      setLoading(false);
    }
  }, [accountId, addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
    setPage(1);
    const t = searchParams.get("tab");
    setTab(t === "journals" ? "journals" : "subs");
  }, [load, searchParams]);

  const totals = useMemo(() => {
    const subTotal = subs.reduce((s, r) => s + (Number(r.balance) || 0), 0);
    const opening = subs.reduce((s, r) => s + (Number(r.openingBalance) || 0), 0);
    return {
      subTotal,
      opening,
      closing: subTotal,
      side: account?.side || "DR",
    };
  }, [subs, account]);

  const filteredJournals = useMemo(() => {
    return journals.filter((j) => {
      const d = j.date || "";
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [journals, fromDate, toDate]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return subs.slice(start, start + pageSize);
  }, [subs, page, pageSize]);

  const journalRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredJournals.slice(start, start + pageSize);
  }, [filteredJournals, page, pageSize]);

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-sm text-[#6b6b76]" style={{ background: PAGE_BG }}>
        Loading account…
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-full p-6" style={{ background: PAGE_BG }}>
        <button
          type="button"
          onClick={() => navigate("/accounts/chart-of-accounts")}
          className="mb-4 inline-flex items-center gap-2 text-[14px] text-[#6b4eff]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Chart of Accounts
        </button>
        <p className="text-[14px] text-[#6b6b76]">Account not found.</p>
      </div>
    );
  }

  const handleUpdateAccount = async (payload) => {
    try {
      if (!account.apiId) throw new Error("Missing account id");
      const updated = await updateChartAccount(account.apiId, {
        ...account,
        name: payload.name,
        type: payload.type,
        group: payload.group,
        balance: payload.balance,
        side: payload.side,
      });
      setAccount(updated);
      addToast("Account updated", "success");
      setEditOpen(false);
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to update account"), "error");
    }
  };

  const handleAddSub = async (payload) => {
    try {
      await createSubAccount(accountId, {
        id: payload.id,
        name: payload.name,
        balance: payload.balance || 0,
        side: account.side || "DR",
        type: account.type || "Asset",
      });
      addToast("Sub-account added", "success");
      setAddSubOpen(false);
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to add sub-account"), "error");
    }
  };

  const goNewJournal = () => {
    navigate(`/accounts/chart-of-accounts/${accountId}/journal/new?tab=journals`);
  };

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/accounts/chart-of-accounts")}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#e4e4ea] bg-white text-[#1a1a1f] hover:bg-[#f7f7f9]"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-[20px] font-semibold tracking-tight text-[#1a1a1f] sm:text-[22px]">
            {account.name}
          </h1>
        </div>

        <div className="mb-4 flex gap-3 rounded-xl border border-[#cfcfd6] bg-white px-4 py-3.5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#6b4eff]" />
          <div className="min-w-0 text-[14px] leading-relaxed text-[#1a1a1f]">
            <div className="font-semibold">
              {account.name} ({account.group})
            </div>
            {account.description ? (
              <div className="text-[#6b6b76]">{account.description}</div>
            ) : null}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex overflow-hidden rounded-lg border border-[#cfcfd6] bg-[#f3f3f6]">
            {[
              { id: "subs", label: "All Sub-Accounts" },
              { id: "journals", label: "Journal Entries" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setPage(1);
                }}
                className={`border-b-[3px] px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                  tab === t.id
                    ? "border-[#6b4eff] bg-white text-[#1a1a1f]"
                    : "border-transparent text-[#6b6b76] hover:text-[#1a1a1f]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative flex flex-wrap items-center gap-2">
            {tab === "journals" ? (
              <>
                <label className="inline-flex items-center gap-2 rounded-full border border-[#cfcfd6] bg-white px-3 py-2 text-[13px] text-[#1a1a1f]">
                  <Calendar className="h-4 w-4 text-[#6b6b76]" />
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-[108px] border-0 bg-transparent text-[12px] outline-none"
                    title={formatSlash(fromDate)}
                  />
                  <span className="text-[#9a9aa5]">→</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-[108px] border-0 bg-transparent text-[12px] outline-none"
                    title={formatSlash(toDate)}
                  />
                </label>
                <button
                  type="button"
                  onClick={goNewJournal}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0b400] px-4 py-2.5 text-[13px] font-bold text-[#1a1a1f]"
                  style={{ background: "#0f6d84" }}
                >
                  <Plus className="h-4 w-4" />
                  New Journal Entry
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setAddSubOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0b400] px-4 py-2.5 text-[13px] font-bold text-[#1a1a1f]"
                style={{ background: "#0f6d84" }}
              >
                <Plus className="h-4 w-4" />
                Add Sub-account
              </button>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-lg border border-[#e4e4ea] bg-[#f3f3f6] text-[#6b4eff] hover:bg-[#ececf0]"
              aria-label="More actions"
            >
              <MoreVertical className="h-4 w-4" strokeWidth={2.5} />
            </button>
            {menuOpen ? (
              <OverflowMenu
                onClose={() => setMenuOpen(false)}
                items={
                  tab === "journals"
                    ? [
                        {
                          label: "Add Sub-Account",
                          icon: <Plus className="h-4 w-4 text-[#8b8b96]" />,
                          onClick: () => setAddSubOpen(true),
                        },
                        {
                          label: "Edit Account",
                          icon: <Pencil className="h-4 w-4 text-[#8b8b96]" />,
                          onClick: () => setEditOpen(true),
                        },
                      ]
                    : [
                        {
                          label: "New Journal Entry",
                          icon: <Plus className="h-4 w-4 text-[#8b8b96]" />,
                          onClick: goNewJournal,
                        },
                        {
                          label: "Edit Account",
                          icon: <Pencil className="h-4 w-4 text-[#8b8b96]" />,
                          onClick: () => setEditOpen(true),
                        },
                      ]
                }
              />
            ) : null}
          </div>
        </div>

        <SummaryCards totals={totals} />

        {tab === "subs" ? (
          <div className="overflow-hidden rounded-xl border border-[#cfcfd6] bg-white">
            <div className="grid grid-cols-[1fr_160px] border-b border-[#cfcfd6] bg-[#fafafa] px-5 py-3 text-[12px] font-semibold uppercase tracking-wide text-[#6b6b76]">
              <div>Account Name</div>
              <div className="text-right">Balance</div>
            </div>
            {pageRows.length === 0 ? (
              <div className="px-5 py-14 text-center text-[14px] text-[#6b6b76]">
                No sub-accounts yet. Click “+ Add Sub-account” to create one.
              </div>
            ) : (
              <ul>
                {pageRows.map((row) => (
                  <li
                    key={row.id}
                    className="grid grid-cols-[1fr_160px] items-center border-b border-[#ececf0] px-5 py-3.5 last:border-b-0 hover:bg-[#fafafa]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-medium text-[#1a1a1f]">{row.name}</span>
                      {row.custom ? (
                        <User className="h-3.5 w-3.5 text-[#9a9aa5]" aria-label="Custom" />
                      ) : null}
                    </div>
                    <div className="text-right text-[14px] tabular-nums text-[#1a1a1f]">
                      {formatInr(row.balance)}{" "}
                      <span className="font-medium">{row.side || totals.side}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-[#cfcfd6] bg-[#fafafa] px-5 py-3">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={subs.length}
                onPage={setPage}
                onPageSize={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#cfcfd6] bg-white">
            <div className="ui-table-wrap ui-table-wrap--scroll !rounded-none !border-0">
              <table className="ui-table min-w-full border-collapse text-[13px]">
                <thead className="ui-table-head">
                  <tr>
                    <SerialNumberHeader />
                    {[
                      "Date",
                      "Voucher Number",
                      "Journal Entry Name",
                      "Narrations",
                      "Transaction Type",
                      "Debit",
                      "Credit",
                    ].map((h) => (
                      <th key={h} className="border-b border-[#cfcfd6] px-4 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {journalRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <div className="text-[14px] text-[#6b6b76]">
                          No Journal Entries available, Create new entry
                        </div>
                        <button
                          type="button"
                          onClick={goNewJournal}
                          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#e0b400] px-4 py-2.5 text-[13px] font-bold text-[#1a1a1f]"
                          style={{ background: "#0f6d84" }}
                        >
                          <Plus className="h-4 w-4" />
                          New Journal Entry
                        </button>
                      </td>
                    </tr>
                  ) : (
                    journalRows.map((j, rowIndex) => (
                      <tr key={j.id} className="hover:bg-[#fafafa]">
                        <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} />
                        <td className="border-b border-[#ececf0] px-4 py-3 whitespace-nowrap text-[#6b6b76]">
                          {formatSlash(j.date)}
                        </td>
                        <td className="border-b border-[#ececf0] px-4 py-3">{j.voucherNumber || "—"}</td>
                        <td className="border-b border-[#ececf0] px-4 py-3 font-medium text-[#1a1a1f]">
                          {j.name || "—"}
                        </td>
                        <td className="border-b border-[#ececf0] px-4 py-3 text-[#6b6b76]">
                          {j.narration || "—"}
                        </td>
                        <td className="border-b border-[#ececf0] px-4 py-3">
                          {j.transactionType || "Journal"}
                        </td>
                        <td className="border-b border-[#ececf0] px-4 py-3 text-right tabular-nums">
                          {formatInr(j.debit)}
                        </td>
                        <td className="border-b border-[#ececf0] px-4 py-3 text-right tabular-nums">
                          {formatInr(j.credit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredJournals.length > 0 ? (
              <div className="border-t border-[#cfcfd6] bg-[#fafafa] px-5 py-3">
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={filteredJournals.length}
                  onPage={setPage}
                  onPageSize={(n) => {
                    setPageSize(n);
                    setPage(1);
                  }}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>

      <CreateAccountModal
        open={editOpen}
        account={account}
        onClose={() => setEditOpen(false)}
        onSave={handleUpdateAccount}
      />

      <CreateAccountModal
        open={addSubOpen}
        asSubAccount
        defaultParentId={account.id}
        parentOptions={[account]}
        preset={{ type: account.type, group: account.group }}
        onClose={() => setAddSubOpen(false)}
        onSave={(payload) =>
          handleAddSub({
            ...payload,
            type: payload.type || account.type,
            group: payload.group || account.group,
            side: account.side,
          })
        }
      />
    </div>
  );
}
