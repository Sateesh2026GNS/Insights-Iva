import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import usePageRefresh from "../../hooks/usePageRefresh";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cog,
  Eye,
  History,
  MoreVertical,
  Package,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

import Button from "../../components/common/Button";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import ExportDownloadMenu from "../../components/common/ExportDownloadMenu";
import RowActionMenu from "../../components/common/RowActionMenu";
import { ListPageCard, ListPageCardBody } from "../../components/common/ListPageShell";
import InventoryPlanningShell from "../../components/inventory/InventoryPlanningShell";
import EmptyState from "../../components/common/EmptyState";
import { SearchBar } from "../../components/common/SearchFilter";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import CreateMachineModal from "../../components/production/CreateMachineModal";
import MachineDetailModal from "../../components/production/MachineDetailModal";
import MaintenanceErrorState from "../../components/maintenance/MaintenanceErrorState";
import MaintenanceKpiCard from "../../components/maintenance/MaintenanceKpiCard";
import { getMaintenanceHub } from "../../api/maintenanceApi";
import { deleteMachine, getMachineDetail, getMachines } from "../../api/productionApi";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";
import { exportToExcel, exportToPdf } from "../../utils/exportUtils";
import {
  computeMonthTrend,
  equipmentStatusBadgeClass,
  equipmentStatusLabel,
  formatInr,
  pctOfTotal,
} from "../../data/maintenanceMasterData";

const PAGE_SIZE = 5;

const DEFAULT_CATEGORIES = [
  "CNC Machining",
  "Cutting & Slitting",
  "Stamping & Pressing",
  "Welding & Fabrication",
  "Hydraulic Press",
  "Heat Treatment",
  "Surface Coating",
  "Assembly Line",
  "Packaging",
];

const DEFAULT_LOCATIONS = [
  "Floor A - Bay 1",
  "Floor A - Bay 2",
  "Floor B - Bay 1",
  "Floor B - Bay 2",
  "Tool Room",
  "Warehouse - Rack 1",
  "Warehouse - Bay 3",
  "Assembly Section",
];

const DEFAULT_BRANDS = [
  "Haas Automation",
  "Trumpf",
  "Amada",
  "Mazak",
  "DMG Mori",
  "Bystronic",
  "Siemens",
  "ABB",
  "Doosan",
];

const STATUS_EQUIPMENT_OPTIONS = [
  { value: "running", label: "Running" },
  { value: "maintenance", label: "Under Maintenance" },
  { value: "breakdown", label: "Out of Service" },
  { value: "idle", label: "Idle" },
];

const STATUS_SPARE_OPTIONS = [
  { value: "in_stock", label: "In Stock" },
  { value: "low_stock", label: "Low Stock" },
];

