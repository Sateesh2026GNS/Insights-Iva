import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Minus, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { rowActionMenuItemClass } from "../common/rowActionTone.js";

export default function InventoryRowActionsMenu({
  rowId,
  isOpen,
  onOpen,
  onClose,
  onView,
  onEdit,
  onAdd,
  onAddStock,
  onRemoveStock,
  onDelete,
  showView = true,
  showEdit = true,
  showAdd = true,
  showAddStock = false,
  showRemoveStock = false,
  showDelete = true,
  addLabel = "Add",
  menuWidth = 168,
}) {
  const btnRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const items = [
    showView ? { key: "view", label: "View", icon: Eye, onClick: onView } : null,
    showEdit ? { key: "edit", label: "Edit", icon: Pencil, onClick: onEdit } : null,
    showAddStock && onAddStock
      ? { key: "addStock", label: "Add Stock", icon: Plus, onClick: onAddStock }
      : null,
    showRemoveStock && onRemoveStock
      ? { key: "removeStock", label: "Remove Stock", icon: Minus, onClick: onRemoveStock }
      : null,
    showAdd && onAdd && !showAddStock
      ? { key: "add", label: addLabel, icon: Plus, onClick: onAdd }
      : null,
    showDelete ? { key: "delete", label: "Delete", icon: Trash2, onClick: onDelete, danger: true } : null,
  ].filter(Boolean);

  const toggleMenu = (event) => {
    event.stopPropagation();
    if (isOpen) {
      onClose();
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const itemHeight = 36;
      const menuHeight = items.length * itemHeight + 8;
      let top = rect.bottom + 4;
      let left = Math.max(8, rect.right - menuWidth);
      if (top + menuHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - menuHeight - 4);
      }
      if (left + menuWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - menuWidth - 8);
      }
      setMenuPos({ top, left });
    }
    onOpen(rowId);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleMenu}
        className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
        aria-label="More actions"
        title="More"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {isOpen
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[120] cursor-default bg-transparent"
                aria-label="Close menu"
                onClick={onClose}
              />
              <div
                className="fixed z-[130] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
                style={{ top: menuPos.top, left: menuPos.left, width: menuWidth }}
                role="menu"
              >
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      onClick={(event) => {
                        event.stopPropagation();
                        onClose();
                        item.onClick();
                      }}
                      className={rowActionMenuItemClass(item.label, { danger: item.danger })}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}
