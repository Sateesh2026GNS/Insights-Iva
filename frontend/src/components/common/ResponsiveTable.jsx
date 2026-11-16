import { useState } from "react";
import { useTranslation } from "react-i18next";
import Table, { StatusBadge } from "./Table";

function renderCell(column, row, index) {
  if (column.render) return column.render(row, column, index);
  const value = row?.[column.key];
  if (column.statusBadge) return <StatusBadge status={value} />;
  if (value && typeof value === "object") {
    return value.label || value.name || value.title || value.id || "—";
  }
  return value ?? "—";
}

export default function ResponsiveTable({
  columns = [],
  data = [],
  mobileCard,
  rowKey = "id",
  ...tableProps
}) {
  const { t } = useTranslation();
  const [showLowPriorityColumns, setShowLowPriorityColumns] = useState(false);
  const mobileColumns = columns.filter((column) => column.mobile !== false && column.key !== "actions");

  return (
    <div
      className={`responsive-table ${showLowPriorityColumns ? "responsive-table--show-low-priority" : ""}`}
      data-show-low-priority={showLowPriorityColumns}
    >
      {columns.some((column) => column.priority === 3) ? (
        <button
          type="button"
          className="responsive-table__column-toggle"
          onClick={() => setShowLowPriorityColumns((shown) => !shown)}
          aria-pressed={showLowPriorityColumns}
        >
          {t(showLowPriorityColumns ? "responsiveTable.hideLowPriority" : "responsiveTable.showLowPriority")}
        </button>
      ) : null}
      <div className="responsive-table__desktop">
        <Table
          {...tableProps}
          columns={columns}
          data={data}
          wrapClassName={`responsive-table__table ${tableProps.wrapClassName || ""}`}
        />
      </div>
      <div className="responsive-table__cards">
        {data.length ? (
          data.map((row, index) => {
            if (mobileCard) {
              return <div key={row?.[rowKey] ?? index}>{mobileCard(row, index)}</div>;
            }

            const titleColumn = mobileColumns.find((column) => column.priority === 1) || mobileColumns[0];
            const details = mobileColumns
              .filter((column) => column !== titleColumn && column.priority !== 3)
              .slice(0, 3);
            const actionsColumn = columns.find((column) => column.key === "actions");

            return (
              <article className="responsive-table__card" key={row?.[rowKey] ?? index}>
                {titleColumn ? (
                  <h3 className="responsive-table__card-title">
                    {renderCell(titleColumn, row, index)}
                  </h3>
                ) : null}
                <dl className="responsive-table__card-fields">
                  {details.map((column) => (
                    <div className="responsive-table__card-field" key={column.key}>
                      <dt>{column.label}</dt>
                      <dd>{renderCell(column, row, index)}</dd>
                    </div>
                  ))}
                </dl>
                {actionsColumn ? (
                  <div className="responsive-table__card-actions">
                    {renderCell(actionsColumn, row, index)}
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="responsive-table__empty">
            {tableProps.emptyState || t("common.noData", { defaultValue: "No data available" })}
          </div>
        )}
      </div>
    </div>
  );
}
