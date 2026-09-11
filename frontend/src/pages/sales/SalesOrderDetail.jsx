import { useCallback, useEffect, useRef, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, CheckCircle2, ClipboardList, Factory, Trash2 } from "lucide-react";

import CancelSalesOrderModal from "../../components/sales/CancelSalesOrderModal";
import DeleteSalesOrderDialog from "../../components/sales/DeleteSalesOrderDialog";
import RowActionMenu from "../../components/common/RowActionMenu";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import EmptyState from "../../components/common/EmptyState";
import { StatusBadge } from "../../components/common/Table";
import { useToast } from "../../context/ToastContext";
import Button from "../../components/common/Button";
import useAuth from "../../hooks/useAuth";
import { userCanAction } from "../../config/permissions";
import {
  isSalesOrderDeletePreBlocked,
  SALES_ORDER_DELETE_SUCCESS_MESSAGE,
  salesOrderDeleteErrorMessage,
} from "../../utils/salesOrderDelete";
import {
  cancelSalesOrder,
  confirmSalesOrder,
  confirmSalesOrderDelivery,
  deleteSalesOrder,
  getSalesOrderDetail,
  getSalesOrderWorkflow,
  updateSalesOrderDispatch,
} from "../../api/salesApi";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";
import { jobCardDetailsUrl } from "../../utils/jobCardRoutes";
import WorkflowNextStep from "../../components/manufacturing/WorkflowNextStep";
import { getSalesOrderWorkflowGuidance } from "../../utils/salesOrderWorkflowUx";
import {
  canShowCancelSalesOrderAction,
  formatCancellationType,
  isSalesOrderCancelled,
  salesOrderCancellationErrorMessage,
} from "../../utils/salesOrderCancellation";
import "../../styles/workflow-next-step.css";

