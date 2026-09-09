/**
 * Unified job card navigation helpers.
 */

/** Manual Sales Job Card create form. */
export function jobCardCreateUrl() {
  return "/sales/job-cards/create";
}

/** Manual Sales Job Card edit form. */
export function jobCardManualEditUrl(jobCardId) {
  if (!jobCardId) return jobCardCreateUrl();
  return `/sales/job-cards/${jobCardId}/edit`;
}

/** Full-page sales job card (JobCardDetailsShell + Sales Job Card document). */
export function jobCardDetailsUrl(orderId) {
  if (!orderId) return jobCardCreateUrl();
  return `/job-cards/${orderId}`;
}

/**
 * Inline view on My Job Cards — keeps dept/filters in the query string.
 * Example: /my-job-cards?dept=sales&order=42
 */
export function myJobCardsViewUrl(orderId, searchParams) {
  if (!orderId) return "/my-job-cards";
  const params = new URLSearchParams(
    searchParams instanceof URLSearchParams ? searchParams : searchParams || undefined
  );
  params.set("order", String(orderId));
  params.delete("jc");
  const search = params.toString();
  return search ? `/my-job-cards?${search}` : `/my-job-cards?order=${orderId}`;
}

/** View manual job card on My Job Cards (by job card id). */
export function myJobCardsManualViewUrl(jobCardId, searchParams) {
  if (!jobCardId) return "/my-job-cards";
  const params = new URLSearchParams(
    searchParams instanceof URLSearchParams ? searchParams : searchParams || undefined
  );
  params.set("jc", String(jobCardId));
  params.delete("order");
  const search = params.toString();
  return search ? `/my-job-cards?${search}` : `/my-job-cards?jc=${jobCardId}`;
}

/** Sales job card edit page (same UI, edit mode). */
export function jobCardEditUrl(orderId) {
  if (!orderId) return jobCardCreateUrl();
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
