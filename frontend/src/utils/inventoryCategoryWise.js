/**
 * Category Wise tab — filter/sort stock items and build row action menu items.
 */

export function normalizeCategoryName(category) {
  const name = String(category || "").trim();
  return name || "No Category";
}

/** Real tenant categories for new Stock Item creation — excludes the synthetic "No Category" row. */
export function selectableInventoryCategories(categories) {
  return (categories || []).filter((c) => {
    const name = String(c?.name || "").trim();
    if (!name || name.toLowerCase() === "no category") return false;
    const id = Number(c?.id);
    return Number.isFinite(id) && id > 0;
  });
}

export function isMissingStockItemCategory(name) {
  const n = String(name || "").trim();
  return !n || n.toLowerCase() === "no category";
}

/** Names for a category <select>. Returns null when `categories` was omitted (caller may use a fallback). */
export function inventoryCategoryOptionNames(categories) {
  if (!Array.isArray(categories)) return null;
  return categories
    .map((c) => (typeof c === "string" ? c : c?.name))
    .map((n) => String(n || "").trim())
    .filter(Boolean);
}

export function resolveSelectableCategoryId(categories, name) {
  if (!Array.isArray(categories) || isMissingStockItemCategory(name)) return null;
  const needle = String(name).trim().toLowerCase();
  for (const c of categories) {
    if (typeof c === "string") continue;
    if (String(c?.name || "").trim().toLowerCase() !== needle) continue;
    const id = Number(c.id);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return null;
}

export function filterCategoryWiseItems(products, { search = "", categoryFilter = "all", sort = "name-asc" } = {}) {
  const q = String(search || "").trim().toLowerCase();
  let rows = (products || []).filter((p) => {
    const cat = normalizeCategoryName(p.category);
    if (categoryFilter !== "all" && cat !== categoryFilter) return false;
    if (!q) return true;
    const hay = `${p.name} ${p.hsn_code} ${cat} ${p.product_code || p.sku}`.toLowerCase();
    return hay.includes(q);
  });
  return [...rows].sort((a, b) => {
    if (sort === "name-desc") return String(b.name).localeCompare(String(a.name));
    if (sort === "qty-asc") return (Number(a.current_stock) || 0) - (Number(b.current_stock) || 0);
    if (sort === "qty-desc") return (Number(b.current_stock) || 0) - (Number(a.current_stock) || 0);
    return String(a.name).localeCompare(String(b.name));
  });
}

/**
 * @param {object} row - inventory item row (must include stable `id`)
 * @param {{ canWrite: boolean, isPM: boolean, onView: (row: object) => void, onEdit: (row: object) => void, onDelete: (row: object) => void }} opts
 */
export function buildInventoryStockRowActionItems(row, { canWrite, isPM, onView, onEdit, onDelete }) {
  const items = [
    {
      label: "View",
      onClick: () => onView(row),
    },
  ];
  if (canWrite && !isPM) {
    items.push({
      label: "Edit",
      onClick: () => onEdit(row),
    });
    items.push({ divider: true });
    items.push({
      label: "Delete",
      danger: true,
      onClick: () => onDelete(row),
    });
  }
  return items;
}
