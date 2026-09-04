import { useEffect, useState } from "react";
import AdminModal from "./AdminModal";
import { Input } from "../common/FormField";
import Button from "../common/Button";
import { createUser, getRoles, getUsers } from "../../api/adminApi";
import { useToast } from "../../context/ToastContext";

const EMPTY_FORM = {
  full_name: "",
  email: "",
  phone: "",
  employee_id: "",
  designation: "Operator",
  department: "Production",
  plant_code: "",
  assigned_machine_id: "",
  password: "",
  is_active: true,
  role_ids: [],
};

export default function AddUserModal({
  open,
  onClose,
  onSuccess,
  defaultRole = "Operator",
  defaultDept = "Production",
  defaultDesignation = "Operator",
  title = "Add User",
  subtitle = "Create a new user account and assign roles.",
}) {
  const { addToast } = useToast();
  const [roles, setRoles] = useState([]);
  const [existingUsers, setExistingUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    (async () => {
      try {
        const [rolesRes, usersRes] = await Promise.all([getRoles(), getUsers()]);
        if (!isMounted) return;
        const rList = rolesRes.data || [];
        setRoles(rList);
        setExistingUsers(usersRes.data || []);

        let defRoleIds = [];
        if (defaultRole && rList.length > 0) {
          const matched = rList.find((r) =>
            r.name?.toLowerCase().includes(defaultRole.toLowerCase())
          );
          if (matched) defRoleIds = [matched.id];
        }

        setForm({
          ...EMPTY_FORM,
          department: defaultDept || "Production",
          designation: defaultDesignation || "Operator",
          role_ids: defRoleIds,
        });
        setErrors({});
      } catch {
        // Handled silently
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [open, defaultRole, defaultDept, defaultDesignation]);

  const toggleRole = (id) => {
    setForm((f) => ({
      ...f,
      role_ids: f.role_ids.includes(id)
        ? f.role_ids.filter((x) => x !== id)
        : [...f.role_ids, id],
    }));
  };

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = "Name is required";
    if (!form.email.trim()) {
      e.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      e.email = "Enter a valid email";
    } else {
      const emailDup = existingUsers.find(
        (u) => u.email && u.email.trim().toLowerCase() === form.email.trim().toLowerCase()
      );
      if (emailDup) e.email = `Email is already in use by ${emailDup.full_name}`;
    }

    if (form.employee_id?.trim()) {
      const empIdTrim = form.employee_id.trim().toLowerCase();
      const empDup = existingUsers.find(
        (u) => u.employee_id && u.employee_id.trim().toLowerCase() === empIdTrim
      );
      if (empDup) {
        e.employee_id = `Employee ID '${form.employee_id.trim()}' is already assigned to ${empDup.full_name}`;
      }
    }

    if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        employee_id: form.employee_id.trim() || null,
        designation: form.designation.trim() || null,
        department: form.department.trim() || null,
        plant_code: form.plant_code.trim() || null,
        assigned_machine_id: form.assigned_machine_id
          ? parseInt(form.assigned_machine_id, 10)
          : null,
        is_active: form.is_active,
        role_ids: form.role_ids,
        password: form.password,
      };
      const res = await createUser(payload);
      addToast("User created successfully", "success");
      onSuccess?.(res.data || payload);
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      addToast(typeof detail === "string" ? detail : "Could not save user", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal title={title} subtitle={subtitle} open={open} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          required
          value={form.full_name}
          error={errors.full_name}
          onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          placeholder="e.g. John Doe"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            error={errors.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="john@company.com"
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="Optional"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Employee ID"
            value={form.employee_id}
            error={errors.employee_id}
            onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
            placeholder="EMP001"
          />
          <Input
            label="Department"
            value={form.department}
            onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            placeholder="Production"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Designation"
            value={form.designation}
            onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
            placeholder="Operator"
          />
          <Input
            label="Plant Code"
            value={form.plant_code}
            onChange={(e) => setForm((f) => ({ ...f, plant_code: e.target.value }))}
            placeholder="PLANT-01"
          />
        </div>
        <Input
          label="Assigned Machine ID"
          type="number"
          value={form.assigned_machine_id}
          onChange={(e) => setForm((f) => ({ ...f, assigned_machine_id: e.target.value }))}
          placeholder="e.g. 1"
        />
        <Input
          label="Password"
          type="password"
          required
          value={form.password}
          error={errors.password}
          hint="Minimum 6 characters."
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          placeholder="••••••"
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Roles
          </label>
          {roles.length === 0 ? (
            <p className="text-xs text-slate-400">Loading roles…</p>
          ) : (
            <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-600 sm:grid-cols-2">
              {roles.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <input
                    type="checkbox"
                    checked={form.role_ids.includes(r.id)}
                    onChange={() => toggleRole(r.id)}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300">{r.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Account is active
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="cancel" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={saving}>
            Create User
          </Button>
        </div>
      </form>
    </AdminModal>
  );
}
