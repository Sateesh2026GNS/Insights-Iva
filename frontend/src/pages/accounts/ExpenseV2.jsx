import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Eye,
  FileSpreadsheet,
  FileText,
  Pencil,
  Settings,
  Trash2,
} from "lucide-react";

import AddExpenseModal from "../../components/accounts/AddExpenseModal";
import {
  AccountsCard,
  AccountsPageShell,
  AccountsPagination,
  AccountsPrimaryButton,
  AccountsSearchInput,
  AccountsSecondaryButton,
  AccountsTabs,
  ACCOUNTS_BLUE,
  ACCOUNTS_TEAL,
  accountsTableClass,
  accountsTableHeadAltClass,
  accountsTableWrapClass,
  accountsTdClass,
  accountsThClass,
  formatAccountsInr,
} from "../../components/accounts/accountsDesignSystem";
import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { fetchExpenseCategories } from "../../data/expenseCategories";
import { createExpense, deleteExpense, listExpenses, updateExpense } from "../../api/accountsApi";
import { exportToCsv, exportToExcel, exportToPdf } from "../../utils/exportUtils";
import { useToast } from "../../context/ToastContext";
import useTenantId from "../../hooks/useTenantId";
import usePageRefresh from "../../hooks/usePageRefresh";
import { apiErrorMessage, asArray } from "../../utils/apiError";

const EXPENSE_TABS = [
  { id: "all", label: "All Expenses" },
  { id: "category", label: "Category Wise" },
];

const CHART_COLORS = ["#7C3AED", "#2563EB", "#EA580C", "#16A34A", "#9333EA", "#0D9488", "#EAB308", "#EC4899"];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoIso(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

function formatPaymentMode(mode) {
  const m = String(mode || "").toUpperCase();
  if (m === "UPI") return "UPI";
  if (m === "NET BANKING" || m === "BANK TRANSFER") return "Bank Transfer";
  if (m === "CASH") return "Cash";
  if (m === "CHEQUE") return "Cheque";
  return mode || "—";
}

function parseExpenseMeta(description) {
  const raw = String(description || "");
  if (raw.startsWith("{")) {
    try {
      return JSON.parse(raw);
    } catch {
      /* fall through */
    }
  }
  const parts = raw.split("|||");
  if (parts.length >= 2) {
    return { payment_mode: parts[0], note: parts.slice(1).join("|||") };
  }
  return { payment_mode: "CASH", note: raw };
}

function resolveExpenseTag(categoryName, categoryId, categories) {
  const cat = categories.find((c) => c.id === categoryId || c.name === categoryName);
  const name = (cat?.name || categoryName || "Other").toLowerCase();
  if (name.includes("travel")) return { abbr: "TRV", bg: "#EDE9FE", color: "#7C3AED" };
  if (name.includes("office")) return { abbr: "OFF", bg: "#DBEAFE", color: "#2563EB" };
  if (name.includes("food") || name.includes("meal") || name.includes("dining")) {
    return { abbr: "FOD", bg: "#FFEDD5", color: "#EA580C" };
  }
  if (name.includes("fuel")) return { abbr: "FUEL", bg: "#DCFCE7", color: "#16A34A" };
  if (name.includes("other")) return { abbr: "OTH", bg: "#EDE9FE", color: "#9333EA" };
  const abbr =
    (cat?.name || categoryName || "OTH")
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 3)
      .toUpperCase() || "OTH";
  const color = cat?.color || "#64748B";
  return { abbr, bg: "#F3F4F6", color };
}

function ExpenseTagBadge({ category, categoryId, categories }) {
  const tag = resolveExpenseTag(category, categoryId, categories);
  return (
    <span
      className="inline-flex min-w-[2.5rem] items-center justify-center rounded-md px-2 py-1 text-[11px] font-bold tracking-wide"
      style={{ backgroundColor: tag.bg, color: tag.color }}
    >
      {tag.abbr}
    </span>
  );
}

