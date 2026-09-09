import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ClipboardList, Plus, RefreshCw, SlidersHorizontal } from "lucide-react";

import Button from "../../components/common/Button";
import Pagination from "../../components/common/Pagination";
import { AsyncPageBody, PartialDataState } from "../../components/common/states";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import JobCardQueueFilters from "../../components/manufacturing/JobCardQueueFilters";
import JobCardQueueTable from "../../components/manufacturing/JobCardQueueTable";
import { matchesErpListStatusFilter } from "../../utils/jobCardListStatus";
import AccountantJobCardDocumentPanel from "../../components/manufacturing/AccountantJobCardDocumentPanel";
import OperatorJobCardDocumentPanel from "../../components/manufacturing/OperatorJobCardDocumentPanel";
import QualityControlJobCardDocumentPanel from "../../components/manufacturing/QualityControlJobCardDocumentPanel";
import SalesJobCardDocumentPanel from "../../components/manufacturing/SalesJobCardDocumentPanel";
import StoreManagerJobCardDocumentPanel from "../../components/manufacturing/StoreManagerJobCardDocumentPanel";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import { deleteManualJobCard, getMyJobCardQueue, getWorkflowRoutingMeta } from "../../api/workflowApi";
import { deleteSalesOrder } from "../../api/salesApi";
import {
  isAccountant,
  isAdmin,
  isOperator,
  isQualityTeam,
  isStoreManager,
  userCanAction,
  userCanCreateSalesJobCard,
} from "../../config/permissions";
import { useToast } from "../../context/ToastContext";
import { classifyApiError } from "../../utils/apiError";
import { salesOrderDeleteErrorMessage } from "../../utils/salesOrderDelete";
import { uniqueFilterValues } from "../../utils/storeJobCardQueue";
import {
  jobCardCreateUrl,
  jobCardEditUrl,
  jobCardManualEditUrl,
  myJobCardsManualViewUrl,
  myJobCardsViewUrl,
} from "../../utils/jobCardRoutes";
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
  const isManual = Boolean(item.is_manual || (!item.sales_order_id && item.job_card_id));
  return {
    ...item,
    is_manual: isManual,
    id: isManual ? item.job_card_id : item.sales_order_id ?? item.id,
    sales_order_id: item.sales_order_id ?? null,
    job_card_id: item.job_card_id ?? null,
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
  operator: new Set(["PRODUCTION_ASSIGNED", "PRODUCTION_IN_PROGRESS"]),
  quality: new Set([
    "QUALITY_CHECK_PENDING",
    "QUALITY_ON_HOLD",
    "QUALITY_APPROVED",
    "QUALITY_REJECTED",
  ]),
  billing: new Set(["BILLING_PENDING", "BILLING_HOLD", "PACKED", "INVOICED"]),
};

