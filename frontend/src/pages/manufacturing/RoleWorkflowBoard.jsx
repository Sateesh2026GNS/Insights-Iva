import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronRight, Circle, Lock } from "lucide-react";

import Loader from "../../components/common/Loader";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getManufacturingWorkflowBoard, getSalesOrderWorkflow } from "../../api/salesApi";
import { getSalesJobCard, getWorkflowQueue } from "../../api/workflowApi";
import JobCardSummary from "../../components/manufacturing/JobCardSummary";
import WorkflowStagePipeline from "../../components/manufacturing/WorkflowStagePipeline";
import TeamWorkflowJobCards from "./TeamWorkflowJobCards";
import WorkflowOrderActions from "./WorkflowOrderActions";
import {
  DEFAULT_RESPONSIBILITY_STAGES,
  getPrimaryRoleName,
  getResponsibilityAccent,
  getResponsibilityIcon,
} from "../../config/manufacturingWorkflow";

const STATUS_STYLES = {
  completed: "border-emerald-200 bg-emerald-50 text-emerald-900",
  current: "border-amber-300 bg-amber-50 text-amber-950 ring-1 ring-amber-200",
  pending: "border-slate-200 bg-white text-slate-700",
  blocked: "border-slate-200 bg-slate-50 text-slate-400",
};

function orderIdOf(row) {
  return row?.sales_order_id ?? row?.id;
}

