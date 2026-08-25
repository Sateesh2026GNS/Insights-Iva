import { ChevronLeft, ChevronRight } from "lucide-react";
import Button, { AddButton } from "../common/Button";
import { SearchBar } from "../common/SearchFilter";

export { default as Loader } from "../common/Loader";

import { inputMtClass } from "../../design-system/classes";
export const ACCOUNTS_PAGE_BG = "var(--color-bg)";
export const ACCOUNTS_PURPLE = "var(--color-primary)";
export const ACCOUNTS_BLUE = "var(--color-primary)";
export const ACCOUNTS_TEAL = "var(--color-action-teal)";
export const ACCOUNTS_TEXT = "var(--color-text)";
export const ACCOUNTS_TEXT_MUTED = "var(--color-text-muted)";
export const ACCOUNTS_BORDER = "var(--color-border)";
export const ACCOUNTS_TABLE_HEADER = "var(--color-primary-soft)";
export const ACCOUNTS_TABLE_HEADER_ALT = "var(--color-surface-muted)";
export const ACCOUNTS_PAGE_SIZES = [10, 20, 50];

export function formatAccountsInr(value) {
  const n = Number(value) || 0;
  return `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function accountsPageNumberItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items = [1];
  if (current > 3) items.push("ellipsis-start");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let p = start; p <= end; p += 1) items.push(p);
  if (current < total - 2) items.push("ellipsis-end");
  if (total > 1) items.push(total);
  return items;
}

export function AccountsPageShell({ children, className = "" }) {
  return (
    <div className={`min-h-full bg-[var(--color-bg)] ${className}`}>
      <div className="ui-page">{children}</div>
    </div>
  );
}

export function AccountsCard({ children, className = "" }) {
  return (
    <div className={`ui-card overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function AccountsTabs({ tabs, active, onChange }) {
  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
      <div className="flex overflow-x-auto">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`relative shrink-0 whitespace-nowrap border-r border-[var(--color-border)] px-4 py-3.5 text-[13px] font-semibold transition-colors last:border-r-0 sm:px-5 ${
                isActive
                  ? "bg-[var(--color-surface)] text-[var(--color-primary)] after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-[var(--color-primary)]"
                  : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AccountsKpiCard({ label, value, sub, icon: Icon, tint, iconColor, valueColor = ACCOUNTS_TEXT }) {
  return (
    <div
      className="ui-kpi flex min-h-[var(--kpi-min-height)] items-center gap-3 rounded-xl border border-[var(--color-border-soft)] p-3"
      style={{ backgroundColor: tint }}
    >
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface)]/70 shadow-sm"
        style={{ color: iconColor }}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[var(--color-text-muted)]">{label}</p>
        <p className="ui-kpi__value truncate text-xl leading-tight" style={{ color: valueColor }}>
          {value}
        </p>
        {sub ? <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{sub}</p> : null}
      </div>
    </div>
  );
}

export function accountsKpiEntry(label, value, sub, icon, tint, iconColor, valueColor = ACCOUNTS_TEXT) {
  return { label, value, sub, icon, tint, iconColor, valueColor };
}

export function AccountsSearchInput({ value, onChange, placeholder = "Search", className = "", disabled = false }) {
  return (
    <SearchBar
      value={value}
      onChange={(next) => onChange?.({ target: { value: next } })}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
}

export function AccountsPagination({ page, pageSize, total, onPage, onPageSize, pageSizes = ACCOUNTS_PAGE_SIZES }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="ui-pagination justify-between w-full border-t border-[var(--color-border-soft)] px-1 pt-4 text-[13px] text-[var(--color-text-secondary)]">
      <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="ui-pagination-select"
        >
          {pageSizes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="font-medium text-[var(--color-text-secondary)]">
          {total === 0 ? "0-0 of 0" : `${from}-${to} of ${total}`}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
          className="ui-page-btn"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {accountsPageNumberItems(page, totalPages).map((item, idx) =>
          typeof item === "string" ? (
            <span key={`dots-${idx}`} className="px-1 text-xs text-[var(--color-text-muted)]">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPage(item)}
              className={`ui-page-btn ${item === page ? "ui-page-btn--active" : ""}`}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          className="ui-page-btn"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function AccountsAddButton({ children, className = "", ...props }) {
  return (
    <AddButton className={className} {...props}>
      {children}
    </AddButton>
  );
}

export function AccountsPrimaryButton({ children, className = "", ...props }) {
  return (
    <Button variant="primary" className={className} {...props}>
      {children}
    </Button>
  );
}

export function AccountsBlueButton({ children, className = "", ...props }) {
  return (
    <Button variant="edit" className={className} {...props}>
      {children}
    </Button>
  );
}

export function AccountsOutlineButton({ children, className = "", ...props }) {
  return (
    <Button variant="outline" className={className} {...props}>
      {children}
    </Button>
  );
}

export function AccountsSecondaryButton({ children, className = "", ...props }) {
  return (
    <Button variant="secondary" className={className} {...props}>
      {children}
    </Button>
  );
}

export const accountsTableHeadClass = "ui-table-head";
export const accountsTableHeadAltClass = "ui-table-head";
export const accountsTableWrapClass = "ui-table-wrap ui-table-wrap--scroll";
export const accountsTableClass = "ui-table min-w-full w-full border-collapse text-left";
export const accountsThClass = "px-4 py-3 font-semibold";
export const accountsTdClass = "px-4 py-3.5 align-middle";

/** Standard form control — use with FormField or standalone */
export const ACCOUNTS_INPUT_CLASS = inputMtClass;

/** Icon / row action button in accounts tables */
export const accountsRowActionClass =
  "inline-grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]";

export { default as AccountsLoader } from "../common/Loader";
