import { useCallback, useEffect, useMemo, useState } from "react";

import { createAlert } from "../../api/alertsApi";
import { getMyWorkOrder } from "../../api/operatorExecutionApi";
import { getMyMachines } from "../../api/operatorExecutionApi";
import { updateMachineStatus } from "../../api/productionApi";
import { getStageJobCard } from "../../api/workflowApi";
import Button from "../../components/common/Button";
import ErrorState from "../../components/common/states/ErrorState";
import LoadingState from "../../components/common/states/LoadingState";
import NetworkErrorState from "../../components/common/states/NetworkErrorState";
import PartialDataState from "../../components/common/states/PartialDataState";
import PermissionDeniedState from "../../components/common/states/PermissionDeniedState";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage, classifyApiError } from "../../utils/apiError";
import "../../styles/manufacturing-toolkit.css";
import "./operatorMyMachine.css";

const START_STATUSES = new Set(["PRODUCTION_ASSIGNED"]);
const UPDATE_STATUSES = new Set(["PRODUCTION_IN_PROGRESS"]);

function machineTone(status) {
  const key = String(status || "").trim().toLowerCase();
  if (key === "running" || key === "active") return "success";
  if (key === "idle") return "info";
  if (key === "maintenance") return "warning";
  if (key === "stopped" || key === "breakdown" || key === "down" || key === "offline") return "danger";
  return "neutral";
}

function statusLabel(status) {
  const text = String(status || "").trim();
  if (!text) return "";
  return text.replace(/_/g, " ");
}

function formatQty(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (Number.isNaN(number)) return null;
  return number.toLocaleString("en-IN");
}

