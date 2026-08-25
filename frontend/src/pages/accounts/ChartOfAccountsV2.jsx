import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, Download, MoreVertical, Pencil, Plus, User } from "lucide-react";

import CreateAccountModal from "../../components/accounts/CreateAccountModal";
import {
  AccountsCard,
  AccountsPageShell,
  AccountsPagination,
  AccountsAddButton,
  AccountsSearchInput,
  AccountsSecondaryButton,
  AccountsTabs,
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
import { COA_TABS } from "../../data/chartOfAccounts";
import {
  createChartAccount,
  createSubAccount,
  fetchChartOfAccounts,
  updateChartAccount,
} from "../../api/chartOfAccountsSync";
import { exportToCsv } from "../../utils/exportUtils";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";

const SORT_OPTIONS = [
  { id: "name-asc", label: "Alphabetically (A-Z)" },
  { id: "name-desc", label: "Alphabetically (Z-A)" },
  { id: "updated-desc", label: "Last Updated Date (Newest First)" },
  { id: "updated-asc", label: "Last Updated Date (Oldest First)" },
  { id: "balance-desc", label: "Balance (High to Low)" },
  { id: "balance-asc", label: "Balance (Low to High)" },
];

function updatedTs(account) {
  if (account?.updatedAt) return new Date(account.updatedAt).getTime() || 0;
  return 0;
}

function accountRowKey(account) {
  return String(account?.apiId ?? account?.id ?? "");
}

function sortAccounts(list, sortId) {
  const next = [...list];
  next.sort((a, b) => {
    const nameA = a?.name || "";
    const nameB = b?.name || "";
    switch (sortId) {
      case "name-desc":
        return nameB.localeCompare(nameA, undefined, { sensitivity: "base" });
      case "updated-desc":
        return updatedTs(b) - updatedTs(a);
      case "updated-asc":
        return updatedTs(a) - updatedTs(b);
      case "balance-desc":
        return (Number(b.balance) || 0) - (Number(a.balance) || 0);
      case "balance-asc":
        return (Number(a.balance) || 0) - (Number(b.balance) || 0);
      case "name-asc":
      default:
        return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    }
  });
  return next;
}

function SortByMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <AccountsSecondaryButton type="button" onClick={() => setOpen((v) => !v)}>
        <ArrowUpDown className="h-4 w-4" />
        Sort By
      </AccountsSecondaryButton>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 min-w-[260px] rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-lg">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2.5 text-left text-[13px] hover:bg-[#F8FAFC] ${
                value === opt.id ? "bg-[#F2F0FF] font-semibold text-[#17264A]" : "text-[#17264A]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatBalance(amount, side) {
  return { text: formatAccountsInr(amount), side: side || "DR" };
}

