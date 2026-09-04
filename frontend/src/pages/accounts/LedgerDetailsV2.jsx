import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Eye, Mail, MoreVertical, Trash2 } from "lucide-react";

import AdjustBalanceModal from "../../components/accounts/AdjustBalanceModal";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { SearchBar } from "../../components/common/SearchFilter";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import ContraEntryModal from "../../components/accounts/ContraEntryModal";
import DeleteBankModal from "../../components/accounts/DeleteBankModal";
import SendLedgerModal from "../../components/accounts/SendLedgerModal";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";
import { useToast } from "../../context/ToastContext";

const PAGE_BG = "var(--color-bg)";
const PAGE_SIZES = [10, 20, 50];
const CASH_KEY = "gns_ledger_cash_accounts_v2";
const OTHER_KEY = "gns_ledger_other_accounts_v3";

const DEFAULT_OTHER = [
  "Other",
  "Travel",
  "Taxes",
  "Shopping",
  "Recharge",
  "Personal Care",
  "Investments",
  "Health & Fitness",
  "Gifts & Decorations",
  "Food & Dining",
].map((name, i) => ({
  id: `other-${i + 1}`,
  name,
  account_type: "EXPENSE",
  account_group: "Indirect Expense",
  description: "",
  balance: 0,
}));

function formatDisplayDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadAccounts(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    /* ignore */
  }
  return fallback;
}

function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="ui-pagination justify-between border-t border-[var(--color-border-soft)] px-1 pt-4">
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

