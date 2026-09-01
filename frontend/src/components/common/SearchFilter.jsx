import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Vendors-page reference — shared list search layout tokens */
export const SEARCH_BAR_WRAP_CLASS = "relative ui-search-wrap min-w-[10rem] flex-1";
export const SEARCH_BAR_INPUT_CLASS = "ui-input w-full !rounded-full !pl-10";

/** Navbar global search — same ui-input styling, wider cap */
export const NAVBAR_SEARCH_WRAP_CLASS = "relative ui-search-wrap navbar-search-wrap min-w-0 w-full flex-1";
export const NAVBAR_SEARCH_INPUT_CLASS = "ui-input global-search-input w-full !rounded-full !pl-10";

/** Compact variant — dropdowns, forms, filters, autocomplete */
export const SEARCH_BAR_COMPACT_WRAP_CLASS = "relative ui-search-wrap ui-search-wrap--compact min-w-0 flex-none";
export const SEARCH_BAR_COMPACT_INPUT_CLASS =
  "ui-input ui-search-input--compact w-full !rounded-full !pl-8 !text-[13px]";

const SIZE_PRESETS = {
  default: {
    wrap: SEARCH_BAR_WRAP_CLASS,
    input: SEARCH_BAR_INPUT_CLASS,
    iconLeft: "left-3.5",
    iconSize: "h-4 w-4",
    clearRight: "right-3",
    clearSize: "h-4 w-4",
    clearPadding: " !pr-10",
  },
  compact: {
    wrap: SEARCH_BAR_COMPACT_WRAP_CLASS,
    input: SEARCH_BAR_COMPACT_INPUT_CLASS,
    iconLeft: "left-3",
    iconSize: "h-3.5 w-3.5",
    clearRight: "right-2.5",
    clearSize: "h-3.5 w-3.5",
    clearPadding: " !pr-8",
  },
};

/**
 * Standard list/table search bar (Vendors page reference).
 * onChange receives the string value.
 * Use size="compact" for dropdown, form-embedded, and filter contexts only.
 */
export function SearchBar({
  value = "",
  onChange,
  placeholder,
  onClear,
  className = "",
  inputClassName = "",
  disabled = false,
  clearable = true,
  autoFocus = false,
  size = "default",
  onFocus,
  onBlur,
  onKeyDown,
  onClick,
  inputRef,
  id,
  type = "search",
  list,
  autoComplete,
  role,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  "aria-activedescendant": ariaActivedescendant,
  "aria-label": ariaLabel,
}) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("common.search", { defaultValue: "Search" });
  const hasValue = String(value ?? "").length > 0;
  const preset = SIZE_PRESETS[size] ?? SIZE_PRESETS.default;

  const handleClear = () => {
    onChange?.("");
    onClear?.();
  };

  return (
    <div className={`${preset.wrap}${className ? ` ${className}` : ""}`}>
      <Search
        className={`pointer-events-none absolute ${preset.iconLeft} top-1/2 z-10 ${preset.iconSize} -translate-y-1/2 text-[var(--color-text-icon)]`}
        aria-hidden
      />
      <input
        ref={inputRef}
        type={type}
        id={id}
        list={list}
        aria-label={ariaLabel ?? resolvedPlaceholder}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onClick={onClick}
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        role={role}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        aria-activedescendant={ariaActivedescendant}
        className={`${preset.input}${hasValue && clearable ? preset.clearPadding : ""}${
          inputClassName ? ` ${inputClassName}` : ""
        }`}
      />
      {hasValue && clearable ? (
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className={`absolute ${preset.clearRight} top-1/2 z-10 -translate-y-1/2 text-[var(--color-text-icon)] transition-colors hover:text-[var(--color-text)] disabled:opacity-50`}
          aria-label="Clear search"
        >
          <X className={preset.clearSize} />
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
      <SearchBar value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} />
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
