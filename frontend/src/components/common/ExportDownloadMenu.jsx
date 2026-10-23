import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";

import Button from "./Button";

export default function ExportDownloadMenu({
  onExport,
  disabled = false,
  label = "Download",
  size = "md",
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const trigger = rootRef.current?.querySelector("button");
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const top = triggerRect.bottom + 6 + menuRect.height > window.innerHeight
        ? Math.max(8, triggerRect.top - menuRect.height - 6)
        : triggerRect.bottom + 6;
      const left = Math.min(triggerRect.left, window.innerWidth - menuRect.width - 8);
      setMenuPosition({ top, left: Math.max(8, left) });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const handleExport = (format) => {
    setOpen(false);
    onExport?.(format);
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="secondary"
        size={size}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        leftIcon={<Download className="h-4 w-4" aria-hidden />}
        rightIcon={<ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {label}
      </Button>

      {open ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: menuPosition?.top ?? 0, left: menuPosition?.left ?? 0, zIndex: 10050, visibility: menuPosition ? "visible" : "hidden" }}
          className="w-max min-w-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleExport("pdf")}
            className="flex w-full items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-left text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
          >
            <FileText className="h-4 w-4 shrink-0 text-[var(--color-danger)]" aria-hidden />
            Export PDF
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleExport("excel")}
            className="flex w-full items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-left text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--color-success)]" aria-hidden />
            Export Excel
          </button>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
