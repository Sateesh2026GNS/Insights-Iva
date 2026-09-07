import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getExpenseOverview } from "../../api/hrApi";
import "./expenseOverview.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function EmptyIllustration() {
  return (
    <div className="hr-expense-overview__illustration" aria-hidden>
      <div className="hr-expense-overview__illustration-papers" />
      <div className="hr-expense-overview__illustration-calc" />
      <div className="hr-expense-overview__illustration-coin">₹</div>
      <span className="hr-expense-overview__illustration-dot hr-expense-overview__illustration-dot--blue" />
      <span className="hr-expense-overview__illustration-dot hr-expense-overview__illustration-dot--orange" />
    </div>
  );
}

export default function ExpenseOverview() {
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [hasExpenses, setHasExpenses] = useState(false);

  const periodLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getExpenseOverview({
        month: viewDate.getMonth() + 1,
        year: viewDate.getFullYear(),
      });
      const items = res?.data?.items || res?.data || [];
      setHasExpenses(Array.isArray(items) && items.length > 0);
    } catch {
      setHasExpenses(false);
    } finally {
      setLoading(false);
    }
  }, [viewDate]);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  const shiftMonth = (delta) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  if (loading) return <Loader label="Loading overview..." />;

  return (
    <ListPageShell>
      <div className="hr-expense-overview min-w-0">
        <div className="hr-expense-overview__header">
          <h1 className="hr-expense-overview__title">Overview</h1>
          <div className="hr-expense-overview__period">
            <button type="button" className="hr-expense-overview__nav-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span>{periodLabel}</span>
            <button type="button" className="hr-expense-overview__nav-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <span aria-hidden />
        </div>

        <div className="hr-expense-overview__card">
          {hasExpenses ? (
            <p className="hr-expense-overview__empty-text">Expense data will appear here.</p>
          ) : (
            <>
              <EmptyIllustration />
              <p className="hr-expense-overview__empty-text">No Expenses Found</p>
            </>
          )}
        </div>
      </div>
    </ListPageShell>
  );
}