function MultiSelectDropdown({
  label,
  options = [],
  selected = [],
  onChange,
  placeholder = "Search...",
  minWidth = "min-w-[9.5rem] w-full",
  alignRight = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const normalizedOptions = useMemo(() => {
    return options.map((opt) =>
      typeof opt === "string" ? { value: opt, label: opt } : opt
    );
  }, [options]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(q) || String(opt.value).toLowerCase().includes(q)
    );
  }, [normalizedOptions, query]);

  const toggleOption = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const selectAll = () => {
    onChange(normalizedOptions.map((opt) => opt.value));
  };

  const clearAll = () => {
    onChange([]);
  };

  const count = selected.length;
  const triggerLabel = count > 0 ? `${label} (${count})` : `All ${label}`;

  return (
    <div className="relative w-full" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-[38px] items-center justify-between gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer shadow-2xs ${
          count > 0
            ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]/20 text-[var(--color-primary)] font-semibold"
            : "border-[var(--color-border-soft)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
        } ${minWidth}`}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute top-[calc(100%+4px)] z-50 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl animate-in fade-in zoom-in-95 duration-100 ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          {normalizedOptions.length > 5 && (
            <div className="mb-2 px-1">
              <SearchBar
                size="compact"
                value={query}
                onChange={setQuery}
                placeholder={placeholder}
              />
            </div>
          )}

          <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-2 py-1 text-[11px]">
            <button
              type="button"
              onClick={selectAll}
              className="font-medium text-[var(--color-primary)] hover:underline cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-[var(--color-text-muted)] hover:text-red-600 cursor-pointer"
            >
              Clear
            </button>
          </div>

          <div className="max-h-52 overflow-y-auto pt-1 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-[var(--color-text-muted)]">No options found</p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-medium"
                        : "text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOption(opt.value)}
                      className="h-4 w-4 rounded border-[var(--color-border-soft)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                    />
                    <span className="truncate">{opt.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddSparePartModal({ open, onClose, onSaved }) {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    part_number: `SP-${Date.now().toString().slice(-4)}`,
    spare_name: "",
    category: "Mechanical",
    stock: 10,
    minimum_stock: 5,
    unit_cost: "",
    vendor: "",
    location: "Warehouse - Rack 1",
  });

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.spare_name.trim()) {
      addToast("Please enter a spare part name", "error");
      return;
    }
    setSaving(true);
    const newPart = {
      id: Date.now(),
      part_number: formData.part_number.trim() || `SP-${Date.now().toString().slice(-4)}`,
      spare_name: formData.spare_name.trim(),
      category: formData.category,
      stock: Number(formData.stock) || 0,
      minimum_stock: Number(formData.minimum_stock) || 0,
      is_low_stock: (Number(formData.stock) || 0) <= (Number(formData.minimum_stock) || 0),
      unit_cost: Number(formData.unit_cost) || 0,
      vendor: formData.vendor.trim() || "Approved Supplier",
      location: formData.location.trim() || "Warehouse - Rack 1",
    };
    onSaved(newPart);
    addToast(`Spare part "${newPart.spare_name}" added successfully`, "success");
    setSaving(false);
    onClose();
  };

  return (
    <div className="ui-modal-backdrop">
      <div className="ui-modal max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text)]">Add Spare Part</h2>
              <p className="text-xs text-[var(--color-text-muted)]">Record a new spare part in equipment inventory</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ui-label">
                Part Number / SKU <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.part_number}
                onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                className="ui-input w-full"
              />
            </div>
            <div>
              <label className="ui-label">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="ui-select w-full"
              >
                <option value="Mechanical">Mechanical</option>
                <option value="Electrical">Electrical</option>
                <option value="Hydraulic">Hydraulic</option>
                <option value="Pneumatic">Pneumatic</option>
                <option value="Consumable">Consumable</option>
                <option value="Electronic">Electronic</option>
              </select>
            </div>
          </div>

          <div>
            <label className="ui-label">
              Spare Part Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Deep Groove Ball Bearing 6205-2RS"
              value={formData.spare_name}
              onChange={(e) => setFormData({ ...formData, spare_name: e.target.value })}
              className="ui-input w-full"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="ui-label">Stock Qty</label>
              <input
                type="number"
                min="0"
                required
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                className="ui-input w-full"
              />
            </div>
            <div>
              <label className="ui-label">Min. Stock</label>
              <input
                type="number"
                min="0"
                required
                value={formData.minimum_stock}
                onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
                className="ui-input w-full"
              />
            </div>
            <div>
              <label className="ui-label">Unit Cost (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="450"
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                className="ui-input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ui-label">Vendor / Supplier</label>
              <input
                type="text"
                placeholder="e.g. SKF Bearings India"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                className="ui-input w-full"
              />
            </div>
            <div>
              <label className="ui-label">Storage Location</label>
              <input
                type="text"
                placeholder="e.g. Warehouse - Rack 1 / Shelf B"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="ui-input w-full"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--color-border-soft)] pt-4">
            <Button type="button" variant="cancel" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving..." : "Add Spare Part"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SparePartDetailModal({ part, onClose }) {
  if (!part) return null;
  const isLowStock = Boolean(part.is_low_stock || Number(part.stock) <= Number(part.minimum_stock));

  return (
    <div className="ui-modal-backdrop">
      <div className="ui-modal max-w-md w-full">
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[var(--color-text)] truncate">{part.spare_name}</h2>
              <p className="text-xs text-[var(--color-text-muted)] font-mono">{part.part_number}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/40 p-3">
              <span className="text-[11px] font-medium text-[var(--color-text-muted)]">Current Stock</span>
              <p className="mt-1 text-xl font-bold text-[var(--color-text)] tabular-nums">{part.stock}</p>
            </div>
            <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/40 p-3">
              <span className="text-[11px] font-medium text-[var(--color-text-muted)]">Minimum Stock</span>
              <p className="mt-1 text-xl font-bold text-[var(--color-text-secondary)] tabular-nums">{part.minimum_stock}</p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border-soft)] divide-y divide-[var(--color-border-soft)] text-[13px]">
            <div className="flex items-center justify-between p-3">
              <span className="text-[var(--color-text-muted)]">Category</span>
              <span className="font-semibold text-[var(--color-text)]">{part.category || "Mechanical"}</span>
            </div>
            <div className="flex items-center justify-between p-3">
              <span className="text-[var(--color-text-muted)]">Status</span>
              <span
                className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  isLowStock ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                }`}
              >
                {isLowStock ? "Low Stock (Reorder Needed)" : "In Stock (Healthy)"}
              </span>
            </div>
            <div className="flex items-center justify-between p-3">
              <span className="text-[var(--color-text-muted)]">Unit Cost</span>
              <span className="font-semibold text-[var(--color-text)] tabular-nums">{formatInr(part.cost || part.unit_cost)}</span>
            </div>
            <div className="flex items-center justify-between p-3">
              <span className="text-[var(--color-text-muted)]">Supplier / Vendor</span>
              <span className="font-medium text-[var(--color-text)]">{part.vendor || "Approved Supplier"}</span>
            </div>
            <div className="flex items-center justify-between p-3">
              <span className="text-[var(--color-text-muted)]">Storage Location</span>
              <span className="font-medium text-[var(--color-text)]">{part.location || "Warehouse - Rack 1"}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end border-t border-[var(--color-border-soft)] pt-3">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function normalizeMachineStatus(status) {
  const s = String(status || "idle").toLowerCase();
  if (s === "under_maintenance") return "maintenance";
  if (s === "down" || s === "fault") return "breakdown";
  return s;
}

