import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";

import Loader from "../../components/common/Loader";
import Button from "../../components/common/Button";
import KpiCard from "../../components/common/KpiCard";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getManufacturingWorkflowBoard } from "../../api/salesApi";
import { getMaterialCheck, getMyJobCardQueue, getSalesJobCard, getWorkflowHub } from "../../api/workflowApi";
import JobCardSummary from "../../components/manufacturing/JobCardSummary";
import JobCardQueueFilters from "../../components/manufacturing/JobCardQueueFilters";
import JobCardQueueTable, { WorkflowStageTabs } from "../../components/manufacturing/JobCardQueueTable";
import JobCardTimeline from "../../components/manufacturing/JobCardTimeline";
import MaterialSummaryPanel from "../../components/manufacturing/MaterialSummaryPanel";
import WorkflowStagePipeline from "../../components/manufacturing/WorkflowStagePipeline";
import WorkflowTracker from "../../components/manufacturing/WorkflowTracker";
import { getWorkflowStatusLabel, getRoleQueueStages } from "../../config/workflowStages";
import { getPrimaryRoleName, userHasWorkflowTeam } from "../../config/manufacturingWorkflow";
import { stageJobCardUrl } from "../../utils/workflowStageRoutes";

function orderIdOf(row) {
  return row?.sales_order_id ?? row?.id;
}

/** Drop placeholder / draft rows that are not real workflow orders. */
function isValidQueueRow(row) {
  const id = orderIdOf(row);
  if (!id) return false;
  if (row.workflow_status) return true;
  if (row.order_number && (row.customer_name || row.product_name)) return true;
  return false;
}

function priorityRank(priority) {
  const p = String(priority || "medium").toLowerCase();
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}

