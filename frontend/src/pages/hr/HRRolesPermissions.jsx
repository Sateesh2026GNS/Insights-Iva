import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronRight,
  Search,
  UserCog,
  X,
} from "lucide-react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { useToast } from "../../context/ToastContext";
import { getHrRolePermissions, getHrRoleUsers, saveHrRolePermissions } from "../../api/hrApi";
import "./rolesPermissions.css";

const ROLES = [
  { id: "account", label: "Account" },
  { id: "admin", label: "Admin" },
  { id: "employee", label: "Employee" },
  { id: "manager", label: "Manager" },
  { id: "top-management", label: "Top Management" },
];

const PERMISSION_GROUPS = [
  {
    id: "attendance",
    label: "Attendance",
    items: [
      { id: "attendance.view", label: "View Attendance" },
      { id: "attendance.check_in_out", label: "Enable Check In - Check out" },
      { id: "attendance.regularization_edit", label: "Add / Edit Regularization request" },
      { id: "attendance.selfie_check", label: "Allow Check-In Check-Out With Selfie" },
      { id: "attendance.regularization_view", label: "View Regularization Request" },
    ],
  },
  {
    id: "overtime",
    label: "Overtime",
    items: [
      { id: "overtime.start_stop", label: "Allow Overtime Start-Stop" },
      { id: "overtime.edit", label: "Add / Edit Overtime request" },
      { id: "overtime.view", label: "View Overtime Request" },
    ],
  },
  {
    id: "leave",
    label: "Leave Tracker",
    items: [
      { id: "leave.edit", label: "Add Edit Leave Request" },
      { id: "leave.my", label: "My Leave" },
      { id: "leave.holidays", label: "View Holidays" },
    ],
  },
  {
    id: "employee",
    label: "Employee Management",
    items: [
      { id: "employee.profile", label: "View Employee Profile" },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    items: [
      { id: "payroll.manage", label: "Manage Payroll" },
      { id: "payroll.payslip", label: "View Payslip" },
      { id: "payroll.tally", label: "Tally Configuration" },
    ],
  },
  {
    id: "announcement",
    label: "Announcement",
    items: [
      { id: "announcement.view", label: "View Announcement" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [
      { id: "reports.pf", label: "PF Report" },
      { id: "reports.esic", label: "ESIC Report" },
      { id: "reports.salary", label: "Salary Report" },
      { id: "reports.bank_template", label: "Bank Template Report" },
      { id: "reports.site_visit", label: "Site Visit Summary Report" },
    ],
  },
  {
    id: "expense",
    label: "Expense",
    items: [
      { id: "expense.my", label: "My Expense" },
      { id: "expense.self_approve", label: "Self Request Approve/Reject" },
      { id: "expense.self_edit", label: "Self Expense Add-Edit" },
      { id: "expense.team", label: "Manage expense for team (Reimbursement/ADD,EDIT,APPROVE,REJECT for TEAM))" },
    ],
  },
  {
    id: "assets",
    label: "Asset Management",
    items: [
      { id: "assets.view", label: "View Asset" },
      { id: "assets.manage", label: "Manage Asset" },
    ],
  },
];

const ALL_PERMISSION_IDS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.id));

function defaultPermissions(enabled = true) {
  return ALL_PERMISSION_IDS.reduce((acc, id) => {
    acc[id] = enabled;
    return acc;
  }, {});
}

function defaultRoleMap() {
  return ROLES.reduce((acc, role) => {
    acc[role.id] = defaultPermissions(true);
    return acc;
  }, {});
}

function StatusToggle({ checked, onChange, ariaLabel }) {
  return (
    <button
      type="button"
      className={`hr-roles-permissions__toggle ${checked ? "hr-roles-permissions__toggle--on" : ""}`}
      onClick={() => onChange(!checked)}
      aria-label={ariaLabel}
      aria-pressed={checked}
    >
      <span />
    </button>
  );
}

function UserSpecificModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const modal = (
    <div className="hr-roles-permissions__overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="User-Specific Permission">
      <div className="hr-roles-permissions__modal" onClick={(e) => e.stopPropagation()}>
        <div className="hr-roles-permissions__modal-header">
          <h2>User-Specific Permission</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="hr-roles-permissions__modal-body">No Data Found</div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export default function HRRolesPermissions() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState("account");
  const [userSearch, setUserSearch] = useState("");
  const [permissionMap, setPermissionMap] = useState(defaultRoleMap());
  const [draftPermissions, setDraftPermissions] = useState(defaultPermissions(true));
  const [expandedGroups, setExpandedGroups] = useState(() => PERMISSION_GROUPS.map((g) => g.id));
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [users, setUsers] = useState([]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getHrRolePermissions(selectedRole);
      const data = res?.data?.permissions || res?.data;
      if (data && typeof data === "object") {
        setPermissionMap((prev) => ({ ...prev, [selectedRole]: { ...defaultPermissions(true), ...data } }));
        setDraftPermissions({ ...defaultPermissions(true), ...data });
      } else {
        setDraftPermissions(defaultPermissions(true));
      }
    } catch {
      setDraftPermissions(permissionMap[selectedRole] || defaultPermissions(true));
      addToast("Failed to load permissions", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedRole, addToast]);

  usePageRefresh(() => load(true));

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    getHrRoleUsers(selectedRole)
      .then((res) => {
        if (!cancelled) setUsers(Array.isArray(res?.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => { cancelled = true; };
  }, [selectedRole]);

  useEffect(() => {
    setDraftPermissions(permissionMap[selectedRole] || defaultPermissions(true));
    setUserSearch("");
  }, [selectedRole, permissionMap]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.name.toLowerCase().includes(q));
  }, [users, userSearch]);

  const setPermission = (id, value) => {
    setDraftPermissions((prev) => ({ ...prev, [id]: value }));
  };

  const setGroupPermissions = (group, value) => {
    setDraftPermissions((prev) => {
      const next = { ...prev };
      group.items.forEach((item) => { next[item.id] = value; });
      return next;
    });
  };

  const isGroupOn = (group) => group.items.every((item) => draftPermissions[item.id]);

  const toggleGroupExpanded = (groupId) => {
    setExpandedGroups((prev) => (
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    ));
  };

  const handleReset = () => {
    setDraftPermissions(permissionMap[selectedRole] || defaultPermissions(true));
    addToast("Changes reset", "info");
  };

  const handleSave = async () => {
    const nextMap = { ...permissionMap, [selectedRole]: draftPermissions };
    try {
      await saveHrRolePermissions(selectedRole, { permissions: draftPermissions });
      setPermissionMap(nextMap);
      addToast("Permissions saved", "success");
    } catch {
      addToast("Failed to save permissions", "error");
    }
  };

  if (loading) return <Loader label="Loading roles and permissions..." />;

  return (
    <>
      <ListPageShell>
        <div className="hr-roles-permissions min-w-0">
          <h1 className="hr-roles-permissions__title">Roles and Permissions</h1>

          <div className="hr-roles-permissions__tabbar">
            <span className="hr-roles-permissions__tab">Roles &amp; Permissions</span>
            <button
              type="button"
              className="hr-roles-permissions__user-specific-btn"
              onClick={() => setUserModalOpen(true)}
            >
              <UserCog className="h-4 w-4 text-[#2563eb]" />
              User-Specific Permission
            </button>
          </div>

          <div className="hr-roles-permissions__grid">
            <section className="hr-roles-permissions__panel">
              <h2 className="hr-roles-permissions__panel-title">Select Role</h2>
              <div className="hr-roles-permissions__panel-body">
                <div className="hr-roles-permissions__role-list">
                  {ROLES.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      className={`hr-roles-permissions__role-btn ${selectedRole === role.id ? "hr-roles-permissions__role-btn--active" : ""}`}
                      onClick={() => setSelectedRole(role.id)}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="hr-roles-permissions__panel">
              <h2 className="hr-roles-permissions__panel-title">Select User</h2>
              <div className="hr-roles-permissions__panel-body">
                <div className="hr-roles-permissions__search">
                  <Search className="h-4 w-4" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search User"
                  />
                </div>
                {filteredUsers.length === 0 ? (
                  <p className="hr-roles-permissions__empty">No user found</p>
                ) : (
                  filteredUsers.map((user) => (
                    <div key={user.id} className="hr-roles-permissions__user-item">{user.name}</div>
                  ))
                )}
              </div>
            </section>

            <section className="hr-roles-permissions__panel">
              <h2 className="hr-roles-permissions__panel-title">Permissions</h2>
              <div className="hr-roles-permissions__panel-body">
                <div className="hr-roles-permissions__permissions">
                  {PERMISSION_GROUPS.map((group) => {
                    const expanded = expandedGroups.includes(group.id);
                    return (
                      <div key={group.id} className="hr-roles-permissions__group">
                        <div className="hr-roles-permissions__group-header">
                          <button type="button" onClick={() => toggleGroupExpanded(group.id)}>
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span>{group.label}</span>
                          </button>
                          <StatusToggle
                            checked={isGroupOn(group)}
                            onChange={(value) => setGroupPermissions(group, value)}
                            ariaLabel={`Toggle ${group.label}`}
                          />
                        </div>
                        {expanded && (
                          <div className="hr-roles-permissions__group-items">
                            {group.items.map((item) => (
                              <div key={item.id} className="hr-roles-permissions__perm-row">
                                <span>{item.label}</span>
                                <StatusToggle
                                  checked={Boolean(draftPermissions[item.id])}
                                  onChange={(value) => setPermission(item.id, value)}
                                  ariaLabel={item.label}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="hr-roles-permissions__panel-footer">
                <button type="button" className="hr-roles-permissions__reset-btn" onClick={handleReset}>Reset</button>
                <button type="button" className="hr-roles-permissions__save-btn" onClick={handleSave}>Save</button>
              </div>
            </section>
          </div>
        </div>
      </ListPageShell>

      <UserSpecificModal open={userModalOpen} onClose={() => setUserModalOpen(false)} />
    </>
  );
}
