import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

/**
 * Lightweight searchable dropdown — no extra packages.
 * options: string[] | { value, label }[]
 */
export default function SearchableSelect({
  value = "",
  onChange,
  options = [],
  placeholder = "Select…",
  searchPlaceholder = "Search",
  disabled = false,
  error = false,
  allowCustom = false,
  className = "",
  id,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const normalized = useMemo(
    () =>
      options.map((o) =>
        typeof o === "string" ? { value: o, label: o } : { value: o.value, label: o.label }
      ),
    [options]
  );

  const selectedLabel =
    normalized.find((o) => o.value === value)?.label || (allowCustom ? value : "") || "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter(
      (o) => o.label.toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q)
    );
  }, [normalized, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const baseClass = `flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-800 dark:text-slate-100 ${
    error
      ? "border-red-400 focus:ring-red-400/30"
      : "border-slate-300/80 focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20 dark:border-slate-600"
  } ${className}`;

  const pick = (opt) => {
    onChange?.(opt.value);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={baseClass}
      >
        <span className={selectedLabel ? "truncate text-slate-800 dark:text-slate-100" : "truncate text-slate-400"}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-700">
            <Search className="h-4 w-4 text-slate-400" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter" && allowCustom && query.trim()) {
                  onChange?.(query.trim());
                  setOpen(false);
                }
              }}
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-center text-xs text-slate-500">
                {allowCustom && query.trim() ? (
                  <button
                    type="button"
                    className="font-medium text-[var(--color-success)] hover:underline"
                    onClick={() => {
                      onChange?.(query.trim());
                      setOpen(false);
                    }}
                  >
                    Use “{query.trim()}”
                  </button>
                ) : (
                  "No matches"
                )}
              </li>
            ) : (
              filtered.map((opt) => {
                const active = opt.value === value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pick(opt)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                        active
                          ? "bg-[var(--color-success-soft)] text-[var(--color-success)] dark:bg-teal-900/30 dark:text-teal-200"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/50"
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {active ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
