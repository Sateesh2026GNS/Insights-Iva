import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { createShift } from "../../api/hrApi";
import useTenantId from "../../hooks/useTenantId";



import Button from "../../components/common/Button";
export default function CreateShift() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    tenant_id: tenantId,
    name: "",
    start_time: "08:00",
    end_time: "16:00",
    break_minutes: "60",
    capacity_hours: "8",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createShift({
        ...form,
        break_minutes: Number(form.break_minutes) || 0,
        capacity_hours: Number(form.capacity_hours) || 8,
      });
      navigate("/hr/shifts");
    } catch (err) {
      setError("Failed to create shift.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "480px" }}>
      <h2>Create Shift</h2>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
        <label>
          Name
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          Start Time
          <input
            type="time"
            value={form.start_time}
            onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          End Time
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          Break (minutes)
          <input
            type="number"
            value={form.break_minutes}
            onChange={(e) => setForm((f) => ({ ...f, break_minutes: e.target.value }))}
            min="0"
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        <label>
          Capacity (hours)
          <input
            type="number"
            step="0.5"
            value={form.capacity_hours}
            onChange={(e) => setForm((f) => ({ ...f, capacity_hours: e.target.value }))}
            style={{ width: "100%", padding: "8px", marginTop: "6px" }}
          />
        </label>
        {error && <div style={{ color: "#b91c1c" }}>{error}</div>}
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Create Shift"}
        </Button>
      </form>
    </div>
  );
}