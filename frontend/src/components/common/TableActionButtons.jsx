import { Eye, Pencil, Trash2 } from "lucide-react";
import Button from "./Button";

/**
 * Compact inline View / Edit / Delete actions for table rows.
 * View → green, Edit → blue, Delete → red.
 */
export default function TableActionButtons({
  onView,
  onEdit,
  onDelete,
  showView = true,
  showEdit = true,
  showDelete = true,
  viewLabel = "View",
  editLabel = "Edit",
  deleteLabel = "Delete",
  viewTo,
  editTo,
  size = "sm",
  className = "",
  viewDisabled = false,
  editDisabled = false,
  deleteDisabled = false,
}) {
  return (
    <div className={`flex flex-wrap items-center justify-end gap-1.5 ${className}`}>
      {showView && (onView || viewTo) ? (
        <Button
          variant="view"
          size={size}
          to={viewTo}
          onClick={onView}
          disabled={viewDisabled}
          leftIcon={<Eye className="h-3.5 w-3.5" aria-hidden />}
        >
          {viewLabel}
        </Button>
      ) : null}
      {showEdit && (onEdit || editTo) ? (
        <Button
          variant="edit"
          size={size}
          to={editTo}
          onClick={onEdit}
          disabled={editDisabled}
          leftIcon={<Pencil className="h-3.5 w-3.5" aria-hidden />}
        >
          {editLabel}
        </Button>
      ) : null}
      {showDelete && onDelete ? (
        <Button
          variant="danger"
          size={size}
          onClick={onDelete}
          disabled={deleteDisabled}
          leftIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden />}
        >
          {deleteLabel}
        </Button>
      ) : null}
    </div>
  );
}
