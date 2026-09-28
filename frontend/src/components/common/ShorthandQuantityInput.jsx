import { useEffect, useState } from "react";
import { formatNumber, parseShorthandNumber, numberToWords } from "../../utils/numberFormat";

/**
 * Quantity & Amount Input component with automatic Indian shorthand parsing ("1 Lakh", "1.5L", "2 Cr", "50k")
 * and automatic comma separation formatting (e.g. 1,00,000) with words preview below input (= Four Thousand).
 */
export default function ShorthandQuantityInput({
  value,
  onChange,
  placeholder = "e.g. 500 (or 1 Lakh, 50k)",
  className = "",
  error = false,
  id,
  name,
}) {
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    if (value != null && value !== "") {
      const parsed = parseShorthandNumber(value);
      if (parsed != null) {
        setDisplayValue(formatNumber(parsed));
      } else {
        setDisplayValue(String(value));
      }
    } else {
      setDisplayValue("");
    }
  }, [value]);

  const parsedNum = parseShorthandNumber(displayValue);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setDisplayValue(val);
    const num = parseShorthandNumber(val);
    if (num != null) {
      onChange(String(num));
    } else if (!val.trim()) {
      onChange("");
    }
  };

  const handleBlur = () => {
    if (parsedNum != null) {
      setDisplayValue(formatNumber(parsedNum));
      onChange(String(parsedNum));
    }
  };

  const words = parsedNum != null ? numberToWords(parsedNum) : "";

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
        className={`ui-input w-full ${error ? "border-[var(--color-danger)]" : ""} ${className}`}
      />
      {parsedNum != null && parsedNum > 0 ? (
        <p className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 pt-0.5">
          <span>=</span>
          <span>{words || formatNumber(parsedNum)}</span>
        </p>
      ) : null}
    </div>
  );
}
