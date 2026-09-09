import { useState } from "react";
import { ChevronDown, RefreshCw, SlidersHorizontal, X } from "lucide-react";

import Button from "../common/Button";
import { Input, Select } from "../common/FormField";
import { SearchBar } from "../common/SearchFilter";
import { ERP_LIST_STATUS_FILTER_OPTIONS } from "../../utils/jobCardListStatus";
import { getWorkflowStatusLabel, WORKFLOW_STAGES } from "../../config/workflowStages";
import { STORE_STATUS_FILTER_OPTIONS } from "../../utils/storeJobCardQueue";

const PRIORITY_OPTIONS = [
  { value: "", label: "All priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STOCK_OPTIONS = [
  { value: "", label: "All stock" },
  { value: "pending", label: "Pending check" },
  { value: "available", label: "Available" },
  { value: "shortage", label: "Shortage" },
];

const STAGE_OPTIONS = [
  { value: "", label: "All" },
  ...Array.from(
    new Map(
      WORKFLOW_STAGES.filter((s) => s.responsibleRole).map((s) => [s.responsibleRole, s.responsibleRole])
    ).entries()
  ).map(([value]) => ({ value, label: value })),
];

function FilterLabel({ children, erp = false }) {
  if (erp) {
    return <span className="my-job-cards-filters__label">{children}</span>;
  }
  return (
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
      {children}
    </span>
  );
}

export default function JobCardQueueFilters({
  search = "",
  onSearchChange,
  priority = "",
  onPriorityChange,
  status = "",
  onStatusChange,
  stage = "",
  onStageChange,
  deliveryDate = "",
  onDeliveryDateChange,
  dateFrom = "",
  onDateFromChange,
  dateTo = "",
  onDateToChange,
  stockStatus = "",
  onStockStatusChange,
  customer = "",
  onCustomerChange,
  product = "",
  onProductChange,
  salesOrderNo = "",
  onSalesOrderNoChange,
  customerOptions = [],
  productOptions = [],
  statusOptions = [],
  showStockFilter = false,
  storeMode = false,
  autoApply = false,
  erpLayout = false,
  salesOrderOptions = [],
  onClear,
  onApply,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const hasFilters =
    search ||
    priority ||
    status ||
    stage ||
    deliveryDate ||
    dateFrom ||
    dateTo ||
    stockStatus ||
    customer ||
    product ||
    salesOrderNo;

  const advancedCount = [customer, product, salesOrderNo, deliveryDate, dateFrom, dateTo].filter(Boolean).length;

  const statusSelectOptions = storeMode
    ? STORE_STATUS_FILTER_OPTIONS
    : [{ value: "", label: "All statuses" }, ...statusOptions.map((opt) => ({ value: opt, label: getWorkflowStatusLabel(opt) }))];

  const applyOrPatch = (patchFn, value) => {
    patchFn?.(value);
    if (autoApply) onApply?.();
  };

  if (erpLayout) {
    return (
      <div className="my-job-cards-filters">
        <div className="my-job-cards-filters__grid">
          <div>
            <FilterLabel erp>Job Card No.</FilterLabel>
            <Input
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Enter Job Card No."
              className="w-full"
              aria-label="Filter by job card number"
            />
          </div>
          <div>
            <FilterLabel erp>Customer</FilterLabel>
            <Select
              value={customer}
              onChange={(e) => onCustomerChange?.(e.target.value)}
              className="w-full"
              aria-label="Filter by customer"
            >
              <option value="">Select Customer</option>
              {customerOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FilterLabel erp>Sales Order</FilterLabel>
            <Select
              value={salesOrderNo}
              onChange={(e) => onSalesOrderNoChange?.(e.target.value)}
              className="w-full"
              aria-label="Filter by sales order"
            >
              <option value="">Select Sales Order</option>
              {salesOrderOptions.map((no) => (
                <option key={no} value={no}>
                  {no}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FilterLabel erp>Product</FilterLabel>
            <Select
              value={product}
              onChange={(e) => onProductChange?.(e.target.value)}
              className="w-full"
              aria-label="Filter by product"
            >
              <option value="">Select Product</option>
              {productOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FilterLabel erp>Status</FilterLabel>
            <Select
              value={status}
              onChange={(e) => onStatusChange?.(e.target.value)}
              className="w-full"
              aria-label="Filter by status"
            >
              {ERP_LIST_STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FilterLabel erp>From Date</FilterLabel>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange?.(e.target.value)}
              className="w-full"
              aria-label="Filter from date"
            />
          </div>
          <div>
            <FilterLabel erp>To Date</FilterLabel>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange?.(e.target.value)}
              className="w-full"
              aria-label="Filter to date"
            />
          </div>
          <div className="my-job-cards-filters__actions">
            <Button
              type="button"
              variant="primary"
              onClick={() => onApply?.()}
            >
              Apply
            </Button>
            <Button
              type="button"
              variant="outline"
              className="my-job-cards-filters__reset-btn"
              onClick={onClear}
              leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
            >
              Reset
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (storeMode) {
    return (
      <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/20 px-4 py-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <FilterLabel>Search</FilterLabel>
              <SearchBar
                value={search}
                onChange={(v) => onSearchChange?.(v)}
                placeholder="Search"
                className="w-full"
                aria-label="Search job cards"
                size="compact"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
              <div className="min-w-[140px] flex-1 sm:flex-none">
                <FilterLabel>Status</FilterLabel>
                <Select
                  value={status}
                  onChange={(e) => applyOrPatch(onStatusChange, e.target.value)}
                  className="w-full"
                  aria-label="Filter by status"
                >
                  {statusSelectOptions.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="min-w-[130px] flex-1 sm:flex-none">
                <FilterLabel>Priority</FilterLabel>
                <Select
                  value={priority}
                  onChange={(e) => applyOrPatch(onPriorityChange, e.target.value)}
                  className="w-full"
                  aria-label="Filter by priority"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:pb-0.5">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  aria-expanded={advancedOpen}
                  leftIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
                  rightIcon={
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  }
                >
                  More filters
                  {advancedCount > 0 ? (
                    <span className="ml-1.5 rounded-full bg-[var(--color-primary)] px-1.5 py-px text-[10px] font-bold text-white">
                      {advancedCount}
                    </span>
                  ) : null}
                </Button>
                {hasFilters ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onClear}
                    leftIcon={<X className="h-3.5 w-3.5" />}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {advancedOpen ? (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <FilterLabel>Customer</FilterLabel>
                <Select
                  value={customer}
                  onChange={(e) => applyOrPatch(onCustomerChange, e.target.value)}
                  className="w-full"
                  aria-label="Filter by customer"
                >
                  <option value="">All customers</option>
                  {customerOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <FilterLabel>Product</FilterLabel>
                <Select
                  value={product}
                  onChange={(e) => applyOrPatch(onProductChange, e.target.value)}
                  className="w-full"
                  aria-label="Filter by product"
                >
                  <option value="">All products</option>
                  {productOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <FilterLabel>Sales Order No.</FilterLabel>
                <Input
                  value={salesOrderNo}
                  onChange={(e) => onSalesOrderNoChange?.(e.target.value)}
                  onBlur={() => autoApply && onApply?.()}
                  placeholder="e.g. SO-2024-001"
                  className="w-full"
                  aria-label="Filter by sales order number"
                />
              </div>
              <div>
                <FilterLabel>Required Delivery Date</FilterLabel>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => applyOrPatch(onDeliveryDateChange, e.target.value)}
                  className="w-full"
                  aria-label="Filter by delivery date"
                />
              </div>
              <div className="sm:col-span-2">
                <FilterLabel>Order Date Range</FilterLabel>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => applyOrPatch(onDateFromChange, e.target.value)}
                    className="w-full"
                    aria-label="Order date from"
                  />
                  <span className="shrink-0 text-xs text-[var(--color-text-muted)]">to</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => applyOrPatch(onDateToChange, e.target.value)}
                    className="w-full"
                    aria-label="Order date to"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/20 px-4 py-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <FilterLabel>Search</FilterLabel>
            <SearchBar
              value={search}
              onChange={(v) => onSearchChange?.(v)}
              placeholder="Search job cards, customers, products…"
              className="w-full"
              aria-label="Search job cards"
              size="compact"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
            <div className="min-w-[140px] flex-1 sm:flex-none">
              <FilterLabel>Status</FilterLabel>
              <Select
                value={status}
                onChange={(e) => applyOrPatch(onStatusChange, e.target.value)}
                className="w-full"
                aria-label="Filter by status"
              >
                {statusSelectOptions.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[130px] flex-1 sm:flex-none">
              <FilterLabel>Stage</FilterLabel>
              <Select
                value={stage}
                onChange={(e) => applyOrPatch(onStageChange, e.target.value)}
                className="w-full"
                aria-label="Filter by current stage"
              >
                {STAGE_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-[120px] flex-1 sm:flex-none">
              <FilterLabel>Priority</FilterLabel>
              <Select
                value={priority}
                onChange={(e) => applyOrPatch(onPriorityChange, e.target.value)}
                className="w-full"
                aria-label="Filter by priority"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            {showStockFilter ? (
              <div className="min-w-[130px] flex-1 sm:flex-none">
                <FilterLabel>Stock</FilterLabel>
                <Select
                  value={stockStatus}
                  onChange={(e) => applyOrPatch(onStockStatusChange, e.target.value)}
                  className="w-full"
                  aria-label="Filter by stock status"
                >
                  {STOCK_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:pb-0.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAdvancedOpen((v) => !v)}
                aria-expanded={advancedOpen}
                leftIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
                rightIcon={
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                }
              >
                More filters
                {advancedCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-[var(--color-primary)] px-1.5 py-px text-[10px] font-bold text-white">
                    {advancedCount}
                  </span>
                ) : null}
              </Button>
              {hasFilters ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClear}
                  leftIcon={<X className="h-3.5 w-3.5" />}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {advancedOpen ? (
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <FilterLabel>Customer</FilterLabel>
              <Select
                value={customer}
                onChange={(e) => applyOrPatch(onCustomerChange, e.target.value)}
                className="w-full"
                aria-label="Filter by customer"
              >
                <option value="">All customers</option>
                {customerOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FilterLabel>Product</FilterLabel>
              <Select
                value={product}
                onChange={(e) => applyOrPatch(onProductChange, e.target.value)}
                className="w-full"
                aria-label="Filter by product"
              >
                <option value="">All products</option>
                {productOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FilterLabel>Sales Order No.</FilterLabel>
              <Input
                value={salesOrderNo}
                onChange={(e) => onSalesOrderNoChange?.(e.target.value)}
                onBlur={() => autoApply && onApply?.()}
                placeholder="e.g. SO-2024-001"
                className="w-full"
                aria-label="Filter by sales order number"
              />
            </div>
            <div>
              <FilterLabel>Required Delivery Date</FilterLabel>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => applyOrPatch(onDeliveryDateChange, e.target.value)}
                className="w-full"
                aria-label="Filter by delivery date"
              />
            </div>
            <div className="sm:col-span-2">
              <FilterLabel>Order Date Range</FilterLabel>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => applyOrPatch(onDateFromChange, e.target.value)}
                  className="w-full"
                  aria-label="Order date from"
                />
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">to</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => applyOrPatch(onDateToChange, e.target.value)}
                  className="w-full"
                  aria-label="Order date to"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
