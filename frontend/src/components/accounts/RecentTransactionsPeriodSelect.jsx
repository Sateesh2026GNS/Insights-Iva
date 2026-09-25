import { useMemo, useRef, useState } from "react";

import CustomReportingDateRangeModal from "./CustomReportingDateRangeModal";
import {
  PERIOD_CUSTOM,
  buildRecentTransactionsPeriodOptions,
  periodOptionLabel,
  resolveRecentTransactionsPeriod,
} from "../../utils/recentTransactionsPeriod";

export default function RecentTransactionsPeriodSelect({
  periodId,
  customRange,
  onPeriodIdChange,
  onCustomRangeChange,
  onRangeApplied,
  className = "",
  id = "recent-transactions-period",
}) {
  const selectRef = useRef(null);
  const [customOpen, setCustomOpen] = useState(false);
  const options = useMemo(() => buildRecentTransactionsPeriodOptions(), []);

  const applyPeriod = (nextId, nextCustom) => {
    const { from, to } = resolveRecentTransactionsPeriod(nextId, options, nextCustom);
    onPeriodIdChange?.(nextId);
    onCustomRangeChange?.(nextCustom);
    onRangeApplied?.({ from, to, periodId: nextId });
  };

  const handleChange = (e) => {
    const nextId = e.target.value;
    if (nextId === PERIOD_CUSTOM) {
      if (selectRef.current) selectRef.current.value = periodId;
      setCustomOpen(true);
      return;
    }
    applyPeriod(nextId, null);
  };

  const displayOptions = useMemo(
    () =>
      options.map((opt) =>
        opt.id === PERIOD_CUSTOM && customRange?.from && customRange?.to && periodId === PERIOD_CUSTOM
          ? { ...opt, label: periodOptionLabel(PERIOD_CUSTOM, options, customRange) }
          : opt
      ),
    [options, customRange, periodId]
  );

  const resolved = resolveRecentTransactionsPeriod(periodId, options, customRange);

  return (
    <>
      <label className={`block min-w-[12rem] ${className}`.trim()}>
        <span className="mb-1 block text-[12px] font-medium text-[#6b6b76]">Recent Transactions</span>
        <select
          ref={selectRef}
          id={id}
          className="ui-select w-full min-w-[12rem] text-[13px]"
          value={periodId}
          onChange={handleChange}
          aria-label="Recent Transactions period"
        >
          {displayOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <CustomReportingDateRangeModal
        open={customOpen}
        initialFrom={customRange?.from || resolved.from}
        initialTo={customRange?.to || resolved.to}
        onClose={() => setCustomOpen(false)}
        onApply={({ from, to }) => applyPeriod(PERIOD_CUSTOM, { from, to })}
      />
    </>
  );
}
