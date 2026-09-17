import { todayIso } from "../utils/dateUtils";

/** Stock Ledger — linked from Reports footer only, not listed as a report card. */
export const STORE_STOCK_LEDGER_PATH = "/inventory/stock-ledger";

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
    id: "stock-received",
    title: "Stock Received",
    description: "See items received into the warehouse, including quantity and date.",
    to: "/inventory/stock-in",
    available: true,
    category: "activity",
  },
  {
    id: "stock-issued",
    title: "Stock Issued",
    description: "See items taken out of the warehouse, including quantity and reason/reference.",
    to: "/inventory/history?type=out",
    available: true,
    category: "activity",
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
    id: "material-requests",
    title: "Material Requests",
    description: "Review materials requested by teams or departments.",
    to: "/inventory/material-requests",
    available: true,
    category: "workflow",
  },
  {
    id: "material-returns",
    title: "Material Returns",
    description: "See materials returned to the warehouse.",
    to: "/inventory/stock-return",
    available: true,
    category: "activity",
  },
  {
    id: "warehouse-stock",
    title: "Warehouse Stock",
    description: "Compare available stock across warehouses.",
    to: "/inventory/warehouses",
    available: true,
    category: "stock",
  },
  {
    id: "purchase-receipts",
    title: "Purchase Receipts",
    description: "See materials received against purchase orders.",
    to: "/procurement/goods-receipt",
    available: true,
    category: "activity",
  },
];

export const STORE_REPORT_CATEGORIES = [
  { id: "stock", label: "Stock levels" },
  { id: "activity", label: "Stock activity" },
  { id: "workflow", label: "Pending work" },
];

/** Today's stock issued — same rules as dashboard KPI (history, type out, business date). */
export function storeStockIssuedTodayPath(date = todayIso()) {
  const q = new URLSearchParams({ type: "out", from: date, to: date });
  return `/inventory/history?${q.toString()}`;
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
