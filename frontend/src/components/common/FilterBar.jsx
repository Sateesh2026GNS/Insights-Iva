import { SearchBar } from "./SearchFilter";
import { filterBarClass, filterLabelClass, selectClass } from "../../design-system/classes";

/**
 * Reusable filter toolbar — search + optional select filters + trailing actions.
 * Used by Finance, Quality, Maintenance, and list pages.
 */
export default function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search",
  searchLabel = "",
  showSearch = true,
  searchClassName = "",
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
          <div className={layout === "grid" ? "lg:col-span-6" : ""}>
            {searchLabel ? <label className={filterLabelClass}>{searchLabel}</label> : null}
            <SearchBar
              value={search ?? ""}
              onChange={onSearchChange}
              placeholder={searchPlaceholder}
              className={layout === "grid" ? `w-full ${searchClassName}`.trim() : searchClassName}
            />
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
