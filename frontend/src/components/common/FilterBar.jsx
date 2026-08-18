import { Search } from "lucide-react";

import { filterBarClass, filterLabelClass, inputSearchClass, selectClass } from "../../design-system/classes";

/**
 * Reusable filter toolbar — search + optional select filters + trailing actions.
 * Used by Finance, Quality, Maintenance, and list pages.
 */
export default function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  searchLabel = "Search",
  showSearch = true,
  filters = [],
  children,
  className = "",
  layout = "wrap",
}) {
  const gridClass =
    layout === "grid"
      ? "grid gap-3 lg:grid-cols-12 lg:items-end"
      : "flex flex-wrap items-end gap-3.5";

  return (
    <div className={`${filterBarClass} ${className}`.trim()}>
      <div className={gridClass}>
        {showSearch ? (
          <div className={layout === "grid" ? "lg:col-span-6 ui-search-wrap" : "min-w-[10rem] flex-1 ui-search-wrap"}>
            {searchLabel ? <label className={filterLabelClass}>{searchLabel}</label> : null}
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-icon)]"
                aria-hidden
              />
              <input
                type="search"
                value={search ?? ""}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder={searchPlaceholder}
                className={inputSearchClass}
              />
            </div>
          </div>
        ) : null}

        {filters.map((f) => (
          <div
            key={f.key || f.label}
            className={layout === "grid" ? f.colClass || "lg:col-span-3" : "min-w-[8.5rem]"}
          >
            {f.label ? <label className={filterLabelClass}>{f.label}</label> : null}
            <select
              value={f.value ?? ""}
              onChange={(e) => f.onChange?.(e.target.value)}
              className={`${selectClass} ${f.className || ""}`.trim()}
            >
              {(f.options || []).map((opt) => {
                const val = typeof opt === "object" ? opt.value : opt;
                const label = typeof opt === "object" ? opt.label : opt;
                return (
                  <option key={String(val)} value={val}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
        ))}

        {children ? (
          <div className={layout === "grid" ? "lg:col-span-3 flex items-end" : "flex items-end"}>{children}</div>
        ) : null}
      </div>
    </div>
  );
}
