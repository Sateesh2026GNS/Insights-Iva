import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createPerformanceReview, getEmployees } from "../../api/hrApi";
import useTenantId from "../../hooks/useTenantId";



import Button from "../../components/common/Button";
export default function CreatePerformance() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    tenant_id: tenantId,
    employee_id: "",
    review_period: "",
    rating: "",
    productivity_score: "",
    goals_achieved: "",
    goals_total: "",
    notes: "",
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
      await createPerformanceReview({
        ...form,
        employee_id: Number(form.employee_id),
        rating: form.rating ? Number(form.rating) : null,
        productivity_score: form.productivity_score ? Number(form.productivity_score) : null,
        goals_achieved: form.goals_achieved ? Number(form.goals_achieved) : null,
        goals_total: form.goals_total ? Number(form.goals_total) : null,
      });
      navigate("/hr/performance");
    } catch (err) {
      setError("Failed to create performance review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "640px" }}>
      <h2>Create Performance Review</h2>
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
          Review Period (e.g. Q1 2024)
          <input
            type="text"
            value={form.review_period}
            onChange={(e) => setForm((f) => ({ ...f, review_period: e.target.value }))}
            required
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          Rating (1-5)
          <input
            type="number"
            min="1"
            max="5"
            value={form.rating}
            onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          Productivity Score (0-100)
          <input
            type="number"
            min="0"
            max="100"
            value={form.productivity_score}
            onChange={(e) => setForm((f) => ({ ...f, productivity_score: e.target.value }))}
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          Goals Achieved
          <input
            type="number"
            value={form.goals_achieved}
            onChange={(e) => setForm((f) => ({ ...f, goals_achieved: e.target.value }))}
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          Goals Total
          <input
            type="number"
            value={form.goals_total}
            onChange={(e) => setForm((f) => ({ ...f, goals_total: e.target.value }))}
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          Notes
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        {error && <div style={{ color: "#b91c1c" }}>{error}</div>}
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Create Review"}
        </Button>
      </form>
    </div>
  );
}