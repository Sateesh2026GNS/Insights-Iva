import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, ShieldCheck, UserCog, KeyRound } from "lucide-react";

import PageHeader from "../../components/common/PageHeader";
import DataTable from "../../components/common/DataTable";
import KpiCard from "../../components/common/KpiCard";
import { Input } from "../../components/common/FormField";
import AdminModal from "../../components/admin/AdminModal";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import AccessDenied from "../../components/admin/AccessDenied";
import usePermissions from "../../hooks/usePermissions";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import Button from "../../components/common/Button";
import {
  getUsers,
  getRoles,
  createUser,
  updateUser,
  deleteUser,
  adminResetUserPassword,
} from "../../api/adminApi";

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

function StatusBadge({ active }) {
  return (
    <span className={`ui-badge ${active ? "ui-badge--success" : "ui-badge--neutral"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--color-success)]" : "bg-[var(--color-text-faint)]"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function UserManagement() {
  const { isAdmin, user: currentUser } = usePermissions();
  const { addToast } = useToast();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [resettingId, setResettingId] = useState(null);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialOpenedRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [u, r] = await Promise.all([getUsers(), getRoles()]);
      setUsers(u.data || []);
      setRoles(r.data || []);
    } catch (err) {
      if (!isRefresh) addToast("Failed to load users", "error");
      if (isRefresh) throw err;
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  useEffect(() => {
    if (!loading && !initialOpenedRef.current) {
      const shouldOpen =
        location.state?.openAddUser ||
        location.state?.openAddModal ||
        searchParams.get("add") === "true";
      const targetRoleName = (
        location.state?.defaultRole ||
        searchParams.get("role") ||
        ""
      ).toLowerCase();

      if (shouldOpen) {
        initialOpenedRef.current = true;
        setEditing(null);
        let defaultRoleIds = [];
        let defaultDept = "";
        let defaultDesignation = "";
        if (targetRoleName && roles.length > 0) {
          const matchedRole = roles.find((r) =>
            r.name?.toLowerCase().includes(targetRoleName)
          );
          if (matchedRole) {
            defaultRoleIds = [matchedRole.id];
            if (targetRoleName.includes("operator")) {
              defaultDept = "Production";
              defaultDesignation = "Operator";
            }
          }
        }
        setForm({
          ...EMPTY_FORM,
          role_ids: defaultRoleIds,
          department: defaultDept,
          designation: defaultDesignation,
        });
        setErrors({});
        setModalOpen(true);
      }
    }
  }, [loading, roles, location.state, searchParams]);

  if (!isAdmin) return <AccessDenied />;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      full_name: u.full_name || "",
      email: u.email || "",
      phone: u.phone || "",
      employee_id: u.employee_id || "",
      designation: u.designation || "",
      department: u.department || "",
      plant_code: u.plant_code || "",
      assigned_machine_id: u.assigned_machine_id ? String(u.assigned_machine_id) : "",
      password: "",
      is_active: u.is_active ?? true,
      role_ids: (u.roles || []).map((r) => r.id),
    });
    setErrors({});
    setModalOpen(true);
  };

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
      const emailDup = users.find(
        (u) =>
          u.email &&
          u.email.trim().toLowerCase() === form.email.trim().toLowerCase() &&
          (!editing || u.id !== editing.id)
      );
      if (emailDup) e.email = `Email is already in use by ${emailDup.full_name}`;
    }

    if (form.employee_id.trim()) {
      const empIdTrim = form.employee_id.trim().toLowerCase();
      const empDup = users.find(
        (u) =>
          u.employee_id &&
          u.employee_id.trim().toLowerCase() === empIdTrim &&
          (!editing || u.id !== editing.id)
      );
      if (empDup) {
        e.employee_id = `Employee ID '${form.employee_id.trim()}' is already assigned to ${empDup.full_name}`;
      }
    }

    if (!editing && form.password.length < 6) e.password = "Password must be at least 6 characters";
    if (editing && form.password && form.password.length < 6)
      e.password = "Password must be at least 6 characters";
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
        assigned_machine_id: form.assigned_machine_id ? parseInt(form.assigned_machine_id, 10) : null,
        is_active: form.is_active,
        role_ids: form.role_ids,
      };
      if (editing) {
        if (form.password) payload.password = form.password;
        await updateUser(editing.id, payload);
        addToast("User updated successfully");
      } else {
        payload.password = form.password;
        await createUser(payload);
        addToast("User created successfully");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      addToast(typeof detail === "string" ? detail : "Could not save user", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteUser(toDelete.id);
      addToast("User deleted");
      setToDelete(null);
      load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      addToast(typeof detail === "string" ? detail : "Could not delete user", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleResetPassword = async (user) => {
    setResettingId(user.id);
    try {
      const { data } = await adminResetUserPassword(user.id);
      addToast(data?.message || "Password reset link sent to user.", "success");
    } catch (err) {
      const detail = err.response?.data?.detail || err.response?.data?.message;
      addToast(typeof detail === "string" ? detail : "Could not send reset link", "error");
    } finally {
      setResettingId(null);
    }
  };

  const columns = [
    {
      key: "full_name",
      label: "User Profile",
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-800 dark:text-slate-200">{r.full_name}</div>
          <div className="text-xs text-slate-500">{r.email}</div>
          {r.employee_id && (
            <div className="text-xs font-mono text-teal-600 dark:text-teal-400">ID: {r.employee_id}</div>
          )}
        </div>
      ),
    },
    {
      key: "department",
      label: "Department & Role",
      render: (r) => (
        <div>
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
            {r.department || "—"} {r.designation ? `(${r.designation})` : ""}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {r.roles && r.roles.length ? (
              r.roles.map((role) => (
                <span
                  key={role.id}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)] dark:bg-teal-900/30 dark:text-teal-300"
                >
                  {role.name === "Admin" && <ShieldCheck className="h-3 w-3" />}
                  {role.name}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400">No role</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      label: "Contact & Plant",
      render: (r) => (
        <div className="space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
          <div>Phone: {r.phone || "—"}</div>
          {r.plant_code && <div>Plant: <span className="font-semibold">{r.plant_code}</span></div>}
          {r.assigned_machine_id && <div>Machine ID: <span className="font-semibold">{r.assigned_machine_id}</span></div>}
        </div>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      render: (r) => <StatusBadge active={r.is_active} />,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleResetPassword(r)}
            disabled={resettingId === r.id}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50 dark:hover:bg-amber-900/20"
            title="Send password reset link"
          >
            <KeyRound className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openEdit(r)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-[var(--color-success-soft)] hover:text-teal-600 dark:hover:bg-teal-900/20"
            title="Edit user"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setToDelete(r)}
            disabled={r.id === currentUser?.id}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-900/20"
            title={r.id === currentUser?.id ? "You cannot delete your own account" : "Delete user"}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        eyebrow="Admin"
        title="User Management"
        subtitle="Create, view, and manage all user accounts and their assigned roles."
        action={
          <Button variant="add" type="button" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
            Add User
          </Button>
        }
      />

      <div className="ui-grid-kpi">
        <KpiCard label="Total Users" value={users.length} icon={UserCog} tone="primary" />
        <KpiCard
          label="Active"
          value={users.filter((u) => u.is_active).length}
          icon={UserCog}
          tone="success"
        />
        <KpiCard
          label="Administrators"
          value={users.filter((u) => (u.roles || []).some((r) => r.name === "Admin")).length}
          icon={ShieldCheck}
          tone="info"
        />
      </div>

      <div className="ui-card p-4 sm:p-6">
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading users…</p>
        ) : (
          <DataTable
            columns={columns}
            data={users}
            searchKeys={["full_name", "email", "phone", "employee_id", "department", "designation", "plant_code"]}
            searchPlaceholder="Search"
            pageSize={10}
          />
        )}
      </div>

      <AdminModal
        title={editing ? "Edit User" : "Add User"}
        subtitle={editing ? editing.email : "Create a new user account and assign roles."}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            required
            value={form.full_name}
            error={errors.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            placeholder="Jane Doe"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              error={errors.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="jane@company.com"
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
              placeholder="Production Manager"
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
            label={editing ? "New Password" : "Password"}
            type="password"
            required={!editing}
            value={form.password}
            error={errors.password}
            hint={editing ? "Leave blank to keep the current password." : "Minimum 6 characters."}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="••••••"
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Roles
            </label>
            {roles.length === 0 ? (
              <p className="text-xs text-slate-400">No roles available. Create roles first.</p>
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
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <Button
              type="submit"
              variant={editing ? "edit" : "primary"}
              disabled={saving}
              loading={saving}
            >
              {saving ? "Saving…" : editing ? "Save Changes" : "Create User"}
            </Button>
          </div>
        </form>
      </AdminModal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete user"
        message={`Permanently delete ${toDelete?.full_name || "this user"}? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
