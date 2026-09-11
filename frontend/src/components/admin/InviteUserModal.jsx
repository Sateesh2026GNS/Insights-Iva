import { useEffect, useState } from "react";

import AdminModal from "./AdminModal";
import Button from "../common/Button";
import { Input } from "../common/FormField";
import {
  adminResetUserPassword,
  createUser,
  getRoles,
  getUsers,
} from "../../api/adminApi";
import { useToast } from "../../context/ToastContext";

function makeTempPassword() {
  const base = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `${base}Aa1!`;
}

const EMPTY_FORM = {
  full_name: "",
  email: "",
  phone: "",
  employee_id: "",
  designation: "",
  department: "",
  plant_code: "",
  assigned_machine_id: "",
  password: "",
  is_active: true,
  role_ids: [],
};

export default function InviteUserModal({
  open,
  onClose,
  onSuccess,
  defaultRole = "",
  title = "New User",
}) {
  const { addToast } = useToast();
  const [roles, setRoles] = useState([]);
  const [existingUsers, setExistingUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [rolesRes, usersRes] = await Promise.all([getRoles(), getUsers()]);
        if (cancelled) return;
        const rawRoles = rolesRes.data || [];
        const seenNames = new Set();
        const roleList = [];
        for (const r of rawRoles) {
          const k = String(r.name || "").trim().toLowerCase();
          if (k && !seenNames.has(k)) {
            seenNames.add(k);
            roleList.push(r);
          }
        }
        setRoles(roleList);
        setExistingUsers(usersRes.data || []);

        let roleIds = [];
        if (defaultRole && roleList.length) {
          const matched = roleList.find((r) =>
            r.name?.toLowerCase().includes(String(defaultRole).toLowerCase())
          );
          if (matched) roleIds = [matched.id];
        }

        setForm({ ...EMPTY_FORM, role_ids: roleIds });
        setErrors({});
      } catch {
        if (!cancelled) setRoles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, defaultRole]);

  const validate = () => {
    const next = {};
    if (!form.full_name.trim()) next.full_name = "Name is required";
    if (!form.email.trim()) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Enter a valid email address";
    } else {
      const dup = existingUsers.find(
        (u) => u.email?.trim().toLowerCase() === form.email.trim().toLowerCase()
      );
      if (dup) next.email = `Email is already in use by ${dup.full_name}`;
    }
    if (form.role_ids.length === 0) next.role_ids = "Select at least one role";
    if (form.password && form.password.length < 6) {
      next.password = "Password must be at least 6 characters";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || saving) return;

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
        assigned_machine_id: form.assigned_machine_id ? parseInt(form.assigned_machine_id, 10) : null,
        is_active: form.is_active,
        role_ids: form.role_ids,
        password: form.password || makeTempPassword(),
      };
      const res = await createUser(payload);
      const created = res.data;
      if (created?.id) {
        try {
          await adminResetUserPassword(created.id);
        } catch {
          // User was created; invite email is best-effort.
        }
      }
      addToast("User created successfully. A password setup link was sent.", "success");
      onSuccess?.(created || payload);
      onClose?.();
    } catch (err) {
      const detail = err.response?.data?.detail;
      addToast(typeof detail === "string" ? detail : "Could not create user", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal title={title} open={open} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Full Name" required value={form.full_name} error={errors.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Jane Doe" autoFocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" required value={form.email} error={errors.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Optional" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Employee ID" value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} placeholder="EMP001" />
          <Input label="Department" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder="Production" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Designation" value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} placeholder="Production Manager" />
          <Input label="Plant Code" value={form.plant_code} onChange={(e) => setForm((f) => ({ ...f, plant_code: e.target.value }))} placeholder="PLANT-01" />
        </div>
        <Input label="Assigned Machine ID" type="number" value={form.assigned_machine_id} onChange={(e) => setForm((f) => ({ ...f, assigned_machine_id: e.target.value }))} placeholder="e.g. 1" />
        <Input label="New Password" type="password" value={form.password} error={errors.password} hint="Leave blank to generate a temporary password and send a setup link." onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••" />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Roles</label>
          {roles.length === 0 ? <p className="text-xs text-slate-400">No roles available. Create roles first.</p> : (
            <div className={`grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto rounded-xl border p-2 sm:grid-cols-2 ${errors.role_ids ? "border-rose-400" : "border-slate-200 dark:border-slate-600"}`}>
              {roles.map((role) => (
                <label key={role.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <input type="checkbox" checked={form.role_ids.includes(role.id)} onChange={() => setForm((f) => ({ ...f, role_ids: f.role_ids.includes(role.id) ? f.role_ids.filter((id) => id !== role.id) : [...f.role_ids, role.id] }))} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                  <span className="text-slate-700 dark:text-slate-300">{role.name}</span>
                </label>
              ))}
            </div>
          )}
          {errors.role_ids ? <p className="mt-1 text-xs text-rose-600">{errors.role_ids}</p> : null}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />Account is active</label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">Cancel</button>
          <Button type="submit" variant="edit" disabled={saving} loading={saving}>{saving ? "Saving…" : "Save User"}</Button>
        </div>
      </form>
    </AdminModal>
  );
}
