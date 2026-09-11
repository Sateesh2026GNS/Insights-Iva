import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, FileText, Search } from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getMyPayslips } from "../../api/hrApi";
import PayrollDetailModal from "../../components/hr/PayrollDetailModal";
import "./myPayslips.css";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 5 + i);

function formatInr(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [search, setSearch] = useState("");

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

  const filteredRecords = records.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.employee_name || "").toLowerCase().includes(q) ||
      (r.employee_code || "").toLowerCase().includes(q) ||
      (r.month_label || "").toLowerCase().includes(q) ||
      (r.department || "").toLowerCase().includes(q)
    );
  });

  const isEmpty = filteredRecords.length === 0;

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
          <div className="flex items-center gap-3">
            {records.length > 0 ? (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter payslips..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>
            ) : null}
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
        </div>

        <div className="hr-my-payslips__card !items-stretch !p-6">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-16">
              <PayslipIllustration />
              <p className="hr-my-payslips__empty-text">No Records Found</p>
              <p className="mt-1 text-xs text-slate-400">
                Payslips will appear here once salary is generated for {selectedYear}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecords.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{row.month_label || "Payslip"}</div>
                          <div className="text-xs text-slate-500">
                            {row.period_start && row.period_end ? `${row.period_start} to ${row.period_end}` : "Disbursed"}
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Generated
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{row.employee_name || "Employee"}</span>
                      {row.employee_code ? <span className="text-slate-400"> ({row.employee_code})</span> : null}
                      {row.department ? <div className="text-[11px] text-slate-400">{row.department} · {row.designation || "Staff"}</div> : null}
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 p-3 space-y-1 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>Gross Salary:</span>
                        <span className="font-medium text-slate-700">{formatInr(row.gross_pay)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Deductions:</span>
                        <span className="font-medium text-rose-600">-{formatInr(row.deductions)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900">
                        <span>Net Payable:</span>
                        <span className="text-emerald-600 font-bold">{formatInr(row.net_pay)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedSlip(row)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Payslip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedSlip ? (
          <PayrollDetailModal
            record={selectedSlip}
            onClose={() => setSelectedSlip(null)}
          />
        ) : null}
      </div>
    </ListPageShell>
  );
}
