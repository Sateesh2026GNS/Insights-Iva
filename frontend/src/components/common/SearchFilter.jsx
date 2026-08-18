import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SearchBar({ value, onChange, placeholder = "Search...", onClear }) {
  const { t } = useTranslation();
  return (
    <div className="relative ui-search-wrap flex-1">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--color-text-icon)]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || t("common.search")}
        className="ui-input !rounded-full pl-10 pr-10"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-icon)] hover:text-[var(--color-text)]"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function FilterSelect({ label, value, options, onChange, placeholder }) {
  return (
    <div className="flex items-center gap-2">
      {label ? <span className="ui-caption">{label}</span> : null}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="ui-select min-w-[120px]"
      >
        <option value="">{placeholder ?? "All"}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function SearchFilter({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters = [],
  filterValues,
  onFilterChange,
  resultCount,
  children,
}) {
  return (
    <div className="ui-toolbar">
      <SearchBar
        value={searchValue}
        onChange={onSearchChange}
        placeholder={searchPlaceholder}
      />
      {filters.map((f) => (
        <FilterSelect
          key={f.key}
          label={f.label}
          value={filterValues?.[f.key]}
          options={f.options}
          onChange={(v) => onFilterChange?.(f.key, v)}
          placeholder={f.placeholder}
        />
      ))}
      {typeof resultCount === "number" ? (
        <span className="ui-caption ml-auto">{resultCount} results</span>
      ) : null}
      {children}
    </div>
  );
}
