import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus, Pencil, Trash2, ShieldCheck, Lock, Users, KeyRound } from "lucide-react";

import PageHeader from "../../components/common/PageHeader";
import NewRoleModal from "../../components/admin/NewRoleModal";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import AccessDenied from "../../components/admin/AccessDenied";
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

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [r, m] = await Promise.all([getRoles(), getModules()]);
      setRoles(r.data || []);
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

  const labelFor = (code) => permissionLabel(code, modules);

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

  return (
    <div className="space-y-5 pb-4">
      <PageHeader
        eyebrow="Admin"
        title={permissionsOnly ? "Permissions" : "Roles"}
        subtitle={
          permissionsOnly
            ? "Assign module access to roles and control what each team can use."
            : "Define roles and control which modules each role can access across the system."
        }
        action={
          permissionsOnly ? null : (
            <Button variant="add" type="button" onClick={openCreate} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />}>
              New Role
            </Button>
          )
        }
      />

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Loading roles…</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <div
              key={role.id}
              className="flex flex-col ui-card p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {role.is_system ? (
                    <ShieldCheck className="h-5 w-5 text-teal-600" />
                  ) : permissionsOnly ? (
                    <KeyRound className="h-5 w-5 text-slate-400" />
                  ) : (
                    <Lock className="h-5 w-5 text-slate-400" />
                  )}
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{role.name}</h3>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <Users className="h-3 w-3" />
                  {role.user_count}
                </span>
              </div>

              {!permissionsOnly && (
                <p className="mt-1 min-h-[2.5rem] text-sm text-slate-500 dark:text-slate-400">
                  {role.description || "No description"}
                </p>
              )}

              <div className={`flex flex-wrap gap-1.5 ${permissionsOnly ? "mt-3" : "mt-3"}`}>
                {role.is_system ? (
                  <span className="inline-flex rounded-md bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)] dark:bg-teal-900/30 dark:text-teal-300">
                    Full access (all modules)
                  </span>
                ) : permissionsOnly ? (
                  role.permissions.length ? (
                    role.permissions.map((code) => (
                      <span
                        key={code}
                        className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                      >
                        {labelFor(code)}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">No modules granted</span>
                  )
                ) : (
                  <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {countModulePermissions(role.permissions, modules)} module
                    {countModulePermissions(role.permissions, modules) === 1 ? "" : "s"} granted
                    {role.permissions.some((p) => p.includes(":"))
                      ? ` · ${role.permissions.filter((p) => p.includes(":")).length} action rule(s)`
                      : ""}
                  </span>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-1 border-t border-slate-100 pt-3 dark:border-slate-700/50">
                <button
                  type="button"
                  onClick={() => openEdit(role)}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-[var(--color-success-soft)] hover:text-teal-600 dark:text-slate-300 dark:hover:bg-teal-900/20"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {permissionsOnly ? "Edit Permissions" : "Edit"}
                </button>
                {!permissionsOnly && (
                  <button
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
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-300 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
