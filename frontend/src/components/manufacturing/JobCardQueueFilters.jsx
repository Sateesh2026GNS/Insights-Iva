import { X } from "lucide-react";

import { Input, Select } from "../common/FormField";
import { SearchBar } from "../common/SearchFilter";
import { getWorkflowStatusLabel } from "../../config/workflowStages";

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

export default function JobCardQueueFilters({
  search = "",
  onSearchChange,
  priority = "",
  onPriorityChange,
  status = "",
  onStatusChange,
  deliveryDate = "",
  onDeliveryDateChange,
  stockStatus = "",
  onStockStatusChange,
  statusOptions = [],
  showStockFilter = false,
  onClear,
}) {
  const hasFilters = search || priority || status || deliveryDate || stockStatus;

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-border-soft)] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-end">
      <SearchBar
        value={search}
        onChange={(v) => onSearchChange?.(v)}
        placeholder="Search Job Card / Sales Order / Customer"
        className="min-w-[200px] sm:max-w-xs"
        aria-label="Search job cards"
        clearable={false}
      />

      <Select
        value={priority}
        onChange={(e) => onPriorityChange?.(e.target.value)}
        className="w-full sm:w-auto sm:min-w-[130px]"
        aria-label="Filter by priority"
      >
        {PRIORITY_OPTIONS.map((opt) => (
          <option key={opt.value || "all"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>

      {statusOptions.length > 0 ? (
        <Select
          value={status}
          onChange={(e) => onStatusChange?.(e.target.value)}
          className="w-full sm:w-auto sm:min-w-[160px]"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {statusOptions.map((opt) => (
            <option key={opt} value={opt}>
              {getWorkflowStatusLabel(opt)}
            </option>
          ))}
        </Select>
      ) : null}

      <Input
        type="date"
        value={deliveryDate}
        onChange={(e) => onDeliveryDateChange?.(e.target.value)}
        className="w-full sm:w-auto"
        aria-label="Filter by delivery date"
      />

      {showStockFilter ? (
        <Select
          value={stockStatus}
          onChange={(e) => onStockStatusChange?.(e.target.value)}
          className="w-full sm:w-auto sm:min-w-[140px]"
          aria-label="Filter by stock status"
        >
          {STOCK_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      ) : null}

      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      ) : null}
    </div>
  );
}
