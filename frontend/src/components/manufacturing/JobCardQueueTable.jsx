import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Download, Eye, Printer, Trash2 } from "lucide-react";

import Button from "../common/Button";
import RowActionMenu from "../common/RowActionMenu";
import { SerialNumberCell, SerialNumberHeader } from "../common/SerialNumberCell";
import EmptyState from "../common/EmptyState";
import { PriorityBadge, WorkflowStatusBadge, fmtDeliveryDisplay } from "./jobCardUiShared";
import { WORKFLOW_STAGES } from "../../config/workflowStages";
import { jobCardDetailsUrl } from "../../utils/jobCardRoutes";
import { stageJobCardUrl } from "../../utils/workflowStageRoutes";
import { storeQueueStatusLabel, storeStatusVariant } from "../../utils/storeJobCardQueue";
import { downloadJobCardPdf, printProductionOrder } from "../../utils/printUtils";
import useAuth from "../../hooks/useAuth";

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
    return <span className="font-semibold text-[var(--color-danger)]">-{n.toLocaleString("en-IN")}</span>;
  }
  return <span className="text-[var(--color-text-muted)]">0</span>;
}

function storeActionLabel(row) {
  const ws = String(row.workflow_status || "").toUpperCase();
  if (ws === "MATERIAL_CHECK_PENDING") return "Verify Stock";
  if (ws === "STORE_ISSUE_PENDING" || ws === "STORE_ISSUE_PARTIAL" || ws === "MATERIAL_AVAILABLE") return "Issue Materials";
  return "View";
}

