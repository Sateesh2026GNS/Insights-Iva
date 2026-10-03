import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { formatNumber, parseShorthandNumber, numberToWords, isPureNumericInput } from "../../utils/numberFormat";

/**
 * Quantity & Amount Input component with automatic Indian shorthand parsing ("1 Lakh", "1.5L", "2 Cr", "50k")
 * and right-end icon button (ArrowLeftRight) to convert between formatted numbers with commas (e.g. 1,00,000) and words (e.g. One Lakh).
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
  style,
  prefix = "",
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
  const words = parsedNum != null && parsedNum > 0 ? numberToWords(parsedNum) : "";
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
        } catch {}
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
      setDisplayValue(formattedNum);
      setIsWordsMode(false);
    } else {
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
    <div className="relative w-full min-w-[72px] flex items-center">
      {prefix ? (
        <span className="absolute left-2.5 text-xs font-semibold text-slate-400 pointer-events-none select-none z-10">
          {prefix}
        </span>
      ) : null}
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
        className={`ui-input w-full ${prefix ? "pl-7" : ""} ${parsedNum != null && parsedNum > 0 ? "pr-8" : "pr-3"} ${
          error ? "border-[var(--color-danger)]" : ""
        } ${className}`}
        style={{
          paddingLeft: prefix ? "1.75rem" : undefined,
          paddingRight: parsedNum != null && parsedNum > 0 ? "1.95rem" : undefined,
          ...style,
        }}
        {...rest}
      />

      {parsedNum != null && parsedNum > 0 && (
        <button
          type="button"
          onClick={handleToggleConversion}
          title={tooltipText}
          disabled={disabled}
          className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center p-0.5 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors focus:outline-none z-10 cursor-pointer"
          aria-label="Toggle conversion between numbers and words"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
