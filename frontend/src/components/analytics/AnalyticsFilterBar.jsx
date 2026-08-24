import {
  FISCAL_YEARS, QUARTERS, MONTHS, PLANTS, DEPARTMENTS,
  WAREHOUSES, PRODUCTS, CUSTOMERS, MACHINES,
} from "../../data/analyticsMasterData";
import { DatePicker } from "../../design-system/dateControls";

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ui-select w-full text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o === o.replace?.(/^All /, "") ? o : o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

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
  return (
    <div className="ui-card p-4">
      <p className="mb-3 ui-eyebrow">Global Filters</p>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <DatePicker label="Date From" value={dateFrom || ""} onChange={onDateFromChange} max={dateTo || undefined} clearable />
        <DatePicker label="Date To" value={dateTo || ""} onChange={onDateToChange} min={dateFrom || undefined} clearable />
        <SelectField label="Fiscal Year" value={fiscalYear} onChange={onFiscalYearChange} options={FISCAL_YEARS} />
        <SelectField label="Month" value={month} onChange={onMonthChange} options={MONTHS} />
        <SelectField label="Quarter" value={quarter} onChange={onQuarterChange} options={QUARTERS} />
        <SelectField label="Plant" value={plant} onChange={onPlantChange} options={PLANTS} />
        {showAll && (
          <>
            <SelectField label="Department" value={department} onChange={onDepartmentChange} options={DEPARTMENTS} />
            <SelectField label="Warehouse" value={warehouse} onChange={onWarehouseChange} options={WAREHOUSES} />
            <SelectField label="Product" value={product} onChange={onProductChange} options={PRODUCTS} />
            <SelectField label="Customer" value={customer} onChange={onCustomerChange} options={CUSTOMERS} />
            <SelectField label="Machine" value={machine} onChange={onMachineChange} options={MACHINES} />
          </>
        )}
      </div>
    </div>
  );
}
