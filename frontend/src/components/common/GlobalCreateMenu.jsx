import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import { getGlobalCreateActionsForUser } from "../../config/globalCreateActions";

/**
 * Permission-filtered global Add / Create menu (single canonical instance).
 */
export default function GlobalCreateMenu({
  open,
  onOpenChange,
  anchorRef,
  align = "center",
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const items = useMemo(() => getGlobalCreateActionsForUser(user), [user]);

  const syncPosition = useCallback(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 220;
    let left = rect.left + rect.width / 2 - menuWidth / 2;
    if (align === "end") left = rect.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    const bottom = window.innerHeight - rect.top + 8;
    setPos({ bottom, left, width: menuWidth });
  }, [anchorRef, align]);

  useEffect(() => {
    if (!open) return undefined;
    syncPosition();
    const onScroll = () => syncPosition();
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, syncPosition]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onOpenChange?.(false);
        anchorRef?.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange, anchorRef]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onOpenChange?.(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onOpenChange, anchorRef]);

  const handleSelect = (path) => {
    onOpenChange?.(false);
    navigate(path);
  };

  if (!open || items.length === 0) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Add"
      className="app-shell-create-menu"
      style={{
        position: "fixed",
        left: pos.left,
        bottom: pos.bottom,
        width: pos.width,
        zIndex: 200,
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className="app-shell-create-menu__item"
          onClick={() => handleSelect(item.path)}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