export default function SalesOrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  const canDelete = userCanAction(user, "sales", "delete");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [workflowResult, setWorkflowResult] = useState(null);
  const [orderWorkflow, setOrderWorkflow] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [cancellationMeta, setCancellationMeta] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(null);
  const deleteInFlight = useRef(false);
  const cancelInFlight = useRef(false);

  const loadWorkflow = useCallback(async () => {
    try {
      const res = await getSalesOrderWorkflow(id);
      setOrderWorkflow(res?.data ?? res);
    } catch {
      setOrderWorkflow(null);
    }
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSalesOrderDetail(id);
      setData(res.data || null);
      setCancellationMeta(res.data?.cancellation || null);
      await loadWorkflow();
    } catch {
      addToast("Order not found", "error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, addToast, loadWorkflow]);

  usePageRefresh(load);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const flash = location.state?.flashMessage;
    if (flash) {
      addToast(flash, "success");
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, addToast, navigate]);

  const handleCancelConfirm = async (reason) => {
    if (!data?.order?.id || cancelInFlight.current) return;
    cancelInFlight.current = true;
    setCancelError("");
    setCancelling(true);
    try {
      const res = await cancelSalesOrder(data.order.id, {
        cancellation_reason: reason,
        cancellation_type: "customer_request",
        expected_version: data.order.version,
      });
      const body = res?.data ?? res;
      addToast(
        `Sales Order ${body.order_number || data.order.order_number} has been cancelled successfully.`,
        "success"
      );
      addToast(`Reason: ${reason}`, "info");
      setCancelOpen(false);
      await load();
    } catch (err) {
      setCancelError(salesOrderCancellationErrorMessage(err));
    } finally {
      cancelInFlight.current = false;
      setCancelling(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!data?.order?.id || deleteInFlight.current) return;

    if (
      isSalesOrderDeletePreBlocked({
        deleteError,
      })
    ) {
      return;
    }

    deleteInFlight.current = true;
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteSalesOrder(data.order.id);
      addToast(SALES_ORDER_DELETE_SUCCESS_MESSAGE, "success");
      navigate("/sales/orders");
    } catch (err) {
      const structured = err?.response?.data?.detail;
      setDeleteError(structured || salesOrderDeleteErrorMessage(err, "Failed to delete sales order."));
    } finally {
      deleteInFlight.current = false;
      setDeleting(false);
    }
  };

  if (loading) return <Loader label="Loading sales order..." />;

  if (!data?.order) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <BackLink />
        <EmptyState icon="clipboard" title="Order not found" description="This sales order does not exist." />
      </div>
    );
  }

  const { order, customer } = data;
  const lineItems = data.line_items || [];
  const productionOrders = data.production_orders || [];
  const status = (order.status || "").toLowerCase();
  const isConfirmed = ["confirmed", "approved"].includes(status);
  const isCancelled = isSalesOrderCancelled(order);
  const showCancelAction = canShowCancelSalesOrderAction(order, user, cancellationMeta);
  const workflowStarted = Boolean(order.workflow_status) && !isCancelled;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await confirmSalesOrder(order.id);
      const result = res.data;
      setWorkflowResult(result);
      notifyManufacturingSpine(MANUFACTURING_EVENTS.MRP_RUN, result);
      notifyManufacturingSpine(MANUFACTURING_EVENTS.DASHBOARD_REFRESH, result);
      if (result?.warning) {
        addToast(result.warning, "warning");
      } else if (result?.already_confirmed) {
        addToast("Order already confirmed");
      } else {
        addToast(
          result?.repaired_workflow
            ? "Sales order linked to inventory check queue. Next: Store verifies materials."
            : "Sales order confirmed. Sent to Store for material check — open Job Card to track progress.",
          "success"
        );
      }
      await load();
    } catch (err) {
      const msg = err.response?.data?.detail || "Confirm failed";
      addToast(typeof msg === "string" ? msg : "Confirm failed", "error");
    } finally {
      setConfirming(false);
    }
  };

  const flags = [
    { label: "Invoiced", value: order.invoiced },
    { label: "Packed", value: order.packed },
    { label: "Shipped", value: order.shipped },
  ];

  const workflowGuidance = getSalesOrderWorkflowGuidance(order, {
    isConfirmed,
    hasLineItems: lineItems.length > 0,
  });

  const handleGuidanceAction = () => {
    if (workflowGuidance?.actionType === "job_card") {
      navigate(jobCardDetailsUrl(order.id));
    } else if (workflowGuidance?.actionType === "dispatch") {
      navigate("/sales/dispatch");
    }
  };

  const handleRefreshWorkflow = async () => {
    setConfirming(true);
    try {
      await loadWorkflow();
      addToast("Workflow status refreshed.", "success");
    } catch {
      addToast("Could not refresh workflow status.", "error");
    } finally {
      setConfirming(false);
    }
  };

  const firstLine = lineItems.find((l) => l.product_id);
  const createProductionHref = firstLine
    ? `/production/create?sales_order_id=${order.id}&sales_order_number=${encodeURIComponent(order.order_number)}&product_id=${firstLine.product_id}&quantity=${firstLine.quantity}`
    : `/production/create?sales_order_id=${order.id}&sales_order_number=${encodeURIComponent(order.order_number)}`;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <BackLink />
      <PageHeader
        title={`Order ${order.order_number}`}
        subtitle={`Placed on ${order.order_date}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} />
            {showCancelAction || canDelete ? (
              <RowActionMenu
                rowId="sales-order-detail"
                openMenu={actionsMenuOpen}
                setOpenMenu={setActionsMenuOpen}
                items={[
                  showCancelAction
                    ? {
                        label: "Cancel Order",
                        icon: <Ban className="h-4 w-4" aria-hidden />,
                        onClick: () => {
                          setCancelError("");
                          setCancelOpen(true);
                        },
                      }
                    : null,
                  canDelete
                    ? {
                        label: "Delete Sales Order",
                        icon: <Trash2 className="h-4 w-4" aria-hidden />,
                        onClick: () => {
                          setDeleteError("");
                          setDeleteOpen(true);
                        },
                      }
                    : null,
                ]}
              />
            ) : null}
          </div>
        }
      />

      {isCancelled ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-100">
          <p className="font-semibold">Order Cancelled</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-rose-700/80">Cancellation Type</dt>
              <dd>{formatCancellationType(order.cancellation_type)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-rose-700/80">Cancelled By</dt>
              <dd>{order.cancelled_by_name || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-rose-700/80">Customer Cancellation Reason</dt>
              <dd>{order.cancellation_reason || "—"}</dd>
            </div>
            {order.cancelled_at ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-rose-700/80">Cancelled At</dt>
                <dd>{String(order.cancelled_at).replace("T", " ").slice(0, 16)}</dd>
              </div>
            ) : null}
          </dl>
          {cancellationMeta?.material_return_required ? (
            <p className="mt-3 text-xs text-rose-800">
              Material was already issued for this order. Use the existing Stock Return workflow to process returned material.
            </p>
          ) : null}
        </div>
      ) : null}

      {workflowGuidance ? (
        <WorkflowNextStep
          {...workflowGuidance}
          onAction={workflowGuidance.actionType ? handleGuidanceAction : undefined}
        />
      ) : null}

      {orderWorkflow?.stages?.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Role workflow stages
              {orderWorkflow.viewer_role ? (
                <span className="ml-2 font-normal text-slate-400">· {orderWorkflow.viewer_role}</span>
              ) : null}
            </h3>
            <Link to="/production/work-orders" className="text-xs font-semibold text-[var(--color-success)] hover:underline">
              Open board →
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {orderWorkflow.stages.map((s) => (
              <div
                key={s.id}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  s.status === "completed"
                    ? "border-emerald-200 bg-emerald-50"
                    : s.status === "current"
                      ? "border-amber-300 bg-amber-50"
                      : s.status === "blocked"
                        ? "border-slate-200 bg-slate-50 text-slate-400"
                        : "border-slate-200 bg-white"
                }`}
              >
                <p className="font-semibold text-slate-800 dark:text-slate-100">{s.label}</p>
                <p className="mt-0.5 capitalize text-slate-500">
                  {s.status}
                  {s.responsible_role ? ` · ${s.responsible_role}` : ""}
                </p>
                {s.assigned_user ? <p className="text-slate-500">Assigned: {s.assigned_user}</p> : null}
                {s.approval_status ? <p className="text-slate-500">Approval: {s.approval_status}</p> : null}
                {(s.pending_actions || []).length ? (
                  <p className="mt-1 text-amber-800">{s.pending_actions[0]}</p>
                ) : null}
                {s.block_reason ? <p className="mt-1 text-rose-600">{s.block_reason}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!isConfirmed && !isCancelled && (
          <Button variant="primary" type="button" disabled={confirming}
      onClick={handleConfirm} className="inline-flex items-center gap-2 disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" />
            {confirming ? "Confirming Sales Order…" : "Confirm Sales Order"}
          </Button>
        )}
        {isConfirmed && !isCancelled && (
          <>
            <Button
              variant="primary"
              to={jobCardDetailsUrl(order.id)}
              className="inline-flex items-center gap-2"
            >
              <ClipboardList className="h-4 w-4" />
              Open Job Card
            </Button>
            <Button
              variant="secondary"
              type="button"
              disabled={confirming}
              onClick={handleRefreshWorkflow}
              className="inline-flex items-center gap-2"
            >
              {confirming ? "Refreshing…" : "Refresh Workflow Status"}
            </Button>
          </>
        )}
        <Button variant="secondary" to={createProductionHref} className="inline-flex items-center gap-2">
          <Factory className="h-4 w-4" /> Create Production Order
        </Button>
        <Button variant="secondary" to="/production/planning">
          Production Planning
        </Button>
      </div>

      {!lineItems.length && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          This sales order has no product lines. Add lines when creating the order so Confirm can run MRP and create production orders.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Order Summary</h3>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Order Number" value={order.order_number} />
            <Field label="Reference" value={order.reference_number || "—"} />
            <Field label="Sales Person" value={order.sales_person || "—"} />
            <Field label="Order Date" value={order.order_date} />
            <Field label="Status" value={order.status} />
            <Field
              label="Total Amount"
              value={`₹${Number(order.total_amount || 0).toLocaleString()}`}
            />
          </dl>

          <h3 className="mb-3 mt-6 text-sm font-semibold text-slate-700 dark:text-slate-200">Line Items</h3>
          {lineItems.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="ui-table-head">
                  <tr>
                    <th className="py-2">Product</th>
                    <th className="py-2">Qty</th>
                    <th className="py-2">Unit</th>
                    <th className="py-2">Price</th>
                    <th className="py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((line) => (
                    <tr key={line.id} className="border-b border-slate-50 dark:border-slate-700">
                      <td className="py-2 font-medium">
                        {line.item_description}
                        {line.product_id ? (
                          <span className="ml-2 text-xs text-slate-400">#{line.product_id}</span>
                        ) : null}
                      </td>
                      <td className="py-2">{line.quantity}</td>
                      <td className="py-2">{line.unit}</td>
                      <td className="py-2">₹{Number(line.unit_price || 0).toLocaleString()}</td>
                      <td className="py-2 font-semibold">₹{Number(line.line_total || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No line items.</p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {flags.map((f) => (
              <span
                key={f.label}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  f.value
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                }`}
              >
                {f.value ? "✓" : "○"} {f.label}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {!order.packed && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await updateSalesOrderDispatch(order.id, { packed: true });
                    notifyManufacturingSpine(MANUFACTURING_EVENTS.ORDER_PACKED, {
                      sales_order_id: order.id,
                    });
                    addToast("Order marked as packed — delivery challan created");
                    load();
                  } catch (err) {
                    addToast(err.response?.data?.detail || "Update failed", "error");
                  }
                }}
                className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-medium text-[var(--color-success)] hover:bg-[var(--color-success-soft)]"
              >
                Mark packed
              </button>
            )}
            {order.packed && !order.shipped && (
              <Link
                to="/sales/dispatch"
                className="rounded-lg border border-amber-200 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50"
              >
                Go to dispatch
              </Link>
            )}
            {order.shipped && (order.status || "").toLowerCase() !== "delivered" && (order.status || "").toLowerCase() !== "closed" && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await confirmSalesOrderDelivery(order.id);
                    addToast("Delivery confirmed");
                    load();
                  } catch (err) {
                    addToast(err.response?.data?.detail || "Delivery confirm failed", "error");
                  }
                }}
                className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50"
              >
                Confirm delivery
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Customer</h3>
            {customer ? (
              <dl className="space-y-3 text-sm">
                <Field label="Name" value={customer.name} />
                <Field label="Email" value={customer.email || "—"} />
                <Field label="Phone" value={customer.phone || "—"} />
              </dl>
            ) : (
              <p className="text-sm text-slate-500">No customer linked.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Production Orders
            </h3>
            {productionOrders.length ? (
              <ul className="space-y-2 text-sm">
                {productionOrders.map((po) => (
                  <li key={po.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/40">
                    <div>
                      <p className="font-semibold text-[var(--color-primary)]">{po.order_number}</p>
                      <p className="text-xs text-slate-500">
                        Qty {po.planned_quantity} · {po.status}
                      </p>
                    </div>
                    <Link
                      to={`/production/work-orders?production_order_id=${po.id}`}
                      className="text-xs font-semibold text-[var(--color-success)] hover:underline"
                    >
                      Work Orders →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                No production orders yet. Confirm this SO or create production manually.
              </p>
            )}
            <Link
              to="/production/planning"
              className="mt-3 inline-block text-sm font-semibold text-[var(--color-primary)] hover:underline"
            >
              Open Production Planning →
            </Link>
          </div>
        </div>
      </div>

      {workflowResult && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Manufacturing handoff result
          </h3>
          {workflowResult.warning && (
            <p className="mb-3 text-sm text-amber-700">{workflowResult.warning}</p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">MRP</p>
              {(workflowResult.mrp_results || []).length ? (
                <ul className="space-y-2 text-sm">
                  {workflowResult.mrp_results.map((m, i) => (
                    <li key={i} className="rounded-lg border px-3 py-2">
                      <p className="font-medium">{m.product_name}</p>
                      <p className="text-xs text-slate-500">
                        Action: {m.action} · Shortages: {m.shortage_count}
                        {m.material_request_number ? ` · ${m.material_request_number}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No MRP run (no product lines or already confirmed).</p>
              )}
              <Link to="/procurement/material-requests" className="mt-2 inline-block text-xs font-semibold text-[var(--color-success)] hover:underline">
                Purchase Requests →
              </Link>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Production created</p>
              {(workflowResult.production_orders || []).length ? (
                <ul className="space-y-2 text-sm">
                  {workflowResult.production_orders.map((po) => (
                    <li key={po.id || po.order_number} className="rounded-lg border px-3 py-2">
                      <p className="font-medium text-[var(--color-primary)]">{po.order_number}</p>
                      <p className="text-xs text-slate-500">
                        {po.product || `Product #${po.product_id}`} · Qty {po.quantity}
                        {po.work_order_number ? ` · WO ${po.work_order_number}` : ""}
                        {po.enough_stock === false ? " · Buy materials first" : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No production orders created.</p>
              )}
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/production/planning")}
                  className="text-xs font-semibold text-[var(--color-success)] hover:underline"
                >
                  Production Planning →
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/production/work-orders")}
                  className="text-xs font-semibold text-[var(--color-success)] hover:underline"
                >
                  Work Orders →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <CancelSalesOrderModal
        open={cancelOpen}
        orderNumber={order.order_number}
        customerName={customer?.name}
        workflowStarted={workflowStarted}
        loading={cancelling}
        error={cancelError}
        onConfirm={handleCancelConfirm}
        onClose={() => {
          if (!cancelling) {
            setCancelOpen(false);
            setCancelError("");
          }
        }}
      />
      <DeleteSalesOrderDialog
        open={deleteOpen}
        orderNumber={order.order_number}
        deleteError={deleteError}
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => {
          if (!deleting) {
            setDeleteOpen(false);
            setDeleteError("");
          }
        }}
      />
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/sales/orders"
      className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-[var(--color-success)] dark:text-teal-400"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to sales orders
    </Link>
  );
}
