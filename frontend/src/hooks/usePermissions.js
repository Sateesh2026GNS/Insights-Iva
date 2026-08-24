import {
  getEffectivePermissions,
  getUserRoleNames,
  hasPermission,
  hasRole,
  isAdmin,
  isOperator,
  userCanAccess,
  userCanAction,
} from "../config/permissions";
import useAuth from "./useAuth";

export default function usePermissions() {
  const { user } = useAuth();
  return {
    user,
    isAdmin: isAdmin(user),
    isOperator: isOperator(user),
    permissions: getEffectivePermissions(user),
    roles: getUserRoleNames(user),
    can: (module) => userCanAccess(user, module),
    canAction: (module, action) => userCanAction(user, module, action),
    hasRole: (roleName) => hasRole(user, roleName),
    hasPermission: (module) => hasPermission(user, module),
  };
}