function formatWhen(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function instructionLines(stage) {
  const instructions = stage?.production_instructions || {};
  const values = [
    instructions.work_instructions,
    instructions.safety_instructions,
    instructions.special_instructions,
    stage?.work_instructions,
  ];
  const lines = [];
  values.forEach((value) => {
    const text = String(value || "").trim();
    if (text && text !== "—" && !lines.includes(text)) lines.push(text);
  });
  return lines;
}

function machineKpis(machines) {
  const list = Array.isArray(machines) ? machines : [];
  const count = (pred) => list.filter(pred).length;
  const status = (machine) => String(machine.status || "").trim().toLowerCase();
  return [
    { label: "Assigned Machines", value: String(list.length), tone: "blue", icon: "M" },
    { label: "Running", value: String(count((machine) => status(machine) === "running" || status(machine) === "active")), tone: "green", icon: "R" },
    { label: "Idle", value: String(count((machine) => status(machine) === "idle")), tone: "orange", icon: "I" },
    { label: "Stopped", value: String(count((machine) => ["stopped", "breakdown", "down", "offline"].includes(status(machine)))), tone: "red", icon: "S" },
    { label: "Maintenance", value: String(count((machine) => status(machine) === "maintenance")), tone: "purple", icon: "W" },
    { label: "With Work Order", value: String(count((machine) => Boolean(machine.active_work_order))), tone: "teal", icon: "WO" },
  ];
}

function MachineStatus({ status }) {
  const text = statusLabel(status);
  if (!text) return <span className="mtk-pill mtk-pill--neutral">Status unavailable</span>;
  const tone = machineTone(status);
  return <span className={`mtk-pill mtk-pill--${tone}`}>{text}</span>;
}

function operationLabel(workOrder, stage) {
  const fromStage = stage?.production_instructions?.operation || stage?.production_process;
  return fromStage || workOrder?.job_card_stage || null;
}

export default function OperatorMyMachine() {
  const { addToast } = useToast();
  const [machines, setMachines] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadFailure, setLoadFailure] = useState(null);
  const [issueFor, setIssueFor] = useState(null);
  const [downtimeFor, setDowntimeFor] = useState(null);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueMessage, setIssueMessage] = useState("");
  const [downtimeReason, setDowntimeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailure(null);
    setActionError("");
    try {
      const res = await getMyMachines();
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      const nextDetails = {};
      await Promise.all(
        items.map(async (machine) => {
          const workOrderId = machine.active_work_order?.id;
          if (!workOrderId) {
            nextDetails[machine.id] = { workOrder: null, workOrderError: null, stage: null, stageError: null };
            return;
          }
          try {
            const workOrderRes = await getMyWorkOrder(workOrderId);
            const workOrder = workOrderRes.data || null;
            let stage = null;
            let stageError = null;
            if (workOrder?.sales_order_id) {
              try {
                const stageRes = await getStageJobCard(workOrder.sales_order_id, "operator");
                stage = stageRes.data || null;
              } catch (error) {
                if (error.response?.status !== 401) stageError = apiErrorMessage(error, "Work instructions could not be loaded.");
              }
            }
            nextDetails[machine.id] = { workOrder, workOrderError: null, stage, stageError };
          } catch (error) {
            nextDetails[machine.id] = {
              workOrder: null,
              workOrderError:
                error.response?.status === 401
                  ? null
                  : apiErrorMessage(error, "The active work order could not be loaded."),
              stage: null,
              stageError: null,
            };
          }
        })
      );
      setMachines(items);
      setDetails(nextDetails);
    } catch (error) {
      setMachines([]);
      setDetails({});
      const classified = classifyApiError(error, "Machine information could not be loaded.");
      setLoadFailure(classified);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitIssue(event, machine) {
    event.preventDefault();
    const title = issueTitle.trim();
    if (!title) {
      setActionError("Enter a short title for the machine issue.");
      return;
    }
    setSubmitting(true);
    setActionError("");
    try {
      await createAlert({
        title,
        message: issueMessage.trim() || null,
        alert_type: "machine",
        severity: "medium",
        status: "active",
        reference_type: "machine",
        reference_id: machine.id,
        module: "maintenance",
        target_role: "Operator,Production Manager",
      });
      addToast("Machine issue reported", "success");
      setIssueFor(null);
      setIssueTitle("");
      setIssueMessage("");
    } catch (error) {
      setActionError(apiErrorMessage(error, "The machine issue could not be reported."));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDowntime(event, machine) {
    event.preventDefault();
    const reason = downtimeReason.trim();
    if (!reason) {
      setActionError("Enter the reason for the downtime.");
      return;
    }
    setSubmitting(true);
    setActionError("");
    try {
      await updateMachineStatus(machine.id, "stopped", reason);
      addToast("Downtime reported", "success");
      setDowntimeFor(null);
      setDowntimeReason("");
      await load();
    } catch (error) {
      setActionError(apiErrorMessage(error, "Downtime could not be reported."));
    } finally {
      setSubmitting(false);
    }
  }

  const kpis = useMemo(() => machineKpis(machines), [machines]);
  const showSummary = !loading && !loadFailure;

  return (
    <div className="operator-my-machine min-h-full">
      <div className="mtk-root mtk-theme--navy">
        <header className="mtk-hero">
          <div className="mtk-hero__row">
            <span>Assigned equipment · Current status · Related work</span>
          </div>
          <div className="mtk-hero__title">
            <h1>My Machine</h1>
            <p>Manufacturing Production Planning &amp; Factory Control Toolkit</p>
          </div>
        </header>
        {showSummary ? (
          <div className="mtk-kpi-row" aria-label="Machine summary">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="mtk-kpi">
                <div className={`mtk-kpi__icon mtk-kpi__icon--${kpi.tone}`}>{kpi.icon}</div>
                <div className="mtk-kpi__label">{kpi.label}</div>
                <div className="mtk-kpi__value">{kpi.value}</div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mtk-body">

      {loading ? <LoadingState compact label="Loading your machine…" description="Checking the equipment assigned to you." /> : null}

      {!loading && loadFailure?.type === "permission" ? (
        <PermissionDeniedState description={loadFailure.message} />
      ) : null}
      {!loading && loadFailure?.type === "network" ? (
        <NetworkErrorState description={loadFailure.message} onRetry={load} />
      ) : null}
      {!loading && loadFailure && loadFailure.type !== "permission" && loadFailure.type !== "network" && loadFailure.type !== "session" ? (
        <ErrorState title="Machine information unavailable" description={loadFailure.message} onRetry={load} />
      ) : null}

      {!loading && !loadFailure && machines.length === 0 ? (
        <section className="mtk-panel">
          <div className="mtk-panel__title">Assignment</div>
          <div className="operator-my-machine__empty">
            <h2>No Machine Assigned</h2>
            <p>Contact your supervisor to assign a machine to your active work order.</p>
            <Button variant="primary" size="sm" to="/my-job-cards">
              View My Work Orders
            </Button>
          </div>
        </section>
      ) : null}

      {!loading && !loadFailure && machines.length > 0 ? (
        <div className="operator-my-machine__list">
          {machines.map((machine) => {
            const detail = details[machine.id] || {};
            const workOrder = detail.workOrder;
            const stage = detail.stage;
            const instructions = instructionLines(stage);
            const operation = operationLabel(workOrder, stage);
            const product = workOrder?.product_name || stage?.product_info?.name || null;
            const stageUrl = workOrder?.sales_order_id
              ? `/manufacturing/workflow/order/${workOrder.sales_order_id}/operator`
              : null;
            const workflow = workOrder?.workflow_status || "";
            const history = Array.isArray(machine.status_history) ? machine.status_history : [];
            const statusText = statusLabel(machine.status);
            const canReportDowntime = Boolean(statusText) && statusText.toLowerCase() !== "stopped";

            return (
              <article key={machine.id} className="operator-my-machine__card">
                <section className="mtk-panel" aria-labelledby={`machine-${machine.id}-title`}>
                  <h2 className="mtk-panel__title" id={`machine-${machine.id}-title`}>{machine.name || "Unnamed machine"}</h2>
                  <div className="operator-my-machine__machine">
                    <p className="operator-my-machine__code">{machine.code || "Code unavailable"}</p>
                    <MachineStatus status={machine.status} />
                  </div>
                  <dl className="operator-my-machine__facts">
                    <div>
                      <dt>Location</dt>
                      <dd>{machine.location || "—"}</dd>
                    </div>
                    <div>
                      <dt>Shift</dt>
                      <dd>{machine.current_shift || "—"}</dd>
                    </div>
                  </dl>
                </section>

                <section className="mtk-panel" aria-labelledby={`machine-${machine.id}-status`}>
                  <h3 className="mtk-panel__title" id={`machine-${machine.id}-status`}>Machine status</h3>
                  {history.length === 0 ? (
                    <p className="operator-my-machine__muted">No downtime or status history is recorded for this machine.</p>
                  ) : (
                    <ul className="operator-my-machine__history">
                      {history.slice(0, 4).map((event, index) => (
                        <li key={`${event.started_at || "event"}-${index}`}>
                          <span>{statusLabel(event.status) || "Status unavailable"}</span>
                          {event.reason ? <span>{event.reason}</span> : null}
                          {formatWhen(event.started_at) ? <time dateTime={event.started_at}>{formatWhen(event.started_at)}</time> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="mtk-panel" aria-labelledby={`machine-${machine.id}-job`}>
                  <h3 className="mtk-panel__title" id={`machine-${machine.id}-job`}>Active work order</h3>
                  {!machine.active_work_order ? (
                    <p className="operator-my-machine__muted">No active work order is linked to this machine.</p>
                  ) : (
                    <>
                      <p className="operator-my-machine__job-number">
                        {machine.active_work_order.work_order_number || `Work order #${machine.active_work_order.id}`}
                      </p>
                      {detail.workOrderError ? (
                        <PartialDataState
                          title="Work order details unavailable"
                          description={detail.workOrderError}
                          onRetry={load}
                        />
                      ) : null}
                      {workOrder ? (
                        <dl className="operator-my-machine__facts">
                          <div>
                            <dt>Product</dt>
                            <dd>{product || "—"}</dd>
                          </div>
                          <div>
                            <dt>Operation</dt>
                            <dd>{operation || "—"}</dd>
                          </div>
                          <div>
                            <dt>Target</dt>
                            <dd>{formatQty(workOrder.planned_quantity) ?? "—"}</dd>
                          </div>
                          <div>
                            <dt>Completed</dt>
                            <dd>{formatQty(workOrder.produced_quantity ?? workOrder.actual_quantity) ?? "—"}</dd>
                          </div>
                          <div>
                            <dt>Remaining</dt>
                            <dd>{formatQty(workOrder.remaining_quantity) ?? "—"}</dd>
                          </div>
                          <div>
                            <dt>Work order status</dt>
                            <dd>{statusLabel(workOrder.status) || "—"}</dd>
                          </div>
                        </dl>
                      ) : null}
                    </>
                  )}
                </section>

                {instructions.length > 0 || detail.stageError ? (
                  <section
                    className="mtk-panel"
                    id={`omm-instructions-${machine.id}`}
                    aria-labelledby={`machine-${machine.id}-instructions`}
                  >
                    <h3 className="mtk-panel__title" id={`machine-${machine.id}-instructions`}>Instructions</h3>
                    {detail.stageError ? (
                      <PartialDataState title="Instructions unavailable" description={detail.stageError} onRetry={load} />
                    ) : (
                      <ul className="operator-my-machine__instructions">
                        {instructions.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                ) : null}

                <div className="operator-my-machine__actions">
                  {machine.active_work_order ? (
                    <Button variant="secondary" size="sm" to={stageUrl || "/my-job-cards"}>
                      View Work Order
                    </Button>
                  ) : null}
                  {stageUrl && START_STATUSES.has(workflow) ? (
                    <Button variant="primary" size="sm" to={stageUrl}>
                      Start Work
                    </Button>
                  ) : null}
                  {stageUrl && UPDATE_STATUSES.has(workflow) ? (
                    <Button variant="primary" size="sm" to={stageUrl}>
                      Update Production
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIssueFor(issueFor === machine.id ? null : machine.id);
                      setDowntimeFor(null);
                      setActionError("");
                      setIssueTitle(`Machine issue — ${machine.name || machine.code || machine.id}`);
                    }}
                  >
                    Report Machine Issue
                  </Button>
                  {canReportDowntime ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDowntimeFor(downtimeFor === machine.id ? null : machine.id);
                        setIssueFor(null);
                        setActionError("");
                      }}
                    >
                      Report Downtime
                    </Button>
                  ) : null}
                  {instructions.length > 0 ? (
                    <Button variant="ghost" size="sm" href={`#omm-instructions-${machine.id}`}>
                      View Instructions
                    </Button>
                  ) : null}
                </div>

                {issueFor === machine.id ? (
                  <form className="operator-my-machine__form" onSubmit={(event) => submitIssue(event, machine)}>
                    <label>
                      Issue title
                      <input value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} maxLength={255} required />
                    </label>
                    <label>
                      Details
                      <textarea value={issueMessage} onChange={(event) => setIssueMessage(event.target.value)} rows={3} />
                    </label>
                    {actionError ? <p className="operator-my-machine__form-error" role="alert">{actionError}</p> : null}
                    <div className="operator-my-machine__form-actions">
                      <Button type="submit" variant="primary" size="sm" loading={submitting}>
                        Submit issue
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setIssueFor(null)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : null}

                {downtimeFor === machine.id ? (
                  <form className="operator-my-machine__form" onSubmit={(event) => submitDowntime(event, machine)}>
                    <label>
                      Downtime reason
                      <textarea value={downtimeReason} onChange={(event) => setDowntimeReason(event.target.value)} rows={3} required />
                    </label>
                    <p className="operator-my-machine__muted">This sets the machine status to stopped and sends the reason to production managers.</p>
                    {actionError ? <p className="operator-my-machine__form-error" role="alert">{actionError}</p> : null}
                    <div className="operator-my-machine__form-actions">
                      <Button type="submit" variant="primary" size="sm" loading={submitting}>
                        Submit downtime
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDowntimeFor(null)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
        </div>
      </div>
    </div>
  );
}
