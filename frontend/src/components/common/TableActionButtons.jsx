import { Eye, Pencil, Power, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RowActionMenu from "./RowActionMenu";

/**
 * 3-dots vertical action menu for table rows with View / Edit / Deactivate / Delete.
 */
export default function TableActionButtons({
  onView,
  onEdit,
  onDeactivate,
  onDelete,
  showView = true,
  showEdit = true,
  showDeactivate,
  showDelete = true,
  viewLabel = "View",
  editLabel = "Edit",
  deactivateLabel = "Deactivate",
  deleteLabel = "Delete",
  deactivateIcon,
  deleteIcon,
  viewTo,
  editTo,
  extraItems = [],
  rowId,
  openMenu,
  setOpenMenu,
  className = "",
  viewDisabled = false,
  editDisabled = false,
  deactivateDisabled = false,
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

  const handleDeactivate = () => {
    if (deactivateDisabled) return;
    if (onDeactivate) onDeactivate();
  };

  const handleDelete = () => {
    if (deleteDisabled) return;
    if (onDelete) onDelete();
  };

  const shouldShowDeactivate =
    showDeactivate !== undefined ? showDeactivate : Boolean(onDeactivate);

  const isDeactivateDeleteLabel = String(deleteLabel || "")
    .toLowerCase()
    .includes("deactivate");

  const resolvedDeleteIcon =
    deleteIcon ||
    (isDeactivateDeleteLabel ? (
      <Power className="h-4 w-4" />
    ) : (
      <Trash2 className="h-4 w-4" />
    ));

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
    shouldShowDeactivate && onDeactivate
      ? {
          label: deactivateLabel,
          icon: deactivateIcon || <Power className="h-4 w-4" />,
          onClick: handleDeactivate,
          disabled: deactivateDisabled,
        }
      : null,
    ...(Array.isArray(extraItems) ? extraItems : []),
    showDelete && onDelete ? { divider: true } : null,
    showDelete && onDelete
      ? {
          label: deleteLabel,
          icon: resolvedDeleteIcon,
          danger: !isDeactivateDeleteLabel,
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

