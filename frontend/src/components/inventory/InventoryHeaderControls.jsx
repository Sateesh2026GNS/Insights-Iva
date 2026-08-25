import { useCallback, useId, useRef, useState } from "react";
import { CalendarDays, Share2 } from "lucide-react";

import { openNativeDatePicker, todayIso } from "../../utils/dateUtils";
import InventoryDateExportModal from "./InventoryDateExportModal";

/** Compact optional caption — keeps header uncluttered. */
function FieldCaption({ htmlFor, children }) {
  if (!children) return null;
  return (
    <label htmlFor={htmlFor} className="inventory-header-control__label">
      {children}
    </label>
  );
}

/**
 * Clickable date control — entire surface opens native date picker.
 * Automatically opens the Date Export / Share Popup for historical dates.
 */
export function HeaderDateField({
  label = "Date",
  showLabel = true,
  value = "",
  onChange,
  min,
  max,
  className = "",
  id: idProp,
  enableExportModal = true,
  warehouseId = "",
  warehouses = [],
  sectionTitle = "Inventory",
  itemType = "",
}) {
  const autoId = useId();
  const id = idProp || autoId;
  const inputRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openPicker = useCallback(() => {
    openNativeDatePicker(inputRef.current);
  }, []);

  const today = todayIso();
  const maxDate = max || today;

  const handleDateChange = (newDate) => {
    onChange?.(newDate);
    // Only open the pop-up for dates up to today (past / current date), never for future dates
    if (enableExportModal && newDate && newDate <= today) {
      setModalOpen(true);
    }
  };

  return (
    <>
      <div className={`inventory-header-control ${className}`.trim()}>
        {showLabel ? <FieldCaption htmlFor={id}>{label}</FieldCaption> : null}
        <div className="inventory-header-control__surface">
          <input
            ref={inputRef}
            id={id}
            type="date"
            value={value || ""}
            min={min}
            max={maxDate}
            onChange={(e) => handleDateChange(e.target.value)}
            onClick={openPicker}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPicker();
              }
            }}
            className="ui-input ui-date-input inventory-header-control__input !w-auto min-w-[10.5rem]"
            aria-label={label || "Date"}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openPicker();
            }}
            className="inventory-header-control__icon-btn !border-0 !outline-none !shadow-none !ring-0 bg-transparent"
            aria-label={`Open calendar for ${label || "date"}`}
          >
            <CalendarDays className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      {enableExportModal && (
        <InventoryDateExportModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          initialDate={value || todayIso()}
          warehouseId={warehouseId}
          warehouses={warehouses}
          sectionTitle={sectionTitle}
          itemType={itemType}
        />
      )}
    </>
  );
}

/**
 * Styled warehouse dropdown — entire field reads as an interactive select.
 */
export function HeaderWarehouseField({
  label = "Warehouse",
  showLabel = true,
  value = "",
  onChange,
  warehouses = [],
  warehouseOptions = null,
  emptyLabel = "Main Warehouse",
  ariaLabel,
  className = "",
  id: idProp,
}) {
  const autoId = useId();
  const id = idProp || autoId;
  const selectRef = useRef(null);

  const options =
    warehouseOptions ||
    (warehouses.length
      ? warehouses.map((w) => ({ value: w.id, label: w.name }))
      : [{ value: "", label: emptyLabel }]);

  return (
    <div className={`inventory-header-control ${className}`.trim()}>
      {showLabel ? <FieldCaption htmlFor={id}>{label}</FieldCaption> : null}
      <div
        className="inventory-header-control__surface inventory-header-control__surface--select"
        onClick={() => selectRef.current?.focus()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            selectRef.current?.focus();
          }
        }}
        role="presentation"
      >
        <select
          ref={selectRef}
          id={id}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="ui-select inventory-header-control__select !w-auto min-w-[11rem] cursor-pointer"
          aria-label={ariaLabel || label || "Warehouse"}
        >
          {options.map((opt) => (
            <option key={String(opt.value)} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Date + warehouse pair for inventory page headers. */
export default function InventoryHeaderControls({
  dateValue,
  onDateChange,
  warehouseValue,
  onWarehouseChange,
  warehouses = [],
  warehouseOptions = null,
  dateLabel = "Date",
  warehouseLabel = "Warehouse",
  showLabels = true,
  emptyWarehouseLabel = "Main Warehouse",
  className = "",
  sectionTitle = "Inventory",
  itemType = "",
  children,
}) {
  return (
    <div className={`flex flex-wrap items-end gap-3 ${className}`.trim()}>
      {children}
      <HeaderDateField
        label={dateLabel}
        showLabel={showLabels}
        value={dateValue}
        onChange={onDateChange}
        warehouseId={warehouseValue}
        warehouses={warehouses}
        sectionTitle={sectionTitle}
        itemType={itemType}
      />
      <HeaderWarehouseField
        label={warehouseLabel}
        showLabel={showLabels}
        value={warehouseValue}
        onChange={onWarehouseChange}
        warehouses={warehouses}
        warehouseOptions={warehouseOptions}
        emptyLabel={emptyWarehouseLabel}
      />
    </div>
  );
}
