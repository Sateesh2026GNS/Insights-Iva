import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Plus,
  RefreshCw,
  Save,
  Star,
  Target,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import {
  Cell,
  Line,
  LineChart as RechartsLine,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import InventoryRowActionsMenu from "../../components/inventory/InventoryRowActionsMenu";
import Button, { AddButton } from "../../components/common/Button";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageShell } from "../../components/common/ListPageShell";
import Loader from "../../components/common/Loader";
import { SerialNumberCell, SerialNumberHeader } from "../../components/common/SerialNumberCell";
import { HrPage, HrPageHeader, HrPanel } from "../../components/hr/hrUi";
import usePageRefresh from "../../hooks/usePageRefresh";
import useTenantId from "../../hooks/useTenantId";
import { useToast } from "../../context/ToastContext";
import {
  createPerformanceReview,
  getEmployeeSummary,
  getEmployeesEnriched,
  getPerformanceReviews,
} from "../../api/hrApi";
import {
  EMPTY_PERFORMANCE_DASHBOARD,
  mergePerformanceDashboard,
  performanceStatusBadgeClass,
  performanceStatusLabel,
} from "../../data/hrMasterData";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const selectClass = "ui-select !w-auto min-w-[8.5rem]";

const PERFORMANCE_EXPORT_COLUMNS = [
  { key: "employee_name", label: "Employee" },
  { key: "department", label: "Department" },
  { key: "review_period", label: "Review Period" },
  { key: "rating", label: "Rating" },
  { key: "productivity_score", label: "Productivity" },
  { key: "status", label: "Status" },
];

const AVATAR_TONES = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
];

const PERFORMER_ICON_TONES = {
  trophy: "bg-violet-100 text-violet-600",
  user: "bg-sky-100 text-sky-600",
};

const inputClass = "ui-input mt-1.5 w-full";

