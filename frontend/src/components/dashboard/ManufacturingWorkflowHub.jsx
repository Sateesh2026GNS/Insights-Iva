import { useEffect, useState } from "react";

import Button from "../common/Button";
import LiveIndicator from "./LiveIndicator";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import { backfillWorkflowStatuses } from "../../api/workflowApi";
import { userHasWorkflowTeam } from "../../config/manufacturingWorkflow";

import WorkflowStagePipeline from "../manufacturing/WorkflowStagePipeline";

export default function ManufacturingWorkflowHub({ data, onRefresh }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [backfilling, setBackfilling] = useState(false);
  const counts = data?.counts || [];
  const isAdmin = userHasWorkflowTeam(user, "admin");

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
        <LiveIndicator />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" to="/manufacturing/workflow">
            Open workflow
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

      <WorkflowStagePipeline
        counts={Object.fromEntries(
          (counts || []).map((c) => [c.key, c.count])
        )}
      />
    </section>
  );
}
