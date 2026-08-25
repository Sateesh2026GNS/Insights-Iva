/** Material lines table for inventory check and store issue stages. */
export default function MaterialTable({ columns, rows, editable = false, onChange }) {
  if (!rows?.length) {
    return (
      <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">No materials listed.</p>
    );
  }

  return (
    <div className="ui-table-wrap ui-table-wrap--scroll">
      <table className="ui-table w-full min-w-[640px] text-sm">
        <thead className="ui-table-head">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => {
                const val = row[col.key];
                if (editable && col.editable) {
                  return (
                    <td key={col.key} className="px-3 py-2">
                      <input
                        type={col.type || "text"}
                        className="ui-input w-full min-w-[5rem] py-1 text-sm"
                        value={val ?? ""}
                        onChange={(e) =>
                          onChange?.(row.id, col.key, col.type === "number" ? Number(e.target.value) : e.target.value)
                        }
                      />
                    </td>
                  );
                }
                if (col.key === "availability_status" || col.key === "issue_status") {
                  const tone =
                    val === "Available" || val === "issued"
                      ? "text-[var(--color-success)]"
                      : val === "Partial" || val === "partial" || val === "Shortage"
                        ? "text-[var(--color-warning)]"
                        : val === "Not Available" || val === "pending"
                          ? "text-[var(--color-danger)]"
                          : "";
                  return (
                    <td key={col.key} className={`px-3 py-2 font-medium ${tone}`}>
                      {val ?? "—"}
                    </td>
                  );
                }
                return (
                  <td key={col.key} className="ui-num px-3 py-2 tabular-nums">
                    {val ?? "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
