import ConfirmDialog from "../admin/ConfirmDialog";

export default function DeleteBankModal({
  open,
  onClose,
  onConfirm,
  title = "Delete",
  message = "Are you sure you want to delete this bank?",
  loading = false,
}) {
  const headerTitle = title?.includes("?") ? "Delete" : title || "Delete";

  return (
    <ConfirmDialog
      open={open}
      title={headerTitle}
      message={message}
      loading={loading}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
