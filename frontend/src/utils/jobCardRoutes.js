/**
 * Resolve the unified workflow URL for a work order row.
 */
export function operatorJobCardUrl(row) {
  const soId = row?.sales_order_id;
  if (soId) return `/manufacturing/workflow/order/${soId}/operator`;
  return "/manufacturing/workflow?status=PRODUCTION_ASSIGNED";
}
