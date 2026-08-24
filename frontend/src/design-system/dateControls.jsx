/**
 * Insights Iva — shared date/time picker components.
 * Uses native pickers (showPicker) + optional custom range popover.
 * All date-only values are YYYY-MM-DD (local calendar, no UTC shift).
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

import { FormField } from "../components/common/FormField";
import {
  addMonths,
  buildDateRangePresets,
  daysInMonth,
  formatDisplayDate,
  openNativeDatePicker,
  parseIsoDate,
  startOfMonth,
  toIsoDate,
  validateDateRange,
} from "../utils/dateUtils";

function pad2(n) {
  return String(n).padStart(2, "0");
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Shared calendar button */
function CalendarTriggerButton({ onClick, disabled, label = "Open calendar" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-text-icon)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 disabled:opacity-50"
      aria-label={label}
      tabIndex={-1}
    >
      <Calendar className="h-4 w-4 shrink-0" aria-hidden />
    </button>
  );
}

/** Month grid for popover range picker */
export function MonthCalendar({ monthDate, rangeFrom, rangeTo, onPick, min, max, single = false }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const total = daysInMonth(year, month);
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= total; d += 1) cells.push(d);

  const from = parseIsoDate(rangeFrom);
  const to = parseIsoDate(rangeTo);
  const label = monthDate.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const isDisabled = (iso) => {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  };

  const isToday = (iso) => iso === toIsoDate(new Date());

  return (
    <div className="ui-date-calendar min-w-[220px]">
      <div className="mb-2 text-center text-[13px] font-semibold text-[var(--color-text)]">{label}</div>
      <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-[var(--color-text-muted)]">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="h-8" />;
          const iso = `${year}-${pad2(month + 1)}-${pad2(day)}`;
          const date = new Date(year, month, day);
          const disabled = isDisabled(iso);
          const inRange =
            from && to && date >= from && date <= to
              ? true
              : from && !to && iso === rangeFrom;
          const isEdge = iso === rangeFrom || iso === rangeTo;
          const selected = single ? iso === rangeFrom : isEdge;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onPick(iso)}
              className={`ui-date-calendar-day h-8 rounded-md text-[12px] transition ${
                disabled
                  ? "cursor-not-allowed text-[var(--color-text-faint)] opacity-40"
                  : selected
                    ? "bg-[var(--color-primary)] font-semibold text-white"
                    : inRange
                      ? "bg-[var(--color-primary-soft)] text-[var(--color-text)]"
                      : isToday(iso)
                        ? "font-semibold text-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/30"
                        : "text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Single date picker — native input + calendar button.
 * value/onChange use YYYY-MM-DD strings.
 */
export function DatePicker({
  label,
  value = "",
  onChange,
  min,
  max,
  disabled = false,
  required = false,
  clearable = false,
  className = "",
  id: idProp,
  name,
  error,
  hint,
  floatingLabel = false,
  placeholder = "Select date",
  onBlur,
  inputClassName = "",
}) {
  const autoId = useId();
  const id = idProp || autoId;
  const inputRef = useRef(null);

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onChange?.("");
  };

  const openPicker = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (disabled) return;
    openNativeDatePicker(inputRef.current);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      inputRef.current?.blur();
    }
  };

  if (floatingLabel) {
    return (
      <label className={`relative block min-w-[150px] ${className}`} htmlFor={id}>
        <span className="absolute -top-2 left-3 z-[1] bg-[var(--color-surface)] px-1 text-[11px] font-medium text-[var(--color-text-muted)]">
          {label}
        </span>
        <div className="relative flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
          <span className="min-w-0 flex-1 text-[13px] text-[var(--color-text)]">
            {formatDisplayDate(value) || placeholder}
          </span>
          <CalendarDays className="ml-1 h-4 w-4 shrink-0 text-[var(--color-text-icon)]" aria-hidden />
          <input
            ref={inputRef}
            id={id}
            name={name}
            type="date"
            value={value || ""}
            min={min}
            max={max}
            disabled={disabled}
            required={required}
            onChange={(e) => onChange?.(e.target.value)}
            onBlur={onBlur}
            onKeyDown={handleKeyDown}
            className="ui-date-input absolute inset-0 cursor-pointer opacity-0"
            aria-label={label}
          />
        </div>
        {error ? <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p> : null}
      </label>
    );
  }

  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      <div className={`relative ${className}`}>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="date"
          value={value || ""}
          min={min}
          max={max}
          disabled={disabled}
          required={required}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          className={`ui-input ui-date-input ${clearable ? "pr-[4.5rem]" : "pr-10"} ${error ? "is-error" : ""} ${inputClassName}`.trim()}
        />
        {clearable && value ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="absolute right-10 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-text-icon)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
            aria-label="Clear date"
            tabIndex={-1}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <CalendarTriggerButton onClick={openPicker} disabled={disabled} label={label ? `Open calendar for ${label}` : "Open calendar"} />
      </div>
    </FormField>
  );
}

/** Floating label variant (accounts reports). */
export function FloatingDate(props) {
  return <DatePicker {...props} floatingLabel />;
}

/** datetime-local picker */
export function DateTimePicker({
  label,
  value = "",
  onChange,
  min,
  max,
  disabled = false,
  required = false,
  className = "",
  error,
  hint,
  id: idProp,
}) {
  const autoId = useId();
  const id = idProp || autoId;
  const inputRef = useRef(null);

  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      <div className={`relative ${className}`}>
        <input
          ref={inputRef}
          id={id}
          type="datetime-local"
          value={value || ""}
          min={min}
          max={max}
          disabled={disabled}
          required={required}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && inputRef.current?.blur()}
          className={`ui-input ui-date-input pr-10 ${error ? "is-error" : ""}`}
        />
        <CalendarTriggerButton
          onClick={() => openNativeDatePicker(inputRef.current)}
          disabled={disabled}
          label={label ? `Open date/time for ${label}` : "Open date and time"}
        />
      </div>
    </FormField>
  );
}

/** time picker */
export function TimePicker({ label, value = "", onChange, disabled, required, className = "", error, hint, min, max }) {
  const inputRef = useRef(null);
  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      <div className={`relative ${className}`}>
        <input
          ref={inputRef}
          type="time"
          value={value || ""}
          min={min}
          max={max}
          disabled={disabled}
          required={required}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && inputRef.current?.blur()}
          className={`ui-input ui-date-input pr-10 ${error ? "is-error" : ""}`}
        />
        <CalendarTriggerButton
          onClick={() => openNativeDatePicker(inputRef.current)}
          disabled={disabled}
          label={label ? `Open time picker for ${label}` : "Open time picker"}
        />
      </div>
    </FormField>
  );
}

/** month picker */
export function MonthPicker({ label, value = "", onChange, disabled, required, className = "", error, hint, min, max }) {
  const inputRef = useRef(null);
  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      <div className={`relative ${className}`}>
        <input
          ref={inputRef}
          type="month"
          value={value || ""}
          min={min}
          max={max}
          disabled={disabled}
          required={required}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && inputRef.current?.blur()}
          className={`ui-input ui-date-input pr-10 ${error ? "is-error" : ""}`}
        />
        <CalendarTriggerButton
          onClick={() => openNativeDatePicker(inputRef.current)}
          disabled={disabled}
          label={label ? `Open month picker for ${label}` : "Open month picker"}
        />
      </div>
    </FormField>
  );
}

/**
 * Date range picker with presets + dual calendar popover.
 * onChange receives { from, to } as YYYY-MM-DD strings.
 */
export function DateRangePicker({
  from = "",
  to = "",
  onChange,
  presets: presetsProp,
  min,
  max,
  className = "",
  disabled = false,
  portal = true,
  showPresets = true,
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [leftMonth, setLeftMonth] = useState(() => startOfMonth(parseIsoDate(from) || new Date()));
  const [activePreset, setActivePreset] = useState("");
  const [rangeError, setRangeError] = useState("");
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const presets = presetsProp ?? buildDateRangePresets();

  useEffect(() => {
    if (!open) return;
    setDraftFrom(from);
    setDraftTo(to);
    setRangeError("");
  }, [open, from, to]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      const t = e.target;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pickDay = (iso) => {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(iso);
      setDraftTo("");
      setActivePreset("");
      setRangeError("");
      return;
    }
    if (iso < draftFrom) {
      setDraftTo(draftFrom);
      setDraftFrom(iso);
    } else {
      setDraftTo(iso);
    }
    setActivePreset("");
    setRangeError("");
  };

  const apply = () => {
    if (!draftFrom || !draftTo) {
      setRangeError("Select both start and end dates.");
      return;
    }
    const check = validateDateRange(draftFrom, draftTo);
    if (!check.valid) {
      setRangeError(check.message);
      return;
    }
    onChange?.({ from: draftFrom, to: draftTo });
    setOpen(false);
  };

  const clear = () => {
    setDraftFrom("");
    setDraftTo("");
    setActivePreset("");
    setRangeError("");
    onChange?.({ from: "", to: "" });
    setOpen(false);
  };

  const panel = open ? (
    <div
      ref={panelRef}
      className="ui-date-range-popover flex overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      style={
        portal && triggerRef.current
          ? {
              position: "fixed",
              top: triggerRef.current.getBoundingClientRect().bottom + 8,
              left: Math.min(
                triggerRef.current.getBoundingClientRect().left,
                window.innerWidth - 620,
              ),
              zIndex: 80,
            }
          : undefined
      }
    >
      {showPresets ? (
        <div className="max-h-[320px] w-[150px] shrink-0 overflow-y-auto border-r border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] py-2">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setDraftFrom(p.from);
                setDraftTo(p.to);
                setActivePreset(p.id);
                setLeftMonth(startOfMonth(parseIsoDate(p.from) || new Date()));
                setRangeError("");
              }}
              className={`block w-full px-3 py-2 text-left text-[13px] transition ${
                activePreset === p.id
                  ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              {p.id}
            </button>
          ))}
        </div>
      ) : null}
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setLeftMonth((m) => addMonths(m, -1))}
            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border-soft)] hover:bg-[var(--color-surface-hover)]"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setLeftMonth(startOfMonth(new Date()))}
            className="rounded-md px-2 py-1 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setLeftMonth((m) => addMonths(m, 1))}
            className="grid h-8 w-8 place-items-center rounded-md border border-[var(--color-border-soft)] hover:bg-[var(--color-surface-hover)]"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-6">
          <MonthCalendar monthDate={leftMonth} rangeFrom={draftFrom} rangeTo={draftTo} onPick={pickDay} min={min} max={max} />
          <MonthCalendar
            monthDate={addMonths(leftMonth, 1)}
            rangeFrom={draftFrom}
            rangeTo={draftTo}
            onPick={pickDay}
            min={min}
            max={max}
          />
        </div>
        {rangeError ? <p className="mt-2 text-xs text-[var(--color-danger)]">{rangeError}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] shadow-sm transition hover:border-[var(--color-primary)] disabled:opacity-50"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <CalendarDays className="h-4 w-4 text-[var(--color-text-icon)]" aria-hidden />
        <span>
          {formatDisplayDate(from) || "Start"} → {formatDisplayDate(to) || "End"}
        </span>
      </button>
      {portal ? (panel ? createPortal(panel, document.body) : null) : panel}
    </div>
  );
}

/** Pair of DatePickers for simple from/to filters */
export function DateRangeFields({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = "From date",
  toLabel = "To date",
  min,
  max,
  className = "",
  validate = true,
}) {
  const rangeCheck = validate ? validateDateRange(from, to) : { valid: true, message: "" };

  return (
    <div className={`flex flex-wrap items-end gap-3 ${className}`}>
      <DatePicker label={fromLabel} value={from} onChange={onFromChange} min={min} max={to || max} clearable />
      <DatePicker label={toLabel} value={to} onChange={onToChange} min={from || min} max={max} clearable />
      {!rangeCheck.valid ? (
        <p className="w-full text-xs text-[var(--color-danger)]">{rangeCheck.message}</p>
      ) : null}
    </div>
  );
}

export {
  formatDisplayDate,
  defaultDateRange,
  todayIso,
  toIsoDate,
  parseIsoDate,
  validateDateRange,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  openNativeDatePicker,
} from "../utils/dateUtils";
