import { Link } from "react-router-dom";
import { ChevronDown, Eye, ListFilter, Pencil, Settings, Trash2 } from "lucide-react";

import EmptyState from "../common/EmptyState";
import ExportDownloadMenu from "../common/ExportDownloadMenu";
import RowActionMenu from "../common/RowActionMenu";
import { SerialNumberCell, SerialNumberHeader } from "../common/SerialNumberCell";
import InventoryRowActionsMenu from "./InventoryRowActionsMenu";
import {
  InventoryAddButton,
  InventoryPageCard,
  InventoryPagination,
  InventorySearchInput,
  InventoryTabs,
  InventoryToolbarButton,
  inventoryRowClass,
  inventoryTableHeadClass,
  inventoryTdClass,
  inventoryThClass,
} from "./inventoryDesignSystem";
import { normalizeCategoryName } from "../../utils/inventoryCategoryWise";
import { SORT_OPTIONS, STOCK_FILTERS } from "../../utils/inventoryStockItems";

export const CATEGORY_WISE_HEADERS = [
  "HSN Code",
  "Item Name",
  "Category",
  "Stock Value",
  "Purchase Price",
  "Sales Price",
  "Stock In Hand",
  "Action",
];

function DropdownMenu({ open, children, className = "" }) {
  if (!open) return null;
  return (
    <div
      className={`absolute right-0 z-30 mt-1 min-w-[180px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}

function RadioRow({ checked, label, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
    >
      <span
        className={`grid h-4 w-4 place-items-center rounded-full border ${
          checked ? "border-[var(--color-text)]" : "border-[var(--color-border-strong)]"
        }`}
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" /> : null}
      </span>
      {label}
    </button>
  );
}

/**
 * Shared inventory catalog UI: KPI banner, tabs, search, stock-items toolbar/table, category-wise table, pagination.
 */
export default function InventoryStockItems({
  lockedStockFilter,
  stockFilter,
  onStockFilterChange,
  tab,
  onTabChange,
  search,
  onSearchChange,
  sort,
  sortLabel,
  sortOpen,
  onSortOpenChange,
  filterOpen,
  onFilterOpenChange,
  toolbarRef,
  onSortSelect,
  itemTableHeaders,
  emptyReportTitle,
  emptyReportDescription,
  pageRows,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  filteredItemsCount,
  onExport,
  onOpenAddItem,
  categoryFilter,
  onCategoryFilterChange,
  categoryFilterOptions,
  onOpenAddCategory,
  openMenuId,
  onOpenMenuIdChange,
  onItemNameNavigate,
  onViewItem,
  onEditItem,
  onDeleteItem,
  onAddStock,
  onRemoveStock,
  categoryWiseActionItems,
}) {
  return (
    <>
      {lockedStockFilter ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>
            KPI filter active — showing {stockFilter === "low" ? "low stock" : "out of stock"} items only.
          </span>
          <Link to="/inventory" className="font-semibold text-[var(--color-primary)] hover:underline">
            View all items
          </Link>
        </div>
      ) : null}

      <InventoryPageCard>
        <InventoryTabs
          active={tab}
          onChange={onTabChange}
          tabs={[
            { id: "items", label: "Stock Items" },
            { id: "categories", label: "Category Wise" },
          ]}
          action={
            <Link to="/inventory/settings" className="ui-btn ui-btn-outline inline-flex items-center gap-1.5 text-[13px]">
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          }
        />

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <InventorySearchInput
                value={search}
                onChange={onSearchChange}
                placeholder="Search"
                className="w-full min-w-0 max-w-none flex-1"
              />
            </div>

            {tab === "items" ? (
              <div ref={toolbarRef} className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <InventoryToolbarButton
                    onClick={() => {
                      onSortOpenChange(!sortOpen);
                      onFilterOpenChange(false);
                    }}
                  >
                    <ListFilter className="h-4 w-4" />
                    {sortLabel}
                    <ChevronDown
                      className={`h-4 w-4 text-[var(--color-text-muted)] transition-transform ${
                        sortOpen ? "rotate-180" : ""
                      }`}
                    />
                  </InventoryToolbarButton>
                  <DropdownMenu open={sortOpen}>
                    {SORT_OPTIONS.map((opt) => (
                      <RadioRow
                        key={opt.id}
                        checked={sort === opt.id}
                        label={opt.label}
                        onSelect={() => onSortSelect(opt.id)}
                      />
                    ))}
                  </DropdownMenu>
                </div>

                <div className="relative">
                  <InventoryToolbarButton
                    onClick={() => {
                      onFilterOpenChange(!filterOpen);
                      onSortOpenChange(false);
                    }}
                  >
                    <ListFilter className="h-4 w-4" />
                    Filters
                    <ChevronDown
                      className={`h-4 w-4 text-[var(--color-text-muted)] transition-transform ${
                        filterOpen ? "rotate-180" : ""
                      }`}
                    />
                  </InventoryToolbarButton>
                  <DropdownMenu open={filterOpen}>
                    {STOCK_FILTERS.map((opt) => (
                      <RadioRow
                        key={opt.id}
                        checked={stockFilter === opt.id}
                        label={opt.label}
                        onSelect={() => {
                          onStockFilterChange(opt.id);
                          onFilterOpenChange(false);
                        }}
                      />
                    ))}
                  </DropdownMenu>
                </div>

                <InventoryAddButton onClick={onOpenAddItem}>Add Items</InventoryAddButton>
                <ExportDownloadMenu disabled={!filteredItemsCount} onExport={onExport} />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-[13px] text-[var(--color-text-muted)]">
                  <span className="sr-only">Filter by category</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => onCategoryFilterChange(e.target.value)}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)]"
                  >
                    <option value="all">All Categories</option>
                    {categoryFilterOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <InventoryAddButton type="button" onClick={onOpenAddCategory}>Add Category</InventoryAddButton>
              </div>
            )}
          </div>

          <div className="ui-table-wrap ui-table-wrap--scroll overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              {tab === "items" ? (
                <table className="min-w-full border-collapse text-left text-[13px]">
                  <thead className={inventoryTableHeadClass}>
                    <tr>
                      <SerialNumberHeader className={`${inventoryThClass} border-r`} />
                      {itemTableHeaders.map((h) => (
                        <th key={h} className={`${inventoryThClass} last:border-r-0`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={itemTableHeaders.length + 1} className="p-0 border-none">
                          <EmptyState
                            icon="document"
                            title={emptyReportTitle || "No records found."}
                            description={emptyReportDescription || "There is nothing to show here yet."}
                            className="border-none bg-transparent py-12"
                          />
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, rowIndex) => (
                        <tr key={row.id} className={inventoryRowClass}>
                          <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} />
                          <td className={`${inventoryTdClass} text-[var(--color-text-muted)]`}>{row.hsn_code || "—"}</td>
                          <td className={`${inventoryTdClass} font-semibold`}>
                            <button
                              type="button"
                              className="text-left hover:underline"
                              onClick={() => onItemNameNavigate(row)}
                            >
                              {row.name}
                            </button>
                          </td>
                          {stockFilter === "low" ? (
                            <>
                              <td className={`${inventoryTdClass} tabular-nums`}>
                                {Number(row.current_stock || 0).toLocaleString("en-IN")}
                              </td>
                              <td className={`${inventoryTdClass} tabular-nums`}>
                                {Number(row.min_stock || 0).toLocaleString("en-IN")}
                              </td>
                              <td className={`${inventoryTdClass} tabular-nums`}>
                                {Number(row.stock_value || 0).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </>
                          ) : stockFilter === "out" ? (
                            <>
                              <td className={`${inventoryTdClass} tabular-nums`}>
                                {Number(row.current_stock || 0).toLocaleString("en-IN")}
                              </td>
                              <td className={`${inventoryTdClass} tabular-nums`}>
                                {Number(row.stock_value || 0).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className={`${inventoryTdClass} tabular-nums`}>
                                {Number(row.stock_value || 0).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className={`${inventoryTdClass} tabular-nums`}>
                                {Number(row.purchase_price || 0).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className={`${inventoryTdClass} tabular-nums`}>
                                {Number(row.selling_price || 0).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className={`${inventoryTdClass} tabular-nums`}>
                                {Number(row.current_stock || 0).toLocaleString("en-IN")}
                              </td>
                            </>
                          )}
                          <td className={inventoryTdClass}>
                            <div className="flex items-center justify-end whitespace-nowrap">
                              <InventoryRowActionsMenu
                                rowId={row.id}
                                isOpen={openMenuId === row.id}
                                onOpen={onOpenMenuIdChange}
                                onClose={() => onOpenMenuIdChange(null)}
                                showAdd={false}
                                showAddStock
                                showRemoveStock
                                menuWidth={176}
                                onView={() => onViewItem(row)}
                                onEdit={() => onEditItem(row)}
                                onAddStock={() => onAddStock(row)}
                                onRemoveStock={() => onRemoveStock(row)}
                                onDelete={() => onDeleteItem(row)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full border-collapse text-left text-[13px]">
                  <thead className={inventoryTableHeadClass}>
                    <tr>
                      <SerialNumberHeader className={`${inventoryThClass} border-r`} />
                      {CATEGORY_WISE_HEADERS.map((h) => (
                        <th key={h} className={`${inventoryThClass} last:border-r-0`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={CATEGORY_WISE_HEADERS.length + 1} className="p-0 border-none">
                          <EmptyState
                            icon="document"
                            title="No stock items found."
                            description={
                              categoryFilter === "all"
                                ? "Add items or adjust your search."
                                : `No items in ${categoryFilter}.`
                            }
                            className="border-none bg-transparent py-12"
                          />
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, rowIndex) => (
                        <tr key={row.id} className={inventoryRowClass}>
                          <SerialNumberCell rowIndex={rowIndex} page={page} pageSize={pageSize} />
                          <td className={`${inventoryTdClass} text-[var(--color-text-muted)]`}>{row.hsn_code || "—"}</td>
                          <td className={`${inventoryTdClass} font-semibold`}>
                            <button type="button" className="text-left hover:underline" onClick={() => onViewItem(row)}>
                              {row.name}
                            </button>
                          </td>
                          <td className={inventoryTdClass}>{normalizeCategoryName(row.category)}</td>
                          <td className={`${inventoryTdClass} tabular-nums`}>
                            {Number(row.stock_value || 0).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className={`${inventoryTdClass} tabular-nums`}>
                            {Number(row.purchase_price || 0).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className={`${inventoryTdClass} tabular-nums`}>
                            {Number(row.selling_price || 0).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className={`${inventoryTdClass} tabular-nums`}>
                            {Number(row.current_stock || 0).toLocaleString("en-IN")}
                          </td>
                          <td className={inventoryTdClass}>
                            <div
                              className="flex items-center justify-end whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <RowActionMenu
                                rowId={row.id}
                                openMenu={openMenuId}
                                setOpenMenu={onOpenMenuIdChange}
                                items={categoryWiseActionItems(row)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <InventoryPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPage={onPageChange}
            onPageSize={(size) => {
              onPageSizeChange(size);
              onPageChange(1);
            }}
          />
        </div>
      </InventoryPageCard>
    </>
  );
}
