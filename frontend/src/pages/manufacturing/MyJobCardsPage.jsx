import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";

import Button from "../../components/common/Button";
import Pagination from "../../components/common/Pagination";
import SkeletonTable from "../../components/common/SkeletonTable";
import { ErrorState } from "../../components/common/states";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import JobCardQueueFilters from "../../components/manufacturing/JobCardQueueFilters";
import JobCardQueueTable from "../../components/manufacturing/JobCardQueueTable";
import { matchesErpListStatusFilter } from "../../utils/jobCardListStatus";
import JobCardQuickViewModal from "../../components/manufacturing/JobCardQuickViewModal";
import MyJobCardEntryForm from "../../components/manufacturing/MyJobCardEntryForm";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getMyJobCardQueue, getWorkflowRoutingMeta } from "../../api/workflowApi";
import { deleteSalesOrder } from "../../api/salesApi";
import { isAdmin, isStoreManager, userCanAction } from "../../config/permissions";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";
import { salesOrderDeleteErrorMessage } from "../../utils/salesOrderDelete";
import {
  uniqueFilterValues,
} from "../../utils/storeJobCardQueue";
import "../../styles/my-job-cards-page.css";

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
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [previewRow, setPreviewRow] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const deleteInFlight = useRef(false);
  const entryFormRef = useRef(null);

  const canCreate = userCanAction(user, "sales", "create") || isAdmin(user);
  const canUpdate = userCanAction(user, "sales", "update") || canCreate;
  const canDelete = userCanAction(user, "sales", "delete") || userCanAction(user, "production", "delete") || isAdmin(user);
  const effectiveTeam = deptParam || (isStoreManager(user) ? "inventory" : (queueMeta?.primary_team || "all"));
  const storeMode = effectiveTeam === "inventory";
  const showStockFilter = storeMode;

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteInFlight.current) return;
    const orderId = deleteTarget.sales_order_id ?? deleteTarget.id;
    if (!orderId) {
      setDeleteError("Missing sales order reference for this job card.");
      return;
    }
    deleteInFlight.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteSalesOrder(orderId);
      addToast("Job card / sales order deleted successfully", "success");
      setDeleteTarget(null);
      await load(true);
    } catch (err) {
      const message = salesOrderDeleteErrorMessage(err, "Failed to delete job card.");
      setDeleteError(message);
      addToast(message, "error");
    } finally {
      deleteInFlight.current = false;
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
  const salesOrderOptions = useMemo(() => uniqueFilterValues(rows, "order_number"), [rows]);

  const existingOrderIdsWithCards = useMemo(
    () =>
      rows
        .filter((r) => r.job_card_no || r.job_card_id)
        .map((r) => r.sales_order_id ?? r.id)
        .filter(Boolean),
    [rows]
  );

  const handleEditRow = (row) => {
    const orderId = row.sales_order_id ?? row.id;
    if (!orderId) return;
    setEditingOrderId(orderId);
    window.requestAnimationFrame(() => {
      entryFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleEntrySaved = async () => {
    setEditingOrderId(null);
    await load(true);
  };

  const filtered = useMemo(() => {
    let list = rows;
    const f = appliedFilters;
    const jc = f.search.trim().toLowerCase();
    if (jc) {
      list = list.filter((r) => String(r.job_card_no || "").toLowerCase().includes(jc));
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
    if (f.status) {
      list = list.filter((r) => matchesErpListStatusFilter(r, f.status));
    }
    if (f.customer) {
      list = list.filter((r) => String(r.customer_name || "") === f.customer);
    }
    if (f.product) {
      list = list.filter((r) => String(r.product_name || "") === f.product);
    }
    if (f.salesOrderNo.trim()) {
      list = list.filter((r) => String(r.order_number || "") === f.salesOrderNo);
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
    const cleared = { ...EMPTY_FILTERS };
    setDraftFilters(cleared);
    setAppliedFilters(cleared);
    setPage(1);
  };

  const patchDraft = (key, value) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const emptyTitle = storeMode ? "No Store Manager Job Cards" : "No Job Cards Assigned";
  const emptyDescription = storeMode
    ? "Confirmed sales orders appear here when they reach the Store Manager stage."
    : "Job cards appear here when sales orders enter the manufacturing workflow.";

  return (
    <div className="ui-page ui-stack my-job-cards-page">
      {(canCreate || canUpdate) ? (
        <div ref={entryFormRef} className="ui-card my-job-cards-page__section">
          <h2 className="ui-section-title">Job Card Details</h2>
          <MyJobCardEntryForm
            editingOrderId={editingOrderId}
            existingOrderIdsWithCards={existingOrderIdsWithCards}
            onSaved={handleEntrySaved}
            onCancelEdit={() => setEditingOrderId(null)}
            canCreate={canCreate}
            canUpdate={canUpdate}
          />
        </div>
      ) : null}

      <div className="ui-card my-job-cards-page__section">
        <h2 className="ui-section-title">Search &amp; Filters</h2>
        <JobCardQueueFilters
          search={draftFilters.search}
          onSearchChange={(v) => patchDraft("search", v)}
          priority={draftFilters.priority}
          onPriorityChange={(v) => patchDraft("priority", v)}
          status={draftFilters.status}
          onStatusChange={(v) => patchDraft("status", v)}
          stage={draftFilters.stage}
          onStageChange={(v) => patchDraft("stage", v)}
          deliveryDate={draftFilters.deliveryDate}
          onDeliveryDateChange={(v) => patchDraft("deliveryDate", v)}
          dateFrom={draftFilters.dateFrom}
          onDateFromChange={(v) => patchDraft("dateFrom", v)}
          dateTo={draftFilters.dateTo}
          onDateToChange={(v) => patchDraft("dateTo", v)}
          stockStatus={draftFilters.stock}
          onStockStatusChange={(v) => patchDraft("stock", v)}
          customer={draftFilters.customer}
          onCustomerChange={(v) => patchDraft("customer", v)}
          product={draftFilters.product}
          onProductChange={(v) => patchDraft("product", v)}
          salesOrderNo={draftFilters.salesOrderNo}
          onSalesOrderNoChange={(v) => patchDraft("salesOrderNo", v)}
          customerOptions={customerOptions}
          productOptions={productOptions}
          salesOrderOptions={salesOrderOptions}
          statusOptions={statusOptions}
          showStockFilter={showStockFilter}
          storeMode={storeMode}
          erpLayout
          onClear={clearFilters}
          onApply={() => applyFilters()}
        />
      </div>

      <div className="ui-card my-job-cards-page__section">
        <div className="erp-section-header erp-section-header--row">
          <h2 className="erp-section-header__title">My Job Cards</h2>
          <div className="my-job-cards-page__section-actions">
            <span className="my-job-cards-page__section-total">Total: {filtered.length}</span>
            <Button
              variant="outline"
              size="sm"
              loading={refreshing}
              onClick={() => load(true)}
              className="my-job-cards-page__refresh-btn"
              leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={8} cols={11} />
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
              onRefresh={() => load(true)}
              snoOffset={from}
              storeMode={storeMode}
              erpLayout
              onDelete={(row) => {
                setDeleteError("");
                setDeleteTarget(row);
              }}
              onEdit={canUpdate ? handleEditRow : undefined}
              canEdit={canUpdate}
              canDelete={canDelete}
            />

            {filtered.length > 0 ? (
              <div className="my-job-cards-page__pagination">
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
                  summaryMode="entries"
                  showPageSize={false}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      <JobCardQuickViewModal
        row={previewRow}
        open={Boolean(previewRow)}
        onClose={() => setPreviewRow(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete"
        message={`Are you sure you want to delete ${
          deleteTarget?.job_card_no || deleteTarget?.order_number || "this job card"
        }?`}
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
