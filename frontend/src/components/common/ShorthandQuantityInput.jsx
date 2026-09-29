import { useEffect, useState } from "react";
import { formatNumber, parseShorthandNumber, numberToWords, isPureNumericInput } from "../../utils/numberFormat";

/**
 * Quantity & Amount Input component with automatic Indian shorthand parsing ("1 Lakh", "1.5L", "2 Cr", "50k")
 * and words/number preview below input.
 */
export default function ShorthandQuantityInput({
  value,
  onChange,
  placeholder = "e.g. 500 (or 1 Lakh, 50k)",
  className = "",
  error = false,
  id,
  name,
  disabled,
  showPreview = true,
  ...rest
}) {
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    if (value != null && value !== "") {
      const parsedFromProp = parseShorthandNumber(value);
      const parsedFromDisplay = parseShorthandNumber(displayValue);
      // Only set displayValue if displayValue doesn't already parse to the same numeric value
      if (parsedFromProp != null && parsedFromDisplay !== parsedFromProp) {
        setDisplayValue(isPureNumericInput(value) ? formatNumber(parsedFromProp) : String(value));
      }
    } else if (value === "" || value == null) {
      if (displayValue !== "") {
        setDisplayValue("");
      }
    }
  }, [value]);

  const parsedNum = parseShorthandNumber(displayValue);
  const pureNumeric = isPureNumericInput(displayValue);

  const handleInputChange = (e) => {
    const val = e.target.value;
    const inputElem = e.target;
    const selectionStart = inputElem.selectionStart || 0;

    const num = parseShorthandNumber(val);

    if (isPureNumericInput(val) && num != null && !val.endsWith(".") && !/\.\d*0$/.test(val)) {
      const rawDigitsBeforeCursor = val.slice(0, selectionStart).replace(/,/g, "").length;
      const parts = val.replace(/,/g, "").split(".");
      let formatted = formatNumber(Number(parts[0]));
      if (parts.length > 1) {
        formatted = `${formatted}.${parts[1]}`;
      }

      setDisplayValue(formatted);
      onChange(String(num));

      setTimeout(() => {
        if (!inputElem) return;
        let newCursorPos = 0;
        let digitCount = 0;
        const cleanVal = formatted.replace(/,/g, "");
        const targetDigits = Math.min(rawDigitsBeforeCursor, cleanVal.length);

        for (let i = 0; i < formatted.length; i++) {
          if (formatted[i] !== ",") {
            digitCount++;
          }
          if (digitCount === targetDigits) {
            newCursorPos = i + 1;
            break;
          }
        }
        if (newCursorPos === 0) newCursorPos = formatted.length;
        try {
          inputElem.setSelectionRange(newCursorPos, newCursorPos);
        } catch {
          // input element selection range fallback
        }
      }, 0);
    } else {
      setDisplayValue(val);
      if (num != null) {
        onChange(String(num));
      } else if (!val.trim()) {
        onChange("");
      }
    }
  };

  const handleBlur = () => {
    if (parsedNum != null) {
      // If user entered pure numeric digits (e.g. 100000), format with commas: 1,00,000
      // If user entered shorthand/words (e.g. 1 Lakh, 50k, one lakh), keep what they typed in the input box!
      if (pureNumeric) {
        setDisplayValue(formatNumber(parsedNum));
      }
      onChange(String(parsedNum));
    }
  };

  const words = parsedNum != null ? numberToWords(parsedNum) : "";
  const formattedNum = parsedNum != null ? formatNumber(parsedNum) : "";

  return (
    <div className="space-y-1">
      <input
        type="text"
        id={id}
        name={name}
        value={displayValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={(e) => e.target.select()}
        placeholder={placeholder}
        disabled={disabled}
        className={`ui-input w-full ${error ? "border-[var(--color-danger)]" : ""} ${className}`}
        {...rest}
      />
      {showPreview && parsedNum != null && parsedNum > 0 ? (
        <p className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 pt-0.5">
          <span>=</span>
          {pureNumeric ? (
            <span>{words || formattedNum}</span>
          ) : (
            <span>{formattedNum}{words ? ` (${words})` : ""}</span>
          )}
        </p>
      ) : null}
    </div>
  );
}
