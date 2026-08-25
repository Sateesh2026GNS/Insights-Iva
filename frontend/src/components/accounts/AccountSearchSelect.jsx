import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

import { SearchBar } from "../common/SearchFilter";

/**
 * Searchable account picker for journal lines.
 * Dropdown is portaled to document.body so it cannot be clipped.
 */
export default function AccountSearchSelect({
  value = "",
  label = "",
  options = [],
  onChange,
  placeholder = "Select account",
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Only filter after the user types; empty query = full list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const measure = () => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 2;
    const preferUp = r.top > window.innerHeight - r.bottom && r.top > 160;
    const maxH = 220;
    if (preferUp) {
      setPos({
        left: Math.max(8, r.left),
        width: r.width,
        bottom: window.innerHeight - r.top + gap,
        top: "auto",
        maxHeight: Math.min(maxH, Math.max(140, r.top - 12)),
      });
    } else {
      setPos({
        left: Math.max(8, r.left),
        width: r.width,
        top: r.bottom + gap,
        bottom: "auto",
        maxHeight: Math.min(maxH, Math.max(140, window.innerHeight - r.bottom - 12)),
      });
    }
  };

  const openMenu = () => {
    setQuery("");
    setHighlight(0);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }
    measure();
    const onWin = () => measure();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    // defer so the opening click does not immediately close
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  const pick = (opt) => {
    onChange?.(opt);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) pick(filtered[highlight]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const displayValue = open ? query : label || "";

  return (
    <div ref={rootRef} className="relative w-full">
      <SearchBar
        size="compact"
        value={displayValue}
        onChange={(next) => {
          setQuery(next);
          setHighlight(0);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          if (!open) openMenu();
        }}
        onClick={() => {
          if (!open) openMenu();
        }}
        onKeyDown={onKeyDown}
        placeholder={open ? "Search" : placeholder}
        clearable={false}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={placeholder}
        inputRef={inputRef}
        className="w-full"
        inputClassName="!pr-9"
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className="absolute right-2.5 top-1/2 z-20 -translate-y-1/2 text-[var(--color-text-icon)] transition-colors hover:text-[var(--color-text)]"
        aria-label="Toggle accounts"
        tabIndex={-1}
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              className="fixed z-[9999] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
              style={{
                left: pos.left,
                width: pos.width,
                top: pos.top === "auto" ? undefined : pos.top,
                bottom: pos.bottom === "auto" ? undefined : pos.bottom,
                maxHeight: pos.maxHeight,
              }}
            >
              {options.length === 0 ? (
                <div className="px-3 py-3 text-[13px] text-[var(--color-text-muted)]">
                  No accounts loaded
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-3 text-[13px] text-[var(--color-text-muted)]">
                  No matching accounts
                </div>
              ) : (
                filtered.map((opt, idx) => {
                  const active = idx === highlight || opt.value === value;
                  return (
                    <button
                      key={`${opt.value}-${opt.label}`}
                      type="button"
                      role="option"
                      aria-selected={opt.value === value}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(opt);
                      }}
                      onMouseEnter={() => setHighlight(idx)}
                      className={`block w-full px-3 py-2 text-left text-[13px] ${
                        active
                          ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]"
                          : "bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
