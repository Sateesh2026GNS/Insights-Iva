import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Filter,
  Info,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";

import Button from "../../components/common/Button";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import { ListPageCard, ListPageCardBody, ListPageShell } from "../../components/common/ListPageShell";
import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import Loader from "../../components/common/Loader";
import { SearchBar } from "../../components/common/SearchFilter";
import PageHeader from "../../components/common/PageHeader";
import InventoryHeaderControls from "../../components/inventory/InventoryHeaderControls";
import StatusBadge from "../../components/common/StatusBadge";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import InventoryRowActionsMenu from "../../components/inventory/InventoryRowActionsMenu";
import RecordDetailModal from "../../components/inventory/RecordDetailModal";
import StoreManagerNav from "../../components/inventory/StoreManagerNav";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import { isStoreManager } from "../../config/permissions";
import {
  createStockAdjustment,
  getInventoryDashboard,
  getStockAdjustments,
  getWarehouses,
  updateStockAdjustmentStatus,
} from "../../api/inventoryApi";
import { ADJUSTMENT_REASONS } from "../../data/inventoryMasterData";
import { asArray } from "../../utils/apiError";
import { todayIso } from "../../utils/dateUtils";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";

const ADJUSTMENT_EXPORT_COLUMNS = [
  { key: "adjustment_number", label: "Adjustment No." },
  { key: "adjustment_date", label: "Date" },
  { key: "item_name", label: "Item" },
  { key: "warehouse_name", label: "Warehouse" },
  { key: "type", label: "Type" },
  { key: "adjustment_qty", label: "Adjustment Qty" },
  { key: "unit", label: "UOM" },
  { key: "new_qty", label: "New Stock" },
  { key: "reason", label: "Reason" },
  { key: "created_by", label: "Created By" },
  { key: "status", label: "Status" },
];

const STEPS = [
  { id: 1, label: "Adjustment Details" },
  { id: 2, label: "Review & Confirm" },
];

const REASON_OPTIONS = [
  "Stock Count Adjustment",
  ...ADJUSTMENT_REASONS.filter((r) => r !== "Physical Count"),
  "Damaged Goods",
];

function itemLabel(item) {
  const code = item.product_code || item.code || item.item_code || item.sku;
  const name = item.name || "Item";
  return code ? `${name} (${code})` : name;
}

function currentStockOf(item) {
  if (!item) return 0;
  return Number(item.total_quantity ?? item.quantity ?? item.available ?? item.current_stock ?? 0) || 0;
}

