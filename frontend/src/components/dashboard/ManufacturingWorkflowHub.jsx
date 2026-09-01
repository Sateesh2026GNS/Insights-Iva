import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";

import Button from "../common/Button";
import Loader from "../common/Loader";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { backfillWorkflowStatuses, getWorkflowHub } from "../../api/workflowApi";
import { userHasWorkflowTeam } from "../../config/manufacturingWorkflow";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";

import WorkflowStagePipeline from "../manufacturing/WorkflowStagePipeline";

function WorkflowKpiCard({ label, count, path }) {
  return (
    <Link
      to={path || "/production/work-orders"}
      className="ui-card block p-3 transition hover:border-[var(--color-primary)]/40 hover:shadow-sm"
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-text)]">{count ?? 0}</p>
    </Link>
  );
}

function LiveToggleButton({ expanded, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls="live-manufacturing-panel"
      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] active:scale-[0.98] dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Live
      <ChevronDown
        className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        aria-hidden
      />
    </button>
  );
}

function ManufacturingWorkflowPanel({ data, onRefresh }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [backfilling, setBackfilling] = useState(false);
  const counts = data?.counts || [];
  const isAdmin = userHasWorkflowTeam(user, "admin");

  const countMap = useMemo(
    () => Object.fromEntries((counts || []).map((c) => [c.key, c.count])),
    [counts]
  );

  const runBackfill = async (dryRun = false) => {
    setBackfilling(true);
    try {
      const res = await backfillWorkflowStatuses(dryRun);
      const body = res?.data ?? res;
      addToast(
        dryRun
          ? `Preview: ${body.updated} order(s) would be backfilled`
          : `Backfilled ${body.updated} legacy order(s)`,
        "success"
      );
      onRefresh?.();
    } catch (err) {
      addToast(err?.response?.data?.detail || "Backfill failed", "error");
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <section id="live-manufacturing-panel" className="ui-card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text)]">Live Manufacturing Orders</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Live manufacturing orders across all teams — counts from PostgreSQL.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" to="/production/work-orders">
            Open work orders
          </Button>
          {isAdmin ? (
            <>
              <Button variant="outline" size="sm" loading={backfilling} onClick={() => runBackfill(true)}>
                Preview backfill
              </Button>
              <Button variant="secondary" size="sm" loading={backfilling} onClick={() => runBackfill(false)}>
                Backfill legacy
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {counts.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {counts.map((bucket) => (
            <WorkflowKpiCard
              key={bucket.key}
              label={bucket.label}
              count={bucket.count}
              path={bucket.path}
            />
          ))}
        </div>
      ) : null}

      <WorkflowStagePipeline countItems={counts} counts={countMap} compact />

      {data?.live_cards?.length ? (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
            Orders in progress
          </h3>
          <ul className="ui-stack gap-2">
            {data.live_cards.map((item) => (
              <li key={item.sales_order_id}>
                <Link
                  to={`/sales/orders/${item.sales_order_id}`}
                  className="block rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface)] p-3 hover:border-[var(--color-primary)]/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[var(--color-text)]">{item.job_card_no}</span>
                    <span className="text-xs font-semibold uppercase text-[var(--color-primary)]">{item.priority}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {item.customer} · {item.product} · {item.quantity} {item.unit}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-semibold">
                    {(item.workflow_tracker || []).map((step) => (
                      <span
                        key={step.key}
                        className={
                          step.status === "completed"
                            ? "text-[var(--color-success)]"
                            : step.status === "current"
                              ? "text-[var(--color-primary)]"
                              : step.status === "rejected" || step.status === "blocked"
                                ? "text-[var(--color-danger)]"
                                : "text-[var(--color-text-faint)]"
                        }
                      >
                        {step.label.split(" ")[0]}
                        {step.status === "completed" ? " ✓" : step.status === "current" ? " →" : " ○"}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
          No active manufacturing orders. Confirm a sales order to start the workflow.
        </p>
      )}
    </section>
  );
}

export default function ManufacturingWorkflowHub() {
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getWorkflowHub();
      setData(res?.data ?? res);
    } catch (err) {
      setLoadError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load live manufacturing orders."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleExpanded = () => {
    setExpanded((prev) => {
      const next = !prev;
      if (next) setMounted(true);
      return next;
    });
  };

  useEffect(() => {
    if (!expanded) return undefined;
    if (!data && !loading) {
      fetchData();
    }
    return undefined;
  }, [expanded, data, loading, fetchData]);

  useEffect(() => {
    if (!expanded || !data) return undefined;
    const timer = setInterval(() => {
      fetchData().catch(() => {});
    }, 30_000);
    return () => clearInterval(timer);
  }, [expanded, data, fetchData]);

  useManufacturingRefresh(
    expanded && data ? () => fetchData() : null
  );

  useEffect(() => {
    if (expanded || !mounted) return undefined;
    const timer = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timer);
  }, [expanded, mounted]);

  return (
    <div className="space-y-0">
      <div className="flex justify-end">
        <LiveToggleButton expanded={expanded} onClick={toggleExpanded} />
      </div>

      {mounted ? (
        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className={`pt-3 ${expanded ? "opacity-100" : "opacity-0"} transition-opacity duration-200`}>
              {loading && !data ? (
                <div className="ui-card p-6">
                  <Loader label="Loading live manufacturing orders…" />
                </div>
              ) : loadError ? (
                <div className="ui-card space-y-3 p-4" role="alert">
                  <p className="text-sm text-[var(--color-danger)]">{loadError}</p>
                  <Button variant="outline" size="sm" onClick={fetchData}>
                    Retry
                  </Button>
                </div>
              ) : data ? (
                <ManufacturingWorkflowPanel data={data} onRefresh={fetchData} />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
