import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, KeyRound } from "lucide-react";

import { ErrorState, PermissionDeniedState } from "../../components/common/states";
import { Input } from "../../components/common/FormField";
import AdminModal from "../../components/admin/AdminModal";
import InviteUserModal from "../../components/admin/InviteUserModal";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import AccessDenied from "../../components/admin/AccessDenied";
import AdminToolkitChrome, { AdminToolkitKpis } from "../../components/admin/AdminToolkitChrome";
import usePermissions from "../../hooks/usePermissions";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import Button from "../../components/common/Button";
import {
  getUsers,
  getRoles,
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
    <span className={`ppt-status ${active ? "ppt-status--success" : "ppt-status--info"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function formatLastLogin(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UserManagement() {
  const { isAdmin, user: currentUser } = usePermissions();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [resettingId, setResettingId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialOpenedRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setLoadError(null);
    try {
      const [u, r] = await Promise.all([
        getUsers({ skipGlobalError: true }),
        getRoles({ skipGlobalError: true }),
      ]);
      setUsers(u.data || []);
      const rawRoles = r.data || [];
      const seenNames = new Set();
      const uniqueRoles = [];
      for (const role of rawRoles) {
        const k = String(role.name || "").trim().toLowerCase();
        if (k && !seenNames.has(k)) {
          seenNames.add(k);
          uniqueRoles.push(role);
        }
      }
      setRoles(uniqueRoles);
    } catch (err) {
      setLoadError(err);
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
        setInviteOpen(true);
      }
    }
  }, [loading, roles, location.state, searchParams]);

  if (!isAdmin) return <AccessDenied />;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setInviteOpen(true);
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

    if (form.password && form.password.length < 6)
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
      if (form.password) payload.password = form.password;
      await updateUser(editing.id, payload);
      addToast("User updated successfully");
      setModalOpen(false);
      setEditing(null);
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

  const handleToggleActive = async (user) => {
    if (user.id === currentUser?.id) {
      addToast("You cannot deactivate your own account", "error");
      return;
    }
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      addToast(user.is_active ? "User deactivated" : "User activated");
      load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      addToast(typeof detail === "string" ? detail : "Could not update user status", "error");
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

  const roleOptions = useMemo(
    () => [...new Set(users.flatMap((u) => (u.roles || []).map((r) => r.name)).filter(Boolean))].sort(),
    [users]
  );
  const departmentOptions = useMemo(
    () => [...new Set(users.map((u) => u.department).filter(Boolean))].sort(),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && !(u.roles || []).some((r) => r.name === roleFilter)) return false;
      if (statusFilter === "active" && !u.is_active) return false;
      if (statusFilter === "inactive" && u.is_active) return false;
      if (departmentFilter && u.department !== departmentFilter) return false;
      if (!q) return true;
      const haystack = [
        u.full_name,
        u.email,
        u.phone,
        u.employee_id,
        u.department,
        u.designation,
        ...(u.roles || []).map((r) => r.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, searchQuery, roleFilter, statusFilter, departmentFilter]);

  const kpiItems = [
    { label: "Total Users", value: users.length, tone: "blue", icon: String(users.length) },
    { label: "Active", value: users.filter((u) => u.is_active).length, tone: "green", icon: "A" },
    { label: "Inactive", value: users.filter((u) => !u.is_active).length, tone: "orange", icon: "I" },
    {
      label: "Administrators",
      value: users.filter((u) => (u.roles || []).some((r) => r.name === "Admin")).length,
      tone: "purple",
      icon: "Ad",
    },
  ];

  return (
    <div className="space-y-0 pb-4">
      <AdminToolkitChrome
        theme="blue"
        title="USER"
        highlight="MANAGEMENT"
        subtitle="Create, view, and manage user accounts, roles, and access."
      >
        <AdminToolkitKpis items={kpiItems} />
        <div className="admin-toolkit-toolbar">
          <label className="admin-toolkit-field admin-toolkit-field--grow">
            <span>Search users</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, role or department"
            />
          </label>
          <label className="admin-toolkit-field">
            <span>Role</span>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All roles</option>
              {roleOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="admin-toolkit-field">
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="admin-toolkit-field">
            <span>Department</span>
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="">All departments</option>
              {departmentOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <div className="admin-toolkit-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setSearchQuery("");
                setRoleFilter("");
                setStatusFilter("");
                setDepartmentFilter("");
              }}
            >
              Reset
            </Button>
            <Button variant="add" type="button" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              Add User
            </Button>
          </div>
        </div>

        <section className="ppt-panel">
          <div className="ppt-panel__title">Users</div>
          {loading ? (
            <p className="admin-toolkit-empty">Loading users…</p>
          ) : loadError?.response?.status === 403 ? (
            <PermissionDeniedState />
          ) : loadError ? (
            <ErrorState onRetry={() => load()} />
          ) : filteredUsers.length === 0 ? (
            <p className="admin-toolkit-empty">
              {users.length === 0 ? "No users available." : "No users match the selected filters."}
            </p>
          ) : (
            <div className="ppt-table-wrap">
              <table className="ppt-table">
                <thead>
                  <tr>
                    <th className="ppt-left">User</th>
                    <th className="ppt-left">Email</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((r) => (
                    <tr key={r.id}>
                      <td className="ppt-left">{r.full_name}</td>
                      <td className="ppt-left">{r.email}</td>
                      <td>{(r.roles || []).map((role) => role.name).join(", ") || "—"}</td>
                      <td>{r.department || "—"}</td>
                      <td><StatusBadge active={r.is_active} /></td>
                      <td>{formatLastLogin(r.last_login_at)}</td>
                      <td className="ppt-actions-cell">
                        <Button variant="ghost" size="sm" type="button" onClick={() => setViewing(r)} title="View user">
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        <Button variant="ghost" size="sm" type="button" onClick={() => openEdit(r)} title="Edit user">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => handleToggleActive(r)}
                          disabled={r.id === currentUser?.id}
                        >
                          {r.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => handleResetPassword(r)}
                          disabled={resettingId === r.id}
                          title="Send password reset link"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => setToDelete(r)}
                          disabled={r.id === currentUser?.id}
                          title={r.id === currentUser?.id ? "You cannot delete your own account" : "Delete user"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </AdminToolkitChrome>

      <InviteUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="New User"
        defaultRole={location.state?.defaultRole || searchParams.get("role") || ""}
        onSuccess={() => {
          load();
          const returnTo = location.state?._returnTo;
          if (returnTo) {
            navigate(`${returnTo}?refreshUsers=true`, {
              replace: true,
              state: { _fromPath: "/admin/users" },
            });
          }
        }}
      />

      <AdminModal
        title="Edit User"
        subtitle={editing?.email}
        open={modalOpen && Boolean(editing)}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
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
            label="New Password"
            type="password"
            value={form.password}
            error={errors.password}
            hint="Leave blank to keep the current password."
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
              variant="edit"
              disabled={saving}
              loading={saving}
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </AdminModal>

      <AdminModal
        title="User details"
        subtitle={viewing?.email}
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
      >
        {viewing ? (
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">User</dt><dd>{viewing.full_name}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Email</dt><dd>{viewing.email}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Role</dt><dd>{(viewing.roles || []).map((r) => r.name).join(", ") || "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Department</dt><dd>{viewing.department || "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Status</dt><dd>{viewing.is_active ? "Active" : "Inactive"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Last Login</dt><dd>{formatLastLogin(viewing.last_login_at)}</dd></div>
          </dl>
        ) : null}
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="secondary" onClick={() => setViewing(null)}>Close</Button>
        </div>
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
