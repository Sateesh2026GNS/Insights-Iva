import { useTranslation } from "react-i18next";

import FieldError from "./states/FieldError";
import { normalizeIndianMobileInput, validateIndianMobile } from "../../utils/indianPhoneValidation";

/**
 * 10-digit Indian mobile input with optional +91 prefix and blur validation.
 */
export default function IndianMobilePhoneInput({
  value = "",
  onChange,
  error,
  setError,
  placeholder = "Mobile number",
  className = "",
  inputClassName = "",
  id,
  disabled = false,
  onBlur,
  showCountryCode = true,
  showInlineError = true,
  "aria-label": ariaLabel = "Phone",
}) {
  const { t } = useTranslation();

  const handleChange = (e) => {
    const next = normalizeIndianMobileInput(e.target.value);
    onChange?.(next);
    if (error && setError) setError("");
  };

  const handleBlur = (e) => {
    const check = validateIndianMobile(e.target.value, t);
    if (!check.ok && setError) {
      setError(check.message);
    }
    onBlur?.(e);
  };

  return (
    <div className={className}>
      <div className={showCountryCode ? "flex gap-2 items-center" : undefined}>
        {showCountryCode ? (
          <span className="shrink-0 text-sm text-[var(--color-text-muted)]" aria-hidden="true">
            +91
          </span>
        ) : null}
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          className={inputClassName}
          placeholder={placeholder}
          value={value ?? ""}
          disabled={disabled}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-label={ariaLabel}
          aria-invalid={error ? "true" : undefined}
        />
      </div>
      {showInlineError ? <FieldError message={error} id={id ? `${id}-error` : undefined} /> : null}
    </div>
  );
}
