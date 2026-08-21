import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createLeaveRequest, getEmployees } from "../../api/hrApi";

import Button from "../../components/common/Button";
const LEAVE_TYPES = ["casual", "sick", "annual", "unpaid"];

export default function CreateLeave() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    employee_id: "",
    leave_type: "casual",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getEmployees().then((r) => setEmployees(r.data || [])).catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.start_date || !form.end_date) {
      setError("Select employee and date range.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createLeaveRequest({
        employee_id: Number(form.employee_id),
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason.trim() || null,
        status: "pending",
      });
      navigate("/hr/leave");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit leave request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "640px" }}>
      <h2>Request Leave</h2>
      {error && (
        <p style={{ color: "#dc2626", marginTop: "12px" }}>{error}</p>
      )}
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
        <label>
          Employee
          <select
            value={form.employee_id}
            onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
            required
            style={{ display: "block", width: "100%", marginTop: "4px", padding: "8px" }}
          >
            <option value="">Select employee</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name} ({emp.employee_code})
              </option>
            ))}
          </select>
        </label>
        <label>
          Leave type
          <select
            value={form.leave_type}
            onChange={(e) => setForm((f) => ({ ...f, leave_type: e.target.value }))}
            style={{ display: "block", width: "100%", marginTop: "4px", padding: "8px" }}
          >
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Start date
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
            required
            style={{ display: "block", width: "100%", marginTop: "4px", padding: "8px" }}
          />
        </label>
        <label>
          End date
          <input
            type="date"
            value={form.end_date}
            onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
            required
            style={{ display: "block", width: "100%", marginTop: "4px", padding: "8px" }}
          />
        </label>
        <label>
          Reason
          <textarea
            rows={3}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            style={{ display: "block", width: "100%", marginTop: "4px", padding: "8px" }}
          />
        </label>
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? "Submitting..." : "Submit Request"}
        </Button>
      </form>
    </div>
  );
}