function spareStockBadge(stock, min) {
  const low = Number(stock) <= Number(min);
  if (low) return "bg-[var(--kpi-orange-soft)] text-[var(--kpi-orange)]";
  return "bg-[var(--kpi-success-soft)] text-[var(--kpi-success)]";
}

export default function EquipmentSpareParts() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [machines, setMachines] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [activeTab, setActiveTab] = useState("equipment");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [locationFilter, setLocationFilter] = useState([]);
  const [brandFilter, setBrandFilter] = useState([]);
  const [vendorFilter, setVendorFilter] = useState([]);
  const [page, setPage] = useState(1);
  const [showAddEquipmentModal, setShowAddEquipmentModal] = useState(false);
  const [showAddSpareModal, setShowAddSpareModal] = useState(false);
  const [editMachine, setEditMachine] = useState(null);
  const [viewMachine, setViewMachine] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [viewSpare, setViewSpare] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }
  }, [showMoreMenu]);

  const load = useCallback(async (isRefresh = false, retryCount = 0) => {
    if (!isRefresh && retryCount === 0) setLoading(true);
    if (retryCount === 0) setError(null);
    try {
      const [mRes, hubRes] = await Promise.allSettled([getMachines(), getMaintenanceHub()]);
      if (mRes.status === "fulfilled") {
        const rows = Array.isArray(mRes.value?.data) ? mRes.value.data : [];
        setMachines(rows);
      } else {
        setMachines([]);
      }
      if (hubRes.status === "fulfilled" && hubRes.value?.data) {
        setSpareParts(hubRes.value.data.spare_parts || []);
      } else {
        setSpareParts([]);
      }
      setError(null);
    } catch (e) {
      if (isRefresh) throw e;
      setMachines([]);
      setSpareParts([]);
      setError(e?.message || "Failed to load equipment and spare parts");
    } finally {
      if (retryCount === 0) setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  const openMachineView = async (row) => {
    if (!row?.id) {
      addToast("Invalid machine record", "error");
      return;
    }
    setDetailLoading(true);
    try {
      const res = await getMachineDetail(row.id);
      setViewMachine(row);
      setViewDetail(res?.data || row);
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to load machine details"), "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await deleteMachine(deleteTarget.id);
      addToast(`Machine "${deleteTarget.name || deleteTarget.code}" deleted`, "success");
      setDeleteTarget(null);
      await load(true);
    } catch (err) {
      addToast(apiErrorMessage(err, "Failed to delete machine"), "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = (format) => {
    if (activeTab === "equipment") {
      const rows = filteredEquipment.map((m) => ({
        code: m.code || `EQ-${m.id}`,
        name: m.name,
        type: m.machine_type || "Machining",
        manufacturer: m.manufacturer || "Haas",
        location: m.location || "Floor A",
        status: m.display_status || m.status || "Running",
      }));
      const cols = [
        { key: "code", label: "Equipment ID" },
        { key: "name", label: "Equipment Name" },
        { key: "type", label: "Category" },
        { key: "manufacturer", label: "Manufacturer" },
        { key: "location", label: "Location" },
        { key: "status", label: "Status" },
      ];
      if (format === "pdf") {
        exportToPdf(rows, cols, "Equipment Inventory", "equipment-inventory");
      } else {
        exportToExcel(rows, cols, "equipment-inventory");
      }
    } else {
      const rows = filteredSpares.map((p) => ({
        part_number: p.part_number,
        spare_name: p.spare_name,
        category: p.category || "Mechanical",
        stock: p.stock,
        minimum_stock: p.minimum_stock,
        vendor: p.vendor || "Approved Supplier",
        location: p.location || "Warehouse",
        status: p.is_low_stock ? "Low Stock" : "In Stock",
      }));
      const cols = [
        { key: "part_number", label: "Part Number" },
        { key: "spare_name", label: "Spare Part Name" },
        { key: "category", label: "Category" },
        { key: "stock", label: "Stock" },
        { key: "minimum_stock", label: "Min Stock" },
        { key: "vendor", label: "Vendor" },
        { key: "location", label: "Location" },
        { key: "status", label: "Status" },
      ];
      if (format === "pdf") {
        exportToPdf(rows, cols, "Spare Parts Inventory", "spare-parts-inventory");
      } else {
        exportToExcel(rows, cols, "spare-parts-inventory");
      }
    }
    addToast(format === "pdf" ? "Exported to PDF" : "Exported to Excel", "success");
  };

  const totalEquipment = machines.length;
  const running = machines.filter((m) => normalizeMachineStatus(m.display_status || m.status) === "running").length;
  const underMaint = machines.filter((m) => normalizeMachineStatus(m.display_status || m.status) === "maintenance").length;
  const outOfService = machines.filter((m) => normalizeMachineStatus(m.display_status || m.status) === "breakdown").length;
  const totalSpare = spareParts.length;
  const lowStock = spareParts.filter((p) => p.is_low_stock).length;

  const categories = useMemo(() => {
    const set = new Set([...DEFAULT_CATEGORIES, ...machines.map((m) => m.machine_type).filter(Boolean)]);
    return [...set].sort();
  }, [machines]);

  const locations = useMemo(() => {
    const set = new Set([...DEFAULT_LOCATIONS, ...machines.map((m) => m.location).filter(Boolean)]);
    return [...set].sort();
  }, [machines]);

  const brands = useMemo(() => {
    const set = new Set([...DEFAULT_BRANDS, ...machines.map((m) => m.manufacturer).filter(Boolean)]);
    return [...set].sort();
  }, [machines]);

  const spareCategories = useMemo(() => {
    const set = new Set([
      "Mechanical",
      "Electrical",
      "Hydraulic",
      "Pneumatic",
      "Consumable",
      "Electronic",
      ...spareParts.map((p) => p.category).filter(Boolean),
    ]);
    return [...set].sort();
  }, [spareParts]);

  const spareLocations = useMemo(() => {
    const set = new Set([
      ...DEFAULT_LOCATIONS,
      ...spareParts.map((p) => p.location).filter(Boolean),
    ]);
    return [...set].sort();
  }, [spareParts]);

  const spareVendors = useMemo(() => {
    const set = new Set(spareParts.map((p) => p.vendor).filter(Boolean));
    return [...set].sort();
  }, [spareParts]);

  const filteredEquipment = useMemo(() => {
    const q = search.trim().toLowerCase();
    return machines.filter((m) => {
      const status = normalizeMachineStatus(m.display_status || m.status);
      if (statusFilter.length > 0 && !statusFilter.includes(status)) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(m.machine_type)) return false;
      if (locationFilter.length > 0 && !locationFilter.includes(m.location)) return false;
      if (brandFilter.length > 0 && !brandFilter.includes(m.manufacturer)) return false;
      if (
        q &&
        ![m.name, m.code, m.manufacturer, m.location, m.machine_type].some((v) =>
          String(v || "").toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      return true;
    });
  }, [machines, search, statusFilter, categoryFilter, locationFilter, brandFilter]);

  const filteredSpares = useMemo(() => {
    const q = search.trim().toLowerCase();
    return spareParts.filter((p) => {
      const statusKey = p.is_low_stock ? "low_stock" : "in_stock";
      if (statusFilter.length > 0 && !statusFilter.includes(statusKey)) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(p.category)) return false;
      if (locationFilter.length > 0 && !locationFilter.includes(p.location)) return false;
      if (vendorFilter.length > 0 && !vendorFilter.includes(p.vendor)) return false;
      if (
        q &&
        ![p.spare_name, p.part_number, p.vendor, p.location, p.category].some((v) =>
          String(v || "").toLowerCase().includes(q)
        )
      ) {
        return false;
      }
      return true;
    });
  }, [spareParts, search, statusFilter, categoryFilter, locationFilter, vendorFilter]);

  const activeRows = activeTab === "equipment" ? filteredEquipment : filteredSpares;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const pageRows = activeRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = activeRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, activeRows.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, activeTab]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setPage(1);
    setStatusFilter([]);
    setCategoryFilter([]);
    setLocationFilter([]);
    setBrandFilter([]);
    setVendorFilter([]);
  };

  const hasActiveFilters = Boolean(
    search ||
      statusFilter.length > 0 ||
      categoryFilter.length > 0 ||
      locationFilter.length > 0 ||
      brandFilter.length > 0 ||
      vendorFilter.length > 0
  );

  const resetFilters = () => {
    setSearch("");
    setStatusFilter([]);
    setCategoryFilter([]);
    setLocationFilter([]);
    setBrandFilter([]);
    setVendorFilter([]);
    setPage(1);
  };

  const equipmentTrend = computeMonthTrend(machines, { dateKey: "created_at" });

  if (loading) {
    return (
      <InventoryPlanningShell theme="indigo" kicker="Equip · Spare · Service" title="EQUIPMENT" accent="SPARES">
        <Loader label="Loading equipment & spare parts..." />
      </InventoryPlanningShell>
    );
  }
  if (error) {
    return (
      <InventoryPlanningShell theme="indigo" kicker="Equip · Spare · Service" title="EQUIPMENT" accent="SPARES">
        <MaintenanceErrorState message={error} onRetry={() => load()} />
      </InventoryPlanningShell>
    );
  }

  return (
    <InventoryPlanningShell theme="indigo" kicker="Equip · Spare · Service" title="EQUIPMENT" accent="SPARES">
      <div className="min-w-0 space-y-5 pb-5">
        <PageHeader
          title="Equipment & Spare Parts"
          showTitle
          backTo="/maintenance"
          backLabel="Maintenance"
          subtitle="Manage all plant equipment and spare parts inventory"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="add"
                onClick={() => {
                  if (activeTab === "equipment") {
                    setEditMachine(null);
                    setShowAddEquipmentModal(true);
                  } else {
                    setShowAddSpareModal(true);
                  }
                }}
                leftIcon={<Plus className="h-4 w-4" aria-hidden />}
              >
                {activeTab === "equipment" ? "Add Machine" : "Add Spare Part"}
              </Button>
              <ExportDownloadMenu
                disabled={activeTab === "equipment" ? !filteredEquipment.length : !filteredSpares.length}
                onExport={handleExport}
              />
              <div className="relative" ref={moreMenuRef}>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setShowMoreMenu((v) => !v)}
                  rightIcon={
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${showMoreMenu ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  }
                >
                  <MoreVertical className="h-4 w-4" aria-hidden />
                  More Actions
                </Button>
                {showMoreMenu && (
                  <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl">
                    <Link
                      to="/maintenance/preventive"
                      onClick={() => setShowMoreMenu(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)]"
                    >
                      <Wrench className="h-4 w-4 text-[var(--color-primary)]" />
                      Preventive Maintenance
                    </Link>
                    <Link
                      to="/maintenance/breakdowns"
                      onClick={() => setShowMoreMenu(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)]"
                    >
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Breakdown Reports
                    </Link>
                    <Link
                      to="/maintenance/history"
                      onClick={() => setShowMoreMenu(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)]"
                    >
                      <History className="h-4 w-4 text-indigo-600" />
                      Machine History Logs
                    </Link>
                    <div className="my-1 border-t border-[var(--color-border)]" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        load(true);
                        addToast("Refreshing equipment data...", "info");
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)] cursor-pointer"
                    >
                      <RefreshCw className="h-4 w-4 text-[var(--color-primary)]" />
                      Refresh Metrics
                    </button>
                  </div>
                )}
              </div>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <MaintenanceKpiCard
            label="Total Equipment"
            value={totalEquipment}
            icon={Cog}
            tone="violet"
            trend={equipmentTrend}
            onClick={() => {
              setActiveTab("equipment");
              setStatusFilter([]);
              setPage(1);
            }}
          />
          <MaintenanceKpiCard
            label="Running"
            value={running}
            icon={PlayCircle}
            tone="success"
            meta={pctOfTotal(running, totalEquipment)}
            onClick={() => {
              setActiveTab("equipment");
              setStatusFilter(["running"]);
              setPage(1);
            }}
          />
          <MaintenanceKpiCard
            label="Under Maintenance"
            value={underMaint}
            icon={Wrench}
            tone="orange"
            meta={pctOfTotal(underMaint, totalEquipment)}
            onClick={() => {
              setActiveTab("equipment");
              setStatusFilter(["maintenance"]);
              setPage(1);
            }}
          />
          <MaintenanceKpiCard
            label="Out of Service"
            value={outOfService}
            icon={PauseCircle}
            tone="danger"
            meta={pctOfTotal(outOfService, totalEquipment)}
            onClick={() => {
              setActiveTab("equipment");
              setStatusFilter(["breakdown"]);
              setPage(1);
            }}
          />
          <MaintenanceKpiCard
            label="Total Spare Parts"
            value={totalSpare}
            icon={Package}
            tone="violet"
            meta={totalSpare === 1 ? "1 item in catalog" : `${totalSpare} items in catalog`}
            onClick={() => {
              setActiveTab("spare");
              setStatusFilter([]);
              setPage(1);
            }}
          />
          <MaintenanceKpiCard
            label="Low Stock Items"
            value={lowStock}
            icon={AlertTriangle}
            tone="orange"
            meta={lowStock > 0 ? `${lowStock} below reorder level` : "Stock levels healthy"}
            footer={
              lowStock > 0 ? (
                <span className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline inline-flex items-center gap-0.5">
                  View details →
                </span>
              ) : null
            }
            onClick={() => {
              setActiveTab("spare");
              setStatusFilter(["low_stock"]);
              setPage(1);
            }}
          />
        </div>

        <div className="border-b border-[var(--color-border-soft)]">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "equipment", label: "Machines", count: machines.length, icon: Cog },
              { id: "spare", label: "Spare Parts", count: spareParts.length, icon: Package },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                      : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      isActive
                        ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                        : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <ListPageCard className="!overflow-visible relative z-20">
          <ListPageCardBody className="!overflow-visible">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 items-end">
              <div className="sm:col-span-2 md:col-span-3 lg:col-span-3">
                <label className="ui-label mb-1">Search</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder={activeTab === "equipment" ? "Search machines..." : "Search spare parts..."}
                    className="w-full rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] pl-9 pr-8 py-2 text-[13px] text-[var(--color-text)] placeholder-[var(--color-text-muted)] transition-colors focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="sm:col-span-1 md:col-span-1 lg:col-span-2">
                <label className="ui-label mb-1">Status</label>
                <MultiSelectDropdown
                  label="Status"
                  options={activeTab === "equipment" ? STATUS_EQUIPMENT_OPTIONS : STATUS_SPARE_OPTIONS}
                  selected={statusFilter}
                  onChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                  placeholder="Search status..."
                />
              </div>

              <div className="sm:col-span-1 md:col-span-1 lg:col-span-2">
                <label className="ui-label mb-1">Category</label>
                <MultiSelectDropdown
                  label="Category"
                  options={activeTab === "equipment" ? categories : spareCategories}
                  selected={categoryFilter}
                  onChange={(v) => {
                    setCategoryFilter(v);
                    setPage(1);
                  }}
                  placeholder="Search categories..."
                />
              </div>

              <div className="sm:col-span-1 md:col-span-1 lg:col-span-2">
                <label className="ui-label mb-1">Location</label>
                <MultiSelectDropdown
                  label="Location"
                  options={activeTab === "equipment" ? locations : spareLocations}
                  selected={locationFilter}
                  onChange={(v) => {
                    setLocationFilter(v);
                    setPage(1);
                  }}
                  placeholder="Search locations..."
                />
              </div>

              <div className="sm:col-span-1 md:col-span-1 lg:col-span-2">
                <label className="ui-label mb-1">{activeTab === "equipment" ? "Brand" : "Vendor"}</label>
                <MultiSelectDropdown
                  label={activeTab === "equipment" ? "Brand" : "Vendor"}
                  options={activeTab === "equipment" ? brands : spareVendors}
                  selected={activeTab === "equipment" ? brandFilter : vendorFilter}
                  onChange={(v) => {
                    if (activeTab === "equipment") setBrandFilter(v);
                    else setVendorFilter(v);
                    setPage(1);
                  }}
                  placeholder={activeTab === "equipment" ? "Search brands..." : "Search vendors..."}
                  alignRight
                />
              </div>

              <div className="sm:col-span-1 md:col-span-1 lg:col-span-1 flex items-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                  className="w-full justify-center !py-2 text-[13px]"
                >
                  Reset
                </Button>
              </div>
            </div>
          </ListPageCardBody>
        </ListPageCard>

        <div id={activeTab === "spare" ? "spare-table" : undefined}>
          <ListPageCard>
            <ListPageCardBody>
              <h2 className="mb-4 text-[15px] font-semibold text-[var(--color-text)]">
                {activeTab === "equipment" ? "Machines" : "Spare Parts Inventory"}
              </h2>
              <div className="ui-table-wrap ui-table-wrap--scroll">
                {activeTab === "equipment" ? (
                  <table className="ui-table min-w-full w-full border-collapse text-left text-[13px]">
                    <thead className="ui-table-head">
                      <tr>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Equipment Code</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Name</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Category</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Location</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Status</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Utilization</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="border-none p-0">
                            <EmptyState
                              icon="document"
                              title="No records found."
                              description="There is nothing to show here yet."
                              className="border-none bg-transparent py-12"
                            />
                          </td>
                        </tr>
                      ) : (
                        pageRows.map((row, idx) => {
                          const status = normalizeMachineStatus(row.display_status || row.status);
                          const util = Math.round(Number(row.efficiency_pct ?? row.oee_pct ?? 0));
                          return (
                            <tr
                              key={row.id ?? row.code}
                              className={
                                idx % 2 === 1
                                  ? "bg-[var(--color-surface-muted)]/60 hover:bg-[var(--color-surface-muted)]"
                                  : "hover:bg-[var(--color-surface-muted)]/80"
                              }
                            >
                              <td className="border-b border-[var(--color-border-soft)] px-3 py-3 font-semibold text-[var(--color-text)]">
                                {row.code}
                              </td>
                              <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text)]">
                                {row.name}
                              </td>
                              <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">
                                {row.machine_type || "—"}
                              </td>
                              <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">
                                {row.location || "—"}
                              </td>
                              <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                                <span
                                  className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${equipmentStatusBadgeClass(
                                    status
                                  )}`}
                                >
                                  {equipmentStatusLabel(status)}
                                </span>
                              </td>
                              <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                                    <div
                                      className="h-full rounded-full bg-[var(--kpi-success)]"
                                      style={{ width: `${Math.min(100, Math.max(0, util))}%` }}
                                    />
                                  </div>
                                  <span className="tabular-nums text-[var(--color-text-secondary)]">{util}%</span>
                                </div>
                              </td>
                              <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                                <div className="flex items-center justify-center">
                                  <RowActionMenu
                                    rowId={row.id ?? row.code}
                                    openMenu={openMenu}
                                    setOpenMenu={setOpenMenu}
                                    ariaLabel={`Actions for ${row.name || row.code}`}
                                    items={[
                                      {
                                        label: "View",
                                        icon: <Eye className="h-4 w-4" />,
                                        onClick: () => openMachineView(row),
                                      },
                                      {
                                        label: "Edit",
                                        icon: <Pencil className="h-4 w-4" />,
                                        onClick: () => setEditMachine(row),
                                      },
                                      {
                                        label: "Delete",
                                        icon: <Trash2 className="h-4 w-4" />,
                                        onClick: () => setDeleteTarget(row),
                                      },
                                    ]}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="ui-table min-w-full w-full border-collapse text-left text-[13px]">
                    <thead className="ui-table-head">
                      <tr>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Part No</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Name</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Stock</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Min</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Vendor</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Cost</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3">Status</th>
                        <th className="border-b border-[var(--color-border-soft)] px-3 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="border-none p-0">
                            <EmptyState
                              icon="document"
                              title="No records found."
                              description="There is nothing to show here yet."
                              className="border-none bg-transparent py-12"
                            />
                          </td>
                        </tr>
                      ) : (
                        pageRows.map((row, idx) => (
                          <tr
                            key={row.id ?? row.part_number}
                            className={
                              idx % 2 === 1
                                ? "bg-[var(--color-surface-muted)]/60 hover:bg-[var(--color-surface-muted)]"
                                : "hover:bg-[var(--color-surface-muted)]/80"
                            }
                          >
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 font-semibold text-[var(--color-text)]">
                              {row.part_number}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text)]">
                              {row.spare_name}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 tabular-nums text-[var(--color-text)]">
                              {row.stock}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 tabular-nums text-[var(--color-text-secondary)]">
                              {row.minimum_stock}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 text-[var(--color-text-secondary)]">
                              {row.vendor || "—"}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3 tabular-nums text-[var(--color-text)]">
                              {formatInr(row.cost || row.unit_cost)}
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                              <span
                                className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${spareStockBadge(
                                  row.stock,
                                  row.minimum_stock
                                )}`}
                              >
                                {row.is_low_stock ? "Low Stock" : "In Stock"}
                              </span>
                            </td>
                            <td className="border-b border-[var(--color-border-soft)] px-3 py-3">
                              <div className="flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => setViewSpare(row)}
                                  className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border-soft)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] cursor-pointer"
                                  aria-label="View part details"
                                  title="View part details"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {activeRows.length > 0 ? (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[12px] text-[var(--color-text-muted)]">
                    Showing {from} to {to} of {activeRows.length} entries
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border-soft)] disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPage(n)}
                        className={`grid h-8 min-w-[2rem] place-items-center rounded-md px-2 text-[12px] font-semibold cursor-pointer ${
                          page === n
                            ? "bg-[var(--color-primary)] text-white"
                            : "border border-[var(--color-border-soft)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border-soft)] disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </ListPageCardBody>
          </ListPageCard>
        </div>

        <CreateMachineModal
          open={showAddEquipmentModal}
          onClose={() => setShowAddEquipmentModal(false)}
          onSaved={() => load(true)}
        />

        <CreateMachineModal
          open={Boolean(editMachine)}
          machine={editMachine}
          onClose={() => setEditMachine(null)}
          onSaved={() => {
            setEditMachine(null);
            load(true);
          }}
        />

        {viewMachine ? (
          <MachineDetailModal
            machine={viewMachine}
            detail={viewDetail}
            viewOnly
            onClose={() => {
              setViewMachine(null);
              setViewDetail(null);
            }}
          />
        ) : null}

        {detailLoading ? <Loader label="Loading machine details..." /> : null}

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="Delete machine"
          message={
            deleteTarget
              ? `Are you sure you want to delete "${deleteTarget.name || deleteTarget.code}"? This action cannot be undone.`
              : ""
          }
          confirmLabel="Delete"
          destructive
          loading={deleting}
          onConfirm={handleDeleteConfirm}
          onClose={() => {
            if (!deleting) setDeleteTarget(null);
          }}
        />

        <AddSparePartModal
          open={showAddSpareModal}
          onClose={() => setShowAddSpareModal(false)}
          onSaved={(newPart) => {
            setSpareParts((prev) => [newPart, ...prev]);
          }}
        />

        {viewSpare ? (
          <SparePartDetailModal part={viewSpare} onClose={() => setViewSpare(null)} />
        ) : null}
      </div>
    </InventoryPlanningShell>
  );
}
