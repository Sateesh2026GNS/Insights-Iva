import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin } from "lucide-react";

import PageHeader from "../../components/common/PageHeader";
import EmployeeAddressModal from "../../components/hr/EmployeeAddressModal";
import { createEmployee } from "../../api/hrApi";
import useTenantId from "../../hooks/useTenantId";

import Button from "../../components/common/Button";
const inputClass = "ui-input mt-1.5";

export default function CreateEmployee() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    tenant_id: tenantId,
    employee_code: "",
    full_name: "",
    email: "",
    department: "",
    address: "",
    hire_date: "",
    hourly_rate: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addressOpen, setAddressOpen] = useState(false);

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createEmployee({
        ...form,
        tenant_id: tenantId,
        employee_code: form.employee_code.trim(),
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        department: form.department.trim() || null,
        address: form.address.trim() || null,
        hire_date: form.hire_date || null,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
      });
      navigate("/hr/employees");
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.message;
      setError(
        typeof detail === "string"
          ? detail
          : "Failed to create employee. Please check the form and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Link
        to="/hr/employees"
        className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-[var(--color-success)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to employees
      </Link>

      <PageHeader
        title="Create Employee"
        subtitle="Add a new employee record for your organization."
      />

      <form onSubmit={handleSubmit} className="ui-card space-y-5 p-6 sm:p-8">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700 sm:col-span-1">
            Employee Code <span className="text-red-500">*</span>
            <input
              type="text"
              value={form.employee_code}
              onChange={setField("employee_code")}
              placeholder="e.g. EMP-001"
              required
              autoComplete="off"
              className={inputClass}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 sm:col-span-1">
            Full Name (As per Aadhar) <span className="text-red-500">*</span>
            <input
              type="text"
              value={form.full_name}
              onChange={setField("full_name")}
              placeholder="e.g. Priya Sharma"
              required
              autoComplete="name"
              className={inputClass}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Email
            <input
              type="email"
              value={form.email}
              onChange={setField("email")}
              placeholder="name@company.com"
              autoComplete="email"
              className={inputClass}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Department
            <select
              value={form.department}
              onChange={setField("department")}
              className={inputClass}
            >
              <option value="">Select Department</option>
              <option value="Production">Production</option>
              <option value="HR">HR</option>
              <option value="Sales">Sales</option>
              <option value="Accountant">Accountant</option>
              <option value="Store Manager">Store Manager</option>
              <option value="Operator">Operator</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Hire Date
            <input
              type="date"
              value={form.hire_date}
              onChange={setField("hire_date")}
              className={inputClass}
            />
          </label>

          <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">Address</p>
                <p className="text-xs text-slate-500">Add the employee’s complete address in a dedicated form.</p>
              </div>
              <button
                type="button"
                onClick={() => setAddressOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#2563EB] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-blue-50"
              >
                <MapPin className="h-4 w-4" />
                {form.address ? "Edit Address" : "Add Address"}
              </button>
            </div>
            {form.address ? (
              <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                {form.address}
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No address added yet.</p>
            )}
          </div>

          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Hourly Rate (₹)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.hourly_rate}
              onChange={setField("hourly_rate")}
              placeholder="0.00"
              className={inputClass}
            />
          </label>
        </div>

        <EmployeeAddressModal
          open={addressOpen}
          onClose={() => setAddressOpen(false)}
          value={form.address}
          onSave={(value) => setForm((f) => ({ ...f, address: value }))}
        />

        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create Employee"}
          </Button>
          <Button variant="secondary" to="/hr/employees">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
