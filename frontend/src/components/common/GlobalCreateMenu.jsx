import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FileText, Receipt, ShoppingBag, Package, Users, BriefcaseBusiness, Factory, X } from "lucide-react";

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
  onMouseEnter,
  onMouseLeave,
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
    if (!anchor && !palette) return;
    const rect = anchor?.getBoundingClientRect();

    if (palette) {
      const isMobileOrNarrow = window.innerWidth < 768;
      const targetWidth = 450;
      const menuWidth = Math.min(targetWidth, window.innerWidth - (isMobileOrNarrow ? 24 : 32));

      if (!rect || isMobileOrNarrow) {
        // Fallback or mobile view: keep it nicely centered and adjusted
        const maxHeight = Math.max(180, window.innerHeight - 32);
        const measuredHeight = menuRef.current?.getBoundingClientRect().height || 0;
        const top = Math.max(16, (window.innerHeight - Math.min(measuredHeight, maxHeight)) / 2);
        const left = Math.max(12, (window.innerWidth - menuWidth) / 2);
        setPos({ top, left, width: menuWidth, maxHeight, bottom: "auto" });
        return;
      }

      // Anchor is present and we're on desktop/tablet (sidebar context)
      const sidebar = anchor.closest("aside") || anchor.closest("#app-sidebar");
      const sidebarRect = sidebar?.getBoundingClientRect();
      const anchorRight = sidebarRect ? sidebarRect.right : rect.right;

      const spaceOnRight = window.innerWidth - anchorRight - 16;
      const adjustedWidth = Math.min(menuWidth, Math.max(300, spaceOnRight - 8));
      const left = anchorRight + 8;

      // Start strictly from the Create button line
      const top = Math.max(8, rect.top);

      // Decreased controlled height so it aligns cleanly and looks compact
      const availableHeightBelow = Math.max(180, window.innerHeight - top - 16);
      const maxHeight = Math.min(460, availableHeightBelow);

      setPos({ top, left, width: adjustedWidth, maxHeight, bottom: "auto" });
      return;
    }

    let left = rect.left + rect.width / 2 - menuWidth / 2;
    if (align === "end") {
      left = rect.right - menuWidth;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    const bottom = window.innerHeight - rect.top + 8;
    setPos({ bottom, left, width: menuWidth });
  }, [anchorRef, align, palette]);

  useEffect(() => {
    if (!open) return undefined;
    if (menuRef.current) menuRef.current.scrollTop = 0;
    syncPosition();
    const rafId = requestAnimationFrame(syncPosition);
    const onScroll = () => syncPosition();
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      cancelAnimationFrame(rafId);
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

  const handleMouseEnter = onMouseEnter || onPointerEnter;
  const handleMouseLeave = onMouseLeave || onPointerLeave;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Add"
      className={`app-shell-create-menu ${palette ? "!box-border !p-3.5 !rounded-2xl !shadow-2xl !overflow-x-hidden !overflow-y-auto" : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerEnter={handleMouseEnter}
      onPointerLeave={handleMouseLeave}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        bottom: pos.bottom,
        width: pos.width || (palette ? "min(450px, calc(100vw - 32px))" : 220),
        maxWidth: "min(450px, calc(100vw - 32px))",
        maxHeight: pos.maxHeight,
        zIndex: 200,
      }}
    >
      {/* Invisible hover bridge to prevent mouse leaving when moving between sidebar anchor and flyout menu */}
      {palette && anchorRef?.current && (
        <div
          className="absolute -left-3 top-0 bottom-0 w-3 pointer-events-auto"
          aria-hidden="true"
        />
      )}

      {palette ? (
        <div className="space-y-3">
          {Object.entries(groupedItems).map(([group, groupItems], groupIndex) => {
            const GroupIcon = groupIcons[group] || BriefcaseBusiness;
            return (
              <section key={group} aria-label={group}>
                <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{group}</h2>
                  {groupIndex === 0 && (
                    <button
                      type="button"
                      aria-label="Close create menu"
                      title="Close"
                      onClick={() => {
                        onOpenChange?.(false);
                        anchorRef?.current?.focus();
                      }}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
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
                        className="gcm-palette-card flex min-h-[42px] min-w-0 items-center gap-2.5 rounded-xl bg-slate-100 px-3 py-2 text-left text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] dark:bg-slate-800 dark:text-slate-100"
                        style={{ "--gcm-accent": borderColor }}
                        onClick={() => handleSelect(item.path)}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm ${iconBg}`}>
                          <GroupIcon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0 truncate leading-tight">{item.label}</span>
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
