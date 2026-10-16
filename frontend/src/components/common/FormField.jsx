import { useId, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { openNativeDatePicker } from "../../utils/dateUtils";

const DATE_INPUT_TYPES = new Set(["date", "datetime-local", "month", "time"]);

function DateInputTrigger({ inputRef, disabled, label }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        openNativeDatePicker(inputRef.current);
      }}
      disabled={disabled}
      className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-text-icon)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 disabled:opacity-50"
      aria-label={label ? `Open calendar for ${label}` : "Open calendar"}
      tabIndex={-1}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function FormField({
  label,
  error,
  hint,
  required,
  optional,
  htmlFor,
  children,
  className = "",
}) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className={`space-y-1 ${className}`.trim()}>
      {label ? (
        <label className="ui-label" htmlFor={htmlFor}>
          {label}
          {required ? (
            <>
              <span className="ml-0.5 text-[var(--color-danger)]" aria-hidden>
                *
              </span>
              <span className="sr-only"> required</span>
            </>
          ) : optional ? (
            <span className="ml-1 font-normal text-[var(--color-text-muted)]">(optional)</span>
          ) : null}
        </label>
      ) : null}
      {children}
      {hint ? (
        <p id={hintId} className="ui-field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="ui-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  label,
  error,
  hint,
  required,
  optional,
  icon: Icon,
  type = "text",
  className = "",
  onFocus,
  onChange,
  id,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef(null);
  const autoId = useId();
  const fieldId = id || autoId;
  const isPassword = type === "password";
  const isDateInput = DATE_INPUT_TYPES.has(type);
  const inputType = isPassword ? (visible ? "text" : "password") : type;

  const handleFocus = (e) => {
    const target = e.target;
    onFocus?.(e);
    if (type === "number" || target.value === "0" || target.value === 0) {
      setTimeout(() => {
        try {
          if (target && typeof target.select === "function") {
            target.select();
          }
        } catch (err) {}
      }, 0);
    }
  };

  const handleChange = (e) => {
    if ((type === "number" || props.inputMode === "numeric") && typeof e.target.value === "string" && e.target.value !== "") {
      if (/^0+(?=[0-9])/.test(e.target.value)) {
        e.target.value = e.target.value.replace(/^0+(?=[0-9])/, "");
      }
    }
    onChange?.(e);
  };

  const handleKeyDown = (e) => {
    if (isDateInput && e.key === "Escape") {
      e.currentTarget.blur();
    }
    props.onKeyDown?.(e);
  };

  const datePadding = isDateInput ? "pr-10" : "";
  const iconPadding = Icon && !isDateInput ? "pl-10" : Icon && isDateInput ? "pl-10 pr-10" : "";

  const describedBy = [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;
  const hasChrome = Boolean(label || error || hint || required || optional);

  const control = (
      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-icon)]" />
        ) : null}
        <input
          ref={inputRef}
          id={fieldId}
          type={inputType}
          className={`ui-input ${isDateInput ? "ui-date-input" : ""} ${iconPadding} ${datePadding} ${isPassword ? "pr-11" : ""} ${error ? "is-error" : ""} ${className}`.trim()}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          {...props}
          onFocus={handleFocus}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        {isDateInput ? <DateInputTrigger inputRef={inputRef} disabled={props.disabled} label={label} /> : null}
        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2.5 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-text-icon)] hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
            aria-label={visible ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {visible ? <EyeOff className="h-4 w-4 shrink-0" /> : <Eye className="h-4 w-4 shrink-0" />}
          </button>
        ) : null}
      </div>
  );

  if (!hasChrome) return control;
  return (
    <FormField label={label} error={error} hint={hint} required={required} optional={optional} htmlFor={fieldId}>
      {control}
    </FormField>
  );
}

export function Select({
  label,
  error,
  hint,
  required,
  optional,
  options = [],
  placeholder = "Select...",
  className = "",
  children,
  id,
  ...props
}) {
  const autoId = useId();
  const fieldId = id || autoId;
  const describedBy = [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;
  const hasChrome = Boolean(label || error || hint || required || optional);
  const control = (
      <select
        id={fieldId}
        className={`ui-select ${error ? "is-error" : ""} ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        {...props}
      >
        {children ? (
          children
        ) : (
          <>
            {options.map((opt) => {
              const val = opt.value ?? opt.id;
              const lbl = opt.label ?? opt.name;
              const isAdd =
                String(lbl || "").startsWith("+") ||
                /add new|create new/i.test(String(lbl || "")) ||
                String(val || "").startsWith("__add") ||
                String(val || "").startsWith("__new");
              return (
                <option
                  key={val ?? lbl}
                  value={val}
                  className={isAdd ? "add-new-option text-[var(--color-primary)] font-semibold" : ""}
                  style={isAdd ? { color: "#036f71", fontWeight: "600" } : undefined}
                >
                  {lbl}
                </option>
              );
            })}
          </>
        )}
      </select>
  );
  if (!hasChrome) return control;
  return (
    <FormField label={label} error={error} hint={hint} required={required} optional={optional} htmlFor={fieldId}>
      {control}
    </FormField>
  );
}

export function Textarea({
  label,
  error,
  hint,
  required,
  optional,
  rows = 3,
  className = "",
  inputRef,
  id,
  ...props
}) {
  const autoId = useId();
  const fieldId = id || autoId;
  const describedBy = [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;
  const hasChrome = Boolean(label || error || hint || required || optional);
  const control = (
      <textarea
        ref={inputRef}
        id={fieldId}
        rows={rows}
        className={`ui-textarea min-h-[80px] resize-y ${error ? "is-error" : ""} ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        {...props}
      />
  );
  if (!hasChrome) return control;
  return (
    <FormField label={label} error={error} hint={hint} required={required} optional={optional} htmlFor={fieldId}>
      {control}
    </FormField>
  );
}

export function FormRow({ children, className = "" }) {
  return (
    <div
      className={`grid gap-4 ${className.includes("grid-cols") ? className : `sm:grid-cols-2 ${className}`}`.trim()}
    >
      {children}
    </div>
  );
}
