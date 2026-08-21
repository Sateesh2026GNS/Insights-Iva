import FilterBar from "../common/FilterBar";

const STATUSES = ["All Statuses", "Scheduled", "Completed", "In Progress", "Overdue", "Reported", "Resolved"];

export default function MaintenanceFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  searchPlaceholder = "Search",
  children,
}) {
  return (
    <FilterBar
      layout="grid"
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      filters={[
        {
          key: "status",
          label: "Status Filter",
          value: statusFilter ?? "",
          onChange: onStatusFilterChange,
          options: STATUSES.map((s) => ({
            label: s,
            value: s === "All Statuses" ? "" : s.toLowerCase().replace(" ", "_"),
          })),
        },
      ]}
    >
      {children}
    </FilterBar>
  );
}