export default function LedgerDetailsV2() {
  const navigate = useNavigate();
  const location = useLocation();
  const { kind = "customer", id } = useParams();
  const { addToast } = useToast();
  const isMoneyLedger = kind === "cash" || kind === "other";
  const storageKey = kind === "other" ? OTHER_KEY : CASH_KEY;
  const defaultAccounts =
    kind === "other"
      ? DEFAULT_OTHER
      : [{ id: "cash-1", name: "Cash", account_type: "CASH", description: "", balance: 0 }];

  const [ledgerAccounts, setLedgerAccounts] = useState(() =>
    isMoneyLedger ? loadAccounts(storageKey, defaultAccounts) : []
  );

  useEffect(() => {
    if (!isMoneyLedger) return;
    setLedgerAccounts(loadAccounts(storageKey, defaultAccounts));
  }, [kind, storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentAccount = useMemo(
    () => ledgerAccounts.find((a) => String(a.id) === String(id)),
    [ledgerAccounts, id]
  );

  const partyName =
    currentAccount?.name ||
    location.state?.name ||
    new URLSearchParams(location.search).get("name") ||
    "Ledger";

  const [balance, setBalance] = useState(() =>
    Number(currentAccount?.balance ?? location.state?.balance ?? 0)
  );

  useEffect(() => {
    if (currentAccount) setBalance(Number(currentAccount.balance || 0));
  }, [currentAccount]);

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("2020-01-01");
  const [toDate, setToDate] = useState(todayIso());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [contraOpen, setContraOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState(null);
  const [menuRowId, setMenuRowId] = useState(null);

  const [transactions, setTransactions] = useState([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t) =>
      `${t.voucher_no} ${t.particulars} ${t.voucher_type}`.toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const total = filtered.length;
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openingSide = balance <= 0 ? "debit" : "credit";
  const closingSide = balance >= 0 ? "credit" : "debit";
  const balanceAbs = Math.abs(balance).toFixed(2);

  const exportCols = [
    { key: "voucher_date", label: "Voucher Date" },
    { key: "voucher_no", label: "Voucher No." },
    { key: "particulars", label: "Particulars" },
    { key: "voucher_type", label: "Voucher Type" },
    { key: "debit", label: "Debit" },
    { key: "credit", label: "Credit" },
  ];

  const persistAccounts = (next) => {
    setLedgerAccounts(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    const mine = next.find((a) => String(a.id) === String(id));
    if (mine) setBalance(Number(mine.balance || 0));
  };

  const onPdf = () => {
    exportToPdf(filtered, exportCols, `Ledger - ${partyName}`, `ledger-${id || "party"}`);
    addToast("PDF exported.");
  };

  const onExcel = () => {
    exportToExcel(filtered, exportCols, `ledger-${id || "party"}`);
    addToast("Excel exported.");
  };

  const onAdjust = ({ accountId, type, amount, remark, date, voucherNo }) => {
    const next = ledgerAccounts.map((a) => {
      if (a.id !== accountId) return a;
      const bal = Number(a.balance || 0);
      return {
        ...a,
        balance: type === "add" ? bal + amount : bal - amount,
        description: remark || a.description,
      };
    });
    persistAccounts(next);
    setTransactions((prev) => [
      {
        id: `txn-${Date.now()}`,
        voucher_date: date,
        voucher_no: voucherNo || String(prev.length + 1),
        particulars: remark || (type === "add" ? "Add Money" : "Withdraw Money"),
        voucher_type: type === "add" ? "Receipt" : "Payment",
        debit: type === "withdraw" ? amount : 0,
        credit: type === "add" ? amount : 0,
      },
      ...prev,
    ]);
    addToast(type === "add" ? "Money added." : "Money withdrawn.");
  };

  const onContra = ({ fromId, toId, amount, remark, date, voucherNo }) => {
    const next = ledgerAccounts.map((a) => {
      if (a.id === fromId) return { ...a, balance: Number(a.balance || 0) - amount };
      if (a.id === toId) return { ...a, balance: Number(a.balance || 0) + amount };
      return a;
    });
    persistAccounts(next);
    setTransactions((prev) => [
      {
        id: `txn-${Date.now()}`,
        voucher_date: date,
        voucher_no: voucherNo || String(prev.length + 1),
        particulars: remark || "Contra Entry",
        voucher_type: "Contra",
        debit: fromId === id ? amount : 0,
        credit: toId === id ? amount : 0,
      },
      ...prev,
    ]);
    addToast("Contra entry saved.");
  };

  const backToLedger = () => navigate("/accounts/ledger");

  const darkBtn =
    "rounded-lg bg-[#0f6d84] px-3 py-2.5 text-[13px] font-bold text-white hover:bg-[#1a1a1f]";
  const outlineBtn =
    "inline-flex items-center gap-1.5 rounded-lg border border-[#e4e4ea] bg-white px-3 py-2.5 text-[13px] font-bold text-[#1a1a1f] hover:bg-[#fafafa]";

  return (
    <div className="min-h-full" style={{ background: PAGE_BG }}>
      <div className="flex items-center gap-2 px-4 pt-4 sm:px-6 sm:pt-6">
        <button
          type="button"
          onClick={backToLedger}
          className="grid h-8 w-8 place-items-center rounded-full text-[#1a1a1f] hover:bg-black/5"
          aria-label="Back to ledger"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-4 mb-6 mt-4 rounded-2xl border border-[#e4e4ea] bg-white p-4 sm:mx-6 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={backToLedger}
              className="grid h-8 w-8 place-items-center rounded-full text-[#1a1a1f] hover:bg-black/5"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-[16px] font-bold text-[#1a1a1f]">Summary Of Transactions</h2>
          </div>
          <p className="text-[15px] font-bold text-[#1a1a1f]">{partyName}</p>
        </div>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
            <SearchBar
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              placeholder="Search"
              className="max-w-xs w-full"
            />
            <label className="block text-[12px] font-medium text-[#6b6b76]">
              From Date
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="ui-input mt-1 block w-full min-w-[150px]"
              />
            </label>
            <label className="block text-[12px] font-medium text-[#6b6b76]">
              To Date
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="ui-input mt-1 block w-full min-w-[150px]"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isMoneyLedger ? (
              <>
                <button type="button" className={darkBtn} onClick={() => setAdjustOpen(true)}>
                  Add/Withdraw Money
                </button>
                <button type="button" className={darkBtn} onClick={() => setContraOpen(true)}>
                  Contra Entry
                </button>
                <button
                  type="button"
                  className={outlineBtn}
                  onClick={() => addToast("Contra Report coming soon.", "info")}
                >
                  Contra Report
                </button>
              </>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCreateOpen((v) => !v)}
                  className={`${darkBtn} inline-flex items-center gap-1.5`}
                >
                  Create <ChevronDown className="h-4 w-4" />
                </button>
                {createOpen ? (
                  <div className="absolute right-0 z-20 mt-1 min-w-[170px] overflow-hidden rounded-md border border-[#e4e4ea] bg-white py-1 shadow-lg">
                    {[
                      { label: "Invoice", to: "/sales/invoices/create" },
                      { label: "Payment Receipt", to: "/sales/payments/create" },
                      { label: "Credit Note", to: "/sales/credit-notes/create" },
                    ].map(({ label, to }) => (
                      <button
                        key={label}
                        type="button"
                        className="block w-full px-3 py-2.5 text-left text-[13px] text-[#1a1a1f] hover:bg-[#f5f5f7]"
                        onClick={() => {
                          setCreateOpen(false);
                          navigate(to, {
                            state: {
                              fromLedger: true,
                              partyKind: kind,
                              partyId: id,
                              partyName,
                            },
                          });
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
            <ExportDownloadMenu
              disabled={!filtered.length}
              onExport={(format) => (format === "pdf" ? onPdf() : onExcel())}
            />
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px] font-semibold text-[#1a1a1f]">
          <span>Opening Balance as on Date : {formatDisplayDate(fromDate)}</span>
          <span>
            {balanceAbs} ({isMoneyLedger ? openingSide : balance >= 0 ? "credit" : "debit"})
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#e4e4ea]">
          <table className="min-w-full border-collapse text-left text-[13px]">
            <thead className="ui-table-head">
              <tr>
                <SerialNumberHeader />
                {[
                  "Voucher Date",
                  "Voucher No.",
                  "Particulars",
                  "Voucher Type",
                  "Debit",
                  "Credit",
                  "Action",
                ].map((h) => (
                  <th key={h} className="border-b border-[#e4e4ea] px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center text-sm text-[#9a9aa5]">
                    No data available
                  </td>
                </tr>
              ) : (
                pageRows.map((row, rowIndex) => (
                  <tr key={row.id} className="border-b border-[#ececf0] hover:bg-[#fafafa]">
                    <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} />
                    <td className="px-4 py-3">{formatDisplayDate(row.voucher_date)}</td>
                    <td className="px-4 py-3">{row.voucher_no}</td>
                    <td className="px-4 py-3 font-semibold">{row.particulars}</td>
                    <td className="px-4 py-3">{row.voucher_type}</td>
                    <td className="px-4 py-3 tabular-nums">{Number(row.debit || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 tabular-nums">{Number(row.credit || 0).toFixed(2)}</td>
                    <td className="relative px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          title="View"
                          className="grid h-8 w-8 place-items-center rounded-full bg-[#0f6d84] text-white"
                          onClick={() => {
                            const type = String(row.voucher_type || "").toLowerCase();
                            if (type.includes("journal") || type.includes("contra")) {
                              navigate("/accounts/journal-entries", {
                                state: { highlight: row.voucher_no, transaction: row },
                              });
                              return;
                            }
                            if (type.includes("receipt") || type.includes("payment")) {
                              navigate(
                                type.includes("receipt")
                                  ? "/sales/payment-receipts"
                                  : "/purchases/payments-made",
                                { state: { highlight: row.voucher_no, transaction: row } }
                              );
                              return;
                            }
                            addToast(
                              `${row.voucher_no}: ${row.particulars} · Dr ${Number(row.debit || 0).toFixed(2)} / Cr ${Number(row.credit || 0).toFixed(2)}`,
                              "info"
                            );
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="More"
                          className="grid h-8 w-8 place-items-center rounded-full bg-[#0f6d84] text-white"
                          onClick={() => setMenuRowId((v) => (v === row.id ? null : row.id))}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {menuRowId === row.id ? (
                        <div className="absolute right-4 top-12 z-20 min-w-[180px] overflow-hidden rounded-md border border-[#e4e4ea] bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#f5f5f7]"
                            onClick={() => {
                              setMenuRowId(null);
                              setDeleteRow(row);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-[#6b6b76]" />
                            Delete Transaction
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#f5f5f7]"
                            onClick={() => {
                              setMenuRowId(null);
                              setSendOpen(true);
                            }}
                          >
                            <Mail className="h-4 w-4 text-[#6b6b76]" />
                            Send Ledger
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] font-semibold text-[#1a1a1f]">
          <span>Closing Balance as on Date : {formatDisplayDate(toDate)}</span>
          <span>
            {balanceAbs} ({isMoneyLedger ? closingSide : balance >= 0 ? "credit" : "debit"})
          </span>
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPage={setPage}
          onPageSize={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </div>

      {isMoneyLedger ? (
        <>
          <AdjustBalanceModal
            open={adjustOpen}
            onClose={() => setAdjustOpen(false)}
            accounts={ledgerAccounts}
            preferredAccountId={id}
            onConfirm={onAdjust}
          />
          <ContraEntryModal
            open={contraOpen}
            onClose={() => setContraOpen(false)}
            accounts={ledgerAccounts}
            preferredFromId={id}
            onConfirm={onContra}
          />
        </>
      ) : null}

      <SendLedgerModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        partyName={partyName}
        partyEmail=""
      />
      <DeleteBankModal
        open={Boolean(deleteRow)}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction?"
        onClose={() => setDeleteRow(null)}
        onConfirm={() => {
          setTransactions((prev) => prev.filter((t) => t.id !== deleteRow?.id));
          addToast("Transaction deleted.");
        }}
      />
    </div>
  );
}
