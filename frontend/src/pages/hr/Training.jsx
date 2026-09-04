import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  GraduationCap,
  Medal,
  Plus,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import PlaceholderPage from "../../components/common/PlaceholderPage";
import InventoryRowActionsMenu from "../../components/inventory/InventoryRowActionsMenu";
import Loader from "../../components/common/Loader";
import Button, { AddButton } from "../../components/common/Button";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageShell } from "../../components/common/ListPageShell";
import { HrKpiCard, HrPage, HrPageHeader, HrPanel, hrInputClass } from "../../components/hr/hrUi";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import {
  createTrainingEnrollment,
  createTrainingProgram,
  deleteTrainingProgram,
  getTrainingDashboard,
  updateTrainingProgram,
} from "../../api/hrApi";
import { apiErrorMessage } from "../../utils/apiError";
import {
  EMPTY_TRAINING_DASHBOARD,
  mergeTrainingDashboard,
  trainingStatusBadgeClass,
  trainingStatusLabel,
} from "../../data/hrMasterData";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const selectClass = "ui-select !w-auto min-w-[7rem]";

const TRAINING_EXPORT_COLUMNS = [
  { key: "name", label: "Program Name" },
  { key: "category", label: "Category" },
  { key: "trainer", label: "Trainer" },
  { key: "start_date", label: "Start Date" },
  { key: "end_date", label: "End Date" },
  { key: "participants", label: "Participants" },
  { key: "progress", label: "Progress %" },
  { key: "status", label: "Status" },
];

const inputClass = hrInputClass;

const SUMMARY_ICONS = {
  enrolled: BookOpen,
  completed: CheckCircle2,
  in_progress: GraduationCap,
  certifications: Award,
};

function TrainingStatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${trainingStatusBadgeClass(status)}`}>
      {trainingStatusLabel(status)}
    </span>
  );
}

function ProgressBar({ pct, color = "#8b5cf6" }) {
  const value = Math.min(100, Math.max(0, Number(pct) || 0));
  return (
    <div className="flex min-w-[100px] items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="w-9 text-right text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">{value}%</span>
    </div>
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

function TrainingDashboard() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(EMPTY_TRAINING_DASHBOARD);
  const [trendRange, setTrendRange] = useState("this_month");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(5);
  const [menuId, setMenuId] = useState(null);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [viewProgram, setViewProgram] = useState(null);
  const [editProgram, setEditProgram] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [programForm, setProgramForm] = useState({
    name: "",
    category: "",
    trainer: "",
    start_date: "",
    end_date: "",
    status: "not_started",
    progress_pct: 0,
    description: "",
  });

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      try {
        const res = await getTrainingDashboard({
          ongoing_page: page,
          ongoing_page_size: pageSize,
          trend_range: trendRange,
        });
        setData(mergeTrainingDashboard(res.data || {}));
      } catch (err) {
        setData(mergeTrainingDashboard());
        addToast(apiErrorMessage(err, "Failed to load training data"), "error");
      } finally {
        setLoading(false);
      }
    },
    [addToast, page, pageSize, trendRange]
  );

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const resetProgramForm = () => {
    setProgramForm({
      name: "",
      category: "",
      trainer: "",
      start_date: "",
      end_date: "",
      status: "not_started",
      progress_pct: 0,
      description: "",
    });
    setFormError("");
    setEditProgram(null);
  };

  const openCreateProgram = () => {
    resetProgramForm();
    setShowProgramModal(true);
  };

  const openEditProgram = (row) => {
    setEditProgram(row);
    setProgramForm({
      name: row.name || "",
      category: row.category === "—" ? "" : row.category || "",
      trainer: row.trainer === "—" ? "" : row.trainer || "",
      start_date: row.start_date_raw || "",
      end_date: row.end_date_raw || "",
      status: row.status || "not_started",
      progress_pct: row.progress ?? row.progress_pct ?? 0,
      description: row.description || "",
    });
    setFormError("");
    setShowProgramModal(true);
    setMenuId(null);
  };

  const handleSaveProgram = async (e) => {
    e.preventDefault();
    if (!programForm.name.trim()) {
      setFormError("Program name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        ...programForm,
        category: programForm.category || null,
        trainer: programForm.trainer || null,
        start_date: programForm.start_date || null,
        end_date: programForm.end_date || null,
        progress_pct: Number(programForm.progress_pct) || 0,
        description: programForm.description || null,
      };
      if (editProgram) {
        await updateTrainingProgram(editProgram.id, payload);
        addToast("Training program updated", "success");
      } else {
        await createTrainingProgram(payload);
        addToast("Training program created", "success");
      }
      setShowProgramModal(false);
      resetProgramForm();
      await load(true);
    } catch (err) {
      setFormError(apiErrorMessage(err, "Failed to save training program"));
      addToast(apiErrorMessage(err, "Failed to save training program"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProgram = async (row) => {
    if (!window.confirm(`Delete training program "${row.name}"?`)) return;
    try {
      await deleteTrainingProgram(row.id);
      addToast("Training program deleted", "success");
      setMenuId(null);
      await load(true);
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete program"), "error");
    }
  };

  const handleRegister = async (row) => {
    try {
      await createTrainingEnrollment({ program_id: row.id, status: "enrolled" });
      addToast(`Registered for ${row.name}`, "success");
      await load(true);
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to register"), "error");
    }
  };

  const overviewData = data.overview_slices.map((s) => ({
    name: s.label,
    value: s.count,
    color: s.color,
    pct: s.pct,
  }));

  const displayTotal = data.total_ongoing;
  const totalPages = Math.max(1, Math.ceil(displayTotal / pageSize));
  const pageRows = data.ongoing_programs || [];
  const from = displayTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, displayTotal);

  const trends = data.kpi_trends || {};

  if (loading) return <Loader label="Loading training..." />;

  const exportRows = pageRows.map((r) => ({
    name: r.name,
    category: r.category,
    trainer: r.trainer,
    start_date: r.start_date,
    end_date: r.end_date,
    participants: r.participants,
    progress: r.progress,
    status: trainingStatusLabel(r.status),
  }));

  const handleExport = (format) => {
    if (format === "pdf") {
      exportToPdf(exportRows, TRAINING_EXPORT_COLUMNS, "Training Programs", "training-programs");
    } else {
      exportToExcel(exportRows, TRAINING_EXPORT_COLUMNS, "training-programs");
    }
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <ListPageShell>
    <HrPage>
      <HrPageHeader
        title="Training"
        subtitle="Manage and track employee training and development"
        action={
          <>
          <AddButton type="button" onClick={openCreateProgram}>
            Create Training Program
          </AddButton>
          <ExportDownloadMenu disabled={!exportRows.length} onExport={handleExport} />
          <Button type="button" variant="secondary" rightIcon={<ChevronDown className="h-4 w-4" aria-hidden />}>
            More Actions
          </Button>
          </>
        }
      />

      <div className="ui-grid-kpi">
        <HrKpiCard label="Total Programs" value={data.total_programs} icon={BookOpen} tone="purple" trend={trends.programs} />
        <HrKpiCard label="In Progress" value={data.in_progress} icon={GraduationCap} tone="green" trend={trends.in_progress} />
        <HrKpiCard label="Completed" value={data.completed} icon={CheckCircle2} tone="blue" trend={trends.completed} />
        <HrKpiCard label="Not Started" value={data.not_started} icon={Clock} tone="orange" trend={trends.not_started} />
        <HrKpiCard label="Certifications Earned" value={data.certifications_earned} icon={Award} tone="red" trend={trends.certifications} />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 xl:grid-cols-3">
        <HrPanel title="Training Overview">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={overviewData} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={2} stroke="none">
                    {overviewData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                <span className="text-[18px] font-bold text-[var(--color-text)]">{data.overview_total}</span>
                <span className="text-[10px] leading-tight text-[var(--color-text-muted)]">Total Programs</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2 text-[12px]">
              {overviewData.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-semibold text-[var(--color-text)]">
                    {d.pct}% ({d.value})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </HrPanel>

        <HrPanel
          title="Training Completion Trend"
          action={
            <select
              value={trendRange}
              onChange={(e) => setTrendRange(e.target.value)}
              className={selectClass}
            >
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="quarter">This Quarter</option>
            </select>
          }
        >
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.completion_trend} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="trainAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip formatter={(v) => [`${v}%`, "Completion"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area type="monotone" dataKey="pct" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#trainAreaFill)" dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </HrPanel>

        <HrPanel title="Top Training Categories">
          <ul className="space-y-4">
            {data.top_categories.map((cat) => (
              <li key={cat.label}>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="font-medium text-[var(--color-text)]">{cat.label}</span>
                  <span className="font-semibold text-[var(--color-text)]">{cat.pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                  <div className="h-full rounded-full" style={{ width: `${cat.pct}%`, background: cat.color }} />
                </div>
              </li>
            ))}
          </ul>
        </HrPanel>
      </div>

      {/* Bottom row */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <HrPanel title="Ongoing Training Programs" action={<Link to="/hr/training" className="text-sm font-semibold text-[var(--color-primary)]">View All</Link>}>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border-soft)]">
              <table className="min-w-full w-full border-collapse text-left text-sm">
                  <thead className="ui-table-head">
                  <tr>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3 min-w-[180px]">Program Name</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Category</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Trainer</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Start Date</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">End Date</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">Participants</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3 min-w-[120px]">Progress</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Status</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="border-b border-[var(--color-border-soft)] px-3 py-8 text-center text-sm text-[var(--color-text-muted)]">
                        No training records found
                      </td>
                    </tr>
                  ) : (
                  pageRows.map((row, idx) => (
                    <tr key={row.id} className={idx % 2 === 1 ? "bg-[var(--color-surface-muted)]/60 hover:bg-[var(--color-surface-muted)]" : "hover:bg-[var(--color-surface-muted)]/80"}>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden />
                          <span className="font-semibold text-[var(--color-text)]">{row.name}</span>
                        </div>
                      </td>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">{row.category}</td>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">{row.trainer}</td>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3 whitespace-nowrap text-[var(--color-text-secondary)]">{row.start_date}</td>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3 whitespace-nowrap text-[var(--color-text-secondary)]">{row.end_date}</td>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center tabular-nums text-[var(--color-text)]">{row.participants}</td>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                        <ProgressBar pct={row.progress} />
                      </td>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                        <TrainingStatusBadge status={row.status} />
                      </td>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewProgram(row)}
                            className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-primary)] hover:bg-indigo-50"
                            aria-label="View program"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <InventoryRowActionsMenu
                            rowId={row.id}
                            isOpen={menuId === row.id}
                            onOpen={setMenuId}
                            onClose={() => setMenuId(null)}
                            onView={() => setViewProgram(row)}
                            onEdit={() => openEditProgram(row)}
                            onDelete={() => handleDeleteProgram(row)}
                            showAdd={false}
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
              <span className="rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text-secondary)]">
                {pageSize} / page
              </span>
            </div>
          </HrPanel>

          <HrPanel title="Upcoming Training Programs">
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border-soft)]">
              <table className="min-w-full w-full border-collapse text-left text-sm">
                  <thead className="ui-table-head">
                  <tr>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Program Name</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Category</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Trainer</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Start Date</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3">End Date</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">Participants</th>
                    <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcoming_programs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="border-b border-[var(--color-border-soft)] px-3 py-8 text-center text-sm text-[var(--color-text-muted)]">
                        No upcoming programs
                      </td>
                    </tr>
                  ) : (
                  data.upcoming_programs.map((row) => (
                    <tr key={row.id} className="hover:bg-[var(--color-surface-muted)]/80">
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3 font-semibold text-[var(--color-text)]">{row.name}</td>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">{row.category}</td>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">{row.trainer}</td>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">{row.start_date}</td>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">{row.end_date}</td>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center tabular-nums text-[var(--color-text)]">{row.participants}</td>
                      <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRegister(row)}
                          className="rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-primary)] hover:bg-indigo-50"
                        >
                          Register
                        </button>
                      </td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </div>
          </HrPanel>
        </div>

        <div className="space-y-4">
          <HrPanel title="My Training Summary">
            <ul className="space-y-3">
              {data.my_summary.map((item) => {
                const Icon = SUMMARY_ICONS[item.key] || BookOpen;
                return (
                  <li key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/50 px-3 py-2.5">
                    <span className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                      <Icon className="h-4 w-4 text-indigo-500" aria-hidden />
                      {item.label}
                    </span>
                    <span className="text-[15px] font-bold tabular-nums text-[var(--color-text)]">{item.count}</span>
                  </li>
                );
              })}
            </ul>
          </HrPanel>

          <HrPanel title="Recent Certifications">
            <ul className="space-y-3">
              {data.recent_certifications.length === 0 ? (
                <li className="text-center text-sm text-[var(--color-text-muted)]">No certifications yet</li>
              ) : (
              data.recent_certifications.map((cert) => (
                <li key={cert.id} className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-500">
                    <Medal className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--color-text)]">{cert.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{cert.date}</p>
                  </div>
                </li>
              ))
              )}
            </ul>
          </HrPanel>

          <HrPanel title="Quick Links">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
              {[
                { label: "Training Calendar", icon: CalendarDays },
                { label: "My Trainings", icon: GraduationCap },
                { label: "Certifications", icon: Award },
              ].map((link) => (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => addToast(`${link.label} coming soon`, "info")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-3 text-[12px] font-semibold text-[var(--color-text)] hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-[var(--color-primary)]"
                >
                  <link.icon className="h-4 w-4" aria-hidden />
                  {link.label}
                </button>
              ))}
            </div>
          </HrPanel>
        </div>
      </div>

      {showProgramModal ? (
        <div className="ui-modal-backdrop">
          <div className="ui-modal max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">{editProgram ? "Edit Training Program" : "Create Training Program"}</h3>
              <button type="button" onClick={() => { setShowProgramModal(false); resetProgramForm(); }} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            {formError ? <p className="mb-3 text-sm text-red-600">{formError}</p> : null}
            <form onSubmit={handleSaveProgram} className="space-y-3">
              <label className="ui-label">
                Program Name *
                <input className="ui-input w-full mt-1" value={programForm.name} onChange={(e) => setProgramForm((f) => ({ ...f, name: e.target.value }))} required />
              </label>
              <label className="ui-label">
                Category
                <input className="ui-input w-full mt-1" value={programForm.category} onChange={(e) => setProgramForm((f) => ({ ...f, category: e.target.value }))} />
              </label>
              <label className="ui-label">
                Trainer
                <input className="ui-input w-full mt-1" value={programForm.trainer} onChange={(e) => setProgramForm((f) => ({ ...f, trainer: e.target.value }))} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="ui-label">
                  Start Date
                  <input type="date" className="ui-input w-full mt-1" value={programForm.start_date} onChange={(e) => setProgramForm((f) => ({ ...f, start_date: e.target.value }))} />
                </label>
                <label className="ui-label">
                  End Date
                  <input type="date" className="ui-input w-full mt-1" value={programForm.end_date} onChange={(e) => setProgramForm((f) => ({ ...f, end_date: e.target.value }))} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="ui-label">
                  Status
                  <select className="ui-select w-full mt-1" value={programForm.status} onChange={(e) => setProgramForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="upcoming">Upcoming</option>
                  </select>
                </label>
                <label className="ui-label">
                  Progress %
                  <input type="number" min={0} max={100} className="ui-input w-full mt-1" value={programForm.progress_pct} onChange={(e) => setProgramForm((f) => ({ ...f, progress_pct: e.target.value }))} />
                </label>
              </div>
              <label className="ui-label">
                Description
                <textarea className="ui-input w-full mt-1 min-h-[5rem]" rows={3} value={programForm.description} onChange={(e) => setProgramForm((f) => ({ ...f, description: e.target.value }))} />
              </label>
              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border-soft)]">
                <Button type="button" variant="cancel" onClick={() => { setShowProgramModal(false); resetProgramForm(); }}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewProgram ? (
        <div className="ui-modal-backdrop">
          <div className="ui-modal max-w-md w-full">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--color-text)]">{viewProgram.name}</h3>
              <button type="button" onClick={() => setViewProgram(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"><X className="h-5 w-5" /></button>
            </div>
            <dl className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <div><dt className="font-medium text-[var(--color-text)]">Category</dt><dd>{viewProgram.category}</dd></div>
              <div><dt className="font-medium text-[var(--color-text)]">Trainer</dt><dd>{viewProgram.trainer}</dd></div>
              <div><dt className="font-medium text-[var(--color-text)]">Dates</dt><dd>{viewProgram.start_date} — {viewProgram.end_date}</dd></div>
              <div><dt className="font-medium text-[var(--color-text)]">Participants</dt><dd>{viewProgram.participants}</dd></div>
              <div><dt className="font-medium text-[var(--color-text)]">Status</dt><dd><TrainingStatusBadge status={viewProgram.status} /></dd></div>
            </dl>
          </div>
        </div>
      ) : null}
    </HrPage>
    </ListPageShell>
  );
}

export default function Training() {
  const { pathname } = useLocation();
  const isDashboard = pathname === "/hr/training" || pathname.endsWith("/training");

  if (!isDashboard) {
    return (
      <PlaceholderPage
        title="Training — Sessions"
        description="Plan training programs, schedule sessions, and track employee skill development."
      />
    );
  }

  return <TrainingDashboard />;
}
