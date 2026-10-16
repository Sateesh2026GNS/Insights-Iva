import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FileText, Receipt, ShoppingBag, Package, Users, BriefcaseBusiness, Factory } from "lucide-react";

import useAuth from "../../hooks/useAuth";
import { getGlobalCreateActionsForUser } from "../../config/globalCreateActions";

/**
 * Permission-filtered global Add / Create menu (single canonical instance).
 */
export default function GlobalCreateMenu({
  open,
  onOpenChange,
  onPointerEnter,
  onPointerLeave,
  anchorRef,
  align = "center",
  palette = false,
  onSelect,
  navSections,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const items = useMemo(
    () => getGlobalCreateActionsForUser(user, navSections),
    [user, navSections]
  );

  const syncPosition = useCallback(() => {
    const anchor = anchorRef?.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const sideLeft = rect.right + 12;
    const sideWidth = window.innerWidth - sideLeft - 16;
    const openBesideAnchor = palette && sideWidth >= 320;
    const menuWidth = palette
      ? Math.min(760, openBesideAnchor ? sideWidth : window.innerWidth - 32)
      : 220;
    let left = rect.left + rect.width / 2 - menuWidth / 2;
    if (palette) {
      left = openBesideAnchor ? sideLeft : 16;
    } else if (align === "end") {
      left = rect.right - menuWidth;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    const bottom = palette ? undefined : window.innerHeight - rect.top + 8;
    const top = palette ? Math.max(16, Math.min(rect.top, window.innerHeight - 160)) : undefined;
    const maxHeight = palette ? Math.max(180, window.innerHeight - top - 12) : undefined;
    setPos({ bottom, top, left, width: menuWidth, maxHeight });
  }, [anchorRef, align, palette]);

  useEffect(() => {
    if (!open) return undefined;
    if (menuRef.current) menuRef.current.scrollTop = 0;
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
    onSelect?.();
    navigate(path);
  };

  if (!open || items.length === 0) return null;

  const groupedItems = items.reduce((groups, item) => {
    const group = item.group || "Other";
    (groups[group] ||= []).push(item);
    return groups;
  }, {});
  const groupIcons = {
    Sales: Receipt,
    Purchase: ShoppingBag,
    Inventory: Package,
    Production: Factory,
    HR: Users,
    Finance: FileText,
    Other: BriefcaseBusiness,
  };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Add"
      className={`app-shell-create-menu ${palette ? "!box-border !p-5 sm:!p-6 !rounded-2xl !shadow-2xl !overflow-x-hidden !overflow-y-auto" : ""}`}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        bottom: pos.bottom,
        width: pos.width,
        maxHeight: pos.maxHeight,
        zIndex: 200,
      }}
    >
      {palette ? (
        <div className="space-y-5">
          {Object.entries(groupedItems).map(([group, groupItems]) => {
            const GroupIcon = groupIcons[group] || BriefcaseBusiness;
            return (
              <section key={group} aria-label={group}>
                <h2 className="mb-2.5 px-1 text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{group}</h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {groupItems.map((item, index) => {
                    const accentColors = [
                      { icon: "bg-amber-500",  border: "#f59e0b" },
                      { icon: "bg-cyan-600",   border: "#0891b2" },
                      { icon: "bg-rose-500",   border: "#f43f5e" },
                      { icon: "bg-violet-600", border: "#7c3aed" },
                    ];
                    const { icon: iconBg, border: borderColor } = accentColors[index % accentColors.length];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        className="gcm-palette-card flex min-h-16 min-w-0 items-center gap-3 rounded-xl bg-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] dark:bg-slate-800 dark:text-slate-100"
                        style={{ "--gcm-accent": borderColor }}
                        onClick={() => handleSelect(item.path)}
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${iconBg}`}>
                          <GroupIcon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0 break-words">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : items.map((item) => (
        <button key={item.id} type="button" role="menuitem" className="app-shell-create-menu__item" onClick={() => handleSelect(item.path)}>
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