function QueueRowCard({
  row,
  idx,
  isSelected,
  onSelect,
  onViewDetails,
  detailsUrl,
  linkState,
  storeMode,
  onDelete,
  canDelete = false,
  user,
  openMenu,
  setOpenMenu,
}) {
  const orderId = row.sales_order_id ?? row.id;
  const stageUrl = stageJobCardUrl(orderId, row.workflow_status);
  const workflowStatus = resolveWorkflowStatus(row);
  const high = String(row.priority || "").toLowerCase() === "high";
  const overdue = isOverdue(row.delivery_date);
  const statusLabel = storeMode ? storeQueueStatusLabel(row) : (row.status_label || row.status);

  const isCompleted = String(workflowStatus || row.status || "").toLowerCase() === "completed";

  const menuItems = [
    {
      label: "View",
      icon: <Eye className="h-4 w-4" />,
      onClick: () => {
        if (onViewDetails) onViewDetails(row);
        else onSelect?.(orderId);
      },
    },
    {
      label: "Print",
      icon: <Printer className="h-4 w-4" />,
      onClick: () => printProductionOrder(row, user),
    },
    {
      label: "Download PDF",
      icon: <Download className="h-4 w-4" />,
      onClick: () => downloadJobCardPdf(row, user),
    },
    canDelete && onDelete
      ? {
          label: "Delete",
          icon: <Trash2 className="h-4 w-4" />,
          tone: "danger",
          onClick: () => onDelete(row),
        }
      : null,
  ].filter(Boolean);

  return (
    <article
      onClick={() => (onViewDetails ? onViewDetails(row) : onSelect?.(orderId))}
      className="ui-card cursor-pointer p-4 transition-all hover:border-[var(--color-primary-soft)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-semibold text-[var(--color-primary)]">
            {row.job_card_no || row.order_number || "—"}
          </span>
          {row.job_card_no && row.order_number ? (
            <p className="text-xs text-[var(--color-text-muted)]">SO: {row.order_number}</p>
          ) : null}
        </div>
        <WorkflowStatusBadge
          status={workflowStatus}
          label={statusLabel}
          variant={storeMode ? storeStatusVariant(row) : undefined}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--color-text-secondary)]">
        <div>
          <dt className="text-[var(--color-text-muted)]">Customer</dt>
          <dd className="font-medium">{row.customer_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Product</dt>
          <dd className="font-medium">{row.product_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Qty</dt>
          <dd className="font-medium tabular-nums">{fmtQty(row.quantity, row.unit)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Delivery</dt>
          <dd className="font-medium">{fmtDeliveryDisplay(row.delivery_date)}</dd>
        </div>
      </dl>
      {storeMode && row.needed_action ? (
        <p className="mt-2 text-xs font-medium text-[var(--color-primary)]">{row.needed_action}</p>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-2">
        <PriorityBadge priority={row.priority || "medium"} showDot={false} />
        <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant={actionVariantForRow(row)}
            size="sm"
            to={stageUrl}
            state={linkState}
          >
            {storeMode ? storeActionLabel(row) : "Open Job Card"}
          </Button>
          <RowActionMenu
            rowId={`mobile-${orderId}`}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            items={menuItems}
          />
        </div>
      </div>
    </article>
  );
}

export default function JobCardQueueTable({
  rows = [],
  selectedOrderId,
  onSelect,
  onViewDetails,
  emptyTitle = "No Job Cards Assigned",
  emptyDescription = "Job cards assigned to your role will appear here.",
  emptyAction,
  onRefresh,
  snoOffset = 0,
  storeMode = false,
  onDelete,
  canDelete = false,
}) {
  const { user } = useAuth();
  const [openMenu, setOpenMenu] = useState(null);
  const location = useLocation();
  const linkState = { from: location.pathname };

  if (!rows.length) {
    return (
      <EmptyState
        icon="clipboard"
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyAction?.label || (onRefresh ? "Refresh" : undefined)}
        actionHref={emptyAction?.to}
        onAction={emptyAction?.onClick || (emptyAction?.to ? undefined : onRefresh)}
      />
    );
  }

  return (
    <>
      <div className="ui-table-wrap ui-table-wrap--scroll hidden md:block">
        <table className="ui-table min-w-full text-left text-[13px]">
          <thead className="ui-table-head">
            <tr>
              <SerialNumberHeader label="S.No" />
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Job Card / SO</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Customer</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Product</th>
              {storeMode ? <th className="whitespace-nowrap px-3 py-2 font-semibold">Code</th> : null}
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Qty</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Available</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Shortage</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Delivery Date</th>
              <th className="whitespace-nowrap px-2 py-2 font-semibold">Priority</th>
              {storeMode ? (
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Action Needed</th>
              ) : (
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Stage</th>
              )}
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Status</th>
              {storeMode ? null : (
                <>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Assigned To</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Created / Recd</th>
                </>
              )}
              <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-muted)]">
            {rows.map((row, idx) => {
              const orderId = row.sales_order_id ?? row.id;
              const detailsUrl = jobCardDetailsUrl(orderId);
              const stageUrl = stageJobCardUrl(orderId, row.workflow_status);
              const isSelected = selectedOrderId === orderId;
              const workflowStatus = resolveWorkflowStatus(row);
              const high = String(row.priority || "").toLowerCase() === "high";
              const overdue = isOverdue(row.delivery_date);
              const statusLabel = storeMode ? storeQueueStatusLabel(row) : (row.status_label || row.status);

              return (
                <tr
                  key={orderId}
                  onClick={() => (onViewDetails ? onViewDetails(row) : onSelect?.(orderId))}
                  className={`cursor-pointer transition-colors hover:bg-[var(--color-surface-hover)] ${
                    isSelected ? "bg-[var(--color-primary-soft)]/40" : ""
                  } ${high ? "border-l-4 border-l-[var(--color-danger)]" : overdue ? "border-l-4 border-l-amber-400" : ""}`}
                >
                  <SerialNumberCell rowIndex={idx} serialOffset={snoOffset} />
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-[var(--color-primary)]">
                    <div className="flex flex-col">
                      <span className="hover:underline">{row.job_card_no || row.order_number || "—"}</span>
                      {row.job_card_no && row.order_number ? (
                        <span className="text-[11px] font-normal text-[var(--color-text-muted)]">
                          SO: {row.order_number}
                        </span>
                      ) : null}
                    </div>
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
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <Button variant={actionVariantForRow(row)} size="sm" to={stageUrl} state={linkState}>
                        {storeMode ? storeActionLabel(row) : "Open Job Card"}
                      </Button>
                      <RowActionMenu
                        rowId={orderId}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        items={[
                          {
                            label: "View",
                            icon: <Eye className="h-4 w-4" />,
                            onClick: () => {
                              if (onViewDetails) onViewDetails(row);
                              else onSelect?.(orderId);
                            },
                          },
                          {
                            label: "Print",
                            icon: <Printer className="h-4 w-4" />,
                            onClick: () => printProductionOrder(row, user),
                          },
                          {
                            label: "Download PDF",
                            icon: <Download className="h-4 w-4" />,
                            onClick: () => downloadJobCardPdf(row, user),
                          },
                          canDelete && onDelete
                            ? {
                                label: "Delete",
                                icon: <Trash2 className="h-4 w-4" />,
                                tone: "danger",
                                onClick: () => onDelete(row),
                              }
                            : null,
                        ].filter(Boolean)}
                      />
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
              onViewDetails={onViewDetails}
              linkState={linkState}
              storeMode={storeMode}
              onDelete={onDelete}
              canDelete={canDelete}
              user={user}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
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
