import { Eye, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RowActionMenu from "./RowActionMenu";

/**
 * 3-dots vertical action menu for table rows with View / Edit / Delete.
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
  extraItems = [],
  rowId,
  openMenu,
  setOpenMenu,
  className = "",
  viewDisabled = false,
  editDisabled = false,
  deleteDisabled = false,
}) {
  const navigate = useNavigate();

  const handleView = () => {
    if (viewDisabled) return;
    if (onView) onView();
    else if (viewTo) navigate(viewTo);
  };

  const handleEdit = () => {
    if (editDisabled) return;
    if (onEdit) onEdit();
    else if (editTo) navigate(editTo);
  };

  const handleDelete = () => {
    if (deleteDisabled) return;
    if (onDelete) onDelete();
  };

  const items = [
    showView && (onView || viewTo)
      ? {
          label: viewLabel,
          icon: <Eye className="h-4 w-4" />,
          onClick: handleView,
          disabled: viewDisabled,
        }
      : null,
    showEdit && (onEdit || editTo)
      ? {
          label: editLabel,
          icon: <Pencil className="h-4 w-4" />,
          onClick: handleEdit,
          disabled: editDisabled,
        }
      : null,
    ...(Array.isArray(extraItems) ? extraItems : []),
    showDelete && onDelete ? { divider: true } : null,
    showDelete && onDelete
      ? {
          label: deleteLabel,
          icon: <Trash2 className="h-4 w-4" />,
          danger: true,
          onClick: handleDelete,
          disabled: deleteDisabled,
        }
      : null,
  ].filter(Boolean);

  return (
    <div className={`flex items-center justify-end ${className}`}>
      <RowActionMenu
        rowId={rowId || "action-menu"}
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        items={items}
      />
    </div>
  );
}
