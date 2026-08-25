import { Link } from "react-router-dom";

import Button from "../common/Button";
import { SerialNumberCell, SerialNumberHeader } from "../common/SerialNumberCell";
import EmptyState from "../common/EmptyState";
import { PriorityBadge, WorkflowStatusBadge, fmtDeliveryDisplay } from "./jobCardUiShared";
import { getWorkflowStatusLabel } from "../../config/workflowStages";
import { stageJobCardUrl } from "../../utils/workflowStageRoutes";

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

function actionLabelForRow(row) {
  const ws = String(row.workflow_status || "").toUpperCase();
  if (ws === "MATERIAL_CHECK_PENDING") return "Inventory Check";
  if (ws === "MATERIAL_SHORTAGE" || ws === "MATERIAL_PARTIAL") return "Resolve Shortage";
  return "Open Job Card";
}

function TruncateCell({ value, className = "" }) {
  const text = value || "—";
  return (
    <span className={`block max-w-[140px] truncate ${className}`} title={value || undefined}>
      {text}
    </span>
  );
}

function QueueRowCard({ row, idx, isSelected, onSelect, stageUrl }) {
  const orderId = row.sales_order_id ?? row.id;
  const workflowStatus = resolveWorkflowStatus(row);
  const high = String(row.priority || "").toLowerCase() === "high";
  const overdue = isOverdue(row.delivery_date);

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
          <p className="font-semibold text-[var(--color-text)]">{row.job_card_no || row.order_number || "—"}</p>
          <p className="text-xs text-[var(--color-text-muted)]">SO {row.order_number || "—"}</p>
        </div>
        <WorkflowStatusBadge status={workflowStatus} label={row.status_label} />
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
          <dd className="font-medium tabular-nums">
            {row.quantity != null ? Number(row.quantity).toLocaleString("en-IN") : "—"} {row.unit || ""}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-faint)]">Delivery</dt>
          <dd>{fmtDeliveryDisplay(row.delivery_date)}</dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-between gap-2">
        <PriorityBadge priority={row.priority || "medium"} showDot={false} />
        <Button
          variant={actionVariantForRow(row)}
          size="sm"
          to={stageUrl}
          onClick={(e) => e.stopPropagation()}
        >
          {actionLabelForRow(row)}
        </Button>
      </div>
    </article>
  );
}

export default function JobCardQueueTable({
  rows = [],
  selectedOrderId,
  onSelect,
  emptyTitle = "No Job Cards Pending",
  emptyDescription = "New confirmed Sales Orders will appear here for inventory verification.",
  emptyAction,
  onRefresh,
}) {
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
              <th className="whitespace-nowrap px-3 py-2.5">Sales Order</th>
              <th className="px-3 py-2.5">Customer</th>
              <th className="px-3 py-2.5">Product</th>
              <th className="whitespace-nowrap px-2 py-2.5 text-right">Qty</th>
              <th className="whitespace-nowrap px-2 py-2.5">Unit</th>
              <th className="whitespace-nowrap px-3 py-2.5">Delivery</th>
              <th className="whitespace-nowrap px-2 py-2.5">Priority</th>
              <th className="whitespace-nowrap px-3 py-2.5">Sales Person</th>
              <th className="whitespace-nowrap px-3 py-2.5">Received</th>
              <th className="whitespace-nowrap px-3 py-2.5">Current Stage</th>
              <th className="whitespace-nowrap px-3 py-2.5">Status</th>
              <th className="whitespace-nowrap px-3 py-2.5">Assigned To</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const orderId = row.sales_order_id ?? row.id;
              const isSelected = selectedOrderId === orderId;
              const stageUrl = stageJobCardUrl(orderId, row.workflow_status);
              const workflowStatus = resolveWorkflowStatus(row);
              const high = String(row.priority || "").toLowerCase() === "high";
              const overdue = isOverdue(row.delivery_date);
              const rowClass = high
                ? "border-l-4 border-l-[var(--color-danger)]"
                : overdue
                  ? "border-l-4 border-l-amber-400"
                  : "";

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
                  <SerialNumberCell rowIndex={idx} />
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums text-[var(--color-text)]">
                    {row.job_card_no || "—"}
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
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-[var(--color-text)]">
                    {row.quantity != null ? Number(row.quantity).toLocaleString("en-IN") : "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-[var(--color-text-muted)]">{row.unit || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[var(--color-text-secondary)]">
                    {fmtDeliveryDisplay(row.delivery_date)}
                    {overdue ? (
                      <span className="ml-1 text-[10px] font-bold uppercase text-amber-600">Delayed</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5">
                    <PriorityBadge priority={row.priority || "medium"} showDot={false} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[var(--color-text-secondary)]">
                    {row.sales_person || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[var(--color-text-muted)]">
                    {row.received_at ? fmtDeliveryDisplay(row.received_at) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[var(--color-text-secondary)]">
                    {getWorkflowStatusLabel(workflowStatus)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <WorkflowStatusBadge status={workflowStatus} label={row.status_label} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-[var(--color-text-secondary)]">
                    {row.assigned_to || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <Button variant={actionVariantForRow(row)} size="sm" to={stageUrl} onClick={(e) => e.stopPropagation()}>
                      {actionLabelForRow(row)}
                    </Button>
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
              stageUrl={stageJobCardUrl(orderId, row.workflow_status)}
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
                : "border border-[var(--color-border-soft)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
            }`}
          >
            {stage.queueLabel}
          </Link>
        );
      })}
    </nav>
  );
}
