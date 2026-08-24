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
  FileSpreadsheet,
  History,
  Layers,
  MoreVertical,
  Package,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Wrench,
  X,
} from "lucide-react";

import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import PageHeader from "../../components/common/PageHeader";
import CreateMachineModal from "../../components/production/CreateMachineModal";
import MaintenanceErrorState from "../../components/maintenance/MaintenanceErrorState";
import MaintenanceKpiCard from "../../components/maintenance/MaintenanceKpiCard";
import { getMaintenanceHub } from "../../api/maintenanceApi";
import { getMachines } from "../../api/productionApi";
import { useToast } from "../../context/ToastContext";
import { exportToExcel } from "../../utils/exportUtils";
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
  minWidth = "min-w-[10.5rem] w-full",
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
        className={`inline-flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-[var(--color-text)] shadow-xs transition-colors hover:border-[var(--color-primary)] ${minWidth}`}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-40 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-100">
          {normalizedOptions.length > 5 && (
            <div className="mb-2 px-1">
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder}
                  className="w-full bg-transparent text-[12px] text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-slate-100 px-2 py-1 text-[11px]">
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
              className="text-slate-500 hover:text-red-600 cursor-pointer"
            >
              Clear
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto pt-1 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-slate-400">No options found</p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOption(opt.value)}
                      className="h-4 w-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Add Spare Part</h2>
              <p className="text-xs text-slate-500">Record a new spare part in equipment inventory</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Part Number / SKU <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.part_number}
                onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-[var(--color-primary)] focus:outline-none"
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Spare Part Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Deep Groove Ball Bearing 6205-2RS"
              value={formData.spare_name}
              onChange={(e) => setFormData({ ...formData, spare_name: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Qty</label>
              <input
                type="number"
                min="0"
                required
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Min. Stock</label>
              <input
                type="number"
                min="0"
                required
                value={formData.minimum_stock}
                onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Cost (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="450"
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor / Supplier</label>
              <input
                type="text"
                placeholder="e.g. SKF Bearings India"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Storage Location</label>
              <input
                type="text"
                placeholder="e.g. Warehouse - Rack 1 / Shelf B"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
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
  const [page, setPage] = useState(1);
  const [showAddEquipmentModal, setShowAddEquipmentModal] = useState(false);
  const [showAddSpareModal, setShowAddSpareModal] = useState(false);
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
        setMachines(Array.isArray(mRes.value?.data) ? mRes.value.data : []);
      } else {
        setMachines([]);
      }
      if (hubRes.status === "fulfilled" && hubRes.value?.data) {
        setSpareParts(hubRes.value.data.spare_parts || []);
      } else {
        setSpareParts([]);
      }
      if (mRes.status === "rejected" && hubRes.status === "rejected") {
        if (retryCount < 2) {
          await new Promise((resolve) => setTimeout(resolve, 300 * (retryCount + 1)));
          return load(isRefresh, retryCount + 1);
        }
        throw new Error("Network error");
      }
      setError(null);
    } catch (e) {
      if (isRefresh) throw e;
      setError(e.message || "Failed to load equipment data");
      setMachines([]);
      setSpareParts([]);
    } finally {
      if (retryCount === 0) setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  const handleExport = () => {
    if (activeTab === "equipment") {
      const rows = filteredEquipment.map((m) => ({
        code: m.code || `EQ-${m.id}`,
        name: m.name,
        type: m.machine_type || "Machining",
        manufacturer: m.manufacturer || "Haas",
        location: m.location || "Floor A",
        status: m.display_status || m.status || "Running",
      }));
      exportToExcel(
        rows,
        [
          { key: "code", label: "Equipment ID" },
          { key: "name", label: "Equipment Name" },
          { key: "type", label: "Category" },
          { key: "manufacturer", label: "Manufacturer" },
          { key: "location", label: "Location" },
          { key: "status", label: "Status" },
        ],
        "equipment-inventory"
      );
      addToast("Equipment list exported to Excel", "success");
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
      exportToExcel(
        rows,
        [
          { key: "part_number", label: "Part Number" },
          { key: "spare_name", label: "Spare Part Name" },
          { key: "category", label: "Category" },
          { key: "stock", label: "Stock" },
          { key: "minimum_stock", label: "Min Stock" },
          { key: "vendor", label: "Vendor" },
          { key: "location", label: "Location" },
          { key: "status", label: "Status" },
        ],
        "spare-parts-inventory"
      );
      addToast("Spare parts list exported to Excel", "success");
    }
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

  const filteredEquipment = useMemo(() => {
    const q = search.trim().toLowerCase();
    return machines.filter((m) => {
      const status = normalizeMachineStatus(m.display_status || m.status);
      if (statusFilter.length > 0 && !statusFilter.includes(status)) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(m.machine_type)) return false;
      if (locationFilter.length > 0 && !locationFilter.includes(m.location)) return false;
      if (brandFilter.length > 0 && !brandFilter.includes(m.manufacturer)) return false;
      if (q && ![m.name, m.code, m.manufacturer, m.location, m.machine_type].some((v) => String(v || "").toLowerCase().includes(q))) {
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
      if (q && ![p.spare_name, p.part_number, p.vendor, p.location].some((v) => String(v || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [spareParts, search, statusFilter]);

  const activeRows = activeTab === "equipment" ? filteredEquipment : filteredSpares;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const pageRows = activeRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = activeRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, activeRows.length);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, activeTab]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter([]);
    setCategoryFilter([]);
    setLocationFilter([]);
    setBrandFilter([]);
    setPage(1);
  };

  const equipmentTrend = computeMonthTrend(machines, { dateKey: "created_at" });

  if (loading) return <Loader label="Loading equipment & spare parts..." />;
  if (error && !machines.length && !spareParts.length) {
    return <MaintenanceErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="min-w-0 space-y-5 pb-5">
      <PageHeader
        subtitle="Manage all plant equipment and spare parts inventory"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="add"
              onClick={() => setShowAddEquipmentModal(true)}
              leftIcon={<Plus className="h-4 w-4" aria-hidden />}
            >
              Add Equipment
            </Button>
            <button
              type="button"
              onClick={() => setShowAddSpareModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:border-[var(--color-primary)] cursor-pointer"
            >
              <Plus className="h-4 w-4 text-[var(--color-primary)]" />
              Add Spare Part
            </button>
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setShowMoreMenu((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:border-[var(--color-primary)] cursor-pointer"
              >
                <MoreVertical className="h-4 w-4 text-slate-500" />
                More Actions
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${showMoreMenu ? "rotate-180" : ""}`} />
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                  <Link
                    to="/maintenance/preventive"
                    onClick={() => setShowMoreMenu(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Wrench className="h-4 w-4 text-[var(--color-primary)]" />
                    Preventive Maintenance
                  </Link>
                  <Link
                    to="/maintenance/breakdowns"
                    onClick={() => setShowMoreMenu(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Breakdown Reports
                  </Link>
                  <Link
                    to="/maintenance/history"
                    onClick={() => setShowMoreMenu(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <History className="h-4 w-4 text-indigo-600" />
                    Machine History Logs
                  </Link>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      handleExport();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Export to Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      load(true);
                      addToast("Refreshing equipment data...", "info");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
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
        <MaintenanceKpiCard label="Total Equipment" value={totalEquipment} icon={Cog} tone="violet" trend={equipmentTrend} />
        <MaintenanceKpiCard label="Running" value={running} icon={PlayCircle} tone="success" meta={pctOfTotal(running, totalEquipment)} />
        <MaintenanceKpiCard label="Under Maintenance" value={underMaint} icon={Wrench} tone="orange" meta={pctOfTotal(underMaint, totalEquipment)} />
        <MaintenanceKpiCard label="Out of Service" value={outOfService} icon={PauseCircle} tone="danger" meta={pctOfTotal(outOfService, totalEquipment)} />
        <MaintenanceKpiCard label="Total Spare Parts" value={totalSpare} icon={Package} tone="violet" />
        <MaintenanceKpiCard
          label="Low Stock Items"
          value={lowStock}
          icon={AlertTriangle}
          tone="orange"
          footer={lowStock > 0 ? <Link to="#spare-table" className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline">View details</Link> : null}
        />
      </div>

      <div className="border-b border-slate-200">
        <div className="flex flex-wrap gap-1">
          {[
            { id: "equipment", label: "Equipment" },
            { id: "spare", label: "Spare Parts" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setPage(1); setStatusFilter([]); }}
              className={`border-b-2 px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                activeTab === tab.id
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-3">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={activeTab === "equipment" ? "Search equipment..." : "Search spare parts..."}
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-[13px] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Status</label>
            <MultiSelectDropdown
              label="Status"
              options={activeTab === "equipment" ? STATUS_EQUIPMENT_OPTIONS : STATUS_SPARE_OPTIONS}
              selected={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              placeholder="Search status..."
            />
          </div>
          {activeTab === "equipment" ? (
            <>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Categories</label>
                <MultiSelectDropdown
                  label="Categories"
                  options={categories}
                  selected={categoryFilter}
                  onChange={(v) => { setCategoryFilter(v); setPage(1); }}
                  placeholder="Search categories..."
                />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Locations</label>
                <MultiSelectDropdown
                  label="Locations"
                  options={locations}
                  selected={locationFilter}
                  onChange={(v) => { setLocationFilter(v); setPage(1); }}
                  placeholder="Search locations..."
                />
              </div>
              <div className="lg:col-span-3">
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Brands / Branches</label>
                <MultiSelectDropdown
                  label="Brands"
                  options={brands}
                  selected={brandFilter}
                  onChange={(v) => { setBrandFilter(v); setPage(1); }}
                  placeholder="Search brands..."
                />
              </div>
            </>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="primary" onClick={() => load(true)}>
            Filter
          </Button>
          <Button type="button" variant="secondary" onClick={resetFilters}>
            Reset
          </Button>
        </div>
      </div>

      <div id={activeTab === "spare" ? "spare-table" : undefined} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-[15px] font-semibold text-slate-900">
          {activeTab === "equipment" ? "Equipment List" : "Spare Parts Inventory"}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          {activeTab === "equipment" ? (
            <table className="min-w-full w-full border-collapse text-left text-[13px]">
              <thead className="bg-[#eef6ff] text-[12px] font-semibold text-slate-700">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-3">Equipment Code</th>
                  <th className="border-b border-slate-200 px-3 py-3">Name</th>
                  <th className="border-b border-slate-200 px-3 py-3">Category</th>
                  <th className="border-b border-slate-200 px-3 py-3">Location</th>
                  <th className="border-b border-slate-200 px-3 py-3">Status</th>
                  <th className="border-b border-slate-200 px-3 py-3">Utilization</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border-b border-slate-100 px-3 py-10 text-center text-slate-500">No equipment found</td>
                  </tr>
                ) : (
                  pageRows.map((row, idx) => {
                    const status = normalizeMachineStatus(row.display_status || row.status);
                    const util = Math.round(Number(row.efficiency_pct ?? row.oee_pct ?? 0));
                    return (
                      <tr key={row.id ?? row.code} className={idx % 2 === 1 ? "bg-slate-50/60 hover:bg-slate-50" : "hover:bg-slate-50/80"}>
                        <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-800">{row.code}</td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{row.name}</td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.machine_type || "—"}</td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.location || "—"}</td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${equipmentStatusBadgeClass(status)}`}>
                            {equipmentStatusLabel(status)}
                          </span>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-[var(--kpi-success)]" style={{ width: `${Math.min(100, Math.max(0, util))}%` }} />
                            </div>
                            <span className="tabular-nums text-slate-600">{util}%</span>
                          </div>
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <div className="flex items-center justify-center">
                            <button type="button" className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="View equipment">
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full w-full border-collapse text-left text-[13px]">
              <thead className="bg-[#eef6ff] text-[12px] font-semibold text-slate-700">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-3">Part No</th>
                  <th className="border-b border-slate-200 px-3 py-3">Name</th>
                  <th className="border-b border-slate-200 px-3 py-3">Stock</th>
                  <th className="border-b border-slate-200 px-3 py-3">Min</th>
                  <th className="border-b border-slate-200 px-3 py-3">Vendor</th>
                  <th className="border-b border-slate-200 px-3 py-3">Cost</th>
                  <th className="border-b border-slate-200 px-3 py-3">Status</th>
                  <th className="border-b border-slate-200 px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="border-b border-slate-100 px-3 py-10 text-center text-slate-500">No spare parts found</td>
                  </tr>
                ) : (
                  pageRows.map((row, idx) => (
                    <tr key={row.id ?? row.part_number} className={idx % 2 === 1 ? "bg-slate-50/60 hover:bg-slate-50" : "hover:bg-slate-50/80"}>
                      <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-800">{row.part_number}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-700">{row.spare_name}</td>
                      <td className="border-b border-slate-100 px-3 py-3 tabular-nums text-slate-700">{row.stock}</td>
                      <td className="border-b border-slate-100 px-3 py-3 tabular-nums text-slate-600">{row.minimum_stock}</td>
                      <td className="border-b border-slate-100 px-3 py-3 text-slate-600">{row.vendor || "—"}</td>
                      <td className="border-b border-slate-100 px-3 py-3 tabular-nums text-slate-700">{formatInr(row.cost)}</td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${spareStockBadge(row.stock, row.minimum_stock)}`}>
                          {row.is_low_stock ? "Low Stock" : "In Stock"}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <div className="flex items-center justify-center">
                          <button type="button" className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="View part">
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
            <p className="text-[12px] text-slate-500">
              Showing {from} to {to} of {activeRows.length} entries
            </p>
            <div className="flex items-center gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`grid h-8 min-w-[2rem] place-items-center rounded-md px-2 text-[12px] font-semibold ${
                    page === n ? "bg-[var(--color-primary)] text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <CreateMachineModal
        open={showAddEquipmentModal}
        onClose={() => setShowAddEquipmentModal(false)}
        onSaved={(newMachine) => {
          setMachines((prev) => [newMachine, ...prev]);
          load(true);
        }}
      />

      <AddSparePartModal
        open={showAddSpareModal}
        onClose={() => setShowAddSpareModal(false)}
        onSaved={(newPart) => {
          setSpareParts((prev) => [newPart, ...prev]);
        }}
      />
    </div>
  );
}
