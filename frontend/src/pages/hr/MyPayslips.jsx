import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getMyPayslips } from "../../api/hrApi";
import "./myPayslips.css";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 5 + i);

function PayslipIllustration() {
  return (
    <div className="hr-my-payslips__illustration" aria-hidden>
      <div className="hr-my-payslips__doc">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export default function MyPayslips() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [selectedYear, setSelectedYear] = useState(2026);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getMyPayslips({ year: selectedYear });
      const rows = res?.data?.items || res?.data || [];
      setRecords(Array.isArray(rows) ? rows : []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader label="Loading payslips..." />;

  const isEmpty = records.length === 0;

  return (
    <ListPageShell>
      <div className="hr-my-payslips min-w-0">
        <div className="hr-my-payslips__header">
          <div className="hr-my-payslips__title-row">
            <button type="button" className="hr-my-payslips__back" onClick={() => navigate("/hr/payroll")} aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="hr-my-payslips__title">My Payslips</h1>
          </div>
          <select
            className="hr-my-payslips__year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {YEAR_OPTIONS.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="hr-my-payslips__card">
          {isEmpty ? (
            <>
              <PayslipIllustration />
              <p className="hr-my-payslips__empty-text">No Records Found</p>
            </>
          ) : (
            <div className="hr-my-payslips__list">
              {records.map((row) => (
                <div key={row.id} className="hr-my-payslips__item">
                  <span>{row.month_label || row.period || "Payslip"}</span>
                  <span>{row.net_pay != null ? `₹ ${Number(row.net_pay).toLocaleString("en-IN")}` : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ListPageShell>
  );
}