function RowMenu({ account, onAddSub, onEdit, onClose }) {
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
      className="absolute right-0 top-full z-30 mt-1 min-w-[190px] rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-lg"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-[#17264A] hover:bg-[#F8FAFC]"
        onClick={() => {
          onAddSub?.(account);
          onClose?.();
        }}
      >
        <Plus className="h-4 w-4 text-[#64748B]" />
        Add Sub-account
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-[#17264A] hover:bg-[#F8FAFC]"
        onClick={() => {
          onEdit?.(account);
          onClose?.();
        }}
      >
        <Pencil className="h-4 w-4 text-[#64748B]" />
        Edit Account
      </button>
    </div>
  );
}

export default function ChartOfAccountsV2() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [subParent, setSubParent] = useState(null);
  const [menuId, setMenuId] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const rows = await fetchChartOfAccounts();
      setAccounts(rows);
    } catch (err) {
      setAccounts([]);
      if (!isRefresh) addToast(apiErrorMessage(err, "Failed to load chart of accounts"), "error");
      if (isRefresh) throw err;
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = accounts.filter((a) => {
      if (tab !== "all" && a.type !== tab) return false;
      if (!q) return true;
      return `${a.name} ${a.type} ${a.group} ${a.description || ""}`.toLowerCase().includes(q);
    });
    return sortAccounts(list, sortBy);
  }, [accounts, tab, search, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [tab, search, pageSize, sortBy]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handleSave = async (payload) => {
    try {
      if (editing) {
        if (!editing.apiId) {
          addToast("Cannot update unsynced account", "error");
          return;
        }
        await updateChartAccount(editing.apiId, { ...editing, ...payload });
        addToast("Account updated", "success");
        setEditing(null);
        setModalOpen(false);
        await load();
        return;
      }

      if (payload.isSubAccount && payload.parentId) {
        await createSubAccount(payload.parentId, {
          id: payload.id,
          name: payload.name,
          balance: payload.balance || 0,
          side: payload.side || "DR",
          type: payload.type || "Asset",
        });
        addToast("Sub-account created", "success");
      } else {
        await createChartAccount({
          id: payload.id || `acc-${Date.now()}`,
          name: payload.name,
          type: payload.type,
          group: payload.group,
          balance: payload.balance || 0,
          side: payload.side || "DR",
        });
        addToast("Account created", "success");
      }
      setEditing(null);
      setSubParent(null);
      setModalOpen(false);
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to save account"), "error");
    }
  };

  const handleExport = () => {
    const columns = [
      { key: "name", label: "Accounts" },
      { key: "type", label: "Account Type" },
      { key: "group", label: "Groups" },
      { key: "balance", label: "Balance" },
      { key: "side", label: "Side" },
      { key: "childCount", label: "Sub Accounts" },
    ];
    exportToCsv(filtered, columns, "chart-of-accounts");
    addToast("Exported CSV", "success");
  };

  if (loading) {
    return (
      <AccountsPageShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader label="Loading chart of accounts…" />
        </div>
      </AccountsPageShell>
    );
  }

  return (
    <AccountsPageShell>
      <AccountsCard>
        <AccountsTabs tabs={COA_TABS} active={tab} onChange={setTab} />

        <div className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <AccountsSearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="flex-1"
            />
            <AccountsAddButton
              onClick={() => {
                setEditing(null);
                setSubParent(null);
                setModalOpen(true);
              }}
            >
              Create Account
            </AccountsAddButton>
            <SortByMenu value={sortBy} onChange={setSortBy} />
            <AccountsSecondaryButton type="button" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export (csv)
            </AccountsSecondaryButton>
          </div>

          <div className={accountsTableWrapClass}>
            <table className={accountsTableClass}>
              <thead className={accountsTableHeadClass}>
                <tr>
                  <SerialNumberHeader className={accountsThClass} />
                  <th className={`${accountsThClass} min-w-[240px]`}>Accounts</th>
                  <th className={`${accountsThClass} min-w-[180px]`}>Account Type / Groups</th>
                  <th className={`${accountsThClass} min-w-[140px] text-right`}>Balance</th>
                  <th className={`${accountsThClass} w-[72px] text-center`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`${accountsTdClass} py-16 text-center text-[#64748B]`}>
                      No accounts found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((a, rowIndex) => {
                    const rowKey = accountRowKey(a);
                    const bal = formatBalance(a.balance, a.side);
                    const isCr = bal.side === "CR";
                    return (
                      <tr
                        key={rowKey}
                        className="cursor-pointer hover:bg-[#F8FAFC]"
                        onClick={() => navigate(`/accounts/chart-of-accounts/${a.id}`)}
                      >
                        <SerialNumberCell
                          rowIndex={rowIndex}
                          page={page}
                          pageSize={pageSize}
                          className={accountsTdClass}
                        />
                        <td className={accountsTdClass}>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-[#17264A]">{a.name}</span>
                            {a.custom ? (
                              <User className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" aria-label="Custom" />
                            ) : null}
                          </div>
                          {a.childCount ? (
                            <div className="mt-0.5 text-[12px] text-[#94A3B8]">
                              {a.childCount} accounts
                            </div>
                          ) : null}
                        </td>
                        <td className={accountsTdClass}>
                          <div className="font-semibold text-[#17264A]">{a.type}</div>
                          <div className="text-[12px] text-[#64748B]">{a.group}</div>
                        </td>
                        <td className={`${accountsTdClass} text-right tabular-nums`}>
                          <span className="text-[#17264A]">{bal.text}</span>{" "}
                          <span
                            className={
                              isCr ? "font-medium text-[#e11d48]" : "font-medium text-[#17264A]"
                            }
                          >
                            {bal.side}
                          </span>
                        </td>
                        <td
                          className={`${accountsTdClass} relative text-center`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setMenuId((id) => (id === rowKey ? null : rowKey))}
                            className={accountsRowActionClass}
                            aria-label="Actions"
                          >
                            <MoreVertical className="h-4 w-4" strokeWidth={2.5} />
                          </button>
                          {menuId === rowKey ? (
                            <RowMenu
                              account={a}
                              onAddSub={(acc) => {
                                setEditing(null);
                                setSubParent(acc);
                                setModalOpen(true);
                              }}
                              onEdit={(acc) => {
                                setSubParent(null);
                                setEditing(acc);
                                setModalOpen(true);
                              }}
                              onClose={() => setMenuId(null)}
                            />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
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

      <CreateAccountModal
        open={modalOpen}
        account={editing}
        asSubAccount={Boolean(subParent) && !editing}
        defaultParentId={subParent?.id || ""}
        parentOptions={accounts}
        preset={
          subParent && !editing
            ? { type: subParent.type, group: subParent.group }
            : null
        }
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          setSubParent(null);
        }}
        onSave={handleSave}
      />
    </AccountsPageShell>
  );
}
