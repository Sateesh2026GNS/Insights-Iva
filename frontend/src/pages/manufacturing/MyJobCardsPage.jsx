import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Hourglass,
  Package,
  Plus,
  RefreshCw,
} from "lucide-react";

import Button from "../../components/common/Button";
import KpiCard from "../../components/common/KpiCard";
import PageHeader from "../../components/common/PageHeader";
import Pagination from "../../components/common/Pagination";
import SkeletonTable from "../../components/common/SkeletonTable";
import { ErrorState } from "../../components/common/states";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import JobCardQueueFilters from "../../components/manufacturing/JobCardQueueFilters";
import JobCardQueueTable from "../../components/manufacturing/JobCardQueueTable";
import JobCardQuickViewModal from "../../components/manufacturing/JobCardQuickViewModal";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getMyJobCardQueue, getWorkflowRoutingMeta } from "../../api/workflowApi";
import { deleteSalesOrder } from "../../api/salesApi";
import { isAdmin, isStoreManager, userCanAction } from "../../config/permissions";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";
import {
  matchesStoreStatusBucket,
  STORE_STATUS_FILTER_OPTIONS,
  uniqueFilterValues,
} from "../../utils/storeJobCardQueue";

const PAGE_SIZES = [10, 20, 50, 100];
const FETCH_LIMIT = 500;

const EMPTY_FILTERS = {
  search: "",
  status: "",
  stage: "",
  priority: "",
  deliveryDate: "",
  dateFrom: "",
  dateTo: "",
  stock: "",
  customer: "",
  product: "",
  salesOrderNo: "",
};

function normalizeItem(item) {
  if (!item || typeof item !== "object") return null;
  return {
    ...item,
    id: item.sales_order_id ?? item.id,
    sales_order_id: item.sales_order_id ?? item.id,
  };
}

function matchesStockFilter(row, stockStatus) {
  if (!stockStatus) return true;
  const stock = String(row.material_stock_status || "").toLowerCase();
  if (stockStatus === "pending") return stock === "pending" || stock === "";
  return stock === stockStatus;
}

