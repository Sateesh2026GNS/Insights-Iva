import { ChevronLeft, ChevronRight, Search } from "lucide-react";

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

export function InventorySearchInput({ value, onChange, placeholder = "Search...", className = "" }) {
  return (
    <div className={`relative ui-search-wrap w-full ${className}`}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-faint)]" />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="ui-input w-full py-2.5 pl-10 pr-4"
      />
    </div>
  );
}

export function InventoryToolbarButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`ui-btn ui-btn-secondary inline-flex items-center gap-2 !px-3 !py-2.5 text-[13px] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function InventoryPrimaryButton({ children, className = "", ...props }) {
  return (
    <button type="button" className={`ui-btn ui-btn-primary text-[13px] ${className}`} {...props}>
      {children}
    </button>
  );
}

export function InventoryOutlineButton({ children, className = "", ...props }) {
  return (
    <button type="button" className={`ui-btn ui-btn-outline text-[13px] ${className}`} {...props}>
      {children}
    </button>
  );
}

export const inventoryTableWrapClass = "inventory-table-scroll ui-table-wrap ui-table-wrap--scroll rounded-lg border border-[var(--color-border-soft)]";
export const inventoryTableClass = "min-w-full w-full border-collapse text-left text-[13px]";
export const inventoryTableHeadClass =
  "bg-[var(--color-surface-thead)] text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]";
export const inventoryThClass = "border-b border-[var(--color-border)] px-4 py-3";
export const inventoryTdClass = "border-b border-[var(--color-border-muted)] px-4 py-3 text-[var(--color-text)]";
export const inventoryRowClass = "border-b border-[var(--color-border-muted)] hover:bg-[var(--color-surface-muted)]";

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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-4 py-3 text-[13px] text-[var(--color-text-muted)]">
      <div className="flex flex-wrap items-center gap-2">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="ui-select rounded-md px-2 py-1.5 text-[13px]"
        >
          {pageSizes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="font-medium text-[var(--color-text)]">
          {total === 0 ? "0-0 of 0" : `${from}-${to} of ${total}`}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
          className="ui-btn ui-btn-secondary grid h-8 w-8 place-items-center !p-0 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {inventoryPageNumberItems(page, totalPages).map((item) =>
          typeof item === "string" ? (
            <span key={item} className="px-1 text-xs text-[var(--color-text-muted)]">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPage(item)}
              className={`grid h-8 min-w-8 place-items-center rounded-md border px-2 text-[13px] font-semibold ${
                item === page
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
              }`}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          className="ui-btn ui-btn-secondary grid h-8 w-8 place-items-center !p-0 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
