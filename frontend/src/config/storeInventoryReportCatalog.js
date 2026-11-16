import { todayIso } from "../utils/dateUtils";

/** Fallback stock destination after Inventory History was removed for Store Manager. */
export const STORE_STOCK_LEDGER_PATH = "/inventory";

/**
 * Store Manager report hub — plain-language cards (inventory / store only).
 * `available: false` entries are omitted from the UI.
 */
export const STORE_INVENTORY_REPORTS = [
  {
    id: "stock-summary",
    title: "Stock Summary",
    description: "See how much stock is available for each item and warehouse.",
    to: "/inventory",
    available: true,
    category: "stock",
  },
  {
    id: "low-stock",
    title: "Low Stock",
    description: "Find items that are below their minimum stock level.",
    to: "/inventory/low-stock",
    available: true,
    category: "stock",
  },
  {
    id: "out-of-stock",
    title: "Out of Stock",
    description: "Find items that currently have no available stock.",
    to: "/inventory/out-of-stock",
    available: true,
    category: "stock",
  },
  {
    id: "pending-inventory-checks",
    title: "Pending Inventory Checks",
    description: "See stock checks that still need to be completed.",
    to: "/inventory/pending-inventory-checks",
    available: true,
    category: "workflow",
  },
  {
    id: "pending-stock-transfers",
    title: "Pending Stock Transfers",
    description: "See stock transfers that are waiting for the next step.",
    to: "/inventory/stock-transfer?status=pending",
    available: true,
    category: "workflow",
  },
  {
    id: "warehouse-stock",
    title: "Warehouse Stock",
    description: "Compare available stock across warehouses.",
    to: "/inventory/warehouses",
    available: true,
    category: "stock",
  },
];

export const STORE_REPORT_CATEGORIES = [
  { id: "stock", label: "Stock levels" },
  { id: "activity", label: "Stock activity" },
  { id: "workflow", label: "Pending work" },
];

/** Legacy helper — Inventory History removed for Store Manager; keep stock items path. */
export function storeStockIssuedTodayPath(_date = todayIso()) {
  return "/inventory";
}

export function getStoreInventoryReportLinks() {
  return STORE_INVENTORY_REPORTS.filter((r) => r.available).map((r) => ({
    ...r,
    href: typeof r.to === "function" ? r.to() : r.to,
  }));
}

export function getReportsByCategory() {
  const links = getStoreInventoryReportLinks();
  return STORE_REPORT_CATEGORIES.map((cat) => ({
    ...cat,
    reports: links.filter((r) => r.category === cat.id),
  })).filter((section) => section.reports.length > 0);
}
