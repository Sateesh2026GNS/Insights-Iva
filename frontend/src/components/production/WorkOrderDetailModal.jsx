import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ClipboardList,
  FileText,
  Loader2,
  Pause,
  Play,
  Printer,
  Square,
  Wrench,
  X,
} from "lucide-react";

import {
  buildWorkOrderWorkflowSteps,
  canWoComplete,
  canWoIssueMaterials,
  canWoPause,
  canWoStart,
  canWoStop,
  displayWoValue,
  formatWoDateTime,
  priorityBadge,
  woStatusLabel,
} from "../../data/workOrdersMasterData";
import useAuth from "../../hooks/useAuth";
import { printWorkOrder } from "../../utils/printUtils";
import { cleanProductLabel } from "../../utils/productLabel";

import Button, { IconButton } from "../common/Button";
import StatusBadge from "../common/StatusBadge";
import WorkflowTracker from "../manufacturing/WorkflowTracker";
import { operatorJobCardUrl } from "../../utils/jobCardRoutes";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "materials", label: "Materials" },
  { id: "machines", label: "Machines" },
  { id: "operators", label: "Operators" },
  { id: "quality", label: "Quality" },
  { id: "maintenance", label: "Maintenance" },
  { id: "documents", label: "Documents" },
  { id: "audit", label: "Audit Logs" },
];

function useShellInset() {
  const readInset = useCallback(() => {
    if (typeof window === "undefined") return "0px";
    if (window.innerWidth < 640) return "0px";
    const shell = document.querySelector(".app-shell");
    const collapsed = shell?.getAttribute("data-sidebar-collapsed") === "true";
    return collapsed ? "72px" : "240px";
  }, []);

  const [insetLeft, setInsetLeft] = useState(readInset);

  useEffect(() => {
    const update = () => setInsetLeft(readInset());
    update();
    window.addEventListener("resize", update);
    const shell = document.querySelector(".app-shell");
    const obs = shell
      ? new MutationObserver(update)
      : null;
    if (shell && obs) {
      obs.observe(shell, { attributes: true, attributeFilter: ["data-sidebar-collapsed"] });
    }
    return () => {
      window.removeEventListener("resize", update);
      obs?.disconnect();
    };
  }, [readInset]);

  return insetLeft;
}

function DetailField({ label, value }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface-muted)]/50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[var(--color-text)]">{displayWoValue(value)}</p>
    </div>
  );
}