function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const day = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${day}, ${time}`;
}

function findWarehouseIdByName(warehouseList, name) {
  if (!name) return "";
  const match = warehouseList.find((w) => w.name === name);
  return match ? String(match.id) : "";
}

function findItemIdByName(itemList, name) {
  if (!name) return "";
  const match = itemList.find((i) => i.name === name);
  return match ? String(match.id) : "";
}

function isPendingAdjustmentStatus(status) {
  const st = String(status || "").toLowerCase();
  return st === "pending" || st === "pending_approval";
}

export default function StockAdjustment() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const storeMode = isStoreManager(user);
  const [searchParams] = useSearchParams();
  const formRef = useRef(null);
  const headerDateInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [adjustments, setAdjustments] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    adjustment_date: todayIso(),
    warehouse_id: "",
    item_id: "",
    adj_type: "increase",
    adj_qty: "100",
    reason: "Stock Count Adjustment",
    reference: "",
    remarks: "",
  });
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [showForm, setShowForm] = useState(() => searchParams.get("new") === "1");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [headerDate, setHeaderDate] = useState(() => todayIso());
  const [headerWarehouse, setHeaderWarehouse] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editReplaceId, setEditReplaceId] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [adjRes, whRes, itemsRes] = await Promise.allSettled([
        getStockAdjustments(),
        getWarehouses(),
        getInventoryDashboard(),
      ]);
      if (adjRes.status === "fulfilled") setAdjustments(asArray(adjRes.value?.data));
      else setAdjustments([]);
      if (whRes.status === "fulfilled") setWarehouses(asArray(whRes.value?.data));
      if (itemsRes.status === "fulfilled") setItems(asArray(itemsRes.value?.data));
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const openForm = useCallback(() => {
    setShowForm(true);
    setStep(1);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      openForm();
    }
  }, [searchParams, openForm]);

  useEffect(() => {
    if (!headerWarehouse && warehouses.length) setHeaderWarehouse(String(warehouses[0].id));
    if (!form.warehouse_id && warehouses.length) {
      setForm((f) => ({ ...f, warehouse_id: String(warehouses[0].id) }));
    }
  }, [warehouses, headerWarehouse, form.warehouse_id]);

  const selectedItem = items.find((i) => String(i.id) === String(form.item_id));
  const previewItem = selectedItem || { name: "", sku: "", unit: "", total_quantity: 0 };
  const currentStock = selectedItem ? currentStockOf(selectedItem) : 0;
  const adjQty = Number(form.adj_qty) || 0;
  const newQty =
    form.adj_type === "decrease" ? Math.max(0, currentStock - adjQty) : currentStock + adjQty;
  const unit = previewItem.unit || selectedItem?.unit || "";
  const itemDisplay = selectedItem ? itemLabel(selectedItem) : "Select item";
  const warehouseDisplay =
    warehouses.find((w) => String(w.id) === String(form.warehouse_id))?.name || "—";

  const canReview =
    Boolean(form.warehouse_id) &&
    (!items.length || Boolean(form.item_id)) &&
    adjQty > 0 &&
    Boolean(form.reason) &&
    Boolean(form.adjustment_date);

  const displayAdjustments = useMemo(
    () =>
      adjustments.map((a) => {
        const diff = Number(a.difference ?? a.new_qty - a.old_qty) || 0;
        return {
          ...a,
          adjustment_number: a.adjustment_number || `ADJ-${a.id}`,
          item_code: a.item_code || a.sku || "",
          type: diff >= 0 ? "increase" : "decrease",
          adjustment_qty: Math.abs(diff),
          unit: a.unit || "",
          created_by: a.approved_by || a.created_by || "—",
          live: true,
        };
      }),
    [adjustments]
  );

  const filteredAdjustments = useMemo(() => {
    let rows = displayAdjustments;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [r.adjustment_number, r.item_name, r.warehouse_name, r.reason].some(
          (v) => v && String(v).toLowerCase().includes(q)
        )
      );
    }
    if (statusFilter) {
      rows = rows.filter((r) => String(r.status || "").toLowerCase() === statusFilter);
    }
    return rows;
  }, [displayAdjustments, search, statusFilter]);

  const resetForm = () => {
    setForm({
      adjustment_date: new Date().toISOString().slice(0, 10),
      warehouse_id: warehouses[0] ? String(warehouses[0].id) : "",
      item_id: "",
      adj_type: "increase",
      adj_qty: "",
      reason: "Stock Count Adjustment",
      reference: "",
      remarks: "",
    });
    setStep(1);
    setEditReplaceId(null);
  };

  const requireLiveRow = (row, actionLabel = "This action") => {
    if (row.live && typeof row.id === "number") return true;
    addToast(`${actionLabel} is only available for live adjustment records.`, "warning");
    return false;
  };

  const handleView = (row) => setViewTarget(row);

  const handleEdit = (row) => {
    if (!requireLiveRow(row, "Edit")) return;
    const st = String(row.status || "").toLowerCase();
    if (!isPendingAdjustmentStatus(st)) {
      addToast("Only pending adjustments can be edited. Create a new adjustment instead.", "warning");
      return;
    }
    setForm({
      adjustment_date: row.adjustment_date ? String(row.adjustment_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      warehouse_id: findWarehouseIdByName(warehouses, row.warehouse_name),
      item_id: findItemIdByName(items, row.item_name),
      adj_type: row.type === "decrease" ? "decrease" : "increase",
        adj_qty: String(row.adjustment_qty ?? (Math.abs(Number(row.difference) || 0) || "")),
      reason: row.reason || "Stock Count Adjustment",
      reference: "",
      remarks: "",
    });
    setEditReplaceId(row.id);
    setStep(1);
    openForm();
    addToast("Update the adjustment details and submit to save changes.", "info");
  };

  const handleAdd = () => {
    resetForm();
    openForm();
  };

  const handleDeleteRequest = (row) => {
    if (!requireLiveRow(row, "Delete")) return;
    const st = String(row.status || "").toLowerCase();
    if (!isPendingAdjustmentStatus(st)) {
      addToast("Only pending adjustments can be cancelled.", "warning");
      return;
    }
    setDeleteTarget(row);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await updateStockAdjustmentStatus(deleteTarget.id, {
        status: "rejected",
        approved_by: "Store Manager",
      });
      addToast("Adjustment cancelled successfully");
      setDeleteTarget(null);
      await load(true);
    } catch {
      addToast("Could not cancel adjustment", "error");
    } finally {
      setDeleting(false);
    }
  };

  const viewFields = viewTarget
    ? [
        { label: "Adjustment No.", value: viewTarget.adjustment_number },
        { label: "Date", value: formatDateTime(viewTarget.adjustment_date) },
        { label: "Item", value: viewTarget.item_name },
        { label: "Item Code", value: viewTarget.item_code },
        { label: "Warehouse", value: viewTarget.warehouse_name },
        { label: "Type", value: viewTarget.type === "decrease" ? "Decrease" : "Increase" },
        { label: "Adjustment Qty", value: formatQty(viewTarget.adjustment_qty) },
        { label: "Old Quantity", value: formatQty(viewTarget.old_qty) },
        { label: "New Quantity", value: formatQty(viewTarget.new_qty) },
        { label: "Reason", value: viewTarget.reason },
        { label: "Status", value: viewTarget.status },
        { label: "Created By", value: viewTarget.created_by || viewTarget.approved_by },
      ]
    : [];

  const handleSubmit = async () => {
    if (!form.item_id || !items.length) {
      addToast("Select a live inventory item to save", "error");
      return;
    }
    if (!form.reason) {
      addToast("Reason is required", "error");
      return;
    }
    if (adjQty <= 0) {
      addToast("Enter adjustment quantity", "error");
      return;
    }
    setSubmitting(true);
    const replacingId = editReplaceId;
    try {
      const reasonParts = [form.reason, form.reference ? `Ref: ${form.reference}` : "", form.remarks]
        .filter(Boolean)
        .join(" | ");
      await createStockAdjustment({
        adjustment_date: form.adjustment_date || null,
        warehouse_id: Number(form.warehouse_id),
        item_id: Number(form.item_id),
        new_qty: Number(newQty),
        reason: reasonParts,
      });
      if (replacingId && typeof replacingId === "number") {
        try {
          await updateStockAdjustmentStatus(replacingId, {
            status: "rejected",
            approved_by: "Store Manager",
          });
        } catch {
          /* prior pending adjustment may remain */
        }
      }
      addToast(replacingId ? "Adjustment updated successfully" : "Adjustment recorded — pending approval");
      resetForm();
      setShowForm(false);
      load();
    } catch {
      addToast("Adjustment failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    if (typeof id !== "number") return;
    setUpdatingId(id);
    try {
      await updateStockAdjustmentStatus(id, {
        status: newStatus,
        approved_by: "Store Manager",
      });
      addToast(`Adjustment ${newStatus}`);
      await load();
    } catch {
      addToast("Failed to update status", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const columns = [
    {
      key: "adjustment_number",
      label: "Adjustment No.",
      render: (r) => <span className="font-semibold tabular-nums text-[var(--color-text)]">{r.adjustment_number}</span>,
    },
    {
      key: "adjustment_date",
      label: "Date",
      render: (r) => (
        <span className="whitespace-nowrap text-[12px] text-[var(--color-text-secondary)]">
          {formatDateTime(r.adjustment_date)}
        </span>
      ),
    },
    {
      key: "item_name",
      label: "Item",
      render: (r) => (
        <div>
          <p className="text-[13px] font-medium text-[var(--color-text)]">{r.item_name}</p>
          {r.item_code ? <p className="text-[11px] text-[var(--color-text-muted)]">({r.item_code})</p> : null}
        </div>
      ),
    },
    {
      key: "warehouse_name",
      label: "Warehouse",
      render: (r) => <span className="text-[13px] text-[var(--color-text-secondary)]">{r.warehouse_name || "—"}</span>,
    },
    {
      key: "type",
      label: "Type",
      render: (r) =>
        r.type === "increase" ? (
          <StatusBadge tone="success">
            <span className="inline-flex items-center gap-1"><ArrowUp className="h-3 w-3" /> Increase</span>
          </StatusBadge>
        ) : (
          <StatusBadge tone="danger">
            <span className="inline-flex items-center gap-1"><ArrowDown className="h-3 w-3" /> Decrease</span>
          </StatusBadge>
        ),
    },
    {
      key: "adjustment_qty",
      label: "Adjustment Qty",
      render: (r) => (
        <span className={`tabular-nums font-semibold ${r.type === "increase" ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
          {r.type === "increase" ? "+" : "-"}
          {formatQty(r.adjustment_qty)}
        </span>
      ),
    },
    {
      key: "unit",
      label: "UOM",
      render: (r) => <span className="text-[13px] text-[var(--color-text-secondary)]">{r.unit || "—"}</span>,
    },
    {
      key: "new_qty",
      label: "New Stock",
      render: (r) => <span className="tabular-nums text-[13px] font-semibold">{formatQty(r.new_qty)}</span>,
    },
    {
      key: "reason",
      label: "Reason",
      render: (r) => <span className="max-w-[140px] truncate text-[13px] text-[var(--color-text-secondary)]">{r.reason || "—"}</span>,
    },
    {
      key: "created_by",
      label: "Created By",
      render: (r) => <span className="text-[13px] text-[var(--color-text-secondary)]">{r.created_by || "—"}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => {
        const st = String(r.status || "").toLowerCase();
        const pending = st === "pending" || st === "pending_approval";
        return (
          <StatusBadge tone={pending ? "warning" : st === "approved" ? "success" : "neutral"}>
            {pending ? "Pending" : st === "approved" ? "Approved" : String(r.status || "—").replace(/_/g, " ")}
          </StatusBadge>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      className: "min-w-[7rem] whitespace-nowrap",
      render: (r) => {
        const isBusy = updatingId === r.id;
        const st = String(r.status || "").toLowerCase();
        return (
          <div className="flex items-center gap-1 whitespace-nowrap">
            {r.live && (st === "pending" || st === "pending_approval") ? (
              <>
                <Button type="button" variant="success" size="sm" disabled={isBusy} onClick={() => handleStatusChange(r.id, "approved")} title="Approve">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="danger" size="sm" disabled={isBusy} onClick={() => handleStatusChange(r.id, "rejected")} title="Reject">
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : null}
            <InventoryRowActionsMenu
              rowId={r.id}
              isOpen={openMenuId === r.id}
              onOpen={setOpenMenuId}
              onClose={() => setOpenMenuId(null)}
              onView={() => handleView(r)}
              onEdit={() => handleEdit(r)}
              onAdd={handleAdd}
              onDelete={() => handleDeleteRequest(r)}
            />
          </div>
        );
      },
    },
  ];

  if (loading) {
    return (
      <ListPageShell>
      <div className="space-y-5 pb-4">
        {storeMode ? <StoreManagerNav /> : null}
        <Loader label="Loading stock adjustments…" />
      </div>
      </ListPageShell>
    );
  }

  const exportRows = filteredAdjustments.map((r) => ({
    adjustment_number: r.adjustment_number,
    adjustment_date: formatDateTime(r.adjustment_date),
    item_name: r.item_name,
    warehouse_name: r.warehouse_name || "",
    type: r.type === "increase" ? "Increase" : "Decrease",
    adjustment_qty: `${r.type === "increase" ? "+" : "-"}${formatQty(r.adjustment_qty)}`,
    unit: r.unit || "",
    new_qty: formatQty(r.new_qty),
    reason: r.reason || "",
    created_by: r.created_by || "",
    status: String(r.status || "").replace(/_/g, " "),
  }));

  const handleExport = (format) => {
    if (format === "pdf") {
      exportToPdf(exportRows, ADJUSTMENT_EXPORT_COLUMNS, "Stock Adjustments", "stock-adjustments");
    } else {
      exportToExcel(exportRows, ADJUSTMENT_EXPORT_COLUMNS, "stock-adjustments");
    }
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  return (
    <ListPageShell>
    <div className="min-w-0 space-y-5 pb-4">
      {storeMode ? <StoreManagerNav /> : null}

      <PageHeader
        subtitle="Adjust stock quantity for items"
        action={
          <InventoryHeaderControls
            dateValue={headerDate}
            onDateChange={setHeaderDate}
            warehouseValue={headerWarehouse}
            onWarehouseChange={setHeaderWarehouse}
            warehouses={warehouses}
          />
        }
      />

      {showForm ? (
        <section ref={formRef} className="ui-card scroll-mt-24 p-4 sm:p-5">
          <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-[var(--color-border-soft)] pb-4">
            {STEPS.map((s, i) => {
              const active = step === s.id;
              const done = step > s.id;
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          active || done
                            ? "bg-[var(--color-action-teal)] text-white"
                            : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]"
                        }`}
                      >
                        {s.id}
                      </span>
                      <span className={`text-sm font-semibold ${active ? "text-[var(--color-action-teal)]" : "text-[var(--color-text-muted)]"}`}>
                        {s.label}
                      </span>
                    </div>
                    {active ? <span className="ml-9 h-0.5 w-24 rounded bg-[var(--color-action-teal)]" /> : null}
                  </div>
                  {i < STEPS.length - 1 ? <ArrowRight className="h-4 w-4 text-[var(--color-text-muted)]" /> : null}
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
            <div>
              {step === 1 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-sm">
                    <span className="ui-label">Adjustment No.</span>
                    <input value="Auto generated" readOnly className="ui-input bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]" />
                  </label>
                  <label className="text-sm">
                    <span className="ui-label">Adjustment Date *</span>
                    <div className="relative flex items-center">
                      <input
                        type="date"
                        value={form.adjustment_date || todayIso()}
                        onChange={(e) => setForm((f) => ({ ...f, adjustment_date: e.target.value || todayIso() }))}
                        className="ui-input pr-9"
                      />
                      <Calendar className="pointer-events-none absolute right-2.5 h-4 w-4 text-[var(--color-text-muted)]" />
                    </div>
                  </label>
                  <label className="text-sm">
                    <span className="ui-label">Warehouse *</span>
                    <select
                      value={form.warehouse_id}
                      onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
                      className="ui-select"
                    >
                      <option value="">Select warehouse</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                      {!warehouses.length ? <option value="main">Main Warehouse</option> : null}
                    </select>
                  </label>

                  <label className="text-sm">
                    <span className="ui-label">Item *</span>
                    <select
                      value={form.item_id}
                      onChange={(e) => setForm((f) => ({ ...f, item_id: e.target.value }))}
                      className="ui-select"
                    >
                      <option value="">{items.length ? "Select item" : "No items available"}</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>{itemLabel(i)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="ui-label">UOM</span>
                    <input value={unit} readOnly className="ui-input bg-[var(--color-surface-muted)]" />
                  </label>
                  <label className="text-sm">
                    <span className="ui-label">Current Stock</span>
                    <input value={`${formatQty(currentStock)} ${unit}`} readOnly className="ui-input bg-[var(--color-surface-muted)]" />
                  </label>

                  <div className="text-sm">
                    <span className="ui-label">Adjustment Type *</span>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, adj_type: "increase" }))}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold ${
                          form.adj_type === "increase"
                            ? "border-[#16a34a] bg-[#dcfce7] text-[#16a34a]"
                            : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        <ArrowUp className="h-4 w-4" /> Increase
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, adj_type: "decrease" }))}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold ${
                          form.adj_type === "decrease"
                            ? "border-[#ef4444] bg-[#fee2e2] text-[#ef4444]"
                            : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        <ArrowDown className="h-4 w-4" /> Decrease
                      </button>
                    </div>
                  </div>

                  <label className="text-sm">
                    <span className="ui-label">Adjustment Quantity *</span>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.adj_qty}
                        onChange={(e) => setForm((f) => ({ ...f, adj_qty: e.target.value }))}
                        className="ui-input !pr-12"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--color-text-muted)]">
                        {unit}
                      </span>
                    </div>
                  </label>

                  <label className="text-sm">
                    <span className="ui-label">Reason *</span>
                    <select
                      value={form.reason}
                      onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                      className="ui-select"
                    >
                      {REASON_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm">
                    <span className="ui-label">Reference (Optional)</span>
                    <input
                      value={form.reference}
                      onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                      className="ui-input"
                      placeholder="Enter reference"
                    />
                  </label>

                  <label className="text-sm sm:col-span-2">
                    <span className="ui-label">Remarks (Optional)</span>
                    <textarea
                      value={form.remarks}
                      maxLength={250}
                      onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                      className="ui-input"
                      rows={3}
                      placeholder="Add remarks…"
                    />
                    <span className="mt-1 block text-right text-[11px] text-[var(--color-text-muted)]">
                      {form.remarks.length} / 250
                    </span>
                  </label>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/40 p-4 text-sm">
                  <h3 className="mb-3 font-semibold text-[var(--color-text)]">Review adjustment</h3>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-[var(--color-text-muted)]">Item</dt>
                      <dd className="font-medium">{itemDisplay}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--color-text-muted)]">Warehouse</dt>
                      <dd className="font-medium">{warehouseDisplay}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--color-text-muted)]">Type</dt>
                      <dd className="font-medium capitalize">{form.adj_type}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--color-text-muted)]">Reason</dt>
                      <dd className="font-medium">{form.reason}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--color-text-muted)]">Current → New</dt>
                      <dd className="font-semibold tabular-nums">
                        {formatQty(currentStock)} → {formatQty(newQty)} {unit}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                {step === 1 ? (
                  <>
                    <Button type="button" variant="secondary" onClick={() => { resetForm(); setShowForm(false); }}>
                      Cancel
                    </Button>
                    <Button type="button" variant="primary" disabled={!canReview} onClick={() => setStep(2)}>
                      Review & Confirm <ArrowRight className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button type="button" variant="primary" loading={submitting} disabled={submitting || !items.length} onClick={handleSubmit}>
                      Confirm Adjustment
                    </Button>
                  </>
                )}
              </div>
            </div>

            <aside className="h-fit rounded-xl border border-[var(--color-success)]/25 bg-[var(--color-success-soft)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-[var(--color-success)]" />
                <h3 className="text-sm font-semibold text-[var(--color-text)]">Adjustment Summary</h3>
              </div>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--color-text-muted)]">Item</dt>
                  <dd className="max-w-[140px] truncate text-right font-medium">{itemDisplay}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--color-text-muted)]">Warehouse</dt>
                  <dd className="text-right font-medium">{warehouseDisplay}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--color-text-muted)]">Current Stock</dt>
                  <dd className="tabular-nums font-medium">{formatQty(currentStock)} {unit}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--color-text-muted)]">Adjustment</dt>
                  <dd className={`tabular-nums font-semibold ${form.adj_type === "increase" ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
                    {form.adj_type === "increase" ? "+" : "-"}
                    {formatQty(adjQty)} {unit}
                  </dd>
                </div>
                <div className="border-t border-[var(--color-success)]/20 pt-3">
                  <dt className="text-xs text-[var(--color-text-muted)]">New Stock</dt>
                  <dd className={`mt-1 text-2xl font-bold tabular-nums ${form.adj_type === "increase" ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
                    {formatQty(newQty)} {unit}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex gap-2 rounded-lg border border-[var(--color-info)]/30 bg-[var(--color-info-soft)] px-3 py-2 text-xs text-[var(--color-text)]">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-info)]" />
                <p>
                  This adjustment will {form.adj_type === "increase" ? "increase" : "decrease"} the stock by{" "}
                  {formatQty(adjQty)} {unit}.
                </p>
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      <ListPageCard>
        <ListPageCardBody>
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Recent Adjustments</h2>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBar value={search} onChange={setSearch} placeholder="Search" className="w-full" />
            <ExportDownloadMenu disabled={!exportRows.length} onExport={handleExport} />
            <Button type="button" variant="secondary" onClick={() => setShowFilters((v) => !v)}>
              <Filter className="h-4 w-4" /> Filters
            </Button>
            {showFilters ? (
              <>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ui-select !w-auto min-w-[8.5rem]">
                  <option value="">Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <Button type="button" variant="ghost" onClick={() => { setSearch(""); setStatusFilter(""); }}>
                  <RefreshCw className="h-4 w-4" /> Clear
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="add"
              onClick={openForm}
              leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}
            >
              New Adjustment
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredAdjustments}
          showSearch={false}
          pageSize={10}
          wrapClassName="inventory-table-scroll--adjustment rounded-lg border border-[var(--color-border-soft)]"
          emptyState={
            <EmptyState
              icon="clipboard"
              title="No adjustments yet"
              description="Create an adjustment to correct stock quantities."
            />
          }
        />
        </ListPageCardBody>
      </ListPageCard>

      <RecordDetailModal
        open={Boolean(viewTarget)}
        title={viewTarget?.adjustment_number || "Adjustment Details"}
        subtitle={viewTarget?.item_name}
        fields={viewFields}
        onClose={() => setViewTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete record"
        message="Are you sure you want to delete this record?"
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
    </ListPageShell>
  );
}
