/**
 * Insights Iva — shared CSS class tokens.
 * Prefer these over page-local Tailwind one-offs.
 */

/** Layout */
export const pageClass = "ui-page";
export const stackClass = "ui-stack";
export const cardClass = "ui-card";
export const cardPaddedClass = "ui-card p-4 sm:p-5";

/** Form controls */
export const inputClass = "ui-input w-full";
export const inputMtClass = "ui-input mt-1.5 w-full";
export const selectClass = "ui-select w-full";
export const selectMtClass = "ui-select mt-1.5 w-full";
export const textareaClass = "ui-textarea w-full";
export const textareaMtClass = "ui-textarea mt-1.5 w-full";
export const inputSearchClass = "ui-input w-full !rounded-full !pl-10";
export const inputErrorClass = "ui-input is-error w-full";

/** Tables — BI/ERP slate palette (see index.css .ui-table-wrap) */
export const tableWrapClass = "ui-table-wrap ui-table-wrap--scroll";
export const tableClass = "ui-table w-full border-collapse text-left";
export const tableHeadClass = "ui-table-head";
export const tableTextSecondaryClass = "ui-table-text-secondary";
export const tableTextAccentClass = "ui-table-text-accent";
export const valuePositiveClass = "ui-value-positive ui-num";
export const valueNegativeClass = "ui-value-negative ui-num";
export const valueNeutralClass = "ui-value-neutral ui-num";

/** Toolbar / filters */
export const filterBarClass = "ui-card p-4";
export const filterLabelClass = "ui-label mb-1";
export const toolbarClass = "ui-toolbar";

/** Row actions in tables */
export const rowActionClass =
  "inline-grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]";

/** Typography shortcuts */
export const pageTitleClass = "ui-page-title";
export const sectionTitleClass = "ui-section-title";
export const subtitleClass = "ui-subtitle";
export const captionClass = "ui-hint";
