import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function ReportFormatDropdown({
  value,
  onChange,
  formats,
  disabled = false,
  ariaLabel = "Report export format",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const listId = useId();
  const options = formats?.length ? formats : [];

  const selected = options.find((f) => f.id === value) || options[0];
  const selectedIndex = Math.max(0, options.findIndex((f) => f.id === selected?.id));

  useEffect(() => {
    if (!open) return undefined;
    setActiveIndex(selectedIndex);
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!open) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + options.length) % options.length);
      } else if (event.key === "Enter" && options[activeIndex]) {
        event.preventDefault();
        onChange?.(options[activeIndex].id);
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, options, activeIndex, onChange, selectedIndex]);

  return (
    <div ref={rootRef} className={`relative w-[9rem] max-w-full shrink-0 ${className}`.trim()}>
      <button
        type="button"
        disabled={disabled || !options.length}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="report-export-toolbar__action ui-btn ui-btn--secondary w-full !justify-between gap-2 !px-3 border-solid text-left normal-case tracking-normal"
      >
        <span className="truncate">{selected?.label || "PDF"}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 opacity-70 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] py-0.5 shadow-md"
        >
          {options.map((fmt, index) => {
            const isSelected = fmt.id === value;
            const isActive = index === activeIndex;
            return (
              <li key={fmt.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`flex w-full items-center px-3 py-2 text-left text-sm font-medium ${
                    isSelected || isActive
                      ? "bg-[var(--color-surface-hover)] text-[var(--color-text)]"
                      : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    onChange?.(fmt.id);
                    setOpen(false);
                  }}
                >
                  {fmt.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