function avatarTone(label) {
  let h = 0;
  for (let i = 0; i < String(label).length; i += 1) h += label.charCodeAt(i);
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

function ReviewStatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${performanceStatusBadgeClass(status)}`}>
      {performanceStatusLabel(status)}
    </span>
  );
}

function StarRating({ value }) {
  const rating = Number(value) || 0;
  const full = Math.floor(rating);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`h-3.5 w-3.5 ${n <= full ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}`}
          />
        ))}
      </span>
      <span className="font-semibold tabular-nums text-[var(--color-text)]">{rating.toFixed(1)}</span>
    </span>
  );
}

function pageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items = [1];
  if (current > 3) items.push("…");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let p = start; p <= end; p += 1) items.push(p);
  if (current < total - 2) items.push("…");
  if (total > 1) items.push(total);
  return items;
}

export default function Performance({ autoOpenCreate = false }) {
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(EMPTY_PERFORMANCE_DASHBOARD);
  const [employees, setEmployees] = useState([]);
  const [dateFrom, setDateFrom] = useState("2026-08-01");
  const [dateTo, setDateTo] = useState("2026-08-31");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(5);
  const [menuId, setMenuId] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(autoOpenCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    tenant_id: tenantId,
    employee_id: "",
    review_period: "Q3 2026",
    rating: "",
    productivity_score: "",
    goals_achieved: "",
    goals_total: "",
    notes: "",
  });

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [revRes, empSumRes, empListRes] = await Promise.allSettled([
        getPerformanceReviews(tenantId),
        getEmployeeSummary(),
        getEmployeesEnriched(),
      ]);
      const reviews = revRes.status === "fulfilled" && Array.isArray(revRes.value?.data) ? revRes.value.data : [];
      const employeeCount = empSumRes.status === "fulfilled" ? empSumRes.value?.data?.total_employees : 0;
      const emps = empListRes.status === "fulfilled" && Array.isArray(empListRes.value?.data) ? empListRes.value.data : [];
      setEmployees(emps);
      setData(mergePerformanceDashboard({ reviews, employees: emps, employeeCount }));
    } catch (err) {
      if (isRefresh) throw err;
      setData(EMPTY_PERFORMANCE_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, [tenantId, addToast]);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (autoOpenCreate) setShowCreateModal(true);
  }, [autoOpenCreate]);

  const departments = useMemo(() => {
    const set = new Set(data.recent_reviews.map((r) => r.department).filter((d) => d && d !== "—"));
    return [...set].sort();
  }, [data.recent_reviews]);

  const designations = useMemo(() => {
    const set = new Set(data.overview_rows.map((r) => r.designation).filter((d) => d && d !== "—"));
    return [...set].sort();
  }, [data.overview_rows]);

  const filteredReviews = useMemo(() => {
    return data.recent_reviews.filter((r) => {
      if (department && r.department !== department) return false;
      if (employeeFilter && r.employee_name !== employeeFilter) return false;
      return true;
    });
  }, [data.recent_reviews, department, employeeFilter]);

  useEffect(() => {
    setPage(1);
  }, [department, designation, employeeFilter, dateFrom, dateTo]);

  const displayTotal =
    filteredReviews.length === data.recent_reviews.length && data.total_reviews > filteredReviews.length
      ? data.total_reviews
      : filteredReviews.length;
  const totalPages = Math.max(1, Math.ceil(displayTotal / pageSize));
  const pageRows = filteredReviews.slice((page - 1) * pageSize, page * pageSize);
  const from = filteredReviews.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, displayTotal);

  const donutData = data.rating_slices.map((s) => ({
    name: s.label,
    value: s.count,
    color: s.color,
    pct: s.pct,
  }));

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.review_period) {
      setError("Please fill all required fields.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createPerformanceReview({
        ...form,
        employee_id: Number(form.employee_id),
        rating: form.rating ? Number(form.rating) : null,
        productivity_score: form.productivity_score ? Number(form.productivity_score) : null,
        goals_achieved: form.goals_achieved ? Number(form.goals_achieved) : null,
        goals_total: form.goals_total ? Number(form.goals_total) : null,
      });
      addToast("Performance review created successfully", "success");
      setShowCreateModal(false);
      setForm({
        tenant_id: tenantId,
        employee_id: "",
        review_period: "Q3 2026",
        rating: "",
        productivity_score: "",
        goals_achieved: "",
        goals_total: "",
        notes: "",
      });
      load();
    } catch {
      setError("Failed to create performance review.");
      addToast("Failed to create review", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading performance..." />;

  const trendBadge = data.trend_badge || {};

  const exportRows = filteredReviews.map((r) => ({
    employee_name: r.employee_name,
    department: r.department,
    review_period: r.review_period,
    rating: r.rating,
    productivity_score: r.productivity_score,
    status: performanceStatusLabel(r.status),
  }));

  const handleExport = (format) => {
    if (format === "pdf") {
      exportToPdf(exportRows, PERFORMANCE_EXPORT_COLUMNS, "Performance Reviews", "performance-reviews");
    } else {
      exportToExcel(exportRows, PERFORMANCE_EXPORT_COLUMNS, "performance-reviews");
    }
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <ListPageShell>
    <HrPage>
      <HrPageHeader
        title="Performance"
        subtitle="Track and improve employee performance"
        action={
          <>
          <AddButton type="button" onClick={() => setShowCreateModal(true)}>
            Create Review
          </AddButton>
          <ExportDownloadMenu disabled={!exportRows.length} onExport={handleExport} />
          <Button
            type="button"
            variant="secondary"
            onClick={() => addToast("Goals & OKRs module coming soon", "info")}
            leftIcon={<Target className="h-4 w-4" aria-hidden />}
          >
            Goals & OKRs
          </Button>
          <Button type="button" variant="secondary" rightIcon={<ChevronDown className="h-4 w-4" aria-hidden />}>
            More Actions
          </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 ui-card p-4">
        <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          <CalendarDays className="h-4 w-4 text-[var(--color-text-muted)]" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border-none bg-transparent outline-none text-[var(--color-text)]" />
          <span className="text-[var(--color-text-muted)]">–</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border-none bg-transparent outline-none text-[var(--color-text)]" />
        </label>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className={selectClass}>
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={designation} onChange={(e) => setDesignation(e.target.value)} className={selectClass}>
          <option value="">All Designations</option>
          {designations.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={selectClass}>
          <option value="">All Employees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.full_name}>{e.full_name}</option>
          ))}
        </select>
        <Button type="button" variant="secondary" leftIcon={<Filter className="h-4 w-4" aria-hidden />}>
          Filter
        </Button>
        <Button type="button" variant="secondary" onClick={() => load(true)} aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Top widgets row */}
      <div className="grid gap-4 xl:grid-cols-3">
        <HrPanel
          title="Performance Trend"
          action={
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              ↑ {trendBadge.pct}% {trendBadge.label || "vs last period"}
            </span>
          }
        >
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLine data={data.performance_trend} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip formatter={(v) => [`${v}%`, "Performance"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="pct" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </RechartsLine>
            </ResponsiveContainer>
          </div>
        </HrPanel>

        <HrPanel title="Rating Distribution">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={2} stroke="none">
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[20px] font-bold text-[var(--color-text)]">{data.rating_total}</span>
                <span className="text-xs text-[var(--color-text-muted)]">Total</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2 text-[12px]">
              {donutData.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-semibold text-[var(--color-text)]">{d.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        </HrPanel>

        <HrPanel title="Top Performers" action={<Link to="/hr/performance" className="text-sm font-semibold text-[var(--color-primary)]">View All</Link>}>
          <ul className="space-y-4">
            {data.top_performers.map((p) => {
              const Icon = p.icon === "trophy" ? Trophy : UserRound;
              const tone = PERFORMER_ICON_TONES[p.icon] || PERFORMER_ICON_TONES.user;
              const barPct = Math.min(100, (Number(p.rating) / 5) * 100);
              return (
                <li key={p.id}>
                  <div className="flex items-center gap-3">
                    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone}`}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-[var(--color-text)]">{p.name}</p>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--color-text)]">{Number(p.rating).toFixed(1)}</span>
                      </div>
                      <p className="truncate text-xs text-[var(--color-text-muted)]">{p.department}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                    <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: p.bar_color || "#8b5cf6" }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </HrPanel>
      </div>

      {/* Bottom row */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <HrPanel title="Recent Performance Reviews" action={<Link to="/hr/performance" className="text-sm font-semibold text-[var(--color-primary)]">View All</Link>}>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border-soft)]">
              <table className="min-w-full w-full border-collapse text-left text-sm">
                  <thead className="ui-table-head">
                  <tr>
                    <SerialNumberHeader className="border-b border-[var(--color-border-soft)] px-3 py-3" />
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3 min-w-[140px]">Employee Name</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Department</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Review Type</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Rating</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Review Date</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Status</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-[var(--color-text-muted)]">
                        No performance reviews match your filters.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row, rowIndex) => (
                      <tr key={row.id} className="hover:bg-[var(--color-surface-muted)]/80">
                        <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} className="border-b border-[var(--color-border-soft)] px-3 py-3" />
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${avatarTone(row.avatar)}`}>
                              {row.avatar}
                            </div>
                            <span className="font-semibold text-[var(--color-text)]">{row.employee_name}</span>
                          </div>
                        </td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">{row.department}</td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">{row.review_type}</td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                          {row.rating ? <StarRating value={row.rating} /> : "—"}
                        </td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">{row.review_date}</td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                          <ReviewStatusBadge status={row.status} />
                        </td>
                        <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => addToast(`View review for ${row.employee_name}`, "info")}
                              className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-primary)] hover:bg-indigo-50"
                              aria-label="View"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <InventoryRowActionsMenu
                              rowId={row.id}
                              isOpen={menuId === row.id}
                              onOpen={setMenuId}
                              onClose={() => setMenuId(null)}
                              onView={() => addToast(`View ${row.employee_name}`, "info")}
                              onEdit={() => addToast(`Edit ${row.employee_name}`, "info")}
                              showAdd={false}
                              showDelete={false}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-text-muted)]">
              <span>
                Showing {from} to {to} of {displayTotal} entries
              </span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface)] disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {pageItems(page, totalPages).map((item) =>
                  item === "…" ? (
                    <span key={`e-${item}`} className="px-1 text-xs">…</span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      className={`grid h-8 min-w-8 place-items-center rounded-md border px-2 text-sm font-semibold ${
                        item === page ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border-soft)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface)] disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </HrPanel>
        </div>

        <div className="space-y-4">
          <HrPanel title="Performance Insights">
            <ul className="space-y-4">
              {data.performance_insights.map((item) => (
                <li key={item.key}>
                  <div className="mb-1.5 flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[var(--color-text)]">{item.label}</span>
                    <span className="font-semibold text-[var(--color-text)]">
                      {item.count} ({item.pct}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                    <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
                  </div>
                </li>
              ))}
            </ul>
          </HrPanel>

          <HrPanel
            title="Upcoming Reviews"
            action={
              <button type="button" onClick={() => addToast("Review calendar coming soon", "info")} className="text-sm font-semibold text-[var(--color-primary)]">
                View Calendar
              </button>
            }
          >
            <ul className="space-y-4">
              {data.upcoming_reviews.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 text-center">
                    <span className="text-[15px] font-bold leading-none text-[var(--color-primary)]">{item.day}</span>
                    <span className="text-[10px] font-semibold uppercase text-indigo-400">{item.month}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--color-text)]">{item.title}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{item.employees}</p>
                  </div>
                </li>
              ))}
            </ul>
          </HrPanel>
        </div>
      </div>

      {showCreateModal && (
        <div className="ui-modal-backdrop">
          <div className="ui-modal max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text)]">Create Performance Review</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Submit manager evaluation and productivity score.</p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                  {error}
                </div>
              )}

              <div>
                <label className="ui-label">Employee *</label>
                <select value={form.employee_id} onChange={(e) => handleFormChange("employee_id", e.target.value)} required className="ui-select w-full">
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="ui-label">Review Period *</label>
                <input type="text" required placeholder="e.g. Q3 2026" value={form.review_period} onChange={(e) => handleFormChange("review_period", e.target.value)} className="ui-input w-full" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ui-label">Rating (1-5)</label>
                  <input type="number" min="1" max="5" step="0.1" value={form.rating} onChange={(e) => handleFormChange("rating", e.target.value)} className="ui-input w-full" />
                </div>
                <div>
                  <label className="ui-label">Productivity (0-100)</label>
                  <input type="number" min="0" max="100" value={form.productivity_score} onChange={(e) => handleFormChange("productivity_score", e.target.value)} className="ui-input w-full" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ui-label">Goals Achieved</label>
                  <input type="number" value={form.goals_achieved} onChange={(e) => handleFormChange("goals_achieved", e.target.value)} className="ui-input w-full" />
                </div>
                <div>
                  <label className="ui-label">Goals Total</label>
                  <input type="number" value={form.goals_total} onChange={(e) => handleFormChange("goals_total", e.target.value)} className="ui-input w-full" />
                </div>
              </div>

              <div>
                <label className="ui-label">Notes / Feedback</label>
                <textarea value={form.notes} onChange={(e) => handleFormChange("notes", e.target.value)} rows={3} placeholder="Review comments..." className="ui-input w-full min-h-[5rem]" />
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--color-border-soft)] pt-4">
                <Button type="button" variant="cancel" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </HrPage>
    </ListPageShell>
  );
}
