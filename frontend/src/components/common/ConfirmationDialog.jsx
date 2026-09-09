import ConfirmDialog from "../admin/ConfirmDialog";

/**
 * Centered ERP delete/confirm dialog — shared wrapper for legacy call sites.
 */
export default function ConfirmationDialog({
  open,
  title = "Delete",
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}) {
  const headerTitle = title?.includes("?") ? "Delete" : title || "Delete";

  return (
    <ConfirmDialog
      open={open}
      title={headerTitle}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      destructive={confirmVariant === "danger"}
      loading={loading}
      onConfirm={onConfirm}
      onClose={onCancel}
    />
  );
}
