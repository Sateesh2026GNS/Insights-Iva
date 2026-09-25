import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import LedgerStatementExportMenu from "./LedgerStatementExportMenu";
import RecentTransactionsPeriodSelect from "./RecentTransactionsPeriodSelect";
import {
  PERIOD_RECENT,
  buildRecentTransactionsPeriodOptions,
  resolveRecentTransactionsPeriod,
} from "../../utils/recentTransactionsPeriod";
import { fetchPartyLedgerTransactions } from "../../utils/ledgerPartyTransactions";
import { apiErrorMessage } from "../../utils/apiError";
import { formatDisplayDate } from "../../utils/dateUtils";

function formatVoucherDate(iso) {
  if (!iso) return "—";
  return formatDisplayDate(String(iso).slice(0, 10), "-");
}

export default function PartyLedgerStatementSection({
  kind = "customer",
  partyId,
  partyName = "",
  partyEmail = "",
  compact = false,
  ledgerPath,
}) {
  const periodOptions = useMemo(() => buildRecentTransactionsPeriodOptions(), []);
  const initialRange = useMemo(
    () => resolveRecentTransactionsPeriod(PERIOD_RECENT, periodOptions),
    [periodOptions]
  );

  const [periodId, setPeriodId] = useState(PERIOD_RECENT);
  const [customRange, setCustomRange] = useState(null);
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!partyId) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchPartyLedgerTransactions(kind, partyId, fromDate, toDate);
      setRows(data);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load transactions."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [kind, partyId, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  const onPeriodRangeApplied = useCallback(({ from, to }) => {
    setFromDate(from);
    setToDate(to);
  }, []);

  const displayRows = compact ? rows.slice(0, 8) : rows;
  const fullLedgerTo =
    ledgerPath || `/accounts/ledger/${kind === "vendor" || kind === "creditors" ? "vendor" : "customer"}/${partyId}`;

  const exportCols = useMemo(
    () => [
      { key: "voucher_date", label: "Voucher Date" },
      { key: "voucher_no", label: "Voucher No." },
      { key: "particulars", label: "Particulars" },
      { key: "voucher_type", label: "Voucher Type" },
      { key: "debit", label: "Debit" },
      { key: "credit", label: "Credit" },
    ],
    []
  );

  const exportRows = useMemo(
    () =>
      rows.map((row) => ({
        voucher_date: row.voucher_date,
        voucher_no: row.voucher_no,
        particulars: row.particulars,
        voucher_type: row.voucher_type || row.doc_type || "",
        debit: row.debit,
        credit: row.credit,
      })),
    [rows]
  );

  const exportTitle = `Ledger - ${partyName || "Party"} (${formatDisplayDate(fromDate)} to ${formatDisplayDate(toDate)})`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <RecentTransactionsPeriodSelect
          periodId={periodId}
          customRange={customRange}
          onPeriodIdChange={setPeriodId}
          onCustomRangeChange={setCustomRange}
          onRangeApplied={onPeriodRangeApplied}
          className="min-w-[14rem]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <LedgerStatementExportMenu
            disabled={!exportRows.length || loading}
            rows={exportRows}
            columns={exportCols}
            title={exportTitle}
            filename={`ledger-${partyId || "party"}`}
            partyEmail={partyEmail}
          />
          {compact ? (
            <Link
              to={fullLedgerTo}
              state={{ name: partyName }}
              className="text-[13px] font-semibold text-[var(--color-primary)] hover:underline"
            >
              Open full ledger →
            </Link>
          ) : null}
        </div>
      </div>

      <p className="text-[12px] text-[var(--color-text-muted)]">
        Period: {formatDisplayDate(fromDate, "/")} — {formatDisplayDate(toDate, "/")}
      </p>

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="min-w-full border-collapse text-left text-[13px]">
          <thead className="bg-[var(--color-surface-muted)] text-[12px] font-semibold text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Voucher</th>
              <th className="px-3 py-2">Particulars</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[var(--color-text-muted)]">
                  Loading transactions…
                </td>
              </tr>
            ) : displayRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[var(--color-text-muted)]">
                  No transactions in this period
                </td>
              </tr>
            ) : (
              displayRows.map((row) => (
                <tr key={row.id} className="border-t border-[var(--color-border-soft)]">
                  <td className="px-3 py-2">{formatVoucherDate(row.voucher_date)}</td>
                  <td className="px-3 py-2">{row.voucher_no}</td>
                  <td className="px-3 py-2 font-medium">{row.particulars}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(row.debit || 0) > 0 ? Number(row.debit).toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {Number(row.credit || 0) > 0 ? Number(row.credit).toFixed(2) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {compact && rows.length > displayRows.length ? (
        <p className="text-[12px] text-[var(--color-text-muted)]">
          Showing {displayRows.length} of {rows.length} transactions.
        </p>
      ) : null}

    </div>
  );
}
