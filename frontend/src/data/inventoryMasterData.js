/** Inventory module demo data and helpers. */

export const MATERIAL_CATEGORIES = ["Metals", "Plastics", "Electronics", "Chemicals", "Packaging", "Fasteners"];
export const WAREHOUSES = ["Main Warehouse", "Raw Material Store", "Plant-1 Store", "Plant-2 Store"];
export const ADJUSTMENT_REASONS = [
  "Physical Count", "Damage", "Loss", "Scrap", "Expired", "Return", "Correction",
];
export const TRANSFER_STATUSES = ["draft", "pending_approval", "approved", "in_transit", "received", "completed"];
export const TRANSACTION_TYPES = ["Purchase", "Production", "Transfer", "Adjustment", "Sales", "Return", "Scrap"];

export const INVENTORY_FLOW = [
  "Vendor", "Purchase Order", "Goods Receipt Note (GRN)", "Raw Material Inventory", "Material Issue",
  "Production", "Finished Goods", "Warehouse", "Sales Order", "Dispatch", "Customer",
];

export const DEMO_MATERIALS_SUMMARY = {
  total_items: 0,
  available_stock: 0,
  low_stock: 0,
  out_of_stock: 0,
  stock_value: 0,
  expiring_soon: 0,
};

export const DEMO_MATERIALS = [];

export const DEMO_FG_SUMMARY = {
  total_products: 0,
  available: 0,
  reserved: 0,
  ready_to_dispatch: 0,
  damaged: 0,
  stock_value: 0,
};

export const DEMO_FINISHED_GOODS = [];

export const DEMO_TRANSFERS = [];

export const DEMO_ADJUSTMENTS = [];

export const DEMO_LEDGER_SUMMARY = {
  total_transactions: 0,
  stock_in: 0,
  stock_out: 0,
  transfers: 0,
  adjustments: 0,
  current_stock_value: 0,
};

export const DEMO_LEDGER = [];

export const DEMO_INVENTORY_HUB = {
  total_inventory_value: 0,
  low_stock_items: 0,
  dead_stock: 0,
  fast_moving: 0,
  slow_moving: 0,
  todays_transactions: 0,
  warehouse_stock: [],
  top_materials: [],
};

export function formatInr(value) {
  if (value == null || value === "") return "₹0";
  const n = Number(value);
  if (Number.isNaN(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN")}`;
}

export function stockStatusColor(status) {
  const s = (status || "").toLowerCase();
  if (s === "available" || s === "ready" || s === "in_stock") return "bg-green-100 text-green-800";
  if (s === "low_stock") return "bg-amber-100 text-amber-800";
  if (s === "out_of_stock") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

/** Maps stock status → StatusBadge tone */
export function stockStatusTone(status) {
  const s = (status || "").toLowerCase();
  if (s === "available" || s === "ready" || s === "in_stock") return "success";
  if (s === "low_stock") return "warning";
  if (s === "out_of_stock" || s === "damaged") return "danger";
  return "neutral";
}

export function stockStatusLabel(status) {
  const map = {
    available: "In Stock",
    in_stock: "In Stock",
    low_stock: "Low Stock",
    out_of_stock: "Out of Stock",
    ready: "Ready",
    damaged: "Damaged",
  };
  return map[status] || status || "—";
}

/** Human-readable stock ledger / movement labels */
export function transactionTypeLabel(type) {
  const t = String(type || "").toLowerCase().replace(/_/g, " ");
  const map = {
    purchase: "Purchase In",
    production: "Production In",
    transfer: "Transfer",
    adjustment: "Adjustment",
    sales: "Sales Out",
    sale: "Sales Out",
    return: "Return In",
    scrap: "Scrap Out",
    in: "Stock In",
    out: "Stock Out",
    issue: "Material Issue",
    "material issue": "Material Issue",
  };
  return map[t] || (t ? t.replace(/\b\w/g, (c) => c.toUpperCase()) : "—");
}

export const DEMO_MATERIAL_DETAIL = {
  id: null,
  sku: "",
  name: "",
  barcode: "",
  category: "",
  unit: "",
  unit_cost: 0,
  reorder_level: 0,
  description: "",
  vendor_name: "",
  vendor_contact: "",
  vendor_email: "",
  stock_history: [],
  purchase_history: [],
  consumption_history: [],
  batches: [],
};
