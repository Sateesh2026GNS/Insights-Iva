export default function SkeletonTable({ rows = 5, cols = 6 }) {
  return (
    <div className="ui-table-wrap animate-pulse" aria-hidden>
      <table className="ui-table w-full">
        <thead className="ui-table-head">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="h-3 w-20 rounded bg-[var(--color-surface-hover)]" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-t border-[var(--color-border-muted)]">
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-4 py-3.5">
                  <div
                    className="h-3 rounded bg-[var(--color-border-muted)]"
                    style={{ width: c === 0 ? 80 : c === cols - 1 ? 60 : 100 }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
