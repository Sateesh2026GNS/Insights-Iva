import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus, Pencil, Trash2 } from "lucide-react";

import NewRoleModal from "../../components/admin/NewRoleModal";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import AccessDenied from "../../components/admin/AccessDenied";
import AdminToolkitChrome, { AdminToolkitKpis } from "../../components/admin/AdminToolkitChrome";
import usePermissions from "../../hooks/usePermissions";
import usePageRefresh from "../../hooks/usePageRefresh";
import { countModulePermissions, permissionLabel } from "../../config/permissions";
import { useToast } from "../../context/ToastContext";
import Button from "../../components/common/Button";
import {
  getRoles,
  getModules,
  createRole,
  updateRole,
  deleteRole,
} from "../../api/adminApi";

const MODULE_GROUPS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "sales", label: "Sales" },
  { id: "inventory", label: "Inventory" },
  { id: "procurement", label: "Procurement" },
  { id: "production", label: "Production" },
  { id: "quality", label: "Quality Control" },
  { id: "dispatch", label: "Dispatch" },
  { id: "accounts", label: "Accounts" },
  { id: "hr", label: "HR" },
  { id: "admin", label: "Administration" },
];

function permissionModule(code) {
  if (!code) return "other";
  if (code.includes(":")) return code.split(":")[0];
  return code;
}

function groupedPermissionSummary(permissions, modules) {
  if (!permissions?.length) return [];
  const buckets = new Map();
  permissions.forEach((code) => {
    const mod = permissionModule(code);
    const group = MODULE_GROUPS.find((g) => g.id === mod) || { id: mod, label: permissionLabel(mod, modules) };
    const list = buckets.get(group.id) || { label: group.label, items: [] };
    list.items.push(permissionLabel(code, modules));
    buckets.set(group.id, list);
  });
  return [...buckets.values()];
}

export default function RolesPermissions() {
  const { pathname } = useLocation();
  const permissionsOnly = pathname.includes("/permissions");
  const { isAdmin } = usePermissions();
  const { addToast } = useToast();

  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [r, m] = await Promise.all([getRoles(), getModules()]);
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
      setModules(m.data || []);
    } catch (err) {
      if (!isRefresh) addToast("Failed to load roles", "error");
      if (isRefresh) throw err;
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!isAdmin) return <AccessDenied />;

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (role) => {
    setEditing(role);
    setModalOpen(true);
  };

  const handleRoleSave = async (payload) => {
    setSaving(true);
    try {
      if (editing) {
        await updateRole(editing.id, payload);
        addToast(permissionsOnly ? "Permissions updated" : "Role updated");
      } else {
        await createRole(payload);
        addToast("Role created");
      }
      setModalOpen(false);
      setEditing(null);
      load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      addToast(typeof detail === "string" ? detail : "Could not save role", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteRole(toDelete.id);
      addToast("Role deleted");
      setToDelete(null);
      load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      addToast(typeof detail === "string" ? detail : "Could not delete role", "error");
    } finally {
      setDeleting(false);
    }
  };

  const isAdminRole = editing?.is_system;
  const filteredRoles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((role) =>
      [role.name, role.description, ...(role.permissions || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [roles, searchQuery]);

  const kpiItems = [
    { label: "Total Roles", value: roles.length, tone: "blue", icon: String(roles.length || 0) },
    { label: "System Roles", value: roles.filter((r) => r.is_system).length, tone: "purple", icon: "S" },
    { label: "Custom Roles", value: roles.filter((r) => !r.is_system).length, tone: "green", icon: "C" },
    {
      label: "Assigned Users",
      value: roles.reduce((sum, r) => sum + Number(r.user_count || 0), 0),
      tone: "orange",
      icon: "U",
    },
  ];

  return (
    <div className="space-y-0 pb-4">
      <AdminToolkitChrome
        theme="purple"
        title={permissionsOnly ? "ROLES &" : "ROLES &"}
        highlight="PERMISSIONS"
        subtitle={
          permissionsOnly
            ? "Assign module access to roles and control what each team can use."
            : "Define roles and control which modules each role can access across the system."
        }
      >
        <AdminToolkitKpis items={kpiItems} />
        <div className="admin-toolkit-toolbar">
          <label className="admin-toolkit-field admin-toolkit-field--grow">
            <span>Search roles</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by role name, description or permission"
            />
          </label>
          <div className="admin-toolkit-actions">
            {permissionsOnly ? null : (
              <Button variant="add" type="button" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
                Add Role
              </Button>
            )}
          </div>
        </div>

        <section className="ppt-panel">
          <div className="ppt-panel__title">{permissionsOnly ? "Permission management" : "Roles listing"}</div>
          {loading ? (
            <p className="admin-toolkit-empty">Loading roles…</p>
          ) : filteredRoles.length === 0 ? (
            <p className="admin-toolkit-empty">
              {roles.length === 0 ? "No roles available." : "No roles match the search."}
            </p>
          ) : (
            <div className="ppt-table-wrap">
              <table className="ppt-table">
                <thead>
                  <tr>
                    <th className="ppt-left">Role Name</th>
                    <th className="ppt-left">Description</th>
                    <th>Assigned Users</th>
                    <th className="ppt-left">Permissions</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoles.map((role) => {
                    const groups = role.is_system
                      ? [{ label: "All modules", items: ["Full access"] }]
                      : groupedPermissionSummary(role.permissions, modules);
                    return (
                      <tr key={role.id}>
                        <td className="ppt-left">{role.name}</td>
                        <td className="ppt-left">{role.description || "—"}</td>
                        <td>{role.user_count}</td>
                        <td className="ppt-left">
                          {groups.length === 0 ? (
                            "No modules granted"
                          ) : (
                            <div className="admin-toolkit-perm-group">
                              {groups.slice(0, 6).map((group) => (
                                <span key={group.label} className="ppt-status ppt-status--info">
                                  {group.label}
                                  {permissionsOnly && group.items.length ? ` · ${group.items.length}` : ""}
                                </span>
                              ))}
                              {groups.length > 6 ? (
                                <span className="ppt-status ppt-status--pending">+{groups.length - 6}</span>
                              ) : null}
                              {!permissionsOnly && !role.is_system ? (
                                <span className="ppt-status ppt-status--success">
                                  {countModulePermissions(role.permissions, modules)} modules
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`ppt-status ${role.is_system ? "ppt-status--success" : "ppt-status--info"}`}>
                            {role.is_system ? "System" : "Custom"}
                          </span>
                        </td>
                        <td className="ppt-actions-cell">
                          <Button variant="ghost" size="sm" type="button" onClick={() => openEdit(role)}>
                            <Pencil className="h-3.5 w-3.5" /> {permissionsOnly ? "Edit Permissions" : "Edit"}
                          </Button>
                          {!permissionsOnly ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => setToDelete(role)}
                              disabled={role.is_system || role.user_count > 0}
                              title={
                                role.is_system
                                  ? "The Admin role cannot be deleted"
                                  : role.user_count > 0
                                    ? "Reassign users before deleting this role"
                                    : "Delete role"
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </AdminToolkitChrome>

      <NewRoleModal
        open={modalOpen}
        editing={editing}
        isSystemRole={isAdminRole}
        saving={saving}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleRoleSave}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete role"
        message={`Delete the "${toDelete?.name}" role? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
