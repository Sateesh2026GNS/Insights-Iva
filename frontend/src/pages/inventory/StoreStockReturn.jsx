import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Filter,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";

import Button from "../../components/common/Button";
import { SearchBar } from "../../components/common/SearchFilter";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import DataTable from "../../components/common/DataTable";
import EmptyState from "../../components/common/EmptyState";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import RecordDetailModal from "../../components/inventory/RecordDetailModal";
import StatusBadge from "../../components/common/StatusBadge";
import StoreManagerNav from "../../components/inventory/StoreManagerNav";
import { FormField, Input, Select, Textarea } from "../../components/common/FormField";
import { DatePicker } from "../../design-system/dateControls";
import { useToast } from "../../context/ToastContext";
import useAuth from "../../hooks/useAuth";
import usePageRefresh from "../../hooks/usePageRefresh";
import usePermissions from "../../hooks/usePermissions";
import { isStoreManager } from "../../config/permissions";
import {
  createStockReturn,
  getInventoryDashboard,
  getStockReturn,
  getStockReturnAvailableQty,
  getStockReturns,
  getStoreMaterialRequests,
  getWarehouses,
  updateStockReturn,
  updateStockReturnStatus,
} from "../../api/inventoryApi";
import { asArray } from "../../utils/apiError";
import { toIsoDate } from "../../utils/dateUtils";

const RETURN_TYPES = [
  { value: "production_return", label: "Production Return" },
  { value: "purchase_return", label: "Purchase Return" },
  { value: "job_card_return", label: "Job Card Return" },
  { value: "excess_material_return", label: "Excess Material Return" },
  { value: "damaged_material_return", label: "Damaged Material Return" },
];

const DEPARTMENTS = ["Production", "Store", "Quality", "Packing & Dispatch"];

const REASONS = [
  "Excess Material",
  "Unused Material",
  "Damaged Material",
  "Quality Rejection",
  "Production Cancellation",
  "Other",
];

const CONDITIONS = [
  { value: "good", label: "Good" },
  { value: "damaged", label: "Damaged" },
  { value: "reusable", label: "Reusable" },
  { value: "scrap", label: "Scrap" },
];

const STATUS_TONE = {
  draft: "neutral",
  pending_verification: "warning",
  quality_check: "warning",
  stock_update_pending: "info",
  completed: "success",
  rejected: "danger",
  cancelled: "neutral",
};

const STATUS_LABEL = {
  draft: "Draft",
  pending_verification: "Pending Verification",
  quality_check: "Quality Check",
  stock_update_pending: "Stock Update Pending",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const WORKFLOW_STEPS = [
  { key: "draft", label: "Request Created" },
  { key: "pending_verification", label: "Store Verification" },
  { key: "quality_check", label: "Quality Check" },
  { key: "stock_update_pending", label: "Stock Updated" },
  { key: "completed", label: "Completed" },
];

const emptyLine = () => ({
  key: crypto.randomUUID(),
  item_id: "",
  batch_number: "",
  available_qty: 0,
  return_qty: "",
  unit: "pcs",
  condition: "good",
  warehouse_id: "",
  line_reason: "",
});

const emptyForm = () => ({
  return_number: "",
  return_date: toIsoDate(new Date()),
  return_type: "production_return",
  reference_no: "",
  reference_id: null,
  department: "Production",
  returned_by: "",
  return_to_warehouse_id: "",
  reason: "Excess Material",
  remarks: "",
  lines: [emptyLine()],
});

function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
}

function returnTypeLabel(value) {
  return RETURN_TYPES.find((t) => t.value === value)?.label || value;
}