export default function RoleWorkflowBoard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");
  const orderFilter = searchParams.get("order");
  const roleName = getPrimaryRoleName(user);
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState(null);
  const [queue, setQueue] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [jobCard, setJobCard] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async ({ isRefresh = false } = {}) => {
    if (!isRefresh) setLoading(true);
    try {
      const [boardRes, queueRes] = await Promise.all([
        getManufacturingWorkflowBoard(),
        getWorkflowQueue(statusFilter ? { status: statusFilter } : {}),
      ]);
      setBoard(boardRes?.data ?? boardRes);
      setQueue(queueRes?.data?.items ?? queueRes?.items ?? []);
      if (isRefresh) addToast("Workflow board updated.", "success");
    } catch (err) {
      addToast(err?.response?.data?.detail || "Could not load workflow board", "error");
      if (!isRefresh) {
        setBoard(null);
        setQueue([]);
      }
    } finally {
      setLoading(false);
    }
  }, [addToast, statusFilter]);

  usePageRefresh(() => load({ isRefresh: true }));

  useEffect(() => {
    load();
  }, [load]);

  const openOrder = useCallback(async (orderId) => {
    if (!orderId) return;
    setSelectedOrderId(orderId);
    setDetailLoading(true);
    setJobCard(null);
    try {
      const [wfRes, jcRes] = await Promise.all([
        getSalesOrderWorkflow(orderId),
        getSalesJobCard(orderId).catch(() => null),
      ]);
      setDetail(wfRes?.data ?? wfRes);
      const jc = jcRes?.data ?? jcRes;
      if (jc) setJobCard(jc);
    } catch (err) {
      addToast(err?.response?.data?.detail || "Could not load order workflow", "error");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (orderFilter) {
      openOrder(Number(orderFilter));
    }
  }, [orderFilter, openOrder]);

  const orders = useMemo(() => {
    if (queue.length) return queue;
    return (board?.orders || []).map((o) => ({
      ...o,
      sales_order_id: orderIdOf(o),
    }));
  }, [queue, board]);

  useEffect(() => {
    if (orderFilter) return;
    if (!orders.length || selectedOrderId) return;
    const firstId = orderIdOf(orders[0]);
    if (firstId) openOrder(firstId);
  }, [orders, orderFilter, selectedOrderId, openOrder]);

  const roleStages = useMemo(() => {
    const apiStages = board?.role_stages;
    if (Array.isArray(apiStages) && apiStages.length) return apiStages;
    return DEFAULT_RESPONSIBILITY_STAGES;
  }, [board]);

  const currentStageId = useMemo(() => {
    if (detail?.current_stage_id) return detail.current_stage_id;
    const pending = board?.orders?.find((o) => o.my_pending_stages?.length)?.my_pending_stages?.[0];
    return pending?.id || board?.orders?.[0]?.current_stage_id || "quotation";
  }, [board, detail]);

  const handleSelectTeam = (card) => {
    setActiveTeam(card.team);
    if (card.filterStatus) {
      navigate(`/manufacturing/workflow?status=${card.filterStatus}`);
    }
  };

  if (loading) return <Loader label="Loading role workflow..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Manufacturing Workflow</h1>
          <p className="text-sm text-slate-500">
            Sales → Inventory → Production → Operator → Quality → Packing → Billing
          </p>
        </div>
        {statusFilter ? (
          <Link to="/manufacturing/workflow" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
            Clear filter · show all
          </Link>
        ) : null}
      </div>

      <TeamWorkflowJobCards
        queue={orders}
        user={user}
        activeTeam={activeTeam}
        onSelectTeam={handleSelectTeam}
      />

      <WorkflowStagePipeline currentStatus={jobCard?.workflow_status} />

      {selectedOrderId && !detailLoading && jobCard?.summary_panel ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <JobCardSummary
            jobCardNo={jobCard.summary_panel.job_card_no}
            salesOrderNo={jobCard.summary_panel.sales_order_no}
            customer={jobCard.summary_panel.customer}
            product={jobCard.summary_panel.product}
            orderQuantity={jobCard.summary_panel.order_quantity}
            requiredDelivery={jobCard.summary_panel.required_delivery}
            priority={jobCard.summary_panel.priority}
            uom={jobCard.summary_panel.uom}
            workflowStatus={jobCard.summary_panel.workflow_status}
          />
          <div className="flex flex-col justify-center gap-2 lg:col-span-2">
            <p className="text-sm text-slate-600">
              Stage:{" "}
              <span className="font-semibold text-[var(--color-primary)]">
                {jobCard.workflow_stage || "—"}
              </span>
            </p>
            <Link
              to={`/manufacturing/job-card/${selectedOrderId}`}
              className="inline-flex w-fit items-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
            >
              Open full job card →
            </Link>
          </div>
        </div>
      ) : null}

      <section className="ui-card p-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
          Active job card · team actions
        </h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          {selectedOrderId
            ? "Complete the action for your team, then the order moves to the next stage."
            : "Select an order from the queue below to open its job card."}
        </p>
        {selectedOrderId ? (
          <div className="mt-3">
            {detailLoading ? (
              <Loader label="Loading job card..." />
            ) : (
              <WorkflowOrderActions
                orderId={selectedOrderId}
                onSuccess={() => {
                  load({ isRefresh: true });
                  openOrder(selectedOrderId);
                }}
              />
            )}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No order selected. Pick one from the queue below or create a new sales order.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          {statusFilter ? `Queue · ${statusFilter.replace(/_/g, " ")}` : "Workflow queue"}
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Signed in as <span className="font-semibold text-slate-600">{roleName || "—"}</span>
          {board?.full_access ? " · Full chain (Management)" : " · Your team orders only"}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Workflow status</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    <p>No orders in your workflow queue.</p>
                    <p className="mt-2 text-xs">
                      Create a sales order, confirm it, or run{" "}
                      <strong>Backfill legacy orders</strong> on the Admin Dashboard.
                    </p>
                    <Link
                      to="/sales/orders"
                      className="mt-3 inline-block text-sm font-semibold text-[var(--color-primary)] hover:underline"
                    >
                      Go to Sales Orders →
                    </Link>
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const oid = orderIdOf(o);
                  const isSelected = selectedOrderId === oid;
                  return (
                    <tr
                      key={oid}
                      className={`border-b border-slate-100 ${isSelected ? "bg-sky-50/60" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium text-[#0f6d84]">{o.order_number}</td>
                      <td className="px-3 py-2 text-slate-600">{o.customer_name || "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{o.product_name || "—"}</td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-700">
                          {o.workflow_status || o.status || "draft"}
                        </span>
                      </td>
                      <td className="px-3 py-2 capitalize">{o.priority || "medium"}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openOrder(oid)}
                          className={`text-xs font-semibold hover:underline ${
                            isSelected ? "text-[var(--color-primary)]" : "text-[var(--color-success)]"
                          }`}
                        >
                          {isSelected ? "Selected" : "Open job card"}
                        </button>
                        <Link
                          to={`/manufacturing/job-card/${oid}`}
                          className="ml-2 text-xs font-medium text-slate-500 hover:text-[var(--color-primary)]"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <span className="h-5 w-1 rounded-full bg-slate-300" aria-hidden />
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            {t("roleWorkflowPage.section", "Full process map")}
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {roleStages.slice(0, 6).map((stage, index) => {
            const accent = getResponsibilityAccent(index);
            const Icon = getResponsibilityIcon(stage.id);
            return (
              <Link
                key={stage.id}
                to={stage.path || "/"}
                className={`group rounded-2xl border bg-white px-5 py-4 shadow-sm transition border-slate-100 ${accent.hover}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${accent.iconWrap}`}>
                    <Icon className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{stage.label}</p>
                    <p className={`text-xs font-medium ${accent.role}`}>{stage.responsible_role}</p>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {selectedOrderId && detail && !detailLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Stage timeline · {detail?.order_number || `#${selectedOrderId}`}
          </h2>
          <div className="space-y-2">
            {(detail?.stages || []).slice(0, 12).map((s) => (
              <div
                key={s.id}
                className={`rounded-lg border px-3 py-2 text-sm ${STATUS_STYLES[s.status] || STATUS_STYLES.pending}`}
              >
                <span className="font-medium">{s.label}</span>
                <span className="ml-2 text-xs capitalize opacity-75">{s.status}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
