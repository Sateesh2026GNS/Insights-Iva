import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { formatNumber, parseShorthandNumber, numberToWords, isPureNumericInput } from "../../utils/numberFormat";

/**
 * Quantity & Amount Input component with automatic Indian shorthand parsing ("1 Lakh", "1.5L", "2 Cr", "50k")
 * and right-end icon button to convert between numbers and words without extra line clutter below.
 */
export default function ShorthandQuantityInput({
  value,
  onChange,
  placeholder = "e.g. 5,000 or 1 Lakh",
  className = "",
  error = false,
  id,
  name,
  disabled,
  ...rest
}) {
  const [displayValue, setDisplayValue] = useState("");
  const [isWordsMode, setIsWordsMode] = useState(false);

  useEffect(() => {
    if (value != null && value !== "") {
      const parsedFromProp = parseShorthandNumber(value);
      const parsedFromDisplay = parseShorthandNumber(displayValue);

      if (parsedFromProp != null && parsedFromDisplay !== parsedFromProp) {
        if (isWordsMode) {
          setDisplayValue(numberToWords(parsedFromProp) || formatNumber(parsedFromProp));
        } else {
          setDisplayValue(isPureNumericInput(value) ? formatNumber(parsedFromProp) : String(value));
        }
      }
    } else if (value === "" || value == null) {
      if (displayValue !== "") {
        setDisplayValue("");
      }
    }
  }, [value]);

  const parsedNum = parseShorthandNumber(displayValue);
  const pureNumeric = isPureNumericInput(displayValue);
  const words = parsedNum != null ? numberToWords(parsedNum) : "";
  const formattedNum = parsedNum != null ? formatNumber(parsedNum) : "";

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
      setIsWordsMode(false);
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
      setIsWordsMode(!isPureNumericInput(val) && Boolean(val.trim()));
      if (num != null) {
        onChange(String(num));
      } else if (!val.trim()) {
        onChange("");
      }
    }
  };

  const handleBlur = () => {
    if (parsedNum != null) {
      if (!isWordsMode && pureNumeric) {
        setDisplayValue(formatNumber(parsedNum));
      }
      onChange(String(parsedNum));
    }
  };

  const handleToggleConversion = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (parsedNum == null || parsedNum <= 0) return;

    if (isWordsMode) {
      // Switch from words to digits
      setDisplayValue(formattedNum);
      setIsWordsMode(false);
    } else {
      // Switch from digits to words
      if (words) {
        setDisplayValue(words);
        setIsWordsMode(true);
      }
    }
    onChange(String(parsedNum));
  };

  const tooltipText =
    parsedNum != null && parsedNum > 0
      ? isWordsMode
        ? `Click to convert to Digits: ${formattedNum}`
        : `Click to convert to Words: ${words || formattedNum}`
      : "Type amount or shorthand (e.g. 50,000 or 1 Lakh)";

  return (
    <div className="relative w-full">
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
        className={`ui-input w-full ${parsedNum != null && parsedNum > 0 ? "pr-20" : "pr-3"} ${
          error ? "border-[var(--color-danger)]" : ""
        } ${className}`}
        {...rest}
      />

      {parsedNum != null && parsedNum > 0 ? (
        <button
          type="button"
          onClick={handleToggleConversion}
          title={tooltipText}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
        >
          <ArrowLeftRight className="h-3 w-3" />
          <span>{isWordsMode ? "123" : "Words"}</span>
        </button>
      ) : null}
    </div>
  );
}
