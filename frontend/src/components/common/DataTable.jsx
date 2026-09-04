import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Table from "./Table";
import Pagination from "./Pagination";
import { SearchBar, FilterSelect } from "./SearchFilter";
import EmptyState from "./EmptyState";
import NoResultsState from "./states/NoResultsState";
import { asArray } from "../../utils/apiError";

export default function DataTable({
  columns,
  data,
  searchPlaceholder = "Search",
  searchKeys = [],
  filters = [],
  pageSize = 10,
  showSearch = true,
  showPagination = true,
  pagination,
  showSerialNumber = true,
  emptyState,
  noResultsState,
  sortable = true,
  wrapClassName = "",
  tableClassName = "",
  toolbarActions = null,
  toolbarClassName = "",
}) {
  const { t } = useTranslation();
  const effectiveShowPagination = pagination !== undefined ? Boolean(pagination) : showPagination;
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState({});
  const [page, setPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const rows = useMemo(() => asArray(data), [data]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    Object.values(filterValues).some((v) => v != null && v !== "");

  const clearFilters = () => {
    setSearch("");
    setFilterValues({});
    setPage(1);
  };

  const filtered = useMemo(() => {
    let result = rows;
    if (search.trim() && searchKeys.length > 0) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        searchKeys.some((k) => {
          const v = row[k];
          return v != null && String(v).toLowerCase().includes(q);
        })
      );
    }
    filters.forEach((f) => {
      const v = filterValues[f.key];
      if (v != null && v !== "") {
        result = result.filter((row) => String(row[f.key]) === String(v));
      }
    });
    return result;
  }, [rows, search, searchKeys, filters, filterValues]);

  const paginated = useMemo(() => {
    if (!effectiveShowPagination) return filtered;
    const start = (page - 1) * currentPageSize;
    return filtered.slice(start, start + currentPageSize);
  }, [filtered, page, currentPageSize, effectiveShowPagination]);

  const totalPages = Math.ceil(filtered.length / currentPageSize) || 1;

  const resetPage = () => setPage(1);

  const defaultEmpty = emptyState || (
    <EmptyState
      title={t("common.noRecords", { defaultValue: "No records yet" })}
      description={t("common.noRecordsHint", {
        defaultValue: "There is nothing to show here yet.",
      })}
    />
  );

  const defaultNoResults = noResultsState || (
    <NoResultsState query={search.trim()} onClear={clearFilters} />
  );

  let body;
  if (!rows.length) {
    body = defaultEmpty;
  } else if (!filtered.length && hasActiveFilters) {
    body = defaultNoResults;
  } else {
    body = (
      <Table
        columns={columns}
        data={paginated}
        emptyState={defaultEmpty}
        sortable={sortable}
        showSerialNumber={showSerialNumber}
        serialOffset={effectiveShowPagination ? (page - 1) * currentPageSize : 0}
        wrapClassName={wrapClassName}
        className={tableClassName}
      />
    );
  }

  return (
    <div className="space-y-4">
      {(showSearch && (searchKeys.length > 0 || filters.length > 0)) || toolbarActions ? (
        <div className={`ui-list-toolbar print:hidden ${toolbarClassName}`.trim()}>
          <div className="ui-list-toolbar__start">
            {showSearch && searchKeys.length > 0 ? (
              <SearchBar
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  resetPage();
                }}
                placeholder={searchPlaceholder}
                className="w-full max-w-md"
              />
            ) : null}
            {filters.map((f) => (
              <FilterSelect
                key={f.key}
                label={f.label}
                value={filterValues[f.key]}
                options={f.options}
                onChange={(v) => {
                  setFilterValues((prev) => ({ ...prev, [f.key]: v }));
                  resetPage();
                }}
                placeholder={f.placeholder}
              />
            ))}
            {hasActiveFilters ? (
              <button type="button" onClick={clearFilters} className="ui-link-clear">
                {t("common.clearFilters", { defaultValue: "Clear filters" })}
              </button>
            ) : null}
            <span className="ui-caption">
              {filtered.length} {t("common.results", { defaultValue: "results" })}
            </span>
          </div>
          {toolbarActions ? <div className="ui-list-toolbar__end">{toolbarActions}</div> : null}
        </div>
      ) : null}
      {body}
      {effectiveShowPagination && filtered.length > 0 ? (
        <Pagination
          className="print:hidden"
          page={page}
          pageSize={currentPageSize}
          total={filtered.length}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setCurrentPageSize(size);
            setPage(1);
          }}
        />
      ) : null}
    </div>
  );
}
