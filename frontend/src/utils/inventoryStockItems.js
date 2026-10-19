/** Stock list filtering and table layout for Inventory V2 (all / low / out routes). */

export const SORT_OPTIONS = [
  { id: "name-asc", label: "Item Name A-Z" },
  { id: "name-desc", label: "Item Name Z-A" },
  { id: "qty-asc", label: "Quantity Low to High" },
  { id: "qty-desc", label: "Quantity High to low" },
];

export const STOCK_FILTERS = [
  { id: "all", label: "All" },
  { id: "in", label: "In Stock" },
  { id: "low", label: "Low Stock" },
  { id: "out", label: "Out Of Stock" },
];

export function stockFilterFromSearchParams(searchParams) {
  const stock = String(searchParams?.get?.("stock") || "").toLowerCase();
  const legacy = String(searchParams?.get?.("filter") || "").toLowerCase();
  if (stock === "low" || legacy === "low_stock") return "low";
  if (stock === "out" || legacy === "out_of_stock") return "out";
  if (stock === "in") return "in";
  return "all";
}

export function stockFilterFromPath(pathname) {
  const path = String(pathname || "").replace(/\/$/, "");
  if (path.endsWith("/low-stock")) return "low";
  if (path.endsWith("/out-of-stock")) return "out";
  return null;
}

/**
 * @param {{ pathname?: string, searchParams?: URLSearchParams, forcedStockFilter?: "low"|"out"|null }} opts
 */
export function resolveInventoryKpiStockFilter({ pathname, searchParams, forcedStockFilter = null }) {
  if (forcedStockFilter === "low" || forcedStockFilter === "out") return forcedStockFilter;
  const fromPath = stockFilterFromPath(pathname);
  if (fromPath) return fromPath;
  return stockFilterFromSearchParams(searchParams);
}

export function isLockedKpiStockFilter({ pathname, forcedStockFilter = null }) {
  if (forcedStockFilter === "low" || forcedStockFilter === "out") return true;
  return stockFilterFromPath(pathname) != null;
}

export function filterInventoryStockRows(products, { search = "", sort = "name-asc", stockFilter = "all" }) {
  const q = String(search).trim().toLowerCase();
  let rows = (products || []).filter((p) => {
    if (q) {
      const hay = `${p.name} ${p.hsn_code} ${p.category} ${p.product_code || p.sku}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    const qty = Number(p.current_stock) || 0;
    const minStk = Number(p.min_stock) || 0;
    if (stockFilter === "in" && qty <= 0) return false;
    if (stockFilter === "out" && qty > 0) return false;
    if (stockFilter === "low") {
      if (qty <= 0) return false;
      if (minStk > 0 && qty <= minStk) return true;
      return false;
    }
    return true;
  });
  rows = [...rows].sort((a, b) => {
    if (sort === "name-desc") return String(b.name).localeCompare(String(a.name));
    if (sort === "qty-asc") return (Number(a.current_stock) || 0) - (Number(b.current_stock) || 0);
    if (sort === "qty-desc") return (Number(b.current_stock) || 0) - (Number(a.current_stock) || 0);
    return String(a.name).localeCompare(String(b.name));
  });
  return rows;
}

export function getInventoryStockItemTableHeaders(stockFilter) {
  if (stockFilter === "low") {
    return ["HSN Code", "Item Name", "Available Quantity", "Minimum Stock Level", "Stock Value", "Action"];
  }
  if (stockFilter === "out") {
    return ["HSN Code", "Item Name", "Available Quantity", "Stock Value", "Action"];
  }
  return ["HSN Code", "Item Name", "Stock Value", "Purchase Price", "Sales Price", "Stock In Hand", "Action"];
}
