import {
  FISCAL_YEARS, QUARTERS, MONTHS, PLANTS, DEPARTMENTS,
  WAREHOUSES, PRODUCTS, CUSTOMERS, MACHINES,
} from "../../data/analyticsMasterData";
import { DatePicker } from "../../design-system/dateControls";
import { fyRange, todayIso, toIsoDate } from "../../utils/dateUtils";

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="min-w-0">
      <label className="ui-label">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ui-select w-full text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function indianQuarterRange(now = new Date()) {
  const m = now.getMonth();
  let startM;
  let startY = now.getFullYear();
  if (m >= 3 && m <= 5) startM = 3;
  else if (m >= 6 && m <= 8) startM = 6;
  else if (m >= 9 && m <= 11) startM = 9;
  else {
    startM = 0;
  }
  return { from: toIsoDate(new Date(startY, startM, 1)), to: todayIso(now) };
}

function lastNDays(n, now = new Date()) {
  const from = new Date(now);
  from.setDate(from.getDate() - (n - 1));
  return { from: toIsoDate(from), to: todayIso(now) };
}

const PRESETS = [
  { id: "this-month", label: "This month", range: () => ({ from: toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to: todayIso() }) },
  { id: "this-quarter", label: "This quarter", range: () => indianQuarterRange() },
  { id: "ytd", label: "FY to date", range: () => ({ from: fyRange().from, to: todayIso() }) },
  { id: "last-30", label: "Last 30 days", range: () => lastNDays(30) },
];

export default function AnalyticsFilterBar({
  fiscalYear, onFiscalYearChange,
  month, onMonthChange,
  quarter, onQuarterChange,
  plant, onPlantChange,
  department, onDepartmentChange,
  warehouse, onWarehouseChange,
  product, onProductChange,
  customer, onCustomerChange,
  machine, onMachineChange,
  dateFrom, onDateFromChange,
  dateTo, onDateToChange,
  showAll = true,
}) {
  const applyPreset = (preset) => {
    const { from, to } = preset.range();
    onDateFromChange?.(from);
    onDateToChange?.(to);
  };

  const activePreset = PRESETS.find((p) => {
    const { from, to } = p.range();
    return from === dateFrom && to === dateTo;
  })?.id;

  return (
    <div className="ui-card ui-card--padded">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="ui-eyebrow">Reporting period</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 ${
                activePreset === preset.id
                  ? "bg-[var(--color-primary)] font-medium text-white"
                  : "border border-[var(--color-border)] bg-[var(--color-surface)] font-normal text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <DatePicker label="Date From" value={dateFrom || ""} onChange={onDateFromChange} max={dateTo || undefined} clearable />
        <DatePicker label="Date To" value={dateTo || ""} onChange={onDateToChange} min={dateFrom || undefined} clearable />
        {onFiscalYearChange ? (
          <SelectField label="Fiscal Year" value={fiscalYear} onChange={onFiscalYearChange} options={FISCAL_YEARS} />
        ) : null}
        {onMonthChange ? (
          <SelectField label="Month" value={month} onChange={onMonthChange} options={MONTHS} />
        ) : null}
        {onQuarterChange ? (
          <SelectField label="Quarter" value={quarter} onChange={onQuarterChange} options={QUARTERS} />
        ) : null}
        {onPlantChange ? (
          <SelectField label="Plant" value={plant} onChange={onPlantChange} options={PLANTS} />
        ) : null}
        {showAll && (
          <>
            {onDepartmentChange ? <SelectField label="Department" value={department} onChange={onDepartmentChange} options={DEPARTMENTS} /> : null}
            {onWarehouseChange ? <SelectField label="Warehouse" value={warehouse} onChange={onWarehouseChange} options={WAREHOUSES} /> : null}
            {onProductChange ? <SelectField label="Product" value={product} onChange={onProductChange} options={PRODUCTS} /> : null}
            {onCustomerChange ? <SelectField label="Customer" value={customer} onChange={onCustomerChange} options={CUSTOMERS} /> : null}
            {onMachineChange ? <SelectField label="Machine" value={machine} onChange={onMachineChange} options={MACHINES} /> : null}
          </>
        )}
      </div>
    </div>
  );
}
