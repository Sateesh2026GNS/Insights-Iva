import { ChevronLeft, ChevronRight } from "lucide-react";

function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

export default function Pagination({
  page = 1,
  pageSize = 10,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 20, 50, 100],
  className = "",
}) {
  const calculatedTotalPages = totalPages || (total != null ? Math.max(1, Math.ceil(total / pageSize)) : 1);
  const from = total != null ? (total === 0 ? 0 : (page - 1) * pageSize + 1) : null;
  const to = total != null ? Math.min(page * pageSize, total) : null;

  return (
    <div className={`ui-pagination justify-between w-full border-t border-[var(--color-border-soft)] pt-3 ${className}`.trim()}>
      <div className="flex items-center gap-2.5 flex-nowrap whitespace-nowrap text-[13px] text-[#596b82]">
        <span>Rows per page:</span>
        {onPageSizeChange ? (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="ui-pagination-select"
            aria-label="Rows per page"
          >
            {pageSizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        ) : (
          <span className="ui-pagination-select !justify-center !px-3">
            {pageSize}
          </span>
        )}
        <span className="font-medium text-[#596b82]">
          {total != null
            ? total === 0
              ? "0–0 of 0"
              : `${from}–${to} of ${total}`
            : `Page ${page} of ${calculatedTotalPages}`}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className="ui-page-btn"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {getPageNumbers(page, calculatedTotalPages).map((item, idx) =>
          typeof item === "string" ? (
            <span key={`dots-${idx}`} className="px-1 text-xs text-[var(--color-text-muted)]">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`ui-page-btn ${item === page ? "ui-page-btn--active" : ""}`}
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          className="ui-page-btn"
          onClick={() => onPageChange(Math.min(calculatedTotalPages, page + 1))}
          disabled={page >= calculatedTotalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
