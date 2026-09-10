import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreVertical,
  Plus,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { createMyExpense, deleteMyExpense, getMyExpenses, getMyExpensesSummary } from "../../api/hrApi";

import "./myExpenses.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TABLE_COLUMNS = [
  "SR No.",
  "Expense Category",
  "Expenses Name",
  "Expense Date",
  "Details",
  "Amount",
  "Created By",
  "Updated By",
  "Status",
  "Waiting On",
  "Action",
];

const EXPENSE_TYPE_OPTIONS = [
  { value: "", label: "Expenses Type" },
  { value: "travel", label: "Travel" },
  { value: "food", label: "Food" },
  { value: "accommodation", label: "Accommodation" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Status" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "Select Expense Category" },
  { value: "travel", label: "Travel" },
  { value: "food", label: "Food" },
  { value: "accommodation", label: "Accommodation" },
  { value: "supplies", label: "Office Supplies" },
  { value: "other", label: "Other" },
];

const EMPTY_YEARLY = MONTH_LABELS.map((month) => ({ month, amount: 0 }));

function formatDisplayDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}

function formatAmount(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `₹ ${n.toLocaleString("en-IN")}`;
}

function categoryLabel(value) {
  return CATEGORY_OPTIONS.find((o) => o.value === value)?.label || value || "—";
}

