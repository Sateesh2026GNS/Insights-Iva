import { Link, useLocation } from "react-router-dom";
import { Eye } from "lucide-react";

import Button from "../common/Button";
import { SerialNumberCell, SerialNumberHeader } from "../common/SerialNumberCell";
import EmptyState from "../common/EmptyState";
import { PriorityBadge, WorkflowStatusBadge, fmtDeliveryDisplay } from "./jobCardUiShared";
import { WORKFLOW_STAGES } from "../../config/workflowStages";
import { jobCardDetailsUrl } from "../../utils/jobCardRoutes";
import { stageJobCardUrl } from "../../utils/workflowStageRoutes";
import { storeQueueStatusLabel, storeStatusVariant } from "../../utils/storeJobCardQueue";

function isOverdue(deliveryDate) {
  if (!deliveryDate) return false;
  const d = new Date(deliveryDate.includes("T") ? deliveryDate : `${deliveryDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function resolveWorkflowStatus(row) {
  return row.workflow_status || null;
}

function actionVariantForRow(row) {
  const ws = String(row.workflow_status || "").toUpperCase();
  if (ws === "MATERIAL_SHORTAGE" || ws === "MATERIAL_PARTIAL") return "warning";
  return "view";
}

function getCurrentStageLabel(row) {
  if (row.responsible_role) return row.responsible_role;
  const ws = String(row.workflow_status || "").toUpperCase();
  const stage = WORKFLOW_STAGES.find((s) => s.filterStatuses?.includes(ws));
  if (stage?.responsibleRole) return stage.responsibleRole;
  if (stage?.label) return stage.label;
  return "—";
}

function fmtQty(value, unit) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return `${n.toLocaleString("en-IN")}${unit ? ` ${unit}` : ""}`;
}

function TruncateCell({ value, className = "" }) {
  const text = value || "—";
  return (
    <span className={`block max-w-[160px] truncate ${className}`} title={value || undefined}>
      {text}
    </span>
  );
}

function ShortageCell({ value }) {
  const n = Number(value);
  if (value == null || Number.isNaN(n)) return <span className="text-[var(--color-text-muted)]">—</span>;
  if (n > 0) {
    return <span className="font-semibold tabular-nums text-[var(--color-danger)]">{n.toLocaleString("en-IN")}</span>;
  }
  return <span className="tabular-nums text-[var(--color-success)]">0</span>;
}

function storeActionLabel(row) {
  if (row.needed_action) return row.needed_action;
  const ws = String(row.workflow_status || "").toUpperCase();
  if (ws === "MATERIAL_CHECK_PENDING") return "Inventory Check";
  if (ws === "MATERIAL_SHORTAGE") return "Record Shortage";
  if (ws === "STORE_ISSUE_PENDING" || ws === "MATERIAL_AVAILABLE") return "Issue Material";
  if (ws === "STORE_ISSUE_PARTIAL" || ws === "MATERIAL_PARTIAL") return "Continue Issue";
  return "Open Job Card";
}

function QueueRowCard({ row, idx, isSelected, onSelect, detailsUrl, linkState, storeMode }) {
  const orderId = row.sales_order_id ?? row.id;
  const workflowStatus = resolveWorkflowStatus(row);
  const high = String(row.priority || "").toLowerCase() === "high";
  const overdue = isOverdue(row.delivery_date);
  const statusLabel = storeMode ? storeQueueStatusLabel(row) : row.status_label;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(orderId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(orderId);
        }
      }}
      className={`ui-card cursor-pointer p-4 transition ${
        isSelected ? "ring-2 ring-[var(--color-primary)]/40 bg-[var(--color-primary-soft)]/30" : ""
      } ${high ? "border-l-4 border-l-[var(--color-danger)]" : overdue ? "border-l-4 border-l-amber-400" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase text-[var(--color-text-faint)]">#{idx + 1}</p>
          <p className="font-semibold text-[var(--color-primary)]">{row.job_card_no || row.order_number || "—"}</p>
          <p className="text-xs text-[var(--color-text-muted)]">SO {row.order_number || "—"}</p>
        </div>
        <WorkflowStatusBadge
          status={workflowStatus}
          label={statusLabel}
          variant={storeMode ? storeStatusVariant(row) : undefined}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-[var(--color-text-faint)]">Customer</dt>
          <dd className="truncate font-medium">{row.customer_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-faint)]">Product</dt>
          <dd className="truncate font-medium">{row.product_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-faint)]">Qty</dt>
          <dd className="font-medium tabular-nums">{fmtQty(row.quantity, row.unit)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-faint)]">Delivery</dt>
          <dd>{fmtDeliveryDisplay(row.delivery_date)}</dd>
        </div>
        {storeMode ? (
          <>
            <div>
              <dt className="text-[var(--color-text-faint)]">Available</dt>
              <dd className="font-medium tabular-nums">{fmtQty(row.available_qty, row.unit)}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-faint)]">Shortage</dt>
              <dd>
                <ShortageCell value={row.shortage_qty} />
              </dd>
            </div>
          </>
        ) : null}
      </dl>
      {storeMode && row.needed_action ? (
        <p className="mt-2 text-xs font-medium text-[var(--color-primary)]">{row.needed_action}</p>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        <PriorityBadge priority={row.priority || "medium"} showDot={false} />
        <Button
          variant={actionVariantForRow(row)}
          size="sm"
          to={detailsUrl}
          state={linkState}
          onClick={(e) => e.stopPropagation()}
        >
          {storeMode ? storeActionLabel(row) : "Open Job Card"}
        </Button>
      </div>
    </article>
  );
}