function mapApiExpense(row) {
  const meta = parseExpenseMeta(row.description);
  const category = row.category || "Other";
  return {
    id: row.id,
    tag: category,
    category,
    category_id: meta.category_id || String(category).toLowerCase().replace(/\s+/g, "-"),
    date: row.expense_date ? String(row.expense_date).slice(0, 10) : "",
    spend_for: row.vendor || meta.note || "—",
    payment_mode: meta.payment_mode || "CASH",
    note: meta.note || "",
    amount: Number(row.amount) || 0,
  };
}

function ExpenseActionIcons({ onView, onEdit, onDelete }) {
  const circleBtn =
    "grid h-8 w-8 shrink-0 place-items-center rounded-full transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6C4CFF]";

  return (
    <div className="flex min-w-[7rem] items-center justify-end gap-1.5">
      <button
        type="button"
        title="View"
        onClick={onView}
        className={`${circleBtn} text-white`}
        style={{ backgroundColor: ACCOUNTS_TEAL }}
      >
        <Eye className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Edit"
        onClick={onEdit}
        className={`${circleBtn} text-white`}
        style={{ backgroundColor: ACCOUNTS_BLUE }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Delete"
        onClick={onDelete}
        className={`${circleBtn} bg-[#FEE2E2] text-[#EF4444] hover:opacity-100`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CategoryDonutChart({ rows, total }) {
  const chartData = rows.map((row, index) => ({
    name: row.category,
    value: row.amount,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  if (!rows.length) {
    return (
      <p className="py-16 text-center text-sm text-[#64748B]">No category data for the selected range.</p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative h-52 w-52 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatAccountsInr(value)}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[11px] font-medium text-[#64748B]">Total</p>
          <p className="text-[15px] font-bold text-[#17264A]">{formatAccountsInr(total)}</p>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-3 text-[13px]">
        {chartData.map((item) => {
          const pct = total ? ((item.value / total) * 100).toFixed(2) : "0.00";
          return (
            <li key={item.name} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                <span className="truncate text-[#17264A]">{item.name}</span>
              </span>
              <span className="shrink-0 text-right tabular-nums text-[#64748B]">
                {formatAccountsInr(item.value)}
                <span className="ml-2 text-[#94A3B8]">{pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ExpenseV2() {
  const { addToast } = useToast();
  const tenantId = useTenantId();
  const [tab, setTab] = useState("all");
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(daysAgoIso(36));
  const [toDate, setToDate] = useState(todayIso());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [addOpen, setAddOpen] = useState(false);
  const [editExpense, setEditExpense] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [expRes, cats] = await Promise.all([listExpenses(tenantId), fetchExpenseCategories()]);
      setExpenses(asArray(expRes.data).map(mapApiExpense));
      setCategories(cats);
    } catch (err) {
      setExpenses([]);
      addToast(apiErrorMessage(err, "Failed to load expenses"), "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, tenantId]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const inRange = (date) => {
    if (!date) return true;
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;
    return true;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (!inRange(e.date)) return false;
      if (!q) return true;
      return `${e.tag} ${e.category} ${e.spend_for} ${e.payment_mode} ${formatPaymentMode(e.payment_mode)}`
        .toLowerCase()
        .includes(q);
    });
  }, [expenses, search, fromDate, toDate]);

  const categoryRows = useMemo(() => {
    const map = new Map();
    filtered.forEach((e) => {
      const key = e.category_id || e.category || "other";
      const prev = map.get(key) || {
        id: key,
        category: e.category || "Other",
        tag: e.tag || e.category || "Other",
        category_id: key,
        count: 0,
        amount: 0,
      };
      prev.count += 1;
      prev.amount += Number(e.amount || 0);
      map.set(key, prev);
    });
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  const categoryTotal = useMemo(
    () => categoryRows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [categoryRows]
  );

  const pageRows =
    tab === "all"
      ? filtered.slice((page - 1) * pageSize, page * pageSize)
      : categoryRows.slice((page - 1) * pageSize, page * pageSize);
  const total = tab === "all" ? filtered.length : categoryRows.length;

  const expensePayload = (row) => ({
    tenant_id: tenantId,
    category: row.category || row.tag || "Other",
    vendor: row.spend_for || null,
    amount: Number(row.amount) || 0,
    expense_date: row.date,
    description: JSON.stringify({
      payment_mode: row.payment_mode || "CASH",
      note: row.note || "",
      category_id: row.category_id || null,
    }),
  });

  const onSaveExpense = async (row) => {
    try {
      if (row.id && editExpense?.id) {
        await updateExpense(row.id, expensePayload(row));
        addToast("Expense updated.", "success");
      } else {
        await createExpense(expensePayload(row));
        addToast("Expense added.", "success");
      }
      setEditExpense(null);
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to save expense"), "error");
    }
  };

  const onDeleteExpense = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete expense "${row.spend_for}"?`)) return;
    try {
      await deleteExpense(row.id);
      addToast("Expense deleted", "success");
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete expense"), "error");
    }
  };

  const exportColsAll = [
    { key: "tag", label: "Tag" },
    { key: "category", label: "Category" },
    { key: "date", label: "Date" },
    { key: "spend_for", label: "Spend For" },
    { key: "payment_mode", label: "Payment Mode" },
    { key: "amount", label: "Amount" },
  ];

  const onPdf = () => {
    if (tab === "all") exportToPdf(filtered, exportColsAll, "Expenses", "expenses");
    else
      exportToPdf(
        categoryRows,
        [
          { key: "tag", label: "Tag" },
          { key: "category", label: "Category" },
          { key: "count", label: "No of Expenses" },
          { key: "amount", label: "Amount" },
        ],
        "Category Wise Expenses",
        "expenses-category"
      );
    addToast("PDF exported.");
  };

  const onExcel = () => {
    if (tab === "all") exportToExcel(filtered, exportColsAll, "expenses");
    else
      exportToCsv(
        categoryRows,
        [
          { key: "tag", label: "Tag" },
          { key: "category", label: "Category" },
          { key: "count", label: "No of Expenses" },
          { key: "amount", label: "Amount" },
        ],
        "expenses-category"
      );
    addToast("Excel exported.");
  };

  if (loading) {
    return (
      <AccountsPageShell>
        <Loader label="Loading expenses…" />
      </AccountsPageShell>
    );
  }

  return (
    <AccountsPageShell>
      <div className="mb-4">
        <Link
          to="/accounts/expenses/settings"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f6d84] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#0c5a6d]"
        >
          <Settings className="h-4 w-4" aria-hidden /> Settings
        </Link>
      </div>

      <AccountsCard>
        <AccountsTabs
          tabs={EXPENSE_TABS}
          active={tab}
          onChange={(id) => {
            setTab(id);
            setPage(1);
          }}
        />

        <div className="p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <AccountsSearchInput
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search"
                className="flex-1"
              />
              <div className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] text-[#17264A]">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="outline-none"
                  aria-label="From date"
                />
                <span className="text-[#94A3B8]">→</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="outline-none"
                  aria-label="To date"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AccountsPrimaryButton
                onClick={() => {
                  setEditExpense(null);
                  setAddOpen(true);
                }}
              >
                + Add Expense
              </AccountsPrimaryButton>
              <AccountsSecondaryButton type="button" onClick={onPdf}>
                <FileText className="h-4 w-4 text-[#EF4444]" aria-hidden /> PDF
              </AccountsSecondaryButton>
              <AccountsSecondaryButton type="button" onClick={onExcel}>
                <FileSpreadsheet className="h-4 w-4 text-[#22C55E]" aria-hidden /> Excel
              </AccountsSecondaryButton>
            </div>
          </div>

          {tab === "all" ? (
            <>
              <div className={accountsTableWrapClass}>
                <table className={`min-w-[980px] ${accountsTableClass}`}>
                  <thead className={accountsTableHeadAltClass}>
                    <tr>
                      <SerialNumberHeader className="px-3 py-3" />
                      {["Tag", "Category", "Date", "Spend For", "Payment Mode", "Amount", "Action"].map((h) => (
                        <th
                          key={h}
                          className={`${accountsThClass} ${h === "Action" ? "w-[9rem] text-right" : ""}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-14 text-center text-sm text-[#64748B]">
                          No expenses found for the selected range.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, rowIndex) => (
                        <tr key={row.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                          <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="px-3 py-3.5" />
                          <td className="px-4 py-3.5">
                            <ExpenseTagBadge
                              category={row.category}
                              categoryId={row.category_id}
                              categories={categories}
                            />
                          </td>
                          <td className="px-4 py-3.5 font-medium text-[#17264A]">{row.category}</td>
                          <td className="px-4 py-3.5 text-[#64748B]">{formatDisplayDate(row.date)}</td>
                          <td className="px-4 py-3.5 font-semibold text-[#17264A]">{row.spend_for}</td>
                          <td className="px-4 py-3.5 text-[#64748B]">{formatPaymentMode(row.payment_mode)}</td>
                          <td className="px-4 py-3.5">
                            <span className="tabular-nums font-bold text-[#FF3B30]">{formatAccountsInr(row.amount)}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <ExpenseActionIcons
                              onView={() =>
                                addToast(
                                  `${row.spend_for} · ${row.category} · ${formatAccountsInr(row.amount)} · ${formatPaymentMode(row.payment_mode)}${row.note ? ` · ${row.note}` : ""}`,
                                  "info"
                                )
                              }
                              onEdit={() => {
                                setEditExpense(row);
                                setAddOpen(true);
                              }}
                              onDelete={() => onDeleteExpense(row)}
                            />
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
                total={total}
                onPage={setPage}
                onPageSize={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
              />
            </>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className={accountsTableWrapClass}>
                  <table className={accountsTableClass}>
                    <thead className={accountsTableHeadAltClass}>
                      <tr>
                        <SerialNumberHeader className="px-3 py-3" />
                        {["Tag", "Category", "No of Expenses", "Amount"].map((h) => (
                          <th key={h} className={accountsThClass}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-14 text-center text-sm text-[#64748B]">
                            No data available
                          </td>
                        </tr>
                      ) : (
                        pageRows.map((row, rowIndex) => (
                          <tr key={row.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                            <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="px-3 py-3.5" />
                            <td className="px-4 py-3.5">
                              <ExpenseTagBadge
                                category={row.category}
                                categoryId={row.category_id}
                                categories={categories}
                              />
                            </td>
                            <td className="px-4 py-3.5 font-semibold text-[#17264A]">{row.category}</td>
                            <td className="px-4 py-3.5 text-[#64748B]">{row.count}</td>
                            <td className="px-4 py-3.5">
                              <span className="tabular-nums font-bold text-[#FF3B30]">{formatAccountsInr(row.amount)}</span>
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
                  total={total}
                  onPage={setPage}
                  onPageSize={(n) => {
                    setPageSize(n);
                    setPage(1);
                  }}
                />
              </div>

              <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
                <div className="bg-[#DBEAFE] px-4 py-3 text-[14px] font-bold text-[#17264A]">
                  Category Wise Expense Chart
                </div>
                <CategoryDonutChart rows={categoryRows} total={categoryTotal} />
              </div>
            </div>
          )}
        </div>
      </AccountsCard>

      <AddExpenseModal
        open={addOpen}
        expense={editExpense}
        onClose={() => {
          setAddOpen(false);
          setEditExpense(null);
        }}
        categories={categories}
        onSave={onSaveExpense}
      />
    </AccountsPageShell>
  );
}
