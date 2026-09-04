import { useState } from "react";
import { columnsIncludeSerial } from "../../utils/serialNumber";

const NUMERIC_KEY_RE =
  /amount|price|qty|quantity|total|balance|credit|debit|cost|rate|revenue|value|units|stock|weight/i;

function columnAlign(col) {
  if (col.align === "right" || col.numeric) return "right";
  if (col.align === "center") return "center";
  if (NUMERIC_KEY_RE.test(col.key || "") || NUMERIC_KEY_RE.test(col.label || "")) return "right";
  return "left";
}

function StatusBadge({ status }) {
  const val =
    typeof status === "object" && status !== null
      ? status.label || status.id || status.name || "—"
      : status || "—";

  const key = String(val).toLowerCase().replace(/\s+/g, "_");
  const toneMap = {
    completed: "success",
    running: "success",
    delivered: "success",
    approved: "success",
    active: "success",
    paid: "success",
    resolved: "success",
    in_progress: "info",
    processing: "info",
    open: "info",
    planned: "neutral",
    pending: "neutral",
    draft: "neutral",
    idle: "neutral",
    cancelled: "neutral",
    canceled: "neutral",
    inactive: "neutral",
    maintenance: "warning",
    overdue: "warning",
    warning: "warning",
    down: "danger",
    stopped: "danger",
    failed: "danger",
    rejected: "danger",
    critical: "danger",
    error: "danger",
  };
  const tone = toneMap[key] || "neutral";

  return <span className={`ui-badge ui-badge--${tone}`}>{val}</span>;
}

export default function Table({
  columns,
  data,
  emptyState,
  sortable,
  compact = false,
  showSerialNumber = true,
  serialOffset = 0,
  wrapClassName = "",
  className = "",
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  const handleSort = (key) => {
    if (!sortable || !key) return;
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const rows = data || [];
  const includeSerial = showSerialNumber && !columnsIncludeSerial(columns);

  let sortedData = [...rows];
  if (sortKey && sortable) {
    sortedData.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (typeof valA === "object" && valA !== null) {
        valA = valA.label || valA.name || valA.id || "";
      }
      if (typeof valB === "object" && valB !== null) {
        valB = valB.label || valB.name || valB.id || "";
      }

      if (valA == null) return 1;
      if (valB == null) return -1;

      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortOrder === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }

  const headerPadding = compact ? "px-2.5 py-2 text-[11px]" : "px-4 py-3 text-[var(--text-xs)]";
  const cellPadding = compact ? "px-2.5 py-2 text-xs" : "px-4 py-3.5 text-[var(--text-sm)]";

  return (
    <div className={`ui-table-wrap ui-table-wrap--scroll overflow-x-auto print:overflow-visible print:rounded-none print:border-none print:shadow-none ${wrapClassName}`}>
      <table className={`ui-table w-full border-collapse text-left ${className}`}>
        <thead className="ui-table-head">
          <tr>
            {includeSerial ? (
              <th className="w-12 min-w-[3rem] px-2 py-3 text-center font-medium">S.No.</th>
            ) : null}
            {columns.map((col) => {
              const isActionsCol = col.key === "actions" || col.printHidden;
              const alignDir = columnAlign(col);
              const align =
                alignDir === "right" ? "text-right" : alignDir === "center" ? "text-center" : "text-left";
              const colClass = col.className || "";
              return (
                <th
                  key={col.key}
                  className={`${headerPadding} font-semibold ${align} ${colClass} ${
                    isActionsCol ? "print:hidden" : ""
                  } ${
                    sortable && col.sortable !== false ? "ui-table-th--sortable" : ""
                  }`}
                  style={col.width ? { width: col.width, minWidth: col.minWidth } : col.minWidth ? { minWidth: col.minWidth } : undefined}
                  onClick={() => col.sortable !== false && sortable && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">{col.label}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, idx) => (
            <tr key={row.id ?? idx}>
              {includeSerial ? (
                <td className="ui-num ui-table-text-secondary w-12 min-w-[3rem] px-2 py-3 text-center">
                  {(Number(serialOffset) || 0) + idx + 1}
                </td>
              ) : null}
              {columns.map((col) => {
                const isActionsCol = col.key === "actions" || col.printHidden;
                const alignDir = columnAlign(col);
                const align =
                  alignDir === "right"
                    ? "ui-num text-right"
                    : alignDir === "center"
                      ? "text-center"
                      : "";
                const colClass = col.className || col.cellClassName || "";
                return (
                  <td
                    key={col.key}
                    className={`${cellPadding} ${align} ${colClass} ${
                      isActionsCol ? "print:hidden" : ""
                    }`}
                    style={col.width ? { width: col.width, minWidth: col.minWidth } : col.minWidth ? { minWidth: col.minWidth } : undefined}
                  >
                    {col.render
                      ? col.render(row, col, idx, Number(serialOffset) || 0)
                      : col.statusBadge
                        ? <StatusBadge status={row[col.key]} />
                        : typeof row[col.key] === "object" && row[col.key] !== null
                          ? row[col.key].label ||
                            row[col.key].name ||
                            row[col.key].title ||
                            row[col.key].id ||
                            JSON.stringify(row[col.key])
                          : (row[col.key] ?? "—")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {sortedData.length === 0 && (
        <div className="ui-empty">{emptyState || <p>No data available</p>}</div>
      )}
    </div>
  );
}

export { StatusBadge };
