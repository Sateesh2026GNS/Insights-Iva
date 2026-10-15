import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ClipboardList, Plus, Search, X } from "lucide-react";

import Button from "../../components/common/Button";
import { ListPageShell } from "../../components/common/ListPageShell";
import Pagination from "../../components/common/Pagination";
import { AsyncPageBody, PartialDataState } from "../../components/common/states";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import JobCardQueueFilters from "../../components/manufacturing/JobCardQueueFilters";
import JobCardQueueTable from "../../components/manufacturing/JobCardQueueTable";
import SendJobCardModal from "../../components/manufacturing/SendJobCardModal";
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
import { fetchCustomersWithFallback } from "../../utils/customerOptions";
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
import {
  buildQueueSearchParams,
  hasQueueSearchFilters,
  STORE_ACTIONABLE_STATUSES,
} from "../../utils/storeJobCardQueue";
import {
  jobCardCreateUrl,
  jobCardDetailsUrl,
  jobCardEditUrl,
  jobCardManualEditUrl,
  jobCardManualViewUrl,
  myJobCardsManualViewUrl,
  myJobCardsViewUrl,
} from "../../utils/jobCardRoutes";
import { stageJobCardUrl } from "../../utils/workflowStageRoutes";
import { resolveManualJobCardId, scrollToJobCardDocumentPanel } from "../../utils/manualSalesJobCard";
import "../../styles/my-job-cards-page.css";
import "../../styles/workflow-next-step.css";

const PAGE_SIZES = [10, 20, 50, 100];
const FETCH_LIMIT = 2000;

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