export default function MyJobCardsPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { orderId: legacyPathOrderId } = useParams();
  const { online, markRequestStart, markRequestEnd, registerRetry } = useNetworkStatus();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadErrorObj, setLoadErrorObj] = useState(null);
  const [partialWarning, setPartialWarning] = useState("");
  const [rows, setRows] = useState([]);
  const [queueMeta, setQueueMeta] = useState(null);
  const [searchParams] = useSearchParams();
  const deptParam = searchParams.get("dept");
  const activeOrderId = searchParams.get("order") || legacyPathOrderId;
  const activeJobCardId = searchParams.get("jc");
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const deleteInFlight = useRef(false);

  const canCreate = userCanCreateSalesJobCard(user);
  const canUpdate = userCanAction(user, "sales", "update") || canCreate;
  const canDelete =
    userCanAction(user, "sales", "delete") ||
    userCanAction(user, "production", "delete") ||
    isAdmin(user);
  const effectiveTeam =
    deptParam ||
    (isStoreManager(user)
      ? "inventory"
      : isAccountant(user)
        ? "billing"
        : isOperator(user)
          ? "operator"
          : isQualityTeam(user)
            ? "quality"
            : queueMeta?.primary_team || "all");
  const storeMode = effectiveTeam === "inventory";
  const billingMode = effectiveTeam === "billing";
  const operatorMode = effectiveTeam === "operator" || (isOperator(user) && effectiveTeam === "production");
  const qualityMode = effectiveTeam === "quality";
  const showStockFilter = storeMode;
  const storeKpiCounts = queueMeta?.counts || {};
  const salesJobCardsPending = Number(storeKpiCounts.sales_job_cards_pending || 0);
  const documentCanEdit = canUpdate && !storeMode && !billingMode && !operatorMode && !qualityMode;

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteInFlight.current) return;
    const isManual = Boolean(deleteTarget.is_manual);
    const jobCardId = deleteTarget.job_card_id ?? (isManual ? deleteTarget.id : null);
    const orderId = deleteTarget.sales_order_id;
    if (isManual && !jobCardId) {
      setDeleteError("Missing job card reference.");
      return;
    }
    if (!isManual && !orderId) {
      setDeleteError("Missing sales order reference for this job card.");
      return;
    }
    deleteInFlight.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      if (isManual) {
        await deleteManualJobCard(jobCardId);
        addToast("Job card deleted successfully", "success");
      } else {
        await deleteSalesOrder(orderId);
        addToast("Job card / sales order deleted successfully", "success");
      }
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

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setLoadError("");
      setLoadErrorObj(null);
      setPartialWarning("");
      markRequestStart();
      try {
        const params = { limit: FETCH_LIMIT };
        let metaWarning = "";
        const [queueRes, metaRes] = await Promise.all([
          getMyJobCardQueue(params),
          getWorkflowRoutingMeta().catch(() => {
            metaWarning = "Workflow filters could not be loaded.";
            return { data: null };
          }),
        ]);
        const body = queueRes?.data ?? queueRes;
        const items = Array.isArray(body?.items) ? body.items.map(normalizeItem).filter(Boolean) : [];
        setRows(items);
        setQueueMeta(body?.meta ?? metaRes?.data?.meta ?? metaRes?.data ?? null);
        if (metaWarning) setPartialWarning(metaWarning);
      } catch (err) {
        setRows([]);
        const classified = classifyApiError(err, "Could not load job cards.");
        setLoadError(classified.message);
        setLoadErrorObj(err);
      } finally {
        markRequestEnd();
        setLoading(false);
        setRefreshing(false);
      }
    },
    [markRequestStart, markRequestEnd]
  );

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => registerRetry(() => load(true)), [registerRetry, load]);

  const selectedOrderId = useMemo(() => {
    const id = Number(activeOrderId);
    return Number.isFinite(id) ? id : null;
  }, [activeOrderId]);

  const selectedJobCardId = useMemo(() => {
    const id = Number(activeJobCardId);
    return Number.isFinite(id) ? id : null;
  }, [activeJobCardId]);

  const myJobCardsListPath = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("order");
    params.delete("jc");
    const search = params.toString();
    return search ? `/my-job-cards?${search}` : "/my-job-cards";
  }, [searchParams]);

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
  }, [rows, appliedFilters, showStockFilter, effectiveTeam]);

  useEffect(() => {
    if (loading || activeOrderId || activeJobCardId || filtered.length === 0) return;
    const first = filtered[0];
    if (first?.is_manual && first?.job_card_id) {
      navigate(myJobCardsManualViewUrl(first.job_card_id, searchParams), { replace: true });
      return;
    }
    const id = first?.sales_order_id ?? first?.id;
    if (id) navigate(myJobCardsViewUrl(id, searchParams), { replace: true });
  }, [loading, filtered, activeOrderId, activeJobCardId, navigate, searchParams]);

  const statusOptions = useMemo(() => {
    const fromMeta = queueMeta?.actionable_statuses;
    if (Array.isArray(fromMeta) && fromMeta.length) return fromMeta;
    return [];
  }, [queueMeta]);

  const customerOptions = useMemo(() => uniqueFilterValues(rows, "customer_name"), [rows]);
  const productOptions = useMemo(() => uniqueFilterValues(rows, "product_name"), [rows]);
  const salesOrderOptions = useMemo(() => uniqueFilterValues(rows, "order_number"), [rows]);

  const activeRow = useMemo(() => {
    if (activeJobCardId) {
      return rows.find((r) => Number(r.job_card_id) === Number(activeJobCardId)) || null;
    }
    if (activeOrderId) {
      return rows.find((r) => Number(r.sales_order_id) === Number(activeOrderId)) || null;
    }
    return null;
  }, [rows, activeOrderId, activeJobCardId]);

  const handleViewRow = (row) => {
    if (row?.is_manual && row?.job_card_id) {
      navigate(myJobCardsManualViewUrl(row.job_card_id, searchParams));
      return;
    }
    const orderId = row.sales_order_id ?? row.id;
    if (!orderId) return;
    navigate(myJobCardsViewUrl(orderId, searchParams));
  };

  const handleEditRow = (row) => {
    if (row?.is_manual && row?.job_card_id) {
      navigate(jobCardManualEditUrl(row.job_card_id));
      return;
    }
    const orderId = row.sales_order_id ?? row.id;
    if (!orderId) return;
    navigate(jobCardEditUrl(orderId));
  };

  const jobCardLinkForRow = useCallback(
    (row) => {
      if (row?.is_manual && row?.job_card_id) {
        return myJobCardsManualViewUrl(row.job_card_id, searchParams);
      }
      const orderId = row?.sales_order_id ?? row?.id;
      if (!orderId) return null;
      return myJobCardsViewUrl(orderId, searchParams);
    },
    [searchParams]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(from, from + pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const hasAppliedFilters = useMemo(
    () => Object.values(appliedFilters).some((v) => Boolean(String(v || "").trim())),
    [appliedFilters]
  );

  const applyFilters = (next = draftFilters) => {
    setAppliedFilters({ ...next });
    setPage(1);
  };

  const handleApplyFilters = () => {
    applyFilters();
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    const cleared = { ...EMPTY_FILTERS };
    setDraftFilters(cleared);
    setAppliedFilters(cleared);
    setPage(1);
  };

  const toggleFilters = () => {
    setFiltersOpen((open) => !open);
  };

  const patchDraft = (key, value) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const emptyTitle = storeMode
    ? "No Store Manager Job Cards"
    : billingMode
      ? "No Billing Job Cards"
      : operatorMode
        ? "No Operator Job Cards"
        : qualityMode
          ? "No Quality Control Job Cards"
          : "No Job Cards Found";
  const emptyDescription = storeMode
    ? "Sales Job Cards from Sales appear here automatically when submitted for store review."
    : billingMode
      ? "Packed and dispatched orders appear here for GST invoicing and ledger posting."
      : operatorMode
        ? "Assigned production jobs appear here when ready for shop floor execution."
        : qualityMode
          ? "Completed production jobs appear here when ready for quality inspection."
          : canCreate
            ? "Create your first Sales Job Card using the button below."
            : "Job cards appear here when they are created in the manufacturing workflow.";
  const sectionTitle = storeMode
    ? "Sales Orders / Job Cards from Sales"
    : billingMode
      ? "Sales Orders / Job Cards for Billing"
      : operatorMode
        ? "Production Assignments"
        : qualityMode
          ? "Quality Inspection Queue"
          : "My Job Cards";
  const sectionHint = storeMode
    ? "Review customer order details, acknowledge receipt, and continue material planning."
    : billingMode
      ? "Verify invoice data, post accounting entries, and complete billing workflow."
      : operatorMode
        ? "Execute production, record quantities, and complete work for quality check."
        : qualityMode
          ? "Inspect production output, record parameters, and approve or reject for packing."
          : null;

  return (
    <div className="ui-page ui-stack my-job-cards-page">
      {qualityMode ? (
        <QualityControlJobCardDocumentPanel
          key={activeOrderId || "empty-quality"}
          orderId={activeOrderId || null}
          row={activeRow}
          showEmptyShell={!activeOrderId}
          emptyMessage={
            filtered.length === 0
              ? "Production-completed jobs appear here when ready for quality inspection."
              : "Select a job card from the list below to open the Quality Control Job Card."
          }
        />
      ) : operatorMode ? (
        <OperatorJobCardDocumentPanel
          key={activeOrderId || "empty-operator"}
          orderId={activeOrderId || null}
          row={activeRow}
          showEmptyShell={!activeOrderId}
          emptyMessage={
            filtered.length === 0
              ? "Production assignments appear here when work orders are assigned to you."
              : "Select a job card from the list below to open the Operator Job Card."
          }
        />
      ) : billingMode ? (
        <AccountantJobCardDocumentPanel
          key={activeJobCardId || activeOrderId || "empty-billing"}
          orderId={activeOrderId || null}
          jobCardId={activeJobCardId || null}
          row={activeRow}
          showEmptyShell={!activeOrderId && !activeJobCardId}
          emptyMessage={
            filtered.length === 0
              ? "Packed and dispatched orders appear here when ready for billing."
              : "Select a job card from the list below to open the Accountant Department Job Card."
          }
        />
      ) : storeMode ? (
        <StoreManagerJobCardDocumentPanel
          key={activeJobCardId || activeOrderId || "empty-store"}
          orderId={activeOrderId || null}
          jobCardId={activeJobCardId || null}
          row={activeRow}
          showEmptyShell={!activeOrderId && !activeJobCardId}
          emptyMessage={
            filtered.length === 0
              ? "Sales Job Cards from Sales appear here when submitted for store review."
              : "Select a job card from the list below to open the Store Manager Job Card."
          }
        />
      ) : (
        <SalesJobCardDocumentPanel
          key={activeJobCardId || activeOrderId || "empty"}
          orderId={activeOrderId || null}
          jobCardId={activeJobCardId || null}
          row={activeRow}
          listPath={myJobCardsListPath}
          onEdit={documentCanEdit ? handleEditRow : undefined}
          canEdit={documentCanEdit}
          storeMode={storeMode}
          showEmptyShell={!activeOrderId && !activeJobCardId}
          emptyMessage={
            filtered.length === 0
              ? canCreate
                ? "No job cards yet. Click Add Job Card to manually create a Sales Job Card."
                : "No job cards in the queue yet."
              : "Select a job card from the list below to view the Sales Job Card document."
          }
        />
      )}

      {storeMode && salesJobCardsPending > 0 ? (
        <Link to="/my-job-cards?dept=inventory" className="my-job-cards-page__kpi-card">
          <ClipboardList className="h-5 w-5" aria-hidden />
          <div>
            <span className="my-job-cards-page__kpi-label">Sales Job Cards</span>
            <span className="my-job-cards-page__kpi-value">Pending: {salesJobCardsPending}</span>
          </div>
        </Link>
      ) : null}

      <div className="ui-card my-job-cards-page__section">
        <div className="erp-section-header erp-section-header--row">
          <div>
            <h2 className="erp-section-header__title">{sectionTitle}</h2>
            {sectionHint ? <p className="my-job-cards-page__section-hint">{sectionHint}</p> : null}
          </div>
          <div className="my-job-cards-page__section-actions">
            <span className="my-job-cards-page__section-total">Total: {filtered.length}</span>
            <Button
              variant={hasAppliedFilters ? "primary" : "outline"}
              size="sm"
              onClick={toggleFilters}
              aria-expanded={filtersOpen}
              aria-controls="my-job-cards-filters-panel"
              className={hasAppliedFilters ? "" : "my-job-cards-page__filter-btn"}
              leftIcon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
            >
              Filter{hasAppliedFilters ? " · Active" : ""}
            </Button>
            {canCreate && !storeMode && !billingMode && !operatorMode && !qualityMode ? (
              <Button
                variant="add"
                size="sm"
                onClick={() => navigate(jobCardCreateUrl())}
                leftIcon={<Plus className="h-4 w-4" aria-hidden />}
              >
                Add Job Card
              </Button>
            ) : null}
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

        {filtersOpen ? (
          <div
            id="my-job-cards-filters-panel"
            className="my-job-cards-page__filters-panel"
          >
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
              onApply={handleApplyFilters}
            />
          </div>
        ) : null}

        {partialWarning ? (
          <div className="px-4 pt-4">
            <PartialDataState
              title="Some filters could not be loaded"
              description={partialWarning}
              sections={[
                { label: "Job cards loaded", ok: true },
                { label: "Workflow metadata", ok: false },
              ]}
              onRetry={() => load(true)}
              retryLabel="Retry filters"
            />
          </div>
        ) : null}

        <AsyncPageBody
          loading={loading}
          error={loadError}
          errorObj={loadErrorObj}
          online={online}
          onRetry={() => load()}
          loadingVariant="skeleton"
          skeletonRows={8}
          skeletonCols={11}
          errorTitle="Could not load job cards"
          className="p-4"
        >
          <JobCardQueueTable
            rows={pageRows.map((row, idx) => ({ ...row, __sno: from + idx + 1 }))}
            selectedOrderId={selectedJobCardId || selectedOrderId}
            onViewDetails={handleViewRow}
            jobCardLinkForRow={jobCardLinkForRow}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            emptyAction={
              canCreate && !storeMode && !billingMode && !operatorMode && !qualityMode
                ? { label: "Add Job Card", onClick: () => navigate(jobCardCreateUrl()) }
                : undefined
            }
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
        </AsyncPageBody>
      </div>

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
