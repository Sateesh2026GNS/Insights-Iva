import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { generatePayroll, getPayrollRunStatus } from "../../api/hrApi";
import PayrollDetailModal from "../../components/hr/PayrollDetailModal";
import "./runPayroll.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR - 5 + i);

function formatInr(val) {
  const n = Number(val) || 0;
  return `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
  const [payrollData, setPayrollData] = useState(null);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getPayrollRunStatus({
        month: selectedMonth + 1,
        year: selectedYear,
      });
      const generated = Boolean(res?.data?.generated);
      setHasGenerated(generated);
      setPayrollData(res?.data || null);
    } catch {
      setHasGenerated(false);
      setPayrollData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  usePageRefresh(() => load(true));
  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    const payload = {
      month: selectedMonth + 1,
      year: selectedYear,
      period_key: `${selectedYear}-${selectedMonth + 1}`,
    };

    try {
      await generatePayroll(payload);
      addToast("Salary generated successfully", "success");
      await load(true);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Failed to generate salary";
      addToast(msg, "error");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <Loader label="Loading payroll..." />;

  const payslips = payrollData?.payslips || [];
  const filteredPayslips = payslips.filter((p) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (p.employee_name || "").toLowerCase().includes(q) ||
      (p.employee_code || "").toLowerCase().includes(q) ||
      (p.department || "").toLowerCase().includes(q)
    );
  });

  const totalGross = payrollData?.total_gross || 0;
  const totalNet = payrollData?.total_net || 0;
  const totalDeductions = Math.max(0, totalGross - totalNet);
  const employeeCount = payrollData?.employee_count || payslips.length || 0;

  return (
    <ListPageShell>
      <div className="hr-run-payroll min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h1 className="hr-run-payroll__title !mb-0">Run Payroll</h1>
          <div className="flex items-center gap-2">
            <Link
              to="/hr/payroll/salary-breakup"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              Salary Breakup
            </Link>
            <Link
              to="/hr/payroll/on-hold"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              Salary On Hold
            </Link>
            <Link
              to="/hr/payroll/my-payslips"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              My Payslips
            </Link>
          </div>
        </div>

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
            {generating ? "Processing..." : hasGenerated ? "Re-run Payroll" : "Generate Salary"}
          </button>
        </div>

        {hasGenerated ? (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Processed Staff</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{employeeCount}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Eligible employees processed</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Gross Salary</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{formatInr(totalGross)}</div>
                <div className="mt-1 text-xs text-slate-500">Total earnings before deductions</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Deductions</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold text-rose-600">-{formatInr(totalDeductions)}</div>
                <div className="mt-1 text-xs text-slate-500">PF, ESIC, and statutory cuts</div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net Disbursed</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <Wallet className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-600">{formatInr(totalNet)}</div>
                <div className="mt-1 text-xs text-slate-500">Total net payable to personnel</div>
              </div>
            </div>

            {/* Generated Payslips Table */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Payslips for {MONTHS[selectedMonth]} {selectedYear}
                  </h3>
                  <p className="text-xs text-slate-500">
                    List of employee payslips calculated and generated for this pay period.
                  </p>
                </div>
                <div className="relative min-w-[240px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, code, dept..."
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/75 text-xs font-semibold text-slate-600">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3 text-right">Gross Pay</th>
                      <th className="px-4 py-3 text-right">Deductions</th>
                      <th className="px-4 py-3 text-right">Net Payable</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredPayslips.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          No payslip records match the search.
                        </td>
                      </tr>
                    ) : (
                      filteredPayslips.map((slip) => (
                        <tr key={slip.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{slip.employee_name || "Employee"}</div>
                            <div className="text-xs text-slate-500">{slip.employee_code || "EMP"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-medium text-slate-700">{slip.department || "General"}</div>
                            <div className="text-[11px] text-slate-400">{slip.designation || "Staff"}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {formatInr(slip.gross_pay)}
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600">
                            -{formatInr(slip.deductions)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">
                            {formatInr(slip.net_pay)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              Generated
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedSlip(slip)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                            >
                              <Eye className="h-3.5 w-3.5 text-slate-500" />
                              View Payslip
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="hr-run-payroll__card">
            <PayrollIllustration />
            <p className="hr-run-payroll__empty-text">Get Started with Your Payroll</p>
            <p className="mt-1.5 text-xs text-slate-400 max-w-sm">
              Click &quot;Generate Salary&quot; to calculate earnings, allowances, and statutory deductions for {MONTHS[selectedMonth]} {selectedYear}.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Wallet className="h-4 w-4" />
                {generating ? "Processing..." : "Generate Salary"}
              </button>
              <Link
                to="/hr/payroll/salary-breakup"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                Configure Salary Breakup
              </Link>
            </div>
          </div>
        )}

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
