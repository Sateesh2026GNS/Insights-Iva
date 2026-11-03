import { useEffect, useMemo, useRef, useState } from "react";

import { createAlert } from "../../api/alertsApi";
import { getMyMachines } from "../../api/operatorExecutionApi";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";
import Button from "../common/Button";
import { Input, Textarea } from "../common/FormField";
import StatusBadge from "../common/StatusBadge";
import MaterialTable from "./MaterialTable";
import JobCardActions from "./JobCardActions";
import { fmtDeliveryDisplay, NOTES_MAX } from "./jobCardUiShared";
import "./operatorJobCard.css";

const ACTION_LABELS = {
  start_work: "Start Work",
  pause: "Pause Work",
  resume: "Resume Work",
  complete_production: "Complete job and send to Quality",
};

function asNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function formatQty(value, unit) {
  const number = asNumber(value);
  if (number == null) return "—";
  const qty = number.toLocaleString("en-IN");
  return unit ? `${qty} ${unit}` : qty;
}

function displayDate(value) {
  if (value == null || value === "") return "—";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return fmtDeliveryDisplay(text) || text;
  return text;
}

function statusTone(label) {
  const key = String(label || "").trim().toLowerCase();
  if (key === "in progress" || key === "assigned") return "info";
  if (key === "paused" || key === "quality check") return "warning";
  if (key === "completed") return "success";
  return "neutral";
}

function machineTone(status) {
  const key = String(status || "").trim().toLowerCase();
  if (key === "running" || key === "active") return "success";
  if (key === "idle") return "info";
  if (key === "maintenance") return "warning";
  if (key === "stopped" || key === "breakdown" || key === "offline") return "danger";
  return "neutral";
}

function validateProductionForm({ produced, rejected, rework, target, remarks }) {
  const errors = {};
  const producedNumber = produced === "" ? null : Number(produced);
  const rejectedNumber = rejected === "" ? 0 : Number(rejected);
  const reworkNumber = rework === "" ? 0 : Number(rework);
  if (produced !== "" && (Number.isNaN(producedNumber) || producedNumber < 0)) errors.produced_qty = "Enter a valid quantity";
  if (rejected !== "" && (Number.isNaN(rejectedNumber) || rejectedNumber < 0)) errors.rejected_qty = "Cannot be negative";
  if (rework !== "" && (Number.isNaN(reworkNumber) || reworkNumber < 0)) errors.rework_qty = "Cannot be negative";
  if (producedNumber != null && target != null && target > 0 && producedNumber > target) {
    errors.produced_qty = `Cannot exceed target (${target})`;
  }
  if (remarks && remarks.length > NOTES_MAX) errors.notes = `Maximum ${NOTES_MAX} characters`;
  return errors;
}

function textOrNull(value) {
  const text = String(value || "").trim();
  return text && text !== "—" ? text : null;
}

