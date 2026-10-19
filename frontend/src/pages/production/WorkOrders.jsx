import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Printer,
  Square,
  Trash2,
} from "lucide-react";

import Button, { IconButton } from "../../components/common/Button";
import ConfirmationDialog from "../../components/common/ConfirmationDialog";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { SearchBar } from "../../components/common/SearchFilter";
import { operatorJobCardUrl } from "../../utils/jobCardRoutes";
import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import Loader from "../../components/common/Loader";
import StatusBadge from "../../components/common/StatusBadge";
import { calculateProgressPct } from "../../data/productionPlanningMasterData";
import WorkOrderDetailModal, {
  WorkOrderCompleteModal,
  WorkOrderStartModal,
} from "../../components/production/WorkOrderDetailModal";
import QuickWorkOrderModal from "../../components/production/QuickWorkOrderModal";
import IssueMaterialsModal from "../../components/production/IssueMaterialsModal";
import { useToast } from "../../context/ToastContext";
import useManufacturingRefresh from "../../hooks/useManufacturingRefresh";
import useAuth from "../../hooks/useAuth";
import { isOperator } from "../../config/permissions";
import { getMyWorkOrders } from "../../api/operatorExecutionApi";
import {
  completeWorkOrder,
  deleteWorkOrder,
  getWorkOrderDetail,
  getWorkOrders,
  getWorkOrderStartChecks,
  issueWorkOrderMaterials,
  pauseWorkOrder,
  startWorkOrder,
  stopWorkOrder,
  getMachines,
  updateWorkOrder,
} from "../../api/productionApi";
import {
  DEPARTMENTS,
  PRIORITIES,
  WO_STATUSES,
  canWoIssueMaterials,
  canWoPause,
  canWoStart,
  canWoStop,
  computeWorkOrderSummary,
  enrichApiWorkOrder,
  priorityBadge,
  woStatusLabel,
} from "../../data/workOrdersMasterData";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";
import { asArray, apiErrorMessage } from "../../utils/apiError";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";
import { cleanProductLabel } from "../../utils/productLabel";
import "../../styles/manufacturing-toolkit.css";
import "../../styles/work-orders-toolkit.css";

const PAGE_SIZES = [20, 50, 100, 200, 500];

const WO_TOOLKIT_KPIS = [
  { preset: "all", label: "Total Work Orders", tone: "blue", icon: "WO", field: "total_work_orders" },
  { preset: "planned", label: "Planned", tone: "green", icon: "P", field: "planned_orders" },
  { preset: "in_progress", label: "In Progress", tone: "orange", icon: "▶", field: "in_progress_orders" },
  { preset: "completed", label: "Completed", tone: "teal", icon: "✓", field: "completed_orders" },
  { preset: "delayed", label: "Delayed", tone: "red", icon: "!", field: "delayed_orders" },
  { preset: "high_priority", label: "High Priority", tone: "purple", icon: "★", field: "high_priority_orders" },
];

function isServerWoId(id) {
  return typeof id === "number" || (typeof id === "string" && /^\d+$/.test(id));
}

function workOrderSortKey(row) {
  const raw = row?.created_at || row?.created_date || row?.planned_start || row?.planned_end || "";
  if (raw == null || raw === "") return "";
  if (typeof raw === "string") return raw;
  if (raw instanceof Date) return raw.toISOString();
  return String(raw);
}

function compareWorkOrders(a, b) {
  const idA = typeof a.id === "number" ? a.id : Number(String(a.id).replace(/\D/g, "")) || 0;
  const idB = typeof b.id === "number" ? b.id : Number(String(b.id).replace(/\D/g, "")) || 0;
  if (idA && idB && idA !== idB) return idB - idA;
  const dateA = workOrderSortKey(a);
  const dateB = workOrderSortKey(b);
  if (dateA && dateB) return dateB.localeCompare(dateA);
  if (dateB) return 1;
  if (dateA) return -1;
  return 0;
}

