import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function FormField({ label, error, hint, required, children }) {
  return (
    <div className="space-y-1">
      {label ? (
        <label className="ui-label">
          {label}
          {required ? <span className="ml-0.5 text-[var(--color-danger)]">*</span> : null}
        </label>
      ) : null}
      {children}
      {hint ? <p className="ui-field-hint">{hint}</p> : null}
      {error ? <p className="ui-field-error">{error}</p> : null}
    </div>
  );
}

export function Input({
  label,
  error,
  hint,
  required,
  icon: Icon,
  type = "text",
  className = "",
  onFocus,
  onChange,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
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

  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      <div className="relative">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-icon)]" />
        ) : null}
        <input
          type={inputType}
          className={`ui-input ${Icon ? "pl-10" : ""} ${isPassword ? "pr-11" : ""} ${error ? "is-error" : ""} ${className}`.trim()}
          {...props}
          onFocus={handleFocus}
          onChange={handleChange}
        />
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
    </FormField>
  );
}

export function Select({
  label,
  error,
  hint,
  required,
  options = [],
  placeholder = "Select...",
  className = "",
  children,
  ...props
}) {
  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      <select
        className={`ui-select ${error ? "is-error" : ""} ${className}`.trim()}
        {...props}
      >
        {children ? (
          children
        ) : (
          <>
            {placeholder ? <option value="">{placeholder}</option> : null}
            {options.map((opt) => (
              <option key={opt.value ?? opt.id ?? opt.label} value={opt.value ?? opt.id}>
                {opt.label ?? opt.name}
              </option>
            ))}
          </>
        )}
      </select>
    </FormField>
  );
}

export function Textarea({
  label,
  error,
  hint,
  required,
  rows = 3,
  className = "",
  ...props
}) {
  return (
    <FormField label={label} error={error} hint={hint} required={required}>
      <textarea
        rows={rows}
        className={`ui-textarea min-h-[80px] resize-y ${error ? "is-error" : ""} ${className}`.trim()}
        {...props}
      />
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
