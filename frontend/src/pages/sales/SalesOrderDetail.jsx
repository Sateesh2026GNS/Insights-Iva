import { useCallback, useEffect, useState } from "react";
import usePageRefresh from "../../hooks/usePageRefresh";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ClipboardList, Factory } from "lucide-react";

import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import EmptyState from "../../components/common/EmptyState";
import { StatusBadge } from "../../components/common/Table";
import { useToast } from "../../context/ToastContext";
import Button from "../../components/common/Button";
import {
  confirmSalesOrder,
  confirmSalesOrderDelivery,
  getSalesOrderDetail,
  getSalesOrderWorkflow,
  updateSalesOrderDispatch,
} from "../../api/salesApi";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";

export default function SalesOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [workflowResult, setWorkflowResult] = useState(null);
  const [orderWorkflow, setOrderWorkflow] = useState(null);

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
            ? "Sales order linked to inventory check queue"
            : "Sales order confirmed — awaiting store inventory check",
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
          </div>
        }
      />

      {orderWorkflow?.stages?.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Role workflow stages
              {orderWorkflow.viewer_role ? (
                <span className="ml-2 font-normal text-slate-400">· {orderWorkflow.viewer_role}</span>
              ) : null}
            </h3>
            <Link to="/manufacturing/workflow" className="text-xs font-semibold text-[var(--color-success)] hover:underline">
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
        {!isConfirmed && (
          <Button variant="primary" type="button" disabled={confirming}
      onClick={handleConfirm} className="inline-flex items-center gap-2 disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" />
            {confirming ? "Confirming…" : "Confirm → MRP & Production"}
          </Button>
        )}
        {isConfirmed && (
          <>
            <Button
              variant="primary"
              to={`/sales/orders/${order.id}/job-card`}
              className="inline-flex items-center gap-2"
            >
              <ClipboardList className="h-4 w-4" />
              Open Job Card
            </Button>
            <Button variant="secondary" type="button" disabled={confirming}
      onClick={handleConfirm} className="inline-flex items-center gap-2">
              View manufacturing status
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
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-400">
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
                className="rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
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
                      <p className="font-semibold text-[#2563EB]">{po.order_number}</p>
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
              className="mt-3 inline-block text-sm font-semibold text-[#2563EB] hover:underline"
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
                      <p className="font-medium text-[#2563EB]">{po.order_number}</p>
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
