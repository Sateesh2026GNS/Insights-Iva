import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";

import {
  formatIndianCurrencyField,
  inrAmountToWords,
  isPureNumericInput,
  normalizeIndianCurrencyInput,
  numberToWords,
  parseShorthandNumber,
} from "../../utils/numberFormat";

/**
 * Currency input with live en-IN grouping, shorthand parsing ("1 Lakh", "50k"),
 * words preview below input, and right-end icon button (ArrowLeftRight) to convert
 * between formatted numbers with commas (e.g. 1,00,000) and words (e.g. One Lakh Rupees Only).
 */
export default function IndianCurrencyInput({
  value = "",
  onChange,
  placeholder = "Enter estimated value",
  className = "",
  id,
  name,
  disabled = false,
  inputMode = "decimal",
  showWords = true,
  error = false,
  style,
  prefix = "",
  ...rest
}) {
  const [display, setDisplay] = useState("");
  const [isWordsMode, setIsWordsMode] = useState(false);

  useEffect(() => {
    if (value != null && value !== "") {
      const parsedFromProp = parseShorthandNumber(value);
      const parsedFromDisplay = parseShorthandNumber(display);

      if (parsedFromProp != null && parsedFromDisplay !== parsedFromProp) {
        if (isWordsMode) {
          const w = inrAmountToWords(parsedFromProp) || numberToWords(parsedFromProp);
          setDisplay(w || formatIndianCurrencyField(parsedFromProp));
        } else {
          setDisplay(
            isPureNumericInput(value)
              ? formatIndianCurrencyField(parsedFromProp)
              : String(value)
          );
        }
      }
    } else if (value === "" || value == null) {
      if (display !== "") {
        setDisplay("");
        setIsWordsMode(false);
      }
    }
  }, [value]);

  const parsedNum = parseShorthandNumber(display);
  const pureNumeric = isPureNumericInput(display);
  const words = parsedNum != null && parsedNum > 0 ? (inrAmountToWords(parsedNum) || numberToWords(parsedNum)) : "";
  const formattedNum = parsedNum != null ? formatIndianCurrencyField(parsedNum) : "";

  const handleChange = (e) => {
    const val = e.target.value;
    const inputElem = e.target;
    const selectionStart = inputElem.selectionStart || 0;

    if (!val) {
      setDisplay("");
      setIsWordsMode(false);
      onChange?.("");
      return;
    }

    const num = parseShorthandNumber(val);

    if (isPureNumericInput(val) && num != null && !val.endsWith(".") && !/\.\d*0$/.test(val)) {
      const rawDigitsBeforeCursor = val.slice(0, selectionStart).replace(/,/g, "").length;
      const stripped = val.replace(/,/g, "");
      if (stripped.startsWith("-")) return;
      if (!/^\d*(\.\d{0,2})?$/.test(stripped)) return;

      const formatted = formatIndianCurrencyField(stripped);
      setDisplay(formatted);
      setIsWordsMode(false);
      const normalized = normalizeIndianCurrencyInput(stripped);
      if (normalized != null) {
        onChange?.(normalized);
      } else if (/^\d+\.$/.test(stripped)) {
        onChange?.(stripped.slice(0, -1));
      }

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
      const stripped = val.replace(/,/g, "");
      if (stripped.startsWith("-")) return;

      setDisplay(val);
      const hasDigits = /\d/.test(val);
      setIsWordsMode(!hasDigits && Boolean(val.trim()));

      if (num != null) {
        onChange?.(String(num));
      } else if (!val.trim()) {
        onChange?.("");
      }
    }
  };

  const handleBlur = (e) => {
    if (parsedNum != null) {
      if (!isWordsMode && pureNumeric) {
        setDisplay(formatIndianCurrencyField(parsedNum));
      }
      onChange?.(String(parsedNum));
    } else if (!String(display || "").trim()) {
      setDisplay("");
      setIsWordsMode(false);
      onChange?.("");
    }
    rest.onBlur?.(e);
  };

  const handleToggleConversion = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (parsedNum == null || parsedNum <= 0) return;

    if (isWordsMode) {
      setDisplay(formattedNum);
      setIsWordsMode(false);
    } else {
      const wordsStr = words || inrAmountToWords(parsedNum) || numberToWords(parsedNum);
      if (wordsStr) {
        setDisplay(wordsStr);
        setIsWordsMode(true);
      }
    }
    onChange?.(String(parsedNum));
  };

  const tooltipText =
    parsedNum != null && parsedNum > 0
      ? isWordsMode
        ? `Click to convert to Digits: ${formattedNum}`
        : `Click to convert to Words: ${words || formattedNum}`
      : "Type amount (e.g. 500)";

  return (
    <div className="space-y-1">
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
          inputMode={isWordsMode ? "text" : inputMode}
          autoComplete="off"
          disabled={disabled}
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={`${className} ${prefix ? "pl-7" : ""} ${parsedNum != null && parsedNum > 0 ? "pr-8" : ""}`}
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

      {showWords && (words || (isWordsMode && formattedNum)) ? (
        <p className="text-xs text-slate-500 leading-snug" aria-live="polite">
          {isWordsMode ? `₹${formattedNum}` : words}
        </p>
      ) : null}
    </div>
  );
}