export default function OperatorJobCardBody({ card, form, onChange, submitting, onAction, onSaveProgress }) {
  const { addToast } = useToast();
  const busy = useRef(false);
  const product = card?.product_info || {};
  const instructions = card?.production_instructions || {};
  const execution = card?.execution || {};
  const header = card?.header_panel || {};
  const unit = product.unit || "Nos";
  const target = asNumber(execution.target_qty ?? execution.planned_qty ?? product.target_quantity);
  const completed = asNumber(execution.produced_qty ?? execution.completed_qty);
  const pending = target != null && completed != null ? Math.max(0, target - completed) : null;
  const progressPct = target != null && target > 0 && completed != null
    ? Math.min(100, Math.round((completed / target) * 100))
    : null;
  const editable = Boolean(card?.editable);
  const qualityHold = ["Completed", "Quality Check"].includes(card?.status_label);
  const workInstructions = textOrNull(instructions.work_instructions || card?.work_instructions);
  const safetyInstructions = textOrNull(instructions.safety_instructions);
  const specialInstructions = textOrNull(instructions.special_instructions);
  const duration = textOrNull(instructions.standard_production_time);
  const workOrderNo = textOrNull(execution.task);
  const rawOperation = textOrNull(instructions.operation || card?.production_process);
  const operation = rawOperation && rawOperation !== workOrderNo ? rawOperation : null;
  const machineId = execution.machine_id;
  const workOrderId = execution.work_order_id;

  const [fieldErrors, setFieldErrors] = useState({});
  const [machineStatus, setMachineStatus] = useState(null);
  const [machineStatusState, setMachineStatusState] = useState(machineId ? "loading" : "missing");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueMessage, setIssueMessage] = useState("");
  const [issueError, setIssueError] = useState("");
  const [issueNotice, setIssueNotice] = useState("");

  useEffect(() => {
    if (!machineId) {
      setMachineStatus(null);
      setMachineStatusState("missing");
      return undefined;
    }
    let cancelled = false;
    setMachineStatusState("loading");
    getMyMachines()
      .then((res) => {
        if (cancelled) return;
        const items = res.data?.items || [];
        const match = items.find((machine) => String(machine.id) === String(machineId));
        setMachineStatus(match?.status ? String(match.status) : null);
        setMachineStatusState(match ? "ready" : "unavailable");
      })
      .catch(() => {
        if (!cancelled) {
          setMachineStatus(null);
          setMachineStatusState("unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [machineId]);

  const materialColumns = useMemo(
    () => [
      { key: "material_name", label: "Material" },
      { key: "material_code", label: "Code" },
      { key: "required_qty", label: "Required" },
      { key: "available_qty", label: "Available" },
      { key: "unit", label: "Unit" },
      { key: "availability_status", label: "Availability" },
    ],
    []
  );

  const materialRows = useMemo(
    () =>
      (card?.materials || []).map((row) => ({
        ...row,
        availability_status: row.availability_status === "Partial" || row.availability_status === "Not Available"
          ? "Shortage"
          : row.availability_status || "—",
      })),
    [card?.materials]
  );

  const handleField = (key, value) => {
    onChange?.(key, value);
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const errors = validateProductionForm({
      produced: form.produced_qty,
      rejected: form.rejected_qty,
      rework: form.rework_qty,
      target,
      remarks: form.notes,
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProgress = async () => {
    if (submitting || busy.current || !validate()) return;
    busy.current = true;
    try {
      await onSaveProgress?.();
    } finally {
      busy.current = false;
    }
  };

  const handleComplete = async (action) => {
    if (submitting || busy.current) return;
    if (action === "complete_production" && !validate()) return;
    busy.current = true;
    try {
      await onAction?.(action);
    } finally {
      busy.current = false;
    }
  };

  const submitIssue = async (event) => {
    event.preventDefault();
    if (submitting || busy.current || !workOrderId) return;
    const title = issueTitle.trim();
    if (!title) {
      setIssueError("Enter a short title for the issue.");
      return;
    }
    setIssueError("");
    setIssueNotice("");
    busy.current = true;
    try {
      await createAlert({
        title,
        message: issueMessage.trim() || null,
        alert_type: "production_delay",
        severity: "medium",
        status: "active",
        reference_type: "work_order",
        reference_id: workOrderId,
        target_role: "Operator,Production Manager",
      });
      setIssueOpen(false);
      setIssueTitle("");
      setIssueMessage("");
      setIssueNotice("Issue reported.");
      addToast("Issue reported", "success");
    } catch (err) {
      setIssueError(apiErrorMessage(err, "The issue could not be reported."));
    } finally {
      busy.current = false;
    }
  };

  const operatorActions = (card?.allowed_actions || []).filter((action) =>
    ["start_work", "pause", "resume", "complete_production"].includes(action)
  );

  return (
    <div className="op-job">
      <header className="op-job__header">
        <div>
          <p className="op-job__kicker">Job card</p>
          <h2>{header.job_card_no || card?.card_number || "Job card number unavailable"}</h2>
          <p className="op-job__product">
            {product.product_name || "Product unavailable"}
            {product.product_code ? ` · ${product.product_code}` : ""}
          </p>
        </div>
        {card?.status_label ? (
          <StatusBadge tone={statusTone(card.status_label)}>{card.status_label}</StatusBadge>
        ) : (
          <p className="op-job__muted">Status unavailable</p>
        )}
      </header>

      <section className="op-job__section" aria-label="Assignment">
        <dl className="op-job__meta">
          <div>
            <dt>Work order</dt>
            <dd>{workOrderNo || "—"}</dd>
          </div>
          <div>
            <dt>Operator</dt>
            <dd>{header.assigned_operator || "—"}</dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>{header.priority || "—"}</dd>
          </div>
          <div>
            <dt>Assigned</dt>
            <dd>{displayDate(card?.assigned_date)}</dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd>{displayDate(header.due_date)}</dd>
          </div>
          {execution.actual_start_time ? (
            <div>
              <dt>Started</dt>
              <dd>{execution.actual_start_time}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="op-job__section" aria-labelledby="op-job-progress">
        <h3 id="op-job-progress">Production progress</h3>
        <div className="op-job__progress">
          <p>Target<strong>{formatQty(target, unit)}</strong></p>
          <p>Completed<strong>{formatQty(completed, unit)}</strong></p>
          <p>Pending<strong>{formatQty(pending, unit)}</strong></p>
          <p>Progress<strong>{progressPct == null ? "—" : `${progressPct}%`}</strong></p>
        </div>
        {progressPct != null ? (
          <div
            className="op-job__meter"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Production progress"
          >
            <span style={{ width: `${progressPct}%` }} />
          </div>
        ) : (
          <p className="op-job__muted" style={{ marginTop: "0.75rem" }}>
            Progress is unavailable until a target quantity is recorded.
          </p>
        )}
      </section>

      <div className="op-job__split">
        <section className="op-job__section" aria-labelledby="op-job-machine">
          <h3 id="op-job-machine">Machine and operation</h3>
          <dl className="op-job__facts">
            <div>
              <dt>Machine</dt>
              <dd>{execution.machine_name || instructions.machine || card?.machine || "—"}</dd>
            </div>
            <div>
              <dt>Machine code</dt>
              <dd>{execution.machine_code || "—"}</dd>
            </div>
            <div>
              <dt>Machine status</dt>
              <dd>
                {machineStatusState === "loading" ? "Loading…" : null}
                {machineStatusState === "ready" && machineStatus ? (
                  <StatusBadge tone={machineTone(machineStatus)}>{machineStatus}</StatusBadge>
                ) : null}
                {machineStatusState === "ready" && !machineStatus ? "Status unavailable" : null}
                {machineStatusState === "unavailable" || machineStatusState === "missing" ? "Status unavailable" : null}
              </dd>
            </div>
            <div>
              <dt>Operation</dt>
              <dd>{operation || "—"}</dd>
            </div>
            {duration ? (
              <div>
                <dt>Expected duration</dt>
                <dd>{duration}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="op-job__section" aria-labelledby="op-job-instructions">
          <h3 id="op-job-instructions">Instructions</h3>
          {workInstructions ? <p className="op-job__note">{workInstructions}</p> : null}
          {safetyInstructions ? (
            <p className="op-job__note">
              <strong>Safety. </strong>
              {safetyInstructions}
            </p>
          ) : null}
          {specialInstructions ? (
            <p className="op-job__note">
              <strong>Special. </strong>
              {specialInstructions}
            </p>
          ) : null}
          {!workInstructions && !safetyInstructions && !specialInstructions ? (
            <p className="op-job__muted">No production instructions were provided for this job card.</p>
          ) : null}
        </section>
      </div>

      <section className="op-job__section" aria-labelledby="op-job-materials">
        <h3 id="op-job-materials">Materials</h3>
        {materialRows.length === 0 ? (
          <p className="op-job__muted">No material check has been recorded for this job card.</p>
        ) : (
          <MaterialTable columns={materialColumns} rows={materialRows} editable={false} />
        )}
      </section>

      {qualityHold ? (
        <section className="op-job__section" aria-labelledby="op-job-quality">
          <h3 id="op-job-quality">Quality</h3>
          <p className="op-job__muted">
            {card.status_label === "Quality Check"
              ? "This job is waiting for Quality inspection. Operators cannot approve or reject it."
              : "Production is complete. Quality approval is handled by the quality team, not the operator."}
          </p>
        </section>
      ) : null}

      <section className="op-job__section" id="operator-production-entry" aria-labelledby="op-job-entry">
        <h3 id="op-job-entry">Record production</h3>
        <div className="op-job__form">
          <Input
            label="Produced quantity"
            error={fieldErrors.produced_qty}
            type="number"
            min={0}
            step="any"
            value={form.produced_qty}
            onChange={(event) => handleField("produced_qty", event.target.value)}
            disabled={!editable}
          />
          <Input
            label="Rejected quantity"
            error={fieldErrors.rejected_qty}
            type="number"
            min={0}
            step="any"
            value={form.rejected_qty}
            onChange={(event) => handleField("rejected_qty", event.target.value)}
            disabled={!editable}
          />
          <Input
            label="Rework quantity"
            error={fieldErrors.rework_qty}
            type="number"
            min={0}
            step="any"
            value={form.rework_qty}
            onChange={(event) => handleField("rework_qty", event.target.value)}
            disabled={!editable}
          />
          <Input
            label="Actual start"
            type="datetime-local"
            value={form.actual_start_time || ""}
            onChange={(event) => handleField("actual_start_time", event.target.value)}
            disabled={!editable}
          />
          <Input
            label="Actual end"
            type="datetime-local"
            value={form.actual_end_time || ""}
            onChange={(event) => handleField("actual_end_time", event.target.value)}
            disabled={!editable}
          />
          <div className="op-job__wide">
            <Textarea
              label="Remarks"
              error={fieldErrors.notes}
              rows={2}
              maxLength={NOTES_MAX}
              value={form.notes}
              onChange={(event) => handleField("notes", event.target.value)}
              disabled={!editable}
            />
          </div>
        </div>
        <div className="op-job__actions">
          {editable ? (
            <Button type="button" variant="primary" size="sm" loading={submitting} onClick={handleSaveProgress}>
              Update Production
            </Button>
          ) : null}
          {workOrderId ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setIssueOpen((open) => !open)}>
              Report Issue
            </Button>
          ) : null}
        </div>
        {issueNotice ? <p className="op-job__muted" role="status">{issueNotice}</p> : null}
        {operatorActions.length > 0 && !qualityHold ? (
          <JobCardActions
            actions={operatorActions}
            loading={submitting}
            onAction={handleComplete}
            labels={ACTION_LABELS}
          />
        ) : null}
        {issueOpen ? (
          <form className="op-job__issue" onSubmit={submitIssue}>
            <label>
              Issue title
              <input value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} maxLength={255} />
            </label>
            <label>
              Details
              <textarea value={issueMessage} onChange={(event) => setIssueMessage(event.target.value)} rows={2} />
            </label>
            {issueError ? <p className="op-job__muted" role="alert">{issueError}</p> : null}
            <Button type="submit" variant="primary" size="sm" loading={submitting}>Submit issue</Button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
