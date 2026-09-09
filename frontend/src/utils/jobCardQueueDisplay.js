/** Shared display helpers for My Job Cards / store queue rows. */

export function getRowProductLines(row) {
  const fromDoc = row?.sales_document?.product_lines;
  if (Array.isArray(fromDoc) && fromDoc.length) return fromDoc;
  const fromManual = row?.manual_document?.product_lines;
  if (Array.isArray(fromManual) && fromManual.length) return fromManual;
  return null;
}

export function fmtListProduct(row) {
  const lines = getRowProductLines(row);
  if (lines && lines.length > 1) {
    const first = lines[0]?.product_name || row.product_name || "Product";
    return `${first} (+${lines.length - 1})`;
  }
  return row?.product_name || lines?.[0]?.product_name || "—";
}

export function fmtListQuantity(row) {
  const lines = getRowProductLines(row);
  if (lines && lines.length > 1) {
    const parts = lines
      .map((ln) => {
        const qty = Number(ln.quantity);
        if (Number.isNaN(qty)) return null;
        const uom = String(ln.uom || ln.unit || "Nos").trim() || "Nos";
        return `${qty.toLocaleString("en-IN")} ${uom}`;
      })
      .filter(Boolean);
    if (parts.length <= 2) return parts.join(" + ");
    return `${lines.length} Items`;
  }
  if (lines && lines.length === 1) {
    const ln = lines[0];
    const qty = ln.quantity;
    const uom = ln.uom || ln.unit || row.unit || "Nos";
    if (qty == null || qty === "") return "—";
    return `${Number(qty).toLocaleString("en-IN")} ${uom}`;
  }
  if (row?.quantity == null || row?.quantity === "") return "—";
  const n = Number(row.quantity);
  if (Number.isNaN(n)) return String(row.quantity);
  const unit = row.unit ? ` ${row.unit}` : "";
  return `${n.toLocaleString("en-IN")}${unit}`;
}

export function fmtListUom(row) {
  const lines = getRowProductLines(row);
  if (!lines || !lines.length) return row?.unit || "—";
  const uoms = [...new Set(lines.map((ln) => String(ln.uom || ln.unit || "Nos").trim() || "Nos"))];
  if (uoms.length === 1) return uoms[0];
  return uoms.join(" / ");
}

export function rowCustomerPo(row) {
  return (
    row?.customer_po_no ||
    row?.sales_document?.header?.customer_po_no ||
    row?.manual_document?.header?.customer_po_no ||
    "—"
  );
}

export function rowStatusLabel(row) {
  return row?.queue_status_label || row?.status_label || row?.status || null;
}
