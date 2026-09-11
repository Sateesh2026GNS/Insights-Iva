import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, User } from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import { useToast } from "../../context/ToastContext";
import { createSalaryBreakup, getEmployees, getSalaryBreakups, updateSalaryBreakup } from "../../api/hrApi";
import "./createSalaryBreakup.css";

const DEFAULT_EMPLOYEE_OPTIONS = [
  { value: "demo-satish", label: "Satish Gogulothu", department: "HR" },
];

const DEFAULT_COMPONENTS = {
  basic: { calc_type: "percentage_of_gross", value: 50, monthly: 0, annual: 0 },
  da: { calc_type: "flat_amount", value: 0, monthly: 0, annual: 0 },
  hra: { calc_type: "percentage_of_basic", value: 40, monthly: 0, annual: 0 },
  other: { calc_type: "flat_amount", value: 0, monthly: 0, annual: 0 },
};

function formatInr(value) {
  const n = Number(value) || 0;
  return `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function computeBreakup(gross, components) {
  const grossNum = Number(gross) || 0;
  const next = { ...components };

  const basicPct = Number(next.basic.value) || 0;
  const basicMonthly = (grossNum * basicPct) / 100;
  next.basic = { ...next.basic, monthly: basicMonthly, annual: basicMonthly * 12 };

  const daMonthly = Number(next.da.value) || 0;
  next.da = { ...next.da, monthly: daMonthly, annual: daMonthly * 12 };

  const hraPct = Number(next.hra.value) || 0;
  const hraMonthly = (basicMonthly * hraPct) / 100;
  next.hra = { ...next.hra, monthly: hraMonthly, annual: hraMonthly * 12 };

  const otherMonthly = Math.max(0, grossNum - basicMonthly - daMonthly - hraMonthly);
  next.other = { ...next.other, monthly: otherMonthly, annual: otherMonthly * 12 };

  const grossMonthly = basicMonthly + daMonthly + hraMonthly + otherMonthly;
  const totalDeduction = 0;
  const netMonthly = grossMonthly - totalDeduction;

  return {
    components: next,
    grossMonthly,
    grossAnnual: grossMonthly * 12,
    totalDeduction,
    totalDeductionAnnual: totalDeduction * 12,
    netMonthly,
    netAnnual: netMonthly * 12,
  };
}

export default function CreateSalaryBreakup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [employeeOptions, setEmployeeOptions] = useState(DEFAULT_EMPLOYEE_OPTIONS);
  const [employeeId, setEmployeeId] = useState("");
  const [grossAmount, setGrossAmount] = useState("0");
  const [components, setComponents] = useState(DEFAULT_COMPONENTS);
  const [totals, setTotals] = useState({
    grossMonthly: 0,
    grossAnnual: 0,
    totalDeduction: 0,
    totalDeductionAnnual: 0,
    netMonthly: 0,
    netAnnual: 0,
  });

  const employee = useMemo(() => {
    return employeeOptions.find((e) => String(e.value) === String(employeeId)) || employeeOptions[0] || {};
  }, [employeeOptions, employeeId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, breakupRes] = await Promise.allSettled([
        getEmployees(),
        getSalaryBreakups(),
      ]);

      let empOpts = DEFAULT_EMPLOYEE_OPTIONS;
      if (empRes.status === "fulfilled") {
        const rows = empRes.value?.data?.items || empRes.value?.data || [];
        if (Array.isArray(rows) && rows.length > 0) {
          empOpts = rows.map((e) => ({
            value: String(e.id),
            label: e.full_name,
            department: e.department || "Staff",
            salary: e.salary,
          }));
        }
      }
      setEmployeeOptions(empOpts);

      if (editId && breakupRes.status === "fulfilled") {
        const rows = breakupRes.value?.data?.items || breakupRes.value?.data || [];
        const found = (Array.isArray(rows) ? rows : []).find((r) => String(r.id) === String(editId));
        if (found) {
          setEmployeeId(String(found.employee_id || empOpts[0]?.value || ""));
          setGrossAmount(String(found.gross_amount ?? 0));
          setComponents(found.components || DEFAULT_COMPONENTS);
          setTotals({
            grossMonthly: found.gross_monthly ?? 0,
            grossAnnual: found.gross_annual ?? 0,
            totalDeduction: found.total_deduction ?? 0,
            totalDeductionAnnual: found.total_deduction_annual ?? 0,
            netMonthly: found.net_monthly ?? 0,
            netAnnual: found.net_annual ?? 0,
          });
          return;
        }
      }

      if (!editId && empOpts.length > 0) {
        const first = empOpts[0];
        setEmployeeId(String(first.value));
        const initialGross = String(first.salary || 35000);
        setGrossAmount(initialGross);
        const calculated = computeBreakup(initialGross, DEFAULT_COMPONENTS);
        setComponents(calculated.components);
        setTotals({
          grossMonthly: calculated.grossMonthly,
          grossAnnual: calculated.grossAnnual,
          totalDeduction: calculated.totalDeduction,
          totalDeductionAnnual: calculated.totalDeductionAnnual,
          netMonthly: calculated.netMonthly,
          netAnnual: calculated.netAnnual,
        });
      }
    } catch {
      addToast("Failed to load initial data", "error");
    } finally {
      setLoading(false);
    }
  }, [editId, addToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCalculate = () => {
    const result = computeBreakup(grossAmount, components);
    setComponents(result.components);
    setTotals({
      grossMonthly: result.grossMonthly,
      grossAnnual: result.grossAnnual,
      totalDeduction: result.totalDeduction,
      totalDeductionAnnual: result.totalDeductionAnnual,
      netMonthly: result.netMonthly,
      netAnnual: result.netAnnual,
    });
  };

  const handleReset = () => {
    setGrossAmount("0");
    setComponents(DEFAULT_COMPONENTS);
    setTotals({
      grossMonthly: 0,
      grossAnnual: 0,
      totalDeduction: 0,
      totalDeductionAnnual: 0,
      netMonthly: 0,
      netAnnual: 0,
    });
  };

  const updateComponent = (key, patch) => {
    setComponents((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  const handleSave = async () => {
    const payload = {
      id: editId || `breakup-${Date.now()}`,
      name: employee.label,
      employee_id: employeeId,
      employee_name: employee.label,
      department: employee.department,
      gross_amount: Number(grossAmount) || 0,
      components,
      gross_monthly: totals.grossMonthly,
      gross_annual: totals.grossAnnual,
      total_deduction: totals.totalDeduction,
      total_deduction_annual: totals.totalDeductionAnnual,
      net_monthly: totals.netMonthly,
      net_annual: totals.netAnnual,
      effective_from: new Date().toISOString().slice(0, 10),
      created_by: editId ? undefined : "Admin",
      updated_by: "Admin",
    };

    try {
      if (editId) await updateSalaryBreakup(editId, payload);
      else await createSalaryBreakup(payload);
      addToast("Salary breakup saved", "success");
      navigate("/hr/payroll/salary-breakup");
    } catch {
      addToast("Failed to save salary breakup", "error");
    }
  };

  const annualCtc = useMemo(() => totals.grossAnnual, [totals.grossAnnual]);

  if (loading) return <Loader label="Loading salary breakup..." />;

  return (
    <ListPageShell>
      <div className="hr-create-salary-breakup min-w-0">
        <div className="hr-create-salary-breakup__header">
          <button type="button" className="hr-create-salary-breakup__back" onClick={() => navigate("/hr/payroll/salary-breakup")} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="hr-create-salary-breakup__title">Salary Breakup</h1>
        </div>

        <div className="hr-create-salary-breakup__layout">
          <div className="hr-create-salary-breakup__main">
            <div className="hr-create-salary-breakup__inputs">
              <div className="hr-create-salary-breakup__field">
                <label className="hr-create-salary-breakup__label">Employee Name <span>*</span></label>
                <select
                  className="hr-create-salary-breakup__select"
                  value={employeeId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setEmployeeId(newId);
                    const found = employeeOptions.find((o) => String(o.value) === String(newId));
                    if (found && found.salary) {
                      setGrossAmount(String(found.salary));
                      const calc = computeBreakup(found.salary, components);
                      setComponents(calc.components);
                      setTotals({
                        grossMonthly: calc.grossMonthly,
                        grossAnnual: calc.grossAnnual,
                        totalDeduction: calc.totalDeduction,
                        totalDeductionAnnual: calc.totalDeductionAnnual,
                        netMonthly: calc.netMonthly,
                        netAnnual: calc.netAnnual,
                      });
                    }
                  }}
                >
                  {employeeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label} ({o.department})</option>
                  ))}
                </select>
              </div>
              <div className="hr-create-salary-breakup__field">
                <label className="hr-create-salary-breakup__label">Gross Amount <span>*</span></label>
                <div className="hr-create-salary-breakup__amount-wrap">
                  <span className="hr-create-salary-breakup__amount-prefix">₹</span>
                  <input
                    className="hr-create-salary-breakup__input"
                    type="number"
                    min="0"
                    value={grossAmount}
                    onChange={(e) => setGrossAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="hr-create-salary-breakup__input-actions">
                <button type="button" className="hr-create-salary-breakup__reset-btn" onClick={handleReset}>Reset</button>
                <button type="button" className="hr-create-salary-breakup__calc-btn" onClick={handleCalculate}>Calculate</button>
              </div>
            </div>

            <div className="hr-create-salary-breakup__table-wrap">
              <table className="hr-create-salary-breakup__table">
                <thead>
                  <tr>
                    <th>Salary Components</th>
                    <th>Calculation Type</th>
                    <th>Monthly Pay</th>
                    <th>Annual Pay</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hr-create-salary-breakup__section-row">
                    <td colSpan={4}>Part A</td>
                  </tr>
                  <tr>
                    <td>Basic</td>
                    <td>
                      <div className="hr-create-salary-breakup__calc-cell">
                        <select
                          className="hr-create-salary-breakup__calc-select"
                          value={components.basic.calc_type}
                          onChange={(e) => updateComponent("basic", { calc_type: e.target.value })}
                        >
                          <option value="percentage_of_gross">% of Gross</option>
                          <option value="flat_amount">Flat Amount</option>
                        </select>
                        <input
                          className="hr-create-salary-breakup__calc-input"
                          type="number"
                          min="0"
                          value={components.basic.value}
                          onChange={(e) => updateComponent("basic", { value: e.target.value })}
                        />
                      </div>
                    </td>
                    <td>{formatInr(components.basic.monthly)}</td>
                    <td>{formatInr(components.basic.annual)}</td>
                  </tr>
                  <tr>
                    <td>DA</td>
                    <td>
                      <div className="hr-create-salary-breakup__calc-cell hr-create-salary-breakup__calc-cell--amount">
                        <span className="hr-create-salary-breakup__calc-prefix">₹</span>
                        <input
                          className="hr-create-salary-breakup__calc-input"
                          type="number"
                          min="0"
                          value={components.da.value}
                          onChange={(e) => updateComponent("da", { value: e.target.value })}
                        />
                      </div>
                    </td>
                    <td>{formatInr(components.da.monthly)}</td>
                    <td>{formatInr(components.da.annual)}</td>
                  </tr>
                  <tr>
                    <td>HRA</td>
                    <td>
                      <div className="hr-create-salary-breakup__calc-cell">
                        <select
                          className="hr-create-salary-breakup__calc-select"
                          value={components.hra.calc_type}
                          onChange={(e) => updateComponent("hra", { calc_type: e.target.value })}
                        >
                          <option value="percentage_of_basic">% of Basic</option>
                          <option value="flat_amount">Flat Amount</option>
                        </select>
                        <input
                          className="hr-create-salary-breakup__calc-input"
                          type="number"
                          min="0"
                          value={components.hra.value}
                          onChange={(e) => updateComponent("hra", { value: e.target.value })}
                        />
                      </div>
                    </td>
                    <td>{formatInr(components.hra.monthly)}</td>
                    <td>{formatInr(components.hra.annual)}</td>
                  </tr>
                  <tr>
                    <td>Other Allowance</td>
                    <td />
                    <td>{formatInr(components.other.monthly)}</td>
                    <td>{formatInr(components.other.annual)}</td>
                  </tr>
                  <tr className="hr-create-salary-breakup__highlight-row">
                    <td>Gross Pay</td>
                    <td />
                    <td>{formatInr(totals.grossMonthly)}</td>
                    <td>{formatInr(totals.grossAnnual)}</td>
                  </tr>
                  <tr className="hr-create-salary-breakup__section-row">
                    <td colSpan={4}>Part B</td>
                  </tr>
                  <tr className="hr-create-salary-breakup__highlight-row">
                    <td>Total Deduction</td>
                    <td />
                    <td>{formatInr(totals.totalDeduction)}</td>
                    <td>{formatInr(totals.totalDeductionAnnual)}</td>
                  </tr>
                  <tr className="hr-create-salary-breakup__highlight-row">
                    <td>Net Pay (Gross Pay - Total Deduction)</td>
                    <td />
                    <td>{formatInr(totals.netMonthly)}</td>
                    <td>{formatInr(totals.netAnnual)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="hr-create-salary-breakup__footer">
              <button type="button" className="hr-create-salary-breakup__cancel-btn" onClick={() => navigate("/hr/payroll/salary-breakup")}>
                Cancel
              </button>
              <button type="button" className="hr-create-salary-breakup__save-btn" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>

          <aside className="hr-create-salary-breakup__summary">
            <div className="hr-create-salary-breakup__summary-head">Salary Summary</div>
            <div className="hr-create-salary-breakup__summary-user">
              <div className="hr-create-salary-breakup__avatar">
                <User className="h-5 w-5" />
              </div>
              <span>{employee.label}</span>
            </div>
            <div className="hr-create-salary-breakup__summary-metrics">
              <div className="hr-create-salary-breakup__metric">
                <div className="hr-create-salary-breakup__metric-icon hr-create-salary-breakup__metric-icon--blue">₹</div>
                <div>
                  <div className="hr-create-salary-breakup__metric-label">Annual CTC</div>
                  <div className="hr-create-salary-breakup__metric-value">{annualCtc.toLocaleString("en-IN")}</div>
                </div>
              </div>
              <div className="hr-create-salary-breakup__metric">
                <div className="hr-create-salary-breakup__metric-icon hr-create-salary-breakup__metric-icon--orange">₹</div>
                <div>
                  <div className="hr-create-salary-breakup__metric-label">Net Pay</div>
                  <div className="hr-create-salary-breakup__metric-value">{totals.netAnnual.toLocaleString("en-IN")}</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </ListPageShell>
  );
}
