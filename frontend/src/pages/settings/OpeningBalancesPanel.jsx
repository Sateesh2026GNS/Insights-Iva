import { Calendar, Scale } from "lucide-react";
import { Link } from "react-router-dom";

import Button from "../../components/common/Button";
import FieldError from "../../components/common/states/FieldError";
import { isoToDisplayDate } from "./openingBalancesSettings";

export default function OpeningBalancesPanel({
  dateValue,
  onDateChange,
  saving = false,
  fieldError = "",
  compact = false,
}) {
  return (
    <div className={`grid gap-4 ${compact ? "" : "lg:grid-cols-2"}`}>
      <section className="ui-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Scale className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--color-text)]">Opening Balances</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
              Set the opening balance of accounts before you start using Insights Iva. Once you begin
              using the application, you won&apos;t be able to add, modify, or delete the opening
              balances. You can, however, view the opening balance summary.
            </p>
            <Button to="/accounts/chart-of-accounts" className="mt-5">
              Configure Opening Balances
            </Button>
          </div>
        </div>
      </section>

      <section className="ui-card p-5 sm:p-6">
        <h2 className="text-base font-semibold text-[var(--color-text)]">Opening Balance Date</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
          This date will be the start date of your organization in Insights Iva. You cannot enter
          transactions prior to this date. Also, reports will be generated from this date onwards.
        </p>
        <label className="mt-5 block text-sm font-medium text-[var(--color-text)]" htmlFor="opening-balance-date">
          Opening Balance Date
        </label>
        <div className="relative mt-1.5 max-w-xs">
          <input
            id="opening-balance-date"
            type="date"
            value={dateValue}
            onChange={(e) => onDateChange(e.target.value)}
            disabled={saving}
            className="ui-input w-full pr-10"
            aria-invalid={Boolean(fieldError)}
            aria-describedby={fieldError ? "opening-balance-date-error" : "opening-balance-date-hint"}
          />
          <Calendar
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"
            aria-hidden
          />
        </div>
        <p id="opening-balance-date-hint" className="mt-1.5 text-xs text-[var(--color-text-muted)]">
          Displayed as {isoToDisplayDate(dateValue) || "dd/MM/yyyy"}
        </p>
        <FieldError id="opening-balance-date-error" message={fieldError} />
        <p className="mt-4 text-xs text-[var(--color-text-muted)]">
          Need to review account balances?{" "}
          <Link to="/accounts/chart-of-accounts" className="font-semibold text-[var(--color-primary)] hover:underline">
            Open Chart of Accounts
          </Link>
        </p>
      </section>
    </div>
  );
}
