import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  Printer,
  Send,
  Target,
  Upload,
  X,
} from "lucide-react";

import Button, { IconButton } from "../../components/common/Button";
import { SearchBar } from "../../components/common/SearchFilter";
import DataTable from "../../components/common/DataTable";
import KpiCard from "../../components/common/KpiCard";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import StatusBadge from "../../components/common/StatusBadge";
import CreateProductionOrderModal from "../../components/production/CreateProductionOrderModal";
import ProductionOrderDetailModal, {
  CompleteWorkflowModal,
  StartCheckModal,
} from "../../components/production/ProductionOrderDetailModal";
import { useToast } from "../../context/ToastContext";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import { notifyManufacturingSpine, MANUFACTURING_EVENTS } from "../../utils/manufacturingEvents";
import useAuth from "../../hooks/useAuth";
import useTenantId from "../../hooks/useTenantId";
import { isOperator } from "../../config/permissions";
import {
  completeProductionOrder,
  createProductionOrder,
  getProductionOrderDetail,
  getProductionOrderStartChecks,
  getProductionOrders,
  getProductionPlanningSummary,
  getProducts,
  pauseProductionOrder,
  startProductionOrder,
  updateProductionOrderPriority,
  updateProductionOrderMachine,
  getMachines,
} from "../../api/productionApi";
import {
  DEPARTMENTS,
  ORDER_STATUSES,
  PRIORITIES,
  SHIFTS,
  canPause,
  canStart,
  calculateProgressPct,
  computePlanningSummary,
  enrichApiOrder,
  priorityBadge,
  statusLabel,
} from "../../data/productionPlanningMasterData";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";
import { cleanProductLabel } from "../../utils/productLabel";
import QuickWorkOrderModal from "../../components/production/QuickWorkOrderModal";
import IssueMaterialsModal from "../../components/production/IssueMaterialsModal";
import { jobCardDetailsUrl } from "../../utils/jobCardRoutes";

const PAGE_SIZES = [20, 50, 100, 200, 500];

function statusTone(row) {
  if (row?.is_delayed) return "danger";
  const s = String(row?.status || "").toLowerCase();
  if (s === "completed" || s === "closed" || s === "done") return "success";
  if (s === "in_progress" || s === "running" || s === "started") return "progress";
  if (s === "planned" || s === "pending") return "pending";
  if (s === "cancelled" || s === "canceled") return "neutral";
  if (s === "paused" || s === "on_hold") return "warning";
  return "info";
}

function PriorityPill({ priority }) {
  const p = priorityBadge(priority || "medium");
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${p.bg} ${p.text}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {p.label}
    </span>
  );
}

