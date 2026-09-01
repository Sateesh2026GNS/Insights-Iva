/**
 * Unified job card navigation helpers.
 */

/** Read-only job card details page. */
export function jobCardDetailsUrl(orderId) {
  if (!orderId) return "/sales/orders";
  return `/job-cards/${orderId}`;
}

/** Sales job card edit page (same UI, edit mode). */
export function jobCardEditUrl(orderId) {
  if (!orderId) return "/sales/orders";
  return `/sales/orders/${orderId}/job-card`;
}

/** Operator / work-order row → unified job card details when sales order is linked. */
export function operatorJobCardUrl(row) {
  const soId = row?.sales_order_id;
  if (soId) return jobCardDetailsUrl(soId);
  return "/production/operator-jobs";
}

/** Open job card from a production planning row (uses linked sales order when available). */
export function productionOrderJobCardUrl(row) {
  if (row?.sales_order_id) {
    return jobCardDetailsUrl(row.sales_order_id);
  }
  return null;
}
