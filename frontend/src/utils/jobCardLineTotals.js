/** Job card product line pricing (quantity × unit price). */

export function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function recalcProductLine(row) {
  const qty = Number(row?.quantity) || 0;
  const unitPrice = Number(row?.unit_price) || 0;
  const lineAmount = money(qty * unitPrice);
  return {
    ...row,
    line_amount: lineAmount,
    total_amount: lineAmount,
  };
}

export function computeLineTotals(lines) {
  const rows = (lines || []).map((row) => recalcProductLine(row));
  const totalQuantity = money(rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0));
  const totalAmount = money(rows.reduce((sum, row) => sum + (Number(row.line_amount) || 0), 0));
  return { totalQuantity, totalAmount, rows };
}

export function productSellingPrice(product) {
  if (!product) return 0;
  const raw =
    product.unit_price ??
    product.selling_price ??
    product.price_per_unit ??
    product.total_cost ??
    0;
  return money(Number(raw) || 0);
}

export function applyProductMasterToLine(row, product) {
  if (!product) return recalcProductLine(row);
  const unitPrice = productSellingPrice(product);
  return recalcProductLine({
    ...row,
    product_id: product.id != null ? String(product.id) : row.product_id,
    product_code: product.sku || product.product_code || row.product_code,
    product_name: product.name || row.product_name,
    uom: product.unit || product.uom || row.uom || "Nos",
    unit_price: unitPrice > 0 ? String(unitPrice) : row.unit_price || "",
  });
}

export function findDuplicateProductLineIndex(lines, productId, excludeIndex = -1) {
  if (!productId) return -1;
  const pid = String(productId);
  return (lines || []).findIndex(
    (row, i) => i !== excludeIndex && row.product_id && String(row.product_id) === pid
  );
}
