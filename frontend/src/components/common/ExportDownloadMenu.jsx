import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";

import Button from "./Button";

export default function ExportDownloadMenu({
  onExport,
  disabled = false,
  label = "Download",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
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

  const handleExport = (format) => {
    setOpen(false);
    onExport?.(format);
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        leftIcon={<Download className="h-4 w-4" aria-hidden />}
        rightIcon={<ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {label}
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 min-w-[168px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleExport("pdf")}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
          >
            <FileText className="h-4 w-4 shrink-0 text-[var(--color-danger)]" aria-hidden />
            Export PDF
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleExport("excel")}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--color-success)]" aria-hidden />
            Export Excel
          </button>
        </div>
      ) : null}
    </div>
  );
}
