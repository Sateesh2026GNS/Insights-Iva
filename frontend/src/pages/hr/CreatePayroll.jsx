import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createPayroll, getEmployees } from "../../api/hrApi";
import useTenantId from "../../hooks/useTenantId";



import Button from "../../components/common/Button";
export default function CreatePayroll() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    tenant_id: tenantId,
    employee_id: "",
    period_start: "",
    period_end: "",
    regular_hours: "0",
    overtime_hours: "0",
    regular_pay: "0",
    overtime_pay: "0",
    gross_pay: "0",
    deductions: "0",
    net_pay: "0",
    status: "draft",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getEmployees(tenantId).then((r) => setEmployees(r.data || [])).catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createPayroll({
        ...form,
        employee_id: Number(form.employee_id),
        regular_hours: Number(form.regular_hours) || 0,
        overtime_hours: Number(form.overtime_hours) || 0,
        regular_pay: Number(form.regular_pay) || 0,
        overtime_pay: Number(form.overtime_pay) || 0,
        gross_pay: Number(form.gross_pay) || 0,
        deductions: Number(form.deductions) || 0,
        net_pay: Number(form.net_pay) || 0,
      });
      navigate("/hr/payroll");
    } catch (err) {
      setError("Failed to create payroll record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "640px" }}>
      <h2>Create Payroll Record</h2>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
        <label>
          Employee
          <select
            value={form.employee_id}
            onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
            required
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          >
            <option value="">Select</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        </label>
        <label>
          Period Start
          <input
            type="date"
            value={form.period_start}
            onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
            required
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          Period End
          <input
            type="date"
            value={form.period_end}
            onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
            required
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          Regular Hours
          <input
            type="number"
            step="0.5"
            value={form.regular_hours}
            onChange={(e) => setForm((f) => ({ ...f, regular_hours: e.target.value }))}
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          Overtime Hours
          <input
            type="number"
            step="0.5"
            value={form.overtime_hours}
            onChange={(e) => setForm((f) => ({ ...f, overtime_hours: e.target.value }))}
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          Gross Pay ($)
          <input
            type="number"
            step="0.01"
            value={form.gross_pay}
            onChange={(e) => setForm((f) => ({ ...f, gross_pay: e.target.value }))}
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          Deductions ($)
          <input
            type="number"
            step="0.01"
            value={form.deductions}
            onChange={(e) => setForm((f) => ({ ...f, deductions: e.target.value }))}
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          Net Pay ($)
          <input
            type="number"
            step="0.01"
            value={form.net_pay}
            onChange={(e) => setForm((f) => ({ ...f, net_pay: e.target.value }))}
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        {error && <div style={{ color: "#b91c1c" }}>{error}</div>}
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Create Payroll"}
        </Button>
      </form>
    </div>
  );
}