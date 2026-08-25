import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileX,
  Hourglass,
  MoreVertical,
  Plus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import PlaceholderPage from "../../components/common/PlaceholderPage";
import InventoryRowActionsMenu from "../../components/inventory/InventoryRowActionsMenu";
import Loader from "../../components/common/Loader";
import { AddButton } from "../../components/common/Button";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import {
  createRecruitmentApplicant,
  createRecruitmentJob,
  deleteRecruitmentApplicant,
  deleteRecruitmentJob,
  getRecruitmentDashboard,
  updateRecruitmentApplicant,
  updateRecruitmentJob,
} from "../../api/hrApi";
import { apiErrorMessage } from "../../utils/apiError";
import {
  EMPTY_RECRUITMENT_DASHBOARD,
  mergeRecruitmentDashboard,
  recruitmentApplicantStatusBadgeClass,
  recruitmentApplicantStatusLabel,
  recruitmentJobStatusBadgeClass,
} from "../../data/hrMasterData";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#6366f1] focus:outline-none focus:ring-2 focus:ring-indigo-100";

const FUNNEL_WIDTHS = [100, 88, 76, 64, 52, 40];

function Panel({ title, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ${className}`}>
      <h2 className="mb-4 ui-section-title">{title}</h2>
      {children}
    </div>
  );
}

function RecKpiCard({ label, value, icon: Icon, tone, trend }) {
  const tones = {
    purple: "bg-[#ede9fe] text-[#7c3aed]",
    green: "bg-[#dcfce7] text-[#16a34a]",
    orange: "bg-[#ffedd5] text-[#ea580c]",
    pink: "bg-[#fce7f3] text-[#db2777]",
    red: "bg-[#fee2e2] text-[#ef4444]",
  };
  let trendClass = "text-slate-500";
  let trendText = "";
  if (trend?.pct != null) {
    const up = trend.dir === "up";
    if (trend.positive === false && !up) trendClass = "text-red-600";
    else if (trend.positive === false && up) trendClass = "text-orange-600";
    else trendClass = up ? "text-emerald-600" : "text-emerald-600";
    trendText = `${up ? "↑" : "↓"} ${trend.pct}% vs last month`;
  }
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-[22px] font-bold leading-tight text-slate-900">{value}</p>
          {trendText ? <p className={`mt-1 text-xs font-medium ${trendClass}`}>{trendText}</p> : null}
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function JobStatusBadge({ status }) {
  const label = String(status || "open").charAt(0).toUpperCase() + String(status || "open").slice(1);
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${recruitmentJobStatusBadgeClass(status)}`}>
      {label}
    </span>
  );
}

function ApplicantStatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${recruitmentApplicantStatusBadgeClass(status)}`}>
      {recruitmentApplicantStatusLabel(status)}
    </span>
  );
}

function RecruitmentFunnel({ stages }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="mx-auto flex w-full max-w-[220px] flex-col items-center gap-1 py-1">
        {stages.map((stage, index) => (
          <div
            key={stage.key}
            className="flex h-10 items-center justify-center text-xs font-semibold text-white transition-all"
            style={{
              width: `${FUNNEL_WIDTHS[index] || 40}%`,
              background: stage.color,
              clipPath: "polygon(6% 0, 94% 0, 100% 100%, 0% 100%)",
            }}
            title={`${stage.label}: ${stage.count}`}
          >
            {index === 0 ? stage.count : ""}
          </div>
        ))}
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5 text-[12px]">
        {stages.map((stage) => (
          <li key={stage.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: stage.color }} />
              {stage.label}
            </span>
            <span className="font-semibold text-slate-800">
              {stage.count}
              {stage.key !== "applicants" ? (
                <span className="ml-1 font-medium text-slate-500">({stage.pct}%)</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
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

function RecruitmentDashboard() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(EMPTY_RECRUITMENT_DASHBOARD);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(5);
  const [menuId, setMenuId] = useState(null);
  const [jobMenuId, setJobMenuId] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [viewJob, setViewJob] = useState(null);
  const [editJob, setEditJob] = useState(null);
  const [editApplicant, setEditApplicant] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [jobForm, setJobForm] = useState({
    title: "",
    department: "",
    openings_count: 1,
    status: "open",
    location: "",
    description: "",
  });
  const [applicantForm, setApplicantForm] = useState({
    full_name: "",
    job_opening_id: "",
    email: "",
    phone: "",
    source: "",
    stage: "applied",
    status: "new",
    applied_on: new Date().toISOString().slice(0, 10),
  });

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      try {
        const res = await getRecruitmentDashboard({
          applicant_page: page,
          applicant_page_size: pageSize,
        });
        setData(mergeRecruitmentDashboard(res.data || {}));
      } catch (err) {
        setData(mergeRecruitmentDashboard());
        addToast(apiErrorMessage(err, "Failed to load recruitment data"), "error");
      } finally {
        setLoading(false);
      }
    },
    [addToast, page, pageSize]
  );

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const resetJobForm = () => {
    setJobForm({
      title: "",
      department: "",
      openings_count: 1,
      status: "open",
      location: "",
      description: "",
    });
    setFormError("");
    setEditJob(null);
  };

  const resetApplicantForm = () => {
    setApplicantForm({
      full_name: "",
      job_opening_id: "",
      email: "",
      phone: "",
      source: "",
      stage: "applied",
      status: "new",
      applied_on: new Date().toISOString().slice(0, 10),
    });
    setFormError("");
    setEditApplicant(null);
  };

  const openCreateJob = () => {
    resetJobForm();
    setShowJobModal(true);
  };

  const openEditJob = (job) => {
    setEditJob(job);
    setJobForm({
      title: job.title || "",
      department: job.department === "—" ? "" : job.department || "",
      openings_count: job.openings_count ?? job.openings ?? 1,
      status: job.status || "open",
      location: job.location || "",
      description: job.description || "",
    });
    setFormError("");
    setShowJobModal(true);
    setJobMenuId(null);
  };

  const openEditApplicant = (row) => {
    setEditApplicant(row);
    setApplicantForm({
      full_name: row.name || row.full_name || "",
      job_opening_id: row.job_opening_id || "",
      email: row.email || "",
      phone: row.phone || "",
      source: row.source || "",
      stage: String(row.stage || "applied").toLowerCase().replace(/\s+/g, "_"),
      status: row.status || "new",
      applied_on: row.applied_on_raw || (row.applied_on && row.applied_on !== "—" ? row.applied_on : new Date().toISOString().slice(0, 10)),
    });
    setFormError("");
    setShowApplicantModal(true);
    setMenuId(null);
  };

  const handleSaveJob = async (e) => {
    e.preventDefault();
    if (!jobForm.title.trim()) {
      setFormError("Job title is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        ...jobForm,
        openings_count: Number(jobForm.openings_count) || 1,
        department: jobForm.department || null,
        location: jobForm.location || null,
        description: jobForm.description || null,
      };
      if (editJob) {
        await updateRecruitmentJob(editJob.id, payload);
        addToast("Job opening updated", "success");
      } else {
        await createRecruitmentJob(payload);
        addToast("Job opening created", "success");
      }
      setShowJobModal(false);
      resetJobForm();
      await load(true);
    } catch (err) {
      setFormError(apiErrorMessage(err, "Failed to save job opening"));
      addToast(apiErrorMessage(err, "Failed to save job opening"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJob = async (job) => {
    if (!window.confirm(`Delete job opening "${job.title}"?`)) return;
    try {
      await deleteRecruitmentJob(job.id);
      addToast("Job opening deleted", "success");
      setJobMenuId(null);
      await load(true);
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete job opening"), "error");
    }
  };

  const handleSaveApplicant = async (e) => {
    e.preventDefault();
    if (!applicantForm.full_name.trim()) {
      setFormError("Candidate name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        full_name: applicantForm.full_name.trim(),
        job_opening_id: applicantForm.job_opening_id ? Number(applicantForm.job_opening_id) : null,
        email: applicantForm.email || null,
        phone: applicantForm.phone || null,
        source: applicantForm.source || null,
        stage: applicantForm.stage,
        status: applicantForm.status,
        applied_on: applicantForm.applied_on || null,
      };
      if (editApplicant) {
        await updateRecruitmentApplicant(editApplicant.id, payload);
        addToast("Applicant updated", "success");
      } else {
        await createRecruitmentApplicant(payload);
        addToast("Applicant added", "success");
      }
      setShowApplicantModal(false);
      resetApplicantForm();
      await load(true);
    } catch (err) {
      setFormError(apiErrorMessage(err, "Failed to save applicant"));
      addToast(apiErrorMessage(err, "Failed to save applicant"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteApplicant = async (row) => {
    if (!window.confirm(`Delete applicant "${row.name}"?`)) return;
    try {
      await deleteRecruitmentApplicant(row.id);
      addToast("Applicant deleted", "success");
      setMenuId(null);
      await load(true);
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete applicant"), "error");
    }
  };

  const displayTotal = data.total_applicants;
  const totalPages = Math.max(1, Math.ceil(displayTotal / pageSize));
  const pageRows = data.recent_applicants || [];
  const from = displayTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, displayTotal);

  const sourceData = data.source_slices.map((s) => ({
    name: s.label,
    value: s.count,
    color: s.color,
    pct: s.pct,
  }));

  const trends = data.kpi_trends || {};

  if (loading) return <Loader label="Loading recruitment..." />;

  return (
    <div className="hr-page ui-page ui-stack min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="ui-page-title">Recruitment</h1>
          <p className="ui-subtitle mt-0">Track and manage your recruitment process</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddButton type="button" onClick={openCreateJob}>
            Create Job Opening
          </AddButton>
          <button
            type="button"
            onClick={() => {
              resetApplicantForm();
              setShowApplicantModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <UserPlus className="h-4 w-4" />
            Add Applicant
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <MoreVertical className="h-4 w-4" />
            More Actions
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <RecKpiCard label="Total Openings" value={data.total_openings} icon={Briefcase} tone="purple" trend={trends.openings} />
        <RecKpiCard label="Active Candidates" value={data.active_candidates} icon={Users} tone="green" trend={trends.candidates} />
        <RecKpiCard label="Hired This Month" value={data.hired_this_month} icon={UserPlus} tone="orange" trend={trends.hired} />
        <RecKpiCard
          label="Offer In Progress"
          value={String(data.offer_in_progress).padStart(2, "0")}
          icon={Hourglass}
          tone="pink"
          trend={trends.offers}
        />
        <RecKpiCard label="Rejected This Month" value={data.rejected_this_month} icon={FileX} tone="red" trend={trends.rejected} />
      </div>

      {/* Funnel + Job Openings */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Recruitment Funnel">
          <RecruitmentFunnel stages={data.funnel_stages} />
        </Panel>

        <Panel title="Job Openings">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full w-full border-collapse text-left text-sm">
              <thead className="ui-table-head">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-3">Job Title</th>
                  <th className="border-b border-slate-200 px-3 py-3">Department</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-center">Openings</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-center">Applicants</th>
                  <th className="border-b border-slate-200 px-3 py-3">Status</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.job_openings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border-b border-slate-100 px-3 py-8 text-center text-sm text-slate-500">
                      No recruitment records found
                    </td>
                  </tr>
                ) : (
                data.job_openings.map((job, idx) => (
                  <tr key={job.id} className={idx % 2 === 1 ? "bg-slate-50/60 hover:bg-slate-50" : "hover:bg-slate-50/80"}>
                    <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-800">{job.title}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{job.department}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-center tabular-nums text-slate-700">{job.openings}</td>
                    <td className="border-b border-slate-100 px-3 py-3 text-center tabular-nums text-slate-700">{job.applicants}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewJob(job)}
                          className="grid h-8 w-8 place-items-center rounded-md text-[#6366f1] hover:bg-indigo-50"
                          aria-label="View job"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <InventoryRowActionsMenu
                          rowId={job.id}
                          isOpen={jobMenuId === job.id}
                          onOpen={setJobMenuId}
                          onClose={() => setJobMenuId(null)}
                          onView={() => setViewJob(job)}
                          onEdit={() => openEditJob(job)}
                          onDelete={() => handleDeleteJob(job)}
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
        </Panel>
      </div>

      {/* Recent Applicants + Source Analytics */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel title="Recent Applicants">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full w-full border-collapse text-left text-sm">
                <thead className="ui-table-head">
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-3 min-w-[160px]">Candidate Name</th>
                    <th className="border-b border-slate-200 px-3 py-3">Job Title</th>
                    <th className="border-b border-slate-200 px-3 py-3">Applied On</th>
                    <th className="border-b border-slate-200 px-3 py-3">Current Stage</th>
                    <th className="border-b border-slate-200 px-3 py-3">Status</th>
                    <th className="border-b border-slate-200 px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="border-b border-slate-100 px-3 py-8 text-center text-sm text-slate-500">
                        No applicants found
                      </td>
                    </tr>
                  ) : (
                  pageRows.map((row, idx) => (
                    <tr key={row.id} className={idx % 2 === 1 ? "bg-slate-50/60 hover:bg-slate-50" : "hover:bg-slate-50/80"}>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${row.avatar_tone}`}>
                            {row.avatar}
                          </div>
                          <span className="font-semibold text-slate-800">{row.name}</span>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.job_title}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.applied_on}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.stage}</td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <ApplicantStatusBadge status={row.status} />
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditApplicant(row)}
                            className="grid h-8 w-8 place-items-center rounded-md text-[#6366f1] hover:bg-indigo-50"
                            aria-label="View applicant"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <InventoryRowActionsMenu
                            rowId={row.id}
                            isOpen={menuId === row.id}
                            onOpen={setMenuId}
                            onClose={() => setMenuId(null)}
                            onView={() => openEditApplicant(row)}
                            onEdit={() => openEditApplicant(row)}
                            onDelete={() => handleDeleteApplicant(row)}
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
          </Panel>
        </div>

        <Panel title="Source Analytics">
          <div className="relative mx-auto h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceData} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={2} stroke="none">
                  {sourceData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[20px] font-bold text-slate-900">{data.source_total}</span>
              <span className="text-xs text-slate-500">Total</span>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-[12px]">
            {sourceData.length === 0 ? (
              <li className="text-center text-slate-500">No source data yet</li>
            ) : (
            sourceData.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                  {d.name}
                </span>
                <span className="font-semibold text-slate-800">
                  {d.pct}% ({d.value})
                </span>
              </li>
            ))
            )}
          </ul>
        </Panel>
      </div>

      {showJobModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{editJob ? "Edit Job Opening" : "Create Job Opening"}</h3>
              <button type="button" onClick={() => { setShowJobModal(false); resetJobForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {formError ? <p className="mb-3 text-sm text-red-600">{formError}</p> : null}
            <form onSubmit={handleSaveJob} className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Job Title *
                <input className={inputClass} value={jobForm.title} onChange={(e) => setJobForm((f) => ({ ...f, title: e.target.value }))} required />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Department
                <input className={inputClass} value={jobForm.department} onChange={(e) => setJobForm((f) => ({ ...f, department: e.target.value }))} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-700">
                  Openings
                  <input type="number" min={1} className={inputClass} value={jobForm.openings_count} onChange={(e) => setJobForm((f) => ({ ...f, openings_count: e.target.value }))} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Status
                  <select className={inputClass} value={jobForm.status} onChange={(e) => setJobForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Location
                <input className={inputClass} value={jobForm.location} onChange={(e) => setJobForm((f) => ({ ...f, location: e.target.value }))} />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Description
                <textarea className={inputClass} rows={3} value={jobForm.description} onChange={(e) => setJobForm((f) => ({ ...f, description: e.target.value }))} />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowJobModal(false); resetJobForm(); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showApplicantModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{editApplicant ? "Edit Applicant" : "Add Applicant"}</h3>
              <button type="button" onClick={() => { setShowApplicantModal(false); resetApplicantForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {formError ? <p className="mb-3 text-sm text-red-600">{formError}</p> : null}
            <form onSubmit={handleSaveApplicant} className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Candidate Name *
                <input className={inputClass} value={applicantForm.full_name} onChange={(e) => setApplicantForm((f) => ({ ...f, full_name: e.target.value }))} required />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Job Opening
                <select className={inputClass} value={applicantForm.job_opening_id} onChange={(e) => setApplicantForm((f) => ({ ...f, job_opening_id: e.target.value }))}>
                  <option value="">— Select job —</option>
                  {data.job_openings.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-700">
                  Stage
                  <select className={inputClass} value={applicantForm.stage} onChange={(e) => setApplicantForm((f) => ({ ...f, stage: e.target.value }))}>
                    <option value="applied">Applied</option>
                    <option value="screening">Screening</option>
                    <option value="interview">Interview</option>
                    <option value="offer">Offer</option>
                    <option value="hired">Hired</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Status
                  <select className={inputClass} value={applicantForm.status} onChange={(e) => setApplicantForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="new">New</option>
                    <option value="in_progress">In Progress</option>
                    <option value="hired">Hired</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Source
                <input className={inputClass} value={applicantForm.source} onChange={(e) => setApplicantForm((f) => ({ ...f, source: e.target.value }))} placeholder="LinkedIn, Referral, etc." />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowApplicantModal(false); resetApplicantForm(); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[#6366f1] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {viewJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{viewJob.title}</h3>
              <button type="button" onClick={() => setViewJob(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <dl className="space-y-2 text-sm text-slate-600">
              <div><dt className="font-medium text-slate-800">Department</dt><dd>{viewJob.department}</dd></div>
              <div><dt className="font-medium text-slate-800">Openings</dt><dd>{viewJob.openings}</dd></div>
              <div><dt className="font-medium text-slate-800">Applicants</dt><dd>{viewJob.applicants}</dd></div>
              <div><dt className="font-medium text-slate-800">Status</dt><dd><JobStatusBadge status={viewJob.status} /></dd></div>
              {viewJob.description ? <div><dt className="font-medium text-slate-800">Description</dt><dd>{viewJob.description}</dd></div> : null}
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Recruitment() {
  const { pathname } = useLocation();
  const isDashboard = pathname === "/hr/recruitment" || pathname.endsWith("/recruitment");

  if (!isDashboard) {
    const titles = {
      "/hr/recruitment/candidates": "Recruitment — Candidates",
      "/hr/recruitment/interviews": "Recruitment — Interviews",
    };
    return (
      <PlaceholderPage
        title={titles[pathname] || "Recruitment"}
        description="Manage job openings, candidate pipelines, and interview schedules from this module."
      />
    );
  }

  return <RecruitmentDashboard />;
}
