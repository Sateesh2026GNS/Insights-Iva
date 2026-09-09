import ConfirmDialog from "../admin/ConfirmDialog";
import {
  resolveSalesOrderDeleteState,
  SALES_ORDER_DELETE_HELP_MESSAGE,
} from "../../utils/salesOrderDelete";

export default function DeleteSalesOrderDialog({
  open,
  orderNumber,
  deleteBlockers = [],
  deleteError = "",
  loading = false,
  onConfirm,
  onClose,
}) {
  const displayOrder = orderNumber || "";

  const { blocked, summary, blockerLines, showDownstreamHelp, retryableError } =
    resolveSalesOrderDeleteState({
      orderNumber,
      deleteBlockers,
      deleteError,
    });

  const message = displayOrder
    ? `Are you sure you want to delete sales order ${displayOrder}? This action cannot be undone.`
    : "Are you sure you want to delete this sales order? This action cannot be undone.";

  const errorParts = [];
  if (summary || retryableError) errorParts.push(summary || retryableError);
  if (blockerLines.length) errorParts.push(blockerLines.map((line) => `• ${line}`).join("\n"));
  if (showDownstreamHelp) errorParts.push(SALES_ORDER_DELETE_HELP_MESSAGE);
  const error = errorParts.join("\n\n");

  return (
    <ConfirmDialog
      open={open}
      title="Delete"
      message={message}
      error={error || undefined}
      loading={loading}
      confirmDisabled={blocked}
      onConfirm={onConfirm}
      onClose={onClose}
      confirmLabel="Delete"
    />
  );
}
