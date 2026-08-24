import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Button from "../common/Button";
import LiveIndicator from "./LiveIndicator";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { backfillWorkflowStatuses } from "../../api/workflowApi";
import { userHasWorkflowTeam } from "../../config/manufacturingWorkflow";

import WorkflowStagePipeline from "../manufacturing/WorkflowStagePipeline";

function WorkflowKpiCard({ label, count, path }) {
  return (
    <Link
      to={path || "/manufacturing/workflow"}
      className="ui-card block p-3 transition hover:border-[var(--color-primary)]/40 hover:shadow-sm"
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-text)]">{count ?? 0}</p>
    </Link>
  );
}

export default function ManufacturingWorkflowHub({ data, onRefresh }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [backfilling, setBackfilling] = useState(false);
  const counts = data?.counts || [];
  const isAdmin = userHasWorkflowTeam(user, "admin");

  const countMap = useMemo(
    () => Object.fromEntries((counts || []).map((c) => [c.key, c.count])),
    [counts]
  );

  useEffect(() => {
    if (!onRefresh) return undefined;
    const timer = setInterval(() => {
      onRefresh().catch(() => {});
    }, 30_000);
    return () => clearInterval(timer);
  }, [onRefresh]);

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
    <section className="ui-card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <LiveIndicator />
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Live manufacturing orders across all teams — counts from PostgreSQL.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" to="/manufacturing/workflow">
            Open workflow board
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
                  to={`/manufacturing/workflow?order=${item.sales_order_id}`}
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
