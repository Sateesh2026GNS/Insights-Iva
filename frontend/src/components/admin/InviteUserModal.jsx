import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import Button from "../common/Button";
import {
  adminResetUserPassword,
  createUser,
  getRoles,
  getUsers,
} from "../../api/adminApi";
import { useToast } from "../../context/ToastContext";

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]";

function FieldLabel({ children, required = false }) {
  return (
    <label className="mb-1 block text-sm font-medium text-[var(--color-danger)]">
      {children}
      {required ? <span>*</span> : null}
    </label>
  );
}

function makeTempPassword() {
  const base = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return `${base}Aa1!`;
}

export default function InviteUserModal({
  open,
  onClose,
  onSuccess,
  defaultRole = "",
  title = "Invite User",
}) {
  const { addToast } = useToast();
  const [roles, setRoles] = useState([]);
  const [existingUsers, setExistingUsers] = useState([]);
  const [form, setForm] = useState({ full_name: "", email: "", role_id: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [rolesRes, usersRes] = await Promise.all([getRoles(), getUsers()]);
        if (cancelled) return;
        const roleList = rolesRes.data || [];
        setRoles(roleList);
        setExistingUsers(usersRes.data || []);

        let roleId = "";
        if (defaultRole && roleList.length) {
          const matched = roleList.find((r) =>
            r.name?.toLowerCase().includes(String(defaultRole).toLowerCase())
          );
          if (matched) roleId = String(matched.id);
        }

        setForm({ full_name: "", email: "", role_id: roleId });
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
    if (!form.role_id) next.role_id = "Role is required";
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
        is_active: true,
        role_ids: [Number(form.role_id)],
        password: makeTempPassword(),
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
      addToast("User invited successfully. A password setup link was sent.", "success");
      onSuccess?.(created || payload);
      onClose?.();
    } catch (err) {
      const detail = err.response?.data?.detail;
      addToast(typeof detail === "string" ? detail : "Could not invite user", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose?.()}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-user-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id="invite-user-title" className="text-base font-bold text-slate-900">
            {title}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <div>
            <FieldLabel required>Name</FieldLabel>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, full_name: e.target.value }));
                if (errors.full_name) setErrors((prev) => ({ ...prev, full_name: null }));
              }}
              className={inputClass}
              autoFocus
            />
            {errors.full_name ? <p className="mt-1 text-xs text-rose-600">{errors.full_name}</p> : null}
          </div>

          <div>
            <FieldLabel required>Email Address</FieldLabel>
            <input
              type="email"
              value={form.email}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, email: e.target.value }));
                if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
              }}
              className={inputClass}
            />
            {errors.email ? <p className="mt-1 text-xs text-rose-600">{errors.email}</p> : null}
          </div>

          <div>
            <FieldLabel required>Role</FieldLabel>
            <select
              value={form.role_id}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, role_id: e.target.value }));
                if (errors.role_id) setErrors((prev) => ({ ...prev, role_id: null }));
              }}
              className={inputClass}
            >
              <option value="">Select role…</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
            {errors.role_id ? <p className="mt-1 text-xs text-rose-600">{errors.role_id}</p> : null}
          </div>

          <div className="flex gap-2 border-t border-slate-200 pt-4">
            <Button type="submit" variant="primary" disabled={saving} loading={saving}>
              Save
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