export default function RoleWorkflowBoard() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");
  const orderFilter = searchParams.get("order");
  const roleName = getPrimaryRoleName(user);
  const isAdmin = userHasWorkflowTeam(user, "admin");
  const isStoreManager = roleName === "Store Manager";

  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState(null);
  const [hub, setHub] = useState(null);
  const [queue, setQueue] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [previewCard, setPreviewCard] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [materialLines, setMaterialLines] = useState([]);
  const [materialLoading, setMaterialLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [localStatusFilter, setLocalStatusFilter] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");

  const [queueMeta, setQueueMeta] = useState(null);

  const roleStages = useMemo(() => getRoleQueueStages(roleName), [roleName]);

  const load = useCallback(async ({ isRefresh = false } = {}) => {
    if (!isRefresh) setLoading(true);
    try {
      const requests = [
        getManufacturingWorkflowBoard().catch(() => null),
        getMyJobCardQueue(statusFilter ? { status: statusFilter } : {}),
      ];
      if (isAdmin) requests.push(getWorkflowHub().catch(() => null));
      const results = await Promise.all(requests);
      setBoard(results[0]?.data ?? results[0]);
      const queueRes = results[1]?.data ?? results[1];
      setQueue(queueRes?.items ?? []);
      setQueueMeta(queueRes?.meta ?? null);
      if (isAdmin && results[2]) setHub(results[2]?.data ?? results[2]);
      if (isRefresh) addToast("Workflow refreshed.", "success");
    } catch (err) {
      addToast(err?.response?.data?.detail || "Could not load workflow board", "error");
      if (!isRefresh) setQueue([]);
    } finally {
      setLoading(false);
    }
  }, [addToast, statusFilter, isAdmin]);

  usePageRefresh(() => load({ isRefresh: true }));
  useEffect(() => {
    load();
  }, [load]);

  const previewOrder = useCallback(async (orderId) => {
    if (!orderId) return;
    setSelectedOrderId(orderId);
    setPreviewLoading(true);
    setMaterialLoading(true);
    setPreviewCard(null);
    setMaterialLines([]);
    try {
      const [cardRes, matRes] = await Promise.all([
        getSalesJobCard(orderId),
        getMaterialCheck(orderId).catch(() => null),
      ]);
      setPreviewCard(cardRes?.data ?? cardRes);
      const mat = matRes?.data?.material_check ?? matRes?.material_check;
      setMaterialLines(mat?.lines || []);
    } catch {
      setPreviewCard(null);
      setMaterialLines([]);
    } finally {
      setPreviewLoading(false);
      setMaterialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orderFilter) previewOrder(Number(orderFilter));
  }, [orderFilter, previewOrder]);

  const sortedQueue = useMemo(
    () =>
      [...queue]
        .filter(isValidQueueRow)
        .sort((a, b) => {
        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;
        const da = a.delivery_date ? new Date(a.delivery_date).getTime() : Infinity;
        const db = b.delivery_date ? new Date(b.delivery_date).getTime() : Infinity;
        return da - db;
      }),
    [queue]
  );

  const pendingInventoryCount = useMemo(
    () =>
      sortedQueue.filter((r) =>
        ["MATERIAL_CHECK_PENDING", "MATERIAL_SHORTAGE", "MATERIAL_PARTIAL"].includes(
          String(r.workflow_status || "").toUpperCase()
        )
      ).length,
    [sortedQueue]
  );

  const statusOptions = useMemo(() => {
    const set = new Set(sortedQueue.map((r) => r.workflow_status).filter(Boolean));
    return [...set].sort();
  }, [sortedQueue]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedQueue.filter((row) => {
      if (priorityFilter && String(row.priority || "").toLowerCase() !== priorityFilter) return false;
      if (localStatusFilter && row.workflow_status !== localStatusFilter) return false;
      if (deliveryFilter && row.delivery_date) {
        const rowDay = row.delivery_date.slice(0, 10);
        if (rowDay !== deliveryFilter) return false;
      } else if (deliveryFilter && !row.delivery_date) {
        return false;
      }
      if (stockFilter && row.material_stock_status !== stockFilter) return false;
      if (!q) return true;
      const hay = [
        row.job_card_no,
        row.order_number,
        row.customer_name,
        row.product_name,
        String(row.sales_order_id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sortedQueue, search, priorityFilter, localStatusFilter, deliveryFilter, stockFilter]);

  const pipelineCounts = useMemo(() => {
    const raw = board?.status_counts || board?.counts || hub?.counts || [];
    if (Array.isArray(raw)) return Object.fromEntries(raw.map((c) => [c.key, c.count]));
    return raw;
  }, [board, hub]);

  const alertCounts = useMemo(() => {
    const raw = hub?.raw_status_counts || {};
    return {
      highPriority: sortedQueue.filter((o) => String(o.priority || "").toLowerCase() === "high").length,
      materialShortage: Number(raw.MATERIAL_SHORTAGE || 0) + Number(raw.MATERIAL_PARTIAL || 0),
      qualityRejected: Number(raw.QUALITY_REJECTED || 0),
      inProduction: Number(raw.PRODUCTION_IN_PROGRESS || 0),
    };
  }, [hub, sortedQueue]);

  const clearFilters = () => {
    setSearch("");
    setPriorityFilter("");
    setLocalStatusFilter("");
    setDeliveryFilter("");
    setStockFilter("");
  };

  if (loading) return <Loader label="Loading job cards…" />;

  const selectedRow = filteredOrders.find((o) => orderIdOf(o) === selectedOrderId);
  const trackerStatus = previewCard?.workflow_status || selectedRow?.workflow_status;
  const trackerSteps = previewCard?.workflow_tracker || previewCard?.workflow_steps || [];
  const openStageUrl = selectedOrderId ? stageJobCardUrl(selectedOrderId, trackerStatus) : null;

  const emptyDescription =
    statusFilter === "COMPLETED"
      ? "Completed workflows will appear here after billing is finalized."
      : isStoreManager
        ? "New confirmed Sales Orders will appear here for inventory verification."
        : "Confirm a sales order to start the manufacturing workflow.";

  const queueTitle = queueMeta?.queue_title
    || (isStoreManager ? "Store Manager – Inventory Queue" : "My Job Card Queue");

  return (
    <div className="ui-page ui-stack pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="ui-page-title">{queueTitle}</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            {sortedQueue.length
              ? `${sortedQueue.length} job card${sortedQueue.length === 1 ? "" : "s"} require your action`
              : isStoreManager
                ? "Confirmed sales orders awaiting inventory verification will appear here"
                : "Job cards routed to your role will appear here automatically"}
          </p>
        </div>
        {!isAdmin && sortedQueue.length ? (
          <div className="flex flex-wrap gap-2">
            <KpiCard
              label="Pending action"
              value={sortedQueue.length}
              tone="warning"
              meta={queueMeta?.responsible_role_label || roleName}
            />
          </div>
        ) : isStoreManager ? (
          <div className="flex flex-wrap gap-2">
            <KpiCard
              label="Pending inventory checks"
              value={pendingInventoryCount}
              tone={pendingInventoryCount ? "warning" : "primary"}
              meta={`${sortedQueue.length} total in queue`}
            />
          </div>
        ) : null}
      </div>

      {isAdmin && hub?.counts?.length ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          {hub.counts.slice(0, 6).map((bucket) => (
            <Link key={bucket.key} to={bucket.path || `/manufacturing/workflow?status=${bucket.statuses?.split(",")[0]}`}>
              <KpiCard label={bucket.label} value={bucket.count ?? 0} tone="primary" meta="Live count" />
            </Link>
          ))}
        </section>
      ) : null}

      {isAdmin ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="High Priority" value={alertCounts.highPriority} tone="danger" meta="Urgent orders" />
          <KpiCard label="Material Shortages" value={alertCounts.materialShortage} tone="warning" meta="Needs procurement" />
          <KpiCard label="Quality Rejections" value={alertCounts.qualityRejected} tone="danger" meta="Rework pending" />
          <KpiCard label="In Production" value={alertCounts.inProduction} tone="info" meta="Operator active" />
        </div>
      ) : null}

      <WorkflowStagePipeline currentStatus={trackerStatus} counts={pipelineCounts} />

      <section className="ui-card space-y-3 p-4">
        <WorkflowStageTabs stages={roleStages} activeStatus={statusFilter} />
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="ui-card overflow-hidden p-0 xl:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border-soft)] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                {isStoreManager
                  ? statusFilter
                    ? getWorkflowStatusLabel(statusFilter)
                    : "Inventory job card queue"
                  : statusFilter
                    ? getWorkflowStatusLabel(statusFilter)
                    : "Your job card queue"}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                {isStoreManager
                  ? `${filteredOrders.length} order${filteredOrders.length === 1 ? "" : "s"} · Click a row to preview · Use Inventory Check to verify materials`
                  : "Click a row to preview · Open Job Card to perform stage actions"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {statusFilter ? (
                <Button variant="outline" size="sm" to="/manufacturing/workflow">
                  Clear filter
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => load({ isRefresh: true })}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          <JobCardQueueFilters
            search={search}
            onSearchChange={setSearch}
            priority={priorityFilter}
            onPriorityChange={setPriorityFilter}
            status={localStatusFilter}
            onStatusChange={setLocalStatusFilter}
            deliveryDate={deliveryFilter}
            onDeliveryDateChange={setDeliveryFilter}
            stockStatus={stockFilter}
            onStockStatusChange={setStockFilter}
            statusOptions={statusOptions}
            showStockFilter={isStoreManager}
            onClear={clearFilters}
          />

          <div className="p-2">
            <JobCardQueueTable
              rows={filteredOrders}
              selectedOrderId={selectedOrderId}
              onSelect={previewOrder}
              emptyTitle={statusFilter === "COMPLETED" ? "No completed job cards" : "No Job Cards Pending"}
              emptyDescription={emptyDescription}
              onRefresh={() => load({ isRefresh: true })}
            />
          </div>
        </section>

        <aside className="ui-stack xl:col-span-4">
          {previewLoading ? <Loader label="Loading preview…" /> : null}
          {!previewLoading && previewCard?.summary_panel ? (
            <>
              <JobCardSummary
                jobCardNo={previewCard.summary_panel.job_card_no}
                salesOrderNo={previewCard.summary_panel.sales_order_no}
                customer={previewCard.summary_panel.customer}
                product={previewCard.summary_panel.product}
                orderQuantity={previewCard.summary_panel.order_quantity}
                requiredDelivery={previewCard.summary_panel.required_delivery}
                priority={previewCard.summary_panel.priority}
                uom={previewCard.summary_panel.uom}
                workflowStatus={previewCard.summary_panel.workflow_status}
              />
              <MaterialSummaryPanel lines={materialLines} loading={materialLoading} />
              {trackerSteps.length ? (
                <WorkflowTracker steps={trackerSteps} currentStage={previewCard.workflow_current_stage} />
              ) : null}
              {previewCard.timeline?.length ? (
                <JobCardTimeline events={previewCard.timeline} />
              ) : null}
              {openStageUrl ? (
                <Button variant="primary" className="w-full" to={openStageUrl}>
                  {String(trackerStatus || "").toUpperCase() === "MATERIAL_CHECK_PENDING"
                    ? "Open Inventory Check"
                    : "Open Job Card"}
                </Button>
              ) : null}
            </>
          ) : !previewLoading ? (
            <div className="ui-card p-6 text-center text-sm text-[var(--color-text-muted)]">
              Select a job card from the queue to preview summary, materials, and timeline.
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