function ProgressSection({ produced, planned, remaining, pct }) {
  const p = Number(pct ?? (planned ? Math.round((produced / planned) * 100) : 0));
  const safePlanned = Number(planned || 0);
  const safeProduced = Number(produced || 0);
  const safeRemaining = remaining != null ? Number(remaining) : Math.max(safePlanned - safeProduced, 0);

  return (
    <div className="rounded-xl border border-[var(--color-border-muted)] bg-[var(--color-surface-muted)]/40 p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Progress</h3>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tabular-nums text-[var(--color-text)]">
            {safeProduced}
            <span className="text-base font-semibold text-[var(--color-text-muted)]"> / {safePlanned}</span>
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">Completed / Total quantity</p>
        </div>
        <p className="text-xl font-bold tabular-nums text-[var(--color-primary)]">{Math.min(100, Math.max(0, p))}%</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-border-muted)]">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-[width]"
          style={{ width: `${Math.min(p, 100)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">
        Remaining: <span className="font-semibold tabular-nums text-[var(--color-text)]">{safeRemaining}</span>
      </p>
    </div>
  );
}

function woStatusTone(row) {
  if (row?.is_delayed) return "danger";
  const s = String(row?.status || "").toLowerCase();
  if (s === "completed" || s === "closed" || s === "done") return "success";
  if (s === "running" || s === "in_progress" || s === "started") return "progress";
  if (s === "paused" || s === "on_hold" || s === "quality_check") return "warning";
  return "pending";
}

export function WorkOrderStartModal({ workOrder, checks, onClose, onConfirm, loading }) {
  if (!workOrder) return null;
  const allReady = checks?.every((c) => c.ready);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-[var(--color-text)]">Start Work Order</h3>
        <p className="text-sm text-[var(--color-text-muted)]">{workOrder.work_order_number}</p>
        <ul className="mt-4 space-y-2">
          {(checks || []).map((c) => (
            <li
              key={c.check_type}
              className={`rounded-lg px-3 py-2 text-sm ${
                c.ready
                  ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                  : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
              }`}
            >
              <p className="font-semibold">{c.label}</p>
              <p className="text-xs opacity-90">{c.message}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="cancel" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="button" disabled={!allReady || loading} onClick={onConfirm}>
            {loading ? "Starting…" : "Start"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function WorkOrderCompleteModal({ workOrder, steps, onClose }) {
  if (!workOrder) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-[var(--color-success)]">Work Order Completed</h3>
        <p className="text-sm text-[var(--color-text-muted)]">{workOrder.work_order_number}</p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-[var(--color-text-secondary)]">
          {(steps || []).map((s, i) => <li key={i}>{s}</li>)}
        </ol>
        <Button variant="primary" type="button" onClick={onClose} className="mt-4 w-full">Done</Button>
      </div>
    </div>,
    document.body
  );
}

export default function WorkOrderDetailModal({
  workOrder,
  detail,
  detailLoading = false,
  detailError = null,
  onClose,
  onIssueMaterials,
  issuing,
  onStart,
  onPause,
  onStop,
  onComplete,
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const insetLeft = useShellInset();

  const w = useMemo(() => ({ ...workOrder, ...(detail || {}) }), [workOrder, detail]);
  const workflowSteps = useMemo(() => buildWorkOrderWorkflowSteps(w), [w]);
  const currentStage = workflowSteps.find((s) => s.status === "current");

  const planned = Number(w.planned_quantity || 0);
  const produced = Number(w.produced_quantity ?? w.actual_quantity ?? 0);
  const remaining = w.remaining_quantity != null ? Number(w.remaining_quantity) : Math.max(planned - produced, 0);
  const progressPct = Number(w.progress_pct ?? (planned ? Math.round((produced / planned) * 100) : 0));
  const priority = priorityBadge(w.priority || "medium");
  const productLabel = cleanProductLabel(w.product_name);

  useEffect(() => {
    document.body.classList.add("wo-detail-open");
    const main = document.getElementById("main-content");
    const prevOverflow = main?.style.overflow;
    if (main) main.style.overflow = "hidden";

    return () => {
      document.body.classList.remove("wo-detail-open");
      if (main) main.style.overflow = prevOverflow || "";
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setTab("overview");
  }, [workOrder?.id]);

  if (!workOrder) return null;

  const hasServerId = typeof w.id === "number" || (typeof w.id === "string" && /^\d+$/.test(w.id));

  return createPortal(
    <div
      className="wo-detail-shell"
      style={{ "--wo-shell-left": insetLeft }}
      role="presentation"
    >
      <button
        type="button"
        className="wo-detail-backdrop"
        aria-label="Close work order details"
        onClick={onClose}
      />
      <div
        className="wo-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Work order ${displayWoValue(w.work_order_number)}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <header className="wo-drawer-header">
          <div className="min-w-0 flex-1 pr-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-primary)]">
                {displayWoValue(w.work_order_number)}
              </p>
              <StatusBadge tone={woStatusTone(w)}>
                {w.is_delayed ? "Delayed" : woStatusLabel(w.status)}
              </StatusBadge>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${priority.bg} ${priority.text}`}>
                {priority.label}
              </span>
            </div>
            <h2 className="mt-1 truncate text-lg font-bold text-[var(--color-text)]" title={productLabel}>
              {productLabel}
            </h2>
            <p className="mt-0.5 truncate text-sm text-[var(--color-text-muted)]">
              {w.production_order_number ? (
                <>
                  PO{" "}
                  <Link to="/production/planning" className="font-medium text-[var(--color-primary)] hover:underline">
                    {displayWoValue(w.production_order_number)}
                  </Link>
                </>
              ) : (
                "No production order"
              )}
              {" · "}
              Qty {planned}
            </p>
            <div className="mt-3 max-w-md">
              <div className="mb-1 flex justify-between text-[11px] tabular-nums text-[var(--color-text-muted)]">
                <span>{produced} / {planned}</span>
                <span className="font-semibold text-[var(--color-text)]">{progressPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-border-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)]"
                  style={{ width: `${Math.min(progressPct, 100)}%` }}
                />
              </div>
            </div>
          </div>
          <IconButton
            variant="ghost"
            type="button"
            aria-label="Close work order details"
            title="Close"
            onClick={onClose}
            className="shrink-0"
          >
            <X className="h-5 w-5" />
          </IconButton>
        </header>

        {/* Workflow stage — compact strip */}
        <div className="wo-detail-workflow shrink-0 border-b border-[var(--color-border-soft)] bg-[var(--color-surface)]">
          <WorkflowTracker
            steps={workflowSteps}
            currentStage={{
              stage_label: currentStage?.label || "Work Order",
              stage_hint: `Current stage: ${currentStage?.label || "—"}`,
            }}
            embedded
          />
        </div>

        {/* Tabs */}
        <div className="wo-drawer-tabs shrink-0" role="tablist" aria-label="Work order sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`wo-drawer-tab${tab === t.id ? " wo-drawer-tab--active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="wo-drawer-body">
          {detailLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--color-text-muted)]">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" aria-hidden />
              <p className="text-sm">Loading work order details…</p>
            </div>
          ) : null}

          {detailError && !detailLoading ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3 py-2.5 text-sm text-[var(--color-danger)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{detailError}</span>
            </div>
          ) : null}

          {!detailLoading && tab === "overview" && (
            <div className="space-y-5">
              <ProgressSection
                produced={produced}
                planned={planned}
                remaining={remaining}
                pct={progressPct}
              />

              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">General</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailField label="Work Order No." value={w.work_order_number} />
                  <DetailField label="Production Order" value={w.production_order_number} />
                  <DetailField label="Product" value={productLabel} />
                  <DetailField label="Customer" value={w.customer_name} />
                  <DetailField label="BOM Version" value={w.bom_version} />
                  <DetailField label="Batch Number" value={w.batch_number} />
                  <DetailField label="Priority" value={w.priority} />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Production</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <DetailField label="Planned Qty" value={planned} />
                  <DetailField label="Produced Qty" value={produced} />
                  <DetailField label="Remaining Qty" value={remaining} />
                  <DetailField label="Scrap Qty" value={w.scrap_quantity} />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Machine & Operator</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailField label="Machine" value={w.machine_name} />
                  <DetailField label="Machine Status" value={w.machine_status} />
                  <DetailField label="Operator" value={w.operator_name} />
                  <DetailField label="Supervisor" value={w.supervisor} />
                  <DetailField
                    label="Shift"
                    value={typeof w.shift === "object" ? w.shift?.label || w.shift?.id : w.shift}
                  />
                  <DetailField label="Department" value={w.department} />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Timeline</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailField label="Created" value={formatWoDateTime(w.created_at)} />
                  <DetailField label="Started" value={formatWoDateTime(w.started_at)} />
                  <DetailField label="Paused" value={formatWoDateTime(w.paused_at)} />
                  <DetailField label="Completed" value={formatWoDateTime(w.completed_at)} />
                </div>
              </section>
            </div>
          )}

          {!detailLoading && tab === "materials" && (
            <div className="ui-table-wrap ui-table-wrap--scroll">
              <table className="ui-table w-full text-left text-sm">
                <thead className="ui-table-head">
                  <tr>
                    <th>Material</th>
                    <th className="text-right">Required</th>
                    <th className="text-right">Issued</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(w.materials || []).length ? (
                    w.materials.map((m) => (
                      <tr key={m.component_name} className="border-b border-[var(--color-border-soft)]">
                        <td className="py-2 font-medium text-[var(--color-text)]">{displayWoValue(m.component_name)}</td>
                        <td className="py-2 text-right tabular-nums">{displayWoValue(m.required_qty)}</td>
                        <td className="py-2 text-right tabular-nums">{displayWoValue(m.issued_qty)}</td>
                        <td className="py-2 text-right tabular-nums">{displayWoValue(m.balance_qty)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                        No materials listed for this work order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!detailLoading && tab === "machines" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailField label="Machine Name" value={w.machine_name} />
              <DetailField label="Machine Code" value={w.machine_code} />
              <DetailField label="Status" value={w.machine_status} />
              <DetailField
                label="Utilization"
                value={w.machine_utilization_pct != null ? `${w.machine_utilization_pct}%` : null}
              />
              <DetailField
                label="Efficiency"
                value={w.machine_efficiency_pct != null ? `${w.machine_efficiency_pct}%` : null}
              />
              <DetailField label="OEE" value={w.oee_pct != null ? `${w.oee_pct}%` : null} />
              <Link to="/production/machines" className="text-sm font-semibold text-[var(--color-primary)] hover:underline sm:col-span-2">
                View Machine Dashboard →
              </Link>
            </div>
          )}

          {!detailLoading && tab === "operators" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailField label="Assigned Operator" value={w.operator_name} />
              <DetailField label="Supervisor" value={w.supervisor} />
              <DetailField
                label="Shift"
                value={typeof w.shift === "object" ? w.shift?.label || w.shift?.id : w.shift}
              />
              <DetailField label="Department" value={w.department} />
              <DetailField
                label="Efficiency"
                value={w.operator_efficiency_pct != null ? `${w.operator_efficiency_pct}%` : null}
              />
            </div>
          )}

          {!detailLoading && tab === "quality" && (
            <div className="space-y-3">
              <DetailField label="Quality Status" value={w.quality_status} />
              <DetailField label="Scrap %" value={w.scrap_pct != null ? `${w.scrap_pct}%` : null} />
              <Link to="/quality/inspection" className="text-sm font-semibold text-[var(--color-primary)] hover:underline">
                Quality Inspection →
              </Link>
            </div>
          )}

          {!detailLoading && tab === "maintenance" && (
            <Link to="/maintenance/schedule" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)] hover:underline">
              <Wrench className="h-4 w-4" /> Maintenance Schedule →
            </Link>
          )}

          {!detailLoading && tab === "documents" && (
            <ul className="space-y-2">
              {(w.documents || []).length ? (
                w.documents.map((d) => (
                  <li
                    key={d.name}
                    className="flex items-center gap-3 rounded-lg border border-[var(--color-border-muted)] bg-[var(--color-surface-muted)]/40 px-4 py-3"
                  >
                    <FileText className="h-5 w-5 text-[var(--color-primary)]" aria-hidden />
                    <span className="text-sm font-medium text-[var(--color-text)]">{displayWoValue(d.name)}</span>
                  </li>
                ))
              ) : (
                <li className="py-8 text-center text-sm text-[var(--color-text-muted)]">No documents attached.</li>
              )}
            </ul>
          )}

          {!detailLoading && tab === "audit" && (
            <div className="ui-table-wrap ui-table-wrap--scroll">
              <table className="ui-table w-full text-left text-sm">
                <thead className="ui-table-head">
                  <tr>
                    <th>Action</th>
                    <th>User</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(w.audit_logs || []).length ? (
                    w.audit_logs.map((log, i) => (
                      <tr key={i} className="border-b border-[var(--color-border-soft)]">
                        <td className="py-2">{displayWoValue(log.action)}</td>
                        <td className="py-2">{displayWoValue(log.user)}</td>
                        <td className="py-2">{formatWoDateTime(log.timestamp)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                        No audit log entries.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sticky footer actions */}
        <footer className="wo-drawer-footer">
          <div className="flex flex-wrap items-center gap-2">
            {onIssueMaterials && canWoIssueMaterials(w.status, w.materials_issued) ? (
              <Button variant="secondary" type="button" disabled={issuing || detailLoading} onClick={() => onIssueMaterials(w)}>
                {issuing ? "Issuing…" : "Issue Materials"}
              </Button>
            ) : null}
            {w.materials_issued ? (
              <span className="inline-flex items-center rounded-lg bg-[var(--color-success-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-success)]">
                Materials issued
              </span>
            ) : null}
            {onStart && canWoStart(w.status) ? (
              <Button variant="primary" type="button" disabled={detailLoading} onClick={() => onStart(w)}>
                <Play className="h-3.5 w-3.5" /> Start
              </Button>
            ) : null}
            {onPause && canWoPause(w.status) ? (
              <Button variant="secondary" type="button" disabled={detailLoading} onClick={() => onPause(w)}>
                <Pause className="h-3.5 w-3.5" /> Pause
              </Button>
            ) : null}
            {onStop && canWoStop(w.status) ? (
              <Button variant="secondary" type="button" disabled={detailLoading} onClick={() => onStop(w)}>
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            ) : null}
            {onComplete && canWoComplete(w.status) ? (
              <Button variant="secondary" type="button" disabled={detailLoading} onClick={() => onComplete(w)}>
                Complete
              </Button>
            ) : null}
            {hasServerId ? (
              <Button variant="secondary" to={operatorJobCardUrl(w)} disabled={detailLoading}>
                <ClipboardList className="h-3.5 w-3.5" /> Open Job Card
              </Button>
            ) : null}
            <Button variant="ghost" type="button" disabled={detailLoading} onClick={() => printWorkOrder(w, user)}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}
