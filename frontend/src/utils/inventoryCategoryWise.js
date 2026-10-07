/**
 * Category Wise tab — filter/sort stock items and build row action menu items.
 */

export function normalizeCategoryName(category) {
  const name = String(category || "").trim();
  return name || "No Category";
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