function canDeleteUnsentJobCard(row) {
  const workflowStatus = String(row?.workflow_status || "").trim().toUpperCase();
  const displayStatus = String(
    row?.queue_status_label || row?.status_label || row?.status || ""
  ).trim().toLowerCase();
  return (
    ["DRAFT", "SAVED", "MANUAL_DRAFT"].includes(workflowStatus) ||
    ["draft", "saved"].includes(displayStatus)
  );
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
  inventory: STORE_ACTIONABLE_STATUSES,
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
  const [loadError, setLoadError] = useState("");
  const [loadErrorObj, setLoadErrorObj] = useState(null);
  const [partialWarning, setPartialWarning] = useState("");
  const [rows, setRows] = useState([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueMeta, setQueueMeta] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const deptParam = searchParams.get("dept");
  const activeOrderId = searchParams.get("order") || legacyPathOrderId;
  const activeJobCardId = searchParams.get("jc");
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const deleteTargetCanBeDeleted = deleteTarget ? canDeleteUnsentJobCard(deleteTarget) : false;
  const [deleting, setDeleting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [serverSearchActive, setServerSearchActive] = useState(false);
  const [customerSelectOptions, setCustomerSelectOptions] = useState([]);
  const [sendTarget, setSendTarget] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const deleteInFlight = useRef(false);

  const canCreate = userCanCreateSalesJobCard(user);
  const canUpdate = userCanAction(user, "sales", "update") || canCreate;
  const canDeleteSalesDocument =
    userCanAction(user, "sales", "delete") ||
    userCanAction(user, "production", "delete") ||
    userCanCreateSalesJobCard(user) ||
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
  const productionQueueMode = effectiveTeam === "production" && !operatorMode;
  const showStockFilter = storeMode;
  const storeKpiCounts = queueMeta?.counts || {};
  const storePendingCount = Number(storeKpiCounts.store_pending || 0);
  const bucketFromUrl = searchParams.get("bucket");
  const canSendManual =
    !billingMode &&
    !operatorMode &&
    !qualityMode &&
    (canCreate ||
      canUpdate ||
      isAdmin(user) ||
      (storeMode && (userCanAction(user, "inventory", "update") || isStoreManager(user))));
  const isSalesListMode = !storeMode && !billingMode && !operatorMode && !qualityMode;

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteInFlight.current) return;
    const isManual = Boolean(
      deleteTarget.is_manual || (!deleteTarget.sales_order_id && (deleteTarget.job_card_id || deleteTarget.id))
    );
    const jobCardId = deleteTarget.job_card_id ?? deleteTarget.id;
    const orderId = deleteTarget.sales_order_id;
    if (isManual && !jobCardId) {
      setDeleteError("Missing job card reference.");
      return;
    }
    if (!isManual && !orderId && !jobCardId) {
      setDeleteError("Missing reference for this job card.");
      return;
    }
    deleteInFlight.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      if (isManual || (!orderId && jobCardId)) {
        await deleteManualJobCard(jobCardId);
        addToast("Job card deleted successfully", "success");
      } else {
        await deleteSalesOrder(orderId);
        addToast("Job card / sales order deleted successfully", "success");
      }
      setDeleteTarget(null);
      await load(true, serverSearchActive ? appliedFilters : null);
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
    async (silent = false, searchFilters = null) => {
      if (!silent) setLoading(true);
      setLoadError("");
      setLoadErrorObj(null);
      setPartialWarning("");
      markRequestStart();
      try {
        const extra = storeMode
          ? {
              limit: pageSize,
              offset: Math.max(0, (Math.max(1, page) - 1) * pageSize),
              ...(bucketFromUrl ? { bucket: bucketFromUrl } : {}),
            }
          : { limit: FETCH_LIMIT };
        const params =
          searchFilters && hasQueueSearchFilters(searchFilters)
            ? buildQueueSearchParams(searchFilters, extra)
            : { ...extra };
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
        setQueueTotal(Number(body?.total) || items.length);
        setQueueMeta(body?.meta ?? metaRes?.data?.meta ?? metaRes?.data ?? null);
        if (metaWarning) setPartialWarning(metaWarning);
      } catch (err) {
        setRows([]);
        setQueueTotal(0);
        const classified = classifyApiError(err, "Could not load job cards.");
        setLoadError(classified.message);
        setLoadErrorObj(err);
      } finally {
        markRequestEnd();
        setLoading(false);
        setSearching(false);
      }
    },
    [markRequestStart, markRequestEnd, storeMode, page, pageSize, bucketFromUrl]
  );

  const reloadQueue = useCallback(
    () => load(true, serverSearchActive ? appliedFilters : null),
    [load, serverSearchActive, appliedFilters]
  );

  const initialQueueLoad = useRef(true);
  usePageRefresh(reloadQueue);
  useEffect(() => {
    const silent = !initialQueueLoad.current;
    initialQueueLoad.current = false;
    load(silent, serverSearchActive ? appliedFilters : null);
  }, [load, serverSearchActive, appliedFilters]);
  useEffect(() => registerRetry(() => load(true, serverSearchActive ? appliedFilters : null)), [registerRetry, load, serverSearchActive, appliedFilters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const customers = await fetchCustomersWithFallback();
        if (cancelled) return;
        setCustomerSelectOptions(
          customers
            .map((c) => ({
              value: String(c.id),
              label: String(c.name || c.company || c.customer_code || "").trim(),
            }))
            .filter((o) => o.label)
        );
      } catch {
        if (!cancelled) setCustomerSelectOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const salesOrderSelectOptions = useMemo(() => {
    const numbers = [
      ...new Set(rows.map((row) => String(row.order_number || "").trim()).filter(Boolean)),
    ].sort();
    return numbers.map((number) => ({ value: number, label: number }));
  }, [rows]);

  const statusFromUrl = searchParams.get("status");
  useEffect(() => {
    if (!statusFromUrl) return;
    const status = String(statusFromUrl).trim();
    if (!status) return;
    setDraftFilters((f) => ({ ...f, status }));
    setAppliedFilters((f) => ({ ...f, status }));
  }, [statusFromUrl]);

  useEffect(() => {
    if (!storeMode || !bucketFromUrl) return;
    setPage(1);
  }, [storeMode, bucketFromUrl]);

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
    if (storeMode) return rows;
    let list = rows;
    const f = appliedFilters;
    if (!serverSearchActive) {
      const jc = f.search.trim().toLowerCase();
      if (jc) {
        list = list.filter((r) => String(r.job_card_no || "").toLowerCase().includes(jc));
      }
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
    if (!serverSearchActive) {
      if (f.customer) {
        const custLabel =
          customerSelectOptions.find((o) => o.value === f.customer)?.label || f.customer;
        const custQ = String(f.customer).trim().toLowerCase();
        const custLabelNorm = String(custLabel).trim().toLowerCase();
        list = list.filter((r) => {
          const nameNorm = String(r.customer_name || "").trim().toLowerCase();
          return (
            String(r.customer_id || "") === String(f.customer)
            || nameNorm === custLabelNorm
            || nameNorm.includes(custQ)
            || nameNorm.includes(custLabelNorm)
          );
        });
      }
      if (f.salesOrderNo.trim()) {
        const soQ = f.salesOrderNo.trim().toLowerCase();
        list = list.filter((r) => {
          const orderNo = String(r.order_number || "").trim().toLowerCase();
          return orderNo === soQ || orderNo.includes(soQ);
        });
      }
    }
    if (f.product) {
      list = list.filter((r) => String(r.product_name || "") === f.product);
    }
    if (f.dateFrom || f.dateTo) {
      list = list.filter((r) => inDateRange(r.order_date || r.received_at, f.dateFrom, f.dateTo));
    }
    return list;
  }, [rows, appliedFilters, showStockFilter, effectiveTeam, storeMode, serverSearchActive, customerSelectOptions]);

  useEffect(() => {
    if (!isSalesListMode) return;
    if (!activeOrderId && !activeJobCardId) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("order");
        next.delete("jc");
        return next;
      },
      { replace: true }
    );
  }, [isSalesListMode, activeOrderId, activeJobCardId, setSearchParams]);

  useEffect(() => {
    if (isSalesListMode || storeMode) return;
    if (loading || activeOrderId || activeJobCardId || filtered.length === 0) return;
    const first = filtered[0];
    const manualId = resolveManualJobCardId(first);
    if (manualId != null) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("jc", String(manualId));
          next.delete("order");
          return next;
        },
        { replace: true }
      );
      return;
    }
    const id = first?.sales_order_id ?? first?.id;
    if (!id) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("order", String(id));
        next.delete("jc");
        return next;
      },
      { replace: true }
    );
  }, [isSalesListMode, storeMode, loading, filtered, activeOrderId, activeJobCardId, setSearchParams]);

  const activeRow = useMemo(() => {
    if (activeJobCardId) {
      return (
        rows.find(
          (r) =>
            Number(r.job_card_id) === Number(activeJobCardId)
            || Number(resolveManualJobCardId(r)) === Number(activeJobCardId)
        ) || null
      );
    }
    if (activeOrderId) {
      return rows.find((r) => Number(r.sales_order_id) === Number(activeOrderId)) || null;
    }
    return null;
  }, [rows, activeOrderId, activeJobCardId]);

  const handleViewRow = useCallback(
    (row) => {
      if (!row) return;
      const manualId = resolveManualJobCardId(row);
      if (productionQueueMode) {
        const orderId = row.sales_order_id ?? row.id;
        if (orderId) navigate(stageJobCardUrl(orderId, row.workflow_status));
        return;
      }
      if (isSalesListMode) {
        if (manualId != null) {
          navigate(jobCardManualViewUrl(manualId));
          return;
        }
        const orderId = row.sales_order_id ?? row.id;
        if (orderId) navigate(jobCardDetailsUrl(orderId));
        return;
      }
      if (manualId != null) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set("jc", String(manualId));
            next.delete("order");
            return next;
          },
          { replace: false }
        );
        scrollToJobCardDocumentPanel({ storeMode });
        return;
      }
      const orderId = row.sales_order_id ?? row.id;
      if (!orderId) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("order", String(orderId));
          next.delete("jc");
          return next;
        },
        { replace: false }
      );
      scrollToJobCardDocumentPanel({ storeMode });
    },
    [isSalesListMode, navigate, productionQueueMode, setSearchParams, storeMode]
  );

  const handleEditRow = (row) => {
    const manualId = resolveManualJobCardId(row);
    if (manualId != null) {
      navigate(jobCardManualEditUrl(manualId));
      return;
    }
    const orderId = row.sales_order_id ?? row.id;
    if (!orderId) return;
    navigate(jobCardEditUrl(orderId));
  };

  const jobCardLinkForRow = useCallback(
    (row) => {
      const manualId = resolveManualJobCardId(row);
      if (manualId != null) {
        return isSalesListMode
          ? jobCardManualViewUrl(manualId)
          : myJobCardsManualViewUrl(manualId, searchParams);
      }
      const orderId = row?.sales_order_id ?? row?.id;
      if (!orderId) return null;
      if (productionQueueMode) return stageJobCardUrl(orderId, row?.workflow_status);
      return isSalesListMode ? jobCardDetailsUrl(orderId) : myJobCardsViewUrl(orderId, searchParams);
    },
    [isSalesListMode, productionQueueMode, searchParams]
  );

  const manualDocumentView = Boolean(activeJobCardId) && !activeOrderId;

  const listTotal = storeMode ? queueTotal : filtered.length;
  const totalPages = Math.max(1, Math.ceil(listTotal / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const pageRows = storeMode ? filtered : filtered.slice(from, from + pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const hasAppliedFilters = useMemo(() => hasQueueSearchFilters(appliedFilters), [appliedFilters]);

  const handleApplyFilters = () => {
    const next = { ...draftFilters };
    setSearching(true);
    setAppliedFilters(next);
    setPage(1);
    setServerSearchActive(hasQueueSearchFilters(next));
  };

  const clearFilters = () => {
    const cleared = { ...EMPTY_FILTERS };
    setSearching(true);
    setDraftFilters(cleared);
    setAppliedFilters(cleared);
    setServerSearchActive(false);
    setPage(1);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApplyFilters();
    }
  };

  const patchDraft = (key, value) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const emptyTitle = hasAppliedFilters
    ? "No job cards found"
    : storeMode
      ? "No Store Manager Job Cards"
      : billingMode
        ? "No Billing Job Cards"
        : operatorMode
          ? "No Operator Job Cards"
          : qualityMode
            ? "No Quality Control Job Cards"
            : "No Job Cards Found";
  const emptyDescription = hasAppliedFilters
    ? "Try a different Job Card number, customer, or sales order."
    : storeMode
      ? "Sales Job Cards appear here only after a Sales person explicitly sends them to you."
      : billingMode
        ? "Packed and dispatched orders appear here for GST invoicing and ledger posting."
        : operatorMode
          ? "Assigned production jobs appear here when ready for shop floor execution."
          : qualityMode
            ? "Completed production jobs appear here when ready for quality inspection."
            : canCreate
              ? "No Sales Job Cards have been created yet."
              : "Job cards appear here when they are created in the manufacturing workflow.";
  const sectionTitle = storeMode
    ? "Sales Orders / Job Cards from Sales"
    : billingMode
      ? "Sales Orders / Job Cards for Billing"
      : operatorMode
        ? "Production Assignments"
        : qualityMode
          ? "Quality Inspection Queue"
          : "";
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
    <ListPageShell className="my-job-cards-page" stackClassName="my-job-cards-page__stack">
      {qualityMode ? (
        manualDocumentView ? (
          <SalesJobCardDocumentPanel
            key={activeJobCardId || "empty-quality-manual"}
            jobCardId={activeJobCardId}
            row={activeRow}
            listPath={myJobCardsListPath}
            showEmptyShell={!activeJobCardId}
            emptyMessage="Select a job card from the list below to view the Sales Job Card."
          />
        ) : (
          <QualityControlJobCardDocumentPanel
            key={activeOrderId || activeJobCardId || "empty-quality"}
            orderId={activeOrderId || null}
            row={activeRow}
            showEmptyShell={!activeOrderId && !activeJobCardId}
            emptyMessage={
              filtered.length === 0
                ? "Production-completed jobs appear here when ready for quality inspection."
                : "Select a job card from the list below to open the Quality Control Job Card."
            }
          />
        )
      ) : operatorMode ? (
        manualDocumentView ? (
          <SalesJobCardDocumentPanel
            key={activeJobCardId || "empty-operator-manual"}
            jobCardId={activeJobCardId}
            row={activeRow}
            listPath={myJobCardsListPath}
            showEmptyShell={!activeJobCardId}
            emptyMessage="Select a job card from the list below to view the Sales Job Card."
          />
        ) : (
          <OperatorJobCardDocumentPanel
            key={activeOrderId || activeJobCardId || "empty-operator"}
            orderId={activeOrderId || null}
            row={activeRow}
            onQueueRefresh={() => load(true)}
            showEmptyShell={!activeOrderId && !activeJobCardId}
            emptyMessage={
              filtered.length === 0
                ? "Production assignments appear here when work orders are assigned to you."
                : "Select a job card from the list below to open the Operator Job Card."
            }
          />
        )
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
          onSend={(row) => setSendTarget(row)}
          onQueueUpdated={reloadQueue}
          showEmptyShell={!activeOrderId && !activeJobCardId}
          emptyMessage={
            filtered.length === 0
              ? "Sales Job Cards appear here only after a Sales person explicitly sends them to you."
              : "Select a job card from the list below to open the Store Manager Job Card."
          }
        />
      ) : null}

      {storeMode && storePendingCount > 0 ? (
        <Link
          to="/my-job-cards?dept=inventory&bucket=store_pending"
          className="my-job-cards-page__kpi-card"
        >
          <ClipboardList className="h-5 w-5" aria-hidden />
          <div>
            <span className="my-job-cards-page__kpi-label">Pending Job Cards</span>
            <span className="my-job-cards-page__kpi-value">Pending: {storePendingCount}</span>
          </div>
        </Link>
      ) : null}

      <div className="ui-card my-job-cards-page__section">
        <div
          className={`erp-section-header erp-section-header--row ${
            !sectionTitle ? "erp-section-header--no-title" : ""
          }`}
        >
          {sectionTitle ? (
            <div>
              <h2 className="erp-section-header__title">{sectionTitle}</h2>
              {sectionHint ? <p className="my-job-cards-page__section-hint">{sectionHint}</p> : null}
            </div>
          ) : (
            <span className="my-job-cards-page__section-total">Total: {listTotal}</span>
          )}
          <div className="my-job-cards-page__section-actions">
            {sectionTitle ? (
              <span className="my-job-cards-page__section-total">Total: {listTotal}</span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen((v) => !v)}
              aria-expanded={searchOpen}
              aria-controls="my-job-cards-filters-panel"
              className={searchOpen ? "my-job-cards-search-toggle--open" : ""}
              leftIcon={
                searchOpen ? (
                  <X className="h-4 w-4" aria-hidden />
                ) : (
                  <Search className="h-4 w-4" aria-hidden />
                )
              }
            >
              {searchOpen ? "Close Search" : "Search"}
            </Button>
            {canCreate && !storeMode && !billingMode && !operatorMode && !qualityMode ? (
              <Button
                variant="add"
                size="sm"
                onClick={() => navigate(jobCardCreateUrl())}
                leftIcon={<Plus className="h-4 w-4" aria-hidden />}
              >
                Create Job Card
              </Button>
            ) : null}
          </div>
        </div>

        {searchOpen ? (
          <div id="my-job-cards-filters-panel" className="my-job-cards-page__filters-panel">
            <JobCardQueueFilters
              search={draftFilters.search}
              onSearchChange={(v) => patchDraft("search", v)}
              customer={draftFilters.customer}
              onCustomerChange={(v) => patchDraft("customer", v)}
              salesOrderNo={draftFilters.salesOrderNo}
              onSalesOrderNoChange={(v) => patchDraft("salesOrderNo", v)}
              customerSelectOptions={customerSelectOptions}
              salesOrderSelectOptions={salesOrderSelectOptions}
              erpLayout
              searching={searching}
              onClear={clearFilters}
              onApply={handleApplyFilters}
              onSearchKeyDown={handleSearchKeyDown}
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
              onRetry={reloadQueue}
              retryLabel="Retry filters"
            />
          </div>
        ) : null}

        <AsyncPageBody
          loading={loading}
          error={loadError}
          errorObj={loadErrorObj}
          online={online}
          onRetry={() => load(false, serverSearchActive ? appliedFilters : null)}
          loadingVariant="skeleton"
          skeletonRows={8}
          skeletonCols={11}
          errorTitle="Could not load job cards"
          className="p-4"
        >
          <JobCardQueueTable
            rows={pageRows.map((row, idx) => ({ ...row, __sno: from + idx + 1 }))}
            selectedOrderId={isSalesListMode ? null : selectedJobCardId || selectedOrderId}
            onViewDetails={handleViewRow}
            jobCardLinkForRow={jobCardLinkForRow}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            snoOffset={from}
            storeMode={storeMode}
            erpLayout
            onDelete={
              storeMode
                ? undefined
                : (row) => {
                    setDeleteError("");
                    setDeleteTarget(row);
                  }
            }
            onEdit={!storeMode && canUpdate ? handleEditRow : undefined}
            canEdit={!storeMode && canUpdate}
            canDelete={!storeMode && canDeleteSalesDocument}
            onSend={(row) => setSendTarget(row)}
            canSend={canSendManual}
          />

          {listTotal > 0 ? (
            <div className="my-job-cards-page__pagination">
              <Pagination
                page={safePage}
                pageSize={pageSize}
                total={listTotal}
                onPageChange={setPage}
                onPageSizeChange={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
                pageSizes={PAGE_SIZES}
                summaryMode="entries"
                showPageSize
              />
            </div>
          ) : null}
        </AsyncPageBody>
      </div>

      <SendJobCardModal
        open={Boolean(sendTarget)}
        jobCard={sendTarget}
        onClose={() => setSendTarget(null)}
        onSent={reloadQueue}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTargetCanBeDeleted ? "Delete saved job card?" : "Job card can't be deleted"}
        message={deleteTargetCanBeDeleted
          ? `Delete ${deleteTarget?.job_card_no || deleteTarget?.order_number || "this job card"}? This can't be undone.`
          : "This job card has already been sent and can't be deleted."}
        error={deleteError}
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        cancelLabel={deleteTargetCanBeDeleted ? "Cancel" : "Close"}
        destructive={deleteTargetCanBeDeleted}
        loading={deleting}
        loadingLabel="Deleting…"
        showConfirm={deleteTargetCanBeDeleted}
        onConfirm={handleDeleteConfirm}
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
      />
    </ListPageShell>
  );
}
