/** Titles and empty states for store report destination pages (from URL hints). */

export function historyReportMeta(movementType, { dateFrom, dateTo } = {}) {
  const t = String(movementType || "").toLowerCase();
  if (t === "out") {
    return {
      title: "Stock Issued",
      subtitle: "Items taken out of the warehouse with quantity and references.",
      quantityLabel: "Quantity Issued",
      emptyTitle: "No stock issued for the selected filters",
      emptyDescription: dateFrom || dateTo
        ? "No stock-out transactions found for the selected dates."
        : "No stock-out transactions found. Try adjusting the date range or warehouse.",
    };
  }
  if (t === "in") {
    return {
      title: "Stock Received",
      subtitle: "Items received into the warehouse with quantity and dates.",
      quantityLabel: "Quantity Received",
      emptyTitle: "No stock received for the selected filters",
      emptyDescription: dateFrom || dateTo
        ? "No stock-in transactions found for the selected dates."
        : "No stock-in transactions found. Try adjusting the date range or warehouse.",
    };
  }
  return {
    title: "Inventory Movement History",
    subtitle: "Complete trail for stock received, issued, returned, and transferred.",
    quantityLabel: "Quantity",
    emptyTitle: "No inventory movements found",
    emptyDescription: "Stock movement history appears when stock is received, issued, returned, or adjusted.",
  };
}

export function catalogStockReportMeta(mode) {
  if (mode === "low") {
    return {
      title: "Low Stock",
      subtitle: "Items below their minimum stock level.",
      emptyTitle: "No low stock items",
      emptyDescription: "All catalog items are above their minimum stock level.",
    };
  }
  if (mode === "out") {
    return {
      title: "Out of Stock",
      subtitle: "Items with no available stock.",
      emptyTitle: "No out of stock items",
      emptyDescription: "All catalog items currently have available stock.",
    };
  }
  return null;
}
