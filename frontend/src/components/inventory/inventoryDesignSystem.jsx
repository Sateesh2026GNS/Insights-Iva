import { ChevronLeft, ChevronRight } from "lucide-react";

import Button, { AddButton } from "../common/Button";
import { SearchBar } from "../common/SearchFilter";

export function InventorySearchInput({ value, onChange, placeholder = "Search", className = "", disabled = false }) {
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

export const INVENTORY_PAGE_BG = "var(--color-bg)";
export const INVENTORY_PAGE_SIZES = [10, 20, 50];

export function InventoryPageShell({ children, className = "" }) {
  return (
    <div className={`min-h-full bg-[var(--color-bg)] ${className}`}>
      <div className="ui-page">{children}</div>
    </div>
  );
}

export function InventoryPageCard({ children, className = "" }) {
  return <div className={`ui-card overflow-hidden ${className}`}>{children}</div>;
}

export function InventoryTabs({ tabs, active, onChange, action = null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-2 pt-2 sm:px-3">
      <div className="relative flex min-w-0 flex-1 gap-1">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`relative px-4 py-3 text-[14px] font-semibold transition-colors ${
                isActive
                  ? "text-[var(--color-text)]"
                  : "text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]"
              }`}
            >
              {t.label}
              {isActive ? (
                <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-[var(--color-primary)]" />
              ) : null}
            </button>
          );
        })}
      </div>
      {action ? <div className="mb-2 mr-1 shrink-0">{action}</div> : null}
    </div>
  );
}

export function InventoryToolbarButton({ children, className = "", ...props }) {
  return (
    <Button variant="secondary" className={`!px-3 !py-2.5 text-[13px] ${className}`} {...props}>
      {children}
    </Button>
  );
}

export function InventoryAddButton({ children, className = "", ...props }) {
  return (
    <AddButton className={`text-[13px] ${className}`} {...props}>
      {children}
    </AddButton>
  );
}

export function InventoryPrimaryButton({ children, className = "", ...props }) {
  return (
    <Button variant="primary" className={`text-[13px] ${className}`} {...props}>
      {children}
    </Button>
  );
}

export function InventoryOutlineButton({ children, className = "", ...props }) {
  return (
    <Button variant="outline" className={`text-[13px] ${className}`} {...props}>
      {children}
    </Button>
  );
}

export const inventoryTableWrapClass = "inventory-table-scroll ui-table-wrap ui-table-wrap--scroll";
export const inventoryTableClass = "ui-table min-w-full w-full border-collapse text-left";
export const inventoryTableHeadClass = "ui-table-head";
export const inventoryThClass = "px-4 py-3";
export const inventoryTdClass = "px-4 py-3";
export const inventoryRowClass = "";

export const inventoryRowActionClass =
  "inline-grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-soft)]";

export function inventoryPageNumberItems(current, total) {
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

export function InventoryPagination({ page, pageSize, total, onPage, onPageSize, pageSizes = INVENTORY_PAGE_SIZES }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="ui-pagination justify-between w-full border-t border-[var(--color-border-soft)] px-4 py-3 text-[13px] text-[var(--color-text-secondary)]">
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
        {inventoryPageNumberItems(page, totalPages).map((item, idx) =>
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