function ProgressCell({ row }) {
  const pct = calculateProgressPct(row);
  const planned = Number(row.planned_quantity || 0);
  const rawProduced = Number(row.produced_quantity ?? row.actual_quantity ?? 0);
  const produced = (row.status === "completed" || row.status === "closed" || row.status === "done")
    ? Math.max(rawProduced, planned)
    : rawProduced > 0
    ? rawProduced
    : Math.round((planned * pct) / 100);
  return (
    <div className="min-w-[88px] max-w-[120px]">
      <div className="mb-1 flex justify-between text-[11px] tabular-nums text-[var(--color-text-secondary)]">
        <span>
          {produced}/{planned}
        </span>
        <span className="font-semibold text-[var(--color-text)]">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
        <div
          className="h-full rounded-full bg-[var(--color-action-teal)] transition-[width]"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function OrderActions({
  row,
  onView,
  onEdit,
  onPrint,
  onStart,
  onPause,
  onWorkOrder,
  canEdit,
}) {
  const [open, setOpen] = useState(false);
  const menuBtnRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const needsMachine = !row.machine_name || row.machine_name === "—" || row.machine_name === "Unassigned";
  const more = [];
  if (canPause(row.status)) more.push({ label: "Pause", onClick: () => onPause(row) });
  more.push({ label: "Print", onClick: () => onPrint(row) });
  if (needsMachine) more.push({ label: "Create Work Order", onClick: () => onWorkOrder(row) });

  const openMenu = (e) => {
    e?.stopPropagation?.();
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const menuHeight = more.length * 36 + 16;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < menuHeight ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4;
      setMenuPos({
        top,
        left: Math.max(8, rect.right - 192),
      });
    }
    setOpen(true);
  };

  return (
    <div className="flex items-center justify-end gap-1 whitespace-nowrap print:hidden">
      <IconButton variant="view" aria-label="View" title="View" onClick={() => onView(row)}>
        <Eye className="h-3.5 w-3.5" />
      </IconButton>
      {canEdit ? (
        <IconButton variant="edit" aria-label="Edit" title="Edit" onClick={() => onEdit(row)}>
          <Pencil className="h-3.5 w-3.5" />
        </IconButton>
      ) : null}
      {canStart(row.status) ? (
        <IconButton variant="primary" aria-label="Start" title="Start" onClick={() => onStart(row)}>
          <Play className="h-3.5 w-3.5" />
        </IconButton>
      ) : null}
      {more.length ? (
        <div className="relative">
          <span ref={menuBtnRef} className="inline-flex">
            <IconButton
              aria-label="More actions"
              title="More actions"
              onClick={openMenu}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </IconButton>
          </span>
          {open
            ? createPortal(
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-[80] cursor-default"
                    aria-label="Close menu"
                    onClick={() => setOpen(false)}
                  />
                  <div
                    className="fixed z-[90] w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
                    style={{ top: menuPos.top, left: menuPos.left }}
                  >
                    {more.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                        onClick={() => {
                          setOpen(false);
                          item.onClick?.();
                        }}
                      >
                        {item.label === "Pause" ? <Pause className="h-3.5 w-3.5" /> : null}
                        {item.label === "Print" ? <Printer className="h-3.5 w-3.5" /> : null}
                        {item.label === "Create Work Order" ? <ClipboardList className="h-3.5 w-3.5" /> : null}
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>,
                document.body
              )
            : null}
        </div>
      ) : null}
    </div>
  );
}

const defaultFilters = {
  q: "",
  order_number: "",
  product: "",
  customer: "",
  work_order: "",
  machine: "",
  operator: "",
  department: "",
  shift: "",
  priority: "",
  status: "",
  date_from: "",
  date_to: "",
  preset: "",
};

function formatDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  return isNaN(d.getTime()) ? String(val).slice(0, 10) : d.toLocaleDateString(undefined, { dateStyle: "short" });
}

const PLANNED_STATUSES = ["draft", "planned", "pending", "material_ready", "machine_assigned"];
const IN_PROGRESS_STATUSES = ["in_progress", "running", "quality_check"];
const COMPLETED_STATUSES = ["completed", "closed", "done"];

function ClickableKpiCard({ onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block h-full w-full border-0 p-0 bg-transparent text-left focus:outline-none cursor-pointer"
      title={title}
    >
      {children}
    </button>
  );
}

/* ─── Bottom-Right Yellow Order Created Toast Popup ───────────────────────── */
function OrderCreatedToast({ order, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 7000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!order) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-full max-w-sm animate-in slide-in-from-bottom-5 duration-300 print:hidden">
      <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-yellow-400/40 border-l-6 border-[var(--color-cta)]">
        {/* close */}
        <button
          onClick={onClose}
          type="button"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-yellow-100 hover:text-gray-900 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-start gap-3.5 mb-3 pr-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-cta)] shadow-sm text-gray-900">
            <CheckCircle className="h-6 w-6 text-gray-900" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-gray-900">
              Production Order Created!
            </h4>
            <p className="text-xs font-medium text-gray-600 mt-0.5">
              Order <strong className="text-gray-900 font-bold">#{order.order_number || order.id}</strong> has been saved.
            </p>
          </div>
        </div>

        {/* Operator card if present with Yellow/Amber accent */}
        {order.operator_name && (
          <div className="flex items-center justify-between rounded-xl bg-amber-50/90 border border-amber-200 px-3.5 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Send className="h-4 w-4 text-amber-700 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Sent to Operator</p>
                <p className="truncate text-xs font-bold text-gray-900">{order.operator_name}</p>
              </div>
            </div>
            {order.operator_id && order.operator_id !== "—" && (
              <span className="text-[11px] font-bold text-gray-900 bg-[var(--color-cta)] px-2 py-0.5 rounded-md shrink-0 shadow-xs">
                ID: {order.operator_id}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductionPlanning() {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [orders, setOrders] = useState([]);
  const [apiSummary, setApiSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [startModal, setStartModal] = useState(null);
  const [startChecks, setStartChecks] = useState([]);
  const [startLoading, setStartLoading] = useState(false);
  const [completeModal, setCompleteModal] = useState(null);
  const [completeSteps, setCompleteSteps] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [createdToastOrder, setCreatedToastOrder] = useState(null);
  const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false);
  const [editModalOrder, setEditModalOrder] = useState(null);
  const [quickWoOrder, setQuickWoOrder] = useState(null);
  const [issueModalOrder, setIssueModalOrder] = useState(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (location.state?.createdOrder) {
      setCreatedToastOrder(location.state.createdOrder);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const [machines, setMachines] = useState([]);
  const [printDetailOrder, setPrintDetailOrder] = useState(null);
  const fileInputRef = useRef(null);
  const startDateRef = useRef(null);
  const dueDateRef = useRef(null);

  const load = useCallback(async (opts = {}) => {
    const isRefresh = Boolean(opts?.isRefresh);
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [oRes, sRes, mRes] = await Promise.all([
        getProductionOrders(),
        getProductionPlanningSummary().catch(() => ({ data: null })),
        getMachines().catch(() => ({ data: [] })),
      ]);
      setMachines(mRes?.data || []);
      const apiOrders = Array.isArray(oRes.data) ? oRes.data.map(enrichApiOrder) : [];
      apiOrders.sort((a, b) => {
        const idA = typeof a.id === "number" ? a.id : Number(String(a.id).replace(/\D/g, "")) || 0;
        const idB = typeof b.id === "number" ? b.id : Number(String(b.id).replace(/\D/g, "")) || 0;
        if (idA && idB && idA !== idB) return idB - idA;
        const dateA = a.created_at || a.start_date || "";
        const dateB = b.created_at || b.start_date || "";
        return String(dateB).localeCompare(String(dateA));
      });
      setOrders(apiOrders);
      setApiSummary(sRes.data || null);
      if (isRefresh) addToast("Production planning updated.", "success");
    } catch (err) {
      addToast(err?.response?.data?.detail || "Could not load production planning", "error");
      if (!isRefresh) {
        setOrders([]);
        setApiSummary(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const date_from = searchParams.get("date_from") ?? "";
    const date_to = searchParams.get("date_to") ?? "";
    if (date_from || date_to) {
      const updated = { ...defaultFilters, preset: "today", date_from, date_to };
      setFilters(updated);
      setAppliedFilters(updated);
      setShowAdvanced(true);
    }
  }, [searchParams]);

  // Clean up print state after printing dialog closes
  useEffect(() => {
    const handleAfterPrint = () => setPrintDetailOrder(null);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  useManufacturingRefresh(load);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = String(appliedFilters.q || "").trim().toLowerCase();
      if (q) {
        const hay = [
          o.order_number,
          o.product_name,
          o.customer_name,
          o.buyer_company,
          o.work_order_number,
          o.machine_name,
          o.operator_name,
          o.operator_id,
          o.department,
          o.shift,
          o.priority,
          o.status,
          ...(Array.isArray(o.work_orders)
            ? o.work_orders.flatMap((w) => [w.work_order_number, w.machine_name, w.operator_name])
            : []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (
        appliedFilters.order_number &&
        !String(o.order_number || o.id || "")
          .toLowerCase()
          .includes(appliedFilters.order_number.trim().toLowerCase())
      ) {
        return false;
      }
      if (appliedFilters.work_order) {
        const targetWo = appliedFilters.work_order.trim().toLowerCase();
        const directWo = String(o.work_order_number || "").toLowerCase();
        const nestedWo = Array.isArray(o.work_orders)
          ? o.work_orders.some((w) =>
              String(w.work_order_number || w.id || "").toLowerCase().includes(targetWo)
            )
          : false;
        if (!directWo.includes(targetWo) && !nestedWo) return false;
      }
      if (
        appliedFilters.product &&
        !String(o.product_name || o.product?.name || o.product?.sku || "")
          .toLowerCase()
          .includes(appliedFilters.product.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        appliedFilters.customer &&
        !String(o.customer_name || o.customer || o.buyer_company || "")
          .toLowerCase()
          .includes(appliedFilters.customer.trim().toLowerCase())
      ) {
        return false;
      }
      if (appliedFilters.machine) {
        const targetM = appliedFilters.machine.trim().toLowerCase();
        const directM = String(o.machine_name || o.machine?.name || o.machine?.code || "").toLowerCase();
        const nestedM = Array.isArray(o.work_orders)
          ? o.work_orders.some((w) =>
              String(w.machine_name || w.machine?.name || w.machine?.code || "").toLowerCase().includes(targetM)
            )
          : false;
        if (!directM.includes(targetM) && !nestedM) return false;
      }
      if (appliedFilters.operator) {
        const targetOp = appliedFilters.operator.trim().toLowerCase();
        const directOp = String(o.operator_name || o.operator_id || "").toLowerCase();
        const nestedOp = Array.isArray(o.work_orders)
          ? o.work_orders.some((w) =>
              String(w.operator_name || w.operator || "").toLowerCase().includes(targetOp)
            )
          : false;
        if (!directOp.includes(targetOp) && !nestedOp) return false;
      }
      if (
        appliedFilters.department &&
        String(o.department || "").trim().toLowerCase() !== appliedFilters.department.trim().toLowerCase()
      ) {
        return false;
      }
      if (appliedFilters.shift) {
        const targetShift = appliedFilters.shift.trim().toLowerCase();
        const shiftVal = typeof o.shift === "object" ? (o.shift?.id || o.shift?.label || "") : String(o.shift || "");
        if (shiftVal.trim().toLowerCase() !== targetShift) return false;
      }
      if (
        appliedFilters.priority &&
        String(o.priority || "").trim().toLowerCase() !== appliedFilters.priority.trim().toLowerCase()
      ) {
        return false;
      }

      const status = String(o.status || "").toLowerCase();
      if (appliedFilters.preset === "planned" && !PLANNED_STATUSES.includes(status)) return false;
      if (appliedFilters.preset === "in_progress" && !IN_PROGRESS_STATUSES.includes(status)) return false;
      if (appliedFilters.preset === "completed" && !COMPLETED_STATUSES.includes(status)) return false;
      if (appliedFilters.preset === "delayed" && !o.is_delayed && status !== "delayed") return false;

      if (appliedFilters.status) {
        const targetStatus = appliedFilters.status.trim().toLowerCase();
        if (targetStatus === "completed" || targetStatus === "closed" || targetStatus === "done") {
          if (!COMPLETED_STATUSES.includes(status)) return false;
        } else if (targetStatus === "in_progress" || targetStatus === "running") {
          if (!IN_PROGRESS_STATUSES.includes(status)) return false;
        } else if (targetStatus === "planned" || targetStatus === "draft" || targetStatus === "pending") {
          if (!PLANNED_STATUSES.includes(status)) return false;
        } else if (status !== targetStatus) {
          return false;
        }
      }
      const startDate = o.start_date ? String(o.start_date).slice(0, 10) : "";
      const createdDate = o.created_at ? String(o.created_at).slice(0, 10) : "";
      const dueDate = o.due_date ? String(o.due_date).slice(0, 10) : "";
      const effectiveDate = startDate || createdDate;
      const effectiveDue = dueDate || effectiveDate;

      if (appliedFilters.date_from) {
        const woStartMatch = Array.isArray(o.work_orders)
          ? o.work_orders.some((w) => {
              const ws = w.planned_start ? String(w.planned_start).slice(0, 10) : (w.created_at ? String(w.created_at).slice(0, 10) : "");
              return ws && ws >= appliedFilters.date_from;
            })
          : false;
        if ((!effectiveDate || effectiveDate < appliedFilters.date_from) && !woStartMatch) {
          return false;
        }
      }

      if (appliedFilters.date_to) {
        const woDueMatch = Array.isArray(o.work_orders)
          ? o.work_orders.some((w) => {
              const wd = w.planned_end ? String(w.planned_end).slice(0, 10) : (w.planned_start ? String(w.planned_start).slice(0, 10) : (w.created_at ? String(w.created_at).slice(0, 10) : ""));
              return wd && wd <= appliedFilters.date_to;
            })
          : false;
        if ((!effectiveDue || effectiveDue > appliedFilters.date_to) && !woDueMatch) {
          return false;
        }
      }
      return true;
    });
  }, [orders, appliedFilters]);

  useEffect(() => {
    setPage(1);
  }, [appliedFilters, pageSize]);

  const total = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice((page - 1) * pageSize, page * pageSize);
  }, [filteredOrders, page, pageSize]);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const summary = useMemo(() => {
    const computed = computePlanningSummary(filteredOrders);
    const filtersActive = Object.entries(appliedFilters).some(([key, val]) => {
      if (key === "preset" && (!val || val === "all")) return false;
      return Boolean(val);
    });
    if (apiSummary && !filtersActive) {
      return {
        total_orders: apiSummary.total_orders ?? computed.total_orders,
        planned_orders: apiSummary.planned_orders ?? computed.planned_orders,
        in_progress_orders: apiSummary.in_progress_orders ?? computed.in_progress_orders,
        completed_orders: apiSummary.completed_orders ?? computed.completed_orders,
        delayed_orders: apiSummary.delayed_orders ?? computed.delayed_orders,
        cancelled_orders: apiSummary.cancelled_orders ?? computed.cancelled_orders,
        todays_target: apiSummary.todays_target ?? computed.todays_target,
        todays_production: apiSummary.todays_production ?? computed.todays_production,
      };
    }
    return computed;
  }, [apiSummary, filteredOrders, appliedFilters]);

  const showTodayStartOrders = () => {
    const today = new Date().toISOString().slice(0, 10);
    const updated = { ...defaultFilters, preset: "today", date_from: today, date_to: today };
    setFilters(updated);
    setAppliedFilters(updated);
    setSearchParams({ date_from: today, date_to: today });
    setShowAdvanced(true);
    setPage(1);
  };

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({ ...filters, preset: "" });
    setPage(1);
  }, [filters]);

  const handleClearFilters = useCallback(() => {
    setFilters({ ...defaultFilters });
    setAppliedFilters({ ...defaultFilters });
    setSearchParams({});
    setPage(1);
  }, [setSearchParams]);

  const handleFilterKeyDown = (e) => {
    if (e.key === "Enter") {
      handleApplyFilters();
    }
  };

  const applyPlanningPreset = (preset) => {
    if (preset === "today") {
      showTodayStartOrders();
      return;
    }
    if (preset === "all") {
      handleClearFilters();
      setShowAdvanced(false);
      return;
    }
    const updated = { ...defaultFilters, preset };
    setFilters(updated);
    setAppliedFilters(updated);
    setSearchParams({});
    setShowAdvanced(true);
    setPage(1);
  };

  const patchFilters = (patch) => {
    setFilters((f) => ({ ...f, ...patch, preset: "" }));
  };

  const openOrder = async (order) => {
    setSelected(order);
    setDetail(null);
    if (typeof order.id === "number") {
      try {
        const res = await getProductionOrderDetail(order.id);
        setDetail(enrichApiOrder(res.data));
      } catch {
        /* use list */
      }
    }
  };

  const viewJobCard = async (order) => {
    let salesOrderId = order?.sales_order_id;
    if (!salesOrderId && typeof order?.id === "number") {
      try {
        const res = await getProductionOrderDetail(order.id);
        const enriched = enrichApiOrder(res.data);
        salesOrderId = enriched?.sales_order_id;
      } catch {
        /* fall through */
      }
    }
    if (salesOrderId) {
      navigate(jobCardDetailsUrl(salesOrderId), {
        state: { from: "/production/planning", productionOrderId: order.id },
      });
      return;
    }
    addToast("No linked sales order found for this production order.", "warning");
    openOrder(order);
  };

  const handlePriorityChange = async (orderId, newPriority) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, priority: newPriority } : o)));
    addToast(`Priority updated to ${newPriority}`);
    if (typeof orderId === "number") {
      try {
        await updateProductionOrderPriority(orderId, newPriority);
        notifyManufacturingSpine(MANUFACTURING_EVENTS.WORK_ORDER_UPDATED, { orderId, priority: newPriority });
      } catch {
        addToast("Priority update failed on server", "error");
      }
    }
  };

  const handleMachineChange = async (orderId, machineId) => {
    const numId = machineId ? Number(machineId) : null;
    const selectedM = machines.find((m) => String(m.id) === String(machineId));
    const mName = selectedM ? (selectedM.name || selectedM.code) : (machineId ? `Machine #${machineId}` : "—");

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId || o.order_number === orderId) {
          return { ...o, machine_id: numId, machine_name: mName };
        }
        return o;
      })
    );

    addToast(numId ? `Machine (${mName}) assigned` : "Machine unassigned", "success");

    if (typeof orderId === "number" && numId) {
      try {
        await updateProductionOrderMachine(orderId, numId);
        notifyManufacturingSpine(MANUFACTURING_EVENTS.WORK_ORDER_UPDATED, { orderId, machineId: numId });
      } catch {
        // Fallback info
      }
    }
  };

  const handleStartClick = async (order) => {
    if (typeof order.id === "number") {
      try {
        const res = await getProductionOrderStartChecks(order.id);
        setStartChecks(res.data || []);
        setStartModal(order);
        return;
      } catch {
        addToast("Could not load start checks", "error");
        return;
      }
    }
    const hasMachine = Boolean(order.machine_name && order.machine_name !== "—");
    const hasOperator = Boolean(order.operator_name && order.operator_name !== "—");
    setStartChecks([
      { check_type: "material", label: "Material Availability", ready: true, message: "All required materials available" },
      { check_type: "machine", label: "Machine Availability", ready: hasMachine, message: hasMachine ? `Machine ready (${order.machine_name})` : "No machine assigned" },
      { check_type: "operator", label: "Operator Availability", ready: hasOperator, message: hasOperator ? `Operator assigned (${order.operator_name})` : "No operator assigned" },
    ]);
    setStartModal(order);
  };

  const confirmStart = async () => {
    const order = startModal;
    if (!order) return;
    setStartLoading(true);
    if (typeof order.id === "number") {
      try {
        const res = await startProductionOrder(order.id);
        if (res.data?.success) {
          addToast("Production started");
          load();
          setStartModal(null);
        } else {
          setStartChecks(res.data?.checks || []);
          addToast(res.data?.message || "Checks failed", "error");
        }
      } catch (err) {
        addToast(err.response?.data?.detail || "Start failed", "error");
      } finally {
        setStartLoading(false);
      }
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "in_progress" } : o)));
    addToast("Production started");
    setStartModal(null);
    setStartLoading(false);
  };

  const handlePause = async (order) => {
    if (typeof order.id === "number") {
      try {
        await pauseProductionOrder(order.id);
        addToast("Production paused");
        load();
      } catch {
        addToast("Pause failed", "error");
      }
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "planned" } : o)));
    addToast("Production paused");
  };

  const handleComplete = async (order) => {
    if (typeof order.id === "number") {
      try {
        const res = await completeProductionOrder(order.id);
        if (res.data?.success) {
          setCompleteSteps(res.data.steps || []);
          setCompleteModal(order);
          addToast(res.data.message || "Completed");
          load();
          setSelected(null);
        } else {
          addToast(res.data?.message || "Complete failed", "error");
        }
      } catch (err) {
        addToast(err.response?.data?.detail || "Complete failed", "error");
      }
      return;
    }
    setCompleteSteps([
      "Production finished — quality inspection initiated",
      "Quality inspection passed",
      "Inventory updated with finished goods",
      "Order marked completed",
    ]);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "completed", produced_quantity: o.planned_quantity, progress_pct: 100 } : o)));
    setCompleteModal(order);
    addToast("Order completed");
  };

  const handleImportFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        const lines = String(content).split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
        if (lines.length <= 1) {
          addToast("Import failed: CSV file is empty or missing data rows", "error");
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim());
        const rows = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim());
          const obj = {};
          headers.forEach((header, index) => {
            const key = header.toLowerCase().replace(/ /g, "_");
            obj[key] = values[index] || "";
          });
          return obj;
        });

        setImporting(true);
        const productsRes = await getProducts();
        const products = Array.isArray(productsRes?.data) ? productsRes.data : [];
        const matchProduct = (row) => {
          const id = Number(row.product_id);
          if (Number.isFinite(id) && id > 0) {
            return products.find((p) => Number(p.id) === id) || { id };
          }
          const raw = String(row.product || row.product_name || "").trim().toLowerCase();
          if (!raw) return null;
          return (
            products.find(
              (p) =>
                String(p.name || "").toLowerCase() === raw ||
                String(p.sku || "").toLowerCase() === raw ||
                String(p.code || "").toLowerCase() === raw
            ) || null
          );
        };

        let createdCount = 0;
        for (const row of rows) {
          const product = matchProduct(row);
          if (!product?.id) {
            continue;
          }
          const plannedQty = Number(row.planned_quantity || row.quantity || 0);
          if (!plannedQty || plannedQty <= 0) {
            continue;
          }

          const payload = {
            tenant_id: tenantId || 1,
            product_id: product.id,
            planned_quantity: plannedQty,
            order_number: row.order_number ? String(row.order_number).trim() : undefined,
            customer_name: row.customer ? String(row.customer).trim() : undefined,
            priority: row.priority && PRIORITIES.includes(row.priority.toLowerCase()) ? row.priority.toLowerCase() : "medium",
            department: row.department ? String(row.department).trim() : undefined,
            shift: row.shift ? String(row.shift).trim() : undefined,
            start_date: row.start_date ? new Date(row.start_date).toISOString() : undefined,
            due_date: row.due_date ? new Date(row.due_date).toISOString() : undefined,
            status: row.status && ORDER_STATUSES.includes(row.status.toLowerCase()) ? row.status.toLowerCase() : "planned",
          };

          try {
            await createProductionOrder(payload);
            createdCount += 1;
          } catch {
            // skip failed row
          }
        }

        if (createdCount > 0) {
          addToast(`Import successful: Created ${createdCount} production order(s)`, "success");
          notifyManufacturingSpine(MANUFACTURING_EVENTS.ORDER_CREATED, { count: createdCount });
          load();
        } else {
          addToast("Import failed: No valid rows could be imported.", "error");
        }
      } catch (err) {
        addToast(`Import failed: ${err.message || "Invalid file format"}`, "error");
      } finally {
        setImporting(false);
        if (event.target) event.target.value = "";
      }
    };

    reader.readAsText(file);
  };

  const handleExportExcel = () => {
    const cols = [
      { key: "order_number", label: "Order Number" },
      { key: "product_name", label: "Product" },
      { key: "customer_name", label: "Customer" },
      { key: "planned_quantity", label: "Planned Quantity" },
      { key: "produced_quantity", label: "Produced Quantity" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
      { key: "machine_name", label: "Machine" },
      { key: "operator_name", label: "Operator" },
      { key: "department", label: "Department" },
      { key: "shift", label: "Shift" },
      { key: "start_date", label: "Start Date" },
      { key: "due_date", label: "Due Date" },
    ];
    exportToExcel(filteredOrders, cols, "production-planning-orders");
    addToast("Exported to Excel", "success");
  };

  const handleExportPdf = () => {
    const cols = [
      { key: "order_number", label: "Order No." },
      { key: "product_name", label: "Product" },
      { key: "planned_quantity", label: "Planned" },
      { key: "produced_quantity", label: "Produced" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
      { key: "due_date", label: "Due Date" },
    ];
    exportToPdf(filteredOrders, cols, "production-planning-orders", "Production Planning Report");
    addToast("Exported to PDF", "success");
  };

  const handleGlobalPrint = () => {
    setPrintDetailOrder(null);
    window.print();
  };

  const handleIndividualPrint = (order) => {
    setPrintDetailOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const columns = [
    {
      key: "id",
      label: "S.No.",
      render: (_, __, i) => <span className="tabular-nums font-medium text-[var(--color-text-muted)]">{from + i}</span>,
      sortable: false,
    },
    {
      key: "order_number",
      label: "Order",
      render: (r) => (
        <button
          type="button"
          onClick={() => openOrder(r)}
          className="font-medium text-[var(--color-primary)] hover:underline focus:outline-none"
        >
          {r.order_number}
        </button>
      ),
    },
    {
      key: "product_name",
      label: "Product",
      render: (r) => (
        <div className="max-w-[200px] truncate" title={r.product_name}>
          <span className="font-medium text-[var(--color-text)]">{r.product_name}</span>
          {r.customer_name && r.customer_name !== "—" ? (
            <span className="block text-[11px] text-[var(--color-text-muted)] truncate">{r.customer_name}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "planned_quantity",
      label: "Qty",
      render: (r) => (
        <span className="tabular-nums text-[var(--color-text)]">
          {Number(r.planned_quantity || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (r) => <PriorityPill priority={r.priority} />,
    },
    {
      key: "progress",
      label: "Progress",
      sortable: false,
      printHidden: true,
      render: (r) => <ProgressCell row={r} />,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusBadge tone={statusTone(r)}>
          {r.is_delayed ? "Delayed" : statusLabel(r.status)}
        </StatusBadge>
      ),
    },
    {
      key: "due_date",
      label: "Due",
      render: (r) => (
        <span className="whitespace-nowrap text-[12px] tabular-nums text-[var(--color-text-secondary)]">
          {formatDate(r.due_date)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      printHidden: true,
      render: (r) => (
        <OrderActions
          row={r}
          canEdit={!isOperator(user)}
          onView={viewJobCard}
          onEdit={(order) => {
            setEditModalOrder(order);
            setCreateOrderModalOpen(true);
          }}
          onPrint={handleIndividualPrint}
          onStart={handleStartClick}
          onPause={handlePause}
          onWorkOrder={(order) => setIssueModalOrder(order)}
        />
      ),
    },
  ];

  if (loading) return <Loader label="Loading production planning..." />;

  const canCreate = !isOperator(user);

  return (
    <>
      <div
        className={`min-w-0 w-full space-y-5 pb-4 ${printDetailOrder ? "hidden print:hidden" : "print:m-0 print:p-0 print:space-y-4 print:block"}`}
      >
          <div className="mb-4 hidden border-b pb-4 print:block">
            <h1 className="text-xl font-bold text-black">Production Planning Report</h1>
            <p className="text-xs text-slate-600">
              Generated on: {new Date().toLocaleDateString()} | Total Orders: {filteredOrders.length}
            </p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv, .txt"
            className="hidden"
          />

          <PageHeader
            action={
              <>
                <Button variant="secondary" to="/production/work-orders">
                  <ClipboardList className="h-4 w-4" />
                  Work Orders
                </Button>
              </>
            }
          />

          <div className="ui-grid-kpi print:hidden">
            <ClickableKpiCard onClick={() => applyPlanningPreset("all")} title="Show all production orders" tone="primary">
              <KpiCard label="Total Orders" value={summary.total_orders ?? 0} icon={ClipboardList} tone="primary" meta="Click to filter" />
            </ClickableKpiCard>
            <ClickableKpiCard onClick={() => applyPlanningPreset("planned")} title="Show planned orders" tone="yellow">
              <KpiCard label="Planned" value={summary.planned_orders ?? 0} icon={FileText} tone="yellow" meta="Click to filter" />
            </ClickableKpiCard>
            <ClickableKpiCard onClick={() => applyPlanningPreset("in_progress")} title="Show in-progress orders" tone="warning">
              <KpiCard label="In Progress" value={summary.in_progress_orders ?? 0} icon={Play} tone="warning" meta="Click to filter" />
            </ClickableKpiCard>
            <ClickableKpiCard onClick={() => applyPlanningPreset("completed")} title="Show completed orders" tone="success">
              <KpiCard label="Completed" value={summary.completed_orders ?? 0} icon={CheckCircle2} tone="success" meta="Click to filter" />
            </ClickableKpiCard>
            <ClickableKpiCard onClick={() => applyPlanningPreset("delayed")} title="Show delayed orders" tone="danger">
              <KpiCard label="Delayed" value={summary.delayed_orders ?? 0} icon={AlertTriangle} tone="danger" meta="Click to filter" />
            </ClickableKpiCard>
            <ClickableKpiCard onClick={showTodayStartOrders} title="Show orders starting today" tone="violet">
              <KpiCard
                label="Today's Production"
                value={summary.todays_production?.toLocaleString?.() ?? summary.todays_production ?? 0}
                icon={Target}
                tone="violet"
                meta="Click to filter"
              />
            </ClickableKpiCard>
          </div>

          <div className="ui-card min-w-0 p-4 sm:p-5 print:border-0 print:bg-white print:p-0 print:shadow-none">
            <div className="mb-4 flex flex-col gap-3 print:hidden lg:flex-row lg:items-center lg:justify-between">
              <SearchBar
                value={filters.q}
                onChange={(val) => {
                  setFilters((f) => ({ ...f, q: val, preset: "" }));
                  setAppliedFilters((f) => ({ ...f, q: val, preset: "" }));
                }}
                placeholder="Search"
                className="w-full"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" type="button" onClick={() => setShowAdvanced(!showAdvanced)}>
                  {showAdvanced ? "Hide Filters" : "Filters"}
                </Button>
                <Button variant="secondary" type="button" onClick={handleExportExcel} title="Export Excel">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="hidden sm:inline">Excel</span>
                </Button>
                <Button variant="secondary" type="button" onClick={handleGlobalPrint} title="Print">
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">Print</span>
                </Button>
                {canCreate ? (
                  <Button
                    variant="success"
                    type="button"
                    onClick={() => {
                      setEditModalOrder(null);
                      setCreateOrderModalOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    New Production Order
                  </Button>
                ) : null}
              </div>
            </div>

            {showAdvanced && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 print:hidden">
                <input
                  placeholder="WO Number"
                  value={filters.work_order}
                  onChange={(e) => patchFilters({ work_order: e.target.value })}
                  onKeyDown={handleFilterKeyDown}
                  className="ui-input"
                />
                <input
                  placeholder="Production Order"
                  value={filters.order_number}
                  onChange={(e) => patchFilters({ order_number: e.target.value })}
                  onKeyDown={handleFilterKeyDown}
                  className="ui-input"
                />
                <input
                  placeholder="Product"
                  value={filters.product}
                  onChange={(e) => patchFilters({ product: e.target.value })}
                  onKeyDown={handleFilterKeyDown}
                  className="ui-input"
                />
                <input
                  placeholder="Customer"
                  value={filters.customer}
                  onChange={(e) => patchFilters({ customer: e.target.value })}
                  onKeyDown={handleFilterKeyDown}
                  className="ui-input"
                />
                <input
                  placeholder="Machine"
                  value={filters.machine}
                  onChange={(e) => patchFilters({ machine: e.target.value })}
                  onKeyDown={handleFilterKeyDown}
                  className="ui-input"
                />
                <input
                  placeholder="Operator"
                  value={filters.operator}
                  onChange={(e) => patchFilters({ operator: e.target.value })}
                  onKeyDown={handleFilterKeyDown}
                  className="ui-input"
                />
                <select
                  value={filters.department}
                  onChange={(e) => patchFilters({ department: e.target.value })}
                  className="ui-select"
                >
                  <option value="">Department</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.shift}
                  onChange={(e) => patchFilters({ shift: e.target.value })}
                  className="ui-select"
                >
                  <option value="">Shift</option>
                  {SHIFTS.map((s) => {
                    const id = typeof s === "object" ? s.id : s;
                    const label = typeof s === "object" ? s.label : s;
                    return (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <select
                  value={filters.priority}
                  onChange={(e) => patchFilters({ priority: e.target.value })}
                  className="ui-select"
                >
                  <option value="">Priority</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.status}
                  onChange={(e) => patchFilters({ status: e.target.value })}
                  className="ui-select"
                >
                  <option value="">Status</option>
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
                <div className="relative flex items-center">
                  <input
                    ref={startDateRef}
                    type="date"
                    placeholder="Start Date"
                    title="Start Date"
                    aria-label="Start Date"
                    value={filters.date_from}
                    onChange={(e) => patchFilters({ date_from: e.target.value })}
                    onKeyDown={handleFilterKeyDown}
                    onClick={(e) => {
                      try {
                        e.target.showPicker?.();
                      } catch {}
                    }}
                    className="ui-input w-full pr-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      try {
                        startDateRef.current?.showPicker?.();
                        startDateRef.current?.focus();
                      } catch {
                        startDateRef.current?.focus();
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-icon)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
                    title="Open calendar"
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                </div>
                <div className="relative flex items-center">
                  <input
                    ref={dueDateRef}
                    type="date"
                    placeholder="Due Date"
                    title="Due Date"
                    aria-label="Due Date"
                    value={filters.date_to}
                    onChange={(e) => patchFilters({ date_to: e.target.value })}
                    onKeyDown={handleFilterKeyDown}
                    onClick={(e) => {
                      try {
                        e.target.showPicker?.();
                      } catch {}
                    }}
                    className="ui-input w-full pr-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      try {
                        dueDateRef.current?.showPicker?.();
                        dueDateRef.current?.focus();
                      } catch {
                        dueDateRef.current?.focus();
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-icon)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
                    title="Open calendar"
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 sm:col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-6">
                  <Button variant="primary" type="button" onClick={handleApplyFilters}>
                    Apply Filters
                  </Button>
                  <Button variant="secondary" type="button" onClick={handleClearFilters}>
                    Clear
                  </Button>
                </div>
              </div>
            )}

            <div className="planning-table-panel print:border-none print:shadow-none">
              <DataTable
                columns={columns}
                data={paginatedOrders}
                showSearch={false}
                showPagination={false}
                emptyState={
                  <div className="px-4 py-16 text-center">
                    <ClipboardList className="mx-auto h-14 w-14 text-[var(--color-text-icon)]" strokeWidth={1.25} />
                    <p className="mt-4 text-sm font-semibold text-[var(--color-text)]">
                      {Object.values(filters).some(Boolean)
                        ? "No production orders match your filters."
                        : "No production orders yet"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      {Object.values(filters).some(Boolean)
                        ? "Clear filters or adjust search to view all orders."
                        : "Create an order to start planning, or review material requests for shortages."}
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      {Object.values(filters).some(Boolean) ? (
                        <Button variant="secondary" type="button" onClick={handleClearFilters}>
                          Clear Filters
                        </Button>
                      ) : (
                        <>
                          {canCreate ? (
                            <Button
                              variant="success"
                              type="button"
                              onClick={() => {
                                setEditModalOrder(null);
                                setCreateOrderModalOpen(true);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                              New Production Order
                            </Button>
                          ) : null}
                          <Button variant="secondary" to="/procurement/material-requests">
                            Material Requests
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                }
              />
            </div>

            <div className="mt-4 ui-pagination justify-between print:hidden">
              <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="ui-pagination-select"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="tabular-nums">{total === 0 ? "0-0 of 0" : `${from}-${to} of ${total}`}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="ui-page-btn"
                  aria-label="Previous page"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" className="ui-page-btn ui-page-btn--active" aria-current="page">
                  {page}
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="ui-page-btn"
                  aria-label="Next page"
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
      </div>

      {/* Single Item Print View */}
      {printDetailOrder && (
        <div className="hidden print:block p-8 bg-white text-black h-screen">
          <div className="flex justify-between items-center mb-5 text-xs text-slate-600">
            <div>
              <span className="font-bold text-blue-600 text-xs tracking-wide">Production</span>
              {(user?.full_name || user?.name) && <span className="ml-2.5 text-slate-600">Welcome, {user.full_name || user.name}</span>}
            </div>
            <span className="font-bold text-blue-600 text-xs tracking-wide">Insights Iva</span>
          </div>
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <h1 className="print-title text-4xl font-black uppercase tracking-wide text-black">Production Order Details</h1>
            <p className="text-sm text-slate-500 mt-1">Order # {printDetailOrder.order_number} | Printed on {new Date().toLocaleDateString()} {(user?.full_name || user?.name) ? `| By: ${user.full_name || user.name}` : ""}</p>
          </div>

          <div className="grid grid-cols-2 gap-y-6 gap-x-12 mb-8">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Product Information</p>
              <p className="text-xl font-bold text-slate-900">{printDetailOrder.product_name || "—"}</p>
              <p className="text-sm text-slate-700 mt-1">BOM Version: {printDetailOrder.bom_version || "Default"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Customer</p>
              <p className="text-lg font-medium text-slate-800">{printDetailOrder.customer_name || "Internal"}</p>
            </div>
            
            <div className="col-span-2 border-t border-slate-200 pt-6"></div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Priority & Status</p>
              <div className="flex items-center gap-4 mt-1">
                <PriorityPill priority={printDetailOrder.priority} />
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize border border-slate-300`}>
                  {printDetailOrder.is_delayed ? "delayed" : statusLabel(printDetailOrder.status)}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Production Quantities</p>
              <div className="grid grid-cols-3 gap-4 mt-1">
                <div>
                  <span className="block text-xl font-bold">{printDetailOrder.planned_quantity}</span>
                  <span className="text-xs text-slate-500">Planned</span>
                </div>
                <div>
                  <span className="block text-xl font-bold">{printDetailOrder.produced_quantity || 0}</span>
                  <span className="text-xs text-slate-500">Produced</span>
                </div>
                <div>
                  <span className="block text-xl font-bold">{Math.max((printDetailOrder.planned_quantity || 0) - (printDetailOrder.produced_quantity || 0), 0)}</span>
                  <span className="text-xs text-slate-500">Balance</span>
                </div>
              </div>
            </div>

            <div className="col-span-2 border-t border-slate-200 pt-6"></div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Schedule</p>
              <p className="text-sm"><span className="font-medium">Start:</span> {formatDate(printDetailOrder.start_date)}</p>
              <p className="text-sm mt-1"><span className="font-medium">Due:</span> {formatDate(printDetailOrder.due_date)}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Assignment</p>
              <p className="text-sm"><span className="font-medium">Machine:</span> {printDetailOrder.machine_name || "Unassigned"}</p>
              <p className="text-sm mt-1"><span className="font-medium">Shift:</span> {typeof printDetailOrder.shift === "object" ? (printDetailOrder.shift?.label || printDetailOrder.shift?.id || "—") : (printDetailOrder.shift || "—")}</p>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <ProductionOrderDetailModal
          order={selected}
          detail={detail}
          onClose={() => { setSelected(null); setDetail(null); }}
          onStart={handleStartClick}
          onPause={handlePause}
          onComplete={handleComplete}
          onQuickWorkOrder={(o) => setQuickWoOrder(o)}
        />
      )}

      {startModal && (
        <StartCheckModal
          order={startModal}
          checks={startChecks}
          onClose={() => setStartModal(null)}
          onConfirm={confirmStart}
          loading={startLoading}
        />
      )}

      {completeModal && (
        <CompleteWorkflowModal
          order={completeModal}
          steps={completeSteps}
          onClose={() => setCompleteModal(null)}
        />
      )}

      {quickWoOrder && (
        <QuickWorkOrderModal
          order={quickWoOrder}
          onClose={() => setQuickWoOrder(null)}
          onSuccess={() => load()}
          addToast={addToast}
        />
      )}

      {issueModalOrder && (
        <IssueMaterialsModal
          workOrder={issueModalOrder}
          onClose={() => setIssueModalOrder(null)}
          onSuccess={() => load()}
          addToast={addToast}
        />
      )}

      {createdToastOrder && (
        <OrderCreatedToast
          order={createdToastOrder}
          onClose={() => setCreatedToastOrder(null)}
        />
      )}

      <CreateProductionOrderModal
        open={createOrderModalOpen}
        onClose={() => {
          setCreateOrderModalOpen(false);
          setEditModalOrder(null);
        }}
        initialOrder={editModalOrder}
        machinesList={machines}
        onSaved={(newOrder) => {
          load({ isRefresh: true });
          setCreatedToastOrder(newOrder);
        }}
      />

      {/* Global CSS for Print Optimization */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 4mm;
          }
          *, *::before, *::after {
            box-shadow: none !important;
            text-shadow: none !important;
            scrollbar-width: none !important;
          }
          *::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          html, body, #root {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background-color: #fff !important;
            color: #000 !important;
          }
          div, section, article, main, table, .overflow-x-auto {
            overflow: visible !important;
            overflow-x: visible !important;
            overflow-y: visible !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            border-radius: 0 !important;
          }
          body * {
            background-color: #fff !important;
            background: transparent !important;
            color: #000 !important;
            font-size: 10px !important;
            font-weight: 400 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          table {
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            font-size: 10px !important;
            table-layout: auto !important;
            margin: 0 !important;
          }
          th {
            border: 1px solid #cbd5e1 !important;
            padding: 4px 6px !important;
            white-space: normal !important;
            word-break: break-word !important;
            background-color: #f8fafc !important;
            font-size: 10px !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            text-align: left !important;
          }
          td {
            border: 1px solid #cbd5e1 !important;
            padding: 4px 6px !important;
            white-space: normal !important;
            word-break: break-word !important;
            font-size: 10px !important;
            vertical-align: middle !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          h1, .print-title, .title {
            font-size: 28px !important;
            font-weight: 900 !important;
            text-transform: uppercase !important;
            line-height: 1.2 !important;
            margin-bottom: 4px !important;
          }
          .print\\:hidden, th.print\\:hidden, td.print\\:hidden, [class*="print:hidden"] {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}