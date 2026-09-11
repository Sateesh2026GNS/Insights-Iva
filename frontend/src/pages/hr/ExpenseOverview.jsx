import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileCheck,
  FileText,
  Filter,
  PieChart as PieChartIcon,
  Plus,
  Receipt,
  Search,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import {
  createMyExpense,
  getExpenseOverview,
  getMyExpenses,
} from "../../api/hrApi";
import "./expenseOverview.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CATEGORY_OPTIONS = [
  { value: "", label: "Select Expense Category" },
  { value: "travel", label: "Travel & Fuel" },
  { value: "food", label: "Food & Dining" },
  { value: "accommodation", label: "Accommodation" },
  { value: "supplies", label: "Office Supplies" },
  { value: "maintenance", label: "Equipment & Maintenance" },
  { value: "other", label: "Other" },
];

const CATEGORY_COLORS = ["#2563eb", "#0d9488", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#64748b"];

function formatAmount(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "₹ 0";
  return `₹ ${n.toLocaleString("en-IN")}`;
}

function formatDisplayDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function StatusBadge({ status }) {
  const s = String(status || "pending").toLowerCase();
  if (s === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
        <CheckCircle2 className="h-3 w-3" />
        Approved
      </span>
    );
  }
  if (s === "rejected" || s === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
        <AlertCircle className="h-3 w-3" />
        {s === "cancelled" ? "Cancelled" : "Rejected"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
      <Clock className="h-3 w-3" />
      Pending
    </span>
  );
}

function QuickAddExpenseDrawer({ open, onClose, onSave }) {
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (!open) return;
    setCategory("");
    setName("");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setAmount("");
    setDetails("");
    setReceipt(null);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category || !name.trim() || !expenseDate || !amount) {
      addToast("Please fill in all required fields", "error");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        category,
        name: name.trim(),
        expense_date: expenseDate,
        amount: Number(amount),
        details: details.trim(),
        status: "pending",
        attachment_name: receipt?.name || null,
      });
      onClose();
    } catch (err) {
      addToast(err?.message || "Failed to record expense", "error");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-end bg-black/60 p-0 backdrop-blur-xs sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white p-5 shadow-2xl dark:bg-slate-900 sm:h-[min(760px,calc(100dvh-2rem))] sm:rounded-2xl sm:border sm:border-[var(--color-border-soft)] sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] pb-4 mb-5">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text)]">Record New Expense</h2>
            <p className="text-xs text-[var(--color-text-muted)]">Submit a claim for reimbursement.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 pb-1">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
              Expense Category <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value || o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
              Expense Name / Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Travel to client facility, Lunch meeting"
              className="w-full rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
              Details & Justification
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Purpose, project code, or vendor details…"
              className="w-full rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
              Receipt / Document Attachment
            </label>
            <div className="rounded-lg border border-dashed border-[var(--color-border-soft)] p-4 text-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline"
              >
                <Plus className="h-4 w-4" />
                {receipt ? "Change Receipt" : "Upload Receipt"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    addToast("Receipt must be smaller than 10MB", "error");
                    e.target.value = "";
                    return;
                  }
                  setReceipt(file);
                }}
              />
              <p className="mt-1 truncate text-[11px] text-[var(--color-text-muted)]" title={receipt?.name}>
                {receipt ? receipt.name : "PDF, PNG, JPG up to 10MB"}
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-[var(--color-border-soft)] bg-white pt-4 pb-[env(safe-area-inset-bottom)] dark:bg-slate-900">
            <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="add" type="submit" loading={saving}>
              Submit Claim
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default function ExpenseOverview() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [overview, setOverview] = useState({
    total_amount: 0,
    pending_count: 0,
    pending_amount: 0,
    approved_count: 0,
    approved_amount: 0,
    rejected_count: 0,
    yearly: [],
    categories: [],
    items: [],
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const periodLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getExpenseOverview({
        month: viewDate.getMonth() + 1,
        year: viewDate.getFullYear(),
      });
      const data = res?.data || {};
      setOverview(data);
    } catch {
      setOverview({
        total_amount: 0,
        pending_count: 0,
        pending_amount: 0,
        approved_count: 0,
        approved_amount: 0,
        rejected_count: 0,
        yearly: [],
        categories: [],
        items: [],
      });
    } finally {
      setLoading(false);
    }
  }, [viewDate]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  const shiftMonth = (delta) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };
  const setToday = () => setViewDate(new Date());

  const handleSaveExpense = async (payload) => {
    await createMyExpense(payload);
    addToast("Expense claim submitted successfully", "success");
    load(true);
  };

  const donutData = useMemo(() => {
    const cats = overview.categories || [];
    if (!cats.length) {
      return [{ name: "No Expenses", value: 1, color: "#e2e8f0" }];
    }
    return cats.map((c, i) => ({
      name: c.name,
      value: c.value,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
  }, [overview.categories]);

  const barData = useMemo(() => {
    const yearly = overview.yearly || [];
    if (yearly.length) return yearly;
    return MONTHS.map((m) => ({ month: m, amount: 0 }));
  }, [overview.yearly]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = overview.items || [];
    return items.filter((item) => {
      if (categoryFilter && (item.category || item.expense_category) !== categoryFilter) return false;
      if (!q) return true;
      const haystack = [
        item.name,
        item.expense_name,
        item.claim_number,
        item.employee_name,
        item.details,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [overview.items, search, categoryFilter]);

  if (loading) return <Loader label="Loading expense overview..." />;

  return (
    <>
      <ListPageShell>
        <div className="min-w-0 space-y-6 pb-12">
          {/* Top Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-[var(--color-text)]">Expense Management</h1>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Monitor company expenses, track departmental claims, and review reimbursement requests.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                to="/hr/expenses/my"
                leftIcon={<Wallet className="h-4 w-4" />}
              >
                My Expenses
              </Button>

              <Button
                variant="outline"
                to="/hr/expenses/approvals"
                leftIcon={<FileCheck className="h-4 w-4" />}
              >
                Approvals
                {overview.pending_count > 0 ? (
                  <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                    {overview.pending_count}
                  </span>
                ) : null}
              </Button>

              <Button
                variant="add"
                type="button"
                onClick={() => setDrawerOpen(true)}
                leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
              >
                Record Expense
              </Button>
            </div>
          </div>

          {/* Month Navigator Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="grid h-8 w-8 place-items-center rounded-full border border-[var(--color-border-soft)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-[8rem] text-center text-sm font-bold text-[var(--color-text)]">
                {periodLabel}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="grid h-8 w-8 place-items-center rounded-full border border-[var(--color-border-soft)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                aria-label="Next month"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={setToday}
              className="rounded-lg border border-[var(--color-border-soft)] bg-white px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] dark:bg-slate-900"
            >
              Current Month
            </button>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-[var(--color-border-soft)] bg-white p-4 shadow-xs dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">Total Expenses</span>
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50">
                  <CreditCard className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                {formatAmount(overview.total_amount)}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {(overview.items || []).length} total submitted claims
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-border-soft)] bg-white p-4 shadow-xs dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">Pending Approvals</span>
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatAmount(overview.pending_amount)}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {overview.pending_count} claims awaiting review
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-border-soft)] bg-white p-4 shadow-xs dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">Approved Expenses</span>
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatAmount(overview.approved_amount)}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {overview.approved_count} approved claims
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-border-soft)] bg-white p-4 shadow-xs dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">Active Categories</span>
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50">
                  <Receipt className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
                {(overview.categories || []).length}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Departmental expense codes
              </p>
            </div>
          </div>

          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Category Breakdown Donut */}
            <div className="rounded-xl border border-[var(--color-border-soft)] bg-white p-5 shadow-xs dark:bg-slate-900">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-[var(--color-primary)]" />
                  <h3 className="text-sm font-bold text-[var(--color-text)]">Category Breakdown</h3>
                </div>
                <span className="text-xs font-medium text-[var(--color-text-muted)]">
                  {formatAmount(overview.total_amount)}
                </span>
              </div>

              <div className="relative h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="80%"
                      paddingAngle={2}
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => [formatAmount(val), "Spend"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-lg font-bold text-[var(--color-text)]">
                    {formatAmount(overview.total_amount)}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">Total Spend</span>
                </div>
              </div>

              {/* Legend items */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs">
                {(overview.categories || []).map((cat, i) => (
                  <div key={cat.name} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                    />
                    <span className="text-[var(--color-text-muted)]">{cat.name}:</span>
                    <span className="font-semibold text-[var(--color-text)]">{formatAmount(cat.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Trend Bar Chart */}
            <div className="rounded-xl border border-[var(--color-border-soft)] bg-white p-5 shadow-xs dark:bg-slate-900">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[var(--color-primary)]" />
                  <h3 className="text-sm font-bold text-[var(--color-text)]">
                    Monthly Spending Trend ({viewDate.getFullYear()})
                  </h3>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">Annual Overview</span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-soft)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                    />
                    <Tooltip
                      formatter={(val) => [formatAmount(val), "Amount"]}
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Claims / All Claims Table */}
          <div className="rounded-xl border border-[var(--color-border-soft)] bg-white shadow-xs overflow-hidden dark:bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-[var(--color-border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--color-text)]">Recent Expense Claims</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Track employee reimbursements, approvals, and disbursement status.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search claims…"
                    className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] py-1.5 pl-8 pr-3 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.value ? c.label : "All Categories"}
                    </option>
                  ))}
                </select>

                <Button
                  variant="outline"
                  to="/hr/expenses/approvals"
                  leftIcon={<ArrowRight className="h-3.5 w-3.5" />}
                  className="text-xs"
                >
                  View All in Approvals
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] font-semibold">
                    <th className="px-4 py-3">SR No.</th>
                    <th className="px-4 py-3">Claim No.</th>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Expense Title</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Waiting On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-soft)]">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                        No expense claims found for this period. Click "Record Expense" to submit a claim.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, index) => (
                      <tr key={item.id || index} className="hover:bg-[var(--color-surface-muted)]/50 transition-colors">
                        <td className="px-4 py-3 text-[var(--color-text-muted)]">{index + 1}</td>
                        <td className="px-4 py-3 font-semibold text-[var(--color-primary)]">
                          {item.claim_number || `EXP-${item.id}`}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--color-text)]">
                          {item.employee_name || item.created_by || "Admin"}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)] capitalize">
                          {(item.category || item.expense_category || "Other").replace("-", " ")}
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--color-text)]">
                          {item.name || item.expense_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)]">
                          {formatDisplayDate(item.expense_date)}
                        </td>
                        <td className="px-4 py-3 font-bold text-[var(--color-text)]">
                          {formatAmount(item.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-muted)]">
                          {item.waiting_on || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ListPageShell>

      <QuickAddExpenseDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSaveExpense}
      />
    </>
  );
}
