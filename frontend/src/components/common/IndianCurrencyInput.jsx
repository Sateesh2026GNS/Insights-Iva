import { useEffect, useState } from "react";

import {
  formatIndianCurrencyField,
  inrAmountToWords,
  normalizeIndianCurrencyInput,
} from "../../utils/numberFormat";

/**
 * Currency input with live en-IN grouping and amount in words (stores raw numeric string in parent).
 */
export default function IndianCurrencyInput({
  value = "",
  onChange,
  placeholder = "Enter estimated value",
  className = "",
  id,
  disabled = false,
  inputMode = "decimal",
}) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (value == null || value === "") {
      setDisplay("");
      return;
    }
    setDisplay(formatIndianCurrencyField(String(value).replace(/,/g, "")));
  }, [value]);

  const words = inrAmountToWords(value);

  const handleChange = (e) => {
    const stripped = e.target.value.replace(/,/g, "");
    if (!stripped) {
      setDisplay("");
      onChange?.("");
      return;
    }
    if (stripped.startsWith("-")) return;
    if (!/^\d*(\.\d{0,2})?$/.test(stripped)) return;

    setDisplay(formatIndianCurrencyField(stripped));
    const normalized = normalizeIndianCurrencyInput(stripped);
    if (normalized != null) {
      onChange?.(normalized);
    } else if (/^\d+\.$/.test(stripped)) {
      onChange?.(stripped.slice(0, -1));
    }
  };

  const handleBlur = () => {
    const normalized = normalizeIndianCurrencyInput(value);
    if (normalized != null) {
      onChange?.(normalized);
      setDisplay(formatIndianCurrencyField(normalized));
    } else if (!String(value || "").trim()) {
      setDisplay("");
      onChange?.("");
    }
  };

  return (
    <div className="space-y-1">
      <input
        type="text"
        id={id}
        inputMode={inputMode}
        autoComplete="off"
        disabled={disabled}
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
      />
      {words ? (
        <p className="text-xs text-slate-500 leading-snug" aria-live="polite">
          {words}
        </p>
      ) : null}
    </div>
  );
}
