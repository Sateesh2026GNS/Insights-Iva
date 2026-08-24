import { AlertTriangle } from "lucide-react";

import Button from "../common/Button";
import AdminModal from "./AdminModal";

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  loading = false,
  onConfirm,
  onClose,
}) {
  return (
    <AdminModal title={title} open={open} onClose={onClose} maxWidth="max-w-md">
      <div className="flex gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            destructive ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
          }`}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="pt-1 text-sm text-slate-600 dark:text-slate-300">{message}</p>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={destructive ? "danger" : "view"}
          onClick={onConfirm}
          disabled={loading}
          loading={loading}
        >
          {loading ? "Working…" : confirmLabel}
        </Button>
      </div>
    </AdminModal>
  );
}
