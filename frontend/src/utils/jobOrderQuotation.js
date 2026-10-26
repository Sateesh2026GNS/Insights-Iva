export const MAX_QUOTE_LINES = 120;

export function roundMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

export function isoFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + (Number(days) || 0));
  return isoFromDate(date);
}

export function emptyQuoteLine() {
  return { description: "", qty: "", unit: "pcs", rate: "" };
}

export function quoteTotals({ lines, freight, gstPct, roundOff }) {
  const filled = (lines || []).filter((row) => String(row.description || "").trim());
  const itemTotal = roundMoney(
    filled.reduce((sum, row) => sum + roundMoney((Number(row.qty) || 0) * (Number(row.rate) || 0)), 0)
  );
  const freightValue = Math.max(0, roundMoney(freight));
  const taxable = roundMoney(itemTotal + freightValue);
  const pct = Number(gstPct);
  const safePct = Number.isFinite(pct) && pct > 0 ? Math.min(pct, 100) : 0;
  const gst = roundMoney((taxable * safePct) / 100);
  const round = roundMoney(roundOff);
  return {
    filled,
    itemCount: filled.length,
    itemTotal,
    freight: freightValue,
    taxable,
    gst,
    gstPct: safePct,
    roundOff: round,
    total: roundMoney(taxable + gst + round),
  };
}

function gstShares(taxables, gst, gstPct) {
  let remaining = gst;
  return taxables.map((taxable, index) => {
    if (index === taxables.length - 1) return remaining;
    const share = roundMoney((taxable * gstPct) / 100);
    remaining = roundMoney(remaining - share);
    return share;
  });
}

export function buildQuotationPayload({
  tenantId,
  quoteNumber,
  customerId,
  customerName,
  quoteDate,
  validUntil,
  seller,
  customerAddress,
  enquiryRef,
  deliveryTerms,
  paymentTerms,
  inspectionTerm,
  totals,
}) {
  const taxables = totals.filled.map((row) => roundMoney((Number(row.qty) || 0) * (Number(row.rate) || 0)));
  if (totals.freight > 0) taxables.push(totals.freight);
  const shares = taxables.length ? gstShares(taxables, totals.gst, totals.gstPct) : [];
  const items = totals.filled.map((row, index) => {
    const taxable = taxables[index];
    const gst = shares[index] || 0;
    return {
      item_description: String(row.description).trim(),
      qty: Number(row.qty) || 0,
      unit: row.unit || "pcs",
      rate: Number(row.rate) || 0,
      tax_type: "Exclusive",
      gst_pct: totals.gstPct,
      taxable_value: taxable,
      gst_amount: gst,
      amount: roundMoney(taxable + gst),
    };
  });
  if (totals.freight > 0) {
    const gst = shares[shares.length - 1] || 0;
    items.push({
      item_description: "Freight and packing",
      qty: 1,
      unit: "lot",
      rate: totals.freight,
      kind: "freight",
      tax_type: "Exclusive",
      gst_pct: totals.gstPct,
      taxable_value: totals.freight,
      gst_amount: gst,
      amount: roundMoney(totals.freight + gst),
    });
  }
  const payload = {
    tenant_id: tenantId,
    customer_id: customerId || null,
    customer_name: customerName || null,
    quote_date: quoteDate,
    valid_until: validUntil || null,
    status: "draft",
    total_amount: Math.max(0, totals.total),
    notes: [deliveryTerms, paymentTerms, inspectionTerm].filter(Boolean).join("\n") || null,
    meta_json: {
      source: "job-order-quotation",
      items,
      freight_packing: totals.freight,
      gst_pct: totals.gstPct,
      round_off: totals.roundOff,
      payment_terms: paymentTerms || "",
      delivery_terms: deliveryTerms || "",
      enquiry_ref: enquiryRef || "",
      seller: seller || {},
      customer_address: customerAddress || "",
      inspection_term: inspectionTerm || "",
      transportation: {
        delivery_terms: deliveryTerms || "",
        reference_no: enquiryRef || "",
      },
    },
  };
  if (quoteNumber) payload.quote_number = quoteNumber;
  return payload;
}
