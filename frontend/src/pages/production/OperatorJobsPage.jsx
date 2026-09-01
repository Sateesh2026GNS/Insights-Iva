import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Factory, PlayCircle } from "lucide-react";

import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/states/ErrorState";
import Loader from "../../components/common/Loader";
import ManufacturingPageHeader from "../../components/manufacturing/ManufacturingPageHeader";
import { PriorityBadge, fmtDeliveryDisplay } from "../../components/manufacturing/jobCardUiShared";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { getOperatorJobs } from "../../api/workflowApi";
import { isOperator } from "../../config/permissions";

const STATUS_LABELS = {
  PRODUCTION_ASSIGNED: "Assigned",
  PRODUCTION_IN_PROGRESS: "In Progress",
};

function statusLabel(row) {
  if (row.work_order_status === "paused") return "Paused";
  return STATUS_LABELS[row.workflow_status] || row.workflow_status?.replace(/_/g, " ") || "—";
}

function statusTone(row) {
  if (row.work_order_status === "paused") return "bg-amber-50 text-amber-800";
  if (row.workflow_status === "PRODUCTION_IN_PROGRESS") return "bg-[var(--color-primary-soft)] text-[var(--color-primary)]";
  return "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]";
}

export default function OperatorJobsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOperatorJobs(statusFilter ? { status: statusFilter } : {});
      setJobs(res?.data?.items ?? res?.items ?? []);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 403) {
        setError("You do not have permission to view operator jobs. Sign in as an Operator.");
      } else {
        setError(detail || "Could not load your assigned jobs.");
      }
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const assigned = jobs.filter((j) => j.workflow_status === "PRODUCTION_ASSIGNED").length;
    const inProgress = jobs.filter((j) => j.workflow_status === "PRODUCTION_IN_PROGRESS").length;
    const paused = jobs.filter((j) => j.work_order_status === "paused").length;
    return { assigned, inProgress, paused, total: jobs.length };
  }, [jobs]);

  if (loading) {
    return (
      <div className="ui-page flex min-h-[40vh] items-center justify-center">
        <Loader label="Loading your jobs…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ui-page ui-stack">
        <ManufacturingPageHeader
          title="My Operator Jobs"
          subtitle="Production jobs assigned to you"
        />
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="ui-page ui-stack pb-8">
      <ManufacturingPageHeader
        title="My Operator Jobs"
        subtitle={
          isOperator(user)
            ? "Jobs assigned to you — open a job card to start or update production."
            : "All operator-assigned production jobs (admin view)"
        }
        action={
          <Button variant="outline" size="sm" onClick={load}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total assigned", value: stats.total },
          { label: "Not started", value: stats.assigned },
          { label: "In progress", value: stats.inProgress },
          { label: "Paused", value: stats.paused },
        ].map((s) => (
          <article key={s.label} className="ui-card px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{s.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-text)]">{s.value}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "", label: "All" },
          { key: "PRODUCTION_ASSIGNED", label: "Assigned" },
          { key: "PRODUCTION_IN_PROGRESS", label: "In Progress" },
        ].map((f) => (
          <button
            key={f.key || "all"}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              statusFilter === f.key
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:bg-[var(--color-primary-soft)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <article className="ui-card overflow-hidden">
        {jobs.length === 0 ? (
          <EmptyState
            title="No jobs assigned yet"
            description="When Production Manager assigns you a job, it will appear here. For local testing, run the demo seed script on the backend."
            actionLabel="Open Workflow Board"
            actionHref="/production/operator-jobs"
          />
        ) : (
          <div className="ui-table-wrap ui-table-wrap--scroll">
            <table className="ui-table w-full min-w-[720px] text-sm">
              <thead className="ui-table-head">
                <tr>
                  <th className="px-3 py-2 text-left">Job Card</th>
                  <th className="px-3 py-2 text-left">Sales Order</th>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-left">Machine</th>
                  <th className="px-3 py-2 text-left">Target</th>
                  <th className="px-3 py-2 text-left">Progress</th>
                  <th className="px-3 py-2 text-left">Priority</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.work_order_id} className="border-t border-[var(--color-border-muted)]">
                    <td className="px-3 py-2.5 font-semibold text-[var(--color-primary)]">
                      {job.operator_job_card_no || "—"}
                    </td>
                    <td className="px-3 py-2.5">{job.order_number}</td>
                    <td className="px-3 py-2.5">{job.product_name || "—"}</td>
                    <td className="px-3 py-2.5">{job.machine_name || "—"}</td>
                    <td className="ui-num px-3 py-2.5 tabular-nums">
                      {Number(job.target_quantity || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="min-w-[5rem]">
                        <div className="mb-1 text-xs tabular-nums text-[var(--color-text-muted)]">
                          {job.progress_pct ?? 0}%
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                          <div
                            className="h-full rounded-full bg-[var(--color-primary)]"
                            style={{ width: `${job.progress_pct ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <PriorityBadge priority={job.priority || "medium"} showDot={false} />
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${statusTone(job)}`}>
                        {statusLabel(job)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-text-muted)]">
                      {fmtDeliveryDisplay(job.planned_end || job.delivery_date)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        variant={job.workflow_status === "PRODUCTION_ASSIGNED" ? "primary" : "view"}
                        size="sm"
                        to={`/manufacturing/workflow/order/${job.sales_order_id}/operator`}
                        leftIcon={
                          job.workflow_status === "PRODUCTION_ASSIGNED" ? (
                            <PlayCircle className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Factory className="h-3.5 w-3.5" aria-hidden />
                          )
                        }
                      >
                        {job.workflow_status === "PRODUCTION_ASSIGNED" ? "Start" : "Open"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}
