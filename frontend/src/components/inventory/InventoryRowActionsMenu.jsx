import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Minus, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { rowActionMenuItemClass } from "../common/rowActionTone.js";

const ITEM_HEIGHT = 36;
const MENU_PADDING = 8;

/** Hidden responsive duplicates (desktop table + mobile cards) share openMenuId. */
function isActionTriggerVisible(buttonEl) {
  if (!buttonEl || typeof window === "undefined") return false;
  let node = buttonEl;
  while (node && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
    node = node.parentElement;
  }
  return true;
}

function computeMenuPosition(rect, menuWidth, itemCount) {
  const menuHeight = itemCount * ITEM_HEIGHT + MENU_PADDING;
  let top = rect.bottom + 4;
  let left = Math.max(8, rect.right - menuWidth);

  if (top + menuHeight > window.innerHeight - 8) {
    top = Math.max(8, rect.top - menuHeight - 4);
  }
  if (left + menuWidth > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - menuWidth - 8);
  }
  return { top, left };
}

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
  editLabel = "Edit",
  editIcon,
  menuWidth = 168,
}) {
  const btnRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);
  const [showPortal, setShowPortal] = useState(false);
  const EditIcon = editIcon || Pencil;

  const items = [
    showView ? { key: "view", label: "View", icon: Eye, onClick: onView } : null,
    showEdit ? { key: "edit", label: editLabel, icon: EditIcon, onClick: onEdit } : null,
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

  const syncMenuPosition = () => {
    const btn = btnRef.current;
    if (!isActionTriggerVisible(btn)) {
      setShowPortal(false);
      setMenuPos(null);
      return false;
    }
    const rect = btn.getBoundingClientRect();
    setMenuPos(computeMenuPosition(rect, menuWidth, items.length));
    setShowPortal(true);
    return true;
  };

  const toggleMenu = (event) => {
    event.stopPropagation();
    if (isOpen) {
      onClose();
      return;
    }
    if (!syncMenuPosition()) return;
    onOpen(rowId);
  };

  useEffect(() => {
    if (!isOpen) {
      setShowPortal(false);
      setMenuPos(null);
      return undefined;
    }
    syncMenuPosition();
    return undefined;
  }, [isOpen, menuWidth, items.length]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose();
        btnRef.current?.focus();
      }
    };
    const onReposition = () => {
      if (!syncMenuPosition()) onClose();
    };

    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [isOpen, onClose, menuWidth, items.length]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleMenu}
        className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
        aria-label="More actions"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title="More"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {isOpen && showPortal && menuPos
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