export default function JobCardQueueTable({
  rows = [],
  selectedOrderId,
  onSelect,
  emptyTitle = "No Job Cards Assigned",
  emptyDescription = "Job cards assigned to your role will appear here.",
  emptyAction,
  onRefresh,
  snoOffset = 0,
  storeMode = false,
}) {
  const location = useLocation();
  const linkState = { from: location.pathname };

  if (!rows.length) {
    return (
      <EmptyState
        icon="clipboard"
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={onRefresh ? "Refresh" : emptyAction?.label}
        actionHref={onRefresh ? undefined : emptyAction?.to}
        onAction={onRefresh || emptyAction?.onClick}
      />
    );
  }

  return (
    <>
      <div className="ui-table-wrap ui-table-wrap--scroll hidden md:block">
        <table className="ui-table min-w-full text-left text-[13px]">
          <thead className="ui-table-head">
            <tr>
              <SerialNumberHeader />
              <th className="whitespace-nowrap px-3 py-2.5">Job Card No.</th>
              <th className="whitespace-nowrap px-3 py-2.5">Sales Order No.</th>
              <th className="px-3 py-2.5">Customer</th>
              <th className="px-3 py-2.5">Product</th>
              {storeMode ? <th className="whitespace-nowrap px-3 py-2.5">Product Code</th> : null}
              <th className="whitespace-nowrap px-2 py-2.5 text-right">{storeMode ? "Order Qty" : "Quantity"}</th>
              <th className="whitespace-nowrap px-2 py-2.5 text-right">Available</th>
              <th className="whitespace-nowrap px-2 py-2.5 text-right">Shortage</th>
              <th className="whitespace-nowrap px-3 py-2.5">Req. Delivery Date</th>
              <th className="whitespace-nowrap px-2 py-2.5">Priority</th>
              {storeMode ? (
                <th className="whitespace-nowrap px-3 py-2.5">Needed Action</th>
              ) : (
                <th className="whitespace-nowrap px-3 py-2.5">Current Stage</th>
              )}
              <th className="whitespace-nowrap px-3 py-2.5">Status</th>
              {storeMode ? null : (
                <>
                  <th className="whitespace-nowrap px-3 py-2.5">Assigned To</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Created Date</th>
                </>
              )}
              <th className="whitespace-nowrap px-3 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const orderId = row.sales_order_id ?? row.id;
              const isSelected = selectedOrderId === orderId;
              const detailsUrl = jobCardDetailsUrl(orderId);
              const stageUrl = storeMode
                ? stageJobCardUrl(orderId, row.workflow_status)
                : detailsUrl;
              const workflowStatus = resolveWorkflowStatus(row);
              const high = String(row.priority || "").toLowerCase() === "high";
              const overdue = isOverdue(row.delivery_date);
              const rowClass = high
                ? "border-l-4 border-l-[var(--color-danger)]"
                : overdue
                  ? "border-l-4 border-l-amber-400"
                  : "";
              const statusLabel = storeMode ? storeQueueStatusLabel(row) : row.status_label;

              return (
                <tr
                  key={orderId}
                  onClick={() => onSelect?.(orderId)}
                  className={`cursor-pointer border-t border-[var(--color-border-soft)] transition ${rowClass} ${
                    isSelected
                      ? "bg-[var(--color-primary-soft)]/50 ring-1 ring-inset ring-[var(--color-primary)]/20"
                      : "hover:bg-[var(--color-surface-muted)]/30"
                  }`}
                >
                  <SerialNumberCell rowIndex={snoOffset + idx} />
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums">
                    <Link
                      to={detailsUrl}
                      state={linkState}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[var(--color-primary)] hover:underline"
                    >
                      {row.job_card_no || "—"}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[var(--color-text-secondary)]">
                    {row.order_number || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <TruncateCell value={row.customer_name} className="text-[var(--color-text-secondary)]" />
                  </td>
                  <td className="px-3 py-2.5">
                    <TruncateCell value={row.product_name} className="text-[var(--color-text-secondary)]" />
                  </td>
                  {storeMode ? (
                    <td className="whitespace-nowrap px-3 py-2.5 text-[var(--color-text-secondary)]">
                      {row.product_code || "—"}
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-[var(--color-text)]">
                    {fmtQty(row.quantity, row.unit)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-[var(--color-text-secondary)]">
                    {fmtQty(row.available_qty, row.unit)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">
                    <ShortageCell value={row.shortage_qty} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[var(--color-text-secondary)]">
                    {fmtDeliveryDisplay(row.delivery_date)}
                    {overdue ? (
                      <span className="ml-1 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Delayed</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5">
                    <PriorityBadge priority={row.priority || "medium"} showDot={false} />
                  </td>
                  {storeMode ? (
                    <td className="max-w-[180px] px-3 py-2.5 text-xs font-medium text-[var(--color-primary)]">
                      <TruncateCell value={row.needed_action || storeActionLabel(row)} />
                    </td>
                  ) : (
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-[var(--color-text-secondary)]">
                      {getCurrentStageLabel(row)}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <WorkflowStatusBadge
                      status={workflowStatus}
                      label={statusLabel}
                      variant={storeMode ? storeStatusVariant(row) : undefined}
                    />
                  </td>
                  {storeMode ? null : (
                    <>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[var(--color-text-secondary)]">
                        {row.assigned_to || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[var(--color-text-muted)]">
                        {fmtDeliveryDisplay(row.received_at || row.order_date)}
                      </td>
                    </>
                  )}
                  <td className="whitespace-nowrap px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center justify-end gap-1">
                      {storeMode ? (
                        <Button variant={actionVariantForRow(row)} size="sm" to={detailsUrl} state={linkState}>
                          {storeActionLabel(row)}
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            to={detailsUrl}
                            state={linkState}
                            aria-label="Open Job Card"
                            title="Open Job Card"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant={actionVariantForRow(row)} size="sm" to={stageUrl} state={linkState}>
                            Open Job Card
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-2 md:hidden">
        {rows.map((row, idx) => {
          const orderId = row.sales_order_id ?? row.id;
          return (
            <QueueRowCard
              key={orderId}
              row={row}
              idx={idx}
              isSelected={selectedOrderId === orderId}
              onSelect={onSelect}
              detailsUrl={jobCardDetailsUrl(orderId)}
              linkState={linkState}
              storeMode={storeMode}
            />
          );
        })}
      </div>
    </>
  );
}

export function WorkflowStageTabs({ stages, activeStatus, onNavigate }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Workflow stage filters">
      {stages.map((stage) => {
        const isActive = activeStatus === stage.filterStatus;
        return (
          <Link
            key={stage.id}
            to={stage.path}
            onClick={(e) => {
              if (onNavigate) {
                e.preventDefault();
                onNavigate(stage.filterStatus);
              }
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              isActive
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "border border-[var(--color-border-soft)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
            }`}
          >
            {stage.queueLabel}
          </Link>
        );
      })}
    </nav>
  );
}