function FilterSelect({ value, onChange, options, menuHeader }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedLabel = options.find((o) => o.value === value)?.label || options[0]?.label;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="hr-my-expenses__filter-select">
      <button type="button" className="hr-my-expenses__select-trigger" onClick={() => setOpen((v) => !v)}>
        <span className={value ? "text-[#374151]" : "text-[#9ca3af]"}>{selectedLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#9ca3af]" />
      </button>
      {open ? (
        <div className="hr-my-expenses__select-menu">
          {menuHeader ? <div className="hr-my-expenses__select-menu-header">{menuHeader}</div> : null}
          {options.filter((o) => o.value !== "" || !menuHeader).map((opt) => (
            <button
              key={opt.value || opt.label}
              type="button"
              className={`hr-my-expenses__select-option ${opt.value === value ? "hr-my-expenses__select-option--active" : ""}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }) {
  const key = String(status || "pending").toLowerCase();
  return <span className={`hr-my-expenses__status hr-my-expenses__status--${key}`}>{status || "Pending"}</span>;
}

function ExpenseRowActionMenu({ row, onDelete }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="hr-my-expenses__action-wrap">
      <button
        type="button"
        className="hr-my-expenses__action-btn"
        aria-label="Actions"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="hr-my-expenses__action-menu">
          <button
            type="button"
            className="hr-my-expenses__action-item hr-my-expenses__action-item--danger"
            onClick={() => {
              setOpen(false);
              onDelete(row);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function AddExpenseDrawer({ open, onClose, onSave }) {

  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setCategory("");
    setName("");
    setExpenseDate("");
    setAmount("");
    setDetails("");
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const drawer = (
    <div className="hr-my-expenses__overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="hr-my-expenses__drawer" onClick={(e) => e.stopPropagation()}>
        <div className="hr-my-expenses__drawer-header">
          <svg className="hr-my-expenses__drawer-waves" viewBox="0 0 120 48" fill="none" aria-hidden>
            <path d="M0 32C20 20 40 44 60 28C80 12 100 36 120 24V48H0V32Z" fill="rgba(255,255,255,0.6)" />
            <path d="M0 24C18 14 36 34 54 22C72 10 96 30 120 18V48H0V24Z" fill="rgba(255,255,255,0.35)" />
          </svg>
          <button type="button" className="hr-my-expenses__drawer-close" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="hr-my-expenses__drawer-body">
          <h2 className="hr-my-expenses__drawer-title">Add Expense</h2>

          <div className="hr-my-expenses__field">
            <label className="hr-my-expenses__field-label">Expense Category <span>*</span></label>
            <select className="hr-my-expenses__select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((o) => <option key={o.value || o.label} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="hr-my-expenses__field">
            <label className="hr-my-expenses__field-label">Expense Name <span>*</span></label>
            <input className="hr-my-expenses__input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter Expense Name" />
          </div>

          <div className="hr-my-expenses__field">
            <label className="hr-my-expenses__field-label">Expense Date <span>*</span></label>
            <div className="hr-my-expenses__date-wrap">
              <span className={expenseDate ? "" : "is-placeholder"}>{expenseDate ? formatDisplayDate(expenseDate) : "dd-mmm-yyyy"}</span>
              <CalendarDays className="h-4 w-4 shrink-0 text-[#9ca3af]" />
              <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
          </div>

          <div className="hr-my-expenses__field">
            <label className="hr-my-expenses__field-label">Amount <span>*</span></label>
            <div className="hr-my-expenses__amount-wrap">
              <span className="hr-my-expenses__amount-prefix">₹</span>
              <input className="hr-my-expenses__input" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter Amount" />
            </div>
          </div>

          <div className="hr-my-expenses__field">
            <label className="hr-my-expenses__field-label">Details <span>*</span></label>
            <textarea className="hr-my-expenses__textarea" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Enter Detail" />
          </div>

          <div className="hr-my-expenses__field">
            <label className="hr-my-expenses__field-label">Attachment</label>
            <p className="hr-my-expenses__upload-hint">Maximum file size: 10MB.</p>
            <div className="hr-my-expenses__upload-zone">
              <button type="button" className="hr-my-expenses__upload-btn" onClick={() => fileRef.current?.click()}>
                <Plus className="h-4 w-4" />
                Upload Document
              </button>
              <input ref={fileRef} type="file" className="hr-my-expenses__hidden-input" />
            </div>
          </div>
        </div>
        <div className="hr-my-expenses__drawer-footer">
          <button
            type="button"
            className="hr-my-expenses__save-btn"
            onClick={() => {
              if (!category || !name.trim() || !expenseDate || !amount || !details.trim()) return;
              onSave({
                category,
                name: name.trim(),
                expense_date: expenseDate,
                amount: Number(amount),
                details: details.trim(),
                status: "Pending",
              });
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}

export default function MyExpenses() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [yearlyData, setYearlyData] = useState(EMPTY_YEARLY);

  const periodLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const params = { month: viewDate.getMonth() + 1, year: viewDate.getFullYear() };
    try {
      const [listRes, summaryRes] = await Promise.all([
        getMyExpenses(params),
        getMyExpensesSummary(params),
      ]);
      const rows = Array.isArray(listRes?.data) ? listRes.data : [];
      setRecords(rows);
      const yearly = summaryRes?.data?.yearly;
      setYearlyData(Array.isArray(yearly) && yearly.length ? yearly : EMPTY_YEARLY);
    } catch {
      setRecords([]);
      setYearlyData(EMPTY_YEARLY);
    } finally {
      setLoading(false);
    }
  }, [viewDate]);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => {
    return records.filter((row) => {
      if (typeFilter && row.category !== typeFilter && row.expense_type !== typeFilter) return false;
      if (statusFilter && String(row.status || "").toLowerCase() !== statusFilter) return false;
      return true;
    });
  }, [records, typeFilter, statusFilter]);

  const totalAmount = useMemo(
    () => filteredRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [filteredRows]
  );

  const donutData = useMemo(() => {
    if (!filteredRows.length) return [{ name: "Empty", value: 1, color: "#e5e7eb" }];
    const map = {};
    for (const row of filteredRows) {
      const key = row.category || row.expense_type || "Other";
      map[key] = (map[key] || 0) + (Number(row.amount) || 0);
    }
    const colors = ["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"];
    return Object.entries(map).map(([name, value], i) => ({
      name: categoryLabel(name),
      value,
      color: colors[i % colors.length],
    }));
  }, [filteredRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSave = async (payload) => {
    try {
      const res = await createMyExpense(payload);
      addToast("Expense added successfully", "success");
      const created = res?.data || { ...payload, id: `exp-${Date.now()}` };
      setRecords((prev) => [created, ...prev]);
      load(true);
    } catch {
      addToast("Failed to add expense", "error");
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Are you sure you want to delete "${row.name || "this expense"}"?`)) return;
    try {
      if (row.id && !String(row.id).startsWith("exp-")) {
        await deleteMyExpense(row.id);
      }
      setRecords((prev) => prev.filter((r) => r.id !== row.id));
      addToast("Expense deleted successfully", "success");
      load(true);
    } catch {
      addToast("Failed to delete expense", "error");
    }
  };


  const shiftMonth = (delta) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setPage(1);
  };

  if (loading) return <Loader label="Loading expenses..." />;

  const showingFrom = pagedRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, filteredRows.length);

  return (
    <>
      <ListPageShell>
        <div className="hr-my-expenses min-w-0">
          <div className="hr-my-expenses__header">
            <h1 className="hr-my-expenses__title">My Expenses</h1>
            <div className="hr-my-expenses__period">
              <button type="button" className="hr-my-expenses__nav-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft className="h-5 w-5" /></button>
              <span>{periodLabel}</span>
              <button type="button" className="hr-my-expenses__nav-btn" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight className="h-5 w-5" /></button>
            </div>
            <span aria-hidden />
          </div>

          <div className="hr-my-expenses__charts-card">
            <div className="hr-my-expenses__chart-panel">
              <h2 className="hr-my-expenses__chart-title">Expense Summary</h2>
              <div className="hr-my-expenses__donut-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="62%" outerRadius="82%" paddingAngle={filteredRows.length ? 2 : 0}>
                      {donutData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="hr-my-expenses__donut-center">
                  <span className="hr-my-expenses__donut-amount">₹ {totalAmount.toLocaleString("en-IN")}</span>
                  <span className="hr-my-expenses__donut-label">Amount</span>
                </div>
              </div>
            </div>
            <div className="hr-my-expenses__chart-panel">
              <h2 className="hr-my-expenses__chart-title">Yearly Expenses</h2>
              <div className="hr-my-expenses__bar-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={[0, 2]} ticks={[0, 0.5, 1, 1.5, 2]} />
                    <Bar dataKey="amount" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="hr-my-expenses__table-card">
            <div className="hr-my-expenses__table-toolbar">
              <h2>All Expenses</h2>
              <div className="hr-my-expenses__toolbar-right">
                <FilterSelect value={typeFilter} onChange={setTypeFilter} options={EXPENSE_TYPE_OPTIONS} menuHeader="Expenses Type" />
                <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} menuHeader="Status" />
                <button type="button" className="hr-my-expenses__add-btn" onClick={() => setDrawerOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Expense
                </button>
              </div>
            </div>

            <div className="hr-my-expenses__table-wrap">
              <table className="hr-my-expenses__table">
                <thead>
                  <tr>
                    {TABLE_COLUMNS.map((col) => <th key={col}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={TABLE_COLUMNS.length} className="hr-my-expenses__empty">No records found</td>
                    </tr>
                  ) : (
                    pagedRows.map((row, index) => (
                      <tr key={row.id || index}>
                        <td>{(currentPage - 1) * pageSize + index + 1}</td>
                        <td>{categoryLabel(row.category || row.expense_type)}</td>
                        <td>{row.name || row.expense_name || "—"}</td>
                        <td>{formatDisplayDate(row.expense_date)}</td>
                        <td>{row.details || "—"}</td>
                        <td>{formatAmount(row.amount)}</td>
                        <td>{row.created_by || "—"}</td>
                        <td>{row.updated_by || "—"}</td>
                        <td><StatusBadge status={row.status} /></td>
                        <td>{row.waiting_on || "—"}</td>
                        <td>
                          <ExpenseRowActionMenu row={row} onDelete={handleDelete} />
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="hr-my-expenses__footer">
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded border border-[#eff2f5] px-2 py-1 text-xs">
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                  <span>Entries</span>
                </div>
                <span>Showing {showingFrom} to {showingTo} of {filteredRows.length} entries</span>
                <div className="flex items-center gap-1">
                  <button type="button" className="hr-my-expenses__page-btn" onClick={() => setPage(1)} disabled={currentPage <= 1} aria-label="First page"><ChevronsLeft className="h-4 w-4" /></button>
                  <button type="button" className="hr-my-expenses__page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" className="hr-my-expenses__page-btn hr-my-expenses__page-btn--active">{currentPage}</button>
                  <button type="button" className="hr-my-expenses__page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
                  <button type="button" className="hr-my-expenses__page-btn" onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages} aria-label="Last page"><ChevronsRight className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ListPageShell>

      <AddExpenseDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onSave={handleSave} />
    </>
  );
}
