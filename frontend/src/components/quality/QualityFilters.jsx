import FilterBar from "../common/FilterBar";

const RESULTS = ["All Results", "Pass", "Fail", "Pending", "Rework"];

export default function QualityFilters({
  search,
  onSearchChange,
  resultFilter,
  onResultFilterChange,
  searchPlaceholder = "Search...",
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
          key: "result",
          label: "Result Filter",
          value: resultFilter ?? "",
          onChange: onResultFilterChange,
          options: RESULTS.map((r) => ({
            label: r,
            value: r === "All Results" ? "" : r.toLowerCase(),
          })),
        },
      ]}
    >
      {children}
    </FilterBar>
  );
}
