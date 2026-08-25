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
  MoreVertical,
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
import { AddButton } from "../../components/common/Button";
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
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
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

  return (
    <HrPage>
      <HrPageHeader
        title="Training"
        subtitle="Manage and track employee training and development"
        action={
          <>
          <AddButton type="button" onClick={openCreateProgram}>
            Create Training Program
          </AddButton>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"
          >
            <MoreVertical className="h-4 w-4" />
            More Actions
            <ChevronDown className="h-4 w-4" />
          </button>
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
                <span className="text-[18px] font-bold text-slate-900">{data.overview_total}</span>
                <span className="text-[10px] leading-tight text-slate-500">Total Programs</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2 text-[12px]">
              {overviewData.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-semibold text-slate-800">
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
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 outline-none"
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
                  <span className="font-medium text-slate-700">{cat.label}</span>
                  <span className="font-semibold text-slate-800">{cat.pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
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
          <HrPanel title="Ongoing Training Programs" action={<Link to="/hr/training" className="text-sm font-semibold text-[#6366f1]">View All</Link>}>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full w-full border-collapse text-left text-sm">
                  <thead className="ui-table-head">
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-3 min-w-[180px]">Program Name</th>
                    <th className="border-b border-slate-200 px-3 py-3">Category</th>
                    <th className="border-b border-slate-200 px-3 py-3">Trainer</th>
                    <th className="border-b border-slate-200 px-3 py-3">Start Date</th>
                    <th className="border-b border-slate-200 px-3 py-3">End Date</th>
                    <th className="border-b border-slate-200 px-3 py-3 text-center">Participants</th>
                    <th className="border-b border-slate-200 px-3 py-3 min-w-[120px]">Progress</th>
                    <th className="border-b border-slate-200 px-3 py-3">Status</th>
                    <th className="border-b border-slate-200 px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="border-b border-slate-100 px-3 py-8 text-center text-sm text-slate-500">
                        No training records found
                      </td>
                    </tr>
                  ) : (
                  pageRows.map((row, idx) => (
                    <tr key={row.id} className={idx % 2 === 1 ? "bg-slate-50/60 hover:bg-slate-50" : "hover:bg-slate-50/80"}>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden />
                          <span className="font-semibold text-slate-800">{row.name}</span>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.category}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.trainer}</td>
                      <td className="border-b border-slate-100 px-3 py-3 whitespace-nowrap text-slate-600">{row.start_date}</td>
                      <td className="border-b border-slate-100 px-3 py-3 whitespace-nowrap text-slate-600">{row.end_date}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-center tabular-nums text-slate-700">{row.participants}</td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <ProgressBar pct={row.progress} />
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <TrainingStatusBadge status={row.status} />
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewProgram(row)}
                            className="grid h-8 w-8 place-items-center rounded-md text-[#6366f1] hover:bg-indigo-50"
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

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
              <span>
                Showing {from} to {to} of {displayTotal} entries
              </span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white disabled:opacity-40">
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
                        item === page ? "border-[#6366f1] bg-[#6366f1] text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-600">
                {pageSize} / page
              </span>
            </div>
          </HrPanel>

          <HrPanel title="Upcoming Training Programs">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full w-full border-collapse text-left text-sm">
                  <thead className="ui-table-head">
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-3">Program Name</th>
                    <th className="border-b border-slate-200 px-3 py-3">Category</th>
                    <th className="border-b border-slate-200 px-3 py-3">Trainer</th>
                    <th className="border-b border-slate-200 px-3 py-3">Start Date</th>
                    <th className="border-b border-slate-200 px-3 py-3">End Date</th>
                    <th className="border-b border-slate-200 px-3 py-3 text-center">Participants</th>
                    <th className="border-b border-slate-200 px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcoming_programs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="border-b border-slate-100 px-3 py-8 text-center text-sm text-slate-500">
                        No upcoming programs
                      </td>
                    </tr>
                  ) : (
                  data.upcoming_programs.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-800">{row.name}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.category}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.trainer}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.start_date}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.end_date}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-center tabular-nums text-slate-700">{row.participants}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRegister(row)}
                          className="rounded-lg border border-[#6366f1] px-3 py-1.5 text-[12px] font-semibold text-[#6366f1] hover:bg-indigo-50"
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
                  <li key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                    <span className="flex items-center gap-2.5 text-sm text-slate-600">
                      <Icon className="h-4 w-4 text-indigo-500" aria-hidden />
                      {item.label}
                    </span>
                    <span className="text-[15px] font-bold tabular-nums text-slate-900">{item.count}</span>
                  </li>
                );
              })}
            </ul>
          </HrPanel>

          <HrPanel title="Recent Certifications">
            <ul className="space-y-3">
              {data.recent_certifications.length === 0 ? (
                <li className="text-center text-sm text-slate-500">No certifications yet</li>
              ) : (
              data.recent_certifications.map((cert) => (
                <li key={cert.id} className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-500">
                    <Medal className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{cert.name}</p>
                    <p className="text-xs text-slate-500">{cert.date}</p>
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
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[12px] font-semibold text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-[#6366f1]"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{editProgram ? "Edit Training Program" : "Create Training Program"}</h3>
              <button type="button" onClick={() => { setShowProgramModal(false); resetProgramForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {formError ? <p className="mb-3 text-sm text-red-600">{formError}</p> : null}
            <form onSubmit={handleSaveProgram} className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Program Name *
                <input className={inputClass} value={programForm.name} onChange={(e) => setProgramForm((f) => ({ ...f, name: e.target.value }))} required />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Category
                <input className={inputClass} value={programForm.category} onChange={(e) => setProgramForm((f) => ({ ...f, category: e.target.value }))} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Trainer
                <input className={inputClass} value={programForm.trainer} onChange={(e) => setProgramForm((f) => ({ ...f, trainer: e.target.value }))} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-700">
                  Start Date
                  <input type="date" className={inputClass} value={programForm.start_date} onChange={(e) => setProgramForm((f) => ({ ...f, start_date: e.target.value }))} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  End Date
                  <input type="date" className={inputClass} value={programForm.end_date} onChange={(e) => setProgramForm((f) => ({ ...f, end_date: e.target.value }))} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-700">
                  Status
                  <select className={inputClass} value={programForm.status} onChange={(e) => setProgramForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="upcoming">Upcoming</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Progress %
                  <input type="number" min={0} max={100} className={inputClass} value={programForm.progress_pct} onChange={(e) => setProgramForm((f) => ({ ...f, progress_pct: e.target.value }))} />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Description
                <textarea className={inputClass} rows={3} value={programForm.description} onChange={(e) => setProgramForm((f) => ({ ...f, description: e.target.value }))} />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowProgramModal(false); resetProgramForm(); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewProgram ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{viewProgram.name}</h3>
              <button type="button" onClick={() => setViewProgram(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <dl className="space-y-2 text-sm text-slate-600">
              <div><dt className="font-medium text-slate-800">Category</dt><dd>{viewProgram.category}</dd></div>
              <div><dt className="font-medium text-slate-800">Trainer</dt><dd>{viewProgram.trainer}</dd></div>
              <div><dt className="font-medium text-slate-800">Dates</dt><dd>{viewProgram.start_date} — {viewProgram.end_date}</dd></div>
              <div><dt className="font-medium text-slate-800">Participants</dt><dd>{viewProgram.participants}</dd></div>
              <div><dt className="font-medium text-slate-800">Status</dt><dd><TrainingStatusBadge status={viewProgram.status} /></dd></div>
            </dl>
          </div>
        </div>
      ) : null}
    </HrPage>
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
