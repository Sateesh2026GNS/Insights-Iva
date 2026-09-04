import { getSerialNumber } from "../../utils/serialNumber";

/** Compact S.No. header for raw HTML tables */
export function SerialNumberHeader({ className = "", label = "S.No." }) {
  return (
    <th
      className={`w-12 min-w-[3rem] px-2 py-3 text-center text-[var(--text-xs)] font-medium text-[var(--color-text-muted)] ${className}`}
    >
      {label}
    </th>
  );
}

/** Compact S.No. cell for raw HTML tables */
export function SerialNumberCell({
  rowIndex,
  index,
  page = 1,
  pageSize = 10,
  serialOffset,
  offset,
  className = "",
}) {
  const finalRowIndex = rowIndex !== undefined ? rowIndex : index;
  const finalOffset = serialOffset !== undefined ? serialOffset : offset;
  return (
    <td
      className={`ui-num w-12 min-w-[3rem] px-2 py-3 text-center text-[var(--text-sm)] text-[var(--color-text-muted)] ${className}`}
    >
      {getSerialNumber(finalRowIndex, { page, pageSize, serialOffset: finalOffset })}
    </td>
  );
}