function inDateRange(iso, from, to) {
  if (!from && !to) return true;
  const d = String(iso || "").slice(0, 10);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

const STORE_DEFAULT_FILTERS = { ...EMPTY_FILTERS };

const TEAM_STATUS_MAP = {
  inventory: new Set([
    "MATERIAL_CHECK_PENDING",
    "MATERIAL_SHORTAGE",
    "MATERIAL_PARTIAL",
    "MATERIAL_AVAILABLE",
    "STORE_ISSUE_PENDING",
    "STORE_ISSUE_PARTIAL",
    "PACKING_PENDING",
    "PACKING_IN_PROGRESS",
    "PACKED",
  ]),
  production: new Set([
    "READY_FOR_PRODUCTION",
    "PRODUCTION_ASSIGNED",
    "PRODUCTION_IN_PROGRESS",
    "PRODUCTION_COMPLETED",
    "PRODUCTION_REWORK",
    "QUALITY_REJECTED",
  ]),
  operator: new Set([
    "PRODUCTION_ASSIGNED",
    "PRODUCTION_IN_PROGRESS",
  ]),
  quality: new Set([
    "QUALITY_CHECK_PENDING",
    "QUALITY_ON_HOLD",
    "QUALITY_APPROVED",
    "QUALITY_REJECTED",
  ]),
  billing: new Set([
    "BILLING_PENDING",
    "BILLING_HOLD",
    "PACKED",
    "INVOICED",
  ]),
};

export default function MyJobCardsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [rows, setRows] = useState([]);
  const [queueMeta, setQueueMeta] = useState(null);
  const [searchParams] = useSearchParams();
  const deptParam = searchParams.get("dept");
  const isStoreUser = isStoreManager(user) || deptParam === "inventory";
  const initialFilters = isStoreUser ? STORE_DEFAULT_FILTERS : EMPTY_FILTERS;
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [previewRow, setPreviewRow] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canCreateSales = userCanAction(user, "sales", "create");
  const canDelete = userCanAction(user, "sales", "delete") || userCanAction(user, "production", "delete") || isAdmin(user);
  const effectiveTeam = deptParam || (isStoreManager(user) ? "inventory" : (queueMeta?.primary_team || "all"));
  const storeMode = effectiveTeam === "inventory";
  const showStockFilter = storeMode;

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const orderId = deleteTarget.sales_order_id ?? deleteTarget.id;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteSalesOrder(orderId);
      addToast("Job card / sales order deleted successfully", "success");
      setDeleteTarget(null);
      await load(true);
    } catch (err) {
      setDeleteError(apiErrorMessage(err, "Failed to delete job card."));
    } finally {
      setDeleting(false);
    }
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setLoadError("");
    try {
      const params = { limit: FETCH_LIMIT };
      const [queueRes, metaRes] = await Promise.all([
        getMyJobCardQueue(params),
        getWorkflowRoutingMeta().catch(() => ({ data: null })),
      ]);
      const body = queueRes?.data ?? queueRes;
      const items = Array.isArray(body?.items) ? body.items.map(normalizeItem).filter(Boolean) : [];
      setRows(items);
      setQueueMeta(body?.meta ?? metaRes?.data?.meta ?? metaRes?.data ?? null);
    } catch (err) {
      setRows([]);
      setLoadError(apiErrorMessage(err, "Could not load job cards."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const statusOptions = useMemo(() => {
    const fromMeta = queueMeta?.actionable_statuses;
    if (Array.isArray(fromMeta) && fromMeta.length) return fromMeta;
    return [];
  }, [queueMeta]);

  const customerOptions = useMemo(() => uniqueFilterValues(rows, "customer_name"), [rows]);
  const productOptions = useMemo(() => uniqueFilterValues(rows, "product_name"), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    const f = appliedFilters;
    const q = f.search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const haystack = [r.job_card_no, r.order_number, r.customer_name, r.product_name, r.product_code]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    if (f.priority) {
      list = list.filter((r) => String(r.priority || "").toLowerCase() === f.priority);
    }
    if (f.deliveryDate) {
      list = list.filter((r) => String(r.delivery_date || "").slice(0, 10) === f.deliveryDate);
    }
    if (showStockFilter && f.stock) {
      list = list.filter((r) => matchesStockFilter(r, f.stock));
    }
    if (effectiveTeam && effectiveTeam !== "all" && effectiveTeam !== "sales") {
      const allowed = TEAM_STATUS_MAP[effectiveTeam];
      if (allowed) {
        list = list.filter((r) => allowed.has(String(r.workflow_status || "").toUpperCase()));
      }
    }
    if (f.stage) {
      list = list.filter((r) => String(r.responsible_role || "").toLowerCase() === f.stage.toLowerCase());
    }
    if (storeMode && f.status) {
      list = list.filter((r) => matchesStoreStatusBucket(r, f.status));
    } else if (!storeMode && f.status) {
      list = list.filter((r) => String(r.workflow_status || "").toUpperCase() === f.status.toUpperCase());
    }
    if (f.customer) {
      list = list.filter((r) => String(r.customer_name || "") === f.customer);
    }
    if (f.product) {
      list = list.filter((r) => String(r.product_name || "") === f.product);
    }
    if (f.salesOrderNo.trim()) {
      const soq = f.salesOrderNo.trim().toLowerCase();
      list = list.filter((r) => String(r.order_number || "").toLowerCase().includes(soq));
    }
    if (f.dateFrom || f.dateTo) {
      list = list.filter((r) => inDateRange(r.order_date || r.received_at, f.dateFrom, f.dateTo));
    }
    return list;
  }, [rows, appliedFilters, showStockFilter, storeMode, effectiveTeam]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(from, from + pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const applyFilters = (next = draftFilters) => {
    setAppliedFilters({ ...next });
    setPage(1);
  };

  const clearFilters = () => {
    const cleared = storeMode ? STORE_DEFAULT_FILTERS : EMPTY_FILTERS;
    setDraftFilters(cleared);
    setAppliedFilters(cleared);
    setPage(1);
  };

  const setKpiFilter = (bucketKey) => {
    const next = { ...STORE_DEFAULT_FILTERS, status: bucketKey };
    setDraftFilters(next);
    applyFilters(next);
  };

  const patchAndApply = (key, value) => {
    const next = { ...draftFilters, [key]: value };
    setDraftFilters(next);
    setAppliedFilters(next);
    setPage(1);
  };

  const activeStatusFilter = appliedFilters.status || "";

  const counts = queueMeta?.counts;
  const kpis = storeMode && counts
    ? {
        total: counts.total_job_cards ?? 0,
        storePending: counts.store_pending ?? 0,
        readyToIssue: counts.ready_to_issue ?? 0,
        partiallyIssued: counts.partially_issued ?? 0,
        completed: counts.completed ?? 0,
      }
    : null;

  const eyebrow = effectiveTeam === "inventory"
    ? "Inventory · Store Manager"
    : effectiveTeam === "production"
    ? "Production · Production Manager"
    : effectiveTeam === "quality"
    ? "Quality · QA / QC Team"
    : effectiveTeam === "billing" || effectiveTeam === "accounts"
    ? "Accounting · Billing & Finance"
    : "Sales & Manufacturing";

  const queueSubtitle = effectiveTeam === "inventory"
    ? "Store Manager queue for Stage 2 (Inventory Check) & Stage 3 (Store Issue)."
    : effectiveTeam === "production"
    ? "Production planning queue for Stage 4 (Machine & Operator Allocation) & Stage 5 (Shop Floor Execution)."
    : effectiveTeam === "quality"
    ? "Quality inspection queue for Stage 6 (QA Approval & Remarks)."
    : effectiveTeam === "billing" || effectiveTeam === "accounts"
    ? "Invoicing queue for Stage 8 (GST Tax Invoice Generation)."
    : "Full Sales & Manufacturing status tracking for all orders.";

  const emptyTitle = storeMode ? "No Store Manager Job Cards" : "No Job Cards Assigned";
  const emptyDescription = storeMode
    ? "Confirmed Sales Orders will appear here when they reach the Store Manager stage."
    : "Job cards assigned to your role will appear here when sales orders enter the manufacturing workflow.";

  const patchDraft = (key, value) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="ui-page ui-stack">
      <PageHeader
        eyebrow={eyebrow}
        subtitle={queueSubtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!storeMode && canCreateSales ? (
              <Button
                variant="add"
                to="/sales/orders"
                leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
              >
                Create Job Card
              </Button>
            ) : null}
            {!storeMode ? (
              <Button
                variant="secondary"
                loading={refreshing}
                onClick={() => {
                  load(true);
                }}
                leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
              >
                Refresh
              </Button>
            ) : null}
          </div>
        }
      />

      {storeMode && !loading && !loadError && kpis ? (
        <div className="ui-kpi-strip ui-kpi-strip--5">
          <KpiCard
            label="Total Job Cards"
            value={kpis.total}
            icon={ClipboardList}
            tone="info"
            active={activeStatusFilter === ""}
            onClick={() => setKpiFilter("")}
            title="Show all store job cards"
          />
          <KpiCard
            label="Store Pending"
            value={kpis.storePending}
            icon={Hourglass}
            tone="warning"
            active={activeStatusFilter === "store_pending"}
            onClick={() => setKpiFilter("store_pending")}
            title="Filter Store Pending"
          />
          <KpiCard
            label="Ready to Issue"
            value={kpis.readyToIssue}
            icon={ArrowUpRight}
            tone="success"
            active={activeStatusFilter === "ready_to_issue"}
            onClick={() => setKpiFilter("ready_to_issue")}
            title="Filter Ready to Issue"
          />
          <KpiCard
            label="Partially Issued"
            value={kpis.partiallyIssued}
            icon={Package}
            tone="violet"
            active={activeStatusFilter === "partially_issued"}
            onClick={() => setKpiFilter("partially_issued")}
            title="Filter Partially Issued"
          />
          <KpiCard
            label="Completed"
            value={kpis.completed}
            icon={CheckCircle2}
            tone="neutral"
            title="Sent to production or later stages"
          />
        </div>
      ) : null}

      <div className="ui-card overflow-hidden">
        {storeMode ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Job Card Queue</h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {filtered.length === rows.length
                  ? `${filtered.length} job card${filtered.length === 1 ? "" : "s"}`
                  : `${filtered.length} of ${rows.length} job cards`}
                {activeStatusFilter
                  ? ` · ${STORE_STATUS_FILTER_OPTIONS.find((o) => o.value === activeStatusFilter)?.label || "Filtered"}`
                  : ""}
              </p>
            </div>
            <Button
              variant="secondary"
              loading={refreshing}
              onClick={() => load(true)}
              leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
            >
              Refresh
            </Button>
          </div>
        ) : null}
        <JobCardQueueFilters
          search={draftFilters.search}
          onSearchChange={(v) => {
            patchAndApply("search", v);
          }}
          priority={draftFilters.priority}
          onPriorityChange={(v) => (storeMode ? patchAndApply("priority", v) : patchDraft("priority", v))}
          status={draftFilters.status}
          onStatusChange={(v) => (storeMode ? patchAndApply("status", v) : patchDraft("status", v))}
          stage={draftFilters.stage}
          onStageChange={(v) => patchDraft("stage", v)}
          deliveryDate={draftFilters.deliveryDate}
          onDeliveryDateChange={(v) => (storeMode ? patchAndApply("deliveryDate", v) : patchDraft("deliveryDate", v))}
          dateFrom={draftFilters.dateFrom}
          onDateFromChange={(v) => (storeMode ? patchAndApply("dateFrom", v) : patchDraft("dateFrom", v))}
          dateTo={draftFilters.dateTo}
          onDateToChange={(v) => (storeMode ? patchAndApply("dateTo", v) : patchDraft("dateTo", v))}
          stockStatus={draftFilters.stock}
          onStockStatusChange={(v) => patchDraft("stock", v)}
          customer={draftFilters.customer}
          onCustomerChange={(v) => (storeMode ? patchAndApply("customer", v) : patchDraft("customer", v))}
          product={draftFilters.product}
          onProductChange={(v) => (storeMode ? patchAndApply("product", v) : patchDraft("product", v))}
          salesOrderNo={draftFilters.salesOrderNo}
          onSalesOrderNoChange={(v) => (storeMode ? patchAndApply("salesOrderNo", v) : patchDraft("salesOrderNo", v))}
          customerOptions={customerOptions}
          productOptions={productOptions}
          statusOptions={statusOptions}
          showStockFilter={showStockFilter}
          storeMode={storeMode}
          autoApply={storeMode}
          onClear={clearFilters}
          onApply={() => applyFilters()}
        />

        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={8} cols={storeMode ? 11 : 8} />
          </div>
        ) : loadError ? (
          <div className="p-6">
            <ErrorState title="Could not load job cards" description={loadError} onRetry={() => load()} />
          </div>
        ) : (
          <>
            <JobCardQueueTable
              rows={pageRows.map((row, idx) => ({ ...row, __sno: from + idx + 1 }))}
              selectedOrderId={selectedOrderId}
              onSelect={setSelectedOrderId}
              onViewDetails={(row) => setPreviewRow(row)}
              emptyTitle={emptyTitle}
              emptyDescription={emptyDescription}
              emptyAction={!storeMode && canCreateSales ? { label: "Create Job Card", to: "/sales/orders" } : undefined}
              onRefresh={() => load(true)}
              snoOffset={from}
              storeMode={storeMode}
              onDelete={(row) => {
                setDeleteError("");
                setDeleteTarget(row);
              }}
              canDelete={canDelete}
            />

            {filtered.length > 0 ? (
              <div className="px-4 py-3">
                <Pagination
                  page={safePage}
                  pageSize={pageSize}
                  total={filtered.length}
                  onPageChange={setPage}
                  onPageSizeChange={(n) => {
                    setPageSize(n);
                    setPage(1);
                  }}
                  pageSizes={PAGE_SIZES}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      {!storeMode && !loading && !loadError && rows.length === 0 && canCreateSales ? (
        <p className="text-center text-sm text-[var(--color-text-muted)]">
          Confirm a sales order to start the workflow, or open{" "}
          <Link to="/sales/orders" className="font-semibold text-[var(--color-primary)] hover:underline">
            Sales Orders
          </Link>
          .
        </p>
      ) : null}

      <JobCardQuickViewModal
        row={previewRow}
        open={Boolean(previewRow)}
        onClose={() => setPreviewRow(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Job Card / Sales Order?"
        message={`Are you sure you want to delete ${
          deleteTarget?.job_card_no || deleteTarget?.order_number || "this job card"
        }? This will remove the sales order and its manufacturing workflow records.`}
        error={deleteError}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
      />
    </div>
  );
}
