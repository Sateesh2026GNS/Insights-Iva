/**
 * Shared ERP list-page tokens — sales, purchases, procurement document lists.
 * Use these instead of hardcoded #e4e4ea / bg-white one-offs.
 */

export const salesListBorderClass = "border-[var(--color-border)]";
export const salesListTableBorderClass = "border-[var(--color-table-border)]";
export const salesListSurfaceClass = "bg-[var(--color-surface)]";
export const salesListMutedSurfaceClass = "bg-[var(--color-surface-muted)]";

export const salesListPanelClass =
  "rounded-t-2xl border border-[var(--color-border)] border-b-0 bg-[var(--color-surface)] px-4 pb-6 pt-4 sm:px-6";

export const salesListToolbarClass =
  "mb-3 flex flex-col gap-3 border-b border-[var(--color-border)] pb-3 lg:flex-row lg:items-center lg:justify-between";

export { SEARCH_BAR_INPUT_CLASS as salesListSearchClass } from "../common/SearchFilter";

export const salesListDateChipClass =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text-secondary)] shadow-sm";

export const salesListToolBtnClass =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]";

export const salesListDropdownClass =
  "absolute right-0 z-20 mt-1.5 w-[280px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg";

export const salesListTableWrapClass =
  "overflow-hidden rounded-xl border border-[var(--color-table-border)] bg-[var(--color-table-bg)]";

export const salesListTableClass = "ui-table w-full min-w-[880px] border-collapse text-left";

export const salesListFilterDrawerClass =
  "flex h-full w-full max-w-[400px] flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl";

export const salesListFilterHeaderClass =
  "flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4";

export const salesListFilterFooterClass =
  "grid grid-cols-2 gap-3 border-t border-[var(--color-border)] px-5 py-4";

export const salesListKpiInactiveClass =
  "border-transparent bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]";

export const salesListKpiActiveClass =
  "border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-primary)]";

export const salesListCellBorderClass = "border-[var(--color-table-border)]";

export const salesListTextPrimary = "text-[var(--color-text)]";
export const salesListTextSecondary = "text-[var(--color-text-secondary)]";
export const salesListTextMuted = "text-[var(--color-text-muted)]";
export const salesListTextFaint = "text-[var(--color-text-faint)]";
