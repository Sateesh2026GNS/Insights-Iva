export function toPricingNum(value) {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

export function computeLandedCost(fields) {
  return (
    toPricingNum(fields.purchase_price) +
    toPricingNum(fields.transport_cost) +
    toPricingNum(fields.labour_cost) +
    toPricingNum(fields.import_cost)
  );
}

export function computeMarginPct(landedCost, sellingPrice) {
  const landed = toPricingNum(landedCost);
  const selling = toPricingNum(sellingPrice);
  if (selling <= 0) return null;
  return ((selling - landed) / selling) * 100;
}
