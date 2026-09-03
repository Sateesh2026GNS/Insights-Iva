import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { rowActionMenuItemClass } from "./rowActionTone.js";

const DEFAULT_MENU_WIDTH = 176;
const ITEM_HEIGHT = 36;

export default function RowActionMenu({
  rowId,
  openMenu,
  setOpenMenu,
  items = [],
  allowOperator = false,
  menuWidth = DEFAULT_MENU_WIDTH,
  ariaLabel = "Open actions",
}) {
  const auth = useContext(AuthContext);
  const role = (auth?.user?.role ?? auth?.user?.role_name ?? "").toLowerCase();
  const isOperator = role === "operator";

  const [localOpen, setLocalOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [focusIndex, setFocusIndex] = useState(-1);
  const btnRef = useRef(null);
  const itemRefs = useRef([]);

  const isControlled = openMenu !== undefined && setOpenMenu !== undefined;
  const isOpen = isControlled ? openMenu === rowId : localOpen;

  const menuEntries = (items || []).filter(Boolean);
  const actionableItems = menuEntries.filter((item) => !item.divider);

  const setIsOpen = (val) => {
    if (isControlled) {
      setOpenMenu(val ? rowId : null);
    } else {
      setLocalOpen(val);
    }
    if (!val) setFocusIndex(-1);
  };

  const openMenuAtButton = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const menuHeight = menuEntries.length * ITEM_HEIGHT + 8;
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
    setIsOpen(true);
    setFocusIndex(0);
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        btnRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((prev) => {
          const next = prev < actionableItems.length - 1 ? prev + 1 : 0;
          itemRefs.current[next]?.focus();
          return next;
        });
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((prev) => {
          const next = prev > 0 ? prev - 1 : actionableItems.length - 1;
          itemRefs.current[next]?.focus();
          return next;
        });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, actionableItems.length]);

  useEffect(() => {
    if (isOpen && focusIndex >= 0) {
      itemRefs.current[focusIndex]?.focus();
    }
  }, [isOpen, focusIndex]);

  if (isOperator && !allowOperator) return null;
  if (actionableItems.length === 0) return null;

  const stopRowClick = (event) => {
    event.stopPropagation();
  };

  let actionIndex = -1;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onMouseDown={stopRowClick}
        onTouchStart={stopRowClick}
        onPointerDown={stopRowClick}
        onClick={(event) => {
          stopRowClick(event);
          if (isOpen) {
            setIsOpen(false);
          } else {
            openMenuAtButton();
          }
        }}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
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
                onClick={() => setIsOpen(false)}
              />
              <div
                className="fixed z-[130] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
                style={{ top: menuPos.top, left: menuPos.left, width: menuWidth }}
                role="menu"
                aria-label={ariaLabel}
              >
                {menuEntries.map((item, index) => {
                  if (item.divider) {
                    return (
                      <div
                        key={`divider-${index}`}
                        className="my-1 border-t border-[var(--color-border-muted)]"
                        role="separator"
                      />
                    );
                  }

                  actionIndex += 1;
                  const currentActionIndex = actionIndex;
                  const label = String(item.label || "");
                  const isDanger =
                    item.danger ||
                    label.toLowerCase().includes("delete") ||
                    label.toLowerCase().includes("remove") ||
                    label.toLowerCase().includes("reject") ||
                    label.toLowerCase().includes("sign out");

                  return (
                    <button
                      key={`${label}-${index}`}
                      ref={(el) => {
                        itemRefs.current[currentActionIndex] = el;
                      }}
                      type="button"
                      role="menuitem"
                      tabIndex={focusIndex === currentActionIndex ? 0 : -1}
                      onMouseDown={stopRowClick}
                      onTouchStart={stopRowClick}
                      onPointerDown={stopRowClick}
                      onClick={(event) => {
                        stopRowClick(event);
                        setIsOpen(false);
                        btnRef.current?.focus();
                        item.onClick?.();
                      }}
                      className={rowActionMenuItemClass(label, { danger: isDanger })}
                    >
                      {item.icon ? (
                        <span className="shrink-0">
                          {typeof item.icon === "function" || (typeof item.icon === "object" && item.icon.$$typeof && item.icon.render)
                            ? <item.icon className="h-4 w-4" />
                            : item.icon}
                        </span>
                      ) : null}
                      <span>{label}</span>
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
