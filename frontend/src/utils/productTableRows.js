/** Expand products with vendor pricing lines into table rows (one row per vendor price). */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function expandProductsToTableRows(products = []) {
  const rows = [];
  for (const p of products) {
    const lines = Array.isArray(p.vendor_pricing) && p.vendor_pricing.length
      ? p.vendor_pricing
      : [null];
    for (const vp of lines) {
      const code = p.sku || p.product_code || "";
      rows.push({
        ...p,
        rowKey: vp?.id ? `vp-${vp.id}` : `p-${p.id}`,
        pricing_id: vp?.id ?? null,
        product_code: code,
        vendor_name: vp?.vendor_name || "",
        purchase_price: vp ? num(vp.purchase_price) : num(p.purchase_price ?? p.unit_cost),
        transport_cost: vp ? num(vp.transport_cost) : 0,
        labour_cost: vp ? num(vp.labour_cost) : 0,
        import_cost: vp ? num(vp.import_cost) : 0,
        total_landed_cost: vp
          ? num(vp.total_landed_cost)
          : num(p.purchase_price ?? p.unit_cost),
        minimum_price: vp ? num(vp.minimum_price) : 0,
        maximum_price: vp ? num(vp.maximum_price) : 0,
        selling_price: vp
          ? num(vp.selling_price)
          : num(p.selling_price ?? p.unit_price),
        supplier_id: vp?.supplier_id ?? null,
        _pricingRecord: vp,
      });
    }
  }
  return rows;
}

export function formatProductInr(value) {
  const num = Number(value || 0);
  const whole = num % 1 === 0;
  return `₹${num.toLocaleString("en-IN", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
}
