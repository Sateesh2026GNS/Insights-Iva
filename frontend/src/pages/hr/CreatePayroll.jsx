import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { generatePayroll, getPayrollRunStatus, getSalaryBreakups } from "../../api/hrApi";
import "./runPayroll.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 5 + i);

function PayrollIllustration() {
  return (
    <div className="hr-run-payroll__illustration" aria-hidden>
      <div className="hr-run-payroll__illustration-circle">
        <div className="hr-run-payroll__illustration-docs">
          <span />
          <span />
          <span />
        </div>
        <div className="hr-run-payroll__illustration-search">
          <Search className="h-6 w-6" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

export default function CreatePayroll() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getPayrollRunStatus({
        month: selectedMonth + 1,
        year: selectedYear,
      });
      const generated = Boolean(res?.data?.generated);
      setHasGenerated(generated);
    } catch {
      setHasGenerated(false);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    let breakups = [];
    try {
      const res = await getSalaryBreakups();
      const rows = res?.data?.items || res?.data || [];
      breakups = Array.isArray(rows) ? rows : [];
    } catch {
      addToast("Failed to verify salary breakups", "error");
      return;
    }

    if (!breakups.length) {
      addToast("Please define the salary breakup to process the salary.", "error");
      return;
    }

    setGenerating(true);
    const payload = {
      month: selectedMonth + 1,
      year: selectedYear,
      period_key: `${selectedYear}-${selectedMonth + 1}`,
    };

    try {
      await generatePayroll(payload);
      setHasGenerated(true);
      addToast("Salary generated successfully", "success");
    } catch {
      addToast("Failed to generate salary", "error");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <Loader label="Loading payroll..." />;

  return (
    <ListPageShell>
      <div className="hr-run-payroll min-w-0">
        <h1 className="hr-run-payroll__title">Run Payroll</h1>

        <div className="hr-run-payroll__toolbar">
          <div className="hr-run-payroll__months">
            {MONTHS.map((label, index) => (
              <button
                key={label}
                type="button"
                className={`hr-run-payroll__month ${selectedMonth === index ? "hr-run-payroll__month--active" : ""}`}
                onClick={() => setSelectedMonth(index)}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            className="hr-run-payroll__year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {YEAR_OPTIONS.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button
            type="button"
            className="hr-run-payroll__generate-btn"
            disabled={generating}
            onClick={handleGenerate}
          >
            Generate Salary
          </button>
        </div>

        <div className="hr-run-payroll__card">
          {hasGenerated ? (
            <p className="hr-run-payroll__empty-text">
              Payroll generated for {MONTHS[selectedMonth]} {selectedYear}.
            </p>
          ) : (
            <>
              <PayrollIllustration />
              <p className="hr-run-payroll__empty-text">Get Started with Your Payroll</p>
            </>
          )}
        </div>
      </div>
    </ListPageShell>
  );
}
