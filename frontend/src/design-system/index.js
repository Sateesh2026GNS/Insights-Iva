/**
 * Insights Iva Design System — single import surface.
 * CSS tokens live in index.css (:root). JS/chart fallbacks in theme/colors.js.
 *
 * Usage:
 *   import { Button, inputClass, FilterBar, StatusBadge } from "../design-system";
 */

export {
  pageClass,
  stackClass,
  cardClass,
  cardPaddedClass,
  inputClass,
  inputMtClass,
  selectClass,
  selectMtClass,
  textareaClass,
  textareaMtClass,
  inputSearchClass,
  inputErrorClass,
  tableWrapClass,
  tableClass,
  filterBarClass,
  filterLabelClass,
  toolbarClass,
  rowActionClass,
  pageTitleClass,
  sectionTitleClass,
  subtitleClass,
  captionClass,
} from "./classes";

export { resolveStatusTone } from "./statusTone";

export {
  ERP_PRIMARY,
  ERP_PRIMARY_SOFT,
  FieldLabel,
  SoftInput,
  SoftSelect,
  Pill,
} from "./erpFormControls";

export { default as themeColors } from "../theme/colors";
export { default as theme } from "../styles/theme";

/* Shared UI components — reuse, do not duplicate */
export { default as Button, PrimaryButton, SecondaryButton, SuccessButton, WarningButton, DangerButton, IconButton } from "../components/common/Button";
export { FormField, Input, Select, Textarea } from "../components/common/FormField";
export { default as Modal } from "../components/common/Modal";
export { default as DataTable } from "../components/common/DataTable";
export { default as Table, StatusBadge as TableStatusBadge } from "../components/common/Table";
export { default as StatusBadge } from "../components/common/StatusBadge";
export { default as Pagination } from "../components/common/Pagination";
export { default as EmptyState } from "../components/common/EmptyState";
export { default as Loader } from "../components/common/Loader";
export { default as PageHeader } from "../components/common/PageHeader";
export { default as Breadcrumbs } from "../components/common/Breadcrumbs";
export { default as RowActionMenu } from "../components/common/RowActionMenu";
export { default as FilterBar } from "../components/common/FilterBar";
export { SearchBar, FilterSelect } from "../components/common/SearchFilter";

/* Domain shells — accounts / inventory list pages */
export {
  AccountsPageShell,
  AccountsCard,
  AccountsTabs,
  AccountsSearchInput,
  AccountsPagination,
  AccountsPrimaryButton,
  AccountsOutlineButton,
  accountsTableWrapClass,
  accountsTableClass,
  accountsRowActionClass,
  ACCOUNTS_INPUT_CLASS,
} from "../components/accounts/accountsDesignSystem";

export {
  InventoryPageShell,
  InventoryPageCard,
  InventoryTabs,
  InventorySearchInput,
  InventoryPagination,
  InventoryPrimaryButton,
  InventoryOutlineButton,
  inventoryTableWrapClass,
  inventoryRowActionClass,
} from "../components/inventory/inventoryDesignSystem";