function woStatusTone(row) {
  if (row?.is_delayed) return "danger";
  const s = String(row?.status || "").toLowerCase();
  if (s === "completed" || s === "closed" || s === "done") return "success";
  if (s === "running" || s === "in_progress" || s === "started") return "progress";
  if (s === "planned" || s === "draft" || s === "released" || s === "material_ready" || s === "machine_ready") return "pending";
  if (s === "cancelled" || s === "canceled") return "neutral";
  if (s === "paused" || s === "on_hold" || s === "quality_check") return "warning";
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

/** Compact row actions — icon buttons + overflow menu. */
function WoRowActions({
  row,
  onView,
  onIssue,
  onStart,
  onPause,
  onStop,
  onPrint,
  onPdf,
  onDelete,
  canDelete = true,
  issuing,
}) {
  const [open, setOpen] = useState(false);
  const menuBtnRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const serverId = isServerWoId(row.id);
  const canIssue = (r) => canWoIssueMaterials(r.status, r.materials_issued);

  const menuItems = [
    {
      label: "View",
      icon: <Eye className="h-3.5 w-3.5 text-emerald-600" />,
      onClick: () => onView(row),
    },
    serverId && row.job_card_number && operatorJobCardUrl(row)
      ? {
          label: "Job Card",
          icon: <ClipboardList className="h-3.5 w-3.5 text-indigo-600" />,
          to: operatorJobCardUrl(row),
        }
      : null,
    canIssue(row)
      ? {
          label: issuing ? "Issuing…" : "Issue Materials",
          icon: <Boxes className="h-3.5 w-3.5 text-blue-600" />,
          onClick: () => onIssue(row),
          disabled: issuing,
        }
      : null,
    canWoStart(row.status)
      ? {
          label: "Start",
          icon: <Play className="h-3.5 w-3.5 text-teal-600" />,
          onClick: () => onStart(row),
        }
      : null,
    canWoPause(row.status)
      ? {
          label: "Pause",
          icon: <Pause className="h-3.5 w-3.5 text-amber-600" />,
          onClick: () => onPause(row),
        }
      : null,
    canWoStop(row.status)
      ? {
          label: "Stop",
          icon: <Square className="h-3.5 w-3.5 text-rose-600" />,
          onClick: () => onStop(row),
        }
      : null,
    {
      label: "Print",
      icon: <Printer className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />,
      onClick: () => onPrint(row),
    },
    {
      label: "Export PDF",
      icon: <FileText className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />,
      onClick: () => onPdf(row),
    },
    canDelete
      ? {
          label: "Delete",
          icon: <Trash2 className="h-3.5 w-3.5 text-rose-600" />,
          onClick: () => onDelete?.(row),
          isDanger: true,
        }
      : null,
  ].filter(Boolean);

  const updateMenuPosition = () => {
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = menuRef.current?.offsetHeight || menuItems.length * 36 + 16;
    const menuWidth = menuRef.current?.offsetWidth || 192;
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;
    const top = openAbove
      ? Math.max(8, rect.top - menuHeight - gap)
      : Math.min(window.innerHeight - menuHeight - 8, rect.bottom + gap);
    setMenuPos({ top, left: Math.max(8, rect.right - menuWidth) });
  };

  const openMenu = (e) => {
    e?.stopPropagation?.();
    setOpen(true);
    requestAnimationFrame(updateMenuPosition);
  };

  useEffect(() => {
    if (!open) return undefined;
    const reposition = () => updateMenuPosition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    const frame = requestAnimationFrame(reposition);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  return (
    <div className="flex w-full items-center justify-center whitespace-nowrap print:hidden">
      <div className="relative">
        <span ref={menuBtnRef} className="inline-flex">
          <IconButton
            aria-label="Actions"
            title="Actions"
            onClick={openMenu}
          >
            <MoreVertical className="h-4 w-4" />
          </IconButton>
        </span>
        {open
          ? createPortal(
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[80] cursor-default"
                  aria-label="Close menu"
                  onClick={(e) => {
                    e?.stopPropagation?.();
                    setOpen(false);
                  }}
                />
                <div
                  ref={menuRef}
                  className="fixed z-[90] w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
                  style={{ top: menuPos.top, left: menuPos.left }}
                  onClick={(e) => e?.stopPropagation?.()}
                >
                  {menuItems.map((item) =>
                    item.to ? (
                      <Link
                        key={item.label}
                        to={item.to}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
                        onClick={(e) => {
                          e?.stopPropagation?.();
                          setOpen(false);
                        }}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </Link>
                    ) : (
                      <button
                        key={item.label}
                        type="button"
                        disabled={item.disabled}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium hover:bg-[var(--color-surface-muted)] disabled:opacity-50 transition-colors ${
                          item.isDanger ? "text-rose-600 hover:text-rose-700" : "text-[var(--color-text)]"
                        }`}
                        onClick={(e) => {
                          e?.stopPropagation?.();
                          setOpen(false);
                          item.onClick?.();
                        }}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    )
                  )}
                </div>
              </>,
              document.body
            )
          : null}
      </div>
    </div>
  );
}


const defaultFilters = {
  search: "",
  work_order_number: "",
  production_order: "",
  product: "",
  customer: "",
  machine: "",
  operator: "",
  department: "",
  shift: "",
  priority: "",
  status: "",
  date_from: "",
  date_to: "",
  delayed: false,
  preset: "all",
};

function formatDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  return isNaN(d.getTime())
    ? String(val).slice(0, 10)
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function workOrderExportStatus(row) {
  const status = woStatusLabel(row.status);
  return row.is_delayed ? `${status} (Delayed)` : status;
}

function workOrderExportAssignment(row) {
  return [row.machine_name, row.operator_name]
    .filter((value) => value && value !== "—" && value !== "Unassigned")
    .join(" / ") || "—";
}

// Statuses that count as "pending" (i.e. not yet completed)
const PENDING_VIEW_STATUSES = new Set([
  "planned", "draft", "released", "material_ready", "machine_ready",
  "running", "in_progress", "paused", "quality_check",
]);

export default function WorkOrders() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const poFilter = searchParams.get("production_order_id");
  // view=pending → show only non-completed orders (from Pending Orders dashboard widget)
  const pendingView = searchParams.get("view") === "pending";
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [startModal, setStartModal] = useState(null);
  const [startChecks, setStartChecks] = useState([]);
  const [startLoading, setStartLoading] = useState(false);
  const [completeModal, setCompleteModal] = useState(null);
  const [completeSteps, setCompleteSteps] = useState([]);
  const [issuingId, setIssuingId] = useState(null);
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [issueModalOrder, setIssueModalOrder] = useState(null);
  const resumeStartAfterIssue = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // State to track which single work order is being printed
  const [printDetailWorkOrder, setPrintDetailWorkOrder] = useState(null);

  // Clean up print state after printing dialog closes
  useEffect(() => {
    const handleAfterPrint = () => setPrintDetailWorkOrder(null);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const label = deleteTarget.work_order_number || deleteTarget.id;
    try {
      const serverId = isServerWoId(deleteTarget.id);
      if (serverId) {
        await deleteWorkOrder(deleteTarget.id);
        notifyManufacturingSpine(MANUFACTURING_EVENTS.WORK_ORDER_UPDATED, {
          workOrderId: deleteTarget.id,
        });
      }
      setWorkOrders((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) {
        setSelected(null);
      }
      addToast(`Work Order ${label} deleted successfully.`, "success");
      setDeleteTarget(null);
      if (serverId) {
        load();
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      addToast(
        typeof detail === "string" ? detail : `Failed to delete Work Order ${label}.`,
        "error"
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const poId = poFilter ? Number(poFilter) : undefined;
      const operatorView = isOperator(user);
      const wRes = operatorView ? await getMyWorkOrders() : await getWorkOrders(poId);
      const apiRows = operatorView ? (wRes.data?.items || []) : asArray(wRes?.data);
      const enriched = apiRows.map((r, i) => enrichApiWorkOrder(r, i));
      enriched.sort(compareWorkOrders);
      setWorkOrders(enriched);
      setSelected((prev) => {
        if (!prev?.id) return prev;
        return enriched.find((w) => w.id === prev.id) || prev;
      });
    } catch (e) {
      setWorkOrders([]);
      const detail = e?.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : e?.message && !String(e.message).includes("localeCompare")
            ? e.message
            : "Could not load work orders";
      addToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [poFilter, addToast]);

  const [machines, setMachines] = useState([]);

  useEffect(() => {
    getMachines()
      .then((res) => setMachines(asArray(res?.data)))
      .catch(() => setMachines([]));
  }, []);

  const handleMachineChange = async (workOrderId, machineId) => {
    const numId = machineId ? Number(machineId) : null;
    const selectedM = machines.find((m) => String(m.id) === String(machineId));
    const mName = selectedM ? (selectedM.name || selectedM.code) : (machineId ? `Machine #${machineId}` : "Unassigned");

    setWorkOrders((prev) =>
      prev.map((w) => {
        if (w.id === workOrderId || w.work_order_number === workOrderId) {
          return { ...w, machine_id: numId, machine_name: mName };
        }
        return w;
      })
    );

    const numericWoId = typeof workOrderId === "number" ? workOrderId : Number(workOrderId);
    if (Number.isFinite(numericWoId) && numericWoId > 0) {
      try {
        await updateWorkOrder(numericWoId, null, { machine_id: numId });
        notifyManufacturingSpine(MANUFACTURING_EVENTS.WORK_ORDER_UPDATED, {
          workOrderId: numericWoId,
          machineId: numId,
        });
        addToast(numId ? `Machine (${mName}) assigned to work order` : "Machine unassigned", "success");
      } catch (e) {
        addToast(e?.response?.data?.detail || "Could not save machine assignment", "error");
        load();
      }
      return;
    }

    addToast(numId ? `Machine (${mName}) assigned locally` : "Machine unassigned", "success");
  };

  useEffect(() => { load(); }, [load]);
  useManufacturingRefresh(load);

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({ ...filters });
    setPage(1);
  }, [filters]);

  const handleClearFilters = useCallback(() => {
    setFilters({ ...defaultFilters });
    setAppliedFilters({ ...defaultFilters });
    setSearchParams({});
    setPage(1);
  }, [setSearchParams]);

  const applyWorkOrderPreset = (preset) => {
    if (preset === "all") {
      handleClearFilters();
      setShowAdvanced(false);
      return;
    }
    if (preset === "delayed") {
      const updated = { ...defaultFilters, preset: "delayed", delayed: true };
      setFilters(updated);
      setAppliedFilters(updated);
      setShowAdvanced(false);
      setPage(1);
      return;
    }
    if (preset === "high_priority") {
      const updated = { ...defaultFilters, preset: "high_priority", priority: "high" };
      setFilters(updated);
      setAppliedFilters(updated);
      setShowAdvanced(false);
      setPage(1);
      return;
    }
    const updated = { ...defaultFilters, preset, status: preset };
    setFilters(updated);
    setAppliedFilters(updated);
    setShowAdvanced(false);
    setPage(1);
  };

  const filtered = useMemo(() => {
    return workOrders.filter((w) => {
      // When navigated from Pending Orders widget, only show non-completed orders
      if (pendingView && !PENDING_VIEW_STATUSES.has(w.status)) return false;
      if (poFilter && String(w.production_order_id) !== poFilter) return false;
      if (appliedFilters.search) {
        const q = appliedFilters.search.toLowerCase();
        const hay = [
          w.work_order_number,
          w.production_order_number,
          w.order_number,
          w.product_name,
          w.customer_name,
          w.machine_name,
          w.operator_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (
        appliedFilters.work_order_number &&
        !String(w.work_order_number || w.id || "")
          .toLowerCase()
          .includes(appliedFilters.work_order_number.toLowerCase())
      ) {
        return false;
      }
      if (
        appliedFilters.production_order &&
        !String(w.production_order_number || w.production_order_id || "")
          .toLowerCase()
          .includes(appliedFilters.production_order.toLowerCase())
      ) {
        return false;
      }
      if (
        appliedFilters.product &&
        !String(w.product_name || w.item_name || "")
          .toLowerCase()
          .includes(appliedFilters.product.toLowerCase())
      ) {
        return false;
      }
      if (
        appliedFilters.customer &&
        !String(w.customer_name || w.customer || "")
          .toLowerCase()
          .includes(appliedFilters.customer.toLowerCase())
      ) {
        return false;
      }
      if (
        appliedFilters.machine &&
        !String(w.machine_name || w.machine || "")
          .toLowerCase()
          .includes(appliedFilters.machine.toLowerCase())
      ) {
        return false;
      }
      if (
        appliedFilters.operator &&
        !String(w.operator_name || w.operator || "")
          .toLowerCase()
          .includes(appliedFilters.operator.toLowerCase())
      ) {
        return false;
      }
      if (
        appliedFilters.department &&
        String(w.department || "").toLowerCase() !== appliedFilters.department.toLowerCase()
      ) {
        return false;
      }
      if (appliedFilters.shift) {
        const shiftVal = typeof w.shift === "object" ? (w.shift?.id || w.shift?.label || "") : String(w.shift || "");
        if (shiftVal.toLowerCase() !== appliedFilters.shift.toLowerCase()) return false;
      }
      if (
        appliedFilters.priority &&
        String(w.priority || "").toLowerCase() !== appliedFilters.priority.toLowerCase()
      ) {
        return false;
      }
      if (appliedFilters.delayed && !w.is_delayed) {
        return false;
      }
      if (appliedFilters.status) {
        const targetStatus = appliedFilters.status.toLowerCase();
        const rowStatus = String(w.status || "").toLowerCase();
        if (targetStatus === "completed" || targetStatus === "closed" || targetStatus === "done") {
          if (!["completed", "closed", "done"].includes(rowStatus)) return false;
        } else if (targetStatus === "in_progress" || targetStatus === "running") {
          if (!["in_progress", "running"].includes(rowStatus)) return false;
        } else if (targetStatus === "planned" || targetStatus === "draft" || targetStatus === "pending") {
          if (!["planned", "draft", "pending", "material_ready", "machine_ready"].includes(rowStatus)) return false;
        } else if (rowStatus !== targetStatus) {
          return false;
        }
      }
      return true;
    });
  }, [workOrders, appliedFilters, poFilter, pendingView]);

  useEffect(() => {
    setPage(1);
  }, [appliedFilters, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const paginatedWorkOrders = useMemo(() => {
    return filtered.slice((page - 1) * pageSize, page * pageSize);
  }, [filtered, page, pageSize]);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Always use the locally-enriched list to compute summary counts.
  // The backend API summary uses raw DB status (e.g. "running") which can
  // differ from the enriched status on the frontend (e.g. "completed" when
  // produced >= planned). Using the enriched list keeps the summary cards
  // in sync with what is shown in the table.
  const summary = useMemo(() => computeWorkOrderSummary(workOrders), [workOrders]);

  const fetchWoDetail = useCallback(async (wo) => {
    if (typeof wo?.id !== "number") {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await getWorkOrderDetail(wo.id);
      setDetail(enrichApiWorkOrder(res.data));
    } catch (e) {
      setDetail(null);
      const msg = apiErrorMessage(e, "Could not load work order details");
      setDetailError(msg);
      addToast(msg, "error");
    } finally {
      setDetailLoading(false);
    }
  }, [addToast]);

  const openWo = async (wo) => {
    setSelected(wo);
    setDetail(null);
    await fetchWoDetail(wo);
  };

  const handleStartClick = async (wo) => {
    if (typeof wo.id === "number") {
      try {
        const res = await getWorkOrderStartChecks(wo.id);
        setStartChecks(res.data || []);
        setStartModal(wo);
        return;
      } catch {
        addToast("Could not load checks", "error");
        return;
      }
    }
    setStartChecks([
      { check_type: "production_order", label: "Production Order Ready", ready: true, message: "Production Order linked & ready" },
      { check_type: "material", label: "Material Issued", ready: true, message: "Materials ready" },
      { check_type: "machine", label: "Machine Ready", ready: !!wo.machine_name && wo.machine_name !== "—", message: wo.machine_name && wo.machine_name !== "—" ? `Machine: ${wo.machine_name}` : "No machine assigned" },
      { check_type: "operator", label: "Operator Assigned", ready: !!wo.operator_name && wo.operator_name !== "—", message: wo.operator_name && wo.operator_name !== "—" ? `Operator: ${wo.operator_name}` : "No operator assigned" },
    ]);
    setStartModal(wo);
  };

  const confirmStart = async () => {
    const wo = startModal;
    if (!wo) return;
    setStartLoading(true);
    if (typeof wo.id === "number") {
      try {
        const res = await startWorkOrder(wo.id);
        if (res.data?.success) {
          addToast("Work order started");
          load();
          setStartModal(null);
          setSelected(null);
        } else {
          setStartChecks(res.data?.checks || []);
          addToast(res.data?.message || "Start failed", "error");
        }
      } catch {
        addToast("Start failed", "error");
      } finally {
        setStartLoading(false);
      }
      return;
    }
    setWorkOrders((prev) => prev.map((w) => (w.id === wo.id ? { ...w, status: "running", machine_status: "running" } : w)));
    addToast("Work order started");
    setStartModal(null);
    setStartLoading(false);
  };

  const handlePause = async (wo) => {
    const label = wo.work_order_number || wo.id;
    if (typeof wo.id === "number") {
      try {
        await pauseWorkOrder(wo.id);
        addToast(`Paused ${label}`, "success");
        load();
      } catch { addToast(`Pause failed for ${label}`, "error"); }
      return;
    }
    setWorkOrders((prev) => prev.map((w) => (w.id === wo.id ? { ...w, status: "paused" } : w)));
    addToast(`Paused ${label}`, "success");
  };

  const handleStop = async (wo) => {
    const label = wo.work_order_number || wo.id;
    if (typeof wo.id === "number") {
      try {
        await stopWorkOrder(wo.id);
        addToast(`Stopped ${label}`, "success");
        load();
      } catch { addToast(`Stop failed for ${label}`, "error"); }
      return;
    }
    setWorkOrders((prev) => prev.map((w) => (w.id === wo.id ? { ...w, status: "planned", machine_status: "idle" } : w)));
    addToast(`Stopped ${label}`, "success");
  };

  const handleIssueMaterials = (wo) => {
    setIssueModalOrder(wo);
  };

  const handleIssueMaterialsFromStart = (wo) => {
    resumeStartAfterIssue.current = wo;
    setStartModal(null);
    setIssueModalOrder(wo);
  };

  const handleIssueMaterialsSuccess = async (wo) => {
    await load();
    const resumeOrder = resumeStartAfterIssue.current;
    if (!resumeOrder || resumeOrder.id !== wo?.id) return;
    resumeStartAfterIssue.current = null;
    try {
      const res = await getWorkOrderStartChecks(wo.id);
      setStartChecks(res.data || []);
      setStartModal(resumeOrder);
    } catch {
      addToast("Materials were issued, but start checks could not be refreshed. Reopen Start to continue.", "error");
    }
  };

  const handleComplete = async (wo) => {
    if (typeof wo.id === "number") {
      try {
        const res = await completeWorkOrder(wo.id);
        if (res.data?.success) {
          setCompleteSteps(res.data.steps || []);
          setCompleteModal(wo);
          addToast("Completed — inventory, QC, and production updated");
          notifyManufacturingSpine(MANUFACTURING_EVENTS.WORK_ORDER_COMPLETED, {
            workOrderId: wo.id,
            steps: res.data.steps,
          });
          load();
          setSelected(null);
        } else {
          addToast(res.data?.message || "Complete failed", "error");
        }
      } catch (err) {
        const msg = err?.response?.data?.detail || "Complete failed";
        addToast(typeof msg === "string" ? msg : "Complete failed", "error");
      }
      return;
    }
    addToast("Complete requires a saved work order", "error");
  };

  const handleGlobalPrint = () => {
    setPrintDetailWorkOrder(null);
    setTimeout(() => window.print(), 100);
  };

  const handleIndividualPrint = (wo) => {
    setPrintDetailWorkOrder(wo);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintDetailWorkOrder(null), 500);
    }, 150);
  };

  const handlePrintRow = (r) => {
    handleIndividualPrint(r);
  };

  const exportCols = [
    { key: "work_order_number", label: "Work Order", pdfLabel: "Work Order", pdfWidth: 27, render: (row) => row.work_order_number || "—" },
    { key: "production_order_number", label: "Production Order", pdfLabel: "Production Order", pdfWidth: 30, render: (row) => row.production_order_number || "—" },
    { key: "product_name", label: "Product", pdfWidth: 34, render: (row) => cleanProductLabel(row.product_name) || "—" },
    { key: "customer_name", label: "Customer", pdfWidth: 26, render: (row) => row.customer_name || "—" },
    { key: "status", label: "Status", pdfWidth: 20, render: workOrderExportStatus, pdfValue: workOrderExportStatus },
    { key: "planned_quantity", label: "Planned Qty", pdfWidth: 17, pdfAlign: "right" },
    { key: "produced_quantity", label: "Produced Qty", pdfWidth: 17, pdfAlign: "right", render: (row) => Number(row.produced_quantity ?? row.actual_quantity ?? 0), pdfValue: (row) => Number(row.produced_quantity ?? row.actual_quantity ?? 0) },
    { key: "remaining_quantity", label: "Remaining Qty", pdfWidth: 18, pdfAlign: "right", render: (row) => Number(row.remaining_quantity ?? Math.max(Number(row.planned_quantity || 0) - Number(row.produced_quantity ?? row.actual_quantity ?? 0), 0)), pdfValue: (row) => Number(row.remaining_quantity ?? Math.max(Number(row.planned_quantity || 0) - Number(row.produced_quantity ?? row.actual_quantity ?? 0), 0)) },
    { key: "priority", label: "Priority", pdfWidth: 17, render: (row) => String(row.priority || "Medium").replace(/^./, (letter) => letter.toUpperCase()) },
    { key: "planned_end", label: "Due Date", pdfWidth: 21, render: (row) => formatDate(row.planned_end || row.planned_start), pdfValue: (row) => formatDate(row.planned_end || row.planned_start) },
    { key: "machine_name", label: "Machine", pdfWidth: 26, render: (row) => row.machine_name || "Unassigned" },
    { key: "operator_name", label: "Operator", pdfWidth: 24, render: (row) => row.operator_name || "—" },
  ];

  const columns = [
    {
      key: "work_order_number",
      label: "Work Order",
      width: "15rem",
      minWidth: "15rem",
      render: (r) => (
        <div className="min-w-0 max-w-full overflow-hidden">
          <p className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold tabular-nums text-[var(--color-text)]" title={r.work_order_number || "—"}>{r.work_order_number || "—"}</p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]" title={r.production_order_number || undefined}>
            {r.production_order_number ? `PO ${r.production_order_number}` : "No production order"}
          </p>
          {r.job_card_number && operatorJobCardUrl(r) ? (
            <Link
              to={operatorJobCardUrl(r)}
              className="mt-1 inline-flex max-w-full truncate rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100"
              title={`Job card ${r.job_card_number}`}
            >
              Job card: {r.job_card_number}
            </Link>
          ) : null}
        </div>
      ),
    },
    {
      key: "product_name",
      label: "Product",
      width: "15rem",
      minWidth: "15rem",
      render: (r) => {
        const product = cleanProductLabel(r.product_name);
        const machine =
          r.machine_name && r.machine_name !== "—" && r.machine_name !== "Unassigned" ? r.machine_name : "";
        const customer = r.customer_name && r.customer_name !== "—" ? r.customer_name : "";
        const operator = r.operator_name && r.operator_name !== "—" ? r.operator_name : "";
        const meta = [customer, machine || "No machine", operator].filter(Boolean).join(" · ");
        return (
          <div className="max-w-[220px]">
            <p className="truncate text-[13px] font-medium text-[var(--color-text)]" title={product}>
              {product}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]" title={meta}>
              {meta}
            </p>
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      width: "9rem",
      minWidth: "9rem",
      render: (r) => (
        <div className="flex min-w-[8rem] flex-col items-start gap-1">
          <div className="flex flex-wrap items-center gap-1">
            <StatusBadge tone={woStatusTone({ ...r, is_delayed: false })}>
              {woStatusLabel(r.status)}
            </StatusBadge>
            {r.is_delayed ? <StatusBadge tone="danger">Delayed</StatusBadge> : null}
          </div>
          {r.materials_issued ? (
            <span className="text-[10px] font-semibold text-emerald-700">Materials issued</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "planned_quantity",
      label: "Qty",
      align: "center",
      className: "work-orders-qty-column",
      width: "9rem",
      minWidth: "9rem",
      render: (r) => {
        const planned = Number(r.planned_quantity || 0);
        const produced = Number(r.produced_quantity ?? r.actual_quantity ?? 0);
        const remaining = r.remaining_quantity ?? Math.max(planned - produced, 0);
        return (
          <div className="w-full whitespace-nowrap text-center tabular-nums">
            <p className="text-[13px] font-semibold text-[var(--color-text)]">{planned}</p>
            <p className="text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
              {produced} done · {remaining} left
            </p>
          </div>
        );
      },
    },
    {
      key: "priority",
      label: "Priority",
      width: "8rem",
      minWidth: "8rem",
      render: (r) => <PriorityPill priority={r.priority} />,
    },
    {
      key: "progress",
      label: "Progress",
      sortable: false,
      width: "9rem",
      minWidth: "9rem",
      render: (r) => <ProgressCell row={r} />,
    },
    {
      key: "planned_end",
      label: "Due",
      width: "7rem",
      minWidth: "7rem",
      render: (r) => (
        <span className="whitespace-nowrap text-[12px] tabular-nums text-[var(--color-text-secondary)]">
          {formatDate(r.planned_end || r.planned_start)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      className: "text-center",
      sortable: false,
      printHidden: true,
      width: "4.5rem",
      minWidth: "4.5rem",
      render: (r) => (
        <WoRowActions
          row={r}
          onView={openWo}
          onIssue={handleIssueMaterials}
          onStart={handleStartClick}
          onPause={handlePause}
          onStop={handleStop}
          onPrint={handlePrintRow}
          onPdf={(row) => exportToPdf([row], exportCols, `WO ${row.work_order_number}`, row.work_order_number)}
          onDelete={(row) => setDeleteTarget(row)}
          canDelete={!isOperator(user)}
          issuing={issuingId === r.id}
        />
      ),
    },
  ];

  const toolkitHero = (
    <header className="mtk-hero">
      <div className="mtk-hero__row">
        <span>Plan Work · Assign Resources · Track Completion</span>
      </div>
      <div className="mtk-hero__title">
        <h1>WORK ORDERS</h1>
        <p style={{ fontSize: 10, opacity: 0.9, margin: 0 }}>
          Manufacturing Production Planning &amp; Factory Control Toolkit
        </p>
      </div>
    </header>
  );

  const toolkitKpiRow = (
    <div className="mtk-kpi-row" aria-label="Work order summary KPIs">
      {WO_TOOLKIT_KPIS.map((kpi) => (
        <button
          key={kpi.preset}
          type="button"
          className="mtk-kpi mtk-kpi--button"
          onClick={() => applyWorkOrderPreset(kpi.preset)}
          title={`Show ${kpi.label.toLowerCase()}`}
        >
          <div className={`mtk-kpi__icon mtk-kpi__icon--${kpi.tone}`}>{kpi.icon}</div>
          <div className="mtk-kpi__label">{kpi.label}</div>
          <div className="mtk-kpi__value">{summary[kpi.field] ?? 0}</div>
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="work-orders-page work-orders-page--toolkit min-h-full">
        <div className="mtk-root mtk-theme--teal">
          {toolkitHero}
          <div className="mtk-body work-orders-loading">
            <Loader label="Loading work orders..." />
          </div>
        </div>
      </div>
    );
  }

  const handleListExport = (format) => {
    if (format === "pdf") {
      exportToPdf(filtered, exportCols, "Work Orders Report", "work-orders", {
        variant: "production-work-orders",
        landscape: true,
      });
    } else {
      exportToExcel(filtered, exportCols, "work-orders");
    }
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <>
      <div
        className={`work-orders-page work-orders-page--toolkit min-h-full min-w-0 w-full print:hidden ${
          printDetailWorkOrder ? "hidden" : ""
        }`}
      >
        <div className="mtk-root mtk-theme--teal">
          {toolkitHero}
          {toolkitKpiRow}
          <div className="mtk-body min-w-0">
            {pendingView && (
              <div className="work-orders-pending-banner flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-warning)] text-white text-xs font-bold">
                    {filtered.length}
                  </span>
                  <span className="font-semibold text-[var(--color-warning)]">Pending Orders</span>
                  <span className="text-[var(--color-warning)]">
                    — showing only <strong>Planned</strong> and <strong>In Progress</strong> work orders
                  </span>
                </div>
                <Button variant="secondary" to="/production/work-orders">
                  View All Orders
                </Button>
              </div>
            )}

            <section className="mtk-panel min-w-0">
              <div className="mtk-panel__title">Work Orders</div>

              <div className="work-orders-panel__toolbar">
                <SearchBar
                  value={filters.search}
                  onChange={(val) => {
                    setFilters((f) => ({ ...f, search: val }));
                    setAppliedFilters((f) => ({ ...f, search: val }));
                  }}
                  placeholder="Search"
                  className="w-full max-w-md"
                />
                <div className="work-orders-panel__toolbar-end">
                  <Button variant="secondary" size="sm" type="button" onClick={() => setShowAdvanced(!showAdvanced)}>
                    {showAdvanced ? "Hide Filters" : "Filters"}
                  </Button>
                  <ExportDownloadMenu size="sm" disabled={!filtered.length} onExport={handleListExport} />
                  <Button variant="secondary" size="sm" type="button" onClick={handleGlobalPrint} title="Print">
                    <Printer className="h-4 w-4" />
                    <span className="hidden sm:inline">Print</span>
                  </Button>
                  {!isOperator(user) && (
                    <Button
                      variant="add"
                      size="sm"
                      type="button"
                      onClick={() => setShowQuickModal(true)}
                      leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
                    >
                      New Work Order
                    </Button>
                  )}
                </div>
              </div>

              {showAdvanced && (
                <div className="work-orders-filters">
                  <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="block min-w-0 text-xs font-medium text-[var(--color-text-muted)]">
                      Department
                      <select
                        value={filters.department}
                        onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
                        className="ui-select mt-1 w-full"
                      >
                        <option value="">All departments</option>
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block min-w-0 text-xs font-medium text-[var(--color-text-muted)]">
                      Priority
                      <select
                        value={filters.priority}
                        onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
                        className="ui-select mt-1 w-full"
                      >
                        <option value="">All priorities</option>
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block min-w-0 text-xs font-medium text-[var(--color-text-muted)]">
                      Status
                      <select
                        value={filters.status}
                        onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                        className="ui-select mt-1 w-full"
                      >
                        <option value="">All statuses</option>
                        {WO_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {woStatusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="primary" size="sm" type="button" onClick={handleApplyFilters}>
                      Apply Filters
                    </Button>
                    <Button variant="secondary" size="sm" type="button" onClick={handleClearFilters}>
                      Clear
                    </Button>
                  </div>
                </div>
              )}

              <div className="work-orders-mobile md:hidden">
                {paginatedWorkOrders.length === 0 ? (
                  <EmptyState
                    icon="document"
                    title="No records found."
                    description="There is nothing to show here yet."
                    className="border-none bg-transparent py-12"
                  />
                ) : (
                  paginatedWorkOrders.map((r) => {
                    const product = cleanProductLabel(r.product_name);
                    const planned = Number(r.planned_quantity || 0);
                    const produced = Number(r.produced_quantity ?? r.actual_quantity ?? 0);
                    const pct = planned > 0 ? Math.min(Math.round((produced / planned) * 100), 100) : 0;
                    return (
                      <div
                        key={r.id || r.work_order_number}
                        className="ui-card mb-3 p-3.5 space-y-2.5 transition hover:border-[var(--color-primary-soft)]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-[var(--color-primary)]">
                                {r.work_order_number || "—"}
                              </span>
                              <StatusBadge tone={woStatusTone({ ...r, is_delayed: false })}>
                                {woStatusLabel(r.status)}
                              </StatusBadge>
                              {r.is_delayed ? <StatusBadge tone="danger">Delayed</StatusBadge> : null}
                              <PriorityPill priority={r.priority} />
                            </div>
                            {r.production_order_number && (
                              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                                PO: {r.production_order_number}
                              </p>
                            )}
                            <h3 className="mt-1 font-semibold text-xs sm:text-sm text-[var(--color-text)] truncate">
                              {product}
                            </h3>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <WoRowActions
                              row={r}
                              onView={openWo}
                              onIssue={handleIssueMaterials}
                              onStart={handleStartClick}
                              onPause={handlePause}
                              onStop={handleStop}
                              onPrint={handlePrintRow}
                              onPdf={(row) =>
                                exportToPdf([row], exportCols, `WO ${row.work_order_number}`, row.work_order_number)
                              }
                              onDelete={(row) => setDeleteTarget(row)}
                              canDelete={!isOperator(user)}
                              issuing={issuingId === r.id}
                            />
                          </div>
                        </div>
                        <div className="space-y-1 rounded-lg bg-[var(--color-surface-muted)] p-2.5 text-xs">
                          <div className="flex items-center justify-between font-medium">
                            <span className="text-[var(--color-text-muted)]">Production Progress</span>
                            <span className="font-bold text-[var(--color-text)]">
                              {pct}% ({produced}/{planned})
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-blue-500" : "bg-slate-400"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs border-t border-[var(--color-border-soft)] pt-2 text-[var(--color-text-secondary)]">
                          <div>
                            <span className="text-[var(--color-text-muted)] text-[10px] block uppercase font-semibold">
                              Machine
                            </span>
                            <span className="font-medium truncate block">{r.machine_name || "—"}</span>
                          </div>
                          <div>
                            <span className="text-[var(--color-text-muted)] text-[10px] block uppercase font-semibold">
                              Operator
                            </span>
                            <span className="font-medium truncate block">{r.operator_name || "—"}</span>
                          </div>
                          <div>
                            <span className="text-[var(--color-text-muted)] text-[10px] block uppercase font-semibold">
                              Due Date
                            </span>
                            <span className="font-medium">{formatDate(r.planned_end || r.planned_start)}</span>
                          </div>
                          <div>
                            <span className="text-[var(--color-text-muted)] text-[10px] block uppercase font-semibold">
                              Customer
                            </span>
                            <span className="font-medium truncate block">{r.customer_name || "—"}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border-soft)] pt-2">
                          {canWoStart(r.status) && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleStartClick(r)}
                              leftIcon={<Play className="h-3.5 w-3.5" />}
                            >
                              Start
                            </Button>
                          )}
                          {canWoPause(r.status) && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handlePause(r)}
                              leftIcon={<Pause className="h-3.5 w-3.5 text-amber-600" />}
                            >
                              Pause
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openWo(r)}
                            leftIcon={<Eye className="h-3.5 w-3.5" />}
                          >
                            Details
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="hidden md:block">
                <DataTable
                  columns={columns}
                  data={paginatedWorkOrders}
                  wrapClassName="work-orders-table__wrap mtk-table-wrap"
                  tableClassName="mtk-table work-orders-table"
                  showSearch={false}
                  showPagination={false}
                  emptyState={
                    <EmptyState
                      icon="document"
                      title="No records found."
                      description="There is nothing to show here yet."
                      className="border-none bg-transparent py-12"
                    />
                  }
                />
              </div>

              <div className="work-orders-pagination ui-pagination justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap text-xs sm:text-[13px]">
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
                  <span>{total === 0 ? "0–0 of 0" : `${from}–${to} of ${total}`}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="ui-page-btn"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button type="button" className="ui-page-btn ui-page-btn--active">
                    {page}
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="ui-page-btn"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className={`min-w-0 w-full print:p-0 ${printDetailWorkOrder ? "hidden print:block" : "hidden print:block"}`}>
        <div className="mb-4 hidden border-b pb-4 print:block print-header-container">
          <div className="flex justify-between items-center mb-2 text-xs text-slate-600 print-header-top">
            <span className="font-bold text-blue-600 text-xs tracking-wide">Production · Work Orders</span>
            <span className="font-bold text-blue-600 text-xs tracking-wide">Insights Iva</span>
          </div>
          <h1 className="text-xl font-bold text-black print-header-title">Work Orders Report</h1>
          <p className="text-xs text-slate-600 mt-1 print-header-meta">
            Generated on: {new Date().toLocaleDateString("en-GB")} | Total Work Orders: {filtered.length}
            {(user?.full_name || user?.name) ? ` | Printed By: ${user.full_name || user.name}` : ""}
          </p>
        </div>

        <div className="hidden print:block work-orders-print-report">
          <table>
            <thead>
              <tr>
                <th>Work Order</th>
                <th>Production Order</th>
                <th>Product</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Planned Qty</th>
                <th>Produced Qty</th>
                <th>Remaining Qty</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Machine</th>
                <th>Operator</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id || row.work_order_number}>
                  <td>{row.work_order_number || "—"}</td>
                  <td>{row.production_order_number || "—"}</td>
                  <td>{cleanProductLabel(row.product_name) || "—"}</td>
                  <td>{row.customer_name || "—"}</td>
                  <td>{workOrderExportStatus(row)}</td>
                  <td>{Number(row.planned_quantity || 0)}</td>
                  <td>{Number(row.produced_quantity ?? row.actual_quantity ?? 0)}</td>
                  <td>{Number(row.remaining_quantity ?? Math.max(Number(row.planned_quantity || 0) - Number(row.produced_quantity ?? row.actual_quantity ?? 0), 0))}</td>
                  <td>{row.priority || "Medium"}</td>
                  <td>{formatDate(row.planned_end || row.planned_start)}</td>
                  <td>{row.machine_name || "Unassigned"}</td>
                  <td>{row.operator_name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Single Item Print View */}
      {printDetailWorkOrder && (
        <div className="hidden print:block p-8 bg-white text-black h-screen">
          <div className="flex justify-between items-center mb-5 text-xs text-slate-600">
            <div>
              <span className="font-bold text-blue-600 text-xs tracking-wide">Production</span>
              {(user?.full_name || user?.name) && <span className="ml-2.5 text-slate-600">Welcome, {user.full_name || user.name}</span>}
            </div>
            <span className="font-bold text-blue-600 text-xs tracking-wide">Insights Iva</span>
          </div>
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <h1 className="print-title text-4xl font-black uppercase tracking-wide text-black">Work Order Details</h1>
            <p className="text-sm text-slate-500 mt-1">Order # {printDetailWorkOrder.work_order_number} | Printed on {new Date().toLocaleDateString()} {(user?.full_name || user?.name) ? `| By: ${user.full_name || user.name}` : ""}</p>
          </div>

          <div className="grid grid-cols-2 gap-y-6 gap-x-12 mb-8">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Product Information</p>
              <p className="text-xl font-bold text-slate-900">{cleanProductLabel(printDetailWorkOrder.product_name) || "—"}</p>
              {printDetailWorkOrder.production_order_number && (
                <p className="text-sm text-slate-700 mt-1">Production Order: {printDetailWorkOrder.production_order_number}</p>
              )}
              {printDetailWorkOrder.department && (
                <p className="text-sm text-slate-700 mt-0.5">Department: {printDetailWorkOrder.department}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Customer</p>
              <p className="text-lg font-medium text-slate-800">{printDetailWorkOrder.customer_name || "Internal"}</p>
            </div>

            <div className="col-span-2 border-t border-slate-200 pt-6"></div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Priority & Status</p>
              <div className="flex items-center gap-4 mt-1">
                <PriorityPill priority={printDetailWorkOrder.priority} />
                <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize border border-slate-300">
                  {woStatusLabel(printDetailWorkOrder.status)}
                </span>
                {printDetailWorkOrder.is_delayed ? (
                  <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border border-red-300 text-red-700 bg-red-50">Delayed</span>
                ) : null}
                {printDetailWorkOrder.materials_issued ? (
                  <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-300 bg-emerald-50">
                    Materials Issued
                  </span>
                ) : null}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Production Quantities</p>
              <div className="grid grid-cols-3 gap-4 mt-1">
                <div>
                  <span className="block text-xl font-bold">{printDetailWorkOrder.planned_quantity || 0}</span>
                  <span className="text-xs text-slate-500">Planned</span>
                </div>
                <div>
                  <span className="block text-xl font-bold">{printDetailWorkOrder.produced_quantity ?? printDetailWorkOrder.actual_quantity ?? 0}</span>
                  <span className="text-xs text-slate-500">Produced</span>
                </div>
                <div>
                  <span className="block text-xl font-bold">
                    {printDetailWorkOrder.remaining_quantity ?? Math.max((printDetailWorkOrder.planned_quantity || 0) - (printDetailWorkOrder.produced_quantity ?? printDetailWorkOrder.actual_quantity ?? 0), 0)}
                  </span>
                  <span className="text-xs text-slate-500">Remaining</span>
                </div>
              </div>
            </div>

            <div className="col-span-2 border-t border-slate-200 pt-6"></div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Schedule</p>
              <p className="text-sm"><span className="font-medium">Start:</span> {formatDate(printDetailWorkOrder.planned_start || printDetailWorkOrder.start_date)}</p>
              <p className="text-sm mt-1"><span className="font-medium">Due:</span> {formatDate(printDetailWorkOrder.planned_end || printDetailWorkOrder.due_date)}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Assignment</p>
              <p className="text-sm"><span className="font-medium">Machine:</span> {printDetailWorkOrder.machine_name || "Unassigned"}</p>
              <p className="text-sm mt-1"><span className="font-medium">Operator:</span> {printDetailWorkOrder.operator_name || "—"}</p>
              <p className="text-sm mt-1"><span className="font-medium">Shift:</span> {typeof printDetailWorkOrder.shift === "object" ? (printDetailWorkOrder.shift?.label || printDetailWorkOrder.shift?.id || "—") : (printDetailWorkOrder.shift || "—")}</p>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <WorkOrderDetailModal
          workOrder={selected}
          detail={detail}
          detailLoading={detailLoading}
          detailError={detailError}
          onClose={() => { setSelected(null); setDetail(null); setDetailError(null); }}
          onIssueMaterials={handleIssueMaterials}
          issuing={issuingId === selected.id}
          onStart={handleStartClick}
          onPause={handlePause}
          onStop={handleStop}
          onComplete={handleComplete}
        />
      )}

      {startModal && (
        <WorkOrderStartModal
          workOrder={startModal}
          checks={startChecks}
          onClose={() => setStartModal(null)}
          onConfirm={confirmStart}
          onIssueMaterials={handleIssueMaterialsFromStart}
          loading={startLoading}
        />
      )}

      {completeModal && (
        <WorkOrderCompleteModal workOrder={completeModal} steps={completeSteps} onClose={() => setCompleteModal(null)} />
      )}

      {showQuickModal && (
        <QuickWorkOrderModal
          onClose={() => setShowQuickModal(false)}
          onSuccess={() => load()}
          addToast={addToast}
        />
      )}

      {issueModalOrder && (
        <IssueMaterialsModal
          workOrder={issueModalOrder}
          onClose={() => setIssueModalOrder(null)}
          onSuccess={handleIssueMaterialsSuccess}
          addToast={addToast}
        />
      )}

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        title="Delete Work Order?"
        message={`Are you sure you want to delete Work Order ${deleteTarget?.work_order_number || deleteTarget?.id || ""}?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          if (!deleteLoading) setDeleteTarget(null);
        }}
      />

      {/* Global CSS for Print Optimization */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 6mm;
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
          html, body, #root, main, #main-content, .app-shell, .ui-page, .ui-list-page, .ui-list-page__stack, .ui-list-card, .ui-list-card__body, .ui-table-wrap {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #000000 !important;
            float: none !important;
            display: block !important;
          }
          .print-header-container {
            display: block !important;
            width: 100% !important;
            margin-bottom: 12px !important;
            padding-bottom: 8px !important;
            border-bottom: 1.5px solid #cbd5e1 !important;
          }
          .print-header-top {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            width: 100% !important;
            margin-bottom: 4px !important;
          }
          .print-header-title {
            font-size: 18pt !important;
            font-weight: 800 !important;
            color: #0f172a !important;
            text-transform: none !important;
            line-height: 1.2 !important;
            margin: 4px 0 !important;
            white-space: nowrap !important;
          }
          .print-header-meta {
            font-size: 9pt !important;
            color: #475569 !important;
            margin-top: 2px !important;
          }
          table, .ui-table {
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            font-size: 9pt !important;
            table-layout: auto !important;
            margin-top: 8px !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 6px 8px !important;
            white-space: normal !important;
            word-break: break-word !important;
            font-size: 9pt !important;
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            text-align: left !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          td {
            color: #1e293b !important;
            vertical-align: middle !important;
          }
          tr {
            page-break-inside: avoid !important;
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
