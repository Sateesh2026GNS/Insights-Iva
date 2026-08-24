import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Filter,
  PackagePlus,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";

import Button from "../../components/common/Button";
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
  createStockIn,
  getInventoryDashboard,
  getStockIn,
  getStockIns,
  getStockReturns,
  getSuppliers,
  getWarehouses,
  updateStockIn,
  updateStockInStatus,
} from "../../api/inventoryApi";
import { getPurchaseOrdersEnriched } from "../../api/procurementApi";
import { asArray } from "../../utils/apiError";
import { toIsoDate } from "../../utils/dateUtils";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";

const REFERENCE_TYPES = [
  { value: "purchase_order", label: "Purchase Order" },
  { value: "purchase_receipt", label: "Purchase Receipt" },
  { value: "stock_return", label: "Stock Return" },
  { value: "manual_entry", label: "Manual Entry" },
  { value: "other", label: "Other" },
];

const STATUS_TONE = {
  draft: "neutral",
  pending: "warning",
  confirmed: "success",
  cancelled: "neutral",
};

const STATUS_LABEL = {
  draft: "Draft",
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

const emptyLine = () => ({
  key: crypto.randomUUID(),
  item_id: "",
  ordered_qty: "",
  received_qty: "",
  unit: "pcs",
  batch_number: "",
  lot_number: "",
  manufacturing_date: "",
  expiry_date: "",
  storage_location: "",
  line_remarks: "",
});

const emptyForm = () => ({
  stock_in_number: "",
  stock_in_date: toIsoDate(new Date()),
  reference_type: "purchase_order",
  reference_no: "",
  reference_id: null,
  supplier_id: "",
  supplier_name: "",
  warehouse_id: "",
  storage_location: "",
  received_by: "",
  remarks: "",
  attachments: [],
  status: "draft",
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

function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function refTypeLabel(value) {
  return REFERENCE_TYPES.find((t) => t.value === value)?.label || value;
}

function itemLabel(item) {
  const code = item.product_code || item.code || item.item_code || item.sku;
  const name = item.name || "Item";
  return code ? `${code} — ${name}` : name;
}

function itemDescription(item) {
  return item?.description || item?.name || "";
}

function buildStorageOptions(warehouse) {
  if (!warehouse) return [];
  const opts = [];
  const racks = Number(warehouse.rack_count) || 0;
  const bins = Number(warehouse.bin_count) || 0;
  for (let i = 1; i <= Math.min(racks, 20); i += 1) {
    opts.push(`Rack-${String(i).padStart(2, "0")}`);
  }
  for (let i = 1; i <= Math.min(bins, 20); i += 1) {
    opts.push(`Bin-${String(i).padStart(2, "0")}`);
  }
  if (warehouse.code) opts.push(`${warehouse.code}-Default`);
  return opts;
}

function canEditDoc(doc, perms) {
  if (!doc) return false;
  if (!["draft", "pending"].includes(doc.status)) return false;
  return perms.isAdmin || perms.canAction("inventory", "create");
}

function canConfirmDoc(doc, perms) {
  if (!doc) return perms.isAdmin || perms.canAction("inventory", "update");
  if (!["draft", "pending"].includes(doc.status)) return false;
  return perms.isAdmin || perms.canAction("inventory", "update");
}

function readFileAsAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({
        name: file.name,
        size: file.size,
        mime_type: file.type || "application/octet-stream",
        data_base64: base64,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function StoreStockIn() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const perms = usePermissions();
  const storeMode = isStoreManager(user);
  const [searchParams, setSearchParams] = useSearchParams();
  const formRef = useRef(null);
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [stockIns, setStockIns] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [stockReturns, setStockReturns] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [docStatus, setDocStatus] = useState("draft");
  const [showForm, setShowForm] = useState(() => searchParams.get("new") === "1");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewTarget, setViewTarget] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const canCreate = perms.isAdmin || perms.canAction("inventory", "create");
  const canConfirm = perms.isAdmin || perms.canAction("inventory", "update");
  const isReadOnly = Boolean(editingId && !["draft", "pending"].includes(docStatus));

  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => String(w.id) === String(form.warehouse_id)),
    [warehouses, form.warehouse_id]
  );

  const storageOptions = useMemo(
    () => buildStorageOptions(selectedWarehouse),
    [selectedWarehouse]
  );

  const summary = useMemo(() => {
    const lines = form.lines.filter((l) => l.item_id && Number(l.received_qty) > 0);
    const totalReceived = lines.reduce((sum, l) => sum + (Number(l.received_qty) || 0), 0);
    return {
      total_items: lines.length,
      total_received_qty: totalReceived,
      warehouse: selectedWarehouse?.name || "—",
      status: docStatus || form.status || "draft",
    };
  }, [form.lines, selectedWarehouse, docStatus, form.status]);

  const referenceOptions = useMemo(() => {
    if (form.reference_type === "purchase_order") {
      return purchaseOrders.map((po) => ({
        id: po.id,
        label: po.po_number || po.order_number || `PO-${po.id}`,
      }));
    }
    if (form.reference_type === "stock_return") {
      return stockReturns.map((sr) => ({
        id: sr.id,
        label: sr.return_number || `SR-${sr.id}`,
      }));
    }
    return [];
  }, [form.reference_type, purchaseOrders, stockReturns]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.reference_type = typeFilter;
      if (warehouseFilter) params.warehouse_id = Number(warehouseFilter);
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const [listRes, whRes, itemsRes, supRes, poRes, srRes] = await Promise.allSettled([
        getStockIns(params),
        getWarehouses(),
        getInventoryDashboard(),
        getSuppliers(),
        getPurchaseOrdersEnriched(),
        getStockReturns({ status: "completed" }),
      ]);

      if (listRes.status === "fulfilled") setStockIns(asArray(listRes.value?.data));
      if (whRes.status === "fulfilled") setWarehouses(asArray(whRes.value?.data));
      if (itemsRes.status === "fulfilled") setItems(asArray(itemsRes.value?.data));
      if (supRes.status === "fulfilled") setSuppliers(asArray(supRes.value?.data));
      if (poRes.status === "fulfilled") setPurchaseOrders(asArray(poRes.value?.data));
      if (srRes.status === "fulfilled") setStockReturns(asArray(srRes.value?.data));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, warehouseFilter, dateFrom, dateTo]);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!form.received_by && user?.full_name) {
      setForm((f) => ({ ...f, received_by: user.full_name }));
    }
    if (!form.warehouse_id && warehouses.length) {
      setForm((f) => ({ ...f, warehouse_id: String(warehouses[0].id) }));
    }
  }, [user, warehouses, form.received_by, form.warehouse_id]);

  useEffect(() => {
    if (searchParams.get("new") === "1") setShowForm(true);
    const idParam = searchParams.get("id");
    if (idParam && !editingId) {
      loadDocToForm({ id: Number(idParam) });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    const base = emptyForm();
    if (user?.full_name) base.received_by = user.full_name;
    if (warehouses.length) base.warehouse_id = String(warehouses[0].id);
    setForm(base);
    setEditingId(null);
    setDocStatus("draft");
    setFieldErrors({});
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
    setSearchParams({ new: "1" });
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
    setSearchParams({});
  };

  const loadDocToForm = async (row) => {
    try {
      const res = await getStockIn(row.id);
      const doc = res.data;
      setForm({
        stock_in_number: doc.stock_in_number,
        stock_in_date: doc.stock_in_date || toIsoDate(new Date()),
        reference_type: doc.reference_type,
        reference_no: doc.reference_no || "",
        reference_id: doc.reference_id,
        supplier_id: doc.supplier_id ? String(doc.supplier_id) : "",
        supplier_name: doc.supplier_name || "",
        warehouse_id: String(doc.warehouse_id),
        storage_location: doc.storage_location || "",
        received_by: doc.received_by || "",
        remarks: doc.remarks || "",
        attachments: doc.attachments || [],
        status: doc.status,
        lines: (doc.lines || []).length
          ? doc.lines.map((ln) => ({
              key: crypto.randomUUID(),
              item_id: String(ln.item_id),
              ordered_qty: ln.ordered_qty ? String(ln.ordered_qty) : "",
              received_qty: String(ln.received_qty),
              unit: ln.unit || "pcs",
              batch_number: ln.batch_number || "",
              lot_number: ln.lot_number || "",
              manufacturing_date: ln.manufacturing_date || "",
              expiry_date: ln.expiry_date || "",
              storage_location: ln.storage_location || "",
              line_remarks: ln.line_remarks || "",
            }))
          : [emptyLine()],
      });
      setEditingId(doc.id);
      setDocStatus(doc.status);
      setShowForm(true);
      setSearchParams({ id: String(doc.id) });
    } catch (err) {
      addToast(err?.response?.data?.detail || "Failed to load stock in", "error");
    }
  };

  const handleReferenceChange = (value) => {
    const ref = referenceOptions.find((r) => String(r.id) === value);
    setForm((f) => ({
      ...f,
      reference_no: ref?.label || "",
      reference_id: ref?.id || null,
    }));
  };

  const handleSupplierChange = (value) => {
    const sup = suppliers.find((s) => String(s.id) === value);
    setForm((f) => ({
      ...f,
      supplier_id: value,
      supplier_name: sup?.name || "",
    }));
  };

  const updateLine = (lineKey, patch) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((ln) => {
        if (ln.key !== lineKey) return ln;
        const next = { ...ln, ...patch };
        if (patch.item_id) {
          const item = items.find((i) => String(i.id) === String(patch.item_id));
          if (item) next.unit = item.unit || item.uom || "pcs";
        }
        return next;
      }),
    }));
  };

  const addLine = () => {
    setForm((f) => ({
      ...f,
      lines: [
        ...f.lines,
        { ...emptyLine(), storage_location: f.storage_location || "" },
      ],
    }));
  };

  const removeLine = (lineKey) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.length <= 1 ? f.lines : f.lines.filter((ln) => ln.key !== lineKey),
    }));
  };

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    try {
      const attachments = await Promise.all(files.map(readFileAsAttachment));
      setForm((f) => ({ ...f, attachments: [...f.attachments, ...attachments] }));
    } catch {
      addToast("Failed to read selected files.", "error");
    }
    event.target.value = "";
  };

  const removeAttachment = (index) => {
    setForm((f) => ({
      ...f,
      attachments: f.attachments.filter((_, i) => i !== index),
    }));
  };

  const validateForm = () => {
    const errors = {};
    if (!form.warehouse_id) errors.warehouse_id = "Warehouse is required.";
    if (!form.reference_type) errors.reference_type = "Reference type is required.";
    if (!form.stock_in_date) errors.stock_in_date = "Stock in date is required.";

    const validLines = form.lines.filter((l) => l.item_id && Number(l.received_qty) > 0);
    if (!validLines.length) {
      errors.lines = "Add at least one product with received quantity greater than zero.";
    }
    validLines.forEach((ln, idx) => {
      if (Number(ln.received_qty) <= 0) {
        errors[`line_${idx}_qty`] = "Received quantity must be greater than zero.";
      }
    });

    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      addToast(Object.values(errors)[0], "error");
      return false;
    }
    return true;
  };

  const buildPayload = (status) => ({
    stock_in_number: form.stock_in_number || undefined,
    stock_in_date: form.stock_in_date,
    reference_type: form.reference_type,
    reference_no: form.reference_no || null,
    reference_id: form.reference_id,
    supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
    supplier_name: form.supplier_name || null,
    warehouse_id: Number(form.warehouse_id),
    storage_location: form.storage_location || null,
    received_by: form.received_by,
    received_by_user_id: user?.id,
    remarks: form.remarks || null,
    attachments: form.attachments,
    status,
    lines: form.lines
      .filter((l) => l.item_id && Number(l.received_qty) > 0)
      .map((l) => ({
        item_id: Number(l.item_id),
        ordered_qty: Number(l.ordered_qty) || 0,
        received_qty: Number(l.received_qty),
        unit: l.unit || "pcs",
        batch_number: l.batch_number || null,
        lot_number: l.lot_number || null,
        manufacturing_date: l.manufacturing_date || null,
        expiry_date: l.expiry_date || null,
        storage_location: l.storage_location || form.storage_location || null,
        line_remarks: l.line_remarks || null,
      })),
  });

  const saveDraft = async () => {
    if (!canCreate) {
      addToast("You do not have permission to save stock in.", "error");
      return;
    }
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const payload = buildPayload("draft");
      if (editingId) {
        await updateStockIn(editingId, payload);
        addToast("Draft saved.");
      } else {
        const res = await createStockIn(payload);
        setEditingId(res.data.id);
        setForm((f) => ({ ...f, stock_in_number: res.data.stock_in_number }));
        setDocStatus("draft");
        setSearchParams({ id: String(res.data.id) });
        addToast("Draft created.");
      }
      load(true);
    } catch (err) {
      addToast(err?.response?.data?.detail || "Failed to save draft", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmStockIn = async () => {
    if (!canConfirm) {
      addToast("You do not have permission to confirm stock in.", "error");
      return;
    }
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      let docId = editingId;
      const payload = buildPayload("draft");
      if (docId) {
        await updateStockIn(docId, payload);
      } else {
        const res = await createStockIn(payload);
        docId = res.data.id;
        setEditingId(docId);
        setForm((f) => ({ ...f, stock_in_number: res.data.stock_in_number }));
      }
      const confirmed = await updateStockInStatus(docId, { status: "confirmed" });
      addToast(`Stock In ${confirmed.data.stock_in_number} confirmed. Inventory updated.`);
      notifyManufacturingSpine(MANUFACTURING_EVENTS.INVENTORY_CHANGED, { stock_in_id: docId });
      closeForm();
      load(true);
    } catch (err) {
      addToast(err?.response?.data?.detail || "Failed to confirm stock in", "error");
    } finally {
      setSubmitting(false);
      setConfirm(null);
    }
  };

  const runCancel = async (row) => {
    setUpdatingId(row.id);
    try {
      await updateStockInStatus(row.id, { status: "cancelled" });
      addToast("Stock in cancelled.");
      load(true);
    } catch (err) {
      addToast(err?.response?.data?.detail || "Cancel failed", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleView = async (row) => {
    try {
      const res = await getStockIn(row.id);
      setViewTarget(res.data);
    } catch {
      setViewTarget(row);
    }
  };

  const columns = [
    { key: "stock_in_number", label: "Stock In No.", sortable: true },
    { key: "stock_in_date", label: "Date", render: (r) => formatDate(r.stock_in_date) },
    { key: "reference_type", label: "Reference Type", render: (r) => refTypeLabel(r.reference_type) },
    { key: "reference_no", label: "Reference No." },
    { key: "supplier_name", label: "Supplier" },
    { key: "warehouse_name", label: "Warehouse" },
    { key: "received_by", label: "Received By" },
    { key: "total_qty", label: "Total Qty", render: (r) => formatQty(r.total_qty) },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusBadge tone={STATUS_TONE[r.status] || "neutral"} label={STATUS_LABEL[r.status] || r.status} />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleView(row)}>
            View
          </Button>
          {canEditDoc(row, perms) ? (
            <Button variant="ghost" size="sm" onClick={() => loadDocToForm(row)}>
              Edit
            </Button>
          ) : null}
          {canConfirmDoc(row, perms) ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={updatingId === row.id}
              onClick={() => setConfirm({ row, mode: "confirm" })}
            >
              Confirm
            </Button>
          ) : null}
          {canEditDoc(row, perms) ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={updatingId === row.id}
              onClick={() => runCancel(row)}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const headerActions = showForm ? (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={closeForm}>
        Back to Stock
      </Button>
      {!isReadOnly && canCreate ? (
        <Button variant="secondary" onClick={saveDraft} disabled={submitting}>
          Save Draft
        </Button>
      ) : null}
      {!isReadOnly && canConfirm ? (
        <Button variant="primary" onClick={() => setConfirm({ mode: "form-confirm" })} disabled={submitting}>
          {submitting ? "Processing…" : "Confirm Stock In"}
        </Button>
      ) : null}
    </div>
  ) : (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => load(true)} disabled={loading}>
        <RefreshCw className="h-4 w-4" aria-hidden />
        Refresh
      </Button>
      {canCreate ? (
        <Button variant="primary" onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          New Stock In
        </Button>
      ) : null}
    </div>
  );

  if (loading && !stockIns.length && !showForm) {
    return (
      <div className="space-y-6 pb-8">
        {storeMode ? <StoreManagerNav /> : null}
        <Loader label="Loading Stock In…" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {storeMode ? <StoreManagerNav /> : null}

      <PageHeader
        showTitle
        title="Stock In"
        subtitle="Receive materials/products into inventory and update available stock."
        backTo={showForm ? undefined : "/inventory/stock-ledger"}
        backLabel={showForm ? undefined : "Back to Stock"}
        action={headerActions}
      />

      {!showForm ? (
        <>
          <div className="ui-card p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search stock in no., reference, supplier…"
                  className="ui-input w-full pl-9"
                />
              </div>
              <Button variant="secondary" onClick={() => setShowFilters((v) => !v)}>
                <Filter className="h-4 w-4" aria-hidden />
                Filters
              </Button>
            </div>
            {showFilters ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label="Status">
                  <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All</option>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Reference Type">
                  <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option value="">All</option>
                    {REFERENCE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
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

          {stockIns.length === 0 ? (
            <EmptyState
              icon={PackagePlus}
              title="No stock in transactions yet"
              description="Receive materials into a warehouse. Inventory updates only after confirmation."
              action={canCreate ? <Button variant="primary" onClick={openCreate}>Create Stock In</Button> : null}
            />
          ) : (
            <DataTable columns={columns} data={stockIns} rowKey="id" />
          )}
        </>
      ) : null}

      {showForm ? (
        <div ref={formRef} className="space-y-4">
          <div className="ui-card p-4 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">Stock In Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Stock In No." required hint="Auto-generated on save">
                <Input
                  value={form.stock_in_number}
                  placeholder="SIN-2026-00001"
                  readOnly
                  disabled
                />
              </FormField>
              <DatePicker
                label="Stock In Date"
                value={form.stock_in_date}
                onChange={(v) => setForm((f) => ({ ...f, stock_in_date: v }))}
                required
                disabled={isReadOnly}
                error={fieldErrors.stock_in_date}
              />
              <FormField label="Reference Type" required error={fieldErrors.reference_type}>
                <Select
                  value={form.reference_type}
                  disabled={isReadOnly}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    reference_type: e.target.value,
                    reference_no: "",
                    reference_id: null,
                  }))}
                >
                  {REFERENCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Reference No." hint="Related purchase order, receipt or return">
                {referenceOptions.length ? (
                  <Select
                    value={form.reference_id ? String(form.reference_id) : ""}
                    disabled={isReadOnly}
                    onChange={(e) => handleReferenceChange(e.target.value)}
                  >
                    <option value="">Select reference document</option>
                    {referenceOptions.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={form.reference_no}
                    disabled={isReadOnly}
                    placeholder="PO-2026-00452"
                    onChange={(e) => setForm((f) => ({ ...f, reference_no: e.target.value }))}
                  />
                )}
              </FormField>
              <FormField label="Supplier / Vendor">
                <Select
                  value={form.supplier_id}
                  disabled={isReadOnly}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                >
                  <option value="">Select vendor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Warehouse" required error={fieldErrors.warehouse_id}>
                <Select
                  value={form.warehouse_id}
                  disabled={isReadOnly}
                  onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Storage Location" hint="Rack, bin or zone within warehouse">
                <Select
                  value={form.storage_location}
                  disabled={isReadOnly}
                  onChange={(e) => setForm((f) => ({ ...f, storage_location: e.target.value }))}
                >
                  <option value="">Select location</option>
                  {storageOptions.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Received By" hint="Logged-in user">
                <Input value={form.received_by} readOnly disabled />
              </FormField>
            </div>
          </div>

          <div className="ui-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <h2 className="text-sm font-semibold">Material / Product Details</h2>
              {!isReadOnly ? (
                <Button variant="secondary" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add Item
                </Button>
              ) : null}
            </div>
            {fieldErrors.lines ? (
              <p className="px-4 pt-3 text-sm text-red-600" role="alert">{fieldErrors.lines}</p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  <tr>
                    {[
                      "S.No.",
                      "Product / Material",
                      "Product Code",
                      "Description",
                      "Ordered Qty",
                      "Received Qty",
                      "Unit",
                      "Batch No.",
                      "Lot No.",
                      "Mfg Date",
                      "Expiry",
                      "Storage",
                      "Remarks",
                      "",
                    ].map((h) => (
                      <th key={h || "action"} className="px-2 py-2 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-soft)]">
                  {form.lines.map((ln, idx) => {
                    const item = items.find((i) => String(i.id) === String(ln.item_id));
                    return (
                      <tr key={ln.key}>
                        <td className="px-2 py-2">{idx + 1}</td>
                        <td className="min-w-[160px] px-2 py-2">
                          <Select
                            value={ln.item_id}
                            disabled={isReadOnly}
                            onChange={(e) => updateLine(ln.key, { item_id: e.target.value })}
                          >
                            <option value="">Select product</option>
                            {items.map((i) => (
                              <option key={i.id} value={i.id}>{itemLabel(i)}</option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-2 py-2 text-[var(--color-text-muted)]">
                          {item?.sku || item?.product_code || "—"}
                        </td>
                        <td className="min-w-[120px] px-2 py-2 text-[var(--color-text-muted)]">
                          {itemDescription(item) || "—"}
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min="0"
                            disabled={isReadOnly}
                            value={ln.ordered_qty}
                            onChange={(e) => updateLine(ln.key, { ordered_qty: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min="1"
                            required
                            disabled={isReadOnly}
                            value={ln.received_qty}
                            onChange={(e) => updateLine(ln.key, { received_qty: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">{ln.unit}</td>
                        <td className="px-2 py-2">
                          <Input
                            disabled={isReadOnly}
                            value={ln.batch_number}
                            onChange={(e) => updateLine(ln.key, { batch_number: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            disabled={isReadOnly}
                            value={ln.lot_number}
                            onChange={(e) => updateLine(ln.key, { lot_number: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-2 min-w-[130px]">
                          <Input
                            type="date"
                            disabled={isReadOnly}
                            value={ln.manufacturing_date}
                            onChange={(e) => updateLine(ln.key, { manufacturing_date: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-2 min-w-[130px]">
                          <Input
                            type="date"
                            disabled={isReadOnly}
                            value={ln.expiry_date}
                            onChange={(e) => updateLine(ln.key, { expiry_date: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-2 min-w-[120px]">
                          <Select
                            value={ln.storage_location}
                            disabled={isReadOnly}
                            onChange={(e) => updateLine(ln.key, { storage_location: e.target.value })}
                          >
                            <option value="">—</option>
                            {storageOptions.map((loc) => (
                              <option key={loc} value={loc}>{loc}</option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            disabled={isReadOnly}
                            value={ln.line_remarks}
                            onChange={(e) => updateLine(ln.key, { line_remarks: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          {!isReadOnly ? (
                            <button
                              type="button"
                              className="rounded p-1 text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-600"
                              onClick={() => removeLine(ln.key)}
                              aria-label="Remove line"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="ui-card p-4 lg:col-span-1">
              <h2 className="mb-3 text-sm font-semibold">Stock Summary</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--color-text-muted)]">Total Items</dt>
                  <dd className="font-semibold tabular-nums">{summary.total_items}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--color-text-muted)]">Total Received Qty</dt>
                  <dd className="font-semibold tabular-nums">{formatQty(summary.total_received_qty)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--color-text-muted)]">Warehouse</dt>
                  <dd className="font-medium">{summary.warehouse}</dd>
                </div>
                <div className="flex justify-between gap-2 items-center">
                  <dt className="text-[var(--color-text-muted)]">Stock In Status</dt>
                  <dd>
                    <StatusBadge
                      tone={STATUS_TONE[summary.status] || "neutral"}
                      label={STATUS_LABEL[summary.status] || summary.status}
                    />
                  </dd>
                </div>
              </dl>
            </div>

            <div className="ui-card p-4 lg:col-span-2">
              <FormField label="Remarks">
                <Textarea
                  rows={4}
                  disabled={isReadOnly}
                  placeholder="Enter receiving notes, inspection remarks or special instructions…"
                  value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                />
              </FormField>
            </div>
          </div>

          <div className="ui-card p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Attachments</h2>
              {!isReadOnly ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                    onChange={handleFilesSelected}
                  />
                  <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" aria-hidden />
                    Upload
                  </Button>
                </>
              ) : null}
            </div>
            <p className="mb-3 text-xs text-[var(--color-text-muted)]">
              Purchase invoice, delivery challan, material receipt or other supporting documents (optional).
            </p>
            {form.attachments.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No files attached.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border-soft)] rounded-lg border border-[var(--color-border)]">
                {form.attachments.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <Paperclip className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                      <span className="truncate font-medium">{file.name}</span>
                      <span className="shrink-0 text-[var(--color-text-muted)]">{formatFileSize(file.size)}</span>
                    </div>
                    {!isReadOnly ? (
                      <button
                        type="button"
                        className="text-[var(--color-text-muted)] hover:text-red-600"
                        onClick={() => removeAttachment(index)}
                        aria-label={`Remove ${file.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button variant="secondary" onClick={closeForm} disabled={submitting}>
              Cancel
            </Button>
            {!isReadOnly && canCreate ? (
              <Button variant="secondary" onClick={saveDraft} disabled={submitting}>
                {submitting ? "Saving…" : "Save Draft"}
              </Button>
            ) : null}
            {!isReadOnly && canConfirm ? (
              <Button
                variant="primary"
                onClick={() => setConfirm({ mode: "form-confirm" })}
                disabled={submitting}
              >
                {submitting ? "Processing…" : "Confirm Stock In"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {viewTarget ? (
        <RecordDetailModal
          open={Boolean(viewTarget)}
          onClose={() => setViewTarget(null)}
          title={viewTarget.stock_in_number || "Stock In"}
          subtitle={refTypeLabel(viewTarget.reference_type)}
          fields={[
            { label: "Date", value: formatDate(viewTarget.stock_in_date) },
            { label: "Reference No.", value: viewTarget.reference_no || "—" },
            { label: "Supplier", value: viewTarget.supplier_name || "—" },
            { label: "Warehouse", value: viewTarget.warehouse_name || "—" },
            { label: "Received By", value: viewTarget.received_by || "—" },
            { label: "Total Qty", value: formatQty(viewTarget.total_qty) },
            {
              label: "Status",
              value: (
                <StatusBadge
                  tone={STATUS_TONE[viewTarget.status] || "neutral"}
                  label={STATUS_LABEL[viewTarget.status] || viewTarget.status}
                />
              ),
            },
            { label: "Remarks", value: viewTarget.remarks || "—" },
          ]}
        />
      ) : null}

      {confirm ? (
        <ConfirmDialog
          open
          title={confirm.mode === "form-confirm" ? "Confirm Stock In?" : "Confirm this stock in?"}
          message="This will update inventory quantities and create stock movement entries. This action cannot be undone."
          confirmLabel="Confirm Stock In"
          onConfirm={() => {
            if (confirm.mode === "form-confirm") {
              confirmStockIn();
            } else {
              setSubmitting(true);
              updateStockInStatus(confirm.row.id, { status: "confirmed" })
                .then(() => {
                  addToast("Stock in confirmed.");
                  load(true);
                })
                .catch((err) => addToast(err?.response?.data?.detail || "Confirm failed", "error"))
                .finally(() => {
                  setSubmitting(false);
                  setConfirm(null);
                });
            }
          }}
          onCancel={() => setConfirm(null)}
          loading={submitting}
        />
      ) : null}
    </div>
  );
}
