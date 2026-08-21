import FilterBar from "../common/FilterBar";
import { BRANCHES, FINANCIAL_YEARS } from "../../data/financeMasterData";

const MONTHS = [
  "All Months", "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
];

export default function FinanceFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  statusOptions = ["All", "Pending", "Due", "Overdue", "Paid"],
  vendorFilter,
  onVendorFilterChange,
  vendors = [],
  financialYear,
  onFinancialYearChange,
  month,
  onMonthChange,
  branch,
  onBranchChange,
  searchPlaceholder = "Search",
  children,
}) {
  const filters = [
    {
      key: "status",
      label: "Status",
      value: status ?? "",
      onChange: onStatusChange,
      options: statusOptions.map((s) => ({ label: s, value: s === "All" ? "" : s.toLowerCase() })),
    },
  ];

  if (onVendorFilterChange) {
    filters.push({
      key: "vendor",
      label: "Vendor",
      value: vendorFilter ?? "",
      onChange: onVendorFilterChange,
      options: [{ label: "All Vendors", value: "" }, ...vendors.map((v) => ({ label: v, value: v }))],
    });
  }

  if (onFinancialYearChange) {
    filters.push({
      key: "fy",
      label: "Financial Year",
      value: financialYear ?? "",
      onChange: onFinancialYearChange,
      options: FINANCIAL_YEARS.map((y) => ({ label: y, value: y })),
    });
  }

  if (onMonthChange) {
    filters.push({
      key: "month",
      label: "Month",
      value: month ?? "",
      onChange: onMonthChange,
      options: MONTHS.map((m) => ({ label: m, value: m === "All Months" ? "" : m })),
    });
  }

  if (onBranchChange) {
    filters.push({
      key: "branch",
      label: "Branch",
      value: branch ?? "",
      onChange: onBranchChange,
      options: [{ label: "All Branches", value: "" }, ...BRANCHES.map((b) => ({ label: b, value: b }))],
    });
  }

  return (
    <FilterBar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      filters={filters}
      layout="wrap"
    >
      {children}
    </FilterBar>
  );
}