function workflowStepIndex(status) {
  if (status === "rejected" || status === "cancelled") return -1;
  const idx = WORKFLOW_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

function canWorkflowAction(doc, action, perms) {
  const { isAdmin, canAction, can } = perms;
  if (isAdmin) return true;
  const st = doc?.status;
  switch (action) {
    case "edit":
    case "submit":
      return st === "draft" && canAction("inventory", "create");
    case "verify":
      return st === "pending_verification" && canAction("inventory", "update");
    case "approve":
      return st === "quality_check" && (canAction("quality", "update") || canAction("inventory", "update"));
    case "complete":
      return st === "stock_update_pending" && canAction("inventory", "update");
    case "reject":
      return ["pending_verification", "quality_check"].includes(st) &&
        (canAction("inventory", "update") || canAction("quality", "update"));
    case "cancel":
      return st === "draft" && canAction("inventory", "update");
    case "view":
      return perms.can("inventory") || perms.can("production");
    default:
      return false;
  }
}

function WorkflowPipeline({ status }) {
  const activeIdx = workflowStepIndex(status);
  const terminal = status === "rejected" || status === "cancelled";

  return (
    <div className="ui-card overflow-hidden p-4 sm:p-5">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        Workflow Status
      </p>
      {terminal ? (
        <div className="flex items-center gap-2 text-sm">
          <StatusBadge tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} />
          <span className="text-[var(--color-text-muted)]">This return will not proceed further.</span>
        </div>
      ) : (
        <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1">
          {WORKFLOW_STEPS.map((step, idx) => {
            const done = idx < activeIdx;
            const current = idx === activeIdx;
            return (
              <li key={step.key} className="flex items-center gap-1 sm:gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    current
                      ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/30"
                      : done
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : null}
                  {step.label}
                </span>
                {idx < WORKFLOW_STEPS.length - 1 ? (
                  <span className="hidden text-[var(--color-text-faint)] sm:inline" aria-hidden>
                    →
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function StoreStockReturn() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const perms = usePermissions();
  const storeMode = isStoreManager(user);
  const [searchParams] = useSearchParams();
  const formRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [references, setReferences] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(() => searchParams.get("new") === "1");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewTarget, setViewTarget] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const loadReferenceData = useCallback(async () => {
    const [whRes, itemsRes, refRes] = await Promise.allSettled([
      getWarehouses(),
      getInventoryDashboard(),
      getStoreMaterialRequests(),
    ]);
    if (whRes.status === "fulfilled") setWarehouses(asArray(whRes.value?.data));
    if (itemsRes.status === "fulfilled") setItems(asArray(itemsRes.value?.data));
    if (refRes.status === "fulfilled") setReferences(asArray(refRes.value?.data));
  }, []);

  const loadList = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const params = {};
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.return_type = typeFilter;
      if (deptFilter) params.department = deptFilter;
      if (warehouseFilter) params.warehouse_id = Number(warehouseFilter);
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const retRes = await getStockReturns(params);
      setReturns(asArray(retRes?.data));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, typeFilter, deptFilter, warehouseFilter, dateFrom, dateTo]);

  const load = useCallback(
    async (isRefresh = false) => {
      await Promise.all([loadReferenceData(), loadList(isRefresh)]);
    },
    [loadReferenceData, loadList]
  );

  usePageRefresh(() => load(true));
  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);
  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!form.returned_by && user?.full_name) {
      setForm((f) => ({ ...f, returned_by: user.full_name }));
    }
    if (!form.return_to_warehouse_id && warehouses.length) {
      setForm((f) => ({ ...f, return_to_warehouse_id: String(warehouses[0].id) }));
    }
  }, [user, warehouses, form.returned_by, form.return_to_warehouse_id]);

  useEffect(() => {
    if (searchParams.get("new") === "1") setShowForm(true);
  }, [searchParams]);

  const summary = useMemo(() => {
    const lines = form.lines.filter((l) => l.item_id && Number(l.return_qty) > 0);
    let good = 0;
    let damaged = 0;
    let scrap = 0;
    let total = 0;
    lines.forEach((l) => {
      const q = Number(l.return_qty) || 0;
      total += q;
      if (l.condition === "damaged") damaged += q;
      else if (l.condition === "scrap") scrap += q;
      else good += q;
    });
    return {
      total_materials: lines.length,
      total_return_qty: total,
      good_qty: good,
      damaged_qty: damaged,
      scrap_qty: scrap,
    };
  }, [form.lines]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    if (user?.full_name) {
      setForm((f) => ({ ...emptyForm(), returned_by: user.full_name, return_to_warehouse_id: f.return_to_warehouse_id }));
    }
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const loadDocToForm = async (row) => {
    try {
      const res = await getStockReturn(row.id);
      const doc = res.data;
      setForm({
        return_number: doc.return_number,
        return_date: doc.return_date || toIsoDate(new Date()),
        return_type: doc.return_type,
        reference_no: doc.reference_no || "",
        reference_id: doc.reference_id,
        department: doc.department || "Production",
        returned_by: doc.returned_by || "",
        return_to_warehouse_id: String(doc.return_to_warehouse_id),
        reason: doc.reason || "Excess Material",
        remarks: doc.remarks || "",
        lines: (doc.lines || []).map((ln) => ({
          key: crypto.randomUUID(),
          item_id: String(ln.item_id),
          batch_number: ln.batch_number || "",
          available_qty: ln.available_qty,
          return_qty: String(ln.return_qty),
          unit: ln.unit || "pcs",
          condition: ln.condition || "good",
          warehouse_id: String(ln.warehouse_id),
          line_reason: ln.line_reason || "",
        })),
      });
      setEditingId(doc.id);
      setShowForm(true);
    } catch (err) {
      addToast(err?.response?.data?.detail || "Failed to load return", "error");
    }
  };

  const handleReferenceChange = (value) => {
    const ref = references.find((r) => String(r.id) === value || r.request_number === value);
    setForm((f) => ({
      ...f,
      reference_no: ref?.request_number || value,
      reference_id: ref?.id || null,
    }));
  };

  const fetchAvailableQty = async (lineKey, itemId, warehouseId) => {
    if (!itemId || !warehouseId) return;
    try {
      const res = await getStockReturnAvailableQty(itemId, {
        warehouse_id: warehouseId,
        reference_id: form.reference_id || undefined,
      });
      setForm((f) => ({
        ...f,
        lines: f.lines.map((ln) =>
          ln.key === lineKey ? { ...ln, available_qty: res.data.available_qty, unit: res.data.unit || ln.unit } : ln
        ),
      }));
    } catch {
      /* keep existing */
    }
  };

  const updateLine = (lineKey, patch) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((ln) => (ln.key === lineKey ? { ...ln, ...patch } : ln)),
    }));
  };

  const addLine = () => {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { ...emptyLine(), warehouse_id: f.return_to_warehouse_id || "" }],
    }));
  };

  const removeLine = (lineKey) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.length <= 1 ? f.lines : f.lines.filter((ln) => ln.key !== lineKey),
    }));
  };

  const validateForm = () => {
    if (!form.return_to_warehouse_id) {
      addToast("Select a return warehouse.", "error");
      return false;
    }
    const validLines = form.lines.filter((l) => l.item_id && Number(l.return_qty) > 0);
    if (!validLines.length) {
      addToast("Add at least one material with return quantity.", "error");
      return false;
    }
    for (const ln of validLines) {
      const rq = Number(ln.return_qty);
      const avail = Number(ln.available_qty) || 0;
      if (avail > 0 && rq > avail) {
        addToast("Return quantity cannot exceed available quantity.", "error");
        return false;
      }
    }
    return true;
  };

  const buildPayload = (status) => ({
    return_number: form.return_number || undefined,
    return_date: form.return_date,
    return_type: form.return_type,
    reference_no: form.reference_no || null,
    reference_type: form.reference_id ? "material_request" : null,
    reference_id: form.reference_id,
    department: form.department,
    returned_by: form.returned_by,
    returned_by_user_id: user?.id,
    return_to_warehouse_id: Number(form.return_to_warehouse_id),
    reason: form.reason,
    remarks: form.remarks || null,
    status,
    lines: form.lines
      .filter((l) => l.item_id && Number(l.return_qty) > 0)
      .map((l) => ({
        item_id: Number(l.item_id),
        batch_number: l.batch_number || null,
        available_qty: Number(l.available_qty) || 0,
        return_qty: Number(l.return_qty),
        unit: l.unit || "pcs",
        condition: l.condition,
        warehouse_id: Number(l.warehouse_id || form.return_to_warehouse_id),
        line_reason: l.line_reason || null,
      })),
  });

  const saveReturn = async (status) => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const payload = buildPayload(status);
      if (editingId) {
        await updateStockReturn(editingId, payload);
        if (status === "pending_verification") {
          await updateStockReturnStatus(editingId, { status: "pending_verification" });
        }
        addToast(status === "draft" ? "Draft saved." : "Return submitted.");
      } else {
        await createStockReturn(payload);
        addToast(status === "draft" ? "Draft created." : "Return submitted.");
      }
      setShowForm(false);
      resetForm();
      load(true);
    } catch (err) {
      addToast(err?.response?.data?.detail || "Failed to save return", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const runStatusAction = async (row, status, note) => {
    setUpdatingId(row.id);
    try {
      await updateStockReturnStatus(row.id, { status, note });
      addToast(`Return ${STATUS_LABEL[status] || status}.`);
      load(true);
      if (viewTarget?.id === row.id) {
        const res = await getStockReturn(row.id);
        setViewTarget(res.data);
      }
    } catch (err) {
      addToast(err?.response?.data?.detail || "Action failed", "error");
    } finally {
      setUpdatingId(null);
      setConfirm(null);
    }
  };

  const handleView = async (row) => {
    try {
      const res = await getStockReturn(row.id);
      setViewTarget(res.data);
    } catch {
      setViewTarget(row);
    }
  };

  const columns = [
    { key: "return_number", label: "Return No.", sortable: true },
    { key: "return_date", label: "Return Date", render: (r) => formatDate(r.return_date) },
    { key: "reference_no", label: "Reference No." },
    { key: "return_type", label: "Return Type", render: (r) => returnTypeLabel(r.return_type) },
    { key: "department", label: "Department" },
    { key: "returned_by", label: "Returned By" },
    { key: "total_qty", label: "Total Qty", render: (r) => formatQty(r.total_qty) },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusBadge tone={STATUS_TONE[r.status] || "neutral"} label={STATUS_LABEL[r.status] || r.status} />
      ),
    },
    { key: "created_at", label: "Created", render: (r) => formatDate(r.created_at?.slice?.(0, 10) || r.created_at) },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleView(row)}>
            View
          </Button>
          {canWorkflowAction(row, "edit", perms) ? (
            <Button variant="ghost" size="sm" onClick={() => loadDocToForm(row)}>
              Edit
            </Button>
          ) : null}
          {canWorkflowAction(row, "submit", perms) ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={updatingId === row.id}
              onClick={() => setConfirm({ row, action: "submit", status: "pending_verification" })}
            >
              Submit
            </Button>
          ) : null}
          {canWorkflowAction(row, "verify", perms) ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={updatingId === row.id}
              onClick={() => setConfirm({ row, action: "verify", status: "quality_check" })}
            >
              Verify
            </Button>
          ) : null}
          {canWorkflowAction(row, "approve", perms) ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={updatingId === row.id}
              onClick={() => setConfirm({ row, action: "approve", status: "stock_update_pending" })}
            >
              Approve
            </Button>
          ) : null}
          {canWorkflowAction(row, "complete", perms) ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={updatingId === row.id}
              onClick={() => setConfirm({ row, action: "complete", status: "completed" })}
            >
              Complete
            </Button>
          ) : null}
          {canWorkflowAction(row, "reject", perms) ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={updatingId === row.id}
              onClick={() => setConfirm({ row, action: "reject", status: "rejected" })}
            >
              Reject
            </Button>
          ) : null}
          {canWorkflowAction(row, "cancel", perms) ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={updatingId === row.id}
              onClick={() => setConfirm({ row, action: "cancel", status: "cancelled" })}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  if (loading && !returns.length) {
    return (
      <div className="space-y-6 pb-8">
        {storeMode ? <StoreManagerNav /> : null}
        <Loader label="Loading Stock Returns…" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {storeMode ? <StoreManagerNav /> : null}

      <PageHeader
        showTitle
        title="Stock Return"
        subtitle="Record and manage material returned to inventory"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => load(true)} disabled={loading}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </Button>
            {perms.canAction("inventory", "create") || perms.isAdmin ? (
              <Button variant="add" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                New Return
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="ui-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search return no., reference, returned by…"
            className="w-full"
          />
          <Button variant="secondary" onClick={() => setShowFilters((v) => !v)}>
            <Filter className="h-4 w-4" aria-hidden />
            Filters
          </Button>
        </div>
        {showFilters ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <FormField label="Status">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Return Type">
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All</option>
                {RETURN_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Department">
              <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                <option value="">All</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Warehouse">
              <Select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}>
                <option value="">All</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <DatePicker label="From" value={dateFrom} onChange={setDateFrom} />
              <DatePicker label="To" value={dateTo} onChange={setDateTo} />
            </div>
          </div>
        ) : null}
      </div>

      {returns.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="No stock returns yet"
          description="Create a return to send unused or excess material back to the warehouse."
          action={
            perms.canAction("inventory", "create") || perms.isAdmin ? (
              <Button variant="add" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>Create Stock Return</Button>
            ) : null
          }
        />
      ) : (
        <DataTable columns={columns} data={returns} rowKey="id" />
      )}

      {showForm ? (
        <div ref={formRef} className="space-y-4">
          <WorkflowPipeline status={editingId ? form.status || "draft" : "draft"} />

          <div className="ui-card p-4 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">Return Details</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Return No." hint="Auto-generated on save">
                <Input value={form.return_number} placeholder="SR-2026-00001" readOnly disabled />
              </FormField>
              <DatePicker label="Return Date" value={form.return_date} onChange={(v) => setForm((f) => ({ ...f, return_date: v }))} required />
              <FormField label="Return Type" required>
                <Select value={form.return_type} onChange={(e) => setForm((f) => ({ ...f, return_type: e.target.value }))}>
                  {RETURN_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Reference No.">
                <Select value={form.reference_id ? String(form.reference_id) : ""} onChange={(e) => handleReferenceChange(e.target.value)}>
                  <option value="">Select job card / material request</option>
                  {references.map((r) => (
                    <option key={r.id} value={r.id}>{r.request_number} — {r.item_name || r.operator_name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Department" required>
                <Select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Returned By" required>
                <Input value={form.returned_by} onChange={(e) => setForm((f) => ({ ...f, returned_by: e.target.value }))} />
              </FormField>
              <FormField label="Return To" required>
                <Select
                  value={form.return_to_warehouse_id}
                  onChange={(e) => setForm((f) => ({ ...f, return_to_warehouse_id: e.target.value, lines: f.lines.map((ln) => ({ ...ln, warehouse_id: e.target.value })) }))}
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Reason" required>
                <Select value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}>
                  {REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </Select>
              </FormField>
              <div className="sm:col-span-2 lg:col-span-3">
                <FormField label="Remarks">
                  <Textarea rows={3} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
                </FormField>
              </div>
            </div>
          </div>

          <div className="ui-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <h2 className="text-sm font-semibold">Return Materials</h2>
              <Button variant="secondary" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4" aria-hidden />
                Add Material
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="ui-table-head">
                  <tr>
                    {["S.No.", "Material", "Batch/Lot", "Avail.", "Return Qty", "Unit", "Condition", "Warehouse", "Reason", ""].map((h) => (
                      <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-soft)]">
                  {form.lines.map((ln, idx) => (
                    <tr key={ln.key}>
                      <td className="px-3 py-2">{idx + 1}</td>
                      <td className="min-w-[180px] px-3 py-2">
                        <Select
                          value={ln.item_id}
                          onChange={(e) => {
                            updateLine(ln.key, { item_id: e.target.value });
                            fetchAvailableQty(ln.key, e.target.value, ln.warehouse_id || form.return_to_warehouse_id);
                          }}
                        >
                          <option value="">Select</option>
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>{i.sku ? `${i.sku} — ` : ""}{i.name}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input value={ln.batch_number} onChange={(e) => updateLine(ln.key, { batch_number: e.target.value })} />
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatQty(ln.available_qty)}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          max={ln.available_qty || undefined}
                          value={ln.return_qty}
                          onChange={(e) => updateLine(ln.key, { return_qty: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">{ln.unit}</td>
                      <td className="px-3 py-2">
                        <Select value={ln.condition} onChange={(e) => updateLine(ln.key, { condition: e.target.value })}>
                          {CONDITIONS.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="min-w-[140px] px-3 py-2">
                        <Select
                          value={ln.warehouse_id || form.return_to_warehouse_id}
                          onChange={(e) => {
                            updateLine(ln.key, { warehouse_id: e.target.value });
                            fetchAvailableQty(ln.key, ln.item_id, e.target.value);
                          }}
                        >
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input value={ln.line_reason} onChange={(e) => updateLine(ln.key, { line_reason: e.target.value })} />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" className="text-[var(--color-danger)]" onClick={() => removeLine(ln.key)} aria-label="Remove row">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="ui-card p-4 lg:col-span-1">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Summary</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt>Total Materials</dt><dd className="font-semibold tabular-nums">{summary.total_materials}</dd></div>
                <div className="flex justify-between"><dt>Total Return Qty</dt><dd className="font-semibold tabular-nums">{formatQty(summary.total_return_qty)}</dd></div>
                <div className="flex justify-between"><dt>Good Qty</dt><dd className="font-semibold tabular-nums text-emerald-700">{formatQty(summary.good_qty)}</dd></div>
                <div className="flex justify-between"><dt>Damaged Qty</dt><dd className="font-semibold tabular-nums text-amber-700">{formatQty(summary.damaged_qty)}</dd></div>
                <div className="flex justify-between"><dt>Scrap Qty</dt><dd className="font-semibold tabular-nums text-slate-600">{formatQty(summary.scrap_qty)}</dd></div>
              </dl>
            </div>
            <div className="flex flex-wrap items-end justify-end gap-2 lg:col-span-2">
              <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }} disabled={submitting}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={() => saveReturn("draft")} disabled={submitting}>
                {submitting ? "Saving…" : "Save Draft"}
              </Button>
              <Button
                variant="primary"
                onClick={() => setConfirm({ action: "submit_form", status: "pending_verification" })}
                disabled={submitting}
              >
                Submit Return
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {viewTarget ? (
        <RecordDetailModal
          open={Boolean(viewTarget)}
          onClose={() => setViewTarget(null)}
          title={viewTarget.return_number}
          subtitle={returnTypeLabel(viewTarget.return_type)}
        >
          <WorkflowPipeline status={viewTarget.status} />
          <div className="mt-4 space-y-2 text-sm">
            <p><span className="text-[var(--color-text-muted)]">Department:</span> {viewTarget.department || "—"}</p>
            <p><span className="text-[var(--color-text-muted)]">Returned by:</span> {viewTarget.returned_by || "—"}</p>
            <p><span className="text-[var(--color-text-muted)]">Warehouse:</span> {viewTarget.return_to_warehouse || "—"}</p>
            <p><span className="text-[var(--color-text-muted)]">Status:</span>{" "}
              <StatusBadge tone={STATUS_TONE[viewTarget.status]} label={STATUS_LABEL[viewTarget.status]} />
            </p>
            {(viewTarget.lines || []).map((ln) => (
              <div key={ln.id} className="rounded-lg border border-[var(--color-border)] p-2">
                {ln.material_code} — {ln.material_name}: {formatQty(ln.return_qty)} {ln.unit} ({ln.condition})
              </div>
            ))}
          </div>
        </RecordDetailModal>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={
          confirm?.action === "reject"
            ? "Reject this return?"
            : confirm?.action === "cancel" || confirm?.action === "cancel_form"
              ? "Cancel this return?"
              : confirm?.action === "submit_form"
                ? "Submit return for verification?"
                : confirm?.action === "complete"
                  ? "Complete return and update stock?"
                  : "Confirm action"
        }
        message="This action will update the return workflow. Stock quantities are only adjusted when the return is completed."
        confirmLabel="Confirm"
        cancelLabel="Go back"
        variant={confirm?.action === "reject" || confirm?.action === "cancel" ? "danger" : "primary"}
        loading={submitting || Boolean(updatingId)}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.action === "submit_form") {
            setConfirm(null);
            saveReturn("pending_verification");
            return;
          }
          if (confirm?.row) {
            runStatusAction(confirm.row, confirm.status);
          }
        }}
      />
    </div>
  );
}
