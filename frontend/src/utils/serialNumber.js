/**
 * Display serial number for tabular rows (UI-only, not persisted).
 * serialOffset = (currentPage - 1) * rowsPerPage
 */
export function getSerialNumber(rowIndex, { page = 1, pageSize = 10, serialOffset, offset, index } = {}) {
  const row =
    typeof rowIndex === "number" && Number.isFinite(rowIndex)
      ? rowIndex
      : typeof index === "number" && Number.isFinite(index)
        ? index
        : 0;

  const base =
    typeof serialOffset === "number" && Number.isFinite(serialOffset)
      ? serialOffset
      : typeof offset === "number" && Number.isFinite(offset)
        ? offset
        : (Math.max(1, Number(page) || 1) - 1) * (Number(pageSize) || 10);

  return base + row + 1;
}

export function columnsIncludeSerial(columns = []) {
  return columns.some(
    (col) =>
      col?.key === "_sno" ||
      col?.key === "sno" ||
      col?.label === "S.No." ||
      col?.label === "S.No" ||
      col?.label === "#"
  );
}

export const SERIAL_COLUMN_KEY = "_sno";

export const SERIAL_COLUMN = {
  key: SERIAL_COLUMN_KEY,
  label: "S.No.",
  sortable: false,
  align: "center",
  width: "3rem",
  minWidth: "3rem",
  className: "w-12 min-w-[3rem] whitespace-nowrap text-center",
  cellClassName: "text-[var(--color-text-muted)] text-center",
  render: (_row, _col, rowIndex, serialOffset = 0) => {
    const rIdx = typeof rowIndex === "number" && Number.isFinite(rowIndex) ? rowIndex : 0;
    const offset = typeof serialOffset === "number" && Number.isFinite(serialOffset) ? serialOffset : 0;
    return offset + rIdx + 1;
  },
};
